// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import { IndexedDbDeckRepository } from "../../../src/decks/indexeddb-deck-repository.ts";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";

const names: string[] = [];
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => deleteDB(name))),
);

const catalog = catalogByCode(PROTOTYPE_CATALOG);

async function controllerFor(name: string): Promise<{
  readonly controller: DeckBuilderController;
  readonly repo: IndexedDbDeckRepository;
}> {
  names.push(name);
  const repo = await IndexedDbDeckRepository.open(name);
  const controller = new DeckBuilderController(
    repo,
    catalog,
    PROTOTYPE_RULESET,
  );
  await controller.initialize();
  await controller.createDeck("Import Target");
  return { controller, repo };
}

describe("YDK history integration", () => {
  it("replaces exact ordered lists without changing identity and undoes/redoes once", async () => {
    const { controller, repo } = await controllerFor("ydk-history");
    await controller.mutate({
      type: "import",
      cards: { main: [89631139], extra: [], side: [46986414] },
    });
    const before = get(controller).current!;
    const imported = {
      main: [46986414, 99999999, 89631139],
      extra: [8505920],
      side: [89631139, 46986414],
    } as const;

    const saved = await controller.mutate({ type: "import", cards: imported });

    expect(saved).toBe(true);
    const after = get(controller).current!;
    expect(after.deck.id).toBe(before.deck.id);
    expect(after.deck.name).toBe(before.deck.name);
    expect(after.deck.main).toEqual(imported.main);
    expect(after.deck.extra).toEqual(imported.extra);
    expect(after.deck.side).toEqual(imported.side);
    expect(after.history.undo).toHaveLength(before.history.undo.length + 1);
    expect(after.history.undo.at(-1)?.reason).toBe("import");

    await controller.undo();
    expect(get(controller).current!.deck.main).toEqual(before.deck.main);
    expect(get(controller).current!.deck.extra).toEqual(before.deck.extra);
    expect(get(controller).current!.deck.side).toEqual(before.deck.side);

    await controller.redo();
    expect(get(controller).current!.deck.main).toEqual(imported.main);
    expect(get(controller).current!.deck.extra).toEqual(imported.extra);
    expect(get(controller).current!.deck.side).toEqual(imported.side);
    repo.close();
  });

  it("keeps known unowned and unknown imported codes as validation errors", async () => {
    const name = "ydk-unowned-history";
    names.push(name);
    const repo = await IndexedDbDeckRepository.open(name);
    const known = PROTOTYPE_CATALOG.find(
      ({ canonicalZone }) => canonicalZone === "main",
    )!.code;
    const controller = new DeckBuilderController(
      repo,
      catalog,
      PROTOTYPE_RULESET,
      { isUnlimited: false, ownedCount: () => 0 },
    );
    await controller.initialize();
    await controller.createDeck("Story Import");

    expect(
      await controller.mutate({
        type: "import",
        cards: { main: [known, 99999999], extra: [], side: [] },
      }),
    ).toBe(true);
    const deck = get(controller).current!.deck;
    expect(deck.main).toEqual([known, 99999999]);
    expect(
      deck.validation.issues.some(({ code }) => code === "not-owned"),
    ).toBe(true);
    expect(
      deck.validation.issues.some(({ code }) => code === "missing-card"),
    ).toBe(true);
    repo.close();
  });

  it("returns false after publishing validation and save failures", async () => {
    const { controller, repo } = await controllerFor("ydk-save-failure");

    expect(
      await controller.mutate({
        type: "reorder",
        zone: "main",
        from: 0,
        to: 1,
      }),
    ).toBe(false);
    expect(get(controller).message).toBe("Nothing to reorder.");

    vi.spyOn(repo, "save").mockRejectedValueOnce(
      new Error("simulated import save failure"),
    );
    expect(
      await controller.mutate({
        type: "import",
        cards: { main: [89631139], extra: [], side: [] },
      }),
    ).toBe(false);
    expect(get(controller).saveState).toBe("failed");
    expect(get(controller).message).toBe("simulated import save failure");
    repo.close();
  });
});
