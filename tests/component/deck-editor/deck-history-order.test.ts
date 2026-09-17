// @vitest-environment node

import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { deleteDB } from "idb";
import { get } from "svelte/store";
import { DeckBuilderController } from "../../../src/deck-editor/deck-editor-store.ts";
import { IndexedDbDeckRepository } from "../../../src/decks/repository/index.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../../src/decks/validation/index.ts";
import { PROTOTYPE_CATALOG } from "../../fixtures/catalog.ts";

const names: string[] = [];
afterEach(async () =>
  Promise.all(names.splice(0).map((name) => deleteDB(name))),
);

const catalog = catalogByCode(PROTOTYPE_CATALOG);
const BLUE_EYES = 89631139;
const DARK_MAGICIAN = 46986414;
const SUMMONED_SKULL = 74677422;
const CELTIC_GUARDIAN = 91152256;
const MIRROR_FORCE = 44095762;

async function controllerFor(name: string): Promise<{
  readonly controller: DeckBuilderController;
  readonly close: () => void;
}> {
  names.push(name);
  const repository = await IndexedDbDeckRepository.open(name);
  const controller = new DeckBuilderController(
    repository,
    catalog,
    PROTOTYPE_RULESET,
  );
  await controller.initialize();
  await controller.createDeck("Ordered history");
  return { controller, close: () => repository.close() };
}

function cards(controller: DeckBuilderController): {
  readonly main: readonly number[];
  readonly side: readonly number[];
} {
  const deck = get(controller).current!.deck;
  return { main: deck.main, side: deck.side };
}

describe("position-blind membership history", () => {
  it("keeps manual order through undo and redo of an add", async () => {
    const { controller, close } = await controllerFor("history-order-add");
    await controller.mutate({ type: "add", cardCode: BLUE_EYES });
    await controller.mutate({ type: "add", cardCode: DARK_MAGICIAN });
    await controller.mutate({ type: "add", cardCode: SUMMONED_SKULL });
    await controller.mutate({ type: "reorder", zone: "main", from: 0, to: 2 });
    expect(cards(controller).main).toEqual([
      SUMMONED_SKULL,
      DARK_MAGICIAN,
      BLUE_EYES,
    ]);

    await controller.undo();
    expect(cards(controller).main).toEqual([DARK_MAGICIAN, BLUE_EYES]);
    await controller.redo();
    expect(cards(controller).main).toEqual([
      SUMMONED_SKULL,
      DARK_MAGICIAN,
      BLUE_EYES,
    ]);
    close();
  });

  it("keeps survivor order through undo and redo of a remove", async () => {
    const { controller, close } = await controllerFor("history-order-remove");
    await controller.mutate({ type: "add", cardCode: BLUE_EYES });
    await controller.mutate({ type: "add", cardCode: DARK_MAGICIAN });
    await controller.mutate({ type: "add", cardCode: SUMMONED_SKULL });
    await controller.mutate({
      type: "remove",
      cardCode: DARK_MAGICIAN,
      zone: "main",
    });
    await controller.mutate({ type: "reorder", zone: "main", from: 0, to: 1 });
    expect(cards(controller).main).toEqual([SUMMONED_SKULL, BLUE_EYES]);

    await controller.undo();
    expect(cards(controller).main).toEqual([
      SUMMONED_SKULL,
      DARK_MAGICIAN,
      BLUE_EYES,
    ]);
    await controller.redo();
    expect(cards(controller).main).toEqual([SUMMONED_SKULL, BLUE_EYES]);
    close();
  });

  it("keeps both zone orders through undo and redo of a move", async () => {
    const { controller, close } = await controllerFor("history-order-move");
    await controller.mutate({ type: "add", cardCode: BLUE_EYES });
    await controller.mutate({ type: "add", cardCode: DARK_MAGICIAN });
    await controller.mutate({ type: "add", cardCode: SUMMONED_SKULL });
    await controller.mutate({
      type: "add",
      cardCode: CELTIC_GUARDIAN,
      zone: "side",
    });
    await controller.mutate({
      type: "add",
      cardCode: MIRROR_FORCE,
      zone: "side",
    });
    await controller.mutate({
      type: "move",
      cardCode: DARK_MAGICIAN,
      from: "main",
      to: "side",
    });
    await controller.mutate({ type: "reorder", zone: "main", from: 0, to: 1 });
    await controller.mutate({ type: "reorder", zone: "side", from: 0, to: 2 });
    expect(cards(controller)).toEqual({
      main: [SUMMONED_SKULL, BLUE_EYES],
      side: [DARK_MAGICIAN, MIRROR_FORCE, CELTIC_GUARDIAN],
    });

    await controller.undo();
    expect(cards(controller)).toEqual({
      main: [SUMMONED_SKULL, DARK_MAGICIAN, BLUE_EYES],
      side: [MIRROR_FORCE, CELTIC_GUARDIAN],
    });
    await controller.redo();
    expect(cards(controller)).toEqual({
      main: [SUMMONED_SKULL, BLUE_EYES],
      side: [DARK_MAGICIAN, MIRROR_FORCE, CELTIC_GUARDIAN],
    });
    close();
  });
});
