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
/** Both schemas remain readable; migration never rewrites an old active reservation. */
export async function batchStorageLeases(
  root: string,
): Promise<BatchStorageLease[]> {
  const legacy = await read(path.join(root, ".batch-output-lease.json"));
  const ledger = await read(path.join(root, ".batch-output-leases.json"));
  if (ledger && (ledger.schemaVersion !== 2 || !Array.isArray(ledger.leases)))
    throw Error("Invalid concurrent storage ledger");
  return [...(legacy ? [legacy] : []), ...(ledger?.leases ?? [])];
}
export async function readBatchStorageLease(root: string, token?: string) {
  return (await batchStorageLeases(root)).find((l) =>
    token ? l.token === token : l.active,
  );
}
export async function leaseBatchStorage(
  root: string,
  evaluation: string,
  resume: boolean,
  maxBytes?: number,
  metadataHeadroom = 8_000_000,
  requireInactive = false,
  concurrent = false,
) {
  if (
    concurrent &&
    (!Number.isSafeInteger(maxBytes) || maxBytes! <= CONTROL_RESERVE_BYTES)
  )
    throw Error("Concurrent storage requires an explicit byte envelope");
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
    const file = path.join(
      root,
      concurrent ? ".batch-output-leases.json" : ".batch-output-lease.json",
    );
    const all = await batchStorageLeases(root);
    const legacy = await read(path.join(root, ".batch-output-lease.json"));
    if (concurrent && legacy?.active && legacy.evaluation === relative)
      throw Error("Finish legacy reservation before concurrent migration");
    const overlap = (a: string, b: string) =>
      a === b || a.startsWith(b + path.sep) || b.startsWith(a + path.sep);
    const previous = concurrent
      ? all.find((l) => l.evaluation === relative)
      : ((await read(file)) as BatchStorageLease | null);
    if (
      all.some(
        (l) =>
          l.active &&
          (concurrent
            ? overlap(l.evaluation, relative) &&
              !(resume && l === previous && !requireInactive)
            : l.token !== previous?.token),
      )
    )
      throw Error("Another batch evaluation holds session storage");
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
    const usage = await outputUsage(root);
    const own = await outputUsage(evaluation, true);
    const available =
      limits.maxBytes -
      usage.totalBytes +
      (previous?.active ? previous.maxBytes : own.totalBytes) -
      CONTROL_RESERVE_BYTES -
      4096;
    const allowance =
      resume && previous?.evaluation === relative
        ? previous.maxBytes
        : concurrent
          ? maxBytes!
          : Math.min(
              maxBytes ?? available - metadataHeadroom,
              available - metadataHeadroom,
            );
    if (
      !Number.isSafeInteger(allowance) ||
      allowance <= CONTROL_RESERVE_BYTES ||
      allowance < own.totalBytes ||
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
    if (concurrent) {
      const ledger = (await read(file)) ?? { schemaVersion: 2, leases: [] };
      ledger.leases = ledger.leases.filter(
        (l: BatchStorageLease) => l.evaluation !== relative,
      );
      ledger.leases.push(lease);
      await persist(file, ledger);
    } else await persist(file, lease);
    return { ...lease, root };
  });
}
export async function releaseBatchStorage(root: string, token: string) {
  // Release against the root returned at acquisition. A newly configured
  // ancestor budget must not redirect an existing lease's cleanup.
  root = path.resolve(root);
  return locked(root, async () => {
    const file = path.join(root, ".batch-output-lease.json");
    const legacy = await read(file);
    if (legacy?.token === token) {
      await persist(file, { ...legacy, active: false });
      return;
    }
    const multiFile = path.join(root, ".batch-output-leases.json");
    const ledger = await read(multiFile);
    const lease = ledger?.leases.find(
      (l: BatchStorageLease) => l.token === token,
    );
    if (!lease) throw Error("Batch storage lease changed");
    lease.active = false;
    await persist(multiFile, ledger);
  });
}
