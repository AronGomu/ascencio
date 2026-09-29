import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
} from "../../fixtures/sqlite-deck-repository.ts";
// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createBlankDeck } from "../../../src/decks/deck-model.ts";
import { emptyDeckHistory } from "../../../src/decks/deck-history.ts";
import { resolveDeck } from "../../../src/decks/deck-resolver.ts";

import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";

afterEach(async () => disposeTestDeckRepositories());

describe("deck resolver + SQLite", () => {
  it("returns invalid persisted drafts by deck ID", async () => {
    const name = "resolver-integration";
    const catalog = catalogByCode(PROTOTYPE_CATALOG);
    const repo = await openTestDeckRepository(name);
    const draft = createBlankDeck("Invalid", catalog, PROTOTYPE_RULESET, {
      id: "invalid",
    });
    const stored = await repo.create(draft, emptyDeckHistory());
    await expect(
      resolveDeck(stored.deck.id, repo, catalog, PROTOTYPE_RULESET),
    ).resolves.toMatchObject({
      type: "invalid",
      deckId: stored.deck.id,
    });
    await repo.close();
  });
});
