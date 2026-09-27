import {
  openTestDeckRepository,
  disposeTestDeckRepositories,
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

afterEach(async () => disposeTestDeckRepositories());

describe("deck history orchestration", () => {
  it("persists illustration changes through Undo/Redo", async () => {
    const name = "controller-illustration-history";
    const repo = await openTestDeckRepository(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("Illustrated");
    await controller.mutate({ type: "add", cardCode: 89631139 });

    await controller.setIllustration(89631139);
    expect(get(controller).current?.deck.illustrationCardCode).toBe(89631139);
    expect(
      (await repo.load(get(controller).current!.deck.id))?.deck
        .illustrationCardCode,
    ).toBe(89631139);

    await controller.undo();
    expect(get(controller).current?.deck.illustrationCardCode).toBeNull();
    await controller.redo();
    expect(get(controller).current?.deck.illustrationCardCode).toBe(89631139);

    await controller.mutate({
      type: "remove",
      cardCode: 89631139,
      zone: "main",
    });
    expect(get(controller).current?.deck.illustrationCardCode).toBeNull();
    await controller.undo();
    expect(get(controller).current?.deck.illustrationCardCode).toBe(89631139);
    await repo.close();
  });

  it("retains 50 serialized updates and autosaves Undo/Redo", async () => {
    const name = "controller-history";
    const repo = await openTestDeckRepository(name);
    const controller = new DeckBuilderController(
      repo,
      catalogByCode(PROTOTYPE_CATALOG),
      PROTOTYPE_RULESET,
    );
    await controller.initialize();
    await controller.createDeck("History");
    for (let index = 0; index < 51; index += 1) {
      const hasCard = (get(controller).current?.deck.main.length ?? 0) > 0;
      await controller.mutate(
        hasCard
          ? { type: "remove", cardCode: 89631139, zone: "main" }
          : { type: "add", cardCode: 89631139 },
      );
    }
    expect(get(controller).current?.history.undo).toHaveLength(50);
    const beforeUndo = get(controller).current?.deck.main.length;
    await controller.undo();
    expect(get(controller).current?.deck.main.length).not.toBe(beforeUndo);
    await controller.redo();
    expect(get(controller).current?.deck.main.length).toBe(beforeUndo);
    await repo.close();
  });
});
