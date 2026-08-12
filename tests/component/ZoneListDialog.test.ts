// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ZoneListDialog from "../../src/app/components/duel-field/ZoneListDialog.svelte";
import ZoneListEntryTile from "../../src/app/components/duel-field/ZoneListEntryTile.svelte";
import { cardCode, choiceId } from "../../src/duel/contracts/ids.ts";
import type { InteractionChoice } from "../../src/app/prompts/interaction-spec.ts";
import type { ZoneListEntry } from "../../src/field/zone-list.ts";
import type { BoardStackView } from "../../src/field/board-view-model.ts";

afterEach(() => {
  cleanup();
});

const STACK: BoardStackView = {
  id: "p0:graveyard",
  targetId: "stack:p0:graveyard",
  player: 0,
  zone: "graveyard",
  count: 4,
  publicCount: 4,
  label: "GY, 4 cards",
  accessibleLabel: "Your Graveyard, 4 cards",
  x: 0,
  y: 0,
  width: 0.1,
  height: 0.14,
};

function entry(position: number): ZoneListEntry {
  return {
    id: `p0:graveyard:${position}`,
    position,
    controller: 0,
    location: "graveyard",
    sequence: position - 1,
    identityVisible: true,
    code: cardCode(97590747),
    label: `Card ${position}`,
  };
}

function faceDownEntry(position: number): ZoneListEntry {
  return {
    id: `p0:graveyard:${position}`,
    position,
    controller: 0,
    location: "graveyard",
    sequence: position - 1,
    identityVisible: false,
    label: "Face-down card",
  };
}

const ENTRIES: readonly ZoneListEntry[] = [
  entry(1),
  entry(2),
  entry(3),
  entry(4),
];

function renderDialog(
  overrides: {
    readonly stack?: BoardStackView;
    readonly entries?: readonly ZoneListEntry[];
    readonly choices?: readonly InteractionChoice[];
    readonly cardBackUrl?: string;
    readonly onchoose?: (choice: InteractionChoice) => void;
    readonly onpreview?: (entry: ZoneListEntry) => void;
    readonly onclose?: () => void;
  } = {},
) {
  const onchoose = overrides.onchoose ?? vi.fn();
  const onpreview = overrides.onpreview ?? vi.fn();
  const onclose = overrides.onclose ?? vi.fn();
  const rendered = render(ZoneListDialog, {
    stack: overrides.stack ?? STACK,
    entries: overrides.entries ?? ENTRIES,
    choices: overrides.choices ?? [],
    cardBackUrl: overrides.cardBackUrl ?? "back.png",
    onchoose,
    onpreview,
    onclose,
  });
  return { rendered, onchoose, onpreview, onclose };
}

describe("ZoneListDialog", () => {
  it("dialog lists every entry", () => {
    renderDialog();
    for (const value of ENTRIES)
      expect(
        document.querySelector(`[data-cy="zone-list-entry-${value.id}"]`),
      ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="zone-list-dialog-count"]')?.textContent,
    ).toBe("4");
  });

  it("exposes each entry image as a direct child of its zone-list-entry for the height cap", () => {
    renderDialog();
    for (const value of ENTRIES) {
      const entry = document.querySelector(
        `[data-cy="zone-list-entry-${value.id}"]`,
      );
      expect(entry?.classList.contains("zone-list-entry")).toBe(true);
      expect(entry?.querySelector(":scope > img")).not.toBeNull();
    }
  });

  it("dialog haloes only the actionable entry", () => {
    const choice: InteractionChoice = {
      id: choiceId("activate-2"),
      label: "Activate",
      action: "activate",
      cardAddress: { controller: 0, location: "graveyard", sequence: 1 },
    };
    renderDialog({ choices: [choice] });

    for (const value of ENTRIES) {
      const element = document.querySelector(
        `[data-cy="zone-list-entry-${value.id}"]`,
      );
      if (value.position === 2)
        expect(element?.classList.contains("is-actionable")).toBe(true);
      else expect(element?.classList.contains("is-actionable")).toBe(false);
    }
  });

  it("dialog fires the choice from its chip", async () => {
    const user = userEvent.setup();
    const choice: InteractionChoice = {
      id: choiceId("activate-2"),
      label: "Activate",
      action: "activate",
      cardAddress: { controller: 0, location: "graveyard", sequence: 1 },
    };
    const { onchoose } = renderDialog({ choices: [choice] });

    const chip = document.querySelector<HTMLButtonElement>(
      `[data-cy="card-action-chip-${choice.id}"]`,
    );
    if (chip === null) throw new Error("Missing chip");
    await user.click(chip);

    expect(onchoose).toHaveBeenCalledTimes(1);
    expect(onchoose).toHaveBeenCalledWith(choice);
  });

  it("dialog previews on hover", async () => {
    const { onpreview } = renderDialog();
    const element = document.querySelector(
      `[data-cy="zone-list-entry-${ENTRIES[0]?.id}"]`,
    );
    if (element === null) throw new Error("Missing entry");
    await element.dispatchEvent(new Event("pointerenter", { bubbles: true }));

    expect(onpreview).toHaveBeenCalledWith(ENTRIES[0]);
  });

  it("selected tile gets is-selected plus is-actionable when choices exist", () => {
    const choice: InteractionChoice = {
      id: choiceId("activate-2"),
      label: "Activate",
      action: "activate",
      cardAddress: { controller: 0, location: "graveyard", sequence: 1 },
    };
    render(ZoneListEntryTile, {
      entry: entry(2),
      choices: [choice],
      selected: true,
      cardBackUrl: "back.png",
    });
    const element = document.querySelector(
      `[data-cy="zone-list-entry-${entry(2).id}"]`,
    );
    expect(element?.classList.contains("is-selected")).toBe(true);
    expect(element?.classList.contains("is-actionable")).toBe(true);
  });

  it("unselected legal tile gets only is-actionable", () => {
    const choice: InteractionChoice = {
      id: choiceId("activate-2"),
      label: "Activate",
      action: "activate",
      cardAddress: { controller: 0, location: "graveyard", sequence: 1 },
    };
    render(ZoneListEntryTile, {
      entry: entry(2),
      choices: [choice],
      selected: false,
      cardBackUrl: "back.png",
    });
    const element = document.querySelector(
      `[data-cy="zone-list-entry-${entry(2).id}"]`,
    );
    expect(element?.classList.contains("is-actionable")).toBe(true);
    expect(element?.classList.contains("is-selected")).toBe(false);
  });

  it("marks only opponent list entries as opponent-facing", () => {
    const playerEntry = entry(1);
    const opponentEntry = { ...entry(2), controller: 1 as const };
    renderDialog({ entries: [playerEntry, opponentEntry] });

    const player = document.querySelector(
      `[data-cy="zone-list-entry-${playerEntry.id}"]`,
    );
    const opponent = document.querySelector(
      `[data-cy="zone-list-entry-${opponentEntry.id}"]`,
    );
    expect(player?.getAttribute("data-controller")).toBe("0");
    expect(player?.classList.contains("is-opponent")).toBe(false);
    expect(opponent?.getAttribute("data-controller")).toBe("1");
    expect(opponent?.classList.contains("is-opponent")).toBe(true);
  });

  it("dialog closes on Escape", async () => {
    const user = userEvent.setup();
    const { onclose } = renderDialog();
    const dialog = document.querySelector(
      '[data-cy="floating-field-window-zoneList"]',
    );
    if (dialog === null) throw new Error("Missing dialog");
    (dialog as HTMLElement).focus();
    await user.keyboard("{Escape}");

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("dialog closes on an outside pointerdown, never on an inside one", async () => {
    const { onclose } = renderDialog();
    const entries = document.querySelector<HTMLElement>(
      '[data-cy="zone-list-dialog-entries"]',
    );
    const header = document.querySelector<HTMLElement>(
      '[data-cy="zone-list-dialog-header"]',
    );
    if (entries === null || header === null)
      throw new Error("Missing dialog body");

    await fireEvent.pointerDown(entries);
    await fireEvent.pointerDown(header);
    expect(onclose).not.toHaveBeenCalled();

    await fireEvent.pointerDown(document.body);
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("dialog closes on the red X, which names the zone it closes", async () => {
    const user = userEvent.setup();
    const { onclose } = renderDialog();
    const button = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-close-button"]',
    );
    if (button === null) throw new Error("Missing close button");
    expect(button.textContent?.trim()).toBe("×");
    expect(button.classList.contains("danger")).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Close GY, 4 cards");
    // Rightmost control of the header, which is also the window's drag handle.
    const header = button.closest('[data-cy="zone-list-dialog-header"]');
    expect(header?.lastElementChild).toBe(button);
    expect(
      header?.closest('[data-cy="floating-field-window-zoneList-handle"]'),
    ).not.toBeNull();
    await user.click(button);

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("a vertical wheel over the entries scrolls them horizontally", async () => {
    renderDialog();
    const entries = document.querySelector<HTMLElement>(
      '[data-cy="zone-list-dialog-entries"]',
    );
    if (entries === null) throw new Error("Missing entries");
    Object.defineProperty(entries, "clientWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(entries, "scrollWidth", {
      configurable: true,
      value: 500,
    });

    const consumed = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });
    entries.dispatchEvent(consumed);
    expect(entries.scrollLeft).toBe(120);
    expect(consumed.defaultPrevented).toBe(true);

    // At the far edge there is no movement left to consume, so the page/field
    // keeps its own scroll.
    entries.scrollLeft = 300;
    const unconsumed = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });
    entries.dispatchEvent(unconsumed);
    expect(entries.scrollLeft).toBe(300);
    expect(unconsumed.defaultPrevented).toBe(false);
  });

  it("a wheel over a list that cannot scroll is never consumed", () => {
    renderDialog();
    const entries = document.querySelector<HTMLElement>(
      '[data-cy="zone-list-dialog-entries"]',
    );
    if (entries === null) throw new Error("Missing entries");

    const event = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });
    entries.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("deck dialog explains its numbering", () => {
    const deckStack: BoardStackView = {
      ...STACK,
      id: "p0:deck",
      targetId: "stack:p0:deck",
      zone: "deck",
      count: 1,
      publicCount: 0,
      label: "Your Deck, 1 card",
    };

    renderDialog({ stack: deckStack, entries: [] });

    expect(
      document
        .querySelector('[data-cy="floating-field-window-zoneList"]')
        ?.getAttribute("aria-label"),
    ).toBe("Your Deck, 1 card contents, position 1 is the top of the deck");
  });

  it("face-down deck slots use the card back and expose no code in the DOM", () => {
    const faceDown: ZoneListEntry = {
      ...faceDownEntry(1),
      id: "p0:deck:1",
      location: "deck",
    };
    const deckStack: BoardStackView = {
      ...STACK,
      id: "p0:deck",
      targetId: "stack:p0:deck",
      zone: "deck",
      count: 1,
      publicCount: 0,
      label: "Your Deck, 1 card",
    };
    renderDialog({
      stack: deckStack,
      entries: [faceDown],
      cardBackUrl: "back.png",
    });

    expect(
      document
        .querySelector(`[data-cy="zone-list-entry-image-${faceDown.id}"]`)
        ?.getAttribute("src"),
    ).toBe("back.png");
    expect(document.body.innerHTML).not.toContain("97590747");
  });
});
