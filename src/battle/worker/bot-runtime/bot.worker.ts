import { createWasmExecutor } from "./wasm-executor.ts";
let execute: Awaited<ReturnType<typeof createWasmExecutor>> | undefined;
let queue = Promise.resolve();
self.onmessage = (
  event: MessageEvent<{ id: number; bytes?: Uint8Array; request?: unknown }>,
) => {
  queue = queue.then(async () => {
    try {
      const { id, bytes, request } = event.data;
      if (bytes) {
        execute = await createWasmExecutor(bytes);
        self.postMessage({ id, value: null });
      } else {
        if (!execute) throw new Error("Bot not loaded");
        self.postMessage({ id, ...execute(request) });
      }
    } catch (error) {
      self.postMessage({
        id: event.data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
