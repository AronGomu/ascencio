import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
  access,
  chmod,
} from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { build, createServer, preview } from "vite";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const APP_BUILD_OUTPUT = "generated/build/app";
async function fixture(): Promise<string> {
  await mkdir(path.join(root, ".tmp"), { recursive: true });
  const target = await mkdtemp(path.join(root, ".tmp/t8c-boundary-"));
  // Code only; never copy acquired roots, packages, caches, or public content.
  for (const entry of [
    "src",
    "scripts/lib",
    "vendor/ocgcore-wasm/0.1.2/dist",
  ]) {
    await mkdir(path.dirname(path.join(target, entry)), { recursive: true });
    await cp(path.join(root, entry), path.join(target, entry), {
      recursive: true,
    });
  }
  for (const entry of [
    "index.html",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vite.config.ts",
    "vendor/ocgcore-wasm/0.1.2/package.json",
    "vendor/ocgcore-wasm/0.1.2/LICENSE",
    "assets/app/app-icon.svg",
    "assets/app/download-links.json",
    "assets/app/fonts/forum-latin.woff2",
    "assets/app/fonts/source-serif-4-latin.woff2",
    "assets/app/fonts/source-serif-4-italic-latin.woff2",
  ]) {
    await mkdir(path.dirname(path.join(target, entry)), { recursive: true });
    await cp(path.join(root, entry), path.join(target, entry));
  }
  await symlink(
    path.join(root, "node_modules"),
    path.join(target, "node_modules"),
  );
  return target;
}
async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) =>
        entry.isDirectory()
          ? (await files(path.join(directory, entry.name))).map(
              (file) => `${entry.name}/${file}`,
            )
          : [entry.name],
      ),
    )
  )
    .flat()
    .sort();
}
async function request(port: number, requestPath: string) {
  return new Promise<{ status: number; body: string; contentType: string }>(
    (resolve, reject) => {
      const req = http
        .get({ hostname: "127.0.0.1", port, path: requestPath }, (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => (body += chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode!,
              body,
              contentType: response.headers["content-type"] ?? "",
            }),
          );
          response.on("error", reject);
        })
        .on("error", reject);
      req.setTimeout(10_000, () => {
        req.destroy(new Error("HTTP boundary request timed out"));
      });
    },
  );
}

describe("app/content build boundary", () => {
  it("checks missing suffixes against canonical roots and fails closed on filesystem errors", async () => {
    const target = await fixture();
    let server: Awaited<ReturnType<typeof createServer>> | undefined;
    try {
      // Neither private root exists. One parent is itself symlink-backed.
      await mkdir(path.join(target, "backing-generated"));
      await symlink(
        path.join(target, "backing-generated"),
        path.join(target, "generated"),
      );
      await symlink(
        path.join(target, "assets"),
        path.join(target, "assets-alias"),
      );
      await symlink(
        path.join(target, "backing-generated"),
        path.join(target, "generated-alias"),
      );
      await symlink(path.join(target, "loop"), path.join(target, "loop"));
      await mkdir(path.join(target, "locked"));
      await chmod(path.join(target, "locked"), 0);
      server = await createServer({
        root: target,
        configFile: path.join(target, "vite.config.ts"),
        base: "/",
        logLevel: "silent",
        server: { host: "127.0.0.1", port: 0, strictPort: false, watch: null },
      });
      await server.listen();
      const address = server.httpServer!.address();
      if (address === null || typeof address === "string")
        throw new Error("No HTTP listener");
      for (const file of [
        "assets-alias/content/not-created/deep",
        "generated-alias/content-packages/not-created/deep",
        "loop/child",
        // Root users bypass mode bits; ELOOP still covers non-missing errors.
        ...(process.getuid?.() === 0 ? [] : ["locked/child"]),
      ])
        for (const route of [
          `/${file}?import`,
          `/@id/${target}/${file}?import`,
        ])
          expect((await request(address.port, route)).status, route).toBe(403);
      const missing = await request(
        address.port,
        "/missing/deep/public.ts?import",
      );
      expect(missing.status).toBe(200);
      expect(missing.contentType).toContain("text/html");
      expect((await request(address.port, "/@vite/client")).status).toBe(200);
    } finally {
      await server?.close();
      await chmod(path.join(target, "locked"), 0o700);
      await rm(target, { recursive: true, force: true });
    }
  });

  it.each(["/", "/private/game/"])(
    "builds native webview without acquired roots or browser SQLite under %s",
    async (base) => {
      const target = await fixture();
      try {
        for (const entry of [
          "assets/content",
          "generated",
          "content",
          "public",
          ".cache",
        ])
          await expect(access(path.join(target, entry))).rejects.toThrow();
        await build({
          root: target,
          configFile: path.join(target, "vite.config.ts"),
          mode: "native",
          base,
          logLevel: "silent",
        });
        const inventory = await files(path.join(target, APP_BUILD_OUTPUT));
        const wasm = inventory.filter((file) => file.endsWith(".wasm"));
        expect(wasm).toHaveLength(0);
        expect(
          inventory.filter((file) =>
            /(?:\.sqlite|\.db|\.zip|\.jpg|\.png|\.webp|\.mp3|\.mp4|\.ogg)$|^(?:content|runtime|story|generated)\/|core-bootstrap/.test(
              file,
            ),
          ),
        ).toEqual([]);
        expect(inventory.filter((file) => file.endsWith(".svg"))).toEqual([
          "app-icon.svg",
        ]);
        expect(
          inventory.filter((file) => file.endsWith(".woff2")),
        ).toHaveLength(3);
        expect(inventory).not.toContain("service-worker.js");
        expect(inventory).not.toContain("manifest.webmanifest");
        const manifest = JSON.parse(
          await readFile(
            path.join(target, APP_BUILD_OUTPUT, ".vite/manifest.json"),
            "utf8",
          ),
        );
        for (const entry of Object.values(manifest) as {
          file: string;
          imports?: string[];
          dynamicImports?: string[];
          css?: string[];
        }[]) {
          expect(inventory).toContain(entry.file);
          for (const dependency of [
            ...(entry.imports ?? []),
            ...(entry.dynamicImports ?? []),
          ])
            expect(Object.hasOwn(manifest, dependency)).toBe(true);
          for (const css of entry.css ?? []) expect(inventory).toContain(css);
        }
        expect(
          inventory.filter((file) =>
            /^assets\/sqlite(?:3)?-worker-/.test(file),
          ),
        ).toEqual([]);
        const release = JSON.parse(
          await readFile(
            path.join(target, APP_BUILD_OUTPUT, "core-release.json"),
            "utf8",
          ),
        );
        expect(release).toMatchObject({
          schemaVersion: 1,
          coreContentApiVersion: 1,
        });
        for (const entry of [
          "assets/content",
          "generated/content-packages",
          "content",
          "public",
          ".cache",
        ])
          await expect(access(path.join(target, entry))).rejects.toThrow();
        if (process.env.T8C_EVIDENCE_DIRECTORY)
          await writeFile(
            path.join(
              process.env.T8C_EVIDENCE_DIRECTORY,
              base === "/" ? "asset-free-root.json" : "asset-free-base.json",
            ),
            JSON.stringify(
              {
                base,
                excludedRootsAbsent: true,
                inventory,
                manifest,
                wasmBytes: 0,
              },
              null,
              2,
            ),
          );
      } finally {
        await rm(target, { recursive: true, force: true });
      }
    },
    180_000,
  );

  it.each(["/", "/private/game/"])(
    "denies source bytes before Vite dev/preview middleware under %s",
    async (base) => {
      const target = await fixture();
      try {
        for (const file of [
          "assets/content/chapter-01/secret.txt",
          "generated/content-packages/duel-core-1.0.0.sqlite",
        ]) {
          await mkdir(path.dirname(path.join(target, file)), {
            recursive: true,
          });
          await writeFile(path.join(target, file), "private source sentinel");
        }
        const privateJson = [
          "assets/content/card-library/images/sets/manifest.json",
          "content/duel-core/config.json",
          "content/duel-core/strings/en.json",
          "content/freeplay/config.json",
          "content/freeplay/decks.json",
          "generated/content-packages/manifest.json",
        ];
        for (const file of privateJson) {
          await mkdir(path.dirname(path.join(target, file)), {
            recursive: true,
          });
          await writeFile(
            path.join(target, file),
            JSON.stringify({ sentinel: "private source sentinel" }),
          );
        }
        const privateTs = [
          "assets/content/private.ts",
          "generated/content-packages/private.ts",
        ];
        for (const file of privateTs)
          await writeFile(
            path.join(target, file),
            'export const sentinel: string = "private source sentinel";',
          );
        await writeFile(
          path.join(target, "public-control.ts"),
          "export const boundaryControl: number = 42;",
        );
        await symlink(
          path.join(target, "assets/content"),
          path.join(target, "source-alias"),
        );
        await symlink(
          path.join(target, privateJson[0]!),
          path.join(target, "manifest-alias.json"),
        );
        await symlink(
          path.join(target, "generated/content-packages"),
          path.join(target, "package-alias"),
        );
        // Vite extension/index resolution runs after this pre-hook. Exercise both
        // directory aliases and file aliases whose .ts suffix is absent in URLs.
        const resolverAliases = [
          "source-alias/private",
          "package-alias/private",
          "source-file",
          "package-file",
        ];
        for (const [index, alias] of ["source-file", "package-file"].entries())
          await symlink(
            path.join(target, privateTs[index]!),
            path.join(target, `${alias}.ts`),
          );
        for (const directory of [
          "assets/content/private-index",
          "generated/content-packages/private-index",
          "public-index",
        ]) {
          await mkdir(path.join(target, directory));
          await writeFile(
            path.join(target, directory, "index.ts"),
            directory === "public-index"
              ? "export const boundaryControl: number = 42;"
              : 'export const sentinel: string = "private source sentinel";',
          );
        }
        // Parent aliases must still deny missing descendants in either root.
        await symlink(
          path.join(target, "assets"),
          path.join(target, "assets-alias"),
        );
        await symlink(
          path.join(target, "generated"),
          path.join(target, "generated-alias"),
        );
        const ancestorAliases = [
          "source-alias/private",
          "package-alias/private",
          "source-alias/private-index",
          "package-alias/private-index",
          "source-alias/private.ts/child",
          "package-alias/private.ts/child",
          "assets-alias/content/missing",
          "generated-alias/content-packages/missing",
        ];
        const aliasRoutes = (file: string) => [
          `${file}?import`,
          `@id/${target}/${file}?import`,
        ];
        const encodedAliases = [
          "query?alias.json",
          "hash#alias.json",
          "encoded%2Falias.json",
        ];
        for (const alias of encodedAliases)
          await symlink(
            path.join(target, privateJson[0]!),
            path.join(target, alias),
          );
        await mkdir(path.join(target, APP_BUILD_OUTPUT), { recursive: true });
        await writeFile(
          path.join(target, APP_BUILD_OUTPUT, "index.html"),
          "app-only preview",
        );
        await symlink(
          path.join(target, "assets/content"),
          path.join(target, APP_BUILD_OUTPUT, "preview-alias"),
        );
        // These are containment classes, not claims that every spelling resolves.
        const fileUrlRoutes = (file: string) => {
          const url = pathToFileURL(path.join(target, file)).href;
          return [url, url.replace("file://", "file://localhost")].flatMap(
            (id) => [
              `@id/${id}?import`,
              `@id/${id}?raw&import`,
              `@id/${id}?url&import`,
              `@id/${id}?t=123&import`,
              `@id/${id}.map`,
              `@id/${id}.map?import`,
              `@id/${id}%2Emap?raw&import`,
              // An encoded postfix is a filename suffix for file:// URLs.
              // It cannot resolve a ?/# symlink with a different filename.
              ...(!/%(?:3F|23)/i.test(id)
                ? [`@id/${id}%3Fraw%26import`, `@id/${id}%23ignored?import`]
                : []),
              `@id/${encodeURIComponent(id)}?import`,
              `@id/${encodeURIComponent(encodeURIComponent(id))}?import`,
              `%40id/${id}?import`,
              `@id/@id/${id}?import`,
              `@id/@fs/${id}?import`,
              `@fs/@id/${id}?import`,
              `@id/${id.replace("file:", "file%3A")}?import`,
              `@id/${id.replace("manifest", "%6Danifest")}?import`,
              `@id/${id.replace("/private.ts", "/nested/../private.ts")}?import`,
            ],
          );
        };
        const denied = [
          ...ancestorAliases.flatMap(aliasRoutes),
          ...[
            ...privateJson,
            ...privateTs,
            ...encodedAliases,
            "manifest-alias.json",
            "source-alias/private.ts",
            "package-alias/private.ts",
          ].flatMap(fileUrlRoutes),
          ...privateJson.flatMap((file) => [
            `@id/file:////${target.slice(1)}/${file}?import`,
            `@id/file://127.0.0.1${target}/${file}?import`,
            `@id/file://remote.invalid${target}/${file}?import`,
            `@id/file://user@localhost${target}/${file}?import`,
            `@id/file://localhost:80${target}/${file}?import`,
            `@id/file://${target}%2F${file}?import`,
            `@id/file://${target}/${file}%ZZ?import`,
            `@id/file://${target}/${file}%00?import`,
            `@id/file:${target}/${file}?import`,
            `@id/FILE://${target}/${file}?import`,
          ]),
          "@id/file://[broken/private.json?import",
          "@id/file://localhost/%C0%AF?import",
          `@id/${"x".repeat(8_192)}?import`,
          ...encodedAliases.flatMap((alias) => {
            const encoded = encodeURIComponent(alias);
            return [
              encoded,
              `${encoded}?import`,
              `${encoded}.map`,
              `@id/${target}/${encoded}?import`,
              `@fs/${target}/${encoded}`,
            ];
          }),
          ...privateJson.flatMap((file) => {
            const absolute = `${target}/${file}`;
            const id = `@id/${absolute}`;
            return [
              file,
              `${file}?import`,
              `${file}?raw`,
              `${file}.map`,
              `@fs/${absolute}?import`,
              `${id}?import`,
              `${id}?raw&import`,
              `${id}?url&import`,
              `${id}?t=123&import`,
              `${id}.map`,
              `${id}.map?import`,
              `@id/__x00__${absolute}?import`,
              `@id/%5F%5Fx00%5F%5F${absolute}?import`,
              `@id/${encodeURIComponent(absolute)}?import`,
              `@id/${encodeURIComponent(encodeURIComponent(absolute))}?import`,
              `%40id/${absolute}?import`,
              `@id//@id/${absolute}?import`,
              `@id/@fs/${absolute}?import`,
              `@id/${absolute}%3Fraw%26import`,
              `@id/${absolute}%23ignored?import`,
              `@id/${absolute.replace("manifest.json", "nested/../manifest.json")}?import`,
            ];
          }),
          ...[
            "manifest-alias.json",
            "source-alias/card-library/images/sets/manifest.json",
            "package-alias/manifest.json",
          ].flatMap((file) => [
            `${file}?import`,
            `${file}.map`,
            `@id/${target}/${file}?import`,
            `@id/${target}/${file}.map`,
            `@fs/${target}/${file}?raw`,
          ]),
          "@id/__x00__/unknown/absolute.json?import",
          "@id/foo__x00__bar?import",
          "@id/__x00____x00__virtual:test?import",
          "@id/%00virtual:test?import",
          "@id/%2500virtual:test?import",
          "@id/%ZZ?import",
          "@id/%C0%AFassets/content/file.json?import",
          `assets/${"%25" + "25".repeat(9)}63ontent/file.json?import`,
          `${"@id/".repeat(10)}${target}/assets/content/file.json?import`,
          "assets%5Ccontent%5Cfile.json?import",
          "/assets/content/chapter-01/secret.txt",
          "assets/%2e%2e/assets/content/chapter-01/secret.txt",
          "assets/%2563ontent/chapter-01/secret.txt",
          "assets/content/chapter-01/secret.txt?raw",
          "assets/content/chapter-01/secret.txt",
          "generated/content-packages/duel-core-1.0.0.sqlite",
          "assets/%63ontent/chapter-01/secret.txt",
          "assets/app/%2e%2e/content/chapter-01/secret.txt",
          "source-alias/chapter-01/secret.txt",
          `@fs/${target}/assets/content/chapter-01/secret.txt`,
          `@fs/${target}/generated/content-packages/duel-core-1.0.0.sqlite`,
          `@fs/${target}/source-alias/chapter-01/secret.txt`,
        ];
        for (const kind of ["dev", "preview"] as const) {
          const config = {
            root: target,
            configFile: path.join(target, "vite.config.ts"),
            base,
            logLevel: "silent" as const,
            server: {
              host: "127.0.0.1",
              port: 0,
              strictPort: false,
              watch: null,
            },
            preview: { host: "127.0.0.1", port: 0, strictPort: false },
          };
          const server =
            kind === "dev" ? await createServer(config) : await preview(config);
          try {
            if ("listen" in server) await server.listen();
            const address = server.httpServer!.address();
            if (address === null || typeof address === "string")
              throw new Error("No HTTP listener");
            // Prime maps without HTTP: the pre-hook must deny even cached output.
            if ("transformRequest" in server)
              for (const file of [...privateJson, ...privateTs])
                await server.transformRequest(
                  pathToFileURL(path.join(target, file)).href,
                );
            // Warm extensionless file aliases too: cached transforms must not
            // bypass resolver containment on the subsequent HTTP requests.
            if ("transformRequest" in server)
              for (const file of resolverAliases)
                await server.transformRequest(`/${file}`);
            const results = await Promise.all(
              [
                ...denied,
                ...(kind === "dev"
                  ? resolverAliases.flatMap(aliasRoutes)
                  : [
                      "preview-alias/chapter-01/secret.txt",
                      "preview-alias/private?import",
                      `@id/${target}/${APP_BUILD_OUTPUT}/preview-alias/private?import`,
                    ]),
              ].map(async (route) => {
                const response = await request(address.port, `${base}${route}`);
                return {
                  route,
                  status: response.status,
                  leaked: response.body.includes("private source sentinel"),
                };
              }),
            );
            const allowed = await Promise.all(
              [
                "index.html",
                ...(kind === "dev"
                  ? [
                      "src/main.ts",
                      "public-control?import",
                      `@id/${target}/public-control?import`,
                      "public-index?import",
                      `@id/${target}/public-index?import`,
                      `@id/${pathToFileURL(path.join(target, "public-control.ts")).href}?import`,
                      `@id/file://localhost${target}/public-control.ts?import`,
                      `@id/file:////${target.slice(1)}/public-control.ts?import`,
                      "@vite/client",
                      "@vite/env",
                      "@id/__x00__vite/modulepreload-polyfill.js",
                      "@id/%5F%5Fx00%5F%5Fvite/modulepreload-polyfill.js",
                      "@%69d/__x00__vite/modulepreload-polyfill.js",
                      "assets/app/fonts/forum-latin.woff2",
                    ]
                  : []),
              ].map(async (route) => {
                const response = await request(address.port, `${base}${route}`);
                return {
                  route,
                  status: response.status,
                  contentType: response.contentType,
                  controlTransformed:
                    (!route.includes("public-control") &&
                      !route.includes("public-index")) ||
                    (response.body.includes("boundaryControl = 42") &&
                      !response.body.includes(": number")),
                };
              }),
            );
            if (process.env.T8C_EVIDENCE_DIRECTORY)
              await writeFile(
                path.join(
                  process.env.T8C_EVIDENCE_DIRECTORY,
                  `http-${kind}-${base === "/" ? "root" : "base"}.json`,
                ),
                JSON.stringify({ base, kind, results, allowed }, null, 2),
              );
            expect
              .soft(
                results.filter(
                  (result) => result.status !== 403 || result.leaked,
                ),
              )
              .toEqual([]);
            expect
              .soft(
                allowed.filter(
                  (result) =>
                    result.status !== 200 || !result.controlTransformed,
                ),
              )
              .toEqual([]);
            expect
              .soft(
                allowed.filter(
                  (result) =>
                    (result.route.startsWith("@") ||
                      result.route.startsWith("public-")) &&
                    !result.contentType.includes("javascript"),
                ),
              )
              .toEqual([]);
          } finally {
            await server.close();
          }
        }
      } finally {
        await rm(target, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
