import type { WireResponse } from "./evidence.ts";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import {
  BOT_DEADLINE_MS,
  BOT_SETUP_DEADLINE_MS,
  BOT_MAX_INPUT_BYTES,
} from "../../src/battle/worker/bot-runtime/transport.ts";
export interface ExperimentTransport {
  request(value: unknown): Promise<WireResponse>;
  close(): void;
  computeMs: number;
  memoryBytes(): Promise<number>;
}
interface Options {
  deadlineMs?: number;
  setupMs?: number;
}
/** One outstanding operation; every failed operation permanently terminates its owner. */
function boundary(
  send: (value: unknown) => void,
  kill: () => void,
  options: Options,
) {
  let closed = false;
  let pending:
    | {
        resolve(value: unknown): void;
        reject(error: Error): void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  const close = (error = new Error("Bot transport closed")) => {
    if (closed) return;
    closed = true;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      pending = undefined;
    }
    kill();
  };
  return {
    close,
    receive(value: unknown) {
      if (!pending) {
        close(new Error("Unsolicited bot output"));
        return;
      }
      clearTimeout(pending.timer);
      const current = pending;
      pending = undefined;
      current.resolve(value);
    },
    request(value: unknown, setup = false, transmit = true): Promise<unknown> {
      if (closed) return Promise.reject(new Error("Bot transport closed"));
      if (pending) return Promise.reject(new Error("Concurrent bot request"));
      return new Promise((resolve, reject) => {
        pending = {
          resolve,
          reject,
          timer: setTimeout(
            () => close(new Error("Bot execution timed out")),
            setup
              ? (options.setupMs ?? BOT_SETUP_DEADLINE_MS)
              : (options.deadlineMs ?? BOT_DEADLINE_MS),
          ),
        };
        try {
          if (Buffer.byteLength(JSON.stringify(value)) > BOT_MAX_INPUT_BYTES)
            throw new Error("Bot input exceeds limit");
          if (transmit) send(value);
        } catch (error) {
          close(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
  };
}
export async function nativeTransport(
  options: Options & { executable?: string; args?: string[] } = {},
): Promise<ExperimentTransport> {
  const child = spawn(
    options.executable ??
      `docs/archive/rust-bot-experiment/reference/ai/target/release/ascencio-reference-bot${process.platform === "win32" ? ".exe" : ""}`,
    options.args ?? [],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  const io = boundary(
    (value) => {
      child.stdin.write(JSON.stringify(value) + "\n");
    },
    () => {
      child.stdin.destroy();
      child.stdout.destroy();
      child.kill("SIGKILL");
    },
    options,
  );
  let buffer = Buffer.alloc(0);
  child.on("error", (error) => io.close(error));
  child.on("exit", () => io.close(new Error("Native bot exited")));
  child.stdin.on("error", (error) => io.close(error));
  child.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > 1024 * 1024) {
      io.close(new Error("Bot output exceeds limit"));
      return;
    }
    const end = buffer.indexOf(10);
    if (end < 0) return;
    try {
      const response = JSON.parse(buffer.subarray(0, end).toString());
      buffer = buffer.subarray(end + 1);
      if (buffer.length) throw new Error("Unsolicited bot output");
      io.receive(response);
    } catch (error) {
      io.close(new Error("Invalid bot output", { cause: error }));
    }
  });
  return {
    computeMs: 0,
    async memoryBytes() {
      const status = await readFile(`/proc/${child.pid}/status`, "utf8");
      return Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
    },
    async request(this: ExperimentTransport, value) {
      const response = (await io.request(
        value,
        (value as { op?: string }).op === "create",
      )) as {
        error?: string;
        computeNs: number;
        ok: WireResponse;
        value: WireResponse;
        metrics: { computationMs: number; memoryBytes: number };
      };
      if (response.error) {
        io.close();
        throw new Error(response.error);
      }
      this.computeMs = response.computeNs / 1e6;
      return response.ok;
    },
    close: () => io.close(),
  };
}
export async function wasmTransport(
  options: Options & { bytes?: Uint8Array } = {},
): Promise<ExperimentTransport> {
  const bytes =
    options.bytes ?? (await readFile("docs/archive/rust-bot-experiment/reference/dist/ai.wasm"));
  const worker = new Worker(new URL("./wasm-thread.ts", import.meta.url), {
    stdout: true,
    stderr: true,
    workerData: bytes,
    resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  // Separate streams keep Node Worker startup from changing the evaluator
  // host stdout descriptor to nonblocking (its framed evidence uses writeSync).
  worker.stdout.resume();
  worker.stderr.resume();
  const io = boundary(
    (value) => worker.postMessage(value),
    () => {
      void worker.terminate();
    },
    options,
  );
  worker.on("message", (value) => io.receive(value));
  worker.on("error", (error) =>
    io.close(error instanceof Error ? error : new Error(String(error))),
  );
  worker.on("exit", () => io.close(new Error("WASM worker exited")));
  await io.request(null, true, false);
  let memory = 0;
  return {
    computeMs: 0,
    async memoryBytes() {
      return memory;
    },
    async request(this: ExperimentTransport, value) {
      const response = (await io.request(
        value,
        (value as { op?: string }).op === "create",
      )) as {
        error?: string;
        computeNs: number;
        ok: WireResponse;
        value: WireResponse;
        metrics: { computationMs: number; memoryBytes: number };
      };
      if (response.error) {
        io.close();
        throw new Error(response.error);
      }
      this.computeMs = response.metrics.computationMs;
      memory = response.metrics.memoryBytes;
      return response.value;
    },
    close: () => io.close(),
  };
}
