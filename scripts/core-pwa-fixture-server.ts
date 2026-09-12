import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const projectRoot = process.cwd();
const port = Number(process.env.CORE_SOURCE_PORT ?? "4400");
if (!Number.isSafeInteger(port) || port <= 0)
  throw new Error("CORE_SOURCE_PORT must be a positive integer");
const basePath = normalizedBase(process.env.BASE_PATH ?? "/");
let shellVersion: "a" | "b" | "broken" = "a";

const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
});

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://core.local");
    if (!url.pathname.startsWith(basePath)) {
      response.writeHead(404).end("Not found");
      return;
    }
    const relative = url.pathname.slice(basePath.length);
    const appJavaScriptMatch = /^__test\/app-javascript\/([ab])$/.exec(
      relative,
    );
    if (appJavaScriptMatch !== null) {
      if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end("Method not allowed");
        return;
      }
      const files = (
        await filesUnder(
          path.join(projectRoot, `dist-${appJavaScriptMatch[1]}`),
        )
      )
        .filter((file) => file.endsWith(".js") && file !== "service-worker.js")
        .sort();
      response
        .writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        })
        .end(JSON.stringify(files));
      return;
    }
    const versionMatch = /^__test\/shell-version\/(a|b|broken)$/.exec(relative);
    if (versionMatch !== null) {
      if (request.method !== "POST") {
        response.writeHead(405, { Allow: "POST" }).end("Method not allowed");
        return;
      }
      shellVersion = versionMatch[1] as "a" | "b" | "broken";
      response
        .writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        })
        .end(JSON.stringify({ shellVersion }));
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
      return;
    }
    if (/%|\\/.test(relative)) {
      response.writeHead(404).end("Not found");
      return;
    }
    if (shellVersion === "broken" && relative === "app-icon.svg") {
      response.writeHead(503).end("Fixture precache failure");
      return;
    }
    const root = path.join(
      projectRoot,
      shellVersion === "broken" ? "dist-a" : `dist-${shellVersion}`,
    );
    const target = path.resolve(
      root,
      relative === "" ? "index.html" : relative,
    );
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      response.writeHead(404).end("Not found");
      return;
    }
    const info = await stat(target);
    if (!info.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Cache-Control":
        path.basename(target) === "service-worker.js" ? "no-store" : "no-cache",
      "Content-Length": info.size,
      "Content-Type":
        contentTypes[path.extname(target)] ?? "application/octet-stream",
      "Service-Worker-Allowed": basePath,
    });
    if (request.method === "HEAD") response.end();
    else createReadStream(target).pipe(response);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(500).end("Fixture server failed");
  }
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => server.close());

function normalizedBase(value: string): string {
  const leading = value.startsWith("/") ? value : `/${value}`;
  return leading.endsWith("/") ? leading : `${leading}/`;
}

async function filesUnder(root: string, relative = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of (
    await readdir(path.join(root, relative), {
      withFileTypes: true,
    })
  ).sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(root, child)));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}
