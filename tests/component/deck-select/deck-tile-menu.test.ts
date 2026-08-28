// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DeckTileMenu from "../../../src/deck-select/DeckTileMenu.svelte";
import type { DeckTileModel } from "../../../src/deck-select/deck-select-contracts.ts";

let anchor: HTMLButtonElement | null = null;

afterEach(() => {
  cleanup();
  anchor?.remove();
  anchor = null;
});

function tile(overrides: Partial<DeckTileModel> = {}): DeckTileModel {
  return {
    key: "k1",
    name: "Prototype Control",
    counts: { main: 40, extra: 15, side: 10 },
    meta: "Updated 20 Aug 2026",
    coverImageUrl: null,
    legal: true,
    blockReason: null,
    bundled: false,
    lockedBy: null,
    favourite: false,
    isDefault: false,
    deletable: true,
    updatedAt: "2026-08-20T10:00:00.000Z",
    ...overrides,
  };
}

/** The kebab the host pressed: the sheet positions against it and hands focus
    back to it, so the anchor has to be a real element in the document. */
function kebab(): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  document.body.append(element);
  anchor = element;
  return element;
}

function cy(value: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-cy="${value}"]`);
  if (element === null) throw new Error(`No element with data-cy "${value}"`);
  return element;
}

function items(): readonly HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
}

/** jsdom lays nothing out, so the kebab the sheet measures reports its own
    rect. The sheet's measured height stays 0, which leaves the flip decision
    resting on where the kebab sits in the viewport. */
function kebabAt(top: number, left: number): HTMLButtonElement {
  const element = kebab();
  element.getBoundingClientRect = () => new DOMRect(left, top, 24, 24);
  return element;
}

describe("DeckTileMenu", () => {
  it("renders four items in order", () => {
    render(DeckTileMenu, { props: { tile: tile(), anchor: kebab() } });

    expect(cy("deck-tile-menu-sheet-k1").getAttribute("role")).toBe("menu");
    expect(items().map((item) => item.textContent)).toEqual([
      "Open in deck builder",
      "Rename",
      "Duplicate",
      "Delete",
    ]);
    expect(items().map((item) => item.dataset["cy"])).toEqual([
      "deck-tile-menu-open-k1",
      "deck-tile-menu-rename-k1",
      "deck-tile-menu-duplicate-k1",
      "deck-tile-menu-delete-k1",
    ]);
  });

  it("delete is disabled for an undeletable tile", async () => {
    const ondelete = vi.fn();
    const onclose = vi.fn();
    render(DeckTileMenu, {
      props: {
        tile: tile({ deletable: false, bundled: true }),
        anchor: kebab(),
        ondelete,
        onclose,
      },
    });

    const remove = cy("deck-tile-menu-delete-k1") as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
    await userEvent.setup().click(remove);
    expect(ondelete).not.toHaveBeenCalled();
    expect(onclose).not.toHaveBeenCalled();
  });

  it("delete is enabled for a deletable tile", () => {
    render(DeckTileMenu, { props: { tile: tile(), anchor: kebab() } });
    expect((cy("deck-tile-menu-delete-k1") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("choosing an item fires its callback then closes", async () => {
    const onduplicate = vi.fn();
    const onclose = vi.fn();
    render(DeckTileMenu, {
      props: { tile: tile(), anchor: kebab(), onduplicate, onclose },
    });

    await userEvent.setup().click(cy("deck-tile-menu-duplicate-k1"));

    expect(onduplicate).toHaveBeenCalledTimes(1);
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(onduplicate.mock.invocationCallOrder[0]!).toBeLessThan(
      onclose.mock.invocationCallOrder[0]!,
    );
  });

  it("Escape closes without firing an action", async () => {
    const onopen = vi.fn();
    const onrename = vi.fn();
    const onduplicate = vi.fn();
    const ondelete = vi.fn();
    const onclose = vi.fn();
    render(DeckTileMenu, {
      props: {
        tile: tile(),
        anchor: kebab(),
        onopen,
        onrename,
        onduplicate,
        ondelete,
        onclose,
      },
    });

    await fireEvent.keyDown(document, { key: "Escape" });

    expect(onclose).toHaveBeenCalledTimes(1);
    for (const action of [onopen, onrename, onduplicate, ondelete])
      expect(action).not.toHaveBeenCalled();
  });

  it("outside pointerdown closes without firing an action", async () => {
    const onopen = vi.fn();
    const ondelete = vi.fn();
    const onclose = vi.fn();
    render(DeckTileMenu, {
      props: { tile: tile(), anchor: kebab(), onopen, ondelete, onclose },
    });

    await fireEvent.pointerDown(document.body);

    expect(onclose).toHaveBeenCalledTimes(1);
    expect(onopen).not.toHaveBeenCalled();
    expect(ondelete).not.toHaveBeenCalled();
  });

  it("a pointerdown inside the sheet leaves it open", async () => {
    const onclose = vi.fn();
    render(DeckTileMenu, { props: { tile: tile(), anchor: kebab(), onclose } });

    await fireEvent.pointerDown(cy("deck-tile-menu-rename-k1"));

    expect(onclose).not.toHaveBeenCalled();
  });

  it("sits below the kebab when the sheet fits under it", () => {
    window.innerHeight = 768;
    render(DeckTileMenu, {
      props: { tile: tile(), anchor: kebabAt(300, 40) },
    });

    const sheet = cy("deck-tile-menu-sheet-k1");
    expect(sheet.style.top).toBe("324px");
    expect(sheet.style.left).toBe("40px");
  });

  it("flips above the kebab when it would run past the viewport bottom", () => {
    window.innerHeight = 768;
    render(DeckTileMenu, {
      props: { tile: tile(), anchor: kebabAt(880, 40) },
    });

    const sheet = cy("deck-tile-menu-sheet-k1");
    expect(sheet.style.top).toBe("880px");
    expect(sheet.style.left).toBe("40px");
  });

  it("focus starts on the first item and returns to the anchor on close", () => {
    const opener = kebab();
    const { unmount } = render(DeckTileMenu, {
      props: { tile: tile(), anchor: opener },
    });

    expect(document.activeElement).toBe(cy("deck-tile-menu-open-k1"));

    unmount();
    expect(document.activeElement).toBe(opener);
  });
});
