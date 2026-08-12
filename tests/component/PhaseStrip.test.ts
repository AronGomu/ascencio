// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import PhaseStrip from "../../src/app/components/duel-field/PhaseStrip.svelte";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/duel/contracts/player-prompt.ts";
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import { BOARD_VIEW_MODEL_FIXTURES } from "../fixtures/board-view-model.ts";

afterEach(() => {
  cleanup();
});

const CONTEXT = { workerGeneration: 1, sessionGeneration: 2 } as const;

function board() {
  const result = mapSnapshotToBoard(BOARD_VIEW_MODEL_FIXTURES["ST-05"]);
  if (!result.ok) throw new Error("Fixture mapping failed");
  return result.value;
}

function promptChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return { id: choiceId(id), label, action: "select", ...overrides };
}

function mountedChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return promptChoice(id, label, {
    card: {
      instanceId: cardInstanceId(`prompt-${id}`),
      controller: 0,
      location: "monster",
      sequence: 0,
      position: "faceUpAttack",
    },
    ...overrides,
  } as Partial<PromptChoice>);
}

function fieldPrompt(
  kind: PromptKind,
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-phase-strip`),
    kind,
    player: 0,
    title: `Test ${kind}`,
    choices,
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

function specFor(value: PlayerPrompt): ActiveInteractionSpec {
  const snapshot = BOARD_VIEW_MODEL_FIXTURES["ST-05"];
  const spec = mapPromptToInteractionSpec(value, snapshot, board(), CONTEXT);
  if (spec.kind === "inactive") throw new Error("Expected active field spec");
  return spec;
}

function battleOfferedSpec(): ActiveInteractionSpec {
  return specFor(
    fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate"),
      promptChoice("battle", "Enter Battle Phase", { action: "battlePhase" }),
    ]),
  );
}

function endOfferedSpec(): ActiveInteractionSpec {
  return specFor(
    fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate"),
      promptChoice("end", "End turn", { action: "endPhase" }),
    ]),
  );
}

function battleAndEndOfferedSpec(): ActiveInteractionSpec {
  return specFor(
    fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate"),
      promptChoice("battle", "Enter Battle Phase", { action: "battlePhase" }),
      promptChoice("end", "End turn", { action: "endPhase" }),
    ]),
  );
}

describe("PhaseStrip", () => {
  it("renders five phase chips and one End turn button", () => {
    render(PhaseStrip, { phase: "main1", spec: null, oninteraction: vi.fn() });

    for (const slot of ["draw", "standby", "main1", "battle", "main2"])
      expect(
        document.querySelector(`[data-cy="field-phase-chip-${slot}"]`),
      ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="field-phase-chip-end"]'),
    ).toBeNull();

    const endButton = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement | null;
    expect(endButton).not.toBeNull();
    expect(endButton?.disabled).toBe(true);
  });

  it("places Battle in left and Main 2 plus End in right", () => {
    render(PhaseStrip, { phase: "main1", spec: null, oninteraction: vi.fn() });

    const left = document.querySelector('[data-cy="field-phase-strip-left"]');
    const right = document.querySelector('[data-cy="field-phase-strip-right"]');
    expect(left?.children.length).toBe(4);
    expect(right?.children.length).toBe(2);
    expect(right?.children[0]?.getAttribute("data-cy")).toBe(
      "field-phase-chip-main2",
    );
    expect(right?.children[1]?.getAttribute("data-cy")).toBe(
      "field-end-turn-button",
    );
  });

  it("End button dispatches the endPhase choice", async () => {
    const spec = endOfferedSpec();
    const oninteraction = vi.fn();
    render(PhaseStrip, { phase: "main1", spec, oninteraction });

    const endButton = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    await fireEvent.click(endButton);

    expect(oninteraction).toHaveBeenCalledOnce();
    expect(oninteraction).toHaveBeenCalledWith({
      type: "chooseChoice",
      choiceId: choiceId("end"),
      key: spec.key,
    });
  });

  it("disabled blocks phase and End controls", async () => {
    const spec = battleAndEndOfferedSpec();
    const oninteraction = vi.fn();
    render(PhaseStrip, {
      phase: "main1",
      spec,
      disabled: true,
      oninteraction,
    });

    const battleChip = document.querySelector(
      '[data-cy="field-phase-chip-battle"]',
    );
    expect(battleChip?.tagName).toBe("SPAN");
    await fireEvent.click(battleChip as Element);

    const endButton = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(endButton.disabled).toBe(true);
    await fireEvent.click(endButton);

    expect(oninteraction).not.toHaveBeenCalled();
  });

  it("marks the current phase", () => {
    render(PhaseStrip, { phase: "main1", spec: null, oninteraction: vi.fn() });

    expect(
      document
        .querySelector('[data-cy="field-phase-chip-main1"]')
        ?.classList.contains("is-current"),
    ).toBe(true);
    expect(
      document
        .querySelector('[data-cy="field-phase-chip-draw"]')
        ?.classList.contains("is-current"),
    ).toBe(false);
  });

  it("battle-family phases light the battle chip", () => {
    render(PhaseStrip, {
      phase: "damageCalculation",
      spec: null,
      oninteraction: vi.fn(),
    });

    expect(
      document
        .querySelector('[data-cy="field-phase-chip-battle"]')
        ?.classList.contains("is-current"),
    ).toBe(true);
  });

  it("only offered transitions are buttons", () => {
    const spec = battleOfferedSpec();
    render(PhaseStrip, { phase: "main1", spec, oninteraction: vi.fn() });

    expect(
      document.querySelector('[data-cy="field-phase-chip-battle"]')?.tagName,
    ).toBe("BUTTON");
    expect(
      document.querySelector('[data-cy="field-phase-chip-draw"]')?.tagName,
    ).toBe("SPAN");
  });

  it("no end chip is current and the strip surfaces end as an accessible status; End button stays an ordinary action", () => {
    const spec = endOfferedSpec();
    render(PhaseStrip, { phase: "end", spec, oninteraction: vi.fn() });

    expect(
      document.querySelector('[data-cy="field-phase-chip-end"]'),
    ).toBeNull();
    expect(
      document
        .querySelector('[data-cy="field-phase-strip"]')
        ?.getAttribute("data-current-phase"),
    ).toBe("end");

    const endButton = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    );
    expect(endButton?.classList.contains("is-current")).toBe(false);
  });
});
