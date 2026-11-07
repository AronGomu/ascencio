import type { Plugin } from "vite";

/** Keep source HTML with its application while preserving the public index URL. */
export function appEntryPlugin(): Plugin {
  return {
    name: "ascencio-app-entry",
    configureServer(server) {
      // Vite's SPA fallback resolves to /index.html after its other handlers.
      // Rewrite that URL immediately before the HTML transform middleware.
      return () => {
        server.middlewares.use((request, _response, next) => {
          const url = request.url ?? "/";
          const pathname = url.split("?")[0];
          // The base middleware has already removed any deployment prefix.
          if (pathname === "/" || pathname === "/index.html") {
            request.url = `/src/index.html${url.includes("?") ? `?${url.split("?").slice(1).join("?")}` : ""}`;
          }
          next();
        });
      };
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        for (const [source, destination] of [
          ["src/index.html", "index.html"],
          ["test/fixtures/acceptance/harness.html", "acceptance.html"],
        ]) {
          const entry = bundle[source!];
          if (!entry || entry.type !== "asset") continue;
          this.emitFile({
            type: "asset",
            fileName: destination!,
            source: entry.source,
          });
          delete bundle[source!];
        }
      },
    },
  };
}
