import { readFile } from "node:fs/promises";
import { SourceTextModule, createContext } from "node:vm";
const file = process.env.BOT_STRATEGY;
if (!file) throw new Error("BOT_STRATEGY is required");
const module = new SourceTextModule(await readFile(file, "utf8"), {
  context: createContext(
    {},
    { codeGeneration: { strings: false, wasm: false } },
  ),
});
await module.link(() => {
  throw new Error("Strategy imports are forbidden");
});
await module.evaluate({ timeout: 1000 });
const exports = module.namespace as unknown as Record<string, unknown>;
if (typeof exports.createStrategy !== "function")
  throw new Error("createStrategy must be exported");
if (exports.sideboard !== undefined && typeof exports.sideboard !== "function")
  throw new Error("sideboard must be a function");
