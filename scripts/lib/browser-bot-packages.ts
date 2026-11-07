/** Fixed browser-delivered packages. Never reads native app-data or arbitrary paths. */
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
export async function browserBotResource(
  root: string,
  pathname: string,
): Promise<{ type: string; bytes: Uint8Array } | null> {
  const base = path.join(root, "assets/ai-bots");
  if (pathname === "/bot-packages/index.json") {
    const folders = [];
    for (const entry of await readdir(base, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[a-z0-9][a-z0-9._-]*$/.test(entry.name)) {
        try {
          await readFile(path.join(base, entry.name, "bot.json"));
          folders.push(entry.name);
        } catch {
          /* Non-package build directories are not delivered. */
        }
      }
    }
    return {
      type: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(folders.sort())),
    };
  }
  const match =
    /^\/bot-packages\/([a-z0-9._-]+)\/(bot\.json|dist\/[a-z0-9._-]+\.wasm)$/.exec(
      pathname,
    );
  if (!match || match[1] === "." || match[1] === "..") return null;
  const folder = await realpath(path.join(base, match[1]!));
  const file = await realpath(path.join(folder, match[2]!));
  if (!file.startsWith(folder + path.sep))
    throw new Error("Unsafe bot resource");
  const bytes = await readFile(file);
  if (bytes.length > 4 * 1024 * 1024) throw new Error("Oversized bot resource");
  return {
    type: file.endsWith(".wasm") ? "application/wasm" : "application/json",
    bytes,
  };
}
export function browserBotPackagesPlugin(root: string): Plugin {
  return {
    name: "browser-bot-packages",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0]!;
        if (!pathname.startsWith("/bot-packages/")) return next();
        try {
          const resource = await browserBotResource(root, pathname);
          if (!resource) {
            res.statusCode = 404;
            res.end();
            return;
          }
          res.setHeader("content-type", resource.type);
          res.setHeader("cache-control", "no-store");
          res.end(resource.bytes);
        } catch (error) {
          res.statusCode = 500;
          res.end(String(error));
        }
      });
    },
  };
}
