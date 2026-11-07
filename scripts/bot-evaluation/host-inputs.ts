import { randomWords } from "../bot-improvement/session-fixtures.ts";
import { loadCriticalInputs } from "./critical-inputs.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import vm from "node:vm";
import { loadActiveDuelDependenciesNode } from "../../src/battle/worker/assets/active-duel-dependencies-node.ts";
import {
  buildRuntimeSnapshotManifest,
  verifyRuntimeSnapshotFiles,
} from "../../src/battle/worker/assets/runtime-snapshot-node.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type {
  BotConfiguration,
  BotInstance,
} from "../../src/battle/worker/bot/bot-contract.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";
export interface Artifact {
  module: string;
  source: string;
  dependencies: { path: string; source: string }[];
  config: BotConfiguration;
}
export async function loadInputs(
  snapshot: string,
  codes: number[],
  bots: { module: string; config: BotConfiguration }[],
  critical = false,
) {
  const { manifest, dependencies } = critical
    ? await loadCriticalInputs(snapshot)
    : await (async () => {
        const manifest = await buildRuntimeSnapshotManifest(
          snapshot,
          path.resolve("vendor/ocgcore-wasm/0.1.2"),
        );
        await verifyRuntimeSnapshotFiles(manifest, snapshot);
        const dependencies = await loadActiveDuelDependenciesNode(
          snapshot,
          new Set(codes.map(cardCode)),
        );
        return { manifest, dependencies };
      })();
  const artifacts = await Promise.all(
    bots.map(async (bot) => {
      if (
        /^experiment:(native|wasm):(basic|generalist|random)$/.test(bot.module)
      )
        return { ...bot, source: "", dependencies: [] };
      const entry =
        bot.module === "builtin:basic" ||
        bot.module === "builtin:generalist" ||
        bot.module === "builtin:random"
          ? path.resolve(`src/battle/worker/bot/${bot.module.slice(8)}-bot.ts`)
          : bot.module;
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
      const dependencies = await Promise.all(
        Object.keys(built.metafile!.inputs)
          .sort()
          .map(async (file) => ({
            path: path.resolve(file),
            source: await readFile(file, "utf8"),
          })),
      );
      return { ...bot, source, dependencies };
    }),
  );
  return { manifest, dependencies, artifacts };
}
// The built-in module has no game state at module scope; its factory creates
// a fresh policy instance. Cache its executable code exactly as the actual
// runtime does. External artifacts still receive a fresh VM realm per hook.
const basicFactories = new WeakMap<
  Artifact,
  { create: (config: BotConfiguration) => BotInstance }
>();
/** New collectible VM realm per instance prevents bundled module globals crossing games. */
export async function instantiate(
  artifact: Artifact,
  dependencies: ActiveDuelDependencies,
  seed?: number,
): Promise<BotInstance> {
  const cached = basicFactories.get(artifact);
  if (cached) return cached.create(artifact.config);
  const context = vm.createContext(
    { structuredClone, performance },
    { codeGeneration: { strings: false, wasm: false } },
  );
  const module = new vm.SourceTextModule(artifact.source, { context });
  await module.link(() => {
    throw new Error("Unbundled bot import");
  });
  await module.evaluate();
  const ns = module.namespace as unknown as {
    createBotModule?: (d: Pick<ActiveDuelDependencies, "cards">) => {
      contractVersion: number;
      create: (c: BotConfiguration) => BotInstance;
    };
    createGeneralistBotModule?: (d: ActiveDuelDependencies) => {
      create: (c: BotConfiguration) => BotInstance;
    };
    createRandomBotModule?: (random: () => number) => {
      create: (c: BotConfiguration) => BotInstance;
    };
    createBasicBotModule?: (d: ActiveDuelDependencies) => {
      create: (c: BotConfiguration) => BotInstance;
    };
    default?: {
      contractVersion: number;
      create: (c: BotConfiguration) => BotInstance;
    };
    contractVersion?: number;
    create?: (c: BotConfiguration) => BotInstance;
  };
  if (
    artifact.module === "builtin:basic" ||
    artifact.module === "builtin:generalist"
  ) {
    const factory =
      artifact.module === "builtin:basic"
        ? ns.createBasicBotModule!(dependencies)
        : ns.createGeneralistBotModule!(dependencies);
    basicFactories.set(artifact, factory);
    return factory.create(artifact.config);
  }
  if (artifact.module === "builtin:random" && seed !== undefined) {
    const next = randomWords(String(seed));
    return ns.createRandomBotModule!(() => next() / 2 ** 32).create(
      artifact.config,
    );
  }
  const factory =
    ns.createBotModule?.(
      vm.runInContext(
        `({ cards: new Map(JSON.parse(${JSON.stringify(JSON.stringify([...dependencies.cards], (_key, value: unknown) => (typeof value === "bigint" ? { $bigint: String(value) } : value)))}, (_key, value) => value && typeof value === "object" && "$bigint" in value ? BigInt(value.$bigint) : value)) })`,
        context,
      ),
    ) ??
    ns.default ??
    ns;
  if (factory.contractVersion !== 1 || typeof factory.create !== "function")
    throw new Error("Unsupported bot contract");
  const instance = factory.create(structuredClone(artifact.config));
  if (
    typeof instance.decide !== "function" ||
    typeof instance.sideboard !== "function"
  )
    throw new Error("Bot requires decide and sideboard hooks");
  return instance;
}
