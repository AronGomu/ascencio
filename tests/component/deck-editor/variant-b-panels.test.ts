// @vitest-environment jsdom

import { readFileSync } from "fs";
import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardCatalog from "../../../src/deck-editor/components/CardCatalog.svelte";
import DeckCardContextMenu from "../../../src/deck-editor/components/DeckCardContextMenu.svelte";
import DeckLibrary from "../../../src/deck-editor/components/DeckLibrary.svelte";
import DeckWorkspace from "../../../src/deck-editor/components/DeckWorkspace.svelte";
import LoadDeckDialog from "../../../src/deck-editor/components/LoadDeckDialog.svelte";
import TapTargetMenu from "../../../src/deck-editor/components/TapTargetMenu.svelte";
import YdkExport from "../../../src/deck-editor/components/YdkExport.svelte";
import YdkImport from "../../../src/deck-editor/components/YdkImport.svelte";
import { PROTOTYPE_RULESET } from "../../../src/decks/catalog/pinned-ruleset.ts";
import {
  deckFixture,
  prototypeCatalogMap,
} from "../../fixtures/deck-editor.ts";

const COMPONENT_DIR = "src/deck-editor/components";
const ROOT_SELECTORS = [
  ["DeckLibrary.svelte", ".library"],
  ["DeckWorkspace.svelte", ".workspace"],
  ["CardCatalog.svelte", ".catalog"],
  ["LoadDeckDialog.svelte", ".dialog"],
  ["YdkImport.svelte", ".dialog"],
  ["YdkExport.svelte", ".dialog"],
] as const;

function sourceOf(filename: string): string {
  return readFileSync(`${COMPONENT_DIR}/${filename}`, "utf8");
}

/* Component styles are extracted by vite-plugin-svelte, so jsdom cannot prove
   cascade ownership through getComputedStyle. Read each exact root rule to
   ensure scoped CSS cannot override the shared VariantB primitive. */
function declarations(filename: string, selector: string): readonly string[] {
  const source = sourceOf(filename);
  const style = (/<style>([\s\S]*)<\/style>/.exec(source)?.[1] ?? "").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const rules = new Map<string, string>();
  for (const [, selectors, body] of style.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    rules.set(
      (selectors ?? "").trim().replace(/\s+/g, " "),
      (body ?? "").trim(),
    );
  const body = rules.get(selector);
  expect(body, `${filename} has no \`${selector}\` rule`).toBeDefined();
  return body!
    .split(";")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0);
}

function cy(container: HTMLElement, value: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(`[data-cy="${value}"]`);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

function expectClasses(element: HTMLElement, ...names: string[]): void {
  for (const name of names) expect(element.classList.contains(name)).toBe(true);
}

afterEach(() => cleanup());

describe("deck editor VariantB panels", () => {
  it("marks library, workspace, and catalog roots as chamfered glass panels", () => {
    const library = render(DeckLibrary, {
      decks: [],
      oncreate: vi.fn(),
      onopen: vi.fn(),
      onimport: vi.fn(),
    });
    expectClasses(
      cy(library.container, "deck-library"),
      "ui-glass-panel",
      "ui-chamfer",
    );
    cleanup();

    const workspace = render(DeckWorkspace, {
      deck: deckFixture(),
      catalog: prototypeCatalogMap,
      ruleset: PROTOTYPE_RULESET,
    });
    expectClasses(
      cy(workspace.container, "deck-workspace"),
      "ui-glass-panel",
      "ui-chamfer",
    );
    cleanup();

    const catalog = render(CardCatalog, {
      cards: [],
      ruleset: PROTOTYPE_RULESET,
    });
    expectClasses(
      cy(catalog.container, "deck-catalog"),
      "ui-glass-panel",
      "ui-chamfer",
    );
  });

  it("marks every editor dialog as a chamfered dialog panel with a dialog title", () => {
    const load = render(LoadDeckDialog, {
      decks: [],
      autosaves: [],
      onopendeck: vi.fn(),
      onrestore: vi.fn(),
      oncancel: vi.fn(),
    });
    expectClasses(
      cy(load.container, "load-deck-dialog"),
      "ui-dialog-panel",
      "ui-chamfer",
    );
    expectClasses(cy(load.container, "load-dialog-heading"), "ui-dialog-title");
    cleanup();

    const ydkImport = render(YdkImport, {
      onimport: vi.fn(),
      oncancel: vi.fn(),
    });
    expectClasses(
      cy(ydkImport.container, "deck-ydk-import"),
      "ui-dialog-panel",
      "ui-chamfer",
    );
    expectClasses(
      cy(ydkImport.container, "deck-ydk-import-heading"),
      "ui-dialog-title",
    );
    cleanup();

    const ydkExport = render(YdkExport, {
      deck: deckFixture(),
      oncancel: vi.fn(),
    });
    expectClasses(
      cy(ydkExport.container, "deck-ydk-export"),
      "ui-dialog-panel",
      "ui-chamfer",
    );
    expectClasses(
      cy(ydkExport.container, "deck-ydk-export-heading"),
      "ui-dialog-title",
    );
  });

  it("keeps context and tap-target menus unchamfered", () => {
    const contextMenu = render(DeckCardContextMenu, {
      cardName: "Blue-Eyes White Dragon",
      x: 20,
      y: 20,
    });
    expect(
      cy(contextMenu.container, "deck-card-context-menu").classList.contains(
        "ui-chamfer",
      ),
    ).toBe(false);
    cleanup();

    const tapMenu = render(TapTargetMenu, {
      cardName: "Blue-Eyes White Dragon",
      targets: [
        { zone: "main", label: "Main Deck", enabled: true, reason: null },
      ],
    });
    expect(
      cy(tapMenu.container, "deck-tap-menu").classList.contains("ui-chamfer"),
    ).toBe(false);
  });
});

describe("deck editor VariantB source styles", () => {
  it.each(ROOT_SELECTORS)(
    "%s leaves panel paint to shared primitives",
    (filename, selector) => {
      const root = declarations(filename, selector);
      expect(root.some((line) => /^background\s*:/.test(line))).toBe(false);
      expect(root.some((line) => /^border\s*:/.test(line))).toBe(false);
      expect(root.some((line) => /^border-radius\s*:/.test(line))).toBe(false);
    },
  );

  it.each(["DeckCardContextMenu.svelte", "TapTargetMenu.svelte"])(
    "%s keeps everyday menu chrome square and token-driven",
    (filename) => {
      const root = declarations(filename, ".menu");
      expect(root).toContain("border: 1px solid var(--line-soft)");
      expect(root).toContain("border-radius: 0");
      expect(root).toContain("background: var(--glass-strong)");
    },
  );
});
