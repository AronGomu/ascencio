import { createHash } from "node:crypto";
import { open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import type {
  CriticalRelease,
  CriticalResource,
  MediaMapping,
} from "../../src/storage/contracts/critical-snapshot.ts";
import { parseCriticalSnapshot } from "../../src/storage/snapshot/parse-critical-snapshot.ts";
import { parseContentDescriptor } from "../../src/storage/transport/content-descriptor.ts";

const FIXED_PACKAGES = ["duel-core", "card-library", "freeplay", "chapter-01"];
const MAX_CRITICAL = 128 * 1024 * 1024;
const MAX_MEDIA = 64 * 1024 * 1024;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function resource(value: unknown): CriticalResource {
  if (
    !record(value) ||
    typeof value.path !== "string" ||
    !safePath(value.path) ||
    typeof value.bytes !== "number" ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes <= 0 ||
    value.bytes > MAX_CRITICAL ||
    typeof value.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.sha256)
  )
    throw new Error("BROWSER_CONTENT_RELEASE_INVALID");
  return { path: value.path, bytes: value.bytes, sha256: value.sha256 };
}
function release(value: unknown): CriticalRelease {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    value.compilerVersion !== 1 ||
    !Array.isArray(value.packages) ||
    value.packages.length > 64 ||
    !Array.isArray(value.engine) ||
    value.engine.length !== 2
  )
    throw new Error("BROWSER_CONTENT_RELEASE_INVALID");
  const packages = value.packages.map((pack: unknown) => {
    if (
      !record(pack) ||
      typeof pack.packageId !== "string" ||
      typeof pack.version !== "string"
    )
      throw new Error("BROWSER_CONTENT_RELEASE_INVALID");
    return {
      ...resource(pack),
      packageId: pack.packageId,
      version: pack.version,
    };
  });
  if (new Set(packages.map((pack) => pack.packageId)).size !== packages.length)
    throw new Error("BROWSER_CONTENT_RELEASE_INVALID");
  return {
    schemaVersion: 1,
    compilerVersion: 1,
    packages,
    engine: value.engine.map(resource),
  };
}
function safePath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 1024 &&
    !/[\\:\0]/.test(value) &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
function within(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}
async function boundedFile(file: string, maximum: number): Promise<Buffer> {
  const handle = await open(file, "r");
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > maximum)
      throw new Error("BROWSER_CONTENT_TOO_LARGE");
    const bytes = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < bytes.length) {
      const read = await handle.read(bytes, size, bytes.length - size, null);
      if (read.bytesRead === 0) break;
      size += read.bytesRead;
    }
    if (size !== stat.size) throw new Error("BROWSER_CONTENT_CHANGED");
    return bytes.subarray(0, size);
  } finally {
    await handle.close();
  }
}
const digest = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

async function prepareFixture(projectRoot: string) {
  const folder = await realpath(
    path.join(projectRoot, "src-tauri/resources/readable-content"),
  );
  const pinned = await readFile(
    path.join(projectRoot, "content/critical-release.json"),
  );
  const staged = await boundedFile(
    path.join(folder, "release.json"),
    1024 * 1024,
  );
  if (!pinned.equals(staged))
    throw new Error(
      "BROWSER_CONTENT_STAGE_MISMATCH: run npm run content:stage:native",
    );
  const manifest = release(JSON.parse(pinned.toString("utf8")));
  const packages = FIXED_PACKAGES.map((id) => {
    const pack = manifest.packages.find((pack) => pack.packageId === id);
    if (!pack) throw new Error(`BROWSER_CONTENT_PACKAGE_MISSING: ${id}`);
    return pack;
  });
  if (
    packages.reduce((total, pack) => total + pack.bytes, 0) >
    256 * 1024 * 1024
  )
    throw new Error("BROWSER_CONTENT_TOO_LARGE");
  async function verified(item: CriticalResource, maximum: number) {
    const resolved = await realpath(path.join(folder, item.path));
    if (!within(resolved, folder))
      throw new Error("BROWSER_CONTENT_PATH_REFUSED");
    const bytes = await boundedFile(resolved, maximum);
    if (bytes.length !== item.bytes || digest(bytes) !== item.sha256)
      throw new Error(`BASE_HASH_MISMATCH: ${item.path}`);
    return bytes;
  }
  const snapshots = await Promise.all(
    packages.map(async (pack) => {
      const snapshot = parseCriticalSnapshot(
        JSON.parse((await verified(pack, MAX_CRITICAL)).toString("utf8")),
      );
      if (
        snapshot.manifest.packageId !== pack.packageId ||
        snapshot.manifest.version !== pack.version
      )
        throw new Error("BROWSER_CONTENT_IDENTITY_INVALID");
      return snapshot;
    }),
  );
  const metadata = Buffer.from(JSON.stringify(snapshots));
  const engineResource = manifest.engine.find(
    (item) => item.path === "duel-core/engine/ocgcore.sync.wasm",
  );
  const vendorResource = manifest.engine.find(
    (item) => item.path === "duel-core/engine/vendor-manifest.json",
  );
  if (!engineResource || !vendorResource)
    throw new Error("BROWSER_CONTENT_ENGINE_MISSING");
  const [engine, vendor] = await Promise.all([
    verified(engineResource, 16 * 1024 * 1024),
    verified(vendorResource, 256 * 1024),
  ]);
  const descriptor = parseContentDescriptor({
    sessionId: "fixture",
    generation: 1,
    packages,
    metadataBytes: metadata.length,
    metadataSha256: digest(metadata),
    engineBytes: engine.length,
    engineSha256: digest(engine),
    vendorManifest: vendor.toString("utf8"),
  });
  const media = new Map<string, { root: string; mapping: MediaMapping }>();
  for (const snapshot of snapshots) {
    const root = await realpath(path.join(folder, snapshot.manifest.packageId));
    if (!within(root, folder)) throw new Error("BROWSER_CONTENT_PATH_REFUSED");
    for (const mapping of snapshot.media) {
      const token = Buffer.from(mapping.id).toString("hex");
      media.set(`${snapshot.manifest.packageId}/${token}`, { root, mapping });
    }
  }
  return {
    descriptor: Buffer.from(JSON.stringify(descriptor)),
    metadata,
    engine,
    media,
  };
}

/** Fixed development corpus only; never mounts a content directory or emits assets. */
export function browserGameContentPlugin(projectRoot: string): Plugin {
  return {
    name: "ascencio-browser-development-content",
    async configureServer(server) {
      if (server.config.mode !== "browser-dev") return;
      const fixture = await prepareFixture(projectRoot);
      const prefix = `${server.config.base}game-content/`;
      server.middlewares.use((request, response, next) => {
        const pathname = (request.url ?? "").split("?")[0] ?? "";
        if (!pathname.startsWith(prefix)) return next();
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET, HEAD");
          response.end();
          return;
        }
        const suffix = pathname.slice(prefix.length);
        void (async () => {
          let bytes: Buffer;
          let mime = "application/json";
          if (suffix === "startup.json") bytes = fixture.descriptor;
          else if (suffix === "fixture/metadata.json") bytes = fixture.metadata;
          else if (suffix === "fixture/engine.wasm") {
            bytes = fixture.engine;
            mime = "application/wasm";
          } else if (suffix.startsWith("fixture/media/")) {
            const key = suffix.slice("fixture/media/".length);
            const item = fixture.media.get(key);
            if (!item || !safePath(item.mapping.path)) {
              response.statusCode = 404;
              response.end();
              return;
            }
            const file = await realpath(
              path.join(item.root, item.mapping.path),
            );
            if (!within(file, item.root))
              throw new Error("BROWSER_CONTENT_PATH_REFUSED");
            bytes = await boundedFile(file, MAX_MEDIA);
            mime = item.mapping.mime;
          } else {
            response.statusCode = 404;
            response.end();
            return;
          }
          response.setHeader("Content-Type", mime);
          response.setHeader("Content-Length", bytes.length);
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.end(request.method === "HEAD" ? undefined : bytes);
        })().catch(() => {
          response.statusCode = 404;
          response.end();
        });
      });
    },
  };
}
