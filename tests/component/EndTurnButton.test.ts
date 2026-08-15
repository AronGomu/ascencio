// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import EndTurnButton from "../../src/battle/app/components/duel-field/EndTurnButton.svelte";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/battle/app/prompts/interaction-spec.ts";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
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
    id: promptId(`${kind}-end-turn`),
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

describe("EndTurnButton", () => {
  it("reads the engine's own label", () => {
    const spec = specFor(
      fieldPrompt("battleCommand", [
        mountedChoice("attack", "Attack"),
        promptChoice("end", "End Battle Phase", { action: "endPhase" }),
      ]),
    );
    render(EndTurnButton, { spec, oninteraction: vi.fn() });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(button.textContent).toBe("End Battle Phase");
  });

  it("falls back to End turn with a null spec, disabled", () => {
    render(EndTurnButton, { spec: null, oninteraction: vi.fn() });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(button.textContent).toBe("End turn");
    expect(button.disabled).toBe(true);
  });

  it("is disabled without an endPhase choice", () => {
    const spec = specFor(
      fieldPrompt("battleCommand", [
        mountedChoice("attack", "Attack"),
        promptChoice("battle", "Enter Battle Phase", {
          action: "battlePhase",
        }),
      ]),
    );
    render(EndTurnButton, { spec, oninteraction: vi.fn() });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("is disabled while pending", () => {
    const spec = specFor(
      fieldPrompt("idleCommand", [
        mountedChoice("activate", "Activate"),
        promptChoice("end", "End turn", { action: "endPhase" }),
      ]),
    );
    render(EndTurnButton, { spec, disabled: true, oninteraction: vi.fn() });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("dispatches exactly once even if clicked again while pending", async () => {
    const spec = specFor(
      fieldPrompt("idleCommand", [
        mountedChoice("activate", "Activate"),
        promptChoice("end", "End turn", { action: "endPhase" }),
      ]),
    );
    const oninteraction = vi.fn();
    let disabled = false;
    const rendered = render(EndTurnButton, {
      spec,
      disabled,
      oninteraction,
    });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    await fireEvent.click(button);
    disabled = true;
    await rendered.rerender({ spec, disabled, oninteraction });
    await fireEvent.click(button);

    expect(oninteraction).toHaveBeenCalledOnce();
    expect(oninteraction).toHaveBeenCalledWith({
      type: "chooseChoice",
      choiceId: choiceId("end"),
      key: spec.key,
    });
  });

  it("carries the warning class", () => {
    const spec = specFor(
      fieldPrompt("idleCommand", [
        mountedChoice("activate", "Activate"),
        promptChoice("end", "End turn", { action: "endPhase" }),
      ]),
    );
    render(EndTurnButton, { spec, oninteraction: vi.fn() });

    const button = document.querySelector(
      '[data-cy="field-end-turn-button"]',
    ) as HTMLButtonElement;
    expect(button.classList.contains("warning")).toBe(true);
  });
});
