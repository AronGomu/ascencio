// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardCatalog from "../../../src/deck-editor/components/CardCatalog.svelte";
import { PROTOTYPE_CATALOG } from "../../../src/deck-editor/fixtures/catalog.ts";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";

afterEach(() => cleanup());

describe("CardCatalog overlay scrollbar", () => {
  it("the results carry the shared overlay scrollbar", () => {
    const { container } = render(CardCatalog, {
      cards: PROTOTYPE_CATALOG,
      ruleset: PROTOTYPE_RULESET,
      onselect: vi.fn(),
      ondragcard: vi.fn(),
    });

    const region = container.querySelector(
      '[data-cy="deck-catalog-results-region"]',
    );
    const results = container.querySelector('[data-cy="deck-catalog-results"]');
    const scrollbar = container.querySelector(
      '[data-cy="deck-catalog-results-scrollbar"]',
    );

    expect(region).toBeTruthy();
    expect(results).toBeTruthy();
    expect(scrollbar).toBeTruthy();
    // scrollbar is a sibling of results (both direct children of region)
    expect(results!.parentElement).toBe(region);
    expect(scrollbar!.parentElement).toBe(region);
  });

  it("the native results scrollbar is hidden", () => {
    const src = readFileSync(
      resolve("src/deck-editor/components/CardCatalog.svelte"),
      "utf8",
    );
    expect(src).toMatch(/scrollbar-width:\s*none/);
    expect(src).toContain("::-webkit-scrollbar");
    expect(src).toContain("display: none");
  });
});
