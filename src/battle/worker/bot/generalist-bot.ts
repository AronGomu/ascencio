import type { ActiveDuelDependencies } from "../assets/active-duel-dependencies.ts";
import type { BotModule } from "./bot-contract.ts";
import { botAsOpponentPolicy } from "./basic-bot.ts";
import {
  baselineStrategy,
  type GeneralistStrategy,
} from "./generalist-strategy.ts";
import { legalSelection, selectionCounts } from "./legal-selection.ts";
import { validateBotDecision } from "./validate-bot-decision.ts";

export function createGeneralistBotModule(
  dependencies: Pick<ActiveDuelDependencies, "cards">,
  strategy: GeneralistStrategy = baselineStrategy(dependencies),
): BotModule {
  return {
    contractVersion: 1,
    create(configuration) {
      if (Object.keys(configuration).length)
        throw new Error("Generalist bot accepts no configuration keys");
      // Bound repeated actions within a turn/phase. IDs are prompt-local, so use
      // physical instances and semantic actions; no hidden engine data is needed.
      let phase = "";
      const attempts = new Map<string, number>();
      return {
        decide(input) {
          const { prompt, observation } = input;
          const nextPhase = `${observation.turn}:${observation.phase}`;
          if (phase !== nextPhase) {
            attempts.clear();
            phase = nextPhase;
          }
          const key = (choice: (typeof prompt.choices)[number]) =>
            JSON.stringify([
              prompt.kind,
              choice.action,
              choice.card?.instanceId,
              choice.value,
            ]);
          const ranked = prompt.choices
            .map((choice) => {
              const scored = strategy(input, choice);
              if (!Number.isFinite(scored.score))
                throw new Error("Strategy score must be finite");
              const repeated =
                (prompt.kind === "idleCommand" ||
                  prompt.kind === "battleCommand") &&
                (attempts.get(key(choice)) ?? 0) >= 2;
              return {
                choice,
                scored,
                score: repeated ? -1e9 : scored.score,
                repeated,
              };
            })
            .sort((a, b) => b.score - a.score);
          const choiceIds = legalSelection(
            prompt,
            ranked.map((r) => r.choice),
            selectionCounts(prompt),
          );
          const first = ranked.find((r) => choiceIds.includes(r.choice.id));
          const decision = {
            choiceIds,
            reason: first?.repeated
              ? {
                  code: "bounded_repeat",
                  explanation:
                    "All higher-ranked alternatives have exhausted their per-phase attempts.",
                }
              : first
                ? {
                    code: first.scored.code,
                    explanation: first.scored.explanation,
                  }
                : {
                    code: "empty_selection",
                    explanation: "The prompt permits an empty response.",
                  },
          };
          validateBotDecision(prompt, decision);
          for (const choice of prompt.choices.filter((c) =>
            choiceIds.includes(c.id),
          ))
            attempts.set(key(choice), (attempts.get(key(choice)) ?? 0) + 1);
          return decision;
        },
        sideboard() {
          return {
            exchanges: [],
            reason: {
              code: "retain_deck",
              explanation:
                "The deck-independent baseline retains the declared deck.",
            },
          };
        },
      };
    },
  };
}

/** Direct runtime injection through HeadlessDuelController's opponentPolicy option. */
export function createGeneralistBotPolicy(
  dependencies: ActiveDuelDependencies,
) {
  return botAsOpponentPolicy(
    createGeneralistBotModule(dependencies).create({}),
  );
}
