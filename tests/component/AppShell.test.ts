// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "../../src/shell/AppShell.svelte";
import type { DomainLoaders } from "../../src/shell/domain-loaders.ts";
import { createShellStore } from "../../src/shell/shell-store.ts";

/* The domain roots boot a duel worker and IndexedDB, neither of which this
   test needs: it only asserts which region the shell renders. */
const never = () => new Promise<never>(() => {});
const loaders: DomainLoaders = { duel: never, decks: never, story: never };

function renderAt(hash: string) {
  return render(AppShell, {
    store: createShellStore(hash, () => {}),
    loaders,
  });
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
  });
}

const defaultViewport = {
  width: window.innerWidth,
  height: window.innerHeight,
};

afterEach(() => {
  cleanup();
  setViewport(defaultViewport.width, defaultViewport.height);
});

describe("AppShell", () => {
  it("mounts the home hub for the home route", () => {
    renderAt("#/");
    expect(
      document.querySelector('[data-cy="shell-region-home"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="home-entry-duel"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
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

  it("mounts the story region for the story route", () => {
    renderAt("#/story");
    expect(
      document.querySelector('[data-cy="shell-region-story"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-placeholder"]')).toBeNull();
    expect(document.querySelector('[data-cy="shell-region-duel"]')).toBeNull();
  });

  it("loads the real story domain root through its public entry", async () => {
    render(AppShell, {
      store: createShellStore("#/story", () => {}),
      loaders: {
        ...loaders,
        story: async () => await import("../../src/story/index.ts"),
      },
    });
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-cy="shell-region-story"] .story-app'),
      ).not.toBeNull(),
    );
  });

  it("mounts the admin console region for the admin route", async () => {
    renderAt("#/admin");
    expect(
      document.querySelector('[data-cy="shell-region-admin"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="shell-placeholder"]')).toBeNull();
    await vi.waitFor(() =>
      expect(document.querySelector('[data-cy="admin-title"]')).not.toBeNull(),
    );
  });

  it("publishes the stage mode on the stage element", () => {
    setViewport(800, 1000);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  it("letterboxes a desktop viewport into a 16:9 stage", () => {
    setViewport(1920, 1200);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-mode")).toBe("stage");
  });

  /* The pixel box belongs to `.app-stage` in CSS so it is applied by the same
     layout pass as the viewport change. Re-publishing it inline from here
     would win over the stylesheet and reintroduce a box that trails the
     viewport by at least a frame; the numbers stay covered by
     `tests/unit/stage-layout.test.ts` and `tests/unit/global-styles.test.ts`. */
  it("leaves the stage pixel box to the stylesheet", () => {
    setViewport(1920, 1200);
    renderAt("#/");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("style")).toBeNull();
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
