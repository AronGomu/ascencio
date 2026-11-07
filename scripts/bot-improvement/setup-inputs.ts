import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { wasmTransport } from "../bot-experiment/transport.ts";
import { SourceTextModule, createContext } from "node:vm";
import { validateWasmLimits } from "../../src/battle/worker/bot-runtime/wasm-limits.ts";
import { parseBotManifest } from "../../src/battle/duel/contracts/bot-package.ts";
import {
  parseYdk,
  type ParsedDeck,
} from "../../src/battle/duel/presets/deck-parser.ts";
import { loadCriticalInputs } from "../bot-evaluation/critical-inputs.ts";
import { instantiate, type Artifact } from "../bot-evaluation/host-inputs.ts";
import type { EvaluationSetup, FrozenBot } from "./session-contract.ts";
import { digest, identity } from "./session-fixtures.ts";

export async function json(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}
export async function resolveBot(folder: string) {
  folder = await realpath(folder);
  const configPath = path.join(folder, "evaluation.json");
  const original = await readFile(configPath, "utf8");
  const config = JSON.parse(original) as EvaluationSetup;
  if (
    config.schemaVersion !== 1 ||
    !["mr3", "mr5"].includes(config.profile) ||
    !config.configuration ||
    typeof config.configuration !== "object" ||
    Array.isArray(config.configuration) ||
    Object.values(config.configuration).some(
      (v) => !["string", "number", "boolean"].includes(typeof v),
    )
  )
    throw new Error(`Invalid evaluation configuration: ${configPath}`);
  for (const key of ["deck", "content", "banlist"] as const)
    if (typeof config[key] !== "string" || !config[key])
      throw new Error(`Missing ${key}: ${configPath}`);
  const deck = parseYdk(
    await readFile(path.resolve(folder, config.deck), "utf8"),
  );
  const content = await realpath(path.resolve(folder, config.content));
  const loaded = await loadCriticalInputs(content);
  const banlistBytes = await readFile(path.resolve(folder, config.banlist));
  const suppliedRules = JSON.parse(banlistBytes.toString());
  // Freeplay source limits and the Rust evaluator's normalized rules are both current inputs.
  if (
    Array.isArray(suppliedRules) &&
    suppliedRules.some(
      (row) =>
        !row ||
        !Number.isSafeInteger(row.cardCode) ||
        row.cardCode <= 0 ||
        !Number.isInteger(row.deckLimit) ||
        row.deckLimit < 0 ||
        row.deckLimit > 3,
    )
  )
    throw new Error("Invalid Freeplay limits");
  const banlist = (
    Array.isArray(suppliedRules)
      ? {
          defaultLimit: 3,
          limits: Object.fromEntries(
            suppliedRules.map((row) => [String(row.cardCode), row.deckLimit]),
          ),
        }
      : suppliedRules
  ) as { defaultLimit: number; limits: Record<string, number> };
  if (!banlist || typeof banlist !== "object")
    throw new Error("Invalid banlist");
  if (
    !Number.isInteger(banlist.defaultLimit) ||
    banlist.defaultLimit < 0 ||
    banlist.defaultLimit > 3 ||
    !banlist.limits ||
    typeof banlist.limits !== "object" ||
    Array.isArray(banlist.limits) ||
    Object.values(banlist.limits).some(
      (n) => !Number.isInteger(n) || n < 0 || n > 3,
    )
  )
    throw new Error("Invalid banlist");
  validateDeck(deck, loaded.dependencies.cards, banlist);
  const bytes: Record<string, Uint8Array> = {
    "deck.json": Buffer.from(JSON.stringify(deck)),
    "configuration.json": Buffer.from(JSON.stringify(config.configuration)),
  };
  let bot: Omit<FrozenBot, "identity" | "files">;
  if (config.module !== undefined) {
    const module = config.module;
    const builtin = /^builtin:(basic|generalist|random)$/.test(module);
    if (module.startsWith("builtin:") && !builtin)
      throw new Error("Unsupported builtin module");
    const entry = builtin
      ? path.resolve(`src/battle/worker/bot/${module.slice(8)}-bot.ts`)
      : path.resolve(folder, module);
    const built = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      metafile: true,
      format: "esm",
      platform: "browser",
      target: "es2023",
      logLevel: "silent",
    });
    const source = built.outputFiles![0]!.text;
    if (/\bimport\s*\(/.test(source))
      throw new Error("Dynamic bot imports forbidden");
    const artifact: Artifact = {
      module,
      source,
      config: config.configuration,
      dependencies: [],
    };
    await instantiate(artifact, loaded.dependencies);
    bytes["bot.mjs"] = Buffer.from(source);
    for (const [i, file] of Object.keys(built.metafile!.inputs)
      .sort()
      .entries())
      bytes[`sources/${i}-${path.basename(file)}`] = await readFile(file);
    bot = {
      kind: "module",
      module: builtin ? module : "bot.mjs",
      configuration: config.configuration,
      deck,
    };
  } else {
    const manifestBytes = await readFile(path.join(folder, "bot.json"));
    const manifest = parseBotManifest(JSON.parse(manifestBytes.toString()));
    if (!config.policy || !manifest.policies.includes(config.policy))
      throw new Error("Missing/unsupported package policy");
    const safeRead = async (file: string) => {
      const resolved = await realpath(path.join(folder, file));
      if (!resolved.startsWith(`${folder}${path.sep}`))
        throw new Error(`Escaping package path: ${file}`);
      return readFile(resolved);
    };
    bytes["bot.json"] = manifestBytes;
    bytes[manifest.wasm] = await safeRead(manifest.wasm);
    validateWasmLimits(bytes[manifest.wasm]!);
    const compiled = await WebAssembly.compile(
      Uint8Array.from(bytes[manifest.wasm]!),
    );
    const exports = WebAssembly.Module.exports(compiled);
    for (const name of [
      "memory",
      "allocate",
      "deallocate",
      "prepare",
      "execute",
      "serialize",
      "output_len",
    ])
      if (!exports.some((e) => e.name === name))
        throw new Error(`Missing bot WASM export: ${name}`);
    const transport = await wasmTransport({ bytes: bytes[manifest.wasm]! });
    try {
      const created = await transport.request({
        op: "create",
        contractVersion: 1,
        policy: config.policy,
        configuration: config.configuration,
        seed: 1,
        cards: [...loaded.dependencies.cards.values()].map((card) => ({
          ...card,
          race: String(card.race),
        })),
      });
      if (created.contractVersion !== 1)
        throw new Error("Unsupported bot create response");
    } finally {
      transport.close();
    }
    await safeRead(manifest.source);
    const visit = async (dir: string): Promise<void> => {
      for (const entry of await readdir(path.join(folder, dir), {
        withFileTypes: true,
      })) {
        if (entry.name === "target") continue;
        const file = `${dir}/${entry.name}`;
        if (entry.isSymbolicLink())
          throw new Error(`Symlink in bot source: ${file}`);
        if (entry.isDirectory()) await visit(file);
        else if (entry.isFile()) bytes[file] = await safeRead(file);
      }
    };
    await visit("ai");
    bot = {
      kind: "package",
      policy: config.policy,
      configuration: config.configuration,
      deck,
    };
  }
  if (config.strategy) {
    bytes["strategy.mjs"] = await readFile(
      path.resolve(folder, config.strategy),
    );
    const module = new SourceTextModule(
      Buffer.from(bytes["strategy.mjs"]!).toString(),
      {
        context: createContext(
          {},
          { codeGeneration: { strings: false, wasm: false } },
        ),
      },
    );
    await module.link(() => {
      throw new Error("Strategy imports forbidden");
    });
    await module.evaluate({ timeout: 1000 });
    if (
      typeof (module.namespace as unknown as Record<string, unknown>)
        .createStrategy !== "function"
    )
      throw new Error("Strategy must export createStrategy");
  }
  const files = Object.fromEntries(
    Object.keys(bytes)
      .sort()
      .map((file) => [file, digest(bytes[file]!)]),
  );
  const frozen: FrozenBot = {
    ...bot,
    files,
    identity: identity({ ...bot, files }),
  };
  return {
    folder,
    configPath,
    original,
    config,
    content,
    loaded,
    banlistBytes,
    banlist,
    frozen,
    bytes,
  };
}

/** Same section, alias and copy-limit rules as Rust evaluator config::validate_deck. */
function validateDeck(
  deck: ParsedDeck,
  cards: Awaited<
    ReturnType<typeof loadCriticalInputs>
  >["dependencies"]["cards"],
  rules: { defaultLimit: number; limits: Record<string, number> },
) {
  if (
    deck.main.length < 40 ||
    deck.main.length > 60 ||
    deck.extra.length > 15 ||
    deck.side.length > 15
  )
    throw new Error("Illegal deck sizes");
  const counts = new Map<number, number>();
  for (const section of ["main", "extra", "side"] as const)
    for (const code of deck[section]) {
      const card = cards.get(code);
      if (!card) throw new Error(`Unavailable card: ${code}`);
      const extra = (card.type & (0x40 | 0x2000 | 0x800000 | 0x4000000)) !== 0;
      if (
        (section === "main" && extra) ||
        (section === "extra" && !extra) ||
        card.type & 0x4000
      )
        throw new Error(`Illegal card placement: ${code}`);
      const alias = card.alias || code;
      counts.set(alias, (counts.get(alias) ?? 0) + 1);
    }
  for (const [code, n] of counts)
    if (n > (rules.limits[String(code)] ?? rules.defaultLimit))
      throw new Error(`Copy restriction exceeded: ${code}`);
}
