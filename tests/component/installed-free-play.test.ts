import { createShellGameplay } from "../../src/shell/application/legacy-content.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { deleteDB } from "idb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findSelectableDeck,
  installedSelectableDecks,
  parseBattleRequest,
} from "../../src/battle/index.ts";
import { DECK_DATABASE_NAME } from "../../src/decks/index.ts";
import FreePlayMatchSetup from "../../src/shell/screens/FreePlayMatchSetup.svelte";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import { installedDuelGameplayFixture } from "../fixtures/installed-duel-gameplay.ts";

const gameplay = createShellGameplay(installedDuelGameplayFixture(), null);

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await deleteDB(DECK_DATABASE_NAME);
});

describe("installed Free Play", () => {
  it("renders chapter-only seats from exact installed gameplay", async () => {
    render(FreePlayMatchSetup, {
      gameplay,
      settings: createShellSettingsStore(localStorage),
      loadBattle: async () => ({
        BattleFacade: null as never,
        findSelectableDeck,
        installedSelectableDecks,
        parseBattleRequest,
      }),
      onstart: vi.fn(),
      onback: vi.fn(),
      ondecks: vi.fn(),
      onopendeck: vi.fn(),
    });

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-cy^="deck-tile-chapter:"]'),
      ).toHaveLength(gameplay.decks.length),
    );
    expect(
      document.querySelectorAll('[data-cy^="deck-tile-preset:"]'),
    ).toHaveLength(0);
    for (const tile of document.querySelectorAll(
      '[data-cy^="deck-tile-chapter:"]',
    )) {
      expect(tile.textContent).toContain("Installed chapter");
      expect(tile.textContent).not.toMatch(/bundled|preset/i);
      expect(tile.getAttribute("aria-label") ?? "").not.toMatch(
        /bundled|preset/i,
      );
    }
  });
});
