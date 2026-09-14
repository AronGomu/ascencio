import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalBytes } from "../../scripts/lib/asset-delivery/canonical-json.ts";
import {
  parseLatestContentPointer,
  parseProgressiveManifest,
  type LatestContentPointer,
} from "../../src/content/index.ts";
import { createProgressiveFixture } from "../fixtures/progressive-release.ts";
import { createFakeR2 } from "../fixtures/fake-r2.ts";

const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

// Test-local byte boundary only; production HTTP verification belongs to T4/T5.
function verifiedManifest(bytes: Uint8Array, pointer: LatestContentPointer) {
  if (bytes.byteLength > 32 * 1024 * 1024)
    throw new Error("CONTENT_INVALID_MANIFEST");
  if (
    bytes.byteLength !== pointer.manifest.bytes ||
    sha(bytes) !== pointer.manifest.version
  )
    throw new Error("CONTENT_INTEGRITY_FAILED");
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  const manifest = parseProgressiveManifest(value);
  if (manifest.releaseSequence !== pointer.releaseSequence)
    throw new Error("CONTENT_INVALID_MANIFEST");
  if (!Buffer.from(bytes).equals(Buffer.from(canonicalBytes(value))))
    throw new Error("CONTENT_INVALID_MANIFEST");
  return manifest;
}

async function metadata(
  fixture: Awaited<ReturnType<typeof createProgressiveFixture>>,
) {
  const response = await fixture.fetch(`${fixture.baseUrl}content/latest.json`);
  expect(response.status).toBe(200);
  const pointer = parseLatestContentPointer(await response.json());
  const manifestResponse = await fixture.fetch(
    `${fixture.baseUrl}content/manifests/${pointer.manifest.version}.json`,
  );
  expect(manifestResponse.status).toBe(200);
  const bytes = new Uint8Array(await manifestResponse.arrayBuffer());
  return { pointer, bytes, manifest: verifiedManifest(bytes, pointer) };
}

afterEach(() => vi.unstubAllGlobals());

describe("Fixture contract red/green", () => {
  it("builds deterministic canonical pointer, manifest and raw-file hashes", async () => {
    const fixture = await createProgressiveFixture();
    const same = await createProgressiveFixture();
    expect([...fixture.objects]).toEqual([...same.objects]);
    const { pointer, bytes, manifest } = await metadata(fixture);
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.releaseSequence).toBe(1);
    expect(pointer.releaseSequence).toBe(1);
    expect(bytes).toEqual(canonicalBytes(manifest));
    expect(fixture.objects.get("content/latest.json")).toEqual(
      canonicalBytes(pointer),
    );
    expect(new TextDecoder().decode(bytes)).toMatch(/[^\n]\n$/);
    expect(manifest.files.map((file) => file.path)).toEqual(
      manifest.files.map((file) => file.path).sort(),
    );
    expect(manifest.files.some((file) => file.role === "runtime")).toBe(true);
    expect(manifest.chapters.length).toBeGreaterThan(0);
    for (const file of manifest.files) {
      const key = `content/files/${file.version}/${file.path}`;
      const body = fixture.objects.get(key)!;
      expect(file.version).toMatch(/^[a-f0-9]{64}$/);
      expect(body.byteLength).toBe(file.bytes);
      expect(sha(body)).toBe(file.version);
      expect((await fixture.fetch(`${fixture.baseUrl}${key}`)).status).toBe(
        200,
      );
    }
    expect(fixture.requests).toHaveLength(manifest.files.length + 2);
  });

  it("changes release metadata but reuses unchanged file objects", async () => {
    const first = await createProgressiveFixture();
    const second = await createProgressiveFixture({ releaseSequence: 2 });
    const a = await metadata(first);
    const b = await metadata(second);
    expect(b.manifest.releaseSequence).toBe(2);
    expect(b.pointer.manifest.version).not.toBe(a.pointer.manifest.version);
    expect(b.manifest.files).toEqual(a.manifest.files);
  });

  it("supports string/URL/Request inputs, HEAD and isolated response bytes", async () => {
    const fixture = await createProgressiveFixture();
    const url = `${fixture.baseUrl}content/latest.json`;
    for (const input of [url, new URL(url), new Request(url)]) {
      const response = await fixture.fetch(input);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("application/json");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        fixture.objects.get("content/latest.json"),
      );
    }
    const head = await fixture.fetch(new Request(url, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(Number(head.headers.get("content-length"))).toBe(
      fixture.objects.get("content/latest.json")!.byteLength,
    );
    expect((await fixture.fetch(url, { method: "POST" })).status).toBe(405);
    const responseBytes = new Uint8Array(
      await (await fixture.fetch(url)).arrayBuffer(),
    );
    responseBytes.fill(0);
    expect(await (await fixture.fetch(url)).json()).toHaveProperty(
      "schemaVersion",
      1,
    );
    expect(fixture.requests.every((request) => request === url)).toBe(true);
  });

  it.each([
    null,
    [],
    1,
    { extra: true },
    { releaseSequence: 0 },
    { releaseSequence: -1 },
    { releaseSequence: 1.5 },
    { releaseSequence: Number.MAX_SAFE_INTEGER + 1 },
    { releaseSequence: "1" },
    { optionalMedia: 1 },
    { missingRequired: "true" },
  ])(
    "rejects malformed options %j with exact fixture error",
    async (options) => {
      await expect(createProgressiveFixture(options as never)).rejects.toThrow(
        "PROGRESSIVE_FIXTURE_INVALID",
      );
    },
  );

  it("accepts maximum safe release sequence", async () => {
    const fixture = await createProgressiveFixture({
      releaseSequence: Number.MAX_SAFE_INTEGER,
    });
    expect((await metadata(fixture)).pointer.releaseSequence).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("Required/optional variants", () => {
  it("logs missing required 404 separately from optional descriptor omission", async () => {
    const full = await createProgressiveFixture();
    const missing = await createProgressiveFixture({ missingRequired: true });
    const optional = await createProgressiveFixture({ optionalMedia: false });
    const a = await metadata(full);
    const b = await metadata(missing);
    const c = await metadata(optional);
    expect(b.manifest).toEqual(a.manifest);
    const missingFiles = b.manifest.files.filter(
      (file) =>
        !missing.objects.has(`content/files/${file.version}/${file.path}`),
    );
    expect(missingFiles).toHaveLength(1);
    expect(missingFiles[0]!.required).toBe(true);
    const requiredUrl = `${missing.baseUrl}content/files/${missingFiles[0]!.version}/${missingFiles[0]!.path}`;
    expect((await missing.fetch(requiredUrl)).status).toBe(404);
    expect(missing.requests.at(-1)).toBe(requiredUrl);
    expect(c.manifest.files).toEqual(
      a.manifest.files.filter((file) => file.required),
    );
    const media = a.manifest.files.find((file) => file.role === "media")!;
    const mediaUrl = `${optional.baseUrl}content/files/${media.version}/${media.path}`;
    expect(c.manifest.files.some((file) => file.path === media.path)).toBe(
      false,
    );
    expect(optional.requests).not.toContain(mediaUrl);
    expect((await optional.fetch(mediaUrl)).status).toBe(404);
    expect(optional.requests.at(-1)).toBe(mediaUrl);
    expect(
      (
        await metadata(
          await createProgressiveFixture({
            missingRequired: true,
            optionalMedia: false,
          }),
        )
      ).manifest.files.every((file) => file.required),
    ).toBe(true);
  });
});

describe("test-local byte verification", () => {
  it("rejects same-length corruption before JSON decoding", async () => {
    const { pointer, bytes } = await metadata(await createProgressiveFixture());
    const corrupt = bytes.slice();
    corrupt[0] = 0;
    expect(() => verifiedManifest(corrupt, pointer)).toThrow(
      "CONTENT_INTEGRITY_FAILED",
    );
    expect(() => verifiedManifest(bytes.subarray(1), pointer)).toThrow(
      "CONTENT_INTEGRITY_FAILED",
    );
    expect(() =>
      verifiedManifest(bytes, { ...pointer, releaseSequence: 2 }),
    ).toThrow("CONTENT_INVALID_MANIFEST");
  });

  it("rejects oversized raw bodies before decode/hash, even when parsed JSON would fit", async () => {
    const { pointer } = await metadata(await createProgressiveFixture());
    const padded = new Uint8Array(32 * 1024 * 1024 + 1).fill(32);
    expect(() => verifiedManifest(padded, pointer)).toThrow(
      "CONTENT_INVALID_MANIFEST",
    );
  });

  it("rejects correctly hashed but noncanonical JSON", async () => {
    const { manifest, pointer } = await metadata(
      await createProgressiveFixture(),
    );
    const pretty = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
    expect(() =>
      verifiedManifest(pretty, {
        ...pointer,
        manifest: { version: sha(pretty), bytes: pretty.length },
      }),
    ).toThrow("CONTENT_INVALID_MANIFEST");
  });
});

describe("No remote effect", () => {
  it("serves only exact local URLs without any global fetch", async () => {
    const network = vi.fn(() => {
      throw new Error("unexpected remote fetch");
    });
    vi.stubGlobal("fetch", network);
    const fixture = await createProgressiveFixture();
    await metadata(fixture);
    for (const url of [
      "https://example.invalid/content/latest.json",
      `${fixture.baseUrl}unknown`,
      `${fixture.baseUrl}content/latest.json?x=1`,
      `${fixture.baseUrl}content/latest.json#x`,
      `${fixture.baseUrl}content/%6catest.json`,
    ]) {
      expect((await fixture.fetch(url)).status).toBe(404);
      expect(fixture.requests.at(-1)).toBe(url);
    }
    const transport = createFakeR2();
    expect(
      (
        await transport.fetch("https://example.invalid/content/latest.json", {
          method: "PUT",
          body: "blocked",
        })
      ).status,
    ).toBe(404);
    expect(transport.objects.size).toBe(0);
    expect(network).not.toHaveBeenCalled();
  });

  it("exercises fake immutable create and competing ETag CAS with no publisher/SDK", async () => {
    const network = vi.fn(() => {
      throw new Error("unexpected remote fetch");
    });
    vi.stubGlobal("fetch", network);
    const fixture = await createProgressiveFixture();
    const transport = createFakeR2();
    const { pointer } = await metadata(fixture);
    // Test-only transport observation: planning reads bytes but performs no writes.
    const plan = [...fixture.objects.keys()];
    expect(plan).toContain("content/latest.json");
    expect(transport.requests).toEqual([]);
    expect(transport.objects.size).toBe(0);
    const immutableKey = `content/manifests/${pointer.manifest.version}.json`;
    const immutableUrl = `${transport.baseUrl}${immutableKey}`;
    const body = fixture.objects.get(immutableKey)!.slice();
    const created = await transport.fetch(immutableUrl, {
      method: "PUT",
      headers: { "If-None-Match": "*" },
      body,
    });
    expect(created.status).toBe(200);
    expect(created.headers.get("etag")).toBe(`"${sha(body)}"`);
    expect(
      (
        await transport.fetch(immutableUrl, {
          method: "PUT",
          headers: { "If-None-Match": "*" },
          body: "collision",
        })
      ).status,
    ).toBe(412);
    expect(
      new Uint8Array(
        await (await transport.fetch(new URL(immutableUrl))).arrayBuffer(),
      ),
    ).toEqual(body);
    const url = `${transport.baseUrl}content/latest.json`;
    expect(
      (await transport.fetch(url, { method: "PUT", body: "unguarded" })).status,
    ).toBe(428);
    expect((await transport.fetch(url)).status).toBe(404);
    const initial = await transport.fetch(
      new Request(url, {
        method: "PUT",
        headers: { "If-None-Match": "*" },
        body: "initial",
      }),
    );
    const etag = initial.headers.get("etag")!;
    const results = await Promise.all(
      ["next-a", "next-b"].map((value) =>
        transport.fetch(url, {
          method: "PUT",
          headers: { "If-Match": etag },
          body: value,
        }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([200, 412]);
    const winner = results.findIndex((result) => result.status === 200);
    const current = await transport.fetch(url);
    expect(await current.text()).toBe(["next-a", "next-b"][winner]);
    expect(current.headers.get("etag")).toBe(
      results[winner]!.headers.get("etag"),
    );
    expect((await transport.fetch(url, { method: "DELETE" })).status).toBe(405);
    const head = await transport.fetch(url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(head.headers.get("etag")).toBe(current.headers.get("etag"));
    expect(transport.requests).toContain(`PUT ${url}`);
    expect(network).not.toHaveBeenCalled();
  });
});
