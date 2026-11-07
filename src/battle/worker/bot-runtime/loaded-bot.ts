import { cardFrameOf } from "../../../cards/index.ts";
import type { ParsedDeck } from "../../duel/presets/deck-parser.ts";
import { validateSideboard } from "../bot/sideboard.ts";
import type { BotSelection } from "../../duel/contracts/bot-selection.ts";
import type { PinnedBotPackage } from "../../duel/contracts/bot-package.ts";
import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import type {
  BotDecision,
  BotDecisionInput,
  BotSideboardInput,
  BotSideboardDecision,
  BotInstance,
} from "../bot/bot-contract.ts";
import { createBasicBotModule } from "../bot/basic-bot.ts";
import { createGeneralistBotModule } from "../bot/generalist-bot.ts";
import { createRandomBotModule } from "../bot/random-bot.ts";
import { validateBotDecision } from "../bot/validate-bot-decision.ts";
import { legalSelection, selectionCounts } from "../bot/legal-selection.ts";
import { bindPromptInstances } from "../bot/prompt-instances.ts";
import { createWasmTransport } from "./wasm-transport.ts";
import { botHostRpc } from "./host-rpc.ts";
import type { BotTransport, BotTransportMetrics } from "./transport.ts";
import type { AsyncOpponentPolicy } from "../opponent/async-opponent-policy.ts";
export interface LoadedBot {
  decide(input: BotDecisionInput): Promise<BotDecision>;
  sideboard(input: BotSideboardInput): Promise<BotSideboardDecision>;
  dispose(): void;
  readonly fallbackCount: number;
  readonly failures: readonly unknown[];
  readonly version: string;
  memoryBytes?(): Promise<number | null>;
  recreate?(): Promise<LoadedBot>;
}
export function guardedBot(
  transport: BotTransport,
  fallback: BotInstance,
  version: string,
  development: boolean,
  validateDeck: (deck: ParsedDeck) => void = () => {},
  initialFailure?: { error: unknown; input: unknown },
): LoadedBot {
  let closed = false,
    degraded = false,
    count = 0;
  const failures: unknown[] = [];
  function fail(error: unknown, input: unknown) {
    degraded = true;
    count++;
    transport.close();
    if (development) {
      const trace = {
        at: new Date().toISOString(),
        version,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        input: structuredClone(input),
      };
      failures.push(trace);
      console.warn("AI recovered using the built-in policy", trace);
      globalThis.postMessage?.({
        type: "botWarning",
        message:
          "AI recovered using the built-in policy. Diagnostic details are in the development console.",
      });
    }
  }
  if (initialFailure) fail(initialFailure.error, initialFailure.input);
  return {
    version,
    get fallbackCount() {
      return count;
    },
    get failures() {
      return failures;
    },
    dispose() {
      if (closed) return;
      closed = true;
      transport.close();
    },
    async decide(input) {
      if (closed) throw new Error("Bot disposed");
      if (!degraded) {
        try {
          const decision = (await transport.request({
            op: "decide",
            input,
          })) as BotDecision;
          if (closed) throw new Error("Bot disposed");
          if (
            Array.isArray(decision?.choiceIds) &&
            decision.choiceIds.length > 4096
          )
            throw new Error("Bot decision exceeds choice limit");
          validateBotDecision(input.prompt, decision);
          return decision;
        } catch (error) {
          if (closed) throw error;
          fail(error, input);
        }
      }
      let decision: BotDecision;
      try {
        decision = fallback.decide(input);
        validateBotDecision(input.prompt, decision);
      } catch {
        decision = {
          choiceIds: legalSelection(
            input.prompt,
            input.prompt.choices,
            selectionCounts(input.prompt),
          ),
          reason: {
            code: "runtime_fallback",
            explanation: "Select a validated legal response after AI failure.",
          },
        };
        validateBotDecision(input.prompt, decision);
      }
      return decision;
    },
    async sideboard(input) {
      if (closed) throw new Error("Bot disposed");
      if (!degraded) {
        try {
          const result = (await transport.request({
            op: "sideboard",
            input,
          })) as BotSideboardDecision;
          if (closed) throw new Error("Bot disposed");
          validateSideboard(input.deck, result, validateDeck);
          return result;
        } catch (error) {
          if (closed) throw error;
          fail(error, input);
        }
      }
      return {
        exchanges: [],
        reason: {
          code: "runtime_fallback",
          explanation: "Retain the validated deck after AI failure.",
        },
      };
    },
  };
}
export async function loadBot(
  selection: BotSelection,
  dependencies: ActiveDuelDependencies,
  development = import.meta.env?.DEV ?? false,
  observe?: (metrics: BotTransportMetrics) => void,
  seed?: number,
): Promise<LoadedBot> {
  if (selection.runtime === "typescript") {
    let closed = false,
      rng = (seed ?? 1) >>> 0 || 1;
    const random =
      seed === undefined
        ? undefined
        : () => {
            rng ^= rng << 13;
            rng ^= rng >>> 17;
            rng ^= rng << 5;
            return (rng >>> 0) / 4294967296;
          };
    const bot = (
      selection.policy === "basic"
        ? createBasicBotModule(dependencies)
        : selection.policy === "generalist"
          ? createGeneralistBotModule(dependencies)
          : createRandomBotModule(random)
    ).create({});
    return {
      version: `builtin:${selection.policy}`,
      fallbackCount: 0,
      failures: [],
      async decide(input) {
        if (closed) throw new Error("Bot disposed");
        const start = performance.now();
        const value = bot.decide(input);
        observe?.({
          computationMs: performance.now() - start,
          roundtripMs: performance.now() - start,
          memoryBytes: 0,
        });
        return value;
      },
      async sideboard(input) {
        if (closed) throw new Error("Bot disposed");
        return bot.sideboard(input);
      },
      dispose() {
        closed = true;
      },
      recreate: () =>
        loadBot(selection, dependencies, development, observe, seed),
    };
  }
  // Pin once per duel. Updates to installed files cannot change this snapshot.
  const pinned = (await botHostRpc({
    method: "pin",
    payload: { selection },
  })) as PinnedBotPackage;
  return createPinnedBot(
    pinned,
    selection,
    dependencies,
    development,
    seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!,
    observe,
  );
}
async function createPinnedBot(
  pinned: PinnedBotPackage,
  selection: BotSelection,
  dependencies: ActiveDuelDependencies,
  development: boolean,
  seed: number,
  observe?: (metrics: BotTransportMetrics) => void,
): Promise<LoadedBot> {
  const fallback = createBasicBotModule(dependencies).create({});
  const validateDeck = (deck: ParsedDeck) => {
    for (const section of ["main", "extra"] as const)
      for (const code of deck[section]) {
        const card = dependencies.cards.get(code);
        const extra =
          card !== undefined &&
          ["fusion", "synchro", "xyz", "link"].includes(cardFrameOf(card.type));
        if (!card || extra !== (section === "extra"))
          throw new Error("Sideboard card is in an invalid deck section");
      }
  };

  let transport: BotTransport | undefined;
  try {
    if (selection.runtime === "wasm")
      transport = await createWasmTransport(pinned.bytes, observe);
    else {
      const session = (await botHostRpc({
        method: "nativeOpen",
        payload: { digest: pinned.digest },
      })) as string;
      let closed = false;
      transport = {
        async request(value) {
          const response = (await botHostRpc({
            method: "nativeRequest",
            payload: { session, request: JSON.stringify(value) },
          })) as { ok: unknown; error?: string; computeNs: number };
          observe?.({
            computationMs: response.computeNs / 1e6,
            roundtripMs: 0,
            memoryBytes: 0,
          });
          if (response.error) throw new Error(response.error);
          return response.ok;
        },
        memoryBytes: () =>
          botHostRpc({
            method: "nativeMemory",
            payload: { session },
          }) as Promise<number | null>,
        close() {
          if (closed) return;
          closed = true;
          void botHostRpc({
            method: "nativeClose",
            payload: { session },
          }).catch(() => {});
        },
      };
    }
    await transport.request({
      op: "create",
      contractVersion: 1,
      policy: selection.policy,
      configuration: {},
      seed,
      cards: [...dependencies.cards.values()].map((c) => ({
        ...c,
        race: String(c.race),
      })),
    });
  } catch (error) {
    transport?.close();
    const failed = {
      request: async () => {
        throw error;
      },
      close() {},
    };
    const guarded = guardedBot(
      failed,
      fallback,
      `${pinned.manifest.packageVersion}:${pinned.digest}`,
      development,
      validateDeck,
      { error, input: { op: "create", policy: selection.policy, seed } },
    );
    return Object.assign(guarded, {
      memoryBytes: () => transport?.memoryBytes?.() ?? Promise.resolve(null),
      recreate: () =>
        createPinnedBot(
          pinned,
          selection,
          dependencies,
          development,
          seed,
          observe,
        ),
    });
  }
  const guarded = guardedBot(
    transport,
    fallback,
    `${pinned.manifest.packageVersion}:${pinned.digest}`,
    development,
    validateDeck,
  );
  return Object.assign(guarded, {
    memoryBytes: () => transport?.memoryBytes?.() ?? Promise.resolve(null),
    recreate: () =>
      createPinnedBot(
        pinned,
        selection,
        dependencies,
        development,
        seed,
        observe,
      ),
  });
}
export function loadedBotPolicy(bot: LoadedBot): AsyncOpponentPolicy {
  return {
    async choose(prompt, state) {
      const input = {
        prompt: bindPromptInstances(prompt, state.publicState),
        observation: state,
      };
      const decision = await bot.decide(input);
      return {
        choiceIds: [...decision.choiceIds],
        reason: decision.reason.code,
        explanation: decision.reason.explanation,
      };
    },
    dispose: () => bot.dispose(),
  };
}
