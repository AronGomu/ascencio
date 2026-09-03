import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import type {
  ActiveInteractionSpec,
  InteractionSpec,
} from "../../src/battle/app/prompts/interaction-spec.ts";
import { mapPromptToInteractionSpec } from "../../src/battle/app/prompts/interaction-spec.ts";
import { promptSurface } from "../../src/battle/app/prompts/prompt-surface.ts";
import { cardInstanceId } from "../../src/battle/duel/contracts/ids.ts";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";

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
    overlayChoices: new Map(),
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
    overlayChoices: new Map(),
    offFieldChoices: [],
    choiceOrder: [],
  };
}

const CONTEXT = { workerGeneration: 1, sessionGeneration: 1 } as const;

/** One graveyard target: off-field capable, with no mounted field control. */
function offFieldPrompt(): PlayerPrompt {
  return prompt({
    kind: "selectCard",
    choices: [
      {
        ...choice("gy-0", "Graveyard card"),
        card: {
          instanceId: cardInstanceId("surface-gy-0"),
          controller: 0,
          location: "graveyard",
          sequence: 0,
          position: "faceUpAttack",
        },
      },
    ],
  });
}

/** One Xyz material: field-capable through its dedicated visual dialog. */
function overlayPrompt(): PlayerPrompt {
  return prompt({
    kind: "selectCard",
    choices: [
      {
        ...choice("material-0", "Xyz material"),
        card: {
          instanceId: cardInstanceId("surface-material-0"),
          controller: 0,
          location: "monster",
          sequence: 0,
          overlay: true,
        },
      },
    ],
  });
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
    overlayChoices: new Map(),
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

  /* A board-mapping failure leaves `board === null`, and an off-field-capable
     prompt used to stay on a field that App never renders — neither surface
     mounted, so only surrender or reset could end the duel. */
  it("an off-field prompt opens the dialog when the board failed to map", () => {
    const value = offFieldPrompt();
    const spec = mapPromptToInteractionSpec(value, null, null, CONTEXT);
    if (spec.kind === "inactive") throw new Error("Expected an active spec");

    expect(promptSurface(value, spec, false, false)).toBe("dialog");
  });

  it("the same off-field prompt stays on a rendered field", () => {
    const value = offFieldPrompt();
    const snapshot = BOARD_VIEW_MODEL_FIXTURES["ST-05"];
    const mapped = mapSnapshotToBoard(snapshot, BOARD_CARD_TEXTS);
    if (!mapped.ok) throw new Error("Fixture mapping failed");
    const spec = mapPromptToInteractionSpec(
      value,
      snapshot,
      mapped.value,
      CONTEXT,
    );
    if (spec.kind === "inactive") throw new Error("Expected an active spec");
    expect(spec.fieldCapable).toBe(true);

    expect(promptSurface(value, spec, false, true)).toBe("field");
  });

  it("keeps overlay choices off the plain prompt dialog", () => {
    const value = overlayPrompt();
    const snapshot = BOARD_VIEW_MODEL_FIXTURES["ST-05"];
    const mapped = mapSnapshotToBoard(snapshot, BOARD_CARD_TEXTS);
    if (!mapped.ok) throw new Error("Fixture mapping failed");
    const spec = mapPromptToInteractionSpec(
      value,
      snapshot,
      mapped.value,
      CONTEXT,
    );
    if (spec.kind === "inactive") throw new Error("Expected an active spec");

    expect(spec.overlayChoices.size).toBe(1);
    expect(spec.fieldCapable).toBe(true);
    expect(promptSurface(value, spec, false, true)).toBe("field");
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
