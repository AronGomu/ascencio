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
import {
  publishProgressiveRelease,
  S3ProgressiveTransport,
} from "../scripts/lib/asset-delivery/progressive-publisher.ts";

const sha = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

async function fixture(): Promise<{
  root: string;
  inventory: FrozenInventory;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "ascencio-publish-"));
  const relative = "assets/shared/runtime.json";
  const bytes = Buffer.from('{"runtime":true}\n');
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), bytes);
  const runtimeSnapshotId = sha("snapshot");
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
        {
          path: relative,
          bytes: bytes.length,
          sha256: sha(bytes),
          root: "shared",
          sourcePath: "runtime.json",
          profile: "runtime",
          logicalPath: "runtime/data.json",
        },
      ],
      vendorFiles: [],
      retainedMetadata: { schemaVersion: 1, catalogs: [], manifests: [] },
      playerMetadata: {
        schemaVersion: 2,
        sourceInputs: [],
        runtimeSnapshotId,
        runtimeCardCodes: [],
        chapters: [
          {
            id: "chapter-01",
            title: "Chapter 1",
            description: "Fixture",
            storyContentId: "prototype-prologue-v1",
            setIds: [],
            unavailableSetImageIds: [],
            cardCodes: [],
            opponentIds: [],
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
    publishProgressiveRelease(root, first.run, transport(client), {
      semanticValidated: true,
    }),
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
    (
      await publishProgressiveRelease(root, first.run, transport(client), {
        semanticValidated: true,
      })
    ).status,
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
    (
      await publishProgressiveRelease(root, first.run, transport(client), {
        semanticValidated: true,
      })
    ).status,
    "idempotent",
  );
  assert.equal(
    client.calls.filter((call) => call.name === "PutObjectCommand").length,
    before,
  );
});

test("concurrent publisher: candidates from same predecessor permit one pointer CAS winner", async () => {
  const { root, first, second, third } = await candidates();
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client), {
    semanticValidated: true,
  });
  client.barrierLatestReads();
  const results = await Promise.allSettled([
    publishProgressiveRelease(root, second.run, transport(client), {
      semanticValidated: true,
    }),
    publishProgressiveRelease(root, third.run, transport(client), {
      semanticValidated: true,
    }),
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

test("published predecessor binding: stale local predecessor rejects before latest write", async () => {
  const { root, first, second, third } = await candidates();
  const client = new FakeS3Client();
  await publishProgressiveRelease(root, first.run, transport(client), {
    semanticValidated: true,
  });
  await publishProgressiveRelease(root, second.run, transport(client), {
    semanticValidated: true,
  });
  const before = client.calls.filter(
    (call) =>
      call.name === "PutObjectCommand" &&
      String(call.input.Key).endsWith("content/latest.json"),
  ).length;
  await assert.rejects(
    publishProgressiveRelease(root, third.run, transport(client), {
      semanticValidated: true,
    }),
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
    publishProgressiveRelease(root, first.run, transport(client), {
      semanticValidated: true,
    }),
    /PUBLISH_IMMUTABLE_CONFLICT/,
  );
  assert.deepEqual(client.rows.get(fileKey)!.bytes, original);
  assert.equal(
    client.rows.has("ascencio-assets/v1/content/latest.json"),
    false,
  );
});

test("publisher refuses live pointer path until semantic validation is supplied", async () => {
  const { root, first } = await candidates();
  await assert.rejects(
    publishProgressiveRelease(root, first.run, transport(new FakeS3Client()), {
      semanticValidated: false,
    }),
    /PUBLISH_SEMANTIC_VALIDATION_REQUIRED/,
  );
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
    publishProgressiveRelease(root, first.run, transport(client), {
      semanticValidated: true,
    }),
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
