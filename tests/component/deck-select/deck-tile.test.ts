// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
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

  it("favourite star toggles without pressing the tile", async () => {
    const onfavourite = vi.fn();
    const onpress = vi.fn();
    render(DeckTile, { tile: tile(), onfavourite, onpress });

    const star = cy("deck-tile-fav-k1");
    expect(star.getAttribute("aria-pressed")).toBe("false");
    await userEvent.setup().click(star);

    expect(onfavourite).toHaveBeenCalledWith(true);
    expect(onpress).not.toHaveBeenCalled();
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

  it("no favourite star when showFavourite false", () => {
    render(DeckTile, { tile: tile(), showFavourite: false });
    expect(find("deck-tile-fav-k1")).toBeNull();
    expect(find("deck-tile-menu-k1")).not.toBeNull();
  });
});
