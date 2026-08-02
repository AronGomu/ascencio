import { parseDuelWorkerEvent } from "../../src/duel/contracts/duel-worker-event.ts";
import type { DuelWorkerEvent } from "../../src/duel/contracts/duel-worker-event.ts";
import { snapshotId } from "../../src/duel/contracts/ids.ts";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";
import {
  mapSnapshotToBoard,
  type BoardViewModel,
} from "../../src/field/board-view-model.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "./board-view-model.ts";

export type DuelFieldStateId =
  | "ST-01"
  | "ST-02"
  | "ST-03"
  | "ST-04"
  | "ST-05"
  | "ST-06"
  | "ST-07"
  | "ST-08"
  | "ST-09"
  | "ST-10"
  | "ST-11"
  | "ST-12"
  | "ST-13"
  | "ST-14";

export interface DuelFieldPublicStateFixture {
  readonly id: DuelFieldStateId;
  readonly event: Extract<DuelWorkerEvent, { readonly type: "state" }>;
  readonly board: BoardViewModel;
  readonly artifactPath: `test-results/df-16-${DuelFieldStateId}.json`;
  readonly assertions: readonly string[];
}

const BASE_BY_ID = {
  "ST-01": BOARD_VIEW_MODEL_FIXTURES["ST-01"],
  "ST-02": BOARD_VIEW_MODEL_FIXTURES["ST-02"],
  "ST-03": BOARD_VIEW_MODEL_FIXTURES["ST-03"],
  "ST-04": BOARD_VIEW_MODEL_FIXTURES["ST-04"],
  "ST-05": BOARD_VIEW_MODEL_FIXTURES["ST-05"],
  "ST-06": BOARD_VIEW_MODEL_FIXTURES["ST-06"],
  "ST-07": BOARD_VIEW_MODEL_FIXTURES["ST-07"],
  "ST-08": BOARD_VIEW_MODEL_FIXTURES["ST-08"],
  "ST-09": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-08"], "9"),
  "ST-10": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-05"], "a"),
  "ST-11": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-04"], "b"),
  "ST-12": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-01"], "c"),
  "ST-13": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-07"], "d"),
  "ST-14": withSnapshot(BOARD_VIEW_MODEL_FIXTURES["ST-08"], "e"),
} as const satisfies Readonly<Record<DuelFieldStateId, PublicDuelState>>;

const ASSERTIONS_BY_ID = {
  "ST-01": ["semantic-board", "privacy", "artifact-path"],
  "ST-02": ["sparse-fixed-slots", "rule-layout"],
  "ST-03": ["shared-emz-alias", "core-layout"],
  "ST-04": ["position-orientation", "hierarchy"],
  "ST-05": ["field-action-target", "wireframe"],
  "ST-06": ["multi-card-layout", "wireframe"],
  "ST-07": ["counters", "overlay-privacy"],
  "ST-08": ["chain", "closed-stacks"],
  "ST-09": ["tray-state", "closed-stack-summary"],
  "ST-10": ["image-nonblocking", "placeholder-safe"],
  "ST-11": ["reduced-motion", "defense-rotation"],
  "ST-12": ["keyboard-entry", "a11y-names"],
  "ST-13": ["recoverable-error", "stale-generation"],
  "ST-14": ["perf-resource-budget", "privacy-metrics"],
} as const satisfies Readonly<Record<DuelFieldStateId, readonly string[]>>;

export const DUEL_FIELD_PUBLIC_STATES = Object.freeze(
  Object.fromEntries(
    (Object.keys(BASE_BY_ID) as DuelFieldStateId[]).map((id) => [
      id,
      createFixture(id, BASE_BY_ID[id]),
    ]),
  ) as Readonly<Record<DuelFieldStateId, DuelFieldPublicStateFixture>>,
);

export const DUEL_FIELD_PUBLIC_STATE_MATRIX = Object.freeze(
  Object.values(DUEL_FIELD_PUBLIC_STATES),
);

function createFixture(
  id: DuelFieldStateId,
  source: PublicDuelState,
): DuelFieldPublicStateFixture {
  const state = publicState(source);
  const event = parseDuelWorkerEvent({ type: "state", state });
  if (event.type !== "state") throw new Error(`Fixture ${id} is not a state`);
  const boardResult = mapSnapshotToBoard(event.state, BOARD_CARD_TEXTS);
  if (!boardResult.ok)
    throw new Error(
      `Fixture ${id} failed board mapping: ${boardResult.error.type}`,
    );
  return Object.freeze({
    id,
    event,
    board: boardResult.value,
    artifactPath: `test-results/df-16-${id}.json`,
    assertions: ASSERTIONS_BY_ID[id],
  });
}

function publicState(source: PublicDuelState): PublicDuelState {
  const state = structuredClone(source) as PublicDuelState;
  Reflect.set(state.players[1], "hand", []);
  for (const card of state.players[1].extraDeck)
    Reflect.deleteProperty(card, "code");
  return state;
}

function withSnapshot(
  source: PublicDuelState,
  nibble: string,
): PublicDuelState {
  return {
    ...structuredClone(source),
    snapshotId: snapshotId(nibble.repeat(64)),
  };
}
