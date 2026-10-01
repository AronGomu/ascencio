import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

export interface AppBuildBoundary {
  base: string;
}

/** App metadata only. Content acquisition is never a build prerequisite. */
export function appAssetsPlugin(
  projectRoot: string,
  buildId: string,
  coreContentApiVersion: number,
  boundary: AppBuildBoundary,
): Plugin {
  const release = JSON.stringify({
    schemaVersion: 1,
    buildId,
    coreContentApiVersion,
  });
  return {
    name: "ygo-app-assets",
    configResolved(config) {
      boundary.base = config.base;
      if (config.command === "build" && config.mode !== "native")
        throw new Error(
          "Public deployment is not approved; use native build mode",
        );
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? "").split("?")[0];
        if (
          pathname !== `${server.config.base}core-release.json` &&
          pathname !== `${server.config.base}app-icon.svg`
        )
          return next();
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, HEAD");
          response.end("Method not allowed");
          return;
        }
        const icon = pathname.endsWith("app-icon.svg");
        void (
          icon
            ? readFile(path.join(projectRoot, "assets/app/app-icon.svg"))
            : Promise.resolve(release)
        ).then(
          (bytes) => {
            response.setHeader(
              "Content-Type",
              icon ? "image/svg+xml" : "application/json",
            );
            response.setHeader("Cache-Control", "no-store");
            response.end(request.method === "HEAD" ? undefined : bytes);
          },
          () => {
            response.statusCode = 500;
            response.end("App asset unavailable");
          },
        );
      });
    },
    async generateBundle(_options, bundle) {
      const wasm = Object.values(bundle).filter((output) =>
        output.fileName.endsWith(".wasm"),
      );
      if (wasm.length !== 0)
        throw new Error(
          "Native frontend must not bundle browser SQLite or engine WASM; the native content reader owns them",
        );
      for (const output of Object.values(bundle)) {
        if (
          /\.(?:sqlite|db|zip|jpg|jpeg|png|webp|mp3|mp4|ogg|webm|lua|cdb)$/i.test(
            output.fileName,
          ) ||
          /^(?:content|runtime|story|generated)\//.test(output.fileName) ||
          (/\.svg$/i.test(output.fileName) &&
            output.fileName !== "app-icon.svg")
        )
          throw new Error(
            `App bundle contains forbidden payload: ${output.fileName}`,
          );
      }
      this.emitFile({
        type: "asset",
        fileName: "core-release.json",
        source: release,
      });
      this.emitFile({
        type: "asset",
        fileName: "PRIVATE_DEPLOYMENT_ONLY.txt",
        source:
          "This app artifact has no public-distribution approval. Keep it private.\n",
      });
      for (const [source, fileName] of [
        ["assets/app/app-icon.svg", "app-icon.svg"],
        ["node_modules/svelte/LICENSE.md", "licenses/svelte-MIT.txt"],
        ["vendor/ocgcore-wasm/0.1.2/LICENSE", "licenses/ocgcore-wasm-MIT.txt"],
      ] as const)
        this.emitFile({
          type: "asset",
          fileName,
          source: await readFile(path.join(projectRoot, source)),
        });
    },
  };
}
