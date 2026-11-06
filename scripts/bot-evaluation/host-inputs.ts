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
) {
  const manifest = await buildRuntimeSnapshotManifest(
    snapshot,
    path.resolve("vendor/ocgcore-wasm/0.1.2"),
  );
  await verifyRuntimeSnapshotFiles(manifest, snapshot);
  const dependencies = await loadActiveDuelDependenciesNode(
    snapshot,
    new Set(codes.map(cardCode)),
  );
  const artifacts = await Promise.all(
    bots.map(async (bot) => {
      const entry =
        bot.module === "builtin:basic"
          ? path.resolve("src/battle/worker/bot/basic-bot.ts")
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
/** New collectible VM realm per instance prevents bundled module globals crossing games. */
export async function instantiate(
  artifact: Artifact,
  dependencies: ActiveDuelDependencies,
): Promise<BotInstance> {
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
  if (artifact.module === "builtin:basic")
    return ns.createBasicBotModule!(dependencies).create(artifact.config);
  const factory = ns.default ?? ns;
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
