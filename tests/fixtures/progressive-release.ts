import { canonicalBytes } from "../../scripts/lib/asset-delivery/canonical-json.ts";
import {
  parseProgressiveManifest,
  type LatestContentPointer,
  type ProgressiveManifest,
  type ReleaseFile,
} from "../../src/content/index.ts";
import { sha } from "./content-install-fixture.ts";

export interface ProgressiveFixture {
  readonly baseUrl: string;
  readonly requests: string[];
  readonly objects: ReadonlyMap<string, Uint8Array>;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

/** Wire fixture only: synthetic JSON never substitutes for the real-WASM closure. */
export async function createProgressiveFixture(
  options: Readonly<{
    releaseSequence?: number;
    optionalMedia?: boolean;
    missingRequired?: boolean;
  }> = {},
): Promise<ProgressiveFixture> {
  function fail(): never {
    throw new Error("PROGRESSIVE_FIXTURE_INVALID");
  }
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options) ||
    (Object.getPrototypeOf(options) !== Object.prototype &&
      Object.getPrototypeOf(options) !== null)
  )
    fail();
  const descriptors = Object.getOwnPropertyDescriptors(options);
  for (const key of Reflect.ownKeys(options)) {
    if (
      typeof key !== "string" ||
      !["releaseSequence", "optionalMedia", "missingRequired"].includes(key)
    )
      fail();
    const descriptor = descriptors[key]!;
    if (!descriptor.enumerable || !("value" in descriptor)) fail();
    const value: unknown = descriptor.value;
    if (key === "releaseSequence") {
      if (
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < 1
      )
        fail();
    } else if (typeof value !== "boolean") fail();
  }
  const releaseSequence = options.releaseSequence ?? 1;
  const baseUrl = "http://127.0.0.1/progressive/";
  const objects = new Map<string, Uint8Array>();
  const mediaTypes = new Map<string, string>();
  const files: ReleaseFile[] = [];
  const add = (
    path: string,
    role: ReleaseFile["role"],
    bytes: Uint8Array,
    mediaType = "application/json",
  ) => {
    const version = sha(bytes);
    const key = `content/files/${version}/${path}`;
    files.push({
      path,
      version,
      bytes: bytes.length,
      mediaType,
      role,
      required: role !== "media",
      packIds: [role === "runtime" ? "runtime" : "chapter-01"],
    });
    if (!(options.missingRequired && role === "gameplay"))
      objects.set(key, bytes);
    mediaTypes.set(key, mediaType);
    return version;
  };
  add(
    "chapters/chapter-01/gameplay.json",
    "gameplay",
    canonicalBytes({ chapterId: "chapter-01", fixture: "gameplay" }),
  );
  add(
    "chapters/chapter-01/story.json",
    "story",
    canonicalBytes({ chapterId: "chapter-01", fixture: "story" }),
  );
  if (options.optionalMedia !== false)
    add(
      "images/card.svg",
      "media",
      new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n',
      ),
      "image/svg+xml",
    );
  const runtimeSnapshotId = add(
    "runtime/manifest.json",
    "runtime",
    canonicalBytes({ fixture: "runtime" }),
  );
  const manifest: ProgressiveManifest = parseProgressiveManifest({
    schemaVersion: 3,
    releaseSequence,
    coreRange: { min: 1, maxExclusive: 2 },
    runtimeSnapshotId,
    chapters: [
      {
        id: "chapter-01",
        title: "Fixture chapter",
        description: "Local wire fixture",
        depends: [],
        gameplayPath: "chapters/chapter-01/gameplay.json",
        storyPath: "chapters/chapter-01/story.json",
      },
    ],
    files,
  });
  const manifestBytes = canonicalBytes(manifest);
  const manifestVersion = sha(manifestBytes);
  const pointer: LatestContentPointer = {
    schemaVersion: 1,
    releaseSequence,
    manifest: { version: manifestVersion, bytes: manifestBytes.length },
  };
  objects.set(`content/manifests/${manifestVersion}.json`, manifestBytes);
  objects.set("content/latest.json", canonicalBytes(pointer));
  const requests: string[] = [];
  return {
    baseUrl,
    objects,
    requests,
    async fetch(input, init) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      requests.push(url);
      const key = url.startsWith(baseUrl) ? url.slice(baseUrl.length) : "";
      const bytes = objects.get(key);
      if (!bytes) return new Response(null, { status: 404 });
      const method = (
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();
      if (method !== "GET" && method !== "HEAD")
        return new Response(null, { status: 405 });
      return new Response(method === "HEAD" ? null : bytes.slice(), {
        headers: {
          "Content-Type": mediaTypes.get(key) ?? "application/json",
          "Content-Length": String(bytes.length),
        },
      });
    },
  };
}
