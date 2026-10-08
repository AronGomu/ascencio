import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
  link,
  rename,
} from "node:fs/promises";
import path from "node:path";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { StorageResult } from "../../../src/storage/contracts/package.ts";

const CHUNK_BYTES = 1024 * 1024;
const PLAN_PATH = "generated/content-packages/asset-move-plan.json";
const RECEIPT_PATH = "generated/content-packages/asset-move-receipt.json";
const PENDING_PATH = "generated/content-packages/asset-move-pending.json";

export interface AssetMoveFile {
  readonly source: string;
  readonly destination: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly ownership:
    | "app"
    | "duel-core"
    | "card-library"
    | "freeplay"
    | "chapter-01"
    | "acquisition"
    | "derived";
}
export interface AssetRetainedFile {
  readonly path: string;
  readonly reason: string;
}
export interface AssetMovePlan {
  readonly schemaVersion: 1;
  readonly files: readonly AssetMoveFile[];
  readonly retained: readonly AssetRetainedFile[];
  readonly unknown: readonly string[];
}
export interface AssetMoveReceipt extends AssetMovePlan {
  readonly completedAt: string;
  readonly planSha256?: string;
  readonly reverse: readonly {
    readonly source: string;
    readonly destination: string;
    readonly sha256: string;
  }[];
}

const ROOT_MAPPINGS = [
  ["src/assets/fonts", "assets/app/fonts", "app"],
  [
    "assets/shared/data/current/catalog",
    "assets/content/card-library/data/catalog",
    "card-library",
  ],
  [
    "assets/shared/data/current/scripts",
    "assets/content/card-library/data/scripts",
    "card-library",
  ],
  [
    "assets/shared/data/current/images",
    "assets/content/card-library/data/images",
    "card-library",
  ],
  [
    "assets/shared/data/current/strings",
    "content/duel-core/strings",
    "duel-core",
  ],
  [
    "assets/shared/card-images/full",
    "assets/content/card-library/images/full",
    "card-library",
  ],
  [
    "assets/shared/card-images/cropped",
    "assets/content/card-library/images/cropped",
    "card-library",
  ],
  [
    "assets/shared/set-images",
    "assets/content/card-library/images/sets",
    "card-library",
  ],
  ["assets/story/chapter-01", "assets/content/chapter-01/media", "chapter-01"],
  [
    "assets/battle/engine/current",
    "generated/acquisition/engine/current",
    "acquisition",
  ],
] as const;
const FILE_MAPPINGS = new Map<
  string,
  readonly [string, AssetMoveFile["ownership"]]
>([
  ["assets/core/app-icon.svg", ["assets/app/app-icon.svg", "app"]],
  [
    "assets/shared/card-back.jpg",
    ["assets/content/card-library/images/card-back.jpg", "card-library"],
  ],
  [
    "assets/shared/data/current/manifest.json",
    ["generated/content-inputs/data/manifest.json", "derived"],
  ],
  [
    "assets/shared/data/current/manifest.sha256",
    ["generated/content-inputs/data/manifest.sha256", "derived"],
  ],
  [
    "assets/shared/runtime/current/manifest.json",
    ["generated/content-inputs/runtime/manifest.json", "derived"],
  ],
  [
    "content/authoring/card-set-source.json",
    [
      "assets/content/card-library/authoring/card-set-source.json",
      "card-library",
    ],
  ],
  [
    "content/authoring/ygoprodeck-cardsets-2026-09-12.json",
    [
      "assets/content/card-library/authoring/ygoprodeck-cardsets-2026-09-12.json",
      "card-library",
    ],
  ],
  [
    "content/authoring/chapter-one-gameplay.json",
    [
      "assets/content/chapter-01/authoring/chapter-one-gameplay.json",
      "chapter-01",
    ],
  ],
  [
    "content/authoring/chapter-one-story.json",
    [
      "assets/content/chapter-01/authoring/chapter-one-story.json",
      "chapter-01",
    ],
  ],
  [
    "content/authoring/chapter-one-corrections.json",
    [
      "assets/content/chapter-01/authoring/chapter-one-corrections.json",
      "chapter-01",
    ],
  ],
  [
    "content/authoring/chapter-one-set-media.json",
    [
      "assets/content/chapter-01/authoring/chapter-one-set-media.json",
      "chapter-01",
    ],
  ],
  [
    "content/authoring/chapter-policy.json",
    ["assets/content/chapter-01/authoring/chapter-policy.json", "chapter-01"],
  ],
  [
    "content/authoring/release-date-evidence.json",
    [
      "assets/content/chapter-01/authoring/release-date-evidence.json",
      "chapter-01",
    ],
  ],
  [
    "content/authoring/superseded-six-era-mapping.json",
    [
      "assets/content/chapter-01/authoring/superseded-six-era-mapping.json",
      "chapter-01",
    ],
  ],
  [
    "content/chapter-selections.json",
    [
      "assets/content/chapter-01/authoring/chapter-selections.json",
      "chapter-01",
    ],
  ],
  [
    "public/story/shop-sets.v1.json",
    ["assets/content/card-library/authoring/shop-sets.v1.json", "card-library"],
  ],
  ["content/core-bootstrap.json", ["assets/app/content-bootstrap.json", "app"]],
  [
    "src/battle/duel/presets/decks/player.ydk",
    ["content/freeplay/decks/player.ydk", "freeplay"],
  ],
  [
    "src/battle/duel/presets/decks/opponent.ydk",
    ["content/freeplay/decks/opponent.ydk", "freeplay"],
  ],
  [
    "src/battle/duel/presets/decks/chapter-one-starter.ydk",
    ["assets/content/chapter-01/decks/chapter-one-starter.ydk", "chapter-01"],
  ],
  [
    "src/battle/duel/presets/decks/chapter-one-practice.ydk",
    ["assets/content/chapter-01/decks/chapter-one-practice.ydk", "chapter-01"],
  ],
]);
const RETAINED = new Map<string, string>([
  ["content/README.md", "governance documentation"],
  ["content/packages.json", "package build recipe"],
  ["content/duel-core/config.json", "tracked duel-core configuration"],
  ["content/duel-core/strings/en.json", "tracked duel-core strings"],
  ["content/freeplay/config.json", "tracked Free Play configuration"],
  ["content/freeplay/decks.json", "tracked Free Play decks"],
  ["content/freeplay/decks/player.ydk", "tracked Free Play deck source"],
  ["content/freeplay/decks/opponent.ydk", "tracked Free Play deck source"],
  ["content/freeplay/opponents.json", "tracked Free Play opponents"],
  ["content/freeplay/limits.json", "tracked Free Play limits"],
  ["content/distribution-evidence.json", "release governance evidence"],
  ["content/setup-evidence.json", "release governance evidence"],
  ["src/battle/duel/presets/decks/burning-abyss.ydk", "unused legacy preset"],
  ["src/battle/duel/presets/decks/nekroz.ydk", "unused legacy preset"],
  ["src/battle/duel/presets/decks/shaddoll.ydk", "unused legacy preset"],
  ["src/battle/duel/presets/decks/spellbook.ydk", "unused legacy preset"],
]);
const INVENTORY_ROOTS = [
  "assets/core",
  "src/assets/fonts",
  "assets/shared",
  "assets/story",
  "assets/battle/engine/current",
  "content",
  "public/story",
  "src/battle/duel/presets/decks",
] as const;

export async function planAssetRestructure(
  root: string,
): Promise<StorageResult<AssetMovePlan>> {
  try {
    const sources = new Set<string>();
    for (const inventoryRoot of INVENTORY_ROOTS)
      for (const file of await regularFiles(root, inventoryRoot))
        sources.add(file);
    const files: AssetMoveFile[] = [];
    const retained: AssetRetainedFile[] = [];
    const unknown: string[] = [];
    for (const source of [...sources].sort(compare)) {
      const mapping = destinationFor(source);
      if (mapping) {
        const absolute = safe(root, source);
        const info = await stat(absolute);
        files.push({
          source,
          destination: mapping[0],
          bytes: info.size,
          sha256: await hashFile(absolute),
          ownership: mapping[1],
        });
      } else if (RETAINED.has(source))
        retained.push({ path: source, reason: RETAINED.get(source)! });
      else unknown.push(source);
    }
    const destinations = new Set<string>();
    for (const file of files) {
      const folded = file.destination
        .normalize("NFC")
        .toLocaleLowerCase("en-US");
      if (destinations.has(folded))
        return {
          kind: "failed",
          error: { code: "PACKAGE_IDENTITY_CONFLICT", path: file.destination },
        };
      destinations.add(folded);
    }
    const plan: AssetMovePlan = { schemaVersion: 1, files, retained, unknown };
    return { kind: "ok", value: plan };
  } catch {
    return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
  }
}

export async function writeAssetRestructurePlan(
  root: string,
  plan: AssetMovePlan,
): Promise<void> {
  await atomicJson(root, PLAN_PATH, plan);
}

export async function applyAssetRestructure(
  root: string,
  plan: AssetMovePlan,
): Promise<StorageResult<AssetMoveReceipt>> {
  if (!validPlan(plan))
    return { kind: "failed", error: { code: "PACKAGE_INVALID" } };
  if (plan.unknown.length > 0)
    return {
      kind: "failed",
      error: { code: "PACKAGE_SOURCE_INCOMPLETE", path: plan.unknown[0]! },
    };
  const planDigest = hashBytes(new TextEncoder().encode(JSON.stringify(plan)));
  try {
    let completedState = await readState(root, RECEIPT_PATH);
    const completed = completedState
      ? completedFiles(completedState.value, plan, planDigest)
      : [];
    const pendingState = await readState(root, PENDING_PATH);
    const pending = pendingState
      ? parsePending(pendingState.value, plan, planDigest)
      : null;
    if (pending) {
      const index = plan.files.findIndex(
        (file) => file.destination === pending.destination,
      );
      if (index !== completed.length && index !== completed.length - 1)
        throw new Error("pending copy out of order");
    }
    for (const file of plan.files) {
      const source = safe(root, file.source);
      await assertNoSymlinkParents(root, file.source);
      await assertNoSymlinkParents(root, file.destination);
      const info = await lstat(source);
      if (
        !info.isFile() ||
        info.size !== file.bytes ||
        (await hashFile(source)) !== file.sha256
      )
        return {
          kind: "failed",
          error: { code: "PACKAGE_INTEGRITY_FAILED", path: file.source },
        };
      const existing = await existingHash(safe(root, file.destination));
      const owned =
        completed.some((done) => done.destination === file.destination) ||
        pending?.destination === file.destination;
      if (existing !== null && (existing !== file.sha256 || !owned))
        return {
          kind: "failed",
          error: { code: "PACKAGE_IDENTITY_CONFLICT", path: file.destination },
        };
      if (
        completed.some((done) => done.destination === file.destination) &&
        existing === null
      )
        throw new Error("completed destination missing");
    }
    if (pending && pendingState) {
      await checkPendingFiles(root, pending, completed);
      const file = plan.files.find(
        (entry) => entry.destination === pending.destination,
      )!;
      if (!completed.some((done) => done.destination === file.destination)) {
        await finishCopy(root, file, pending);
        completed.push(file);
        await writeState(
          root,
          RECEIPT_PATH,
          receipt(plan, completed),
          completedState,
        );
        completedState = await readState(root, RECEIPT_PATH);
      }
      await clearPending(root, pending, pendingState, completed);
    }
    for (const file of plan.files.slice(completed.length)) {
      const owned = await beginCopy(root, planDigest, file);
      await finishCopy(root, file, owned.pending);
      completed.push(file);
      await writeState(
        root,
        RECEIPT_PATH,
        receipt(plan, completed),
        completedState,
      );
      completedState = await readState(root, RECEIPT_PATH);
      await clearPending(root, owned.pending, owned.state, completed);
    }
    if (!completedState) {
      await writeState(root, RECEIPT_PATH, receipt(plan, completed), null);
      completedState = await readState(root, RECEIPT_PATH);
    }
    return { kind: "ok", value: completedState!.value as AssetMoveReceipt };
  } catch {
    return { kind: "failed", error: { code: "STORAGE_UNAVAILABLE" } };
  }
}

interface FileIdentity {
  readonly dev: string;
  readonly ino: string;
  readonly uid: number;
}
interface PendingCopy extends FileIdentity {
  readonly schemaVersion: 2;
  readonly planSha256: string;
  readonly source: string;
  readonly destination: string;
  readonly temp: string;
  readonly sha256: string;
}
interface JsonState extends FileIdentity {
  readonly value: unknown;
  readonly digest: string;
}
function identity(info: Awaited<ReturnType<typeof lstat>>): FileIdentity {
  return {
    dev: String(info.dev),
    ino: String(info.ino),
    uid: Number(info.uid),
  };
}
function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return (
    left.dev === right.dev && left.ino === right.ino && left.uid === right.uid
  );
}
async function readState(
  root: string,
  relative: string,
): Promise<JsonState | null> {
  await assertNoSymlinkParents(root, relative);
  const file = safe(root, relative);
  try {
    const info = await lstat(file);
    if (
      !info.isFile() ||
      (process.getuid !== undefined && info.uid !== process.getuid()) ||
      (process.platform !== "win32" && (info.mode & 0o077) !== 0)
    )
      throw new Error("unowned receipt");
    const bytes = await readFile(file);
    return {
      ...identity(info),
      value: JSON.parse(bytes.toString()) as unknown,
      digest: hashBytes(bytes),
    };
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
async function assertState(
  root: string,
  relative: string,
  expected: JsonState | null,
): Promise<void> {
  const current = await readState(root, relative);
  if (
    expected === null
      ? current !== null
      : current === null ||
        !sameIdentity(current, expected) ||
        current.digest !== expected.digest
  )
    throw new Error("receipt changed");
}
async function writeState(
  root: string,
  relative: string,
  value: unknown,
  expected: JsonState | null,
): Promise<void> {
  await assertState(root, relative, expected);
  const target = safe(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await assertState(root, relative, expected);
  if (expected) await rename(temp, target);
  else {
    await link(temp, target);
    await unlink(temp);
  }
}
function completedFiles(
  value: unknown,
  plan: AssetMovePlan,
  digest: string,
): AssetMoveFile[] {
  if (
    !record(value) ||
    !validPlan({
      schemaVersion: value.schemaVersion,
      files: value.files,
      retained: value.retained,
      unknown: value.unknown,
    }) ||
    !keys(value, [
      "schemaVersion",
      "files",
      "retained",
      "unknown",
      "completedAt",
      "reverse",
      ...(Object.hasOwn(value, "planSha256") ? ["planSha256"] : []),
    ]) ||
    typeof value.completedAt !== "string" ||
    new Date(value.completedAt).toISOString() !== value.completedAt ||
    JSON.stringify(value.retained) !== JSON.stringify(plan.retained) ||
    JSON.stringify(value.unknown) !== JSON.stringify(plan.unknown)
  )
    throw new Error("invalid completed receipt");
  const files = value.files as AssetMoveFile[];
  if (
    files.length > plan.files.length ||
    files.some((file, index) => !sameFile(file, plan.files[index]!)) ||
    (Object.hasOwn(value, "planSha256")
      ? value.planSha256 !== digest
      : files.length !== plan.files.length) ||
    JSON.stringify(value.reverse) !==
      JSON.stringify(receipt(plan, files).reverse)
  )
    throw new Error("receipt plan mismatch");
  return [...files];
}
function sameFile(left: AssetMoveFile, right: AssetMoveFile): boolean {
  return (
    left.source === right.source &&
    left.destination === right.destination &&
    left.sha256 === right.sha256 &&
    left.bytes === right.bytes &&
    left.ownership === right.ownership
  );
}
function parsePending(
  value: unknown,
  plan: AssetMovePlan,
  digest: string,
): PendingCopy {
  if (
    !record(value) ||
    !keys(value, [
      "schemaVersion",
      "planSha256",
      "source",
      "destination",
      "temp",
      "sha256",
      "dev",
      "ino",
      "uid",
    ]) ||
    value.schemaVersion !== 2 ||
    value.planSha256 !== digest ||
    !validRelative(value.temp) ||
    typeof value.dev !== "string" ||
    !/^[0-9]+$/.test(value.dev) ||
    typeof value.ino !== "string" ||
    !/^[1-9][0-9]*$/.test(value.ino) ||
    (process.getuid !== undefined && value.uid !== process.getuid())
  )
    throw new Error("invalid pending receipt");
  const file = plan.files.find((entry) => entry.source === value.source);
  if (
    !file ||
    value.destination !== file.destination ||
    value.sha256 !== file.sha256 ||
    !value.temp.startsWith(`${file.destination}.asset-copy-`) ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value.temp.slice(`${file.destination}.asset-copy-`.length),
    )
  )
    throw new Error("pending mapping mismatch");
  return value as unknown as PendingCopy;
}
async function pendingInfo(
  root: string,
  relative: string,
  pending: PendingCopy,
) {
  await assertNoSymlinkParents(root, relative);
  try {
    const info = await lstat(safe(root, relative));
    if (
      !info.isFile() ||
      !sameIdentity(identity(info), pending) ||
      (process.platform !== "win32" && (info.mode & 0o077) !== 0)
    )
      throw new Error("copy ownership mismatch");
    return info;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
async function checkPendingFiles(
  root: string,
  pending: PendingCopy,
  completed: readonly AssetMoveFile[],
): Promise<void> {
  await assertNoSymlinkParents(root, pending.source);
  const temp = await pendingInfo(root, pending.temp, pending);
  const destination = await pendingInfo(root, pending.destination, pending);
  const done = completed.some(
    (file) => file.destination === pending.destination,
  );
  if (
    (!temp && !done) ||
    (done && !destination) ||
    (temp && temp.nlink !== (destination ? 2 : 1)) ||
    (destination &&
      (destination.nlink !== (temp ? 2 : 1) ||
        (await hashFile(safe(root, pending.destination))) !== pending.sha256))
  )
    throw new Error("pending ownership mismatch");
  if (temp) {
    const source = await open(safe(root, pending.source), "r");
    const partial = await open(safe(root, pending.temp), "r");
    try {
      const expected = new Uint8Array(CHUNK_BYTES);
      const actual = new Uint8Array(CHUNK_BYTES);
      let position = 0;
      while (position < temp.size) {
        const length = Math.min(CHUNK_BYTES, temp.size - position);
        const a = await source.read(expected, 0, length, position);
        const b = await partial.read(actual, 0, length, position);
        if (
          a.bytesRead !== length ||
          b.bytesRead !== length ||
          hashBytes(expected.subarray(0, length)) !==
            hashBytes(actual.subarray(0, length))
        )
          throw new Error("partial copy mismatch");
        position += length;
      }
    } finally {
      await source.close();
      await partial.close();
    }
  }
}
async function beginCopy(
  root: string,
  planSha256: string,
  file: AssetMoveFile,
): Promise<{ pending: PendingCopy; state: JsonState }> {
  await assertState(root, PENDING_PATH, null);
  await assertNoSymlinkParents(root, file.destination);
  await mkdir(path.dirname(safe(root, file.destination)), { recursive: true });
  const temp = `${file.destination}.asset-copy-${randomUUID()}`;
  const handle = await open(safe(root, temp), "wx", 0o600);
  let pending: PendingCopy;
  try {
    pending = {
      schemaVersion: 2,
      planSha256,
      source: file.source,
      destination: file.destination,
      temp,
      sha256: file.sha256,
      ...identity(await handle.stat()),
    };
    await writeState(root, PENDING_PATH, pending, null);
  } finally {
    await handle.close();
  }
  return { pending, state: (await readState(root, PENDING_PATH))! };
}
async function finishCopy(
  root: string,
  file: AssetMoveFile,
  pending: PendingCopy,
): Promise<void> {
  await checkPendingFiles(root, pending, []);
  const info = (await pendingInfo(root, pending.temp, pending))!;
  if (info.size > file.bytes) throw new Error("copy size mismatch");
  const sourceHandle = await open(safe(root, file.source), "r");
  const tempHandle = await open(safe(root, pending.temp), "r+");
  try {
    if (!sameIdentity(identity(await tempHandle.stat()), pending))
      throw new Error("copy ownership changed");
    const buffer = new Uint8Array(CHUNK_BYTES);
    let position = info.size;
    while (true) {
      const { bytesRead } = await sourceHandle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) break;
      let written = 0;
      while (written < bytesRead) {
        const result = await tempHandle.write(
          buffer,
          written,
          bytesRead - written,
          position + written,
        );
        if (result.bytesWritten === 0) throw new Error("zero-progress write");
        written += result.bytesWritten;
      }
      position += bytesRead;
    }
    await tempHandle.sync();
    if (position !== file.bytes) throw new Error("copy size mismatch");
  } finally {
    await sourceHandle.close();
    await tempHandle.close();
  }
  await pendingInfo(root, pending.temp, pending);
  if ((await hashFile(safe(root, pending.temp))) !== file.sha256)
    throw new Error("copy digest mismatch");
  if (!(await pendingInfo(root, file.destination, pending)))
    await link(safe(root, pending.temp), safe(root, file.destination));
}
async function clearPending(
  root: string,
  pending: PendingCopy,
  state: JsonState,
  completed: readonly AssetMoveFile[],
): Promise<void> {
  await assertState(root, PENDING_PATH, state);
  await checkPendingFiles(root, pending, completed);
  if (await pendingInfo(root, pending.temp, pending))
    await unlink(safe(root, pending.temp));
  await assertState(root, PENDING_PATH, state);
  await unlink(safe(root, PENDING_PATH));
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  return Object.keys(value).sort().join() === [...expected].sort().join();
}

function receipt(
  plan: AssetMovePlan,
  files: readonly AssetMoveFile[],
): AssetMoveReceipt {
  return {
    ...plan,
    planSha256: hashBytes(new TextEncoder().encode(JSON.stringify(plan))),
    files: [...files],
    completedAt: new Date().toISOString(),
    reverse: files.map((file) => ({
      source: file.destination,
      destination: file.source,
      sha256: file.sha256,
    })),
  };
}
function destinationFor(
  source: string,
): readonly [string, AssetMoveFile["ownership"]] | null {
  const direct = FILE_MAPPINGS.get(source);
  if (direct) return direct;
  for (const [from, to, owner] of ROOT_MAPPINGS)
    if (source.startsWith(`${from}/`))
      return [`${to}${source.slice(from.length)}`, owner];
  return null;
}
async function regularFiles(root: string, relative: string): Promise<string[]> {
  const absolute = safe(root, relative);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error("symbolic link rejected");
    if (entry.isDirectory()) files.push(...(await regularFiles(root, child)));
    else if (entry.isFile()) files.push(child);
    else throw new Error("special file rejected");
  }
  return files;
}
export async function hashFile(file: string): Promise<string> {
  const digest = sha256.create();
  const handle = await open(file, "r");
  try {
    const buffer = new Uint8Array(CHUNK_BYTES);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        buffer.length,
        position,
      );
      if (bytesRead === 0) break;
      digest.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return bytesToHex(digest.digest());
}
function hashBytes(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}
async function existingHash(file: string): Promise<string | null> {
  try {
    const info = await lstat(file);
    return info.isFile() && !info.isSymbolicLink()
      ? await hashFile(file)
      : "conflict";
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}
async function atomicJson(
  root: string,
  relative: string,
  value: unknown,
): Promise<void> {
  const target = safe(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  await rename(temp, target);
}
function safe(root: string, relative: string): string {
  if (
    path.isAbsolute(relative) ||
    relative.includes("\\") ||
    relative
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    throw new Error("unsafe path");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`))
    throw new Error("unsafe path");
  return resolved;
}
function validPlan(value: unknown): value is AssetMovePlan {
  if (
    !record(value) ||
    !keys(value, ["schemaVersion", "files", "retained", "unknown"]) ||
    (value as unknown as AssetMovePlan).schemaVersion !== 1 ||
    !Array.isArray((value as unknown as AssetMovePlan).files) ||
    !Array.isArray((value as unknown as AssetMovePlan).retained) ||
    !Array.isArray((value as unknown as AssetMovePlan).unknown)
  )
    return false;
  const destinations = new Set<string>();
  for (const file of (value as unknown as AssetMovePlan).files) {
    if (
      !record(file) ||
      !keys(file, ["source", "destination", "bytes", "sha256", "ownership"]) ||
      !validRelative(file.source) ||
      !validRelative(file.destination) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256) ||
      ![
        "app",
        "duel-core",
        "card-library",
        "freeplay",
        "chapter-01",
        "acquisition",
        "derived",
      ].includes(file.ownership)
    )
      return false;
    const mapping = destinationFor(file.source);
    if (
      !mapping ||
      mapping[0] !== file.destination ||
      mapping[1] !== file.ownership
    )
      return false;
    const folded = file.destination.normalize("NFC").toLocaleLowerCase("en-US");
    if (destinations.has(folded)) return false;
    destinations.add(folded);
  }
  return (
    (value as unknown as AssetMovePlan).unknown.every(validRelative) &&
    (value as unknown as AssetMovePlan).retained.every(
      (entry) =>
        record(entry) &&
        keys(entry, ["path", "reason"]) &&
        validRelative(entry.path) &&
        typeof entry.reason === "string",
    )
  );
}
export async function assertNoSymlinkParents(
  root: string,
  relative: string,
): Promise<void> {
  const parts = relative.split("/");
  let current = path.resolve(root);
  const rootInfo = await lstat(current);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error("unsafe root");
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) throw new Error("symbolic link rejected");
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
  }
}
function validRelative(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}
function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
