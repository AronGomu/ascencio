// @vitest-environment jsdom

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardPreviewPanel from "../../src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte";
import * as cardPreview from "../../src/shared-svelte-ui/card-preview/index.ts";
import * as geometry from "../../src/shared-svelte-ui/geometry/index.ts";
import * as scrollbar from "../../src/shared-svelte-ui/scrollbar/index.ts";

function filesUnder(directory: string): readonly string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const path = resolve(current, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".ts") || entry.endsWith(".svelte"))
        files.push(path);
    }
  };
  walk(directory);
  return files;
}

afterEach(() => cleanup());

describe("shared Svelte UI boundaries", () => {
  it("No connected shared view", () => {
    const root = resolve("src/shared-svelte-ui");
    const forbidden =
      /(?:from\s+|import\s*\()["'][^"']*\/(?:battle|cards|content|deck-editor|deck-select|decks|shell|story)\//;
    for (const file of filesUnder(root)) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(forbidden);
    }
    const panel = readFileSync(
      resolve("src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte"),
      "utf8",
    );
    expect(panel).not.toMatch(
      /CardImageSource|imageLibrary|staticImageUrl|placeholderUrl|\blease\b/,
    );
  });

  it("shared public entries are exact", () => {
    expect(Object.keys(cardPreview).sort()).toEqual(["CardPreviewPanel"]);
    expect(Object.keys(scrollbar).sort()).toEqual(["OverlayScrollbar"]);
    expect(Object.keys(geometry).sort()).toEqual(
      [
        "UNROTATED_FRAME",
        "isQuarterTurnClockwise",
        "readFrameWidth",
        "readStageFrame",
        "toFrameDelta",
        "toFramePoint",
        "toFrameRect",
      ].sort(),
    );
  });

  it("Instance uniqueness", () => {
    const preview = {
      key: "97590747",
      name: "The Legendary Fisherman",
      description: "This card is unaffected by Spell effects.",
      statsLine: null,
      imageUrl: null,
      imageAlt: "The Legendary Fisherman",
      placeholderLabel: "Image unavailable",
    };
    render(CardPreviewPanel, {
      preview,
      dataCyPrefix: "left-preview",
      emptyLabel: "Hover a card to see its details.",
    });
    render(CardPreviewPanel, {
      preview,
      dataCyPrefix: "right-preview",
      emptyLabel: "Hover a card to see its details.",
    });

    const selectors = Array.from(
      document.querySelectorAll("[data-cy]"),
      (node) => node.getAttribute("data-cy"),
    );
    expect(new Set(selectors).size).toBe(selectors.length);
    expect(selectors).toContain("left-preview-panel");
    expect(selectors).toContain("right-preview-panel");
  });
});
