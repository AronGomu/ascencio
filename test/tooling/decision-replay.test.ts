import type { ChoiceId } from "../../src/battle/duel/contracts/ids.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  DecisionReplay,
  type ReplayEntry,
} from "../../scripts/bot-evaluation/decision-replay.ts";
const prompt = {
  id: "p",
  player: 0,
  kind: "yesNo",
  choices: {
    choice: [
      { id: "yes", action: "yes" },
      { id: "no", action: "no" },
    ],
  },
};
function fixture(swapped = false) {
  const actor = swapped ? "b" : "a";
  const entry = {
    kind: "decision",
    actor,
    decision_id: "0-decision-1",
    prompt: { ...prompt, player: actor },
    turn: 1,
    phase: "main1",
    selected_choice_ids: {
      choice_id: ["yes" as ChoiceId],
    },
    reason: { code: "test", explanation: "test" },
  };
  const records = [
    { timeline: { entry: [] as ReplayEntry[] } },
    { timeline: { entry: [] as ReplayEntry[] } },
  ];
  records[swapped ? 1 : 0]!.timeline.entry.push(entry);
  return { actor: actor as "a" | "b", decision: "0-decision-1", records };
}
test("verifies the prompt before allowing takeover, including swapped seats", () => {
  for (const swapped of [false, true]) {
    const r = new DecisionReplay(fixture(swapped), swapped ? [1, 0] : [0, 1]);
    assert.equal(r.decision(0, "0-decision-1", prompt, 1, "main1"), undefined);
    assert.equal(r.reached, true);
  }
});
test("rejects altered legal choices at takeover", () => {
  const r = new DecisionReplay(fixture(), [0, 1]);
  assert.throws(
    () =>
      r.decision(
        0,
        "0-decision-1",
        { ...prompt, choices: { choice: [] } },
        1,
        "main1",
      ),
    /replay_mismatch/,
  );
  assert.equal(r.reached, false);
});
test("replays recorded choices before takeover rather than newly calculated choices", () => {
  const spec = fixture();
  spec.records[0]!.timeline.entry.push({
    ...spec.records[0]!.timeline.entry[0]!,
    decision_id: "0-decision-2",
  });
  spec.decision = "0-decision-2";
  const r = new DecisionReplay(spec, [0, 1]);
  assert.deepEqual(
    r.decision(0, "0-decision-1", prompt, 1, "main1")?.choiceIds,
    ["yes"],
  );
  assert.equal(r.reached, false);
  r.decision(0, "0-decision-2", prompt, 1, "main1");
  assert.equal(r.reached, true);
});
test("rejects event/state divergence before takeover", () => {
  const spec = fixture();
  spec.records[0]!.timeline.entry.unshift({
    kind: "event",
    actor: "b",
    event: "damage",
    changes: { value: 500 },
  });
  const r = new DecisionReplay(spec, [0, 1]);
  assert.throws(
    () =>
      r.event(0, {
        kind: "event",
        actor: 1,
        event: "damage",
        changes: { value: 600 },
      }),
    /replay_mismatch/,
  );
});
test("verifies actor-relative events then permits divergence after takeover", () => {
  const spec = fixture(true);
  spec.records[1]!.timeline.entry.unshift({
    kind: "event",
    actor: "a",
    event: "damage",
    changes: { value: "500" },
  });
  const r = new DecisionReplay(spec, [1, 0]);
  r.event(0, {
    kind: "event",
    actor: 1,
    event: "damage",
    changes: { value: 500 },
  });
  r.decision(0, "0-decision-1", prompt, 1, "main1");
  assert.doesNotThrow(() => r.event(0, { anything: "branch" }));
});
test("requires retained unique target decisions", () => {
  const spec = fixture();
  spec.decision = "missing";
  assert.throws(() => new DecisionReplay(spec, [0, 1]), /not uniquely present/);
});

test("verifies initial state and maps starting-side rotation", () => {
  const spec = fixture(true);
  const records = spec.records as ((typeof spec.records)[number] & {
    initial?: unknown;
  })[];
  records[1]!.initial = {
    public_state: { life_points: { a: 5000, b: 8000 }, turn_player: "b" },
  };
  const r = new DecisionReplay(spec, [1, 0]);
  assert.doesNotThrow(() =>
    r.initial(0, {
      public_state: { life_points: { a: 8000, b: 5000 }, turn_player: 0 },
    }),
  );
  assert.throws(
    () =>
      r.initial(0, {
        public_state: { life_points: { a: 7000, b: 5000 }, turn_player: 0 },
      }),
    /initial state/,
  );
});

test("accepts only a permutation of complete state-free description-hint batches", () => {
  const spec = fixture();
  const hint = (sequence: number, description: number) => ({
    kind: "event",
    event: "card_hint",
    actor: "a",
    sequence,
    turn: 5,
    phase: "end",
    before_initial: false,
    caused_by_decision_id: "1-decision-155",
    changes: { change: [] },
    details: {
      item: [{ type: "hint", message: `Card hint 6: ${description}` }],
    },
  });
  spec.records[0]!.timeline.entry.unshift(hint(554, 3313), hint(556, 225));
  const r = new DecisionReplay(spec, [0, 1]);
  r.event(0, { ...hint(554, 225), actor: 0 });
  r.event(0, { ...hint(556, 3313), actor: 0 });
  r.decision(0, "0-decision-1", prompt, 1, "main1");
  assert.equal(r.reached, true);
});

function hintSpec() {
  const spec = fixture();
  const hint = (sequence: number, description: number) => ({
    kind: "event",
    event: "card_hint",
    actor: "a",
    sequence,
    turn: 5,
    phase: "end",
    changes: { change: [] },
    details: {
      item: [{ type: "hint", message: `Card hint 6: ${description}` }],
    },
  });
  spec.records[0]!.timeline.entry.unshift(hint(2, 3313), hint(4, 225));
  return { spec, hint };
}
test("description-hint normalization rejects changed contents, sequence, context, missing and extra events", () => {
  for (const defect of ["value", "sequence", "context"] as const) {
    const { spec, hint } = hintSpec();
    const r = new DecisionReplay(spec, [0, 1]);
    r.event(0, { ...hint(2, 225), actor: 0 });
    const second = {
      ...hint(defect === "sequence" ? 5 : 4, defect === "value" ? 999 : 3313),
      actor: 0,
      ...(defect === "context" ? { turn: 6 } : {}),
    };
    assert.throws(() => r.event(0, second), /replay_mismatch/);
  }
  const { spec, hint } = hintSpec();
  const r = new DecisionReplay(spec, [0, 1]);
  r.event(0, { ...hint(2, 225), actor: 0 });
  assert.throws(
    () => r.decision(0, "0-decision-1", prompt, 1, "main1"),
    /replay_mismatch/,
  );
  const complete = new DecisionReplay(spec, [0, 1]);
  complete.event(0, { ...hint(2, 225), actor: 0 });
  complete.event(0, { ...hint(4, 3313), actor: 0 });
  assert.throws(
    () => complete.event(0, { ...hint(6, 225), actor: 0 }),
    /replay_mismatch/,
  );
});
test("card hints carrying state changes retain exact ordering", () => {
  const { spec, hint } = hintSpec();
  const first = spec.records[0]!.timeline.entry[0]!;
  first.changes = {
    change: [{ type: "life_points", value: 7000, player: "a" }],
  };
  const r = new DecisionReplay(spec, [0, 1]);
  assert.throws(
    () => r.event(0, { ...hint(2, 225), actor: 0 }),
    /replay_mismatch/,
  );
});

test("description removals may interleave card and player display annotations", () => {
  const { spec, hint } = hintSpec();
  const card = {
    ...hint(2, 3313),
    details: { item: [{ type: "hint", message: "Card hint 7: 3313" }] },
  };
  const player = {
    ...hint(6, 0),
    event: "player_hint",
    details: {
      item: [{ type: "hint", message: "Player 1 hint 7: 77505548517377" }],
    },
  };
  spec.records[0]!.timeline.entry.splice(
    0,
    2,
    card,
    { ...card, sequence: 4 },
    player,
  );
  const r = new DecisionReplay(spec, [0, 1]);
  r.event(0, { ...card, actor: 0 });
  r.event(0, { ...player, sequence: 4, actor: 0 });
  r.event(0, { ...card, sequence: 6, actor: 0 });
  r.decision(0, "0-decision-1", prompt, 1, "main1");
  assert.equal(r.reached, true);
});

test("description hints use one-based player labels and preserve both player identities", () => {
  const { spec, hint } = hintSpec();
  const player = (sequence: number, label: number, actor: string) => ({
    ...hint(sequence, 0),
    actor,
    event: "player_hint",
    details: {
      item: [
        { type: "hint", message: `Player ${label} hint 7: 77505548517377` },
      ],
    },
  });
  spec.records[0]!.timeline.entry.splice(
    0,
    2,
    player(2, 1, "a"),
    player(4, 2, "b"),
  );
  const r = new DecisionReplay(spec, [0, 1]);
  r.event(0, { ...player(2, 2, "b"), actor: 1 });
  r.event(0, { ...player(4, 1, "a"), actor: 0 });
  r.decision(0, "0-decision-1", prompt, 1, "main1");
  assert.equal(r.reached, true);
});
