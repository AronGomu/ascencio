import { describe, expect, it } from "vitest";
import {
  choiceId,
  promptId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
import {
  BoundedDuelTrace,
  buildRestorePlan,
  type DuelTrace,
} from "../../src/battle/worker/diagnostics/duel-trace.ts";

const SNAPSHOT = snapshotId("a".repeat(64));

function trace(
  record: (recorder: BoundedDuelTrace) => void,
  maximumEntries = 10_000,
): DuelTrace {
  const recorder = new BoundedDuelTrace(
    "bundled-v1:mvp-player:vs:mvp-opponent",
    SNAPSHOT,
    [7n, 8n, 9n, 10n],
    maximumEntries,
  );
  recorder.record({ kind: "lifecycle", detail: "session creation started" });
  record(recorder);
  return recorder.snapshot();
}

function human(sequence: number) {
  return {
    kind: "response" as const,
    promptId: promptId(`duel-1-prompt-${sequence}`),
    choiceIds: [choiceId(`duel-1-prompt-${sequence}-choice-0-select`)],
    player: 0 as const,
  };
}

function opponent(sequence: number) {
  return {
    ...human(sequence),
    player: 1 as const,
    opponentReason: "decline_optional" as const,
  };
}

describe("buildRestorePlan", () => {
  it("stops at the last response the player owned and drops what followed it", () => {
    const plan = buildRestorePlan(
      trace((recorder) => {
        recorder.record(human(1));
        recorder.record(opponent(2));
        recorder.record(human(3));
        recorder.record(opponent(4));
        recorder.record({ kind: "error", detail: "core rejected a response" });
      }),
    );

    expect(plan).toEqual({
      seed: [7n, 8n, 9n, 10n],
      snapshotId: SNAPSHOT,
      responses: [
        {
          promptId: promptId("duel-1-prompt-1"),
          choiceIds: [choiceId("duel-1-prompt-1-choice-0-select")],
          player: 0,
        },
        {
          promptId: promptId("duel-1-prompt-2"),
          choiceIds: [choiceId("duel-1-prompt-2-choice-0-select")],
          player: 1,
          opponentReason: "decline_optional",
        },
      ],
      stopAtPromptId: promptId("duel-1-prompt-3"),
    });
  });

  it("returns null when every recorded response is the opponent's", () => {
    expect(
      buildRestorePlan(
        trace((recorder) => {
          recorder.record(opponent(1));
          recorder.record(opponent(2));
        }),
      ),
    ).toBeNull();
  });

  it("returns null for a duel that recorded nothing but its own start", () => {
    expect(buildRestorePlan(trace(() => undefined))).toBeNull();
  });

  /* The recorder is a ring buffer. A trace that has dropped its oldest
     entries can still hold plenty of responses, and replaying them would
     rebuild a duel that started somewhere else. */
  it("returns null once the trace has evicted its oldest entries", () => {
    const truncated = trace((recorder) => {
      for (let sequence = 1; sequence <= 8; sequence += 1)
        recorder.record(human(sequence));
    }, 4);

    expect(truncated.entries[0]?.sequence).toBeGreaterThan(1);
    expect(buildRestorePlan(truncated)).toBeNull();
  });
});
