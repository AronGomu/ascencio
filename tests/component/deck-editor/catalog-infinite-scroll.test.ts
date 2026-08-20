// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardCatalog from "../../../src/deck-editor/components/CardCatalog.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { syntheticCatalog } from "../../fixtures/synthetic-catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import type { DeckBuilderCardView } from "../../../src/decks/catalog/ocg-card-mapper.ts";

const originalIO = globalThis.IntersectionObserver;

afterEach(() => {
  cleanup();
  globalThis.IntersectionObserver = originalIO;
});

function make200Cards(): DeckBuilderCardView[] {
  return Array.from({ length: 200 }, (_, i) => {
    const base = PROTOTYPE_CATALOG[i % PROTOTYPE_CATALOG.length]!;
    return { ...base, code: base.code + i * 1_000_000 };
  });
}

function countTiles(container: HTMLElement): number {
  return container.querySelectorAll("button[data-cy^='deck-tile-']").length;
}

function installStubIO(): {
  trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;
} {
  let capturedCb: IntersectionObserverCallback | null = null;
  let capturedInstance: IntersectionObserver | null = null;

  class StubIO {
    constructor(cb: IntersectionObserverCallback) {
      capturedCb = cb;
      capturedInstance = this as unknown as IntersectionObserver;
    }
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    root = null;
    rootMargin = "";
    thresholds = [];
  }

  globalThis.IntersectionObserver =
    StubIO as unknown as typeof IntersectionObserver;

  return {
    trigger(entries) {
      capturedCb?.(entries as IntersectionObserverEntry[], capturedInstance!);
    },
  };
}

describe("catalog infinite scroll", () => {
  it("only the first sixty tiles are mounted", async () => {
    installStubIO();
    const cards = make200Cards();
    const { container } = render(CardCatalog, {
      cards,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    await tick();

    expect(countTiles(container)).toBe(60);
    expect(
      container.querySelector('[data-cy="deck-catalog-results-sentinel"]'),
    ).toBeTruthy();
  });

  it("an intersection appends the next sixty", async () => {
    const stub = installStubIO();
    const cards = make200Cards();
    const { container } = render(CardCatalog, {
      cards,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    await tick();

    stub.trigger([{ isIntersecting: true }]);
    await tick();

    expect(countTiles(container)).toBe(120);
  });

  it("changing a filter resets the window", async () => {
    const stub = installStubIO();
    const cards = make200Cards();
    const { container } = render(CardCatalog, {
      cards,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    await tick();

    stub.trigger([{ isIntersecting: true }]);
    await tick();
    expect(countTiles(container)).toBe(120);

    await userEvent
      .setup()
      .type(screen.getByRole("searchbox", { name: "Name" }), "Blue-Eyes");
    await tick();

    expect(countTiles(container)).toBeLessThanOrEqual(60);
  });

  it("renders at most 60 tiles for 15k cards and resolves quickly", async () => {
    installStubIO();
    const cards = syntheticCatalog(15_000);
    const t0 = performance.now();
    const { container } = render(CardCatalog, {
      cards,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    await tick();
    const elapsed = performance.now() - t0;
    // measured: <200ms in Vitest, budget = 1500ms
    expect(countTiles(container)).toBeLessThanOrEqual(60);
    expect(elapsed).toBeLessThan(1500);
  });

  it("no observer means no hidden cards", async () => {
    delete (globalThis as Record<string, unknown>).IntersectionObserver;

    const cards = make200Cards();
    const { container } = render(CardCatalog, {
      cards,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });
    await tick();

    expect(countTiles(container)).toBe(200);
    expect(
      container.querySelector('[data-cy="deck-catalog-results-sentinel"]'),
    ).toBeNull();
  });
});
