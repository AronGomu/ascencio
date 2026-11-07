/** Environment-neutral real-engine game used by browser and native-webview smoke. */
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import { ActorObservation } from "../../src/battle/worker/bot/actor-observation.ts";
import { PromptRegistry } from "../../src/battle/worker/protocol/PromptRegistry.ts";
import { bindPromptInstances } from "../../src/battle/worker/bot/prompt-instances.ts";
import { toOpponentVisibleState } from "../../src/battle/worker/opponent/OpponentPolicy.ts";
import { validateBotDecision } from "../../src/battle/worker/bot/validate-bot-decision.ts";
import { EngineMessageType } from "../../src/battle/worker/engine/engine-constants.ts";
import { snapshotId } from "../../src/battle/duel/contracts/ids.ts";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import type { OcgCoreAdapter } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import type { LoadedBot } from "../../src/battle/worker/bot-runtime/loaded-bot.ts";
import type { BotGameObservation } from "../../src/battle/worker/bot/bot-contract.ts";
export async function playLiveGame(
  adapter: OcgCoreAdapter,
  dependencies: ActiveDuelDependencies,
  decks: [ParsedDeck, ParsedDeck],
  seed: readonly string[],
  bots: readonly [LoadedBot, LoadedBot],
  gameId: string,
) {
  const session = DuelSession.create({
    adapter,
    dependencies,
    playerDeck: decks[0],
    opponentDeck: decks[1],
    configuration: {
      mode: "production",
      rules: "mr5",
      seed: seed.map(BigInt) as [bigint, bigint, bigint, bigint],
    },
    captureStartingOrders: true,
  });
  const observers = ([0, 1] as const).map(
    (actor) =>
      new ActorObservation(
        actor,
        session,
        dependencies,
        snapshotId("bot-experiment"),
        [decks[0].main.length, decks[1].main.length],
        [decks[0].extra.length, decks[1].extra.length],
        true,
      ),
  );
  const registry = new PromptRegistry(dependencies, gameId);
  const histories: [
    BotGameObservation & {
      decisions: BotGameObservation["decisions"][number][];
    },
    BotGameObservation & {
      decisions: BotGameObservation["decisions"][number][];
    },
  ] = [
    { gameId, decisions: [] },
    { gameId, decisions: [] },
  ];
  const events: unknown[][] = [[], []];
  let decisions = 0;
  try {
    for (;;) {
      const boundary = session.processUntilBoundary();
      let result: { winner: 0 | 1 | null; reason: number } | undefined;
      for (const message of boundary.messages) {
        if (message.type === EngineMessageType.RETRY)
          throw new Error("Illegal bot response rejected by engine");
        for (const observer of observers) {
          const update = observer.apply(message);
          if (update.result?.type === "completed")
            result = {
              winner: update.result.winner,
              reason: update.result.reason,
            };
        }
      }
      for (const observer of observers) observer.reconcile();
      if (result) {
        for (const actor of [0, 1] as const)
          Object.assign(histories[actor], {
            events: events[actor],
            outcome:
              result.winner === null
                ? "draw"
                : result.winner === actor
                  ? "win"
                  : "loss",
          });
        return {
          result,
          turns: observers[0]!.snapshot().turn,
          decisions,
          histories,
        };
      }
      let responded = false;
      for (const message of boundary.messages) {
        const published = registry.publish(message);
        if (!published) continue;
        const actor = published.player;
        const observer = observers[actor]!;
        const prompt = bindPromptInstances(published, observer.snapshot());
        const observed = observer.takeEvents();
        events[actor]!.push(...observed);
        const input = {
          prompt,
          observation: toOpponentVisibleState(
            observer.snapshot(),
            actor,
            observed,
          ),
        };
        const decision = await bots[actor].decide(input);
        validateBotDecision(prompt, decision);
        histories[actor].decisions.push({
          ...structuredClone(input),
          decision,
        });
        session.respond(registry.respond(prompt.id, decision.choiceIds));
        responded = true;
        if (++decisions > 100000 || observer.snapshot().turn > 1000)
          throw new Error("Smoke game exceeded execution bound");
      }
      if (!responded) throw new Error("Engine stalled without legal prompt");
    }
  } finally {
    session.dispose();
  }
}
