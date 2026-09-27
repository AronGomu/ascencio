import { semanticShellGameplay } from "../fixtures/shell-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, waitFor } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findSelectableDeck,
  installedSelectableDecks,
  parseBattleRequest,
} from "../../src/battle/index.ts";

import FreePlayMatchSetup from "../../src/shell/screens/FreePlayMatchSetup.svelte";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";
import { installedDuelGameplayFixture } from "../fixtures/installed-duel-gameplay.ts";

const gameplay = semanticShellGameplay(installedDuelGameplayFixture());

afterEach(async () => {
  cleanup();
});

describe("installed Free Play", () => {
  it("renders chapter-only seats from exact installed gameplay", async () => {
    render(FreePlayMatchSetup, {
      presentation: gameplay.presentation,
      ruleset: gameplay.editor().ruleset,
      settings: createShellSettingsStore(),
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
