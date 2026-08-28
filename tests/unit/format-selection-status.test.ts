import { describe, expect, it } from "vitest";
import {
  formatSelectionStatus,
  SELECTION_STATUS_KINDS,
} from "../../src/battle/app/presentation/format-selection-status.ts";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { ChoiceId } from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/battle/duel/contracts/player-prompt.ts";

const FIRST = choiceId("c1");
const SECOND = choiceId("c2");

function cardChoice(
  id: ChoiceId,
  card: Partial<PromptChoice["card"]> = {},
): PromptChoice {
  return {
    id,
    label: String(id),
    action: "select",
    card: {
      instanceId: cardInstanceId(`status-${id}`),
      controller: 0,
      location: "monster",
      sequence: 0,
      ...card,
    },
  };
}

function statusPrompt(
  kind: PromptKind,
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-status`),
    kind,
    player: 0,
    title: `Test ${kind}`,
    choices: [cardChoice(FIRST), cardChoice(SECOND)],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

describe("formatSelectionStatus", () => {
  it("covers exactly the selection family", () => {
    expect([...SELECTION_STATUS_KINDS].sort()).toEqual([
      "selectCard",
      "selectSum",
      "selectTribute",
      "selectUnselectCard",
    ]);
  });

  it("returns null for a non-selection prompt", () => {
    const prompt = statusPrompt("yesNo", { choices: [] });
    expect(formatSelectionStatus(prompt, [FIRST])).toBeNull();
  });

  it("exact requirement counts selected of maximum", () => {
    const prompt = statusPrompt("selectCard", { minimum: 2, maximum: 2 });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe("1 of 2 selected");
  });

  it("zero selected still renders", () => {
    const prompt = statusPrompt("selectCard", { minimum: 1, maximum: 1 });
    expect(formatSelectionStatus(prompt, [])).toBe("0 of 1 selected");
  });

  it("range requirement shows the span", () => {
    const prompt = statusPrompt("selectTribute", { minimum: 1, maximum: 3 });
    expect(formatSelectionStatus(prompt, [FIRST, SECOND])).toBe(
      "2 selected (choose 1–3)",
    );
  });

  it("ignores unknown and duplicate ids", () => {
    const prompt = statusPrompt("selectCard", { minimum: 2, maximum: 2 });
    expect(
      formatSelectionStatus(prompt, [FIRST, FIRST, choiceId("ghost")]),
    ).toBe("1 of 2 selected");
  });

  it("selectSum exact appends the sum", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [cardChoice(FIRST, { contribution: 4 }), cardChoice(SECOND)],
      minimum: 2,
      maximum: 2,
      requiredTotal: 8,
      sumMode: "exact",
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe(
      "1 of 2 selected · sum 4 of 8",
    );
  });

  it("selectSum atLeast wording", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [
        cardChoice(FIRST, { contribution: 4 }),
        cardChoice(SECOND, { contribution: 5 }),
      ],
      minimum: 1,
      maximum: 3,
      requiredTotal: 8,
      sumMode: "atLeast",
    });
    expect(formatSelectionStatus(prompt, [FIRST, SECOND])).toBe(
      "2 selected (choose 1–3) · sum 9 of at least 8",
    );
  });

  it("dual contribution picks the best fit", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [
        cardChoice(FIRST, { contribution: 1, alternativeContribution: 7 }),
      ],
      minimum: 2,
      maximum: 2,
      requiredTotal: 7,
      sumMode: "exact",
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe(
      "1 of 2 selected · sum 7 of 7",
    );
  });

  it("nearest total below the target wins when the exact sum is unreachable", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [
        cardChoice(FIRST, { contribution: 1, alternativeContribution: 7 }),
      ],
      minimum: 2,
      maximum: 2,
      requiredTotal: 6,
      sumMode: "exact",
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe(
      "1 of 2 selected · sum 1 of 6",
    );
  });

  it("mandatory contributions count into the total", () => {
    const prompt = statusPrompt("selectSum", {
      minimum: 2,
      maximum: 2,
      requiredTotal: 8,
      sumMode: "exact",
      mandatoryContributions: [{ contribution: 4 }],
    });
    expect(formatSelectionStatus(prompt, [])).toBe(
      "0 of 2 selected · sum 4 of 8",
    );
  });

  /* Every selected card contributes exactly one option, so an overshoot has no
     achievable total under the target and the panel reports the real sum. */
  it("overshoot in exact mode reports the achievable total", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [
        cardChoice(FIRST, { contribution: 4 }),
        cardChoice(SECOND, { contribution: 4 }),
      ],
      minimum: 2,
      maximum: 2,
      requiredTotal: 6,
      sumMode: "exact",
    });
    expect(formatSelectionStatus(prompt, [FIRST, SECOND])).toBe(
      "2 of 2 selected · sum 8 of 6",
    );
  });

  it("atLeast falls back to the highest achievable total", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [cardChoice(FIRST, { contribution: 4 })],
      minimum: 2,
      maximum: 2,
      requiredTotal: 8,
      sumMode: "atLeast",
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe(
      "1 of 2 selected · sum 4 of at least 8",
    );
  });

  it("selectSum without requiredTotal renders count only", () => {
    const prompt = statusPrompt("selectSum", { minimum: 1, maximum: 1 });
    expect(formatSelectionStatus(prompt, [])).toBe("0 of 1 selected");
  });

  it("selectUnselectCard renders count part", () => {
    const prompt = statusPrompt("selectUnselectCard", {
      minimum: 1,
      maximum: 1,
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe("1 of 1 selected");
  });

  it("a matched choice without a card contributes nothing to the sum", () => {
    const prompt = statusPrompt("selectSum", {
      choices: [{ id: FIRST, label: "Finish", action: "select" }],
      minimum: 1,
      maximum: 1,
      requiredTotal: 4,
      sumMode: "exact",
    });
    expect(formatSelectionStatus(prompt, [FIRST])).toBe(
      "1 of 1 selected · sum 0 of 4",
    );
  });
});
