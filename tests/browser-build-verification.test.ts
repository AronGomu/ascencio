import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { verifyPackagedContent } from "../scripts/lib/browser-content-verification.ts";
import { bundleAssets } from "../scripts/lib/asset-delivery/bundle.ts";
import { EMPTY_RETAINED_METADATA } from "../scripts/lib/asset-delivery/scan-assets.ts";
import { verifyBundle } from "../scripts/lib/asset-delivery/verify-bundle.ts";
import {
  current,
  fixture as bundleFixture,
  prepared,
} from "./fixtures/asset-delivery-bundle.ts";

async function fixture(t: TestContext) {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/browser-content-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from("verified packaged object");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const refs = ["indexes", "catalogs", "manifests", "parts"].map((kind) => ({
    key: `content/${kind}/${sha256}.${kind === "parts" ? "zip" : "json"}`,
    sha256,
    bytes: bytes.length,
  }));
  for (const ref of refs) {
    await mkdir(path.dirname(path.join(root, ref.key)), { recursive: true });
    await writeFile(path.join(root, ref.key), bytes);
  }
  return { root, refs, bytes };
}

test("verified producer bundle cannot mask same-name packaged ZIP corruption", async () => {
  const root = await bundleFixture();
  await bundleAssets(
    root,
    "prod",
    { kind: "nightly" },
    EMPTY_RETAINED_METADATA,
    prepared,
  );
  const { run } = await current(root);
  const snapshot = await verifyBundle(root, run);
  const outputRoot = path.join(root, "dist");
  await cp(
    path.join(root, run, "objects/content"),
    path.join(outputRoot, "content"),
    { recursive: true },
  );
  await verifyPackagedContent(outputRoot, snapshot.objects);
  const part = snapshot.objects.find((ref) =>
    ref.key.startsWith("content/parts/"),
  )!;
  const packagedPath = path.join(outputRoot, part.key);
  const bytes = await readFile(packagedPath);
  bytes[bytes.length - 1]! ^= 1;
  await writeFile(packagedPath, bytes);
  await verifyBundle(root, run);
  await assert.rejects(
    verifyPackagedContent(outputRoot, snapshot.objects),
    /CORE build content object differs from selected run/,
  );
});

test("packaged selected object closure passes with exact bytes", async (t) => {
  const { root, refs } = await fixture(t);
  await verifyPackagedContent(root, refs);
});

for (const kind of ["indexes", "catalogs", "manifests", "parts"]) {
  test(`same-length corruption of packaged ${kind} fails despite unchanged filename`, async (t) => {
    const { root, refs, bytes } = await fixture(t);
    bytes[0]! ^= 1;
    await writeFile(
      path.join(
        root,
        refs.find((ref) => ref.key.startsWith(`content/${kind}/`))!.key,
      ),
      bytes,
    );
    await assert.rejects(
      verifyPackagedContent(root, refs),
      /CORE build content object differs from selected run/,
    );
  });
}

test("truncated packaged part fails despite unchanged filename", async (t) => {
  const { root, refs, bytes } = await fixture(t);
  await writeFile(path.join(root, refs.at(-1)!.key), bytes.subarray(0, -1));
  await assert.rejects(
    verifyPackagedContent(root, refs),
    /CORE build content object differs from selected run/,
  );
});

test("missing or extra packaged objects fail closure verification", async (t) => {
  const { root, refs, bytes } = await fixture(t);
  const file = path.join(root, refs[0]!.key);
  await rm(file);
  await assert.rejects(
    verifyPackagedContent(root, refs),
    /CORE build content objects differ from selected run/,
  );
  await writeFile(file, bytes);
  await writeFile(path.join(root, "content/unexpected.json"), bytes);
  await assert.rejects(
    verifyPackagedContent(root, refs),
    /CORE build content objects differ from selected run/,
  );
});
