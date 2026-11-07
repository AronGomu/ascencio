import { validateWasmLimits } from "./wasm-limits.ts";
import { BOT_MAX_INPUT_BYTES } from "./transport.ts";
export async function createWasmExecutor(bytes: Uint8Array) {
  validateWasmLimits(bytes);
  const { instance } = await WebAssembly.instantiate(
    bytes as Uint8Array<ArrayBuffer>,
    {},
  );
  const e = instance.exports as unknown as {
    memory: WebAssembly.Memory;
    allocate(n: number): number;
    deallocate(p: number, n: number): void;
    prepare(p: number, n: number): void;
    execute(): void;
    serialize(): number;
    output_len(): number;
  };
  return (value: unknown) => {
    const start = performance.now();
    const input = new TextEncoder().encode(JSON.stringify(value));
    if (input.length > BOT_MAX_INPUT_BYTES)
      throw new Error("Bot input exceeds limit");
    const p = e.allocate(input.length);
    if (!p) throw new Error("Bot allocation failed");
    try {
      new Uint8Array(e.memory.buffer, p, input.length).set(input);
      e.prepare(p, input.length);
      const computeStart = performance.now();
      e.execute();
      const computationMs = performance.now() - computeStart;
      const output = e.serialize();
      const length = e.output_len();
      if (length > 1024 * 1024) throw new Error("Bot output exceeds limit");
      const response = JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(e.memory.buffer, output, length),
        ),
      ) as { ok?: unknown; error?: string };
      if (response.error) throw new Error(response.error);
      return {
        value: response.ok,
        metrics: {
          computationMs,
          roundtripMs: performance.now() - start,
          memoryBytes: e.memory.buffer.byteLength,
        },
      };
    } finally {
      e.deallocate(p, input.length);
    }
  };
}
