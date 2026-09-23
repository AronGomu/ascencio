import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  parseFrozenInventory,
  type FrozenInventory,
} from "../scripts/lib/asset-delivery/frozen-inventory.ts";
import { prepared } from "./fixtures/asset-delivery-bundle.ts";
import { packProgressiveRelease } from "../scripts/lib/asset-delivery/progressive-producer.ts";
import { contentRuntimeFixture } from "./fixtures/content-runtime-fixture.ts";
import {
  publishProgressiveRelease,
  S3ProgressiveTransport,
} from "../scripts/lib/asset-delivery/progressive-publisher.ts";
import { runContentPublish } from "../scripts/lib/asset-delivery/content-publish-cli.ts";

const sha = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

async function fixture(): Promise<{
  root: string;
  inventory: FrozenInventory;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-publish-"));
  const runtime = await contentRuntimeFixture(
    prepared.chapters[0]!.gameplay.cards,
    {},
  );
  const runtimeSnapshotId = runtime.snapshotId;
  const runtimePayload = runtime.files.filter(
    ({ path }) => !path.startsWith("runtime/engine/"),
  );
  const mediaPath = "assets/story/map.png";
  const mediaBytes = Buffer.from("png-fixture");
  for (const file of runtimePayload) {
    const relative = `assets/shared/${file.path}`;
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), file.bytes);
  }
  await mkdir(path.dirname(path.join(root, mediaPath)), { recursive: true });
  await writeFile(path.join(root, mediaPath), mediaBytes);
  for (const file of runtime.files.filter(({ path }) =>
    path.startsWith("runtime/engine/"),
  )) {
    const relative = `vendor/ocgcore-wasm/0.1.2/${file.path.endsWith(".wasm") ? "lib/ocgcore.sync.wasm" : "vendor-manifest.json"}`;
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), file.bytes);
  }
  const metadataPath = "content/authoring/fixture.json";
  const metadataBytes = JSON.stringify(prepared);
  await mkdir(path.dirname(path.join(root, metadataPath)), { recursive: true });
  await writeFile(path.join(root, metadataPath), metadataBytes);
  return {
    root,
    inventory: parseFrozenInventory({
      schemaVersion: 1,
      appVersion: "0.1.0",
      runtimeSnapshotId,
      profiles: [
        {
          schemaVersion: 1,
          id: "chapter-01",
          dependsOn: ["runtime"],
          rules: [],
        },
        { schemaVersion: 1, id: "runtime", dependsOn: [], rules: [] },
      ],
      selection: { schemaVersion: 1, profiles: ["chapter-01", "runtime"] },
      files: [
        ...runtimePayload.map((file) => ({
          path: `assets/shared/${file.path}`,
          bytes: file.bytes.length,
          sha256: sha(file.bytes),
          root: "shared" as const,
          sourcePath: file.path,
          profile: "runtime" as const,
          logicalPath: file.path,
        })),
        {
          path: mediaPath,
          bytes: mediaBytes.length,
          sha256: sha(mediaBytes),
          root: "story",
          sourcePath: "map.png",
          profile: "chapter-01",
          logicalPath: "story/media/map.png",
        },
      ].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
      ),
      vendorFiles: runtime.files
        .filter(({ path }) => path.startsWith("runtime/engine/"))
        .map((file) => ({
          path: `vendor/ocgcore-wasm/0.1.2/${file.path.endsWith(".wasm") ? "lib/ocgcore.sync.wasm" : "vendor-manifest.json"}`,
          bytes: file.bytes.length,
          sha256: sha(file.bytes),
        }))
        .sort((left, right) =>
          left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
        ),
      retainedMetadata: { schemaVersion: 1, catalogs: [], manifests: [] },
      playerMetadata: {
        schemaVersion: 2,
        sourceInputs: [
          {
            path: metadataPath,
            bytes: Buffer.byteLength(metadataBytes),
            sha256: sha(metadataBytes),
          },
        ],
        runtimeSnapshotId,
        runtimeCardCodes: prepared.runtimeCardCodes,
        chapters: [
          {
            id: "chapter-01",
            title: "Chapter 1",
            description: "Fixture",
            storyContentId: "prototype-prologue-v1",
            setIds: prepared.chapters[0]!.setIds,
            unavailableSetImageIds: [],
            cardCodes: prepared.chapters[0]!.cardCodes,
            opponentIds: prepared.chapters[0]!.opponentIds,
            gameplay: prepared.chapters[0]!.gameplay,
            story: prepared.chapters[0]!.story,
          },
        ],
      },
    }),
  };
}

type Row = { bytes: Uint8Array; etag: string };
class FakeS3Client {
  readonly rows = new Map<string, Row>();
  readonly calls: { name: string; input: Record<string, unknown> }[] = [];
  failFile = false;
  beforePointer: (() => void) | null = null;
  afterPut: ((key: string) => Promise<void>) | null = null;
  private latestBarrier: Promise<void> | null = null;
  private latestBarrierRelease: (() => void) | null = null;
  private latestReads = 0;

  barrierLatestReads(): void {
    this.latestReads = 0;
    this.latestBarrier = new Promise((resolve) => {
      this.latestBarrierRelease = resolve;
    });
  }

  async send(command: {
    input: Record<string, unknown>;
    constructor: { name: string };
  }): Promise<Record<string, unknown>> {
    const name = command.constructor.name;
    const input = command.input;
    this.calls.push({ name, input });
    const key = String(input.Key);
    if (name === "HeadObjectCommand") {
      const row = this.rows.get(key);
      if (!row)
        throw Object.assign(new Error("missing"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
      return { ETag: row.etag, ContentLength: row.bytes.length };
    }
    if (name === "GetObjectCommand") {
      if (key.endsWith("content/latest.json") && this.latestBarrier) {
        this.latestReads++;
        if (this.latestReads === 2) this.latestBarrierRelease!();
        await this.latestBarrier;
        if (this.latestReads === 2) {
          this.latestBarrier = null;
          this.latestBarrierRelease = null;
        }
      }
      const row = this.rows.get(key);
      if (!row)
        throw Object.assign(new Error("missing"), {
          name: "NoSuchKey",
          $metadata: { httpStatusCode: 404 },
        });
      return {
        ETag: row.etag,
        ContentLength: row.bytes.length,
        Body: { transformToByteArray: async () => row.bytes.slice() },
      };
    }
    if (name === "PutObjectCommand") {
      const body = new Uint8Array(input.Body as Uint8Array);
      if (this.failFile && key.includes("content/files/"))
        throw new Error("injected network failure");
      if (key.endsWith("content/latest.json")) {
        this.beforePointer?.();
        this.beforePointer = null;
        const old = this.rows.get(key);
        const expected = input.IfMatch;
        if (
          (expected === undefined && old) ||
          (expected !== undefined && old?.etag !== expected)
        )
          throw Object.assign(new Error("precondition"), {
            name: "PreconditionFailed",
            $metadata: { httpStatusCode: 412 },
          });
      } else if (input.IfNoneMatch === "*" && this.rows.has(key)) {
        throw Object.assign(new Error("precondition"), {
          name: "PreconditionFailed",
          $metadata: { httpStatusCode: 412 },
        });
      }
      const etag = `"${sha(body)}"`;
      this.rows.set(key, { bytes: body.slice(), etag });
      await this.afterPut?.(key);
      return { ETag: etag };
    }
    throw new Error(`unexpected ${name}`);
  }
}

const transport = (client: FakeS3Client) =>
  new S3ProgressiveTransport(client, "bucket", "ascencio-assets/v1/");

async function candidates() {
  const { root, inventory } = await fixture();
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
  const third = await packProgressiveRelease(root, inventory, {
    releaseSequence: 3,
    coreMin: 1,
    coreMaxExclusive: 2,
    previousRun: first.run,
  });
  return { root, first, second, third };
}

test("publish failure: failed file upload leaves latest pointer unchanged and retries at most twice", async () => {
  const { root, first } = await candidates();
  const client = new FakeS3Client();
  client.failFile = true;
  await assert.rejects(
    publishProgressiveRelease(root, first.run, transport(client)),
    /PUBLISH_NETWORK_FAILED/,
  );
  assert.equal(
    client.rows.has("ascencio-assets/v1/content/latest.json"),
    false,
  );
  assert.equal(
    client.calls.filter((call) => call.name === "PutObjectCommand").length,
    2,
  );
});

test("publish ordering: files precede manifest, pointer is last, identical retry is idempotent", async () => {
  const { root, first } = await candidates();
  const client = new FakeS3Client();
  assert.equal(
    (await publishProgressiveRelease(root, first.run, transport(client)))
      .status,
    "published",
  );
  const puts = client.calls
    .filter((call) => call.name === "PutObjectCommand")
    .map((call) => String(call.input.Key));
  const manifestIndex = puts.findIndex((key) =>
    key.includes("content/manifests/"),
  );
  const pointerIndex = puts.findIndex((key) =>
    key.endsWith("content/latest.json"),
  );
  assert(manifestIndex > 0);
  assert.equal(pointerIndex, puts.length - 1);
  assert(
    puts.slice(0, manifestIndex).every((key) => key.includes("content/files/")),
  );
  const before = puts.length;
  assert.equal(
    (await publishProgressiveRelease(root, first.run, transport(client)))
      .status,
    "idempotent",
  );
  assert.equal(
    client.calls.filter((call) => call.name === "PutObjectCommand").length,
    before,
  );
});

test("idempotent publish restores a missing immutable file", async () => {
  const { root, first } = await candidates();
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client));
  const fileKey = `ascencio-assets/v1/${first.objectKeys.find((key) => key.startsWith("content/files/"))!}`;
  client.rows.delete(fileKey);

  assert.equal(
    (await publishProgressiveRelease(root, first.run, transport(client)))
      .status,
    "idempotent",
  );
  assert(client.rows.has(fileKey));
});

test("concurrent publisher: candidates from same predecessor permit one pointer CAS winner", async () => {
  const { root, first, second, third } = await candidates();
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client));
  client.barrierLatestReads();
  const results = await Promise.allSettled([
    publishProgressiveRelease(root, second.run, transport(client)),
    publishProgressiveRelease(root, third.run, transport(client)),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  const failure = results.find(
    (result) => result.status === "rejected",
  ) as PromiseRejectedResult;
  assert.match(String(failure.reason), /PUBLISH_CONFLICT/);
  const pointer = JSON.parse(
    Buffer.from(
      client.rows.get("ascencio-assets/v1/content/latest.json")!.bytes,
    ).toString("utf8"),
  );
  assert([2, 3].includes(pointer.releaseSequence));
});

test("official continuity failure preserves previous remote pointer", async () => {
  const { root, inventory } = await fixture();
  const first = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client));
  const pointerKey = "ascencio-assets/v1/content/latest.json";
  const before = client.rows.get(pointerKey)!.bytes.slice();
  const chapter = inventory.playerMetadata!.chapters[0]!;
  const changed = parseFrozenInventory({
    ...inventory,
    playerMetadata: {
      ...inventory.playerMetadata!,
      chapters: [
        {
          ...chapter,
          story: {
            ...chapter.story,
            beats: chapter.story.beats.map((beat, index) =>
              index === 0 ? { ...beat, id: `${beat.id}-removed` } : beat,
            ),
          },
        },
      ],
    },
  });
  await assert.rejects(
    packProgressiveRelease(root, changed, {
      releaseSequence: 2,
      coreMin: 1,
      coreMaxExclusive: 2,
      previousRun: first.run,
    }),
    /CONTENT_SEMANTIC_INVALID/,
  );
  assert.deepEqual(client.rows.get(pointerKey)!.bytes, before);
});

test("published predecessor binding: stale local predecessor rejects before latest write", async () => {
  const { root, first, second, third } = await candidates();
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client));
  await publishProgressiveRelease(root, second.run, transport(client));
  const before = client.calls.filter(
    (call) =>
      call.name === "PutObjectCommand" &&
      String(call.input.Key).endsWith("content/latest.json"),
  ).length;
  await assert.rejects(
    publishProgressiveRelease(root, third.run, transport(client)),
    /PUBLISH_CONFLICT/,
  );
  const after = client.calls.filter(
    (call) =>
      call.name === "PutObjectCommand" &&
      String(call.input.Key).endsWith("content/latest.json"),
  ).length;
  assert.equal(after, before);
});

test("immutable identity: divergent existing immutable key rejects without overwrite", async () => {
  const { root, first } = await candidates();
  const client = new FakeS3Client();
  const fileKey = `ascencio-assets/v1/${first.objectKeys.find((key) => key.startsWith("content/files/"))!}`;
  const original = new TextEncoder().encode("different");
  client.rows.set(fileKey, { bytes: original, etag: `"${sha(original)}"` });
  await assert.rejects(
    publishProgressiveRelease(root, first.run, transport(client)),
    /PUBLISH_IMMUTABLE_CONFLICT/,
  );
  assert.deepEqual(client.rows.get(fileKey)!.bytes, original);
  assert.equal(
    client.rows.has("ascencio-assets/v1/content/latest.json"),
    false,
  );
});

test("validation stamp never substitutes for publisher semantic verification", async () => {
  const { root, first } = await candidates();
  await writeFile(
    path.join(root, first.run, "progressive/validation.json"),
    '{"schemaVersion":1,"validation":"passed"}\n',
  );
  const client = new FakeS3Client();
  await assert.rejects(
    publishProgressiveRelease(root, first.run, transport(client)),
    /CONTENT_INVALID_MANIFEST/,
  );
  assert.equal(client.calls.length, 0);
});

test("live CLI uses rights/config-verified injected SDK transport without real endpoint access", async () => {
  const { root, inventory } = await fixture();
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  await approveFixture(root, inventory);
  const client = new FakeS3Client();
  let closed = false;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const secret = "fixture-secret-never-logged";
  const exit = await runContentPublish(
    root,
    ["--run", candidate.run],
    stdout.push.bind(stdout),
    stderr.push.bind(stderr),
    {
      ASSET_R2_ACCOUNT_ID: "a".repeat(32),
      ASSET_R2_ACCESS_KEY_ID: "fixture-access",
      ASSET_R2_SECRET_ACCESS_KEY: secret,
    },
    () => ({
      transport: transport(client),
      close: () => {
        closed = true;
      },
    }),
  );
  assert.equal(exit, 0);
  assert.equal(closed, true);
  assert.equal(client.rows.has("ascencio-assets/v1/content/latest.json"), true);
  assert.equal(JSON.parse(stdout.at(-1)!).publication, "published");
  assert.equal([...stdout, ...stderr].join("\n").includes(secret), false);
});

test("immutable identity: same-length divergent bytes execute GET hash rejection without overwrite", async () => {
  const { root, first } = await candidates();
  const client = new FakeS3Client();
  const key = first.objectKeys.find((key) => key.startsWith("content/files/"))!;
  const fileKey = `ascencio-assets/v1/${key}`;
  const expected = new Uint8Array(
    await readFile(path.join(root, first.run, "progressive/objects", key)),
  );
  const original = expected.slice();
  original[0] = original[0]! ^ 1;
  assert.equal(original.length, expected.length);
  assert.notEqual(sha(original), sha(expected));
  client.rows.set(fileKey, { bytes: original, etag: `"${sha(original)}"` });
  await assert.rejects(
    publishProgressiveRelease(root, first.run, transport(client)),
    /PUBLISH_IMMUTABLE_CONFLICT/,
  );
  assert.deepEqual(client.rows.get(fileKey)!.bytes, original);
  assert.equal(
    client.calls.filter(
      (call) => call.name === "GetObjectCommand" && call.input.Key === fileKey,
    ).length,
    1,
  );
  assert.equal(
    client.rows.has("ascencio-assets/v1/content/latest.json"),
    false,
  );
});

async function approveFixture(
  root: string,
  inventory: FrozenInventory,
): Promise<void> {
  const evidencePath = "evidence/publication.txt";
  const evidenceBytes = Buffer.from("fixture approval evidence\n");
  await mkdir(path.dirname(path.join(root, evidencePath)), { recursive: true });
  await writeFile(path.join(root, evidencePath), evidenceBytes);
  await writeFile(
    path.join(root, "asset-delivery.config.json"),
    JSON.stringify({
      schemaVersion: 1,
      publicBaseUrl: "https://assets.example.com/ascencio-assets/v1/",
      bucket: "ascencio-assets",
      keyPrefix: "ascencio-assets/v1/",
    }),
  );
  const evidence = {
    path: evidencePath,
    bytes: evidenceBytes.length,
    sha256: sha(evidenceBytes),
  };
  await mkdir(path.join(root, "content"), { recursive: true });
  await writeFile(
    path.join(root, "content/asset-publication-approval.json"),
    JSON.stringify({
      schemaVersion: 1,
      status: "approved",
      targets: ["prod"],
      rules: [
        {
          root: "shared",
          kind: "tree",
          path: "",
          includesFutureFiles: true,
          evidence,
        },
        {
          root: "story",
          kind: "tree",
          path: "",
          includesFutureFiles: true,
          evidence,
        },
        ...inventory.playerMetadata!.sourceInputs.map((file) => ({
          root: "metadata",
          kind: "file",
          path: file.path,
          sha256: file.sha256,
          evidence,
        })),
        ...inventory.vendorFiles.map((file) => ({
          root: "vendor",
          kind: "file",
          path: file.path.replace(/^vendor\//, ""),
          sha256: file.sha256,
          evidence,
        })),
      ],
    }),
  );
}

const fakeEnvironment = {
  ASSET_R2_ACCOUNT_ID: "a".repeat(32),
  ASSET_R2_ACCESS_KEY_ID: "fixture-access",
  ASSET_R2_SECRET_ACCESS_KEY: "fixture-secret",
};

for (const mutation of ["source", "semantic", "object", "pointer"] as const) {
  test(`live CLI rechecks ${mutation} mutation after manifest upload with no pointer write`, async () => {
    const { root, inventory } = await fixture();
    await approveFixture(root, inventory);
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence: 1,
      coreMin: 1,
      coreMaxExclusive: 2,
    });
    const client = new FakeS3Client();
    client.afterPut = async (key) => {
      if (!key.includes("content/manifests/")) return;
      if (mutation === "source")
        await writeFile(
          path.join(root, inventory.playerMetadata!.sourceInputs[0]!.path),
          "mutated",
        );
      else if (mutation === "semantic") {
        const filename = path.join(
          root,
          candidate.run,
          "progressive/inventory.json",
        );
        const value = JSON.parse(await readFile(filename, "utf8"));
        value.playerMetadata.chapters[0].gameplay.decks[0].name = "mutated";
        await writeFile(filename, JSON.stringify(value));
      } else if (mutation === "pointer")
        await writeFile(
          path.join(root, candidate.run, "progressive/pointer.json"),
          "{}",
        );
      else
        await writeFile(
          path.join(
            root,
            candidate.run,
            "progressive/objects",
            candidate.objectKeys[0]!,
          ),
          "mutated",
        );
    };
    const errors: string[] = [];
    let closes = 0;
    const exit = await runContentPublish(
      root,
      ["--run", candidate.run],
      () => {},
      (line) => errors.push(line),
      fakeEnvironment,
      () => ({
        transport: transport(client),
        close: () => {
          closes++;
        },
      }),
    );
    assert.equal(exit, 1);
    assert.deepEqual(errors, [
      mutation === "source"
        ? "CONTENT_SOURCE_STALE"
        : "CONTENT_INVALID_MANIFEST",
    ]);
    assert.equal(closes, 1);
    assert.equal(
      client.calls.filter(
        ({ name, input }) =>
          name === "PutObjectCommand" &&
          String(input.Key).endsWith("content/latest.json"),
      ).length,
      0,
    );
  });
}

test("live CLI denies unapproved metadata provenance before transport", async () => {
  const { root, inventory } = await fixture();
  await approveFixture(root, inventory);
  const approvalPath = path.join(
    root,
    "content/asset-publication-approval.json",
  );
  const approval = JSON.parse(await readFile(approvalPath, "utf8"));
  approval.rules = approval.rules.filter(
    (rule: { root: string }) => rule.root !== "metadata",
  );
  await writeFile(approvalPath, JSON.stringify(approval));
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const errors: string[] = [];
  let opened = 0;
  const exit = await runContentPublish(
    root,
    ["--run", candidate.run],
    () => {},
    (line) => errors.push(line),
    fakeEnvironment,
    () => {
      opened++;
      return { transport: transport(new FakeS3Client()), close() {} };
    },
  );
  assert.equal(exit, 1);
  assert.deepEqual(errors, ["PUBLISH_APPROVAL_REQUIRED"]);
  assert.equal(opened, 0);
});

test("upload rejects changed local bytes before sending them to remote immutable key", async () => {
  const { root, inventory } = await fixture();
  const candidate = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const client = new FakeS3Client();
  const file = candidate.manifest.files[1]!;
  const key = `content/files/${file.version}/${file.path}`;
  let mutated = false;
  client.afterPut = async () => {
    if (mutated) return;
    mutated = true;
    await writeFile(
      path.join(root, candidate.run, "progressive/objects", key),
      "mutated",
    );
  };
  await assert.rejects(
    publishProgressiveRelease(root, candidate.run, transport(client)),
    { message: "CONTENT_INVALID_MANIFEST" },
  );
  assert.equal(
    client.calls.some(
      ({ name, input }) =>
        name === "PutObjectCommand" && String(input.Key).endsWith(key),
    ),
    false,
  );
  assert.equal(
    client.rows.has("ascencio-assets/v1/content/latest.json"),
    false,
  );
});

for (const invalid of [
  "stamp",
  "stale predecessor",
  "immutable conflict",
  "empty provenance",
] as const) {
  test(`live CLI invalid candidate: ${invalid}; exact error, zero pointer writes, owned transport closes`, async () => {
    const { root, inventory } = await fixture();
    await approveFixture(root, inventory);
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence: 1,
      coreMin: 1,
      coreMaxExclusive: 2,
    });
    const client = new FakeS3Client();
    let run = candidate.run;
    if (invalid === "stamp")
      await writeFile(
        path.join(root, run, "progressive/validation.json"),
        "{}",
      );
    if (invalid === "empty provenance") {
      await writeFile(
        path.join(root, run, "progressive/inventory.json"),
        JSON.stringify({
          ...inventory,
          playerMetadata: { ...inventory.playerMetadata, sourceInputs: [] },
        }),
      );
    }
    if (invalid === "stale predecessor") {
      const next = await packProgressiveRelease(root, inventory, {
        releaseSequence: 2,
        coreMin: 1,
        coreMaxExclusive: 2,
        previousRun: candidate.run,
      });
      run = next.run; // Remote is empty, not this candidate's declared predecessor.
    }
    if (invalid === "immutable conflict") {
      const key = `ascencio-assets/v1/${candidate.objectKeys[0]!}`;
      client.rows.set(key, { bytes: new Uint8Array([1]), etag: "fixture" });
    }
    const errors: string[] = [];
    let opened = 0;
    let closes = 0;
    const exit = await runContentPublish(
      root,
      ["--run", run],
      () => {},
      (error) => errors.push(error),
      fakeEnvironment,
      () => {
        opened++;
        return {
          transport: transport(client),
          close() {
            closes++;
          },
        };
      },
    );
    assert.equal(exit, 1);
    assert.deepEqual(errors, [
      {
        stamp: "CONTENT_INVALID_MANIFEST",
        "stale predecessor": "PUBLISH_CONFLICT",
        "immutable conflict": "PUBLISH_IMMUTABLE_CONFLICT",
        "empty provenance": "PUBLISH_APPROVAL_REQUIRED",
      }[invalid],
    ]);
    assert.equal(
      opened,
      invalid === "stamp" || invalid === "empty provenance" ? 0 : 1,
    );
    assert.equal(closes, opened);
    assert.equal(
      client.calls.filter(
        ({ name, input }) =>
          name === "PutObjectCommand" &&
          String(input.Key).endsWith("content/latest.json"),
      ).length,
      0,
    );
  });
}

async function rewriteCandidateInventory(
  root: string,
  run: string,
  inventory: FrozenInventory,
): Promise<void> {
  const { deriveProgressiveManifest } =
    await import("../scripts/lib/asset-delivery/progressive-manifest.ts");
  const { canonicalBytes } =
    await import("../scripts/lib/asset-delivery/canonical-json.ts");
  const { manifest } = deriveProgressiveManifest(inventory, {
    releaseSequence: 1,
    coreRange: { min: 1, maxExclusive: 2 },
  });
  const manifestBytes = canonicalBytes(manifest);
  const manifestVersion = sha(manifestBytes);
  const pointer = canonicalBytes({
    schemaVersion: 1,
    releaseSequence: 1,
    manifest: { version: manifestVersion, bytes: manifestBytes.length },
  });
  const directory = path.join(root, run, "progressive");
  await writeFile(
    path.join(directory, "inventory.json"),
    canonicalBytes(inventory),
  );
  await writeFile(path.join(directory, "manifest.json"), manifestBytes);
  await writeFile(path.join(directory, "pointer.json"), pointer);
  await writeFile(
    path.join(
      directory,
      "objects/content/manifests",
      `${manifestVersion}.json`,
    ),
    manifestBytes,
  );
  await writeFile(
    path.join(directory, "candidate.json"),
    canonicalBytes({
      schemaVersion: 1,
      previousManifestVersion: null,
      manifest: { version: manifestVersion, bytes: manifestBytes.length },
      pointer: { version: sha(pointer), bytes: pointer.length },
    }),
  );
  await writeFile(
    path.join(directory, "validation.json"),
    canonicalBytes({
      schemaVersion: 1,
      manifestVersion,
      previousManifestVersion: null,
      validation: "passed",
    }),
  );
}

for (const name of ["lib/ocgcore.sync.wasm", "vendor-manifest.json"]) {
  test(`publisher rejects self-consistent wrong frozen ${name} before transport`, async () => {
    const { root, inventory } = await fixture();
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence: 1,
      coreMin: 1,
      coreMaxExclusive: 2,
    });
    const bytes = Buffer.from("wrong frozen executable");
    const vendorPath = `vendor/ocgcore-wasm/0.1.2/${name}`;
    const changed = parseFrozenInventory({
      ...inventory,
      vendorFiles: inventory.vendorFiles.map((file) =>
        file.path === vendorPath
          ? { ...file, bytes: bytes.length, sha256: sha(bytes) }
          : file,
      ),
    });
    await writeFile(path.join(root, vendorPath), bytes);
    const objectPath = path.join(
      root,
      candidate.run,
      "progressive/objects/content/files",
      sha(bytes),
      "runtime/engine",
      path.basename(name),
    );
    await mkdir(path.dirname(objectPath), { recursive: true });
    await writeFile(objectPath, bytes);
    await rewriteCandidateInventory(root, candidate.run, changed);
    const client = new FakeS3Client();
    const errors: string[] = [];
    let opens = 0;
    assert.equal(
      await runContentPublish(
        root,
        ["--run", candidate.run],
        () => {},
        (error) => errors.push(error),
        fakeEnvironment,
        () => {
          opens++;
          return { transport: transport(client), close() {} };
        },
      ),
      1,
    );
    assert.deepEqual(errors, ["CONTENT_SEMANTIC_INVALID"]);
    assert.equal(opens, 0);
    assert.equal(client.calls.length, 0);
  });
}

test("pre-CAS entry identities reject replacement by a different fully valid candidate", async () => {
  const { cp } = await import("node:fs/promises");
  const { root, inventory } = await fixture();
  await approveFixture(root, inventory);
  const first = await packProgressiveRelease(root, inventory, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const changed = parseFrozenInventory({
    ...inventory,
    playerMetadata: {
      ...inventory.playerMetadata!,
      chapters: inventory.playerMetadata!.chapters.map((chapter) => ({
        ...chapter,
        title: "Another valid title",
      })),
    },
  });
  const alternate = await packProgressiveRelease(root, changed, {
    releaseSequence: 1,
    coreMin: 1,
    coreMaxExclusive: 2,
  });
  const client = new FakeS3Client();
  client.afterPut = async (key) => {
    if (key.includes("content/manifests/"))
      await cp(
        path.join(root, alternate.run, "progressive"),
        path.join(root, first.run, "progressive"),
        { recursive: true },
      );
  };
  const errors: string[] = [];
  let closes = 0;
  assert.equal(
    await runContentPublish(
      root,
      ["--run", first.run],
      () => {},
      (error) => errors.push(error),
      fakeEnvironment,
      () => ({
        transport: transport(client),
        close() {
          closes++;
        },
      }),
    ),
    1,
  );
  assert.deepEqual(errors, ["CONTENT_INVALID_MANIFEST"]);
  assert.equal(closes, 1);
  assert.equal(
    client.calls.some(
      ({ name, input }) =>
        name === "PutObjectCommand" &&
        String(input.Key).endsWith("content/latest.json"),
    ),
    false,
  );
});

for (const when of ["transport factory", "upload"] as const) {
  test(`live rights-approved provenance cannot change during ${when} with unchanged payload identity`, async () => {
    const { root, inventory } = await fixture();
    await approveFixture(root, inventory);
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence: 1,
      coreMin: 1,
      coreMaxExclusive: 2,
    });
    const unapprovedPath = "content/authoring/unapproved.json";
    const bytes = Buffer.from("unapproved metadata fixture");
    await writeFile(path.join(root, unapprovedPath), bytes);
    const changed = {
      ...inventory,
      playerMetadata: {
        ...inventory.playerMetadata!,
        sourceInputs: [
          { path: unapprovedPath, bytes: bytes.length, sha256: sha(bytes) },
        ],
      },
    };
    const inventoryPath = path.join(
      root,
      candidate.run,
      "progressive/inventory.json",
    );
    const client = new FakeS3Client();
    let closes = 0;
    const errors: string[] = [];
    if (when === "upload")
      client.afterPut = async (key) => {
        if (key.includes("content/manifests/"))
          await writeFile(inventoryPath, JSON.stringify(changed));
      };
    const { writeFileSync } = await import("node:fs");
    assert.equal(
      await runContentPublish(
        root,
        ["--run", candidate.run],
        () => {},
        (error) => errors.push(error),
        fakeEnvironment,
        () => {
          if (when === "transport factory")
            writeFileSync(inventoryPath, JSON.stringify(changed));
          return {
            transport: transport(client),
            close() {
              closes++;
            },
          };
        },
      ),
      1,
    );
    assert.deepEqual(errors, ["CONTENT_INVALID_MANIFEST"]);
    assert.equal(closes, 1);
    assert.equal(
      client.calls.some(
        ({ name, input }) =>
          name === "PutObjectCommand" &&
          String(input.Key).endsWith("content/latest.json"),
      ),
      false,
    );
  });
}
