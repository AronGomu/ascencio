/** No engine or filesystem capability is exposed to the WASM instance. */
import { parentPort, workerData } from "node:worker_threads";
import { createWasmExecutor } from "../../src/battle/worker/bot-runtime/wasm-executor.ts";
const execute = await createWasmExecutor(new Uint8Array(workerData));
parentPort!.postMessage({ ready: true });
parentPort!.on("message", (value: unknown) => {
  try {
    parentPort!.postMessage(execute(value));
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.stack : String(error),
    });
  }
});
