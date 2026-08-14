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

  /* A story handoff has no request to dispatch yet, so the session route runs
     the same standalone duel and only marks itself as pending. */
  it("marks the duel-session route as pending inside the duel region", () => {
    renderAt("#/duel/session/opening-duel");
    const region = document.querySelector('[data-cy="shell-region-duel"]');
    expect(region).not.toBeNull();
    expect(
      region?.querySelector('[data-cy="battle-session-pending"]'),
    ).not.toBeNull();
  });

  it("leaves the plain duel route unmarked", () => {
    renderAt("#/duel");
    expect(
      document.querySelector('[data-cy="battle-session-pending"]'),
    ).toBeNull();
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

  /* T15: the quarter turn itself is a media query in `src/styles/app.css`, and
     applies to the duel region rather than the whole stage — the deck editor,
     story and home hub share this stage and read upright in portrait. What the
     shell publishes here is the mode: `src/app/presentation/stage-frame.ts`
     still reads the live transform before mapping a single coordinate. */
  it("marks a portrait phone's stage as rotated", () => {
    setViewport(400, 900);
    renderAt("#/duel");
    const stage = document.querySelector('[data-cy="app-stage"]');
    expect(stage?.getAttribute("data-stage-rotated")).toBe("true");
    expect(stage?.getAttribute("data-stage-mode")).toBe("mobile-portrait");
  });

  it("leaves desktop and small-landscape stages unrotated", () => {
    setViewport(900, 400);
    renderAt("#/duel");
    expect(
      document
        .querySelector('[data-cy="app-stage"]')
        ?.getAttribute("data-stage-rotated"),
    ).toBeNull();
    cleanup();
    setViewport(1600, 900);
    renderAt("#/duel");
    expect(
      document
        .querySelector('[data-cy="app-stage"]')
        ?.getAttribute("data-stage-rotated"),
    ).toBeNull();
  });

  /* The rotation must not reorder anything: it is a transform on one box, so
     the duel's controls keep the DOM order — and therefore the tab order —
     they have in landscape. */
  it("renders the same duel region markup rotated and unrotated", () => {
    setViewport(900, 400);
    renderAt("#/duel");
    const landscape = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    cleanup();
    setViewport(400, 900);
    renderAt("#/duel");
    const portrait = document.querySelector(
      '[data-cy="shell-region-duel"]',
    )?.innerHTML;
    expect(portrait).toBe(landscape);
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
