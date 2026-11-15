/** Durable operation ownership and bounded supervision; wrapper exit is not writer exit. */
import { readFile, open, rename, unlink, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile);
export interface ProcessOwner {
  pid: number;
  birth: string;
  group: boolean;
}
interface OperationRecord {
  schemaVersion: 2;
  token: string;
  identity: string;
  pid: number;
  birth: string;
  status: "running" | "complete" | "failed" | "cancelled" | "recovered";
  phase: string;
  startedAt: number;
  updatedAt: number;
  sequence: number;
  counts: Record<string, number>;
  rss: number;
  peakRss: number;
  children: ProcessOwner[];
  error?: string;
}
/** Creation identity is independent of the shell and distinguishes reused PIDs. */
export async function processIdentity(pid: number): Promise<string | null> {
  if (!Number.isSafeInteger(pid) || pid < 1) throw Error("Invalid process ID");
  if (process.platform === "linux") {
    try {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      if (fields[0] === "Z") return null;
      return `${(await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim()}:${fields[19]}`;
    } catch (e) {
      if (["ENOENT", "ESRCH"].includes((e as NodeJS.ErrnoException).code ?? ""))
        return null;
      throw e;
    }
  }
  try {
    if (process.platform === "win32") {
      const { stdout } = await exec("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `$p=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if ($p) {$p.CreationDate.ToUniversalTime().ToString('o')}`,
      ]);
      return stdout.trim() || null;
    }
    const { stdout } = await exec("ps", ["-o", "lstart=", "-p", String(pid)]);
    return stdout.trim() || null;
  } catch (e) {
    if ((e as { code?: number }).code === 1) return null;
    throw e;
  }
}
function sameBirth(actual: string | null, recorded: string) {
  return (
    actual !== null &&
    (actual === recorded ||
      (process.platform === "linux" &&
        /^\d+$/.test(recorded) &&
        actual.split(":").at(-1) === recorded))
  );
}
async function matches(owner: ProcessOwner) {
  return sameBirth(await processIdentity(owner.pid), owner.birth);
}
async function persist(file: string, value: unknown) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  const fd = await open(tmp, "wx");
  try {
    await fd.writeFile(JSON.stringify(value) + "\n");
    await fd.sync();
  } finally {
    await fd.close();
  }
  await rename(tmp, file);
  if (process.platform !== "win32") {
    const dir = await open(path.dirname(file), "r");
    try {
      await dir.sync();
    } finally {
      await dir.close();
    }
  }
}
async function read(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as OperationRecord;
}
export async function operationStatus(file: string) {
  const value = await read(file);
  const ownerActive =
    value.birth != null &&
    sameBirth(await processIdentity(value.pid), value.birth);
  const activeChildren = (
    await Promise.all(
      (value.children ?? []).map(async (child) =>
        (await matches(child)) ? child : null,
      ),
    )
  ).filter((p): p is ProcessOwner => p !== null);
  return {
    ...value,
    ownerActive,
    activeChildren,
    active:
      value.status === "running" && (ownerActive || activeChildren.length > 0),
    orphaned: value.status === "running" && !ownerActive,
  };
}
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function signal(owner: ProcessOwner, force: boolean) {
  if (!(await matches(owner))) return;
  try {
    if (process.platform === "win32")
      await exec("taskkill", [
        "/PID",
        String(owner.pid),
        "/T",
        ...(force ? ["/F"] : []),
      ]);
    else
      process.kill(
        owner.group ? -owner.pid : owner.pid,
        force ? "SIGKILL" : "SIGTERM",
      );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
  }
}
/** Only process groups created by this operation may be passed here. */
async function stopChildren(children: ProcessOwner[], graceMs: number) {
  for (const child of children) await signal(child, false);
  const deadline = Date.now() + graceMs;
  while (
    Date.now() < deadline &&
    (await Promise.all(children.map(matches))).some(Boolean)
  )
    await delay(Math.min(20, Math.max(1, deadline - Date.now())));
  for (const child of children) await signal(child, true);
  const killDeadline = Date.now() + 2000;
  while (
    Date.now() < killDeadline &&
    (await Promise.all(children.map(matches))).some(Boolean)
  )
    await delay(20);
  if ((await Promise.all(children.map(matches))).some(Boolean))
    throw Error("Owned processes remain active after bounded shutdown");
}
export interface OperationContext {
  signal: AbortSignal;
  spawn: (
    command: string,
    args: string[],
    options?: { cwd?: string },
  ) => Promise<{
    child: ChildProcess;
    completed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
  }>;
}
export async function ownedOperation<T>(
  file: string,
  identity: string,
  run: (
    progress: (phase: string, counts: Record<string, number>) => Promise<void>,
    context: OperationContext,
  ) => Promise<T>,
  options: { heartbeatMs?: number; shutdownGraceMs?: number } = {},
) {
  const heartbeatMs = options.heartbeatMs ?? 10000,
    grace = options.shutdownGraceMs ?? 2000;
  if (
    !Number.isSafeInteger(heartbeatMs) ||
    heartbeatMs < 10 ||
    !Number.isSafeInteger(grace) ||
    grace < 0 ||
    grace > 60000
  )
    throw Error("Invalid operation intervals");
  await mkdir(path.dirname(file), { recursive: true });
  const birth = await processIdentity(process.pid);
  if (!birth) throw Error("Cannot establish operation process identity");
  const value: OperationRecord = {
    schemaVersion: 2,
    token: randomUUID(),
    identity,
    pid: process.pid,
    birth,
    status: "running",
    phase: "starting",
    startedAt: Date.now(),
    updatedAt: Date.now(),
    sequence: 0,
    counts: {},
    rss: process.memoryUsage().rss,
    peakRss: process.memoryUsage().rss,
    children: [],
  };
  const lock = `${file}.lock`;
  const fd = await open(lock, "wx");
  try {
    await fd.writeFile(JSON.stringify(value));
    await fd.sync();
  } finally {
    await fd.close();
  }
  let writes = Promise.resolve(),
    heartbeatError: unknown;
  let closing = false;
  const save = () => {
    writes = writes.then(async () => {
      value.updatedAt = Date.now();
      value.sequence++;
      value.rss = process.memoryUsage().rss;
      value.peakRss = Math.max(value.peakRss, value.rss);
      await persist(file, value);
    });
    return writes;
  };
  const abort = new AbortController();
  const stop = () => {
    abort.abort(Error("Owned operation cancelled"));
    void stopChildren(value.children, grace).catch((e) => {
      heartbeatError = e;
    });
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  let timer: ReturnType<typeof setInterval> | undefined;
  try {
    await save();
    timer = setInterval(() => {
      if (!closing)
        void save().catch((e) => {
          heartbeatError = e;
          abort.abort(e);
        });
    }, heartbeatMs);
    timer.unref();
    const progress = async (phase: string, counts: Record<string, number>) => {
      if (abort.signal.aborted) throw abort.signal.reason;
      if (
        phase.length > 128 ||
        Object.keys(counts).length > 32 ||
        Object.values(counts).some((n) => !Number.isFinite(n) || n < 0)
      )
        throw Error("Invalid bounded progress");
      value.phase = phase;
      value.counts = counts;
      await save();
      process.stderr.write(
        JSON.stringify({
          operation: identity,
          sequence: value.sequence,
          phase,
          counts,
          rss: value.rss,
          elapsedMs: value.updatedAt - value.startedAt,
        }) + "\n",
      );
    };
    const context: OperationContext = {
      signal: abort.signal,
      spawn: async (command, args, opts = {}) => {
        if (abort.signal.aborted || closing)
          throw Error("Operation is stopping");
        const child = spawn(
          process.execPath,
          [fileURLToPath(new URL("./operation-child.mjs", import.meta.url))],
          {
            cwd: opts.cwd,
            detached: process.platform !== "win32",
            stdio: ["pipe", "ignore", "ignore"],
          },
        );
        const completed = new Promise<{
          code: number | null;
          signal: NodeJS.Signals | null;
        }>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code, signal) => resolve({ code, signal }));
        });
        // Attach rejection immediately; caller still receives original promise.
        void completed.catch(() => {});
        await new Promise<void>((resolve, reject) => {
          child.once("spawn", resolve);
          child.once("error", reject);
        });
        const childBirth = await processIdentity(child.pid!);
        if (!childBirth) {
          child.kill("SIGKILL");
          throw Error("Child ended before registration");
        }
        const owned = {
          pid: child.pid!,
          birth: childBirth,
          group: process.platform !== "win32",
        };
        value.children.push(owned);
        try {
          await save();
          child.stdin!.end(
            JSON.stringify({ command, args, cwd: opts.cwd }) + "\n",
          );
        } catch (e) {
          await signal(owned, true);
          throw e;
        }
        return { child, completed };
      },
    };
    const result = await run(progress, context);
    closing = true;
    await stopChildren(value.children, grace);
    if (heartbeatError) throw heartbeatError;
    if (abort.signal.aborted) throw abort.signal.reason;
    value.status = "complete";
    await save();
    return result;
  } catch (e) {
    closing = true;
    await stopChildren(value.children, grace);
    value.status = abort.signal.aborted ? "cancelled" : "failed";
    value.error = String(e);
    await save();
    throw e;
  } finally {
    closing = true;
    if (timer) clearInterval(timer);
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
    await writes.catch(() => {});
    // Never delete a replacement owner's lock.
    if (
      !(await Promise.all(value.children.map(matches))).some(Boolean) &&
      (await read(lock)).token === value.token
    )
      await unlink(lock);
  }
}
/** Explicit stale-owner recovery, guarded against concurrent recovery and PID reuse. */
export async function recoverOperation(
  file: string,
  token: string,
  options: { terminateChildren?: boolean; shutdownGraceMs?: number } = {},
) {
  const guard = `${file}.recovery`;
  const fd = await open(guard, "wx");
  await fd.close();
  try {
    const lock = await read(`${file}.lock`);
    const state = await operationStatus(file);
    if (lock.token !== token || state.token !== token)
      throw Error("Operation recovery token mismatch");
    if (state.ownerActive) throw Error("Operation owner is still active");
    if (state.activeChildren.length && !options.terminateChildren)
      throw Error("Owned child processes remain active");
    const grace = options.shutdownGraceMs ?? 2000;
    if (!Number.isSafeInteger(grace) || grace < 0 || grace > 60000)
      throw Error("Invalid shutdown grace");
    if (options.terminateChildren)
      await stopChildren(state.activeChildren, grace);
    const latest = await operationStatus(file);
    if (latest.ownerActive || latest.activeChildren.length)
      throw Error("Operation remains active");
    if ((await read(`${file}.lock`)).token !== token)
      throw Error("Operation lock changed");
    await persist(file, {
      ...lock,
      ...latest,
      status: "recovered",
      updatedAt: Date.now(),
      recoveredAt: Date.now(),
    });
    await unlink(`${file}.lock`);
  } finally {
    await unlink(guard);
  }
}
