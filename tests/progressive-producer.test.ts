import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  parseFrozenInventory,
  type FrozenInventory,
} from "../scripts/lib/asset-delivery/frozen-inventory.ts";
import { canonicalBytes } from "../scripts/lib/asset-delivery/canonical-json.ts";
import {
  parseProgressiveManifest,
  type ProgressiveManifest,
} from "../src/content/index.ts";
import { prepared } from "./fixtures/asset-delivery-bundle.ts";
import {
  publishProgressiveRelease,
  S3ProgressiveTransport,
} from "../scripts/lib/asset-delivery/progressive-publisher.ts";
import {
  packProgressiveRelease,
  verifyProgressiveRelease,
} from "../scripts/lib/asset-delivery/progressive-producer.ts";
import { runContent } from "../scripts/lib/asset-delivery/content-cli.ts";
import { runContentPublish } from "../scripts/lib/asset-delivery/content-publish-cli.ts";

const sha = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

async function fixture(reverseCreation = false): Promise<{
  root: string;
  inventory: FrozenInventory;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-progressive-"));
  const sources = [
    ["assets/shared/runtime.json", '{"runtime":true}\n'],
    ["assets/story/card.png", "png-fixture"],
  ] as const;
  for (const [relative, value] of reverseCreation
    ? [...sources].reverse()
    : sources) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), value);
  }
  const runtimeBytes = Buffer.from(sources[0][1]);
  const mediaBytes = Buffer.from(sources[1][1]);
  const runtimeSnapshotId = sha("runtime-snapshot");
  const metadata = {
    schemaVersion: 2 as const,
    sourceInputs: [],
    runtimeSnapshotId,
    runtimeCardCodes: [],
    chapters: [
      {
        id: "chapter-01" as const,
        title: "Chapter 1",
        description: "Fixture",
        storyContentId: "prototype-prologue-v1" as const,
        setIds: [],
        unavailableSetImageIds: [],
        cardCodes: [],
        opponentIds: [],
        gameplay: prepared.chapters[0]!.gameplay,
        story: prepared.chapters[0]!.story,
      },
    ],
  };
  const inventory = parseFrozenInventory({
    schemaVersion: 1,
    appVersion: "0.1.0",
    runtimeSnapshotId,
    profiles: [
      { schemaVersion: 1, id: "chapter-01", dependsOn: ["runtime"], rules: [] },
      { schemaVersion: 1, id: "runtime", dependsOn: [], rules: [] },
    ],
    selection: { schemaVersion: 1, profiles: ["chapter-01", "runtime"] },
    files: [
      {
        path: sources[0][0],
        bytes: runtimeBytes.length,
        sha256: sha(runtimeBytes),
        root: "shared",
        sourcePath: "runtime.json",
        profile: "runtime",
        logicalPath: "runtime/data.json",
      },
      {
        path: sources[1][0],
        bytes: mediaBytes.length,
        sha256: sha(mediaBytes),
        root: "story",
        sourcePath: "card.png",
        profile: "chapter-01",
        logicalPath: "chapters/chapter-01/card.png",
      },
    ],
    vendorFiles: [],
    retainedMetadata: { schemaVersion: 1, catalogs: [], manifests: [] },
    playerMetadata: metadata,
  });
  return { root, inventory };
}

test("determinism: source creation order does not change manifest or object bytes", async () => {
  const first = await fixture(false);
  const second = await fixture(true);
  const a = await packProgressiveRelease(first.root, first.inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const b = await packProgressiveRelease(second.root, second.inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  assert.deepEqual(b.manifestBytes, a.manifestBytes);
  assert.deepEqual(b.pointerBytes, a.pointerBytes);
  assert.deepEqual(
    await Promise.all(
      a.objectKeys.map((key) =>
        readFile(path.join(first.root, a.run, "progressive/objects", key)),
      ),
    ),
    await Promise.all(
      b.objectKeys.map((key) =>
        readFile(path.join(second.root, b.run, "progressive/objects", key)),
      ),
    ),
  );
  assert(
    a.manifest.files.some((file) => file.role === "runtime" && file.required),
  );
  assert(
    a.manifest.files.some((file) => file.role === "gameplay" && file.required),
  );
  assert(
    a.manifest.files.some((file) => file.role === "story" && file.required),
  );
  assert(
    a.manifest.files.some((file) => file.role === "media" && !file.required),
  );
});

test("stale generation: verifier rehashes changed canonical source bytes", async () => {
  const { root, inventory } = await fixture();
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  await writeFile(
    path.join(root, "assets/shared/runtime.json"),
    '{"runtime":false}\n',
  );
  await assert.rejects(
    verifyProgressiveRelease(root, candidate.run, true),
    /CONTENT_SOURCE_STALE/,
  );
});

test("CLI verification and publish check observe candidate; stale source returns exact stderr code", async () => {
  const { root, inventory } = await fixture();
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const stdout: string[] = [];
  const stderr: string[] = [];
  assert.equal(
    await runContent(
      root,
      "verify",
      ["--run", candidate.run, "--check-sources"],
      stdout.push.bind(stdout),
      stderr.push.bind(stderr),
    ),
    0,
  );
  assert.equal(
    JSON.parse(stdout.at(-1)!).manifestVersion,
    candidate.manifestVersion,
  );
  assert.equal(
    await runContentPublish(
      root,
      ["--run", candidate.run, "--check"],
      stdout.push.bind(stdout),
      stderr.push.bind(stderr),
    ),
    0,
  );
  assert.equal(
    JSON.parse(stdout.at(-1)!).liveBlocked,
    "PUBLISH_SEMANTIC_VALIDATION_REQUIRED",
  );
  assert.equal(
    await runContentPublish(
      root,
      ["--run", candidate.run],
      stdout.push.bind(stdout),
      stderr.push.bind(stderr),
      {},
    ),
    1,
  );
  assert.equal(stderr.at(-1), "PUBLISH_APPROVAL_REQUIRED");
  await writeFile(path.join(root, "assets/shared/runtime.json"), "changed");
  assert.equal(
    await runContent(
      root,
      "verify",
      ["--run", candidate.run, "--check-sources"],
      stdout.push.bind(stdout),
      stderr.push.bind(stderr),
    ),
    1,
  );
  assert.equal(stderr.at(-1), "CONTENT_SOURCE_STALE");
});

test("previous release: sequence above one requires verified predecessor", async () => {
  const { root, inventory } = await fixture();
  await assert.rejects(
    packProgressiveRelease(root, inventory, {
      releaseSequence: 2,
      coreMin: 1,
      coreMaxExclusive: 2,
    }),
    /CONTENT_PREVIOUS_RELEASE_REQUIRED/,
  );
  const first = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const second = await packProgressiveRelease(root, inventory, {
    releaseSequence: 2,
    coreMin: 1,
    coreMaxExclusive: 2,
    previousRun: first.run,
  });
  assert.equal(second.candidate.previousManifestVersion, first.manifestVersion);
  assert.equal(
    (await verifyProgressiveRelease(root, second.run, true)).manifest
      .releaseSequence,
    2,
  );
});

test("changed-source successor: historic integrity permits new inventory; candidate freshness remains mandatory", async () => {
  const { root, inventory } = await fixture();
  const options = { releaseSequence: 1, coreMin: 1, coreMaxExclusive: 2 };
  const first = await packProgressiveRelease(root, inventory, options);
  const source = inventory.files.find((file) => file.profile === "runtime")!;
  const bytes = Buffer.from('{"runtime":false}\n');
  await writeFile(path.join(root, source.path), bytes);
  const updated = parseFrozenInventory({
    ...inventory,
    files: inventory.files.map((file) =>
      file === source
        ? { ...file, bytes: bytes.length, sha256: sha(bytes) }
        : file,
    ),
  });
  const second = await packProgressiveRelease(root, updated, {
    ...options,
    releaseSequence: 2,
    previousRun: first.run,
  });
  assert.equal(second.candidate.previousManifestVersion, first.manifestVersion);
  assert.equal(
    (await verifyProgressiveRelease(root, first.run, false)).manifestVersion,
    first.manifestVersion,
  );
  await assert.rejects(
    verifyProgressiveRelease(root, first.run, true),
    /CONTENT_SOURCE_STALE/,
  );
  assert.equal(
    (await verifyProgressiveRelease(root, second.run, true)).manifest
      .releaseSequence,
    2,
  );
  const runtime = first.manifest.files.find((file) => file.role === "runtime")!;
  await writeFile(
    path.join(
      root,
      first.run,
      `progressive/objects/content/files/${runtime.version}/${runtime.path}`,
    ),
    bytes,
  );
  await assert.rejects(
    packProgressiveRelease(root, updated, {
      ...options,
      releaseSequence: 3,
      previousRun: first.run,
    }),
    /CONTENT_INVALID_MANIFEST/,
  );
  await writeFile(path.join(root, source.path), "changed again");
  await assert.rejects(
    verifyProgressiveRelease(root, second.run, true),
    /CONTENT_SOURCE_STALE/,
  );
  const client = {
    calls: 0,
    async send(): Promise<Record<string, unknown>> {
      this.calls++;
      throw new Error("unexpected remote call");
    },
  };
  await assert.rejects(
    publishProgressiveRelease(
      root,
      second.run,
      new S3ProgressiveTransport(client, "bucket", ""),
      { semanticValidated: true },
    ),
    /CONTENT_SOURCE_STALE/,
  );
  assert.equal(client.calls, 0);
});

async function rewriteManifest(
  root: string,
  run: string,
  manifest: ProgressiveManifest,
): Promise<void> {
  // Rebind every local hash so failures prove inventory consistency, not stale envelopes.
  const manifestBytes = canonicalBytes(parseProgressiveManifest(manifest));
  const ref = { version: sha(manifestBytes), bytes: manifestBytes.length };
  const pointerBytes = canonicalBytes({
    schemaVersion: 1,
    releaseSequence: manifest.releaseSequence,
    manifest: ref,
  });
  const candidatePath = path.join(root, run, "progressive/candidate.json");
  const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
  const objectPath = path.join(
    root,
    run,
    `progressive/objects/content/manifests/${ref.version}.json`,
  );
  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, manifestBytes);
  await writeFile(
    path.join(root, run, "progressive/manifest.json"),
    manifestBytes,
  );
  await writeFile(
    path.join(root, run, "progressive/pointer.json"),
    pointerBytes,
  );
  await writeFile(
    candidatePath,
    canonicalBytes({
      ...candidate,
      manifest: ref,
      pointer: { version: sha(pointerBytes), bytes: pointerBytes.length },
    }),
  );
}

const manifestCorruptions: readonly {
  name: string;
  tamper(manifest: ProgressiveManifest): ProgressiveManifest;
}[] = [
  {
    name: "omitted optional payload",
    tamper: (manifest) => ({
      ...manifest,
      files: manifest.files.filter((file) => file.role !== "media"),
    }),
  },
  {
    name: "forged role and required",
    tamper: (manifest) => ({
      ...manifest,
      files: manifest.files.map((file) =>
        file.role === "media"
          ? { ...file, role: "runtime", required: true, packIds: ["runtime"] }
          : file,
      ),
    }),
  },
  {
    name: "forged packIds",
    tamper: (manifest) => ({
      ...manifest,
      files: manifest.files.map((file) =>
        file.role === "media" ? { ...file, packIds: ["runtime"] } : file,
      ),
    }),
  },
  {
    name: "forged MIME identity",
    tamper: (manifest) => ({
      ...manifest,
      files: manifest.files.map((file) =>
        file.role === "media" ? { ...file, mediaType: "image/jpeg" } : file,
      ),
    }),
  },
  {
    name: "forged runtime snapshot",
    tamper: (manifest) => ({
      ...manifest,
      runtimeSnapshotId: sha("forged snapshot"),
    }),
  },
  {
    name: "forged chapter title",
    tamper: (manifest) => ({
      ...manifest,
      chapters: manifest.chapters.map((chapter) => ({
        ...chapter,
        title: "Forged",
      })),
    }),
  },
  {
    name: "forged chapter description",
    tamper: (manifest) => ({
      ...manifest,
      chapters: manifest.chapters.map((chapter) => ({
        ...chapter,
        description: "Forged",
      })),
    }),
  },
  {
    name: "omitted story descriptor",
    tamper: (manifest) => ({
      ...manifest,
      chapters: manifest.chapters.map((chapter) => ({
        ...chapter,
        storyPath: null,
      })),
    }),
  },
];

for (const { name, tamper } of manifestCorruptions) {
  test(`inventory roster: ${name} rejects verify and publish before remote calls`, async () => {
    const { root, inventory } = await fixture();
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence: 1,
      coreMin: 1,
      coreMaxExclusive: 2,
    });
    await rewriteManifest(root, candidate.run, tamper(candidate.manifest));
    for (const checkSources of [false, true])
      await assert.rejects(
        verifyProgressiveRelease(root, candidate.run, checkSources),
        /CONTENT_INVALID_MANIFEST/,
      );
    const client = {
      calls: 0,
      async send(): Promise<Record<string, unknown>> {
        this.calls++;
        throw new Error("unexpected remote call");
      },
    };
    await assert.rejects(
      publishProgressiveRelease(
        root,
        candidate.run,
        new S3ProgressiveTransport(client, "bucket", ""),
        { semanticValidated: true },
      ),
      /CONTENT_INVALID_MANIFEST/,
    );
    assert.equal(client.calls, 0);
  });
}

test("inventory schema: unknown field rejects verify and publish before remote calls", async () => {
  const { root, inventory } = await fixture();
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  await writeFile(
    path.join(root, candidate.run, "progressive/inventory.json"),
    canonicalBytes({ ...inventory, unknown: true }),
  );
  await assert.rejects(
    verifyProgressiveRelease(root, candidate.run, true),
    /CONTENT_INVALID_MANIFEST/,
  );
  const client = {
    calls: 0,
    async send(): Promise<Record<string, unknown>> {
      this.calls++;
      throw new Error("unexpected remote call");
    },
  };
  await assert.rejects(
    publishProgressiveRelease(
      root,
      candidate.run,
      new S3ProgressiveTransport(client, "bucket", ""),
      { semanticValidated: true },
    ),
    /CONTENT_INVALID_MANIFEST/,
  );
  assert.equal(client.calls, 0);
});
