// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ZoneListDialog from "../../src/app/components/duel-field/ZoneListDialog.svelte";
import ZoneListEntryTile from "../../src/app/components/duel-field/ZoneListEntryTile.svelte";
import { cardCode, choiceId } from "../../src/duel/contracts/ids.ts";
import type { ChoiceId } from "../../src/duel/contracts/ids.ts";
import type { InteractionChoice } from "../../src/app/prompts/interaction-spec.ts";
import type { ZoneListEntry } from "../../src/field/zone-list.ts";
import type { OffFieldTargetEntry } from "../../src/field/off-field-target-list.ts";
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

function targetChoice(id: string, label = "Select"): InteractionChoice {
  return {
    id: choiceId(id),
    label,
    action: "select",
    cardAddress: { controller: 0, location: "graveyard", sequence: 0 },
  };
}

function targetEntry(
  overrides: Partial<OffFieldTargetEntry> = {},
): OffFieldTargetEntry {
  return {
    id: "target:0:graveyard:0",
    position: 1,
    controller: 0,
    location: "graveyard",
    sequence: 0,
    identityVisible: true,
    code: cardCode(97590747),
    label: "The Legendary Fisherman",
    zoneBadge: "GRAVEYARD",
    zoneLabel: "Your Graveyard",
    choices: [targetChoice("gy-0")],
    ...overrides,
  };
}

/** A target the projector could never attest: no code, no name, still legal. */
function hiddenTargetEntry(): OffFieldTargetEntry {
  return {
    id: "target:1:banished:2",
    position: 3,
    controller: 1,
    location: "banished",
    sequence: 2,
    identityVisible: false,
    label: "Face-down card",
    zoneBadge: "BANISHED",
    zoneLabel: "Opponent Banished",
    choices: [targetChoice("ban-2")],
  };
}

function renderTargetDialog(
  overrides: {
    readonly targetEntries?: readonly OffFieldTargetEntry[];
    readonly selectedChoiceIds?: readonly ChoiceId[];
    readonly minimum?: number;
    readonly maximum?: number;
    readonly confirmValid?: boolean;
    readonly validationMessage?: string;
    readonly cancelable?: boolean;
    readonly title?: string;
  } = {},
) {
  const ontargetchoice = vi.fn();
  const onconfirm = vi.fn();
  const oncancel = vi.fn();
  const onclose = vi.fn();
  const rendered = render(ZoneListDialog, {
    mode: "target",
    stack: null,
    targetEntries: overrides.targetEntries ?? [targetEntry()],
    selectedChoiceIds: overrides.selectedChoiceIds ?? [],
    minimum: overrides.minimum ?? 1,
    maximum: overrides.maximum ?? 1,
    confirmValid: overrides.confirmValid ?? false,
    validationMessage: overrides.validationMessage ?? "",
    cancelable: overrides.cancelable ?? false,
    ...(overrides.title === undefined ? {} : { title: overrides.title }),
    cardBackUrl: "back.png",
    ontargetchoice,
    onconfirm,
    oncancel,
    onclose,
  });
  return { rendered, ontargetchoice, onconfirm, oncancel, onclose };
}

describe("ZoneListDialog target mode", () => {
  it("renders target notice, collapse chrome, and mode state", async () => {
    const user = userEvent.setup();
    renderTargetDialog({
      targetEntries: [
        targetEntry({ location: "deck", zoneBadge: "DECK" }),
        targetEntry({ id: "target:0:hand:0", location: "hand", zoneBadge: "HAND" }),
        targetEntry({ id: "target:0:graveyard:1", sequence: 1 }),
      ],
    });
    const root = document.querySelector<HTMLElement>(
      '[data-cy="floating-field-window-zoneList"]',
    );
    expect(root?.dataset.mode).toBe("target");
    expect(root?.dataset.collapsed).toBe("false");
    expect(
      document.querySelector('[data-cy="zone-list-dialog-filter-notice"]')
        ?.textContent,
    ).toBe("Filtered: legal targets from Hand, Graveyard, and Deck");
    expect(
      document.querySelector('[data-cy="zone-list-dialog-close-button"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="zone-list-dialog-target-footer"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="zone-list-dialog-target-sort-label"]'),
    ).not.toBeNull();
    expect(
      document.querySelectorAll(
        '[data-cy="zone-list-dialog-alphabetical-checkbox"]',
      ),
    ).toHaveLength(1);

    const collapse = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-collapse-button"]',
    );
    if (collapse === null) throw new Error("Missing collapse button");
    await user.click(collapse);
    expect(root?.dataset.collapsed).toBe("true");
    expect(document.querySelector('[data-cy="zone-list-dialog-title"]')).toBeNull();
    expect(document.querySelector('[data-cy="zone-list-dialog-entries"]')).toBeNull();
    const expand = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-expand-button"]',
    );
    if (expand === null) throw new Error("Missing expand button");
    expect(document.activeElement).toBe(expand);
    await user.click(expand);
    expect(root?.dataset.collapsed).toBe("false");
    expect(document.activeElement).toBe(
      document.querySelector('[data-cy="zone-list-dialog-collapse-button"]'),
    );
  });

  it("lists only the provided legal targets, each with its zone badge", () => {
    const entries = [targetEntry(), hiddenTargetEntry()];
    renderTargetDialog({ targetEntries: entries });

    expect(
      document.querySelectorAll('[data-cy^="zone-list-entry-target-choice-"]'),
    ).toHaveLength(2);
    expect(
      [...document.querySelectorAll('[data-cy^="zone-list-entry-zone-"]')].map(
        (element) => element.textContent?.trim(),
      ),
    ).toEqual(["GRAVEYARD", "BANISHED"]);
    expect(
      document.querySelector('[data-cy="zone-list-dialog-count"]')?.textContent,
    ).toBe("2");
    expect(
      document.querySelector('[data-cy="zone-list-dialog-title"]')?.textContent,
    ).toBe("Select targets");
    // Privacy: an unattested target carries no code, name or art URL.
    const hidden = document.querySelector(
      '[data-cy="zone-list-entry-target:1:banished:2"]',
    );
    expect(hidden?.outerHTML).not.toContain("97590747");
    expect(hidden?.outerHTML).not.toContain("Legendary");
    expect(
      document
        .querySelector('[data-cy="zone-list-entry-image-target:1:banished:2"]')
        ?.getAttribute("src"),
    ).toBe("back.png");
  });

  it("marks a legal entry actionable and a selected one selected", () => {
    const selected = targetEntry({
      id: "target:0:graveyard:1",
      sequence: 1,
      choices: [targetChoice("gy-1")],
    });
    renderTargetDialog({
      targetEntries: [targetEntry(), selected],
      selectedChoiceIds: [choiceId("gy-1")],
      minimum: 1,
      maximum: 2,
    });

    const legal = document.querySelector(
      '[data-cy="zone-list-entry-target:0:graveyard:0"]',
    );
    const chosen = document.querySelector(
      '[data-cy="zone-list-entry-target:0:graveyard:1"]',
    );
    expect(legal?.classList.contains("is-actionable")).toBe(true);
    expect(legal?.classList.contains("is-selected")).toBe(false);
    expect(chosen?.classList.contains("is-selected")).toBe(true);
    expect(
      document
        .querySelector(
          '[data-cy="zone-list-entry-target-choice-target:0:graveyard:1-gy-1"]',
        )
        ?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      document
        .querySelector(
          '[data-cy="zone-list-entry-target-choice-target:0:graveyard:0-gy-0"]',
        )
        ?.getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("a single-choice entry answers with that choice, naming its zone", async () => {
    const user = userEvent.setup();
    const harness = renderTargetDialog();

    const button = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-entry-target-choice-target:0:graveyard:0-gy-0"]',
    );
    if (button === null) throw new Error("Missing target button");
    expect(button.getAttribute("aria-label")).toBe(
      "The Legendary Fisherman in Your Graveyard",
    );
    await user.click(button);

    expect(harness.ontargetchoice).toHaveBeenCalledTimes(1);
    expect(harness.ontargetchoice.mock.calls[0]?.[0]).toMatchObject({
      id: choiceId("gy-0"),
    });
  });

  it("duplicate choices for one address stay individually answerable", async () => {
    const user = userEvent.setup();
    const harness = renderTargetDialog({
      targetEntries: [
        targetEntry({
          choices: [
            targetChoice("gy-banish", "Banish"),
            targetChoice("gy-shuffle", "Shuffle back"),
          ],
        }),
      ],
    });

    const trigger = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-entry-choice-menu-trigger-target:0:graveyard:0"]',
    );
    if (trigger === null) throw new Error("Missing choice-menu trigger");
    await user.click(trigger);
    const second = document.querySelector<HTMLButtonElement>(
      '[data-cy="projected-choice-target:0:graveyard:0-gy-shuffle"]',
    );
    if (second === null) throw new Error("Missing duplicate target button");
    expect(second.textContent?.trim()).toBe("Shuffle back");
    await user.click(second);

    expect(harness.ontargetchoice.mock.calls[0]?.[0]).toMatchObject({
      id: choiceId("gy-shuffle"),
    });
  });

  it("counts a fixed selection as selected of maximum", () => {
    renderTargetDialog({
      minimum: 2,
      maximum: 2,
      selectedChoiceIds: [choiceId("gy-0")],
    });

    expect(
      document.querySelector('[data-cy="zone-list-dialog-selection-count"]')
        ?.textContent,
    ).toBe("1 / 2 selected");
  });

  it("counts a range selection with its allowed span", () => {
    renderTargetDialog({
      minimum: 1,
      maximum: 3,
      selectedChoiceIds: [choiceId("gy-0"), choiceId("other")],
    });

    expect(
      document.querySelector('[data-cy="zone-list-dialog-selection-count"]')
        ?.textContent,
    ).toBe("2 selected · 1–3 allowed");
  });

  it("has no Confirm for an exact one-of-one target", () => {
    renderTargetDialog({ minimum: 1, maximum: 1 });

    expect(
      document.querySelector('[data-cy="zone-list-dialog-confirm-button"]'),
    ).toBeNull();
  });

  it("enables Confirm only when the selection validates", async () => {
    const user = userEvent.setup();
    const invalid = renderTargetDialog({ minimum: 1, maximum: 2 });
    const disabledConfirm = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-confirm-button"]',
    );
    expect(disabledConfirm?.disabled).toBe(true);
    await user.click(disabledConfirm as HTMLButtonElement);
    expect(invalid.onconfirm).not.toHaveBeenCalled();
    cleanup();

    const valid = renderTargetDialog({
      minimum: 1,
      maximum: 2,
      confirmValid: true,
      selectedChoiceIds: [choiceId("gy-0")],
    });
    const confirm = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-confirm-button"]',
    );
    if (confirm === null) throw new Error("Missing confirm button");
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);

    expect(valid.onconfirm).toHaveBeenCalledTimes(1);
  });

  it("shows the validation message and only offers Cancel when the engine allows it", async () => {
    const user = userEvent.setup();
    const harness = renderTargetDialog({
      minimum: 1,
      maximum: 2,
      validationMessage: "Select at least 1 card",
      cancelable: true,
    });

    expect(
      document.querySelector('[data-cy="zone-list-dialog-validation"]')
        ?.textContent,
    ).toContain("Select at least 1 card");
    const cancel = document.querySelector<HTMLButtonElement>(
      '[data-cy="zone-list-dialog-target-cancel-button"]',
    );
    if (cancel === null) throw new Error("Missing cancel button");
    await user.click(cancel);
    expect(harness.oncancel).toHaveBeenCalledTimes(1);
    cleanup();

    renderTargetDialog({ minimum: 1, maximum: 2, cancelable: false });
    expect(
      document.querySelector('[data-cy="zone-list-dialog-target-cancel-button"]'),
    ).toBeNull();
  });

  it("sorts target display without changing selected choice IDs", async () => {
    const user = userEvent.setup();
    renderTargetDialog({
      targetEntries: [
        targetEntry({ id: "target:b", label: "Beta" }),
        targetEntry({
          id: "target:a",
          label: "Alpha",
          sequence: 1,
          choices: [targetChoice("gy-1")],
        }),
      ],
      selectedChoiceIds: [choiceId("gy-0")],
      minimum: 1,
      maximum: 2,
    });
    const checkbox = document.querySelector<HTMLInputElement>(
      '[data-cy="zone-list-dialog-alphabetical-checkbox"]',
    );
    if (checkbox === null) throw new Error("Missing target sort checkbox");
    await user.click(checkbox);
    expect(
      [...document.querySelectorAll(".zone-list-entry")].map((element) =>
        element.getAttribute("data-cy"),
      ),
    ).toEqual(["zone-list-entry-target:a", "zone-list-entry-target:b"]);
    expect(
      document.querySelector('[aria-pressed="true"]')?.closest(".zone-list-entry")
        ?.getAttribute("data-cy"),
    ).toBe("zone-list-entry-target:b");
  });

  it("disables and resets target sorting when identity is hidden", async () => {
    const user = userEvent.setup();
    const harness = renderTargetDialog({
      targetEntries: [targetEntry(), targetEntry({ id: "target:visible:2", label: "A" })],
    });
    const checkbox = document.querySelector<HTMLInputElement>(
      '[data-cy="zone-list-dialog-alphabetical-checkbox"]',
    );
    if (checkbox === null) throw new Error("Missing target sort checkbox");
    await user.click(checkbox);
    await harness.rendered.rerender({
      targetEntries: [targetEntry(), hiddenTargetEntry()],
    });
    expect(checkbox.disabled).toBe(true);
    expect(checkbox.checked).toBe(false);
  });

  it("outside and Escape preserve the target window and draft", async () => {
    const harness = renderTargetDialog({ cancelable: true });

    await fireEvent.pointerDown(document.body);
    await fireEvent.keyDown(document, { key: "Escape" });

    expect(harness.onclose).not.toHaveBeenCalled();
    expect(harness.oncancel).not.toHaveBeenCalled();
    expect(harness.onconfirm).not.toHaveBeenCalled();
    expect(harness.ontargetchoice).not.toHaveBeenCalled();
  });
});

describe("ZoneListDialog", () => {
  it("renders approved browse chrome and physical copies", () => {
    renderDialog();
    expect(document.querySelector('[data-cy="zone-list-dialog-title"]')?.textContent).toBe("Graveyard");
    expect(document.querySelectorAll('[data-cy^="zone-list-entry-p0:"]')).toHaveLength(4);
    expect(document.querySelector('[data-cy="zone-list-dialog-footer"]')).not.toBeNull();
    expect(document.querySelector('[data-cy="zone-list-dialog-sort-label"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-cy="zone-list-dialog-alphabetical-checkbox"]')).toHaveLength(1);
    expect(document.querySelector('[data-cy="zone-list-dialog-cancel-button"]')?.textContent).toContain("Cancel");
    expect(document.querySelector('[data-cy="zone-list-dialog-confirm-button"]')).toBeNull();
  });

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
    expect(button.getAttribute("aria-label")).toBe("Close Graveyard");
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

  it("sorts alphabetically and restores source order", async () => {
    const user = userEvent.setup();
    renderDialog({ entries: [entry(3), entry(1), entry(2)] });
    const checkbox = document.querySelector<HTMLInputElement>('[data-cy="zone-list-dialog-alphabetical-checkbox"]');
    if (checkbox === null) throw new Error("Missing alphabetical checkbox");
    await user.click(checkbox);
    expect([...document.querySelectorAll('.zone-list-entry')].map((element) => element.getAttribute('data-cy'))).toEqual([
      'zone-list-entry-p0:graveyard:1',
      'zone-list-entry-p0:graveyard:2',
      'zone-list-entry-p0:graveyard:3',
    ]);
    await user.click(checkbox);
    expect([...document.querySelectorAll('.zone-list-entry')].map((element) => element.getAttribute('data-cy'))).toEqual([
      'zone-list-entry-p0:graveyard:3',
      'zone-list-entry-p0:graveyard:1',
      'zone-list-entry-p0:graveyard:2',
    ]);
  });

  it("renders empty state and disables sorting", () => {
    renderDialog({ entries: [] });
    expect(document.querySelector('[data-cy="zone-list-dialog-empty"]')?.textContent).toBe("No cards available");
    expect(document.querySelector<HTMLInputElement>('[data-cy="zone-list-dialog-alphabetical-checkbox"]')?.disabled).toBe(true);
    expect(document.querySelector('[data-cy="zone-list-dialog-count"]')?.textContent).toBe("0");
  });

  it("deck dialog uses privacy-safe browse label", () => {
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
    ).toBe("Deck card browser");
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
