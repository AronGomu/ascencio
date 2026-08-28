import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
import { resolveDeck, type DeckRepository } from "../../decks/index.ts";
import type { DeckId, DeckMetadata } from "../duel/presets/deck-catalog.ts";
import { parseYdk } from "../duel/presets/deck-parser.ts";
import { DECK_SOURCES } from "../duel/presets/deck-sources-browser.ts";
import type { BattleDeckSelection } from "../battle-contracts.ts";

/** One row of the pre-duel picker: a bundled deck this build ships, or a deck
    the player built that this build can actually play. */
export interface SelectableDeck {
  /** Stable across a reload, and changes when the deck changes: a persisted
      key that still resolves names the same 40 cards it named yesterday. */
  readonly key: string;
  readonly label: string;
  readonly source: "preset" | "local";
  readonly selection: BattleDeckSelection;
  /** The deck's cards, for tiles: counts, cover art, hover decklists. The
      cover is derived rather than stored — `lists.extra[0] ?? lists.main[0]` —
      so a deck edited into a different theme never keeps yesterday's face. */
  readonly lists: Readonly<{
    readonly main: readonly number[];
    readonly extra: readonly number[];
    readonly side: readonly number[];
  }>;
  /** When the deck was last saved, for a tile sorted by recency. `null` for a
      preset: it is compiled into this build and was never saved at all. */
  readonly updatedAt: string | null;
}

/* A bundled deck absent from `DECK_SOURCES` is one the Worker could not draw
   either — it reads the same map — so an empty list here reports a broken
   build rather than inventing one. */
const NO_CARDS: SelectableDeck["lists"] = Object.freeze({
  main: Object.freeze([]),
  extra: Object.freeze([]),
  side: Object.freeze([]),
});

/* The bundled `.ydk` payloads are compiled in, so parsing one is a walk over a
   few hundred digits — but the picker relists on every visit to the match
   setup, and the answer cannot change inside a page: parse the six once. */
let presetLists: ReadonlyMap<DeckId, SelectableDeck["lists"]> | null = null;

function listsOfPreset(id: DeckId): SelectableDeck["lists"] {
  presetLists ??= Object.freeze(
    new Map(
      [...DECK_SOURCES].map(([deckId, source]) => {
        const { main, extra, side } = parseYdk(source);
        return [deckId, Object.freeze({ main, extra, side })] as const;
      }),
    ),
  );
  return presetLists.get(id) ?? NO_CARDS;
}

/**
 * The decks a seat may be given, bundled first.
 *
 * A local deck earns its row by resolving `ready` against `catalog` and the
 * pinned ruleset — and `catalog` is the one the editor built the deck against,
 * so a code this build cannot play is already a `missing-card` error there.
 * Anything short of `ready` is left out without a word: an offered deck that
 * the Worker then refuses is a worse failure than a deck the player never saw,
 * because the refusal arrives after they chose it.
 *
 * Nothing here writes. A deck that misses by one card stays exactly as its
 * owner left it; the editor is where a deck is repaired, not the picker.
 */
export async function listSelectableDecks(
  presets: readonly DeckMetadata[],
  repository: Pick<DeckRepository, "list" | "load">,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
): Promise<readonly SelectableDeck[]> {
  const selectable: SelectableDeck[] = [...presetSelectableDecks(presets)];

  for (const record of await repository.list()) {
    const resolved = await resolveDeck(record.id, repository, catalog, ruleset);
    if (resolved.type !== "ready") continue;
    const { deck } = resolved;
    selectable.push(
      Object.freeze({
        key: `local:${deck.ref.deckId}:${deck.ref.revision}`,
        label: deck.name,
        source: "local" as const,
        selection: Object.freeze({ kind: "local" as const, deck }),
        /* The snapshot's own arrays, already frozen by `resolveDeck`: the row
           a tile counts is the one the seat will be given. */
        lists: Object.freeze({
          main: deck.main,
          extra: deck.extra,
          side: deck.side,
        }),
        /* From the listed record rather than the resolution, which reports
           what the deck holds and not when its owner last touched it. */
        updatedAt: record.updatedAt,
      }),
    );
  }

  return Object.freeze(selectable);
}

/**
 * The bundled half of the list, without touching storage.
 *
 * A host renders this the moment the picker opens and replaces it when the
 * full listing lands. Bundled decks are compiled into the build, so making a
 * player wait on an IndexedDB read before they can pick one — or worse,
 * showing them a picker with nothing in it — would be a delay this build
 * never has to impose.
 */
export function presetSelectableDecks(
  presets: readonly DeckMetadata[],
): readonly SelectableDeck[] {
  return Object.freeze(
    presets.map((preset) =>
      Object.freeze({
        key: `preset:${preset.id}`,
        label: preset.name,
        source: "preset" as const,
        selection: Object.freeze({
          kind: "preset" as const,
          deckId: preset.id,
        }),
        lists: listsOfPreset(preset.id),
        updatedAt: null,
      }),
    ),
  );
}

export function findSelectableDeck(
  decks: readonly SelectableDeck[],
  key: string,
): SelectableDeck | null {
  return decks.find((deck) => deck.key === key) ?? null;
}
