// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import AppShell from "../../src/shell/AppShell.svelte";
import type { DomainLoaders } from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";

/* The domain roots boot a duel worker and IndexedDB, neither of which this
   test needs: it only asserts which region the shell renders. */
const never = () => new Promise<never>(() => {});
const loaders: DomainLoaders = { duel: never, decks: never };

function renderAt(hash: string) {
  return render(AppShell, {
    store: createShellStore(hash, () => {}),
    loaders,
  });
}

afterEach(() => {
  cleanup();
});

describe("AppShell", () => {
  it("mounts the duel region for the home route", () => {
    renderAt("#/");
    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-decks"]')).toBeNull();
  });

  it("mounts the duel region for the duel route", () => {
    renderAt("#/duel");
    expect(
      document.querySelector('[data-cy="shell-region-duel"]'),
    ).not.toBeNull();
  });

  it("mounts the deck editor region for the decks route", () => {
    renderAt("#/decks");
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("shows the placeholder for the story route", () => {
    renderAt("#/story");
    const placeholder = document.querySelector('[data-cy="shell-placeholder"]');
    expect(placeholder?.textContent).toBe("Not available yet");
  });

  it("shows the placeholder for the admin route", () => {
    renderAt("#/admin");
    expect(
      document.querySelector('[data-cy="shell-placeholder"]')?.textContent,
    ).toBe("Not available yet");
  });

  it("follows store navigation without a remount", async () => {
    const store = createShellStore("#/", () => {});
    render(AppShell, { store, loaders });
    store.syncFromHash("#/decks");
    await Promise.resolve();
    expect(
      document.querySelector('[data-cy="shell-region-decks"]'),
    ).not.toBeNull();
  });
});
