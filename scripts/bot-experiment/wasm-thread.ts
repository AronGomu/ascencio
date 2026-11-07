/** No engine or filesystem capability is exposed to the WASM instance. */
import { parentPort, workerData } from "node:worker_threads";
import { createWasmExecutor } from "../../src/battle/worker/bot-runtime/wasm-executor.ts";
const executor = createWasmExecutor(new Uint8Array(workerData));
// Register the port before asynchronous compilation so Node keeps this worker alive.
parentPort!.on("message", async (value: unknown) => {
  try {
    const execute = await executor;
    parentPort!.postMessage(execute(value));
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.stack : String(error),
    });
  }
});

void executor.then(() => parentPort!.postMessage({ ready: true }));
