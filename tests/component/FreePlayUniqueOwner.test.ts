import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";
// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import FreePlayMatchSetup from "../../src/shell/screens/FreePlayMatchSetup.svelte";
import { createShellSettingsStore } from "../../src/shell/settings/shell-settings-store.ts";

afterEach(() => cleanup());

it("keeps installed AI ownership visible on its chapter deck", async () => {
  render(FreePlayMatchSetup, {
    gameplay: installedGameplayFixture(),
    settings: createShellSettingsStore(null),
    loadBattle: () => import("../../src/battle/index.ts"),
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
