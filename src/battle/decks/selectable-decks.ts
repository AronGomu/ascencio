import type { DeckBuilderCardView } from "../../decks/catalog/ocg-card-mapper.ts";
import type { PinnedDeckRuleset } from "../../decks/catalog/pinned-ruleset.ts";
import { resolveDeck, type DeckRepository } from "../../decks/index.ts";
import type { DeckMetadata } from "../duel/presets/deck-catalog.ts";
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
}

/**
 * The decks a seat may be given, bundled first.
 *
 * A local deck earns its row twice over: `resolveDeck` must call it `ready`
 * against the pinned ruleset, and every code it holds must be one the active
 * snapshot can play. Anything else is left out without a word — an offered
 * deck that the Worker then refuses is a worse failure than a deck the player
 * never saw, because the refusal arrives after they chose it.
 *
 * Nothing here writes. A deck that misses by one card stays exactly as its
 * owner left it; the editor is where a deck is repaired, not the picker.
 */
export async function listSelectableDecks(
  presets: readonly DeckMetadata[],
  repository: Pick<DeckRepository, "list" | "load">,
  catalog: ReadonlyMap<number, DeckBuilderCardView>,
  ruleset: PinnedDeckRuleset,
  supportedCodes: ReadonlySet<number>,
): Promise<readonly SelectableDeck[]> {
  const selectable: SelectableDeck[] = [...presetSelectableDecks(presets)];

  for (const record of await repository.list()) {
    const resolved = await resolveDeck(record.id, repository, catalog, ruleset);
    if (resolved.type !== "ready") continue;
    const { deck } = resolved;
    const codes = [...deck.main, ...deck.extra, ...deck.side];
    if (!codes.every((code) => supportedCodes.has(code))) continue;
    selectable.push(
      Object.freeze({
        key: `local:${deck.ref.deckId}:${deck.ref.revision}`,
        label: deck.name,
        source: "local" as const,
        selection: Object.freeze({ kind: "local" as const, deck }),
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

/**
 * The codes this build can put on a board: packaged card text and packaged
 * art, which is the pair the Worker itself demands before it will create a
 * session. Deriving it here from the same two build-time manifests is what
 * lets the picker predict that refusal instead of provoking it.
 */
export function supportedDuelCardCodes(): ReadonlySet<number> {
  const described = new Set(__ACTIVE_CARD_TEXTS__.map(({ code }) => code));
  return new Set(
    __ACTIVE_IMAGE_MANIFEST__.files
      .map(({ code }) => code)
      .filter((code) => described.has(code)),
  );
}
