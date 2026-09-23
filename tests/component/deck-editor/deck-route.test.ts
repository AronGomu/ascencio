import { installedEditorCatalog } from "../../../src/shell/adapters/installed-editor-catalog.ts";
import { installedDuelGameplayFixture } from "../../fixtures/installed-duel-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteDB } from "idb";
import DeckEditorApp, {
  type DeckEditorRoute,
} from "../../../src/deck-editor/index.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/validation/index.ts";
import { deckId, type DeckId } from "../../../src/decks/contracts/index.ts";
import {
  emptyDeckHistory,
  createBlankDeck,
} from "../../../src/decks/editing/index.ts";
import {
  DECK_DATABASE_NAME,
  IndexedDbDeckRepository,
} from "../../../src/decks/repository/index.ts";
import { prototypeCatalogMap } from "../../fixtures/deck-editor.ts";
import { installPrototypeActiveCatalog } from "../../fixtures/active-catalog.ts";

installPrototypeActiveCatalog();

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await deleteDB(DECK_DATABASE_NAME);
});

/* The route is the only input the shell gives the domain, so every case here
   drives it exactly as `AppShell` does: a `deckId` prop plus an `onnavigate`
   callback the shell turns into a hash write. */
function mount(id: DeckId | null, onnavigate = vi.fn()) {
  const result = render(DeckEditorApp, {
    catalogInput: installedEditorCatalog(installedDuelGameplayFixture()),
    deckId: id,
    onnavigate,
  });
  return { ...result, onnavigate };
}

async function seedDeck(id: string, name: string): Promise<DeckId> {
  const repository = await IndexedDbDeckRepository.open();
  try {
    const deck = createBlankDeck(name, prototypeCatalogMap, PROTOTYPE_RULESET, {
      id,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    await repository.create(deck, emptyDeckHistory());
    return deck.id;
  } finally {
    repository.close();
  }
}

function query(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${name}"]`);
}

describe("deck editor route binding", () => {
  it("opens the library for #/decks", async () => {
    await seedDeck("d1", "Library Deck");
    mount(null);
    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    expect(query("deck-name-input")).toBeNull();
    expect(
      await screen.findByRole("button", { name: /^Select Library Deck,/ }),
    ).toBeTruthy();
  });

  it("opens the deck named by #/decks/:deckId", async () => {
    await seedDeck("d1", "Deep Link Deck");
    mount(deckId("d1"));
    await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
    expect((query("deck-name-input") as HTMLInputElement).value).toBe(
      "Deep Link Deck",
    );
    expect(query("deck-library")).toBeNull();
  });

  /* Reported rather than linked: the way back is the library of whichever deck
     world this mount was bound to, and only the shell knows its URL. */
  it("shows a typed not-found state with a way back to the library", async () => {
    const { onnavigate } = mount(deckId("missing"));
    await waitFor(() => expect(query("deck-not-found")).not.toBeNull());
    expect(query("deck-name-input")).toBeNull();

    await userEvent.setup().click(query("deck-not-found-back")!);

    expect(onnavigate).toHaveBeenCalledWith<[DeckEditorRoute]>({
      deckId: null,
    });
  });

  it("pushes the deck route when a library deck is opened", async () => {
    await seedDeck("d1", "Pushed Deck");
    const { onnavigate } = mount(null);
    /* A deck this short of cards cannot be picked, so its kebab is the way in
       — which is the point: an illegal deck is opened to be repaired. */
    await waitFor(() => expect(query("deck-tile-menu-d1")).not.toBeNull());
    const user = userEvent.setup();
    await user.click(query("deck-tile-menu-d1")!);
    await user.click(query("deck-tile-menu-open-d1")!);
    await waitFor(() =>
      expect(onnavigate).toHaveBeenCalledWith<[DeckEditorRoute]>({
        deckId: deckId("d1"),
      }),
    );
  });

  it.each(["route-library", "route-deck", "load", "return"])(
    "keeps failed draft visible through %s navigation",
    async (target) => {
      await seedDeck("d1", "Draft");
      await seedDeck("d2", "Other");
      const { rerender, onnavigate } = mount(deckId("d1"));
      await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
      const save = vi
        .spyOn(IndexedDbDeckRepository.prototype, "save")
        .mockRejectedValue(new Error("quota simulation"));
      query("deck-name-input")!.focus();
      await fireEvent.input(query("deck-name-input")!, {
        target: { value: "Unsaved draft" },
      });
      await fireEvent.blur(query("deck-name-input")!);
      await waitFor(() => expect(save).toHaveBeenCalled());
      await screen.findByText("quota simulation");
      const onreturn = vi.fn();
      await rerender({ onreturn });
      if (target === "load") {
        await fireEvent.click(screen.getByRole("button", { name: "Load" }));
        await fireEvent.click(
          await screen.findByRole("button", { name: /Other Main 0/ }),
        );
      } else if (target === "return") {
        await fireEvent.click(
          screen.getByRole("button", { name: "Return to Deck Selection" }),
        );
      } else {
        await rerender({
          deckId: target === "route-library" ? null : deckId("d2"),
        });
        await waitFor(() =>
          expect(onnavigate).toHaveBeenCalledWith({ deckId: "d1" }),
        );
      }
      await waitFor(() =>
        expect(
          screen.getByText(
            "Resolve unsaved deck changes before leaving the editor.",
          ),
        ).toBeTruthy(),
      );
      expect(onreturn).not.toHaveBeenCalled();
      expect((query("deck-name-input") as HTMLInputElement).value).toBe(
        "Unsaved draft",
      );
      expect(query("deck-library")).toBeNull();
      expect(query("deck-not-found")).toBeNull();
      const retry = screen.getByRole("button", { name: "Retry autosave" });
      save.mockRestore();
      await fireEvent.click(retry);
      await waitFor(() => expect(query("deck-editor-retry-save")).toBeNull());
    },
  );

  it("keeps a saved deck visible when the host swallows Return", async () => {
    await seedDeck("d1", "Saved");
    const { rerender } = mount(deckId("d1"));
    const onreturn = vi.fn();
    await rerender({ onreturn });
    await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
    await fireEvent.click(
      screen.getByRole("button", { name: "Return to Deck Selection" }),
    );
    await waitFor(() => expect(onreturn).toHaveBeenCalledOnce());
    expect((query("deck-name-input") as HTMLInputElement).value).toBe("Saved");
    expect(query("deck-editor-opening")).toBeNull();
  });

  it("keeps the current deck visible until the host echoes Load", async () => {
    await seedDeck("d1", "Current");
    await seedDeck("d2", "Other");
    const { rerender, onnavigate } = mount(deckId("d1"));
    await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
    await fireEvent.click(screen.getByRole("button", { name: "Load" }));
    await fireEvent.click(
      await screen.findByRole("button", { name: /Other Main 0/ }),
    );
    await waitFor(() =>
      expect(onnavigate).toHaveBeenCalledWith({ deckId: "d2" }),
    );
    expect((query("deck-name-input") as HTMLInputElement | null)?.value).toBe(
      "Current",
    );
    expect(query("deck-editor-opening")).toBeNull();
    await rerender({ deckId: deckId("d2") });
    await waitFor(() =>
      expect((query("deck-name-input") as HTMLInputElement)?.value).toBe(
        "Other",
      ),
    );
  });

  it("waits for the host route echo after creating a deck", async () => {
    await seedDeck("d1", "Existing");
    const { rerender, onnavigate } = mount(null);
    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await fireEvent.input(query("deck-library-create-name-input")!, {
      target: { value: "Created" },
    });
    await fireEvent.submit(query("deck-library-create-form")!);
    await waitFor(() => expect(onnavigate).toHaveBeenCalled());
    expect(query("deck-library")).not.toBeNull();
    expect(query("deck-name-input")).toBeNull();
    await rerender({ deckId: onnavigate.mock.calls.at(-1)![0].deckId });
    await waitFor(() =>
      expect((query("deck-name-input") as HTMLInputElement)?.value).toBe(
        "Created",
      ),
    );
  });

  it("returns to the library when the route goes back to #/decks", async () => {
    await seedDeck("d1", "Back Deck");
    const { rerender } = mount(deckId("d1"));
    await waitFor(() => expect(query("deck-name-input")).not.toBeNull());
    await rerender({ deckId: null });
    await waitFor(() => expect(query("deck-library")).not.toBeNull());
    expect(query("deck-name-input")).toBeNull();
  });
});
