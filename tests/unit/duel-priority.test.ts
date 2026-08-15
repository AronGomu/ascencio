import { describe, expect, it } from "vitest";
import { promptId } from "../../src/battle/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/battle/duel/contracts/player-prompt.ts";
import { hasDuelPriority } from "../../src/battle/app/prompts/duel-priority.ts";

const PROMPT: PlayerPrompt = {
  id: promptId("prompt-1"),
  kind: "idleCommand",
  player: 0,
  title: "Choose an action",
  choices: [],
  minimum: 0,
  maximum: 0,
  cancelable: false,
  ordered: false,
};

describe("hasDuelPriority", () => {
  it("priority requires a prompt", () => {
    expect(hasDuelPriority(null, false)).toBe(false);
  });

  it("priority requires no pending response", () => {
    expect(hasDuelPriority(PROMPT, true)).toBe(false);
  });

  it("priority granted", () => {
    expect(hasDuelPriority(PROMPT, false)).toBe(true);
  });
});
