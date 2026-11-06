import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule } from "node:vm";
const source = await readFile(
  "scripts/bot-evaluation/recoverable-strategy.mjs",
  "utf8",
);
const context = createContext(
  {},
  { codeGeneration: { strings: false, wasm: false } },
);
const module = new SourceTextModule(source, { context });
await module.link(() => {
  throw new Error("Recovery imports forbidden");
});
await module.evaluate({ timeout: 1000 });
const exports = module.namespace as unknown as { adjustScore?: unknown };
if (typeof exports.adjustScore !== "function")
  throw new Error("adjustScore required");
