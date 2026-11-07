import { cardFrameOf } from "../../src/cards/index.ts";
/** Evaluator-only asynchronous transport; application transport is separate. */
import type { Artifact } from "../bot-evaluation/host-inputs.ts";
import { instantiate } from "../bot-evaluation/host-inputs.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type {
  BotDecisionInput,
  BotSideboardInput,
  BotDecision,
  BotSideboardDecision,
} from "../../src/battle/worker/bot/bot-contract.ts";
import { guardedBot } from "../../src/battle/worker/bot-runtime/loaded-bot.ts";
import { createBasicBotModule } from "../../src/battle/worker/bot/basic-bot.ts";
import type { BotTransport } from "../../src/battle/worker/bot-runtime/transport.ts";
import { nativeTransport, wasmTransport } from "./transport.ts";
export interface HostBot {
  decide(input: BotDecisionInput): BotDecision | Promise<BotDecision>;
  sideboard(
    input: BotSideboardInput,
  ): BotSideboardDecision | Promise<BotSideboardDecision>;
  close?(): void;
  readonly fallbackCount?: number;
}
export async function instantiateHostBot(
  artifact: Artifact,
  dependencies: ActiveDuelDependencies,
  options: {
    development?: boolean;
    seed?: number;
    onFallback?: (event: unknown) => void;
    transport?: () => Promise<BotTransport>;
  } = {},
): Promise<HostBot> {
  if (!artifact.module.startsWith("experiment:"))
    return instantiate(artifact, dependencies, options.seed);
  const [, target, policy] = artifact.module.split(":");
  if (
    !["native", "wasm"].includes(target!) ||
    !["basic", "generalist", "random"].includes(policy!)
  )
    throw new Error("Unsupported experiment bot");
  let transport: BotTransport | undefined;
  let initialFailure: { error: unknown; input: unknown } | undefined;
  try {
    transport = await (options.transport?.() ??
      (target === "native" ? nativeTransport() : wasmTransport()));
    await transport.request({
      op: "create",
      contractVersion: 1,
      policy,
      configuration: artifact.config,
      seed: options.seed ?? 1,
      cards: [...dependencies.cards.values()].map((c) => ({
        ...c,
        race: String(c.race),
      })),
    });
  } catch (error) {
    initialFailure = {
      error,
      input: { op: "create", policy, configuration: artifact.config, seed: 1 },
    };
    transport?.close();
    transport = {
      request: async () => {
        throw error;
      },
      close() {},
    };
  }
  const guarded = guardedBot(
    transport!,
    createBasicBotModule(dependencies).create({}),
    artifact.module,
    options.development ?? process.env.NODE_ENV === "development",
    (deck) => {
      for (const section of ["main", "extra"] as const)
        for (const code of deck[section]) {
          const card = dependencies.cards.get(code);
          const extra =
            card !== undefined &&
            ["fusion", "synchro", "xyz", "link"].includes(
              cardFrameOf(card.type),
            );
          if (!card || extra !== (section === "extra"))
            throw new Error("Sideboard card is in an invalid deck section");
        }
    },
    initialFailure,
  );
  let reported = 0;
  function report() {
    if (guarded.fallbackCount > reported) {
      reported = guarded.fallbackCount;
      options.onFallback?.({
        type: "fallback",
        bot: artifact.module,
        count: reported,
      });
    }
  }
  report();
  return {
    get fallbackCount() {
      return guarded.fallbackCount;
    },
    async decide(input) {
      try {
        return await guarded.decide(input);
      } finally {
        report();
      }
    },
    async sideboard(input) {
      try {
        return await guarded.sideboard(input);
      } finally {
        report();
      }
    },
    close: () => guarded.dispose(),
  };
}
