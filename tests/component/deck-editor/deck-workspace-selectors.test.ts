// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import DeckWorkspace from "../../../src/deck-editor/components/DeckWorkspace.svelte";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

describe("deck workspace selector contract", () => {
  it("exposes every deck zone through its data-cy", () => {
    const { container } = render(DeckWorkspace, {
      deck: deckFixture(3),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
    });
    for (const zone of ["main", "extra", "side"])
      expect(
        container.querySelector(`[data-cy="deck-zone-${zone}"]`),
        `deck-zone-${zone} is missing`,
      ).not.toBeNull();
  });
});
