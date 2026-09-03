// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckTile from "../../../src/deck-select/DeckTile.svelte";
import { tile } from "./tile-builder.ts";

afterEach(() => cleanup());

/** The rendered element carrying `data-cy`, or `null` — the tile is queried the
    way every other component test queries this project's element contract. */
function find(value: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
}

function cy(value: string): HTMLElement {
  const element = find(value);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

describe("DeckTile", () => {
  it("renders name, counts and meta", () => {
    render(DeckTile, { tile: tile() });
    expect(cy("deck-tile-name-k1").textContent).toBe("Prototype Control");
    expect(cy("deck-tile-counts-k1").textContent).toBe(
      "Main 40 · Extra 15 · Side 10",
    );
    expect(cy("deck-tile-meta-k1").textContent).toBe("Updated 20 Aug 2026");
  });

  it("matches the square cropped-illustration ratio", () => {
    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(/aspect-ratio:\s*1 \/ 1/);
  });

  it("dims illustration art without dimming tile content", () => {
    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(/\.art\s*\{[^}]*opacity:\s*0\.8/s);
  });

  it("uses 1rem title type", () => {
    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(/\.name\s*\{[^}]*font-size:\s*1rem/s);
  });

  it("backs text with localized translucent surfaces", () => {
    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(
      /\.text-backdrop\s*\{[^}]*background:\s*color-mix\([^;]*transparent\)/s,
    );
    expect(source).toContain('class="name text-backdrop"');
    expect(source).toContain('class="body text-backdrop"');
  });

  it("places title above bottom metadata without an artwork fade", () => {
    render(DeckTile, { tile: tile() });
    expect(find("deck-tile-fade-k1")).toBeNull();

    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(/\.name\s*\{[^}]*align-self:\s*start/s);
    expect(source).toMatch(/\.body\s*\{[^}]*align-self:\s*end/s);
    expect(source).toMatch(/text-shadow:/);
  });

  it("falls back to full card when cropped art is unavailable", async () => {
    render(DeckTile, {
      tile: tile({
        coverImageUrl: "/runtime/images-cropped/89631139.jpg",
      }),
    });
    const image = cy("deck-tile-art-k1") as HTMLImageElement;
    expect(image.src).toContain("/runtime/images-cropped/89631139.jpg");

    await fireEvent.error(image);
    expect((cy("deck-tile-art-k1") as HTMLImageElement).src).toContain(
      "/runtime/images/89631139.jpg",
    );
  });

  it("press fires onpress, dblclick fires ondblpress", async () => {
    const onpress = vi.fn();
    const ondblpress = vi.fn();
    render(DeckTile, { tile: tile(), onpress, ondblpress });
    const user = userEvent.setup();

    await user.click(cy("deck-tile-press-k1"));
    expect(onpress).toHaveBeenCalledTimes(1);
    expect(ondblpress).not.toHaveBeenCalled();

    await user.dblClick(cy("deck-tile-press-k1"));
    expect(ondblpress).toHaveBeenCalledTimes(1);
  });

  it("renders no favourite control", () => {
    render(DeckTile, { tile: tile() });

    expect(find("deck-tile-fav-k1")).toBeNull();
    expect(document.querySelector('[aria-label^="Favourite "]')).toBeNull();
  });

  it("fixes the body to the action stack with a medium gap", () => {
    const source = readFileSync("src/deck-select/DeckTile.svelte", "utf8");
    expect(source).toMatch(
      /--deck-tile-body-height:\s*calc\(\s*var\(--corner-size\)\s*\+\s*var\(--corner-size\)\s*\+\s*var\(--space-2\)\s*\)/s,
    );
    expect(source).toMatch(
      /--deck-tile-body-width:\s*calc\(\s*100%\s*-\s*var\(--corner-size\)\s*-\s*var\(--space-2\)\s*-\s*var\(--space-2\)\s*-\s*var\(--space-2\)\s*\)/s,
    );
    expect(source).toMatch(
      /\.body\s*\{[^}]*width:\s*var\(--deck-tile-body-width\);[^}]*height:\s*var\(--deck-tile-body-height\)/s,
    );
  });

  it("kebab fires onmenu with its element, no tile press", async () => {
    const onmenu = vi.fn();
    const onpress = vi.fn();
    render(DeckTile, { tile: tile(), onmenu, onpress });

    const kebab = cy("deck-tile-menu-k1");
    expect(kebab.getAttribute("aria-label")).toBe(
      "Actions for Prototype Control",
    );
    await userEvent.setup().click(kebab);

    expect(onmenu).toHaveBeenCalledTimes(1);
    expect(onmenu.mock.calls[0]?.[0]).toBe(kebab);
    expect(onpress).not.toHaveBeenCalled();
  });

  it("selected shows checkmark", () => {
    const { unmount } = render(DeckTile, { tile: tile(), selected: true });
    expect(cy("deck-tile-check-k1").textContent).toBe("✓");
    unmount();

    render(DeckTile, { tile: tile(), selected: false });
    expect(find("deck-tile-check-k1")).toBeNull();
  });

  it("badges render per model", () => {
    render(DeckTile, {
      tile: tile({ isDefault: true, bundled: true, lockedBy: "Vault Warden" }),
      yours: true,
    });

    expect(cy("deck-tile-badge-default-k1").textContent).toBe("Default");
    expect(cy("deck-tile-badge-bundled-k1").textContent).toBe("Bundled");
    expect(cy("deck-tile-badge-locked-k1").textContent).toBe("🔒 Vault Warden");
    expect(cy("deck-tile-badge-yours-k1").textContent).toBe("Yours");
    expect(find("deck-tile-badge-illegal-k1")).toBeNull();
  });

  it("illegal tile is disabled and badged", () => {
    render(DeckTile, {
      tile: tile({
        legal: false,
        blockReason: "Main Deck needs 5 more card(s).",
        meta: "Main Deck needs 5 more card(s).",
      }),
    });

    expect((cy("deck-tile-press-k1") as HTMLButtonElement).disabled).toBe(true);
    expect(cy("deck-tile-badge-illegal-k1").textContent).toBe("Illegal");
  });

  it("halo classes applied", () => {
    for (const halo of ["you", "opponent", "focus"] as const) {
      const { unmount } = render(DeckTile, { tile: tile(), halo });
      const root = cy("deck-tile-k1");
      expect(root.classList.contains(`halo-${halo}`)).toBe(true);
      unmount();
    }

    render(DeckTile, { tile: tile(), halo: null });
    const root = cy("deck-tile-k1");
    expect(
      ["halo-you", "halo-opponent", "halo-focus"].filter((name) =>
        root.classList.contains(name),
      ),
    ).toEqual([]);
  });

  it("shows the default star as the sole mark", () => {
    render(DeckTile, { tile: tile({ isDefault: true }) });
    expect(cy("deck-tile-default-star-k1").textContent).toBe("★");
    expect(find("deck-tile-fav-k1")).toBeNull();
  });

  it("cyKey renames every value so one deck can render twice", () => {
    render(DeckTile, { tile: tile(), cyKey: "yours-k1", selected: true });

    expect(find("deck-tile-k1")).toBeNull();
    expect(find("deck-tile-yours-k1")).not.toBeNull();
    expect(cy("deck-tile-name-yours-k1").textContent).toBe("Prototype Control");
    expect(cy("deck-tile-check-yours-k1").textContent).toBe("✓");
    expect(cy("deck-tile-menu-yours-k1").getAttribute("aria-label")).toBe(
      "Actions for Prototype Control",
    );
  });
});
