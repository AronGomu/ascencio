import { shellGameplayFixture as installedGameplayFixture } from "../fixtures/shell-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import FreePlayMatchSetup from "../../src/shell/screens/FreePlayMatchSetup.svelte";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";

afterEach(() => cleanup());

it("keeps installed AI ownership visible on its chapter deck", async () => {
  const battle = await import("../../src/battle/index.ts");
  render(FreePlayMatchSetup, {
    gameplay: installedGameplayFixture(),
    settings: createShellSettingsStore(null),
    loadBattle: async () => battle,
  });

  await vi.waitFor(() => {
    const exclusive = document.querySelector(
      '[data-cy="deck-tile-chapter:installed-starter"]',
    );
    expect(exclusive?.textContent).toContain(
      "Installed chapter · Locked: Installed Rival",
    );
  });
});
