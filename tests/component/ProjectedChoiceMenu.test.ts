// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectedChoiceMenu from "../../src/battle/app/components/duel-field/ProjectedChoiceMenu.svelte";
import { choiceId } from "../../src/battle/duel/contracts/ids.ts";
import type { ChoiceId } from "../../src/battle/duel/contracts/ids.ts";
import type { InteractionChoice } from "../../src/battle/app/prompts/interaction-spec.ts";

const choices: readonly InteractionChoice[] = [
  { id: choiceId("banish"), label: "Banish", action: "select" },
  { id: choiceId("shuffle"), label: "Shuffle back", action: "select" },
];

afterEach(cleanup);

describe("ProjectedChoiceMenu", () => {
  it("keeps every opaque choice individually answerable", async () => {
    const onchoose = vi.fn();
    render(ProjectedChoiceMenu, {
      entryId: "entry-1",
      cardLabel: "Card",
      zoneLabel: "Graveyard",
      choices,
      selectedChoiceIds: [],
      unavailableChoiceIds: new Set<ChoiceId>(),
      onchoose,
      ondismiss: vi.fn(),
    });
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[data-cy^="projected-choice-"]',
      ),
    ];
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[1]!);
    expect(onchoose).toHaveBeenCalledWith(choices[1]);
  });

  it("supports arrows, Home/End, pressed state, disabled choices and Escape", async () => {
    const ondismiss = vi.fn();
    render(ProjectedChoiceMenu, {
      entryId: "entry-1",
      cardLabel: "Card",
      zoneLabel: "Graveyard",
      choices,
      selectedChoiceIds: [choiceId("shuffle")],
      unavailableChoiceIds: new Set<ChoiceId>(),
      onchoose: vi.fn(),
      ondismiss,
    });
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[data-cy^="projected-choice-"]',
      ),
    ];
    expect(buttons[0]?.disabled).toBe(false);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    buttons[1]!.focus();
    const user = userEvent.setup();
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(buttons[0]);
    await user.keyboard("{End}{ArrowUp}{ArrowDown}{Escape}");
    expect(ondismiss).toHaveBeenCalledOnce();
  });

  it("skips disabled choices during keyboard navigation and safely no-ops when none are enabled", async () => {
    const mixedChoices: readonly InteractionChoice[] = [
      { id: choiceId("disabled-first"), label: "First", action: "select" },
      { id: choiceId("enabled-a"), label: "Enabled A", action: "select" },
      { id: choiceId("disabled-middle"), label: "Middle", action: "select" },
      { id: choiceId("enabled-b"), label: "Enabled B", action: "select" },
    ];
    const rendered = render(ProjectedChoiceMenu, {
      entryId: "entry-1",
      cardLabel: "Card",
      zoneLabel: "Graveyard",
      choices: mixedChoices,
      selectedChoiceIds: [],
      unavailableChoiceIds: new Set([
        choiceId("disabled-first"),
        choiceId("disabled-middle"),
      ]),
      onchoose: vi.fn(),
      ondismiss: vi.fn(),
    });
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[data-cy^="projected-choice-"]',
      ),
    ];
    buttons[1]!.focus();
    const user = userEvent.setup();
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(buttons[3]);
    await user.keyboard("{ArrowUp}{End}");
    expect(document.activeElement).toBe(buttons[3]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(buttons[1]);

    await rendered.rerender({
      unavailableChoiceIds: new Set(mixedChoices.map(({ id }) => id)),
    });
    expect(await fireEvent.keyDown(buttons[1]!, { key: "ArrowDown" })).toBe(
      true,
    );
    expect(document.activeElement).not.toBe(buttons[0]);
    expect(document.activeElement).not.toBe(buttons[2]);
  });

  it("native-disables unavailable opaque IDs while selected IDs stay removable", async () => {
    const onchoose = vi.fn();
    render(ProjectedChoiceMenu, {
      entryId: "entry-1",
      cardLabel: "Card",
      zoneLabel: "Graveyard",
      choices,
      selectedChoiceIds: [choiceId("shuffle")],
      unavailableChoiceIds: new Set([choiceId("banish")]),
      onchoose,
      ondismiss: vi.fn(),
    });
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        'button[data-cy^="projected-choice-"]',
      ),
    ];
    expect(buttons[0]?.disabled).toBe(true);
    expect(buttons[0]?.getAttribute("aria-disabled")).toBe("true");
    expect(buttons[1]?.disabled).toBe(false);
    expect(buttons[1]?.getAttribute("aria-disabled")).toBe("false");

    const user = userEvent.setup();
    await user.click(buttons[0]!);
    expect(onchoose).not.toHaveBeenCalled();
    await user.click(buttons[1]!);
    expect(onchoose).toHaveBeenCalledWith(choices[1]);
  });
});
