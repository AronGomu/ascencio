import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type { BoardTargetId } from "../../src/battle/field/board-view-model.ts";
import {
  createInteractionSession,
  reduceInteractionSession,
  synchronizeInteractionSession,
} from "../../src/battle/app/prompts/interaction-session.ts";
import {
  interactionChoicesInPromptOrder,
  type ActiveInteractionSpec,
  type InteractionChoice,
} from "../../src/battle/app/prompts/interaction-spec.ts";

const FIRST = choiceId("first");
const SECOND = choiceId("second");
const THIRD = choiceId("third");
const FOURTH = choiceId("fourth");
const TARGET = "card:first" as BoardTargetId;
const OTHER_TARGET = "card:second" as BoardTargetId;
const STACK_TARGET = "stack:p0:graveyard" as BoardTargetId;

function choice(
  id: typeof FIRST,
  allocationMaximum?: number,
): InteractionChoice {
  return Object.freeze({
    id,
    label: id,
    action: "select" as const,
    ...(allocationMaximum === undefined ? {} : { allocationMaximum }),
  });
}

function spec(
  overrides: Partial<ActiveInteractionSpec> = {},
): ActiveInteractionSpec {
  return {
    kind: "cardSelection",
    key: { workerGeneration: 2, sessionGeneration: 4, promptId: promptId("a") },
    promptKind: "selectCard",
    player: 0,
    title: "Choose",
    fieldCapable: true,
    constraints: {
      controlFamily: "multiple",
      minimum: 1,
      maximum: 2,
      cancelable: true,
      ordered: false,
      mandatoryContributions: [],
    },
    cardChoices: new Map([[TARGET, [choice(FIRST), choice(SECOND)]]]),
    zoneChoices: new Map(),
    stackChoices: new Map(),
    globalChoices: new Map([[THIRD, choice(THIRD)]]),
    overlayChoices: new Map(),
    offFieldChoices: [],
    choiceOrder: [FIRST, SECOND, THIRD],
    ...overrides,
  } as ActiveInteractionSpec;
}

/* T16: an off-field target lives in the aggregate list and, by design, also
   in the stack that launches it. */
function mixedSpec(): ActiveInteractionSpec {
  return spec({
    cardChoices: new Map([[TARGET, [choice(SECOND)]]]),
    stackChoices: new Map([[STACK_TARGET, [choice(FIRST), choice(FOURTH)]]]),
    globalChoices: new Map([[THIRD, choice(THIRD)]]),
    offFieldChoices: [choice(FIRST), choice(FOURTH)],
    choiceOrder: [FIRST, SECOND, THIRD, FOURTH],
    constraints: { ...spec().constraints, minimum: 1, maximum: 4 },
  });
}

describe("interactionChoicesInPromptOrder", () => {
  it("includes stack and off-field choices, deduped, in raw prompt order", () => {
    expect(
      interactionChoicesInPromptOrder(mixedSpec()).map(({ id }) => id),
    ).toEqual([FIRST, SECOND, THIRD, FOURTH]);
  });

  it("ignores an id the spec no longer carries", () => {
    const stale = spec({ choiceOrder: [FIRST, choiceId("stale"), THIRD] });
    expect(interactionChoicesInPromptOrder(stale).map(({ id }) => id)).toEqual([
      FIRST,
      THIRD,
    ]);
  });
});

describe("interaction session reducer", () => {
  it("accepts an off-field id and submits every category in prompt order", () => {
    const active = mixedSpec();
    let session = createInteractionSession(active);
    for (const selected of [FOURTH, SECOND, FIRST]) {
      session = reduceInteractionSession(session, active, {
        type: "toggleChoice",
        key: active.key,
        choiceId: selected,
      }).session;
    }

    expect(
      reduceInteractionSession(session, active, {
        type: "confirm",
        key: active.key,
      }).command?.choiceIds,
    ).toEqual([FIRST, SECOND, FOURTH]);
  });

  it("submits an off-field id immediately on chooseChoice", () => {
    const active = mixedSpec();
    expect(
      reduceInteractionSession(createInteractionSession(active), active, {
        type: "chooseChoice",
        key: active.key,
        choiceId: FOURTH,
      }).command,
    ).toEqual({ type: "submit", key: active.key, choiceIds: [FOURTH] });
  });

  it("still rejects an unknown id in a mixed spec", () => {
    const active = mixedSpec();
    const session = createInteractionSession(active);
    const rejected = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: active.key,
      choiceId: choiceId("unknown"),
    });

    expect(rejected.session).toBe(session);
    expect(rejected.command).toBeNull();
  });

  it("resets every draft field for a new interaction key", () => {
    const firstSpec = spec();
    let session = createInteractionSession(firstSpec);
    session = reduceInteractionSession(session, firstSpec, {
      type: "toggleChoice",
      key: firstSpec.key,
      choiceId: FIRST,
    }).session;
    session = reduceInteractionSession(session, firstSpec, {
      type: "openMenu",
      key: firstSpec.key,
      target: TARGET,
    }).session;

    const nextSpec = spec({
      key: { ...firstSpec.key, promptId: promptId("b") },
    });
    expect(synchronizeInteractionSession(session, nextSpec)).toEqual({
      key: nextSpec.key,
      status: "editing",
      selectedChoiceIds: [],
      order: [FIRST, SECOND, THIRD],
      allocations: new Map(),
      menuTarget: null,
    });
  });

  it("toggles known targets in prompt order and enforces selection maximum", () => {
    const active = spec();
    let session = createInteractionSession(active);
    for (const selected of [SECOND, FIRST, THIRD]) {
      session = reduceInteractionSession(session, active, {
        type: "toggleChoice",
        key: active.key,
        choiceId: selected,
      }).session;
    }
    expect(session.selectedChoiceIds).toEqual([FIRST, SECOND]);

    session = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: active.key,
      choiceId: FIRST,
    }).session;
    expect(session.selectedChoiceIds).toEqual([SECOND]);
  });

  it("emits selection only on explicit confirm without marking submitting", () => {
    const active = spec();
    let session = createInteractionSession(active);
    session = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: active.key,
      choiceId: FIRST,
    }).session;

    const confirmed = reduceInteractionSession(session, active, {
      type: "confirm",
      key: active.key,
    });
    expect(confirmed.command).toEqual({
      type: "submit",
      key: active.key,
      choiceIds: [FIRST],
    });
    expect(confirmed.session.status).toBe("editing");
  });

  it("emits cancellation only for a cancelable prompt", () => {
    const active = spec();
    expect(
      reduceInteractionSession(createInteractionSession(active), active, {
        type: "cancel",
        key: active.key,
      }).command,
    ).toEqual({ type: "submit", key: active.key, choiceIds: [] });

    const required = spec({
      constraints: { ...active.constraints, cancelable: false },
    });
    expect(
      reduceInteractionSession(createInteractionSession(required), required, {
        type: "cancel",
        key: required.key,
      }).command,
    ).toBeNull();
  });

  it("bounds counter allocations by choice maximum and prompt total", () => {
    const counter = spec({
      kind: "counterAllocation",
      promptKind: "selectCounter",
      constraints: {
        ...spec().constraints,
        controlFamily: "counter",
        minimum: 3,
        maximum: 3,
      },
      cardChoices: new Map([
        [TARGET, [choice(FIRST, 2)]],
        [OTHER_TARGET, [choice(SECOND, 3)]],
      ]),
      stackChoices: new Map(),
      globalChoices: new Map(),
    });
    let session = createInteractionSession(counter);
    for (const id of [FIRST, FIRST, FIRST, SECOND, SECOND]) {
      session = reduceInteractionSession(session, counter, {
        type: "adjustAllocation",
        key: counter.key,
        choiceId: id,
        delta: 1,
      }).session;
    }
    expect([...session.allocations]).toEqual([
      [FIRST, 2],
      [SECOND, 1],
    ]);
    expect(
      reduceInteractionSession(session, counter, {
        type: "confirm",
        key: counter.key,
      }).command?.choiceIds,
    ).toEqual([FIRST, FIRST, SECOND]);
  });

  it("reorders every known choice exactly once", () => {
    const ordered = spec({
      kind: "order",
      promptKind: "sortCard",
      constraints: {
        ...spec().constraints,
        controlFamily: "order",
        minimum: 3,
        maximum: 3,
        ordered: true,
      },
    });
    let session = createInteractionSession(ordered);
    session = reduceInteractionSession(session, ordered, {
      type: "moveChoice",
      key: ordered.key,
      choiceId: THIRD,
      toIndex: 0,
    }).session;
    expect(session.order).toEqual([THIRD, FIRST, SECOND]);
    expect(
      reduceInteractionSession(session, ordered, {
        type: "confirm",
        key: ordered.key,
      }).command?.choiceIds,
    ).toEqual([THIRD, FIRST, SECOND]);
  });

  it("ignores stale and unknown actions without state or command", () => {
    const active = spec();
    const session = createInteractionSession(active);
    const stale = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: { ...active.key, promptId: promptId("old") },
      choiceId: FIRST,
    });
    expect(stale.session).toBe(session);
    expect(stale.command).toBeNull();

    const unknown = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: active.key,
      choiceId: choiceId("unknown"),
    });
    expect(unknown.session).toBe(session);
    expect(unknown.command).toBeNull();
  });

  it("opens/closes valid menus and preserves draft on recoverable rejection", () => {
    const active = spec();
    let session = createInteractionSession(active);
    session = reduceInteractionSession(session, active, {
      type: "openMenu",
      key: active.key,
      target: TARGET,
    }).session;
    session = reduceInteractionSession(session, active, {
      type: "toggleChoice",
      key: active.key,
      choiceId: FIRST,
    }).session;
    session = reduceInteractionSession(session, active, {
      type: "submissionAccepted",
      key: active.key,
    }).session;
    expect(session.status).toBe("submitting");

    session = reduceInteractionSession(session, active, {
      type: "submissionRejected",
      key: active.key,
    }).session;
    expect(session).toMatchObject({
      status: "editing",
      selectedChoiceIds: [FIRST],
      menuTarget: TARGET,
    });

    session = reduceInteractionSession(session, active, {
      type: "closeMenu",
      key: active.key,
    }).session;
    expect(session.menuTarget).toBeNull();
  });
});
