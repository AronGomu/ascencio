import type {
  BoardTargetId,
  BoardViewModel,
} from "../../field/board-view-model.ts";
import type { PhysicalZoneId } from "../../field/duel-field-layout.ts";

export type FieldNavigationKey =
  "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export interface FieldNavigationState {
  readonly activeTarget: BoardTargetId | null;
  readonly activeZone: PhysicalZoneId | null;
  readonly context: string | null;
}

export type FieldNavigationAction =
  | {
      readonly type: "synchronize";
      readonly board: BoardViewModel;
      readonly actionableTargets: ReadonlySet<BoardTargetId>;
      readonly context: string;
    }
  | {
      readonly type: "focus";
      readonly board: BoardViewModel;
      readonly target: BoardTargetId;
    }
  | {
      readonly type: "move";
      readonly board: BoardViewModel;
      readonly key: FieldNavigationKey;
    };

const EMPTY_STATE = Object.freeze({
  activeTarget: null,
  activeZone: null,
  context: null,
});

export function createFieldNavigationState(): FieldNavigationState {
  return EMPTY_STATE;
}

export function reduceFieldNavigation(
  state: FieldNavigationState,
  action: FieldNavigationAction,
): FieldNavigationState {
  switch (action.type) {
    case "synchronize":
      return synchronize(state, action);
    case "focus":
      return action.board.nav.has(action.target)
        ? navigationState(
            action.target,
            targetZone(action.board, action.target),
            state.context,
          )
        : state;
    case "move":
      return move(state, action.board, action.key);
  }
}

function synchronize(
  state: FieldNavigationState,
  action: Extract<FieldNavigationAction, { readonly type: "synchronize" }>,
): FieldNavigationState {
  const targets = [...action.board.nav.keys()];
  if (targets.length === 0) return navigationState(null, null, action.context);

  const firstActionable = targets.find((target) =>
    action.actionableTargets.has(target),
  );
  const contextChanged = state.context !== action.context;
  let activeTarget: BoardTargetId | undefined;

  if (contextChanged && firstActionable !== undefined) {
    activeTarget = firstActionable;
  } else if (
    state.activeTarget !== null &&
    action.board.nav.has(state.activeTarget)
  ) {
    activeTarget = state.activeTarget;
  } else if (state.activeZone !== null) {
    activeTarget = targets.find(
      (target) => targetZone(action.board, target) === state.activeZone,
    );
  }
  activeTarget ??= firstActionable ?? targets[0];
  if (activeTarget === undefined)
    return navigationState(null, null, action.context);

  const zone = targetZone(action.board, activeTarget);
  if (
    state.activeTarget === activeTarget &&
    state.activeZone === zone &&
    state.context === action.context
  ) {
    return state;
  }
  return navigationState(activeTarget, zone, action.context);
}

function move(
  state: FieldNavigationState,
  board: BoardViewModel,
  key: FieldNavigationKey,
): FieldNavigationState {
  if (state.activeTarget === null) return state;
  let target = state.activeTarget;
  if (key === "Home" || key === "End") {
    const direction = key === "Home" ? "left" : "right";
    const row = targetPosition(board, target)?.y;
    const visited = new Set<BoardTargetId>([target]);
    for (;;) {
      const next = board.nav.get(target)?.[direction];
      const nextRow =
        next === undefined ? undefined : targetPosition(board, next)?.y;
      if (
        next === undefined ||
        visited.has(next) ||
        row === undefined ||
        nextRow === undefined ||
        Math.abs(nextRow - row) > 0.001
      )
        break;
      visited.add(next);
      target = next;
    }
  } else {
    const direction = key.slice("Arrow".length).toLocaleLowerCase() as
      "left" | "right" | "up" | "down";
    target = board.nav.get(target)?.[direction] ?? target;
  }
  if (target === state.activeTarget) return state;
  return navigationState(target, targetZone(board, target), state.context);
}

function targetPosition(
  board: BoardViewModel,
  target: BoardTargetId,
): { readonly x: number; readonly y: number } | undefined {
  return (
    board.cards.find(({ targetId }) => targetId === target) ??
    board.stacks.find(({ targetId }) => targetId === target) ??
    board.zones.find(({ targetId }) => targetId === target)
  );
}

function targetZone(
  board: BoardViewModel,
  target: BoardTargetId,
): PhysicalZoneId | null {
  const card = board.cards.find(({ targetId }) => targetId === target);
  if (card !== undefined) return card.zoneId;
  const stack = board.stacks.find(({ targetId }) => targetId === target);
  if (stack !== undefined) return stack.id;
  const zone = board.zones.find(({ targetId }) => targetId === target);
  return zone?.id ?? null;
}

function navigationState(
  activeTarget: BoardTargetId | null,
  activeZone: PhysicalZoneId | null,
  context: string | null,
): FieldNavigationState {
  return Object.freeze({ activeTarget, activeZone, context });
}
