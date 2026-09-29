import { realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Connect, Plugin, ViteDevServer } from "vite";

const PRIVATE_ROOTS = ["assets/content", "generated/content-packages"] as const;
function within(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

async function canonicalPath(candidate: string): Promise<{
  ancestor: string;
  resolved: string;
}> {
  let ancestor = candidate;
  // Each miss removes one path segment; even missing roots terminate at /.
  for (;;) {
    try {
      const real = await realpath(ancestor);
      return {
        ancestor: real,
        resolved: path.resolve(real, path.relative(ancestor, candidate)),
      };
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "ENOENT" &&
        (error as NodeJS.ErrnoException).code !== "ENOTDIR"
      )
        throw error;
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
}

/** Pre-hook: runs before Vite transform, @fs, static, and SPA fallback handlers. */
export function contentSourceDenyPlugin(projectRoot: string): Plugin {
  const middleware =
    (
      base: string,
      servedRoot = projectRoot,
      server?: ViteDevServer,
    ): Connect.NextHandleFunction =>
    (request, response, next) => {
      void (async () => {
        const url = request.url ?? "/";
        // Bound per-request normalization and filesystem work, including postfixes.
        if (url.length > 8_192) throw new Error("Invalid source URL");
        let decoded = url.split(/[?#]/)[0]!;
        let uriDecoded = decoded;
        const spellings = new Set([decoded]);
        // Vite transforms use decodeURI; filesystem paths can decode reserved
        // characters too. Keep intermediate spellings: a literal %2F in a
        // symlink name must not disappear into a slash before realpath checks.
        for (let pass = 0; decoded.includes("%") && pass < 8; pass++) {
          uriDecoded = decodeURI(uriDecoded);
          decoded = decodeURIComponent(decoded);
          spellings.add(uriDecoded);
          spellings.add(decoded);
        }
        if (
          decoded.includes("%") ||
          decoded.includes("\\") ||
          decoded.includes("\0")
        )
          throw new Error("Invalid source URL");
        const candidates = new Set<string>();
        for (const spelling of spellings) {
          // Encoded ?/# can be either filename bytes or transform postfixes.
          for (const pathname of new Set([
            spelling,
            spelling.split(/[?#]/)[0]!,
          ])) {
            let id = (
              pathname.startsWith(base) ? pathname.slice(base.length) : pathname
            ).replace(/^\/+/, "");
            // Vite unwrapId removes /@id/ and restores __x00__. Inspect those
            // IDs before transforms or .map lookup; bound nested wrappers too.
            let wrapped = false;
            for (let pass = 0; ; pass++) {
              const slash = id.indexOf("/");
              if (slash < 0) break;
              const wrapper = decodeURIComponent(id.slice(0, slash));
              if (wrapper !== "@id" && wrapper !== "@fs") break;
              if (pass === 8) throw new Error("Invalid source URL");
              wrapped ||= wrapper === "@id";
              id = id.slice(slash + 1).replace(/^\/+/, "");
              if (id.startsWith("__x00__")) {
                const virtualId = id.slice(7);
                if (!wrapped || /^[/.]/.test(virtualId))
                  throw new Error("Invalid source URL");
                id = virtualId;
              }
            }
            // Preserve one leading wrapped virtual marker, not embedded/null IDs.
            if (id.includes("__x00__") && spelling === decoded)
              throw new Error("Invalid source URL");
            const paths = ["/", projectRoot, servedRoot].map((root) =>
              path.resolve(root, id),
            );
            // Decode structural segments separately so an encoded wrapper or
            // scheme cannot erase reserved filename bytes before URL conversion.
            const slash = id.indexOf("/");
            const scheme = decodeURIComponent(
              slash < 0 ? id : id.slice(0, slash),
            );
            if (/^file:/i.test(scheme)) {
              // Vite resolves lowercase file:// IDs, not arbitrary URI schemes.
              // Node rejects malformed/nonlocal authorities and encoded slashes.
              // Keep textual candidates too, including every decode spelling.
              const fileUrl = scheme + (slash < 0 ? "" : id.slice(slash));
              if (!fileUrl.startsWith("file://"))
                throw new Error("Invalid source URL");
              paths.push(fileURLToPath(fileUrl));
            }
            for (const candidate of paths) {
              candidates.add(candidate);
              if (candidate.endsWith(".map"))
                candidates.add(candidate.slice(0, -4));
            }
          }
        }
        const roots = PRIVATE_ROOTS.map((root) =>
          path.resolve(projectRoot, root),
        );
        for (const candidate of candidates)
          if (roots.some((root) => within(candidate, root))) return true;
        const actualRoots = await Promise.all(
          roots.map(async (root) => (await canonicalPath(root)).resolved),
        );
        const canonicalDenied = async (candidate: string) => {
          const canonical = await canonicalPath(candidate);
          return actualRoots.some(
            (root) =>
              within(canonical.ancestor, root) ||
              within(canonical.resolved, root),
          );
        };
        for (const candidate of candidates)
          if (await canonicalDenied(candidate)) return true;
        // Missing file aliases (alias.ts -> private.ts, requested as /alias)
        // have public ancestors. Use the same client resolver as HTTP transforms,
        // never load/transform modules. Deduped candidates retain the URL bounds.
        if (server)
          for (const candidate of candidates) {
            const resolved =
              await server.environments.client.pluginContainer.resolveId(
                candidate,
              );
            // Virtual/external IDs are not local files. Current config resolves
            // local files to absolute paths; query/hash postfixes are not paths.
            if (!resolved || resolved.external || !path.isAbsolute(resolved.id))
              continue;
            if (await canonicalDenied(resolved.id.split(/[?#]/)[0]!))
              return true;
          }
        return false;
      })().then(
        (denied) => {
          if (!denied) return next();
          response.statusCode = 403;
          response.end("Content source not served");
        },
        () => {
          response.statusCode = 403;
          response.end("Content source not served");
        },
      );
    };
  return {
    name: "ygo-content-source-deny",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(
        middleware(server.config.base, projectRoot, server),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        middleware(
          server.config.base,
          path.resolve(server.config.root, server.config.build.outDir),
        ),
      );
    },
  };
}
