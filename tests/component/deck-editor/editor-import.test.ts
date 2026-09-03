// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckEditor from "../../../src/deck-editor/components/DeckEditor.svelte";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import {
  unlimitedCardOwnership,
  type CardOwnership,
} from "../../../src/decks/card-ownership.ts";
import type { DeckCommand } from "../../../src/decks/deck-model.ts";
import {
  deckFixture,
  prototypeCatalogMap,
  stateFixture,
} from "../../fixtures/deck-editor.ts";

const noop = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderEditor(
  options: {
    readonly onmutate?: (
      command: DeckCommand,
    ) => boolean | void | Promise<boolean | void>;
    readonly ownership?: CardOwnership;
    readonly state?: ReturnType<typeof stateFixture>;
  } = {},
): void {
  render(DeckEditor, {
    state: options.state ?? stateFixture(),
    cards: PROTOTYPE_CATALOG,
    catalog: prototypeCatalogMap,
    ruleset: PROTOTYPE_RULESET,
    ownership: options.ownership ?? unlimitedCardOwnership(),
    returnLabel: "Deck Selection",
    onreturn: noop,
    onrename: noop,
    onmutate: options.onmutate ?? vi.fn().mockResolvedValue(true),
    onundo: noop,
    onredo: noop,
    onretrysave: noop,
    onreload: noop,
    onpreservecopy: noop,
  });
}

async function previewImport(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.type(
    screen.getByLabelText("Or paste YDK text"),
    "#main{enter}46986414{enter}99999999{enter}#extra{enter}8505920{enter}!side{enter}89631139",
  );
  await user.click(screen.getByRole("button", { name: "Preview import" }));
}

describe("open-deck YDK import", () => {
  it("opens separately from Load without asking for a deck name", async () => {
    const user = userEvent.setup();
    renderEditor();

    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Import" }));

    const dialog = screen.getByRole("dialog", { name: "Import deck list" });
    expect(
      dialog.querySelector('[data-cy="deck-ydk-import-name-field"]'),
    ).toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("dispatches exact lists once, closes only on success and restores focus", async () => {
    const user = userEvent.setup();
    const onmutate = vi.fn().mockResolvedValue(true);
    renderEditor({ onmutate });
    const opener = screen.getByRole("button", { name: "Import" });
    await user.click(opener);
    await previewImport(user);
    await user.click(
      screen.getByRole("button", { name: "Replace deck cards" }),
    );

    expect(onmutate).toHaveBeenCalledTimes(1);
    expect(onmutate).toHaveBeenCalledWith({
      type: "import",
      cards: {
        main: [46986414, 99999999],
        extra: [8505920],
        side: [89631139],
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it("keeps the dialog open and exposes retry copy when save fails", async () => {
    const user = userEvent.setup();
    const onmutate = vi.fn().mockResolvedValue(false);
    renderEditor({ onmutate });
    await user.click(screen.getByRole("button", { name: "Import" }));
    await previewImport(user);
    await user.click(
      screen.getByRole("button", { name: "Replace deck cards" }),
    );

    expect(
      screen.getByRole("dialog", { name: "Import deck list" }),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "Import could not be saved. Try again.",
    );
    expect(screen.getByRole("button", { name: "Replace deck cards" })).toBe(
      document.activeElement,
    );
  });

  it("locks the commit button while the save is pending", async () => {
    const user = userEvent.setup();
    let settle!: (saved: boolean) => void;
    const onmutate = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle = resolve;
        }),
    );
    renderEditor({ onmutate });
    await user.click(screen.getByRole("button", { name: "Import" }));
    await previewImport(user);
    await user.click(
      screen.getByRole("button", { name: "Replace deck cards" }),
    );

    const pending = screen.getByRole("button", { name: "Importing…" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    await user.click(pending);
    expect(onmutate).toHaveBeenCalledTimes(1);
    settle(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the dialog focused when the mutation throws", async () => {
    const user = userEvent.setup();
    renderEditor({
      onmutate: vi.fn().mockRejectedValue(new Error("storage unavailable")),
    });
    await user.click(screen.getByRole("button", { name: "Import" }));
    await previewImport(user);
    await user.click(
      screen.getByRole("button", { name: "Replace deck cards" }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Import failed: storage unavailable",
    );
    expect(screen.getByRole("button", { name: "Replace deck cards" })).toBe(
      document.activeElement,
    );
  });

  it("greys and disables known deck cards unavailable in story ownership", () => {
    const code = PROTOTYPE_CATALOG.find(
      ({ canonicalZone }) => canonicalZone === "main",
    )!.code;
    const deck = Object.freeze({
      ...deckFixture(),
      main: Object.freeze([code]),
    });
    const state = Object.freeze({
      ...stateFixture(),
      decks: Object.freeze([deck]),
      current: Object.freeze({
        deck,
        history: stateFixture().current!.history,
      }),
    });
    renderEditor({
      state,
      ownership: {
        isUnlimited: false,
        ownedCount: () => 0,
      },
    });

    const tile = document.querySelector<HTMLButtonElement>(
      '[data-cy="main-tile-0"]',
    );
    expect(tile?.disabled).toBe(true);
    expect(tile?.classList.contains("unavailable")).toBe(true);
  });
});
