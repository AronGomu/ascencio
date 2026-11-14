/** Experimental Node writer allowances, backed by one validated parent quota lease. */
import {
  readFile,
  mkdir,
  readdir,
  lstat,
  stat,
  open,
  rename,
  link,
  unlink,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { writeOutput } from "./output-storage.ts";
export interface ReplayWriteGrant {
  root: string;
  token: string;
  evaluation: string;
  output: string;
  workers: number;
  worker?: number;
}
interface Scope {
  root: string;
  used: number;
  limit: number;
  skip?: string;
  reserve?: number;
}
const scopes = new Map<string, Scope>();
async function usage(root: string, skip?: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (file === skip) continue;
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw Error("Symlink replay output");
    total += info.isDirectory() ? await usage(file, skip) : info.size;
  }
  return total;
}
export function replayWorkerRoot(grant: ReplayWriteGrant, worker: number) {
  return path.join(
    grant.output,
    "payload",
    "workers",
    `worker-${String(worker).padStart(4, "0")}`,
  );
}
export async function installReplayWriteGrant(grant: ReplayWriteGrant) {
  const lease = JSON.parse(
    await readFile(path.join(grant.root, ".batch-output-lease.json"), "utf8"),
  );
  const evaluation = path.resolve(grant.root, lease.evaluation),
    output = path.resolve(grant.output);
  if (
    !lease.active ||
    lease.token !== grant.token ||
    evaluation !== path.resolve(grant.evaluation) ||
    ![output, path.join(output, "payload")].includes(evaluation) ||
    !Number.isSafeInteger(grant.workers) ||
    grant.workers < 1 ||
    !Number.isSafeInteger(lease.maxBytes) ||
    lease.maxBytes <= 16_000_000
  )
    throw Error("Invalid replay writer lease");
  if (
    grant.worker !== undefined &&
    (!Number.isInteger(grant.worker) ||
      grant.worker < 1 ||
      grant.worker > grant.workers)
  )
    throw Error("Invalid replay worker scope");
  const root =
    grant.worker === undefined
      ? evaluation
      : replayWorkerRoot(grant, grant.worker);
  const skip =
    grant.worker === undefined
      ? path.join(output, "payload", "workers")
      : undefined;
  const limit =
    grant.worker === undefined
      ? 16_000_000
      : Math.floor((lease.maxBytes - 16_000_000) / grant.workers);
  await mkdir(root, { recursive: true });
  const used = await usage(root, skip);
  if (used > limit)
    throw Error("max-output-bytes: replay worker allowance exhausted");
  scopes.set(root, { root, used, limit, ...(skip ? { skip } : {}) });
}
export async function refreshReplayWorker(
  grant: ReplayWriteGrant,
  worker: number,
) {
  await installReplayWriteGrant({ ...grant, worker });
}
/** Single-owner native match coordinator, after acquiring its parent storage lease. */
export async function installLocalOutputAllowance(root: string, limit: number) {
  root = path.resolve(root);
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw Error("Invalid local output allowance");
  await mkdir(root, { recursive: true });
  const used = await usage(root);
  if (used > limit)
    throw Error("max-output-bytes: existing evidence exceeds allowance");
  scopes.set(root, {
    root,
    used,
    limit,
    reserve: Math.min(16_000_000, Math.floor(limit / 2)),
  });
}
export function clearReplayWriteGrants() {
  scopes.clear();
}
export async function replayWriteOutput(
  file: string,
  bytes: string | Uint8Array,
  exclusive = false,
): Promise<void> {
  file = path.resolve(file);
  let cursor = path.dirname(file),
    scope: Scope | undefined;
  for (;;) {
    scope = scopes.get(cursor);
    if (scope) break;
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (!scope) return writeOutput(file, bytes, exclusive);
  if (
    scope.skip &&
    (file === scope.skip || file.startsWith(scope.skip + path.sep))
  )
    throw Error("Missing replay worker allowance");
  const size =
    typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength;
  const old = await stat(file).then(
    (s) => s.size,
    (e) => {
      if (e.code === "ENOENT") return 0;
      throw e;
    },
  );
  const isControl =
    /^(journal|matches|result|binding|run|execution)\.json$|^worker-[0-9]+-error\.json$/.test(
      path.basename(file),
    );
  if (scope.used + size > scope.limit - (isControl ? 0 : (scope.reserve ?? 0)))
    throw Error("max-output-bytes: replay worker allowance exhausted");
  scope.used += size;
  const stage = `${file}.replay-stage-${randomUUID()}`;
  let published = false;
  try {
    await mkdir(path.dirname(file), { recursive: true });
    const f = await open(stage, "wx");
    try {
      await f.writeFile(bytes);
      await f.sync();
    } finally {
      await f.close();
    }
    if (exclusive) {
      await link(stage, file);
      await unlink(stage);
    } else await rename(stage, file);
    published = true;
    scope.used -= old;
    const dir = await open(path.dirname(file), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  } finally {
    if (!published) {
      try {
        await rm(stage, { force: true });
        scope.used -= size;
      } catch {
        /* Retain a conservative charge for an unremoved stage. */
      }
    }
  }
}
