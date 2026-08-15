import { fileURLToPath } from "node:url";
import { runNodeDuelWorker } from "../../src/battle/worker/worker-thread-bridge-node.ts";

runNodeDuelWorker(
  fileURLToPath(new URL("./missing-runtime-root", import.meta.url)),
);
