/** One case owns this host; each serialized game creates fresh duel and bot state. */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export class ReplayHostProcess<F extends { type: string }> {
  private child: ChildProcessWithoutNullStreams | undefined;
  private lines: AsyncIterator<string> | undefined;
  private exited: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private transportError: string | undefined;
  private ended = false;
  private busy = false;
  private stopped = false;
  private readonly entry: string;
  private readonly cwd: string;
  stderr = "";
  constructor(entry: string, cwd = process.cwd()) {
    this.entry = entry;
    this.cwd = cwd;
  }

  private readonly stop = () => {
    this.stopped = true;
    this.child?.kill("SIGKILL");
  };

  private start() {
    const child = spawn(
      process.execPath,
      [
        "--experimental-vm-modules",
        "--disable-warning=ExperimentalWarning",
        this.entry,
      ],
      { cwd: this.cwd, stdio: ["pipe", "pipe", "pipe"] },
    );
    this.child = child;
    this.lines = createInterface({ input: child.stdout })[
      Symbol.asyncIterator
    ]();
    child.stderr.on("data", (bytes: Buffer) => {
      this.stderr = (this.stderr + bytes.toString()).slice(-65536);
    });
    const error = (cause: Error) => {
      this.transportError = String(cause);
      child.kill("SIGKILL");
    };
    child.on("error", error);
    child.stdin.on("error", error);
    this.exited = new Promise<void>((resolve) =>
      child.once("close", () => {
        this.ended = true;
        process.off("SIGINT", this.stop);
        process.off("SIGTERM", this.stop);
        resolve();
      }),
    );
    process.on("SIGINT", this.stop);
    process.on("SIGTERM", this.stop);
  }

  async run(initialize: unknown, game: unknown, timeoutMs: number) {
    if (this.busy)
      throw Error("Concurrent replay host commands are unsupported");
    if (this.stopped || this.ended || this.closing)
      throw Error("Replay host has stopped");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
      throw Error("Invalid replay branch deadline");
    if (!this.child) this.start();
    this.busy = true;
    const frames: F[] = [];
    let bytes = 0,
      ready = false,
      cleaned = false,
      timedOut = false;
    let error: string | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      this.stop();
    }, timeoutMs);
    try {
      this.child!.stdin.write(JSON.stringify(initialize) + "\n");
      // Explicit next() leaves the shared iterator open at the game boundary.
      while (true) {
        const line = await this.lines!.next();
        if (line.done) break;
        bytes += Buffer.byteLength(line.value);
        if (bytes > 128 * 1024 * 1024)
          throw Error("Replay protocol exceeded 128 MiB");
        const frame = JSON.parse(line.value) as F;
        if (!frame || typeof frame.type !== "string")
          throw Error("Malformed replay host frame");
        frames.push(frame);
        if (frame.type === "ready") {
          if (ready) throw Error("Duplicate replay host initialization");
          ready = true;
          this.child!.stdin.write(JSON.stringify(game) + "\n");
        }
        if (frame.type === "host_error") break;
        if (frame.type === "cleanup") {
          if (!ready)
            throw Error("Replay host cleaned up before initialization");
          const counts = frame as F & {
            handles_created?: unknown;
            handles_destroyed?: unknown;
          };
          if (
            !Number.isSafeInteger(counts.handles_created) ||
            counts.handles_created !== counts.handles_destroyed
          )
            throw Error("Replay host cleanup is unbalanced");
          cleaned = true;
          break;
        }
      }
    } catch (cause) {
      error = String(cause);
    } finally {
      clearTimeout(timeout);
      if (!cleaned || error) {
        this.stop();
        await this.exited;
        error ??= "Replay host ended before game cleanup";
      }
      this.busy = false;
    }
    return {
      frames,
      stderr: this.stderr,
      timedOut,
      error: error ?? this.transportError,
    };
  }

  async close() {
    if (!this.child) {
      this.stopped = true;
      return;
    }
    this.closing ??= (async () => {
      this.stopped = true;
      this.child!.stdin.end();
      const killer = setTimeout(() => this.child!.kill("SIGKILL"), 2000);
      try {
        await this.exited;
      } finally {
        clearTimeout(killer);
      }
    })();
    await this.closing;
  }
}
