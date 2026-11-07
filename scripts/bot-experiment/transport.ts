import type { WireResponse } from "./evidence.ts";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";

export interface ExperimentTransport {
  request(value: unknown): Promise<WireResponse>;
  close(): void;
  computeMs: number;
  memoryBytes(): Promise<number>;
}
export async function nativeTransport(): Promise<ExperimentTransport> {
  const child = spawn(
    "assets/ai-bots/reference/ai/target/release/ascencio-reference-bot",
    [],
    { stdio: ["pipe", "pipe", "inherit"] },
  );
  const lines = createInterface({ input: child.stdout })[
    Symbol.asyncIterator
  ]();
  return {
    computeMs: 0,
    async memoryBytes() {
      const status = await readFile(`/proc/${child.pid}/status`, "utf8");
      return Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024;
    },
    async request(this: ExperimentTransport, value) {
      child.stdin.write(JSON.stringify(value) + "\n");
      const line = await lines.next();
      if (line.done) throw new Error("Native bot exited");
      const response = JSON.parse(line.value);
      if (response.error) throw new Error(response.error);
      this.computeMs = response.computeNs / 1e6;
      return response.ok;
    },
    close() {
      child.stdin.end();
      child.kill();
    },
  };
}
export async function wasmTransport(): Promise<ExperimentTransport> {
  const { instance } = await WebAssembly.instantiate(
    await readFile("assets/ai-bots/reference/dist/ai.wasm"),
    {},
  );
  const exports = instance.exports as unknown as {
    memory: WebAssembly.Memory;
    allocate(n: number): number;
    deallocate(p: number, n: number): void;
    invoke(p: number, n: number): number;
    prepare(p: number, n: number): void;
    execute(): void;
    serialize(): number;
    output_len(): number;
  };
  return {
    computeMs: 0,
    async memoryBytes() {
      return exports.memory.buffer.byteLength;
    },
    async request(this: ExperimentTransport, value) {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const ptr = exports.allocate(bytes.length);
      if (!ptr) throw new Error("WASM allocation refused");
      try {
        new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
        exports.prepare(ptr, bytes.length);
        const start = performance.now();
        exports.execute();
        this.computeMs = performance.now() - start;
        const output = exports.serialize();
        const response = JSON.parse(
          new TextDecoder().decode(
            new Uint8Array(exports.memory.buffer, output, exports.output_len()),
          ),
        );
        if (response.error) throw new Error(response.error);
        return response.ok;
      } finally {
        exports.deallocate(ptr, bytes.length);
      }
    },
    close() {},
  };
}
