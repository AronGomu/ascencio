import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  parseLatestContentPointer,
  parseProgressiveManifest,
  type LatestContentPointer,
} from "../../../src/content/index.ts";
import { canonicalBytes, parseJsonBytes } from "./canonical-json.ts";
import { assertSafeParents } from "./path-guards.ts";
import { progressiveFail, ProgressiveError } from "./progressive-error.ts";
import {
  verifyProgressiveRelease,
  type ProgressiveReleaseCandidate,
} from "./progressive-producer.ts";

interface S3Sender {
  send(command: object): Promise<Record<string, unknown>>;
}

export interface RemoteObject {
  readonly bytes: Uint8Array;
  readonly etag: string;
}

export interface ProgressiveTransport {
  get(key: string, maxBytes?: number): Promise<RemoteObject | null>;
  head(
    key: string,
  ): Promise<{ readonly etag: string; readonly bytes: number } | null>;
  putIfAbsent(key: string, bytes: Uint8Array): Promise<"created" | "exists">;
  putPointer(
    key: string,
    bytes: Uint8Array,
    etag: string | null,
  ): Promise<"written" | "conflict">;
}

function status(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const metadata = "$metadata" in error ? error.$metadata : undefined;
  return metadata &&
    typeof metadata === "object" &&
    "httpStatusCode" in metadata
    ? (metadata.httpStatusCode as number)
    : undefined;
}

function missing(error: unknown): boolean {
  return (
    status(error) === 404 ||
    (!!error &&
      typeof error === "object" &&
      "name" in error &&
      ["NotFound", "NoSuchKey"].includes(String(error.name)))
  );
}

function precondition(error: unknown): boolean {
  return (
    status(error) === 412 ||
    (!!error &&
      typeof error === "object" &&
      "name" in error &&
      String(error.name) === "PreconditionFailed")
  );
}

export class S3ProgressiveTransport implements ProgressiveTransport {
  private readonly client: S3Sender;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(client: S3Sender, bucket: string, keyPrefix: string) {
    this.client = client;
    this.bucket = bucket;
    this.keyPrefix = keyPrefix;
  }

  private key(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(
    key: string,
    maxBytes = 256 * 1024 * 1024,
  ): Promise<RemoteObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
      );
      const body = response.Body as
        { transformToByteArray(): Promise<Uint8Array> } | undefined;
      if (
        !body ||
        typeof response.ETag !== "string" ||
        typeof response.ContentLength !== "number" ||
        response.ContentLength < 0 ||
        response.ContentLength > maxBytes
      )
        throw new Error("invalid get response");
      const bytes = new Uint8Array(await body.transformToByteArray());
      if (bytes.length !== response.ContentLength || bytes.length > maxBytes)
        throw new Error("invalid get response");
      return { bytes, etag: response.ETag };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }

  async putIfAbsent(
    key: string,
    bytes: Uint8Array,
  ): Promise<"created" | "exists"> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.key(key),
          Body: bytes,
          ContentLength: bytes.length,
          IfNoneMatch: "*",
        }),
      );
      return "created";
    } catch (error) {
      if (precondition(error)) return "exists";
      throw error;
    }
  }

  async putPointer(
    key: string,
    bytes: Uint8Array,
    etag: string | null,
  ): Promise<"written" | "conflict"> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.key(key),
          Body: bytes,
          ContentLength: bytes.length,
          ...(etag === null ? { IfNoneMatch: "*" } : { IfMatch: etag }),
        }),
      );
      return "written";
    } catch (error) {
      if (precondition(error)) return "conflict";
      throw error;
    }
  }

  async head(key: string): Promise<{ etag: string; bytes: number } | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
      );
      if (
        typeof response.ETag !== "string" ||
        typeof response.ContentLength !== "number"
      )
        throw new Error("invalid head response");
      return { etag: response.ETag, bytes: response.ContentLength };
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
  }
}

async function network<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ProgressiveError) throw error;
      if (attempt === 2) progressiveFail("PUBLISH_NETWORK_FAILED");
    }
  }
  progressiveFail("PUBLISH_NETWORK_FAILED");
}

const sha = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

function parseRemotePointer(object: RemoteObject): LatestContentPointer {
  try {
    const value = parseLatestContentPointer(parseJsonBytes(object.bytes));
    if (!Buffer.from(canonicalBytes(value)).equals(Buffer.from(object.bytes)))
      progressiveFail("PUBLISH_CONFLICT");
    return value;
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("PUBLISH_CONFLICT");
  }
}

async function verifyRemoteManifest(
  transport: ProgressiveTransport,
  pointer: LatestContentPointer,
): Promise<void> {
  const key = `content/manifests/${pointer.manifest.version}.json`;
  const object = await network(() => transport.get(key, 32 * 1024 * 1024));
  if (
    !object ||
    object.bytes.length !== pointer.manifest.bytes ||
    sha(object.bytes) !== pointer.manifest.version
  )
    progressiveFail("PUBLISH_CONFLICT");
  try {
    const manifest = parseProgressiveManifest(parseJsonBytes(object.bytes));
    if (
      manifest.releaseSequence !== pointer.releaseSequence ||
      !Buffer.from(canonicalBytes(manifest)).equals(Buffer.from(object.bytes))
    )
      progressiveFail("PUBLISH_CONFLICT");
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("PUBLISH_CONFLICT");
  }
}

async function verifyImmutable(
  transport: ProgressiveTransport,
  key: string,
  bytes: Uint8Array,
): Promise<boolean> {
  const metadata = await network(() => transport.head(key));
  if (!metadata) return false;
  if (metadata.bytes !== bytes.length)
    progressiveFail("PUBLISH_IMMUTABLE_CONFLICT");
  const existing = await network(() => transport.get(key, bytes.length));
  if (
    !existing ||
    existing.bytes.length !== bytes.length ||
    sha(existing.bytes) !== sha(bytes) ||
    !Buffer.from(existing.bytes).equals(Buffer.from(bytes))
  )
    progressiveFail("PUBLISH_IMMUTABLE_CONFLICT");
  return true;
}

async function putImmutable(
  transport: ProgressiveTransport,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  const result = await network(() => transport.putIfAbsent(key, bytes));
  if (result === "created") return;
  if (!(await verifyImmutable(transport, key, bytes)))
    progressiveFail("PUBLISH_IMMUTABLE_CONFLICT");
}

async function ensureImmutable(
  transport: ProgressiveTransport,
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!(await verifyImmutable(transport, key, bytes)))
    await putImmutable(transport, key, bytes);
}

async function candidateFileBytes(
  root: string,
  run: string,
  file: ProgressiveReleaseCandidate["manifest"]["files"][number],
): Promise<Uint8Array> {
  const key = `content/files/${file.version}/${file.path}`;
  const bytes = new Uint8Array(
    await readFile(
      await assertSafeParents(root, `${run}/progressive/objects/${key}`),
    ),
  );
  if (bytes.length !== file.bytes || sha(bytes) !== file.version)
    progressiveFail("CONTENT_INVALID_MANIFEST");
  return bytes;
}

export async function publishProgressiveRelease(
  root: string,
  run: string,
  transport: ProgressiveTransport,
  expected?: Pick<
    ProgressiveReleaseCandidate,
    "manifestVersion" | "pointerVersion" | "inventoryVersion" | "candidate"
  >,
): Promise<{
  readonly status: "published" | "idempotent";
  readonly manifestVersion: string;
}> {
  const candidate = await verifyProgressiveRelease(root, run, true);
  if (
    expected &&
    (candidate.manifestVersion !== expected.manifestVersion ||
      candidate.pointerVersion !== expected.pointerVersion ||
      candidate.inventoryVersion !== expected.inventoryVersion ||
      candidate.candidate.previousManifestVersion !==
        expected.candidate.previousManifestVersion)
  )
    progressiveFail("CONTENT_INVALID_MANIFEST");
  const latestObject = await network(() =>
    transport.get("content/latest.json", 32 * 1024 * 1024),
  );
  const latest =
    latestObject === null ? null : parseRemotePointer(latestObject);
  if (
    latest &&
    latest.releaseSequence === candidate.pointer.releaseSequence &&
    latest.manifest.version === candidate.manifestVersion &&
    latest.manifest.bytes === candidate.manifestBytes.length
  ) {
    for (const file of candidate.manifest.files) {
      const key = `content/files/${file.version}/${file.path}`;
      await ensureImmutable(
        transport,
        key,
        await candidateFileBytes(root, run, file),
      );
    }
    await ensureImmutable(
      transport,
      `content/manifests/${candidate.manifestVersion}.json`,
      candidate.manifestBytes,
    );
    await verifyRemoteManifest(transport, latest);
    return { status: "idempotent", manifestVersion: candidate.manifestVersion };
  }
  if (
    candidate.candidate.previousManifestVersion !==
      (latest?.manifest.version ?? null) ||
    (latest !== null &&
      candidate.manifest.releaseSequence <= latest.releaseSequence) ||
    (latest === null && candidate.manifest.releaseSequence !== 1)
  )
    progressiveFail("PUBLISH_CONFLICT");
  if (latest) await verifyRemoteManifest(transport, latest);

  for (const file of candidate.manifest.files) {
    const key = `content/files/${file.version}/${file.path}`;
    await putImmutable(
      transport,
      key,
      await candidateFileBytes(root, run, file),
    );
  }
  const manifestKey = `content/manifests/${candidate.manifestVersion}.json`;
  await putImmutable(transport, manifestKey, candidate.manifestBytes);
  const result = await network(async () => {
    const verified = await verifyProgressiveRelease(root, run, true);
    if (
      verified.inventoryVersion !== candidate.inventoryVersion ||
      verified.manifestVersion !== candidate.manifestVersion ||
      verified.pointerVersion !== candidate.pointerVersion ||
      verified.candidate.previousManifestVersion !==
        candidate.candidate.previousManifestVersion
    )
      progressiveFail("CONTENT_INVALID_MANIFEST");
    return transport.putPointer(
      "content/latest.json",
      candidate.pointerBytes,
      latestObject?.etag ?? null,
    );
  });
  if (result === "conflict") progressiveFail("PUBLISH_CONFLICT");
  return { status: "published", manifestVersion: candidate.manifestVersion };
}
