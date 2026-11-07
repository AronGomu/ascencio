import { readFile } from "node:fs/promises";
import { SourceTextModule, createContext, runInContext } from "node:vm";
const file = process.env.BOT_STRATEGY;
if (!file) throw new Error("BOT_STRATEGY is required");
const context = createContext(
  {},
  { codeGeneration: { strings: false, wasm: false } },
);
const module = new SourceTextModule(await readFile(file, "utf8"), { context });
await module.link(() => {
  throw new Error("Strategy imports are forbidden");
});
await module.evaluate({ timeout: 1000 });
const exports = module.namespace as unknown as Record<string, unknown>;
if (typeof exports.createStrategy !== "function")
  throw new Error("createStrategy must be exported");
if (exports.sideboard !== undefined && typeof exports.sideboard !== "function")
  throw new Error("sideboard must be a function");

// Optional frozen metadata extends the legacy export-only check without guessing cards.
if (process.env.BOT_STRATEGY_CONTENT) {
  const { loadCriticalInputs } =
    await import("../bot-evaluation/critical-inputs.ts");
  const { dependencies } = await loadCriticalInputs(
    process.env.BOT_STRATEGY_CONTENT,
  );
  const cards = JSON.stringify(
    [...dependencies.cards],
    (_key, value: unknown) =>
      typeof value === "bigint" ? { $bigint: String(value) } : value,
  );
  context.strategyExports = exports;
  const input = `({ cards: new Map(JSON.parse(${JSON.stringify(cards)}, (_key, value) => value && typeof value === "object" && "$bigint" in value ? BigInt(value.$bigint) : value)) })`;
  if (
    typeof runInContext(`strategyExports.createStrategy(${input})`, context, {
      timeout: 1000,
    }) !== "function"
  )
    throw new Error("createStrategy must return a scoring function");
}
