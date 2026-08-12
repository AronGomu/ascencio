// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FieldActionBar from "../../src/app/components/duel-field/FieldActionBar.svelte";
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
import { createInteractionSession } from "../../src/app/prompts/interaction-session.ts";
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
    id: promptId(`${kind}-action-bar`),
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

describe("FieldActionBar", () => {
  it("never renders phase-transition choices in the global choice group, but a genuine global does", () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      promptChoice("battle", "Enter Battle Phase", { action: "battlePhase" }),
      promptChoice("main2", "Enter Main Phase 2", { action: "mainPhase2" }),
      promptChoice("end", "End turn", { action: "endPhase" }),
      promptChoice("pass", "Pass", { action: "pass" }),
    ]);
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    render(FieldActionBar, {
      spec,
      session,
      oninteraction: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="field-action-bar-choice-battle"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="field-action-bar-choice-main2"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="field-action-bar-choice-end"]'),
    ).toBeNull();
    expect(
      document.querySelector('[data-cy="field-action-bar-choice-pass"]'),
    ).not.toBeNull();
  });

  it("does not render Confirm for an exact singleton card selection, even if mounted directly", () => {
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    render(FieldActionBar, {
      spec,
      session,
      confirmValid: true,
      oninteraction: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="field-action-bar-confirm"]'),
    ).toBeNull();
  });

  it("confirm dispatches with the spec key", async () => {
    const value = fieldPrompt(
      "selectCard",
      [mountedChoice("select", "Select monster")],
      { minimum: 1, maximum: 2 },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    const oninteraction = vi.fn();
    render(FieldActionBar, {
      spec,
      session,
      confirmValid: true,
      oninteraction,
    });

    await fireEvent.click(
      document.querySelector(
        '[data-cy="field-action-bar-confirm"]',
      ) as HTMLButtonElement,
    );
    expect(oninteraction).toHaveBeenCalledOnce();
    expect(oninteraction).toHaveBeenCalledWith({
      type: "confirm",
      key: spec.key,
    });
  });

  it("confirm blocked while invalid", () => {
    const value = fieldPrompt(
      "selectCard",
      [mountedChoice("select", "Select monster")],
      { minimum: 1, maximum: 2 },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    render(FieldActionBar, {
      spec,
      session,
      confirmValid: false,
      validationMessage: "Pick one card",
      oninteraction: vi.fn(),
    });

    const confirm = document.querySelector(
      '[data-cy="field-action-bar-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(confirm.getAttribute("aria-describedby")).toBe(
      "field-action-bar-validation",
    );
    expect(
      document.querySelector('[data-cy="field-action-bar-validation"]')
        ?.textContent,
    ).toBe("Pick one card");
  });

  it("cancel only when cancelable", () => {
    const value = fieldPrompt(
      "selectCard",
      [mountedChoice("select", "Select monster")],
      { cancelable: false },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    render(FieldActionBar, {
      spec,
      session,
      confirmValid: true,
      oninteraction: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="field-action-bar-cancel"]'),
    ).toBeNull();
  });

  it("counter increment dispatches", async () => {
    const value = fieldPrompt(
      "selectCounter",
      [mountedChoice("c1", "Spell Counter", { allocationMaximum: 2 })],
      { minimum: 1, maximum: 2 },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    const oninteraction = vi.fn();
    render(FieldActionBar, {
      spec,
      session,
      oninteraction,
    });

    await fireEvent.click(
      document.querySelector(
        '[data-cy="field-action-bar-increment-c1"]',
      ) as HTMLButtonElement,
    );
    expect(oninteraction).toHaveBeenCalledOnce();
    expect(oninteraction).toHaveBeenCalledWith({
      type: "adjustAllocation",
      choiceId: choiceId("c1"),
      delta: 1,
      key: spec.key,
    });
  });

  it("counter decrement disabled at zero", () => {
    const value = fieldPrompt(
      "selectCounter",
      [mountedChoice("c1", "Spell Counter", { allocationMaximum: 2 })],
      { minimum: 1, maximum: 2 },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    render(FieldActionBar, {
      spec,
      session,
      oninteraction: vi.fn(),
    });

    const decrement = document.querySelector(
      '[data-cy="field-action-bar-decrement-c1"]',
    ) as HTMLButtonElement;
    expect(decrement.disabled).toBe(true);
  });

  it("order move up dispatches the new index", async () => {
    const value = fieldPrompt(
      "sortCard",
      [mountedChoice("c1", "First"), mountedChoice("c2", "Second")],
      { minimum: 2, maximum: 2, ordered: true },
    );
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    const oninteraction = vi.fn();
    render(FieldActionBar, {
      spec,
      session,
      oninteraction,
    });

    await fireEvent.click(
      document.querySelector(
        '[data-cy="field-action-bar-up-c2"]',
      ) as HTMLButtonElement,
    );
    expect(oninteraction).toHaveBeenCalledOnce();
    expect(oninteraction).toHaveBeenCalledWith({
      type: "moveChoice",
      choiceId: choiceId("c2"),
      toIndex: 0,
      key: spec.key,
    });
  });

  it("global choices are buttons", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      promptChoice("g1", "Pass", { action: "pass" }),
    ]);
    const spec = specFor(value);
    const session = createInteractionSession(spec);
    const oninteraction = vi.fn();
    render(FieldActionBar, {
      spec,
      session,
      oninteraction,
    });

    const button = document.querySelector(
      '[data-cy="field-action-bar-choice-g1"]',
    ) as HTMLButtonElement;
    expect(button).not.toBeNull();
    await fireEvent.click(button);
    expect(oninteraction).toHaveBeenCalledWith({
      type: "chooseChoice",
      choiceId: choiceId("g1"),
      key: spec.key,
    });
  });

  it("summary counts selections", () => {
    const value = fieldPrompt(
      "selectCard",
      [mountedChoice("c1", "First"), mountedChoice("c2", "Second")],
      { minimum: 2, maximum: 2 },
    );
    const spec = specFor(value);
    let session = createInteractionSession(spec);
    session = {
      ...session,
      selectedChoiceIds: [choiceId("c1"), choiceId("c2")],
    };
    render(FieldActionBar, {
      spec,
      session,
      oninteraction: vi.fn(),
    });

    expect(
      document.querySelector('[data-cy="field-action-bar-summary"]')
        ?.textContent,
    ).toBe("2 selected");
  });
});
