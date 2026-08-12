// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ZoneListDialog from "../../src/app/components/duel-field/ZoneListDialog.svelte";
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
    const dialog = document.querySelector('[data-cy="zone-list-dialog"]');
    if (dialog === null) throw new Error("Missing dialog");
    (dialog as HTMLElement).focus();
    await user.keyboard("{Escape}");

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it("dialog closes on the close button", async () => {
    const user = userEvent.setup();
    const { onclose } = renderDialog();
    const button = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-close-button"]',
    );
    if (button === null) throw new Error("Missing close button");
    await user.click(button);

    expect(onclose).toHaveBeenCalledTimes(1);
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
        .querySelector('[data-cy="zone-list-dialog"]')
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
