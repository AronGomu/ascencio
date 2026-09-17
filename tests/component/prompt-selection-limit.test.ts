// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import PromptDialog from "../../src/battle/app/components/PromptDialog.svelte";

afterEach(() => cleanup());

const PROMPT: PlayerPrompt = {
  id: promptId("limited-selection"),
  kind: "announceAttribute",
  player: 0,
  title: "Choose two attributes",
  choices: ["Dark", "Light", "Fire"].map((label) => ({
    id: choiceId(label.toLowerCase()),
    label,
    action: "select" as const,
  })),
  minimum: 2,
  maximum: 2,
  cancelable: false,
  ordered: false,
};

describe("prompt selection limit", () => {
  it("disables unselected choices at the maximum and restores them after deselection", async () => {
    const user = userEvent.setup();
    render(PromptDialog, { prompt: PROMPT, onsubmit: vi.fn() });

    const dark = screen.getByRole("checkbox", { name: "Dark" });
    const light = screen.getByRole("checkbox", { name: "Light" });
    const fire = screen.getByRole("checkbox", { name: "Fire" });

    await user.click(dark);
    await user.click(light);

    expect((fire as HTMLInputElement).disabled).toBe(true);
    expect((dark as HTMLInputElement).disabled).toBe(false);
    expect((light as HTMLInputElement).disabled).toBe(false);

    await user.click(light);

    expect((fire as HTMLInputElement).disabled).toBe(false);
  });
});
