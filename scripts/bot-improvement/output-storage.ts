/** Cross-process output quota. Data cannot consume the checkpoint/report reserve. */
import {
  open,
  readFile,
  readdir,
  lstat,
  rename,
  link,
  unlink,
  mkdir,
  access,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export const DEFAULT_OUTPUT_BYTES = 20_000_000_000;
export const CONTROL_RESERVE_BYTES = 16_000_000;
export interface StorageLimits {
  maxBytes: number;
  controlReserveBytes: number;
}
function validateLimits(value: StorageLimits) {
  if (
    !Number.isSafeInteger(value.maxBytes) ||
    !Number.isSafeInteger(value.controlReserveBytes) ||
    value.controlReserveBytes < 1 ||
    value.maxBytes <= value.controlReserveBytes
  )
    throw Error("Invalid output storage limits");
}
const controls = new Set([
  "control.json",
  "report.json",
  "report.md",
  "state.json",
  "run.json",
  "progress.json",
  "result.json",
  "summary.xml",
  "replay.json",
  "owners.json",
  ".output-budget.json",
  ".storage-stop",
  ".batch-output-lease.json",
]);
function control(file: string) {
  return controls.has(path.basename(file).split(".output-stage-")[0]!);
}
async function syncDirectory(dir: string) {
  const f = await open(dir, "r");
  try {
    await f.sync();
  } finally {
    await f.close();
  }
}
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
export async function locked<T>(root: string, run: () => Promise<T>) {
  await mkdir(root, { recursive: true });
  const lock = path.join(root, ".output-storage.lock");
  const owner = path.join(root, `.output-lock-${process.pid}-${randomUUID()}`);
  await writeRaw(owner, String(process.pid));
  try {
    for (let n = 0; ; n++) {
      try {
        await link(owner, lock);
        break;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        const pid = Number(await readFile(lock, "utf8").catch(() => "0"));
        if (Number.isSafeInteger(pid) && pid > 0 && !alive(pid)) {
          const guard = path.join(root, ".output-storage.recovery");
          let owns = false;
          try {
            await link(owner, guard);
            owns = true;
            const current = Number(
              await readFile(lock, "utf8").catch(() => "0"),
            );
            if (Number.isSafeInteger(current) && current > 0 && !alive(current))
              await unlink(lock).catch(() => {});
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          } finally {
            if (owns) await unlink(guard);
          }
          if (owns) continue;
        }
        if (n >= 1500) throw Error("Output storage writer is busy");
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    try {
      return await run();
    } finally {
      await unlink(lock);
    }
  } finally {
    await unlink(owner).catch(() => {});
  }
}
async function writeRaw(file: string, bytes: string | Uint8Array) {
  const f = await open(file, "wx");
  try {
    await f.writeFile(bytes);
    await f.sync();
  } finally {
    await f.close();
  }
}
export async function outputUsage(root: string, actual = false) {
  const lease = !actual
    ? await readFile(path.join(root, ".batch-output-lease.json"), "utf8").then(
        JSON.parse,
        (e) => {
          if (e.code === "ENOENT") return null;
          throw e;
        },
      )
    : null;
  if (
    lease?.active &&
    (lease.schemaVersion !== 1 ||
      !Number.isSafeInteger(lease.maxBytes) ||
      lease.maxBytes < 1 ||
      typeof lease.evaluation !== "string" ||
      path.isAbsolute(lease.evaluation) ||
      lease.evaluation
        .split(/[\\/]/)
        .some((p: string) => !p || p === ".." || p === "."))
  )
    throw Error("Invalid batch storage lease");
  const leased = lease?.active ? path.resolve(root, lease.evaluation) : null;
  let dataBytes = 0,
    controlBytes = 0;
  async function visit(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (
        entry.name === ".output-storage.lock" ||
        entry.name === ".output-storage.recovery" ||
        entry.name.startsWith(".output-lock-")
      )
        continue;
      const file = path.join(dir, entry.name);
      let info;
      try {
        info = await lstat(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (leased && path.resolve(file) === leased) dataBytes += lease.maxBytes;
      else if (info.isDirectory()) await visit(file);
      else if (control(file)) controlBytes += info.size;
      else dataBytes += info.size;
    }
  }
  await visit(root);
  if (leased) {
    try {
      await lstat(leased);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      dataBytes += lease.maxBytes;
    }
  }
  return { dataBytes, controlBytes, totalBytes: dataBytes + controlBytes };
}
export async function configureOutputStorage(
  root: string,
  maxBytes = DEFAULT_OUTPUT_BYTES,
  controlReserveBytes = CONTROL_RESERVE_BYTES,
) {
  root = path.resolve(root);
  if (
    !Number.isSafeInteger(maxBytes) ||
    !Number.isSafeInteger(controlReserveBytes) ||
    controlReserveBytes < 1 ||
    maxBytes <= controlReserveBytes
  )
    throw Error("Output limit must exceed its control reserve");
  const parentBudget = await findOutputRoot(path.join(root, ".budget-probe"));
  if (parentBudget && parentBudget !== root) return;
  await locked(root, async () => {
    const file = path.join(root, ".output-budget.json"),
      stage = file + `.output-stage-${process.pid}-${randomUUID()}`;
    const current = await readFile(file, "utf8").then(JSON.parse, () => null);
    if (
      current?.maxBytes === maxBytes &&
      current?.controlReserveBytes === controlReserveBytes
    )
      return;
    try {
      await writeRaw(
        stage,
        JSON.stringify({ maxBytes, controlReserveBytes }) + "\n",
      );
      await rename(stage, file);
      await syncDirectory(root);
    } finally {
      await rm(stage, { force: true });
    }
  });
}
export async function findOutputRoot(file: string): Promise<string | null> {
  let dir = path.dirname(path.resolve(file)),
    found: string | null = null;
  for (;;) {
    try {
      await access(path.join(dir, ".output-budget.json"));
      found = dir;
    } catch {
      // This ancestor has no budget file; continue searching for the run root.
    }
    const parent = path.dirname(dir);
    if (parent === dir) return found;
    dir = parent;
  }
}
export async function storageStatus(root: string) {
  root = (await findOutputRoot(path.join(root, ".budget-probe"))) ?? root;
  const limits = JSON.parse(
    await readFile(path.join(root, ".output-budget.json"), "utf8"),
  ) as StorageLimits;
  validateLimits(limits);
  const usage = await outputUsage(root);
  let stopped = false;
  try {
    await access(path.join(root, ".storage-stop"));
    stopped = true;
  } catch {
    // An absent marker means no writer has persisted a storage stop.
  }
  return {
    ...limits,
    ...usage,
    stopped,
    exhausted:
      stopped ||
      usage.totalBytes >= limits.maxBytes - limits.controlReserveBytes,
  };
}
/** Stage + fsync + atomic publish; staging bytes count against the appropriate quota. */
export async function writeOutput(
  file: string,
  bytes: string | Uint8Array,
  exclusive = false,
) {
  file = path.resolve(file);
  const root = await findOutputRoot(file);
  if (exclusive) {
    await lstat(file).then(
      () => {
        throw Object.assign(Error(`Already exists: ${file}`), {
          code: "EEXIST",
        });
      },
      (error) => {
        if (error.code !== "ENOENT") throw error;
      },
    );
  }
  const publish = async () => {
    await mkdir(path.dirname(file), { recursive: true });
    const stage = file + `.output-stage-${process.pid}-${randomUUID()}`;
    try {
      await writeRaw(stage, bytes);
      if (exclusive) {
        await link(stage, file);
        await unlink(stage);
      } else await rename(stage, file);
      await syncDirectory(path.dirname(file));
    } finally {
      await rm(stage, { force: true });
    }
  };
  if (!root) {
    await publish();
    return;
  }
  await locked(root, async () => {
    const status = await storageStatus(root),
      size =
        typeof bytes === "string" ? Buffer.byteLength(bytes) : bytes.byteLength;
    const isControl = control(file);
    if (
      (!isControl && status.stopped) ||
      status.totalBytes + size > status.maxBytes ||
      (!isControl &&
        status.totalBytes + size > status.maxBytes - status.controlReserveBytes)
    ) {
      const flag = path.join(root, ".storage-stop");
      if (status.totalBytes + 17 <= status.maxBytes) {
        try {
          await writeRaw(flag, "max-output-bytes\n");
          await syncDirectory(root);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        }
      }
      throw Object.assign(
        Error(
          `max-output-bytes: refusing ${size} bytes for ${file}; checkpoint reserve is protected`,
        ),
        { code: "MAX_OUTPUT_BYTES" },
      );
    }
    await publish();
  });
}
export async function clearStorageStop(root: string) {
  root = (await findOutputRoot(path.join(root, ".budget-probe"))) ?? root;
  await locked(root, async () => {
    const s = await storageStatus(root);
    if (s.totalBytes >= s.maxBytes - s.controlReserveBytes)
      throw Error(
        "Output limit still exhausted; increase it before continuation",
      );
    await rm(path.join(root, ".storage-stop"), { force: true });
    await syncDirectory(root);
  });
}

/** Administrative limits are not gameplay inputs; reuse the ledger's effective cap. */
export async function ensureSessionOutput(session: string) {
  const file = path.join(session, "config.json");
  const config = await readFile(file, "utf8").then(JSON.parse, () => null);
  if (!config?.fixture || !config?.limits?.stop) return;
  const ledger = await readFile(
    path.join(session, "control.json"),
    "utf8",
  ).then(JSON.parse, () => null);
  await configureOutputStorage(
    session,
    ledger?.limits?.maxBytes ??
      config.limits.stop.maxBytes ??
      DEFAULT_OUTPUT_BYTES,
  );
}

/** Drop-in UTF-8/binary publication for tooling that previously used fs.writeFile. */
export async function writeBudgetedFile(
  file: string,
  data: string | Uint8Array,
  options?: string | { flag?: string },
) {
  if (
    typeof options === "object" &&
    options.flag !== undefined &&
    !["w", "wx"].includes(options.flag)
  )
    throw Error("Unsupported budgeted write mode");
  await writeOutput(
    file,
    data,
    typeof options === "object" && options.flag === "wx",
  );
}
