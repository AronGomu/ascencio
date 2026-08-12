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

function prompt(overrides: Partial<PlayerPrompt> = {}): PlayerPrompt {
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
    ...overrides,
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
    stackChoices: new Map(),
    globalChoices: new Map(),
    offFieldChoices: [],
    choiceOrder: [],
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
    stackChoices: new Map(),
    globalChoices: new Map(),
    offFieldChoices: [],
    choiceOrder: [],
  };
}

function battleCommandSpec(fieldCapable: boolean): ActiveInteractionSpec {
  return {
    kind: "cardAction",
    key: {
      workerGeneration: 1,
      sessionGeneration: 1,
      promptId: promptId("surface-prompt"),
    },
    promptKind: "battleCommand",
    player: 0,
    title: "Test prompt",
    fieldCapable,
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
    stackChoices: new Map(),
    globalChoices: new Map(),
    offFieldChoices: [],
    choiceOrder: [],
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

  it("chain prompts never open the dialog", () => {
    expect(
      promptSurface(prompt({ kind: "chain" }), nonFieldSpec(), false),
    ).toBe("field");
  });

  it("chain prompts still dock in the workspace", () => {
    expect(promptSurface(prompt({ kind: "chain" }), nonFieldSpec(), true)).toBe(
      "docked",
    );
  });

  it("phase-only battleCommand stays on the field when field is rendered", () => {
    expect(
      promptSurface(
        prompt({ kind: "battleCommand" }),
        battleCommandSpec(false),
        false,
        true,
      ),
    ).toBe("field");
  });

  it("battleCommand with attack targets stays on the field", () => {
    expect(
      promptSurface(
        prompt({ kind: "battleCommand" }),
        battleCommandSpec(true),
        false,
        true,
      ),
    ).toBe("field");
  });

  it("battleCommand opens the dialog when field is unavailable", () => {
    expect(
      promptSurface(
        prompt({ kind: "battleCommand" }),
        battleCommandSpec(false),
        false,
        false,
      ),
    ).toBe("dialog");
  });

  it("battleCommand still docks in the workspace", () => {
    expect(
      promptSurface(
        prompt({ kind: "battleCommand" }),
        battleCommandSpec(false),
        true,
        true,
      ),
    ).toBe("docked");
  });

  it("other non-field prompts still open the dialog", () => {
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
