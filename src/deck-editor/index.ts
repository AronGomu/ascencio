/** Public contract of the deck-editor domain. The shell and any later
    cross-domain caller import from here only — nothing reaches past this file
    into `components/`, `fixtures/` or the store. Deck data itself stays behind
    `src/decks/index.ts`. */
export { default } from "./DeckEditorApp.svelte";
export type { DeckEditorRoute } from "./deck-editor-route.ts";
