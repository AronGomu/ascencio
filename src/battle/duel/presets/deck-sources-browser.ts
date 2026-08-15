import burningAbyssSource from "./decks/burning-abyss.ydk?raw";
import nekrozSource from "./decks/nekroz.ydk?raw";
import opponentSource from "./decks/opponent.ydk?raw";
import playerSource from "./decks/player.ydk?raw";
import shaddollSource from "./decks/shaddoll.ydk?raw";
import spellbookSource from "./decks/spellbook.ydk?raw";
import type { DeckId } from "./deck-catalog.ts";

export const DECK_SOURCES: ReadonlyMap<DeckId, string> = Object.freeze(
  new Map<DeckId, string>([
    ["mvp-player", playerSource],
    ["mvp-opponent", opponentSource],
    ["burning-abyss", burningAbyssSource],
    ["nekroz", nekrozSource],
    ["shaddoll", shaddollSource],
    ["spellbook", spellbookSource],
  ]),
);
