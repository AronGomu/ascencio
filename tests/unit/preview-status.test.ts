import { describe, expect, it } from "vitest";
import { previewStatusFor } from "../../src/app/presentation/preview-status.ts";
import { promptId } from "../../src/duel/contracts/ids.ts";
import type { PlayerPrompt } from "../../src/duel/contracts/player-prompt.ts";

const SOME_PROMPT: PlayerPrompt = {
  id: promptId("preview-status-prompt"),
  kind: "idleCommand",
  player: 0,
  title: "Choose a Main Phase action",
  choices: [],
  minimum: 1,
  maximum: 1,
  cancelable: false,
  ordered: false,
};

describe("previewStatusFor", () => {
  it("previewStatusFor reports the engine wait first", () => {
    expect(previewStatusFor(SOME_PROMPT, true)).toEqual({
      text: "Waiting for the engine",
      thinking: true,
    });
  });

  it("previewStatusFor reports the opponent turn", () => {
    expect(previewStatusFor(null, false)).toEqual({
      text: "Opponent is acting",
      thinking: true,
    });
  });

  it("chain status asks the question", () => {
    expect(previewStatusFor({ ...SOME_PROMPT, kind: "chain" }, false)).toEqual({
      text: "Do you respond?",
      thinking: true,
    });
  });

  it("a sent chain response reports the wait", () => {
    expect(previewStatusFor({ ...SOME_PROMPT, kind: "chain" }, true)).toEqual({
      text: "Waiting for the engine",
      thinking: true,
    });
  });

  it("previewStatusFor echoes the prompt title", () => {
    expect(previewStatusFor(SOME_PROMPT, false)).toEqual({
      text: "Choose a Main Phase action",
      thinking: false,
    });
  });
});
