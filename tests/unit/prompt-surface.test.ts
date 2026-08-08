import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/duel/contracts/player-prompt.ts";
import type {
  ActiveInteractionSpec,
  InteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import { promptSurface } from "../../src/app/prompts/prompt-surface.ts";

function choice(id: string, label: string): PromptChoice {
  return { id: choiceId(id), label, action: "select" };
}

function prompt(): PlayerPrompt {
  return {
    id: promptId("surface-prompt"),
    kind: "yesNo",
    player: 0,
    title: "Test prompt",
    choices: [choice("yes", "Yes"), choice("no", "No")],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
  };
}

function fieldCapableSpec(): ActiveInteractionSpec {
  return {
    kind: "cardAction",
    key: {
      workerGeneration: 1,
      sessionGeneration: 1,
      promptId: promptId("surface-prompt"),
    },
    promptKind: "idleCommand",
    player: 0,
    title: "Test prompt",
    fieldCapable: true,
    constraints: {
      controlFamily: "single",
      minimum: 1,
      maximum: 1,
      cancelable: false,
      ordered: false,
      mandatoryContributions: [],
    },
    cardChoices: new Map(),
    zoneChoices: new Map(),
    globalChoices: new Map(),
  };
}

function nonFieldSpec(): ActiveInteractionSpec {
  return {
    kind: "nonField",
    key: {
      workerGeneration: 1,
      sessionGeneration: 1,
      promptId: promptId("surface-prompt"),
    },
    promptKind: "yesNo",
    player: 0,
    title: "Test prompt",
    fieldCapable: false,
    constraints: {
      controlFamily: "single",
      minimum: 1,
      maximum: 1,
      cancelable: false,
      ordered: false,
      mandatoryContributions: [],
    },
    cardChoices: new Map(),
    zoneChoices: new Map(),
    globalChoices: new Map(),
  };
}

describe("promptSurface", () => {
  it("no prompt means no surface", () => {
    expect(promptSurface(null, null, false)).toBe("none");
  });

  it("visible workspace docks the prompt", () => {
    expect(promptSurface(prompt(), fieldCapableSpec(), true)).toBe("docked");
    expect(promptSurface(prompt(), null, true)).toBe("docked");
  });

  it("field-capable prompt stays on the field", () => {
    expect(promptSurface(prompt(), fieldCapableSpec(), false)).toBe("field");
  });

  it("non-field prompt opens the dialog", () => {
    expect(promptSurface(prompt(), nonFieldSpec(), false)).toBe("dialog");
  });

  it("inactive spec opens the dialog", () => {
    const inactive: InteractionSpec = { kind: "inactive" };
    expect(promptSurface(prompt(), inactive, false)).toBe("dialog");
  });

  it("null spec opens the dialog", () => {
    expect(promptSurface(prompt(), null, false)).toBe("dialog");
  });
});
