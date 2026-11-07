import { browserBotResource } from "../lib/browser-bot-packages.ts";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { build } from "vite";
import path from "node:path";
import { loadCriticalInputs } from "../bot-evaluation/critical-inputs.ts";
import { syncOnlyVendoredCorePlugin } from "../lib/vite-sync-core.ts";
const [root, port = "4214"] = process.argv.slice(2);
if (!root) throw new Error("Usage: serve-smoke.ts <critical-root> [port]");
const directory = path.resolve(".tmp/bot-smoke-web");
await mkdir(".tmp/bot-workloads", { recursive: true });
await build({
  configFile: false,
  root: process.cwd(),
  base: "/",
  plugins: [syncOnlyVendoredCorePlugin(process.cwd())],
  build: {
    rollupOptions: {
      input: path.resolve("test/helpers/bot-experiment/index.html"),
    },
    outDir: directory,
    emptyOutDir: true,
    target: "es2023",
    minify: true,
  },
  worker: {
    format: "es",
    plugins: () => [syncOnlyVendoredCorePlugin(process.cwd())],
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const loaded = await loadCriticalInputs(root);
const d = loaded.dependencies;
const dependencies = JSON.stringify(
  {
    ...d,
    cards: [...d.cards],
    texts: [...d.texts],
    scripts: [...d.scripts],
    images: [],
  },
  (_key, value) => (typeof value === "bigint" ? String(value) : value),
);
const games: unknown[] = [];
for await (const line of createInterface({
  input: createReadStream(
    "docs/evidence/bot-experiment/typescript-baseline.jsonl.gz",
  ).pipe(createGunzip()),
})) {
  const r = JSON.parse(line);
  if (
    r.type === "metadata" &&
    r.content.snapshotId !== loaded.manifest.snapshotId
  )
    throw new Error("Live content differs from retained baseline");
  if (r.type === "game") {
    await writeFile(
      `.tmp/bot-workloads/${games.length}.json`,
      JSON.stringify(r),
    );
    games.push({
      policy: r.policy,
      match: r.match,
      game: r.game,
      request: r.request,
    });
  }
}
await writeFile(
  path.join(directory, "index.html"),
  await readFile(
    path.join(directory, "test/helpers/bot-experiment/index.html"),
  ),
);
await writeFile(
  ".tmp/bot-harness-config.json",
  JSON.stringify({
    mode: process.argv[4] ?? "smoke",
    runtime: process.argv[5] ?? null,
  }),
);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url!, "http://localhost");
    const current = JSON.parse(
      await readFile(".tmp/bot-harness-config.json", "utf8"),
    );
    if (current.mode === "memory") {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    }
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname.startsWith("/bot-packages/")) {
      const resource = await browserBotResource(process.cwd(), url.pathname);
      if (!resource) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader("content-type", resource.type);
      res.end(resource.bytes);
      return;
    }
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader("access-control-allow-headers", "content-type");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    if (url.pathname === "/fixture/runtime") {
      res.end(
        JSON.stringify(
          JSON.parse(await readFile(".tmp/bot-harness-config.json", "utf8"))
            .runtime,
        ),
      );
      return;
    }
    if (url.pathname === "/fixture/mode") {
      res.end(
        JSON.stringify(
          JSON.parse(await readFile(".tmp/bot-harness-config.json", "utf8"))
            .mode,
        ),
      );
      return;
    }
    if (/^\/fixture\/workload\/\d+$/.test(url.pathname)) {
      res.setHeader("content-type", "application/json");
      res.end(
        await readFile(
          `.tmp/bot-workloads/${url.pathname.split("/").at(-1)}.json`,
        ),
      );
      return;
    }
    res.setHeader("access-control-allow-origin", "*");
    if (req.method === "POST" && url.pathname === "/fixture/trace") {
      let data = "";
      for await (const part of req) data += part;
      console.log(data);
      res.end("ok");
      return;
    }
    if (
      req.method === "POST" &&
      /^\/fixture\/result\/(wasm|native|typescript)(-benchmark|-throughput|-failures|-memory)?$/.test(
        url.pathname,
      )
    ) {
      let data = "";
      for await (const part of req) data += part;
      const file = `.tmp/${url.pathname.split("/").at(-1)}-runtime-smoke.json`;
      await writeFile(file, data);
      console.log(`RESULT ${file}: ${JSON.parse(data).type}`);
      res.end("ok");
      return;
    }
    if (url.pathname === "/fixture/dependencies") {
      res.setHeader("content-type", "application/json");
      res.end(dependencies);
      return;
    }
    if (url.pathname === "/fixture/games") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(games));
      return;
    }
    if (url.pathname === "/fixture/engine") {
      res.setHeader("content-type", "application/wasm");
      res.end(
        await readFile("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
      );
      return;
    }
    const relative =
      url.pathname === "/"
        ? "test/helpers/bot-experiment/index.html"
        : url.pathname.slice(1);
    const file = path.resolve(directory, relative);
    if (!file.startsWith(directory + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.setHeader(
      "content-type",
      file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".wasm")
          ? "application/wasm"
          : file.endsWith(".json")
            ? "application/json"
            : "text/html",
    );
    res.end(await readFile(file));
  } catch (error) {
    res.writeHead(500);
    res.end(String(error));
  }
});
await mkdir(".tmp", { recursive: true });
server.listen(Number(port), "127.0.0.1", () =>
  console.log(`Smoke server http://127.0.0.1:${port}/?runtime=wasm`),
);
