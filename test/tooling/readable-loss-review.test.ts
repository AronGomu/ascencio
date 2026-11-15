import test from "node:test";
import assert from "node:assert/strict";
import { encodeLogRecord } from "../../scripts/bot-improvement/game-log.ts";
import { readableLossReview } from "../../scripts/bot-improvement/readable-loss-review.ts";
const make = (
  events: unknown[],
  sideboard: unknown = {
    status: "not_applicable",
    exchanges: { exchange: [] },
  },
) =>
  "ASCENCIO_LOSS_LOG\t2\n" +
  [
    ["GAME", { game_id: "match-1-game-4", outcome: "loss" }],
    ["SIDEBOARD", sideboard],
    [
      "INITIAL",
      {
        own_opening_hand: { card: [{ instance_id: "c1", card_code: "123" }] },
        public_state: { life_points: { a: 8000, b: 8000 } },
      },
    ],
    ...events.map((e) => ["EVENT", e]),
    ["RESULT", { outcome: "loss", turns: 2, engine_reason: "1" }],
    ["END_GAME", "match-1-game-4"],
  ]
    .map(([tag, value]) => encodeLogRecord(tag as string, value))
    .join("");
const decision = (id: string, minimum = 1, cancelable = false) => ({
  kind: "decision",
  decision_id: id,
  turn: 1,
  phase: "main1",
  selected_choice_ids: { choice_id: ["long-exact-choice"] },
  prompt: {
    title: "Choose target",
    minimum,
    maximum: 1,
    cancelable,
    ordered: false,
    constraints: { required_total: null, sum_mode: null },
    choices: {
      choice: [{ id: "long-exact-choice", label: "Select visible card" }],
    },
  },
});

test("collapses only mandatory responses and preserves exact machine choice mapping", () => {
  const r = readableLossReview(
    make([
      decision("forced"),
      decision("optional", 0),
      decision("cancel", 1, true),
    ]),
    { cardNames: { 123: "Visible Name" } },
  );
  assert.equal(r.omitted.forcedDecisions, 1);
  assert.match(r.text, /optional/);
  assert.match(r.text, /cancel/);
  assert.doesNotMatch(r.text, /long-exact-choice/);
  assert.match(r.text, /\*O1/);
  assert.deepEqual(r.choiceMap.optional, {
    offered: ["long-exact-choice"],
    chosen: ["long-exact-choice"],
    options: { O1: "long-exact-choice" },
  });
  assert.match(r.text, /Visible Name/);
  assert.match(r.text, /Pre-side game: no sideboarding applies/);
});

test("game four sideboarding is self-contained with named exchanges", () => {
  const side = {
    status: "completed",
    carried_forward: true,
    applied_before_game: 3,
    exchanges: {
      exchange: [{ card_code: "123", quantity: 1, from: "side", to: "main" }],
    },
    reason: { explanation: "Counter traps" },
    resulting_configuration: {
      main: { card: [{ card_code: "123", copies: 1 }] },
      extra: { card: [] },
      side: { card: [] },
    },
  };
  const r = readableLossReview(make([], side), {
    cardNames: { 123: "Visible Name" },
  });
  assert.match(r.text, /Game 4: configuration carried forward/);
  assert.match(r.text, /1 × Visible Name: side → main/);
  assert.doesNotMatch(r.text, /Resulting main/);
  assert.match(r.text, /Counter traps/);
  const three = readableLossReview(
    make([], { ...side, carried_forward: false, applies_now: true }),
  );
  assert.match(three.text, /Game 3: sideboarding applied/);
});

test("retains visible consequences, unknown cards and final outcome while dropping empty hints", () => {
  const r = readableLossReview(
    make([
      {
        kind: "event",
        turn: 2,
        sequence: 4,
        phase: "battle",
        event: "hint",
        changes: { change: [] },
        details: { item: [{ type: "hint", message: "System hint 77" }] },
      },
      {
        kind: "event",
        turn: 2,
        sequence: 5,
        phase: "battle",
        event: "move",
        changes: {
          change: [
            {
              type: "card_changed",
              instance_id: "hidden",
              from: { location: "monster", controller: "b" },
              to: { location: "graveyard", position: "faceUpAttack" },
            },
          ],
        },
        details: { item: [] },
      },
      {
        kind: "event",
        turn: 2,
        sequence: 6,
        phase: "battle",
        event: "damage",
        changes: { change: [{ type: "life_points", player: "a", value: 0 }] },
        details: { item: [{ type: "damage", player: "a", amount: 8000 }] },
      },
    ]),
  );
  assert.match(r.text, /unknown card \(hidden\)/);
  assert.match(r.text, /graveyard/);
  assert.match(r.text, /target takes 8000 damage/);
  assert.match(r.text, /Final outcome: loss/);
  assert.doesNotMatch(r.text, /System hint/);
  assert.equal(r.omitted.routineEvents, 1);
});

test("rejects non-loss input and does not collapse allocation or sum choices", () => {
  assert.throws(
    () => readableLossReview(make([]).replace('s:"loss"', 's:"win"')),
    /target loss/,
  );
  const d = decision("sum");
  Object.assign(d.prompt.constraints, { required_total: 2, sum_mode: "exact" });
  const r = readableLossReview(make([d]));
  assert.equal(r.omitted.forcedDecisions, 0);
  assert.match(r.text, /constraints/);
});
