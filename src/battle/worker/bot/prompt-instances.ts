import type {
  PlayerPrompt,
  PromptCard,
} from "../../duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../duel/contracts/public-duel-state.ts";
/** Bind permitted legal choices to observed instances. Engine prompt codes are not visibility authority. */
export function bindPromptInstances(
  prompt: PlayerPrompt,
  state: PublicDuelState | undefined,
): PlayerPrompt {
  if (!state) return prompt;
  const bind = (card: PromptCard): PromptCard => {
    const player = state.players[card.controller];
    const cards = [
      ...player.hand,
      ...player.deck,
      ...player.monsters,
      ...player.spellsAndTraps,
      ...player.extraDeck,
      ...player.graveyard,
      ...player.banished,
    ];
    const found = cards.find(
      (c) => c.location === card.location && c.sequence === card.sequence,
    );
    const visible =
      card.controller === prompt.player ||
      (card.overlay
        ? cards.some((c) =>
            c.overlayMaterials.some(
              (m) => m.identityVisible && m.code === card.code,
            ),
          )
        : found?.code !== undefined);
    const { code, name, description, ...address } = card;
    return {
      ...address,
      ...(found && !card.overlay ? { instanceId: found.instanceId } : {}),
      ...(visible
        ? {
            ...(code === undefined ? {} : { code }),
            ...(name === undefined ? {} : { name }),
            ...(description === undefined ? {} : { description }),
          }
        : {}),
    };
  };
  const context = prompt.contextCard ? bind(prompt.contextCard) : undefined;
  return {
    ...prompt,
    ...(context ? { contextCard: context } : {}),
    choices: prompt.choices.map((choice) => {
      if (!choice.card) return choice;
      const card = bind(choice.card);
      return {
        ...choice,
        card,
        ...(card.code === undefined ? { label: "Concealed card" } : {}),
      };
    }),
  };
}
