/** Reserve a whole evaluation's writer allowance under the existing session gate. */
import { readFile, rename, open, lstat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  locked,
  outputUsage,
  CONTROL_RESERVE_BYTES,
  findOutputRoot,
} from "./output-storage.ts";
export interface BatchStorageLease {
  schemaVersion: 1;
  evaluation: string;
  maxBytes: number;
  token: string;
  active: boolean;
}
async function read(file: string) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
async function persist(file: string, data: unknown) {
  const temp = `${file}.${randomUUID()}.tmp`;
  const f = await open(temp, "wx");
  try {
    await f.writeFile(JSON.stringify(data));
    await f.sync();
  } finally {
    await f.close();
  }
  await rename(temp, file);
  const dir = await open(path.dirname(file), "r");
  try {
    await dir.sync();
  } finally {
    await dir.close();
  }
}
export async function leaseBatchStorage(
  root: string,
  evaluation: string,
  resume: boolean,
  maxBytes?: number,
  metadataHeadroom = 8_000_000,
  requireInactive = false,
) {
  root =
    (await findOutputRoot(path.join(path.resolve(root), ".probe"))) ??
    path.resolve(root);
  evaluation = path.resolve(evaluation);
  const relative = path.relative(root, evaluation);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    throw Error("Batch evaluation must be inside its session");
  let parent = evaluation;
  while (parent !== root) {
    try {
      if ((await lstat(parent)).isSymbolicLink())
        throw Error("Symlink batch output");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    parent = path.dirname(parent);
  }
  return locked(root, async () => {
    const file = path.join(root, ".batch-output-lease.json");
    const previous = (await read(file)) as BatchStorageLease | null;
    if (
      previous?.active &&
      (requireInactive || previous.evaluation !== relative)
    )
      throw Error("Another batch evaluation holds session storage");
    if (requireInactive)
      await lstat(path.join(root, ".storage-stop")).then(
        () => {
          throw Error("max-output-bytes: analysis storage is suspended");
        },
        (error) => {
          if (error.code !== "ENOENT") throw error;
        },
      );
    const limits = await read(path.join(root, ".output-budget.json"));
    // Reconcile the real bytes, not the previous lease's conservative reservation.
    const usage = await outputUsage(root, true);
    const own = await outputUsage(evaluation, true);
    const available =
      limits.maxBytes -
      usage.totalBytes +
      own.totalBytes -
      CONTROL_RESERVE_BYTES -
      4096;
    const allowance =
      resume && previous?.evaluation === relative
        ? previous.maxBytes
        : Math.min(
            maxBytes ?? available - metadataHeadroom,
            available - metadataHeadroom,
          );
    if (
      !Number.isSafeInteger(allowance) ||
      allowance <= CONTROL_RESERVE_BYTES ||
      allowance > available
    )
      throw Error("Insufficient session output allowance");
    const lease: BatchStorageLease = {
      schemaVersion: 1,
      evaluation: relative,
      maxBytes: allowance,
      token:
        resume && previous?.evaluation === relative
          ? previous.token
          : randomUUID(),
      active: true,
    };
    await persist(file, lease);
    return { ...lease, root };
  });
}
export async function releaseBatchStorage(root: string, token: string) {
  root =
    (await findOutputRoot(path.join(path.resolve(root), ".probe"))) ??
    path.resolve(root);
  return locked(root, async () => {
    const file = path.join(root, ".batch-output-lease.json"),
      lease = (await read(file)) as BatchStorageLease;
    if (lease?.token !== token) throw Error("Batch storage lease changed");
    await persist(file, { ...lease, active: false });
  });
}
