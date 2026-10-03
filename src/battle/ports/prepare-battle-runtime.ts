import { DuelWorkerClient } from "../app/DuelWorkerClient.ts";
import type { BattleRuntimeSource } from "./battle-runtime-source.ts";

/** Preparation executes in a disposable Worker; the retained source owns restart inputs. */
export async function prepareBattleRuntime(
  source: BattleRuntimeSource,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  const client = new DuelWorkerClient();
  let unsubscribe = () => {};
  let abort = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      abort = () =>
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", abort, { once: true });
      unsubscribe = client.subscribe(({ event }) => {
        if (event.type === "ready") resolve();
        else if (event.type === "error")
          reject(
            new Error(`ENGINE_PREPARATION_FAILED: ${event.error.message}`),
          );
      });
      if (!client.initialize(source))
        reject(new Error("ENGINE_PREPARATION_FAILED"));
    });
  } finally {
    unsubscribe();
    signal.removeEventListener("abort", abort);
    await client.dispose();
  }
}
