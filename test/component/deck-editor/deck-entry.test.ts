import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
  withTestDeckDatabase,
} from "../../fixtures/sqlite-deck-repository.ts";
// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { get } from "svelte/store";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";

import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/validation/index.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";
import { deckId } from "../../../src/decks/contracts/index.ts";

afterEach(async () => disposeTestDeckRepositories());

describe("deck editor entry", () => {
  it("opens last-opened deck and clears stale pointers", async () => {
    const name = "entry-routing";
    const repo = await openTestDeckRepository(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    expect(get(controller).mode).toBe("library");
    await controller.createDeck("Last opened");
    const id = get(controller).current!.deck.id;
    expect(await repo.getLastOpened()).toBe(id);

    const next = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await next.initialize();
    expect(get(next).mode).toBe("editor");
    expect(get(next).current?.deck.id).toBe(id);

    withTestDeckDatabase(name, (database) => {
      database
        .prepare(
          "UPDATE user_records SET payload_json=? WHERE namespace=? AND record_key=?",
        )
        .run(JSON.stringify(deckId("stale")), "deck-meta", "lastOpened");
    });
    const stale = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await stale.initialize();
    expect(get(stale).mode).toBe("library");
    expect(await repo.getLastOpened()).toBeNull();
    await repo.close();
  });
});
