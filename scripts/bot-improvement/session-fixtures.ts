import { createHash } from "node:crypto";
import type { ParsedDeck } from "../../src/battle/duel/presets/deck-parser.ts";
import type { FrozenSetup } from "./session-contract.ts";

export const digest = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
export const identity = (value: unknown) => digest(JSON.stringify(value));

/** Domain-separated deterministic random streams; rejection sampling avoids modulo bias. */
export function randomWords(seed: string) {
  let counter = 0;
  return () => Number.parseInt(digest(`${seed}:${counter++}`).slice(0, 8), 16);
}
export function deckOrder(deck: ParsedDeck, seed: string) {
  const next = randomWords(seed);
  const shuffle = (cards: readonly number[]) => {
    const result = [...cards];
    for (let i = result.length - 1; i > 0; i--) {
      const limit = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      let n = next();
      while (n >= limit) n = next();
      const j = n % (i + 1);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  };
  return { main: shuffle(deck.main), extra: shuffle(deck.extra) };
}
export function schedule(
  seed: string,
  target: ParsedDeck,
  opponents: ParsedDeck[],
): FrozenSetup["matches"] {
  const slots = [...opponents, target];
  return Array.from({ length: 500 }, (_, m) => {
    const slot = m % slots.length;
    const key = `${seed}/match/${m + 1}`;
    const word = randomWords(`${key}/sideboard`);
    return {
      id: `match-${String(m + 1).padStart(4, "0")}`,
      opponentSlot: slot === opponents.length ? "self" : `opponent-${slot + 1}`,
      sideboardSeeds: [word(), word()],
      games: Array.from({ length: 4 }, (_, g) => {
        const game = `${key}/game/${g + 1}`;
        const botWord = randomWords(`${game}/bot`);
        const shuffleSeeds = [
          digest(`${game}/shuffle/a`),
          digest(`${game}/shuffle/b`),
        ];
        return {
          number: g + 1,
          stage: g < 2 ? "pre_side" : "post_side",
          starter: g % 2 === 0 ? "a" : "b",
          engineSeed: Array.from({ length: 4 }, (_, i) =>
            BigInt(
              `0x${digest(`${game}/engine/${i}`).slice(0, 16)}`,
            ).toString(),
          ),
          botSeeds: [botWord(), botWord()],
          shuffleSeeds,
          orders:
            g < 2
              ? [
                  deckOrder(target, shuffleSeeds[0]!),
                  deckOrder(slots[slot]!, shuffleSeeds[1]!),
                ]
              : null,
        };
      }),
    };
  });
}
