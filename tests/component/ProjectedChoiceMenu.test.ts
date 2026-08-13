// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectedChoiceMenu from "../../src/app/components/duel-field/ProjectedChoiceMenu.svelte";
import { choiceId } from "../../src/duel/contracts/ids.ts";
import type { ChoiceId } from "../../src/duel/contracts/ids.ts";
import type { InteractionChoice } from "../../src/app/prompts/interaction-spec.ts";

const choices: readonly InteractionChoice[] = [
  { id: choiceId("banish"), label: "Banish", action: "select" },
  { id: choiceId("shuffle"), label: "Shuffle back", action: "select" },
];

afterEach(cleanup);

describe("ProjectedChoiceMenu", () => {
  it("keeps every opaque choice individually answerable", async () => {
    const onchoose = vi.fn();
    render(ProjectedChoiceMenu, {
      entryId: "entry-1", cardLabel: "Card", zoneLabel: "Graveyard", choices,
      selectedChoiceIds: [], disabledChoiceIds: new Set<ChoiceId>(), onchoose, ondismiss: vi.fn(),
    });
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-cy^="projected-choice-"]')];
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[1]!);
    expect(onchoose).toHaveBeenCalledWith(choices[1]);
  });

  it("supports arrows, Home/End, pressed state, disabled choices and Escape", async () => {
    const ondismiss = vi.fn();
    render(ProjectedChoiceMenu, {
      entryId: "entry-1", cardLabel: "Card", zoneLabel: "Graveyard", choices,
      selectedChoiceIds: [choiceId("shuffle")], disabledChoiceIds: new Set<ChoiceId>(),
      onchoose: vi.fn(), ondismiss,
    });
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('button[data-cy^="projected-choice-"]')];
    expect(buttons[0]?.disabled).toBe(false);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");
    buttons[1]!.focus();
    const user = userEvent.setup();
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(buttons[0]);
    await user.keyboard("{End}{ArrowUp}{ArrowDown}{Escape}");
    expect(ondismiss).toHaveBeenCalledOnce();
  });
});
