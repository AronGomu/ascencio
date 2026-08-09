import { describe, expect, it } from "vitest";
import {
  cardInstanceId,
  choiceId,
  promptId,
  type ChoiceId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/duel/contracts/player-prompt.ts";
import {
  fieldActionBarRequired,
  INTERACTION_SPEC_KINDS,
  interactionKey,
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import { validatePromptSelection } from "../../src/app/prompts/prompt-selection.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import { BOARD_VIEW_MODEL_FIXTURES } from "../fixtures/board-view-model.ts";

const SNAPSHOT = BOARD_VIEW_MODEL_FIXTURES["ST-08"];
const BOARD_RESULT = mapSnapshotToBoard(SNAPSHOT);
if (!BOARD_RESULT.ok)
  throw new Error("Expected valid interaction board fixture");
const BOARD = BOARD_RESULT.value;
const CONTEXT = { workerGeneration: 3, sessionGeneration: 5 } as const;
const FIRST = choiceId("first");
const SECOND = choiceId("second");

function choice(
  id: ChoiceId,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return {
    id,
    label: String(id),
    action: "select",
    ...overrides,
  };
}

function mountedCardChoice(
  id: ChoiceId,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return choice(id, {
    card: {
      instanceId: cardInstanceId(`positional-${id}`),
      controller: 0,
      location: "monster",
      sequence: 2,
      position: "faceUpAttack",
    },
    ...overrides,
  });
}

function prompt(
  kind: PromptKind,
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-interaction`),
    kind,
    player: 0,
    title: "Choose",
    message: "Choose legal option",
    choices: [choice(FIRST), choice(SECOND)],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

function specFor(value: PlayerPrompt): ActiveInteractionSpec {
  const spec = mapPromptToInteractionSpec(value, SNAPSHOT, BOARD, CONTEXT);
  if (spec.kind === "inactive") throw new Error("Expected active spec");
  return spec;
}

const EXPECTED_KINDS = {
  idleCommand: "cardAction",
  battleCommand: "cardAction",
  yesNo: "nonField",
  effectYesNo: "nonField",
  option: "nonField",
  chain: "cardAction",
  selectCard: "cardSelection",
  selectTribute: "cardSelection",
  selectSum: "cardSelection",
  selectUnselectCard: "cardSelection",
  selectPlace: "placeSelection",
  selectDisabledField: "placeSelection",
  selectPosition: "nonField",
  sortCard: "order",
  sortChain: "order",
  selectCounter: "counterAllocation",
  announceNumber: "nonField",
  announceAttribute: "nonField",
  announceRace: "nonField",
  announceCard: "nonField",
  rockPaperScissors: "nonField",
} as const satisfies Readonly<
  Record<PromptKind, ActiveInteractionSpec["kind"]>
>;

describe("prompt interaction spec", () => {
  it("classifies every PromptKind exhaustively", () => {
    expect(INTERACTION_SPEC_KINDS).toEqual(EXPECTED_KINDS);
    for (const [kind, expected] of Object.entries(EXPECTED_KINDS)) {
      expect(specFor(prompt(kind as PromptKind)).kind).toBe(expected);
    }
  });

  it.each([
    ["action", "idleCommand", "cardAction", "single"],
    ["single card", "selectCard", "cardSelection", "multiple"],
    ["multiple cards", "selectCard", "cardSelection", "multiple"],
    ["tribute", "selectTribute", "cardSelection", "multiple"],
    ["sum", "selectSum", "cardSelection", "multiple"],
    ["unselect", "selectUnselectCard", "cardSelection", "toggle"],
    ["place", "selectPlace", "placeSelection", "multiple"],
    ["disabled field", "selectDisabledField", "placeSelection", "multiple"],
    ["counter", "selectCounter", "counterAllocation", "counter"],
    ["order", "sortCard", "order", "order"],
    ["non-field", "yesNo", "nonField", "single"],
  ] as const)(
    "maps %s prompt fixture",
    (_name, kind, expectedKind, expectedFamily) => {
      const cardChoices =
        kind === "idleCommand" ||
        kind === "selectCard" ||
        kind === "selectTribute" ||
        kind === "selectSum" ||
        kind === "selectUnselectCard" ||
        kind === "selectCounter" ||
        kind === "sortCard"
          ? [
              mountedCardChoice(FIRST, {
                ...(kind === "selectCounter" ? { allocationMaximum: 2 } : {}),
              }),
            ]
          : undefined;
      const placeChoices =
        kind === "selectPlace" || kind === "selectDisabledField"
          ? [
              choice(FIRST, {
                place: { player: 0, location: "monster", sequence: 0 },
              }),
            ]
          : undefined;
      const choices = cardChoices ?? placeChoices ?? [choice(FIRST)];
      const spec = specFor(
        prompt(kind, {
          choices,
          maximum: _name === "multiple cards" ? 2 : 1,
          ordered: kind === "sortCard",
          ...(kind === "selectSum"
            ? { requiredTotal: 2, sumMode: "exact" as const }
            : {}),
        }),
      );

      expect(spec.kind).toBe(expectedKind);
      expect(spec.constraints.controlFamily).toBe(expectedFamily);
      expect(spec.key).toEqual({
        workerGeneration: 3,
        sessionGeneration: 5,
        promptId: promptId(`${kind}-interaction`),
      });
    },
  );

  it("keeps multiple opaque actions on one positional card distinct", () => {
    const value = prompt("idleCommand", {
      choices: [
        mountedCardChoice(FIRST, { action: "activate", label: "Activate" }),
        mountedCardChoice(SECOND, {
          action: "changePosition",
          label: "Change position",
        }),
      ],
    });

    const spec = specFor(value);
    expect(spec.kind).toBe("cardAction");
    expect(spec.fieldCapable).toBe(true);
    expect(
      spec.cardChoices.get("card:st08-chain-source")?.map(({ id }) => id),
    ).toEqual([FIRST, SECOND]);
    expect(validatePromptSelection(value, [SECOND])).toEqual({ valid: true });
  });

  it("resolves public positional identity and routes unresolved cards to semantic fallback", () => {
    const unresolved = choiceId("closed-stack-card");
    const spec = specFor(
      prompt("selectCard", {
        choices: [
          mountedCardChoice(FIRST),
          choice(unresolved, {
            card: {
              instanceId: cardInstanceId("stale-graveyard-instance"),
              controller: 0,
              location: "graveyard",
              sequence: 0,
              position: "faceUpAttack",
            },
          }),
        ],
      }),
    );

    expect(spec.cardChoices.get("card:st08-chain-source")?.[0]?.id).toBe(FIRST);
    expect(spec.globalChoices.get(unresolved)?.id).toBe(unresolved);
    expect(
      [...spec.cardChoices.values()].flat().some(({ id }) => id === unresolved),
    ).toBe(false);
  });

  it("maps physical places while keeping unsupported addresses in semantic fallback", () => {
    const unsupported = choiceId("unsupported-place");
    const spec = specFor(
      prompt("selectPlace", {
        choices: [
          choice(FIRST, {
            place: { player: 0, location: "monster", sequence: 0 },
          }),
          choice(unsupported, {
            place: { player: 0, location: "field", sequence: 1 },
          }),
        ],
      }),
    );

    expect(spec.zoneChoices.get("zone:p0:mainMonster:0")?.[0]?.id).toBe(FIRST);
    expect(spec.globalChoices.get(unsupported)?.id).toBe(unsupported);
  });

  it("contains constraints but no mutable selection, order, or allocation state", () => {
    const counter = specFor(
      prompt("selectCounter", {
        choices: [mountedCardChoice(FIRST, { allocationMaximum: 3 })],
        minimum: 2,
        maximum: 2,
      }),
    );
    const unselect = specFor(
      prompt("selectUnselectCard", {
        choices: [mountedCardChoice(FIRST, { selected: true })],
      }),
    );
    const order = specFor(
      prompt("sortCard", {
        choices: [mountedCardChoice(FIRST)],
        ordered: true,
      }),
    );
    const keys = collectKeys([counter, unselect, order]);

    expect(keys).not.toContain("selected");
    expect(keys).not.toContain("selectedChoiceIds");
    expect(keys).not.toContain("order");
    expect(keys).not.toContain("allocations");
    expect(counter.constraints).toMatchObject({ minimum: 2, maximum: 2 });
    expect(
      unselect.cardChoices.get("card:st08-chain-source")?.[0]?.toggleState,
    ).toBe("selected");
    expect(
      counter.cardChoices.get("card:st08-chain-source")?.[0],
    ).toMatchObject({
      id: FIRST,
      allocationMaximum: 3,
    });
    expect(Object.isFrozen(counter.cardChoices)).toBe(true);
    expect(Object.isFrozen(counter.zoneChoices)).toBe(true);
    expect(Object.isFrozen(counter.globalChoices)).toBe(true);
  });

  it("never turns malformed, ambiguous, duplicate, or unknown choices into field targets", () => {
    const duplicate = choiceId("duplicate");
    const malformed: readonly PromptChoice[] = [
      choice(duplicate, { card: mountedCardChoice(FIRST).card! }),
      choice(duplicate, { card: mountedCardChoice(SECOND).card! }),
      malformedChoice({
        ...mountedCardChoice(choiceId("unknown-action")),
        action: "unknown-action",
      }),
      malformedChoice({
        ...choice(choiceId("bad-place")),
        place: { player: 7, location: "monster", sequence: 0 },
      }),
      malformedChoice({
        ...mountedCardChoice(choiceId("ambiguous")),
        place: { player: 0, location: "monster", sequence: 0 },
      }),
    ];
    const spec = specFor(prompt("selectCard", { choices: malformed }));

    expect(spec.fieldCapable).toBe(false);
    expect(spec.cardChoices.size).toBe(0);
    expect(spec.zoneChoices.size).toBe(0);
    expect(spec.globalChoices.size).toBe(0);
  });

  it("produces structured-cloneable domain data without elements or functions", () => {
    const spec = specFor(
      prompt("idleCommand", {
        choices: [mountedCardChoice(FIRST), choice(SECOND, { action: "pass" })],
      }),
    );
    const cloned = structuredClone(spec);

    expect(cloned).toEqual(spec);
    expect(containsFunctionOrElement(cloned)).toBe(false);
  });

  it("creates stable value keys and an inactive spec without a prompt", () => {
    expect(interactionKey(3, 5, promptId("stable"))).toEqual(
      interactionKey(3, 5, promptId("stable")),
    );
    expect(mapPromptToInteractionSpec(null, SNAPSHOT, BOARD, CONTEXT)).toEqual({
      kind: "inactive",
    });
  });
});

describe("fieldActionBarRequired", () => {
  it("is required for card selection", () => {
    const spec = specFor(
      prompt("selectCard", { choices: [mountedCardChoice(FIRST)] }),
    );
    expect(fieldActionBarRequired(spec)).toBe(true);
  });

  it("is required for counter allocation", () => {
    const spec = specFor(
      prompt("selectCounter", {
        choices: [mountedCardChoice(FIRST, { allocationMaximum: 2 })],
      }),
    );
    expect(fieldActionBarRequired(spec)).toBe(true);
  });

  it("is required for order", () => {
    const spec = specFor(
      prompt("sortCard", {
        choices: [mountedCardChoice(FIRST)],
        ordered: true,
      }),
    );
    expect(fieldActionBarRequired(spec)).toBe(true);
  });

  it("is required for place selection", () => {
    const spec = specFor(
      prompt("selectPlace", {
        choices: [
          choice(FIRST, {
            place: { player: 0, location: "monster", sequence: 0 },
          }),
        ],
      }),
    );
    expect(fieldActionBarRequired(spec)).toBe(true);
  });

  it("is required when a card action has global choices", () => {
    const spec = specFor(
      prompt("idleCommand", {
        choices: [mountedCardChoice(FIRST), choice(SECOND, { action: "pass" })],
      }),
    );
    expect(spec.kind).toBe("cardAction");
    expect(spec.globalChoices.size).toBeGreaterThan(0);
    expect(fieldActionBarRequired(spec)).toBe(true);
  });

  it("is not required for a bare card action", () => {
    const spec = specFor(
      prompt("idleCommand", { choices: [mountedCardChoice(FIRST)] }),
    );
    expect(spec.kind).toBe("cardAction");
    expect(spec.globalChoices.size).toBe(0);
    expect(fieldActionBarRequired(spec)).toBe(false);
  });

  it("is not required for non-field specs", () => {
    const spec = specFor(prompt("yesNo"));
    expect(spec.kind).toBe("nonField");
    expect(fieldActionBarRequired(spec)).toBe(false);
  });
});

function malformedChoice(value: object): PromptChoice {
  return value as PromptChoice;
}

function collectKeys(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  if (value instanceof Map) {
    return [...value].flatMap(([key, entry]) => [
      ...collectKeys(key, seen),
      ...collectKeys(entry, seen),
    ]);
  }
  if (Array.isArray(value))
    return value.flatMap((entry) => collectKeys(entry, seen));
  return Object.entries(value).flatMap(([key, entry]) => [
    key,
    ...collectKeys(entry, seen),
  ]);
}

function containsFunctionOrElement(
  value: unknown,
  seen = new Set<unknown>(),
): boolean {
  if (typeof value === "function") return true;
  if (value === null || typeof value !== "object" || seen.has(value))
    return false;
  seen.add(value);
  if (typeof Element !== "undefined" && value instanceof Element) return true;
  if (value instanceof Map) {
    return [...value].some(
      ([key, entry]) =>
        containsFunctionOrElement(key, seen) ||
        containsFunctionOrElement(entry, seen),
    );
  }
  return Object.values(value).some((entry) =>
    containsFunctionOrElement(entry, seen),
  );
}
