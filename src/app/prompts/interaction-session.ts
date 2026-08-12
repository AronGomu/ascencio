import type { ChoiceId } from "../../duel/contracts/ids.ts";
import type { BoardTargetId } from "../../field/board-view-model.ts";
import {
  interactionChoicesInPromptOrder,
  type ActiveInteractionSpec,
  type InteractionChoice,
  type InteractionKey,
  type InteractionSpec,
} from "./interaction-spec.ts";

export interface InteractionSession {
  readonly key: InteractionKey | null;
  readonly status: "idle" | "editing" | "submitting";
  readonly selectedChoiceIds: readonly ChoiceId[];
  readonly order: readonly ChoiceId[];
  readonly allocations: ReadonlyMap<ChoiceId, number>;
  readonly menuTarget: BoardTargetId | null;
}

export interface InteractionSubmitCommand {
  readonly type: "submit";
  readonly key: InteractionKey;
  readonly choiceIds: readonly ChoiceId[];
}

export interface InteractionSessionReduction {
  readonly session: InteractionSession;
  readonly command: InteractionSubmitCommand | null;
}

type KeyedInteractionAction =
  | { readonly type: "chooseChoice"; readonly choiceId: ChoiceId }
  | { readonly type: "toggleChoice"; readonly choiceId: ChoiceId }
  | {
      readonly type: "adjustAllocation";
      readonly choiceId: ChoiceId;
      readonly delta: -1 | 1;
    }
  | {
      readonly type: "moveChoice";
      readonly choiceId: ChoiceId;
      readonly toIndex: number;
    }
  | {
      readonly type: "openMenu";
      readonly target: BoardTargetId;
    }
  | { readonly type: "closeMenu" }
  | { readonly type: "confirm" }
  | { readonly type: "cancel" }
  | { readonly type: "submissionAccepted" }
  | { readonly type: "submissionRejected" };

export type InteractionSessionAction = KeyedInteractionAction & {
  readonly key: InteractionKey;
};

type WithoutInteractionKey<Action> = Action extends {
  readonly key: InteractionKey;
}
  ? Omit<Action, "key">
  : never;

export type UnkeyedInteractionSessionAction =
  WithoutInteractionKey<InteractionSessionAction>;

const EMPTY_CHOICE_IDS = Object.freeze([]) as readonly ChoiceId[];
const EMPTY_ALLOCATIONS = Object.freeze(
  new Map<ChoiceId, number>(),
) as ReadonlyMap<ChoiceId, number>;
const IDLE_SESSION: InteractionSession = Object.freeze({
  key: null,
  status: "idle",
  selectedChoiceIds: EMPTY_CHOICE_IDS,
  order: EMPTY_CHOICE_IDS,
  allocations: EMPTY_ALLOCATIONS,
  menuTarget: null,
});

export function createInactiveInteractionSession(): InteractionSession {
  return IDLE_SESSION;
}

export function createInteractionSession(
  spec: ActiveInteractionSpec,
): InteractionSession {
  return freezeSession({
    key: spec.key,
    status: "editing",
    selectedChoiceIds: Object.freeze(
      interactionChoicesInPromptOrder(spec)
        .filter(({ toggleState }) => toggleState === "selected")
        .map(({ id }) => id),
    ),
    order: choiceIdsInPromptOrder(spec),
    allocations: EMPTY_ALLOCATIONS,
    menuTarget: null,
  });
}

export function synchronizeInteractionSession(
  session: InteractionSession,
  spec: InteractionSpec,
): InteractionSession {
  if (spec.kind === "inactive") return IDLE_SESSION;
  return sameInteractionKey(session.key, spec.key)
    ? session
    : createInteractionSession(spec);
}

export function reduceInteractionSession(
  session: InteractionSession,
  spec: ActiveInteractionSpec,
  action: InteractionSessionAction,
): InteractionSessionReduction {
  if (
    !sameInteractionKey(session.key, spec.key) ||
    !sameInteractionKey(action.key, spec.key)
  ) {
    return unchanged(session);
  }

  const choices = choicesById(spec);
  switch (action.type) {
    case "chooseChoice":
      return session.status === "editing" && choices.has(action.choiceId)
        ? submit(session, spec, Object.freeze([action.choiceId]))
        : unchanged(session);
    case "toggleChoice": {
      if (session.status !== "editing" || !choices.has(action.choiceId))
        return unchanged(session);
      const selected = new Set(session.selectedChoiceIds);
      if (selected.has(action.choiceId)) selected.delete(action.choiceId);
      else if (selected.size < spec.constraints.maximum)
        selected.add(action.choiceId);
      else return unchanged(session);
      return changed(session, {
        selectedChoiceIds: Object.freeze(
          session.order.filter((choiceId) => selected.has(choiceId)),
        ),
      });
    }
    case "adjustAllocation": {
      if (session.status !== "editing") return unchanged(session);
      const choice = choices.get(action.choiceId);
      const maximum = choice?.allocationMaximum;
      if (maximum === undefined) return unchanged(session);
      const current = session.allocations.get(action.choiceId) ?? 0;
      const total = allocationTotal(session.allocations);
      const next = Math.max(
        0,
        Math.min(
          maximum,
          action.delta > 0 && total >= spec.constraints.maximum
            ? current
            : current + action.delta,
        ),
      );
      if (next === current) return unchanged(session);
      const allocations = new Map(session.allocations);
      if (next === 0) allocations.delete(action.choiceId);
      else allocations.set(action.choiceId, next);
      return changed(session, {
        allocations: Object.freeze(allocations),
      });
    }
    case "moveChoice": {
      if (
        session.status !== "editing" ||
        !Number.isSafeInteger(action.toIndex) ||
        action.toIndex < 0 ||
        action.toIndex >= session.order.length
      ) {
        return unchanged(session);
      }
      const currentIndex = session.order.indexOf(action.choiceId);
      if (currentIndex < 0 || currentIndex === action.toIndex)
        return unchanged(session);
      const order = [...session.order];
      order.splice(currentIndex, 1);
      order.splice(action.toIndex, 0, action.choiceId);
      return changed(session, { order: Object.freeze(order) });
    }
    case "openMenu":
      if (
        session.status !== "editing" ||
        (!spec.cardChoices.has(action.target) &&
          !spec.zoneChoices.has(action.target)) ||
        session.menuTarget === action.target
      ) {
        return unchanged(session);
      }
      return changed(session, { menuTarget: action.target });
    case "closeMenu":
      return session.status === "editing" && session.menuTarget !== null
        ? changed(session, { menuTarget: null })
        : unchanged(session);
    case "confirm":
      return session.status === "editing"
        ? submit(session, spec, interactionSessionChoiceIds(session, spec))
        : unchanged(session);
    case "cancel":
      return session.status === "editing" && spec.constraints.cancelable
        ? submit(session, spec, EMPTY_CHOICE_IDS)
        : unchanged(session);
    case "submissionAccepted":
      return session.status === "editing"
        ? changed(session, { status: "submitting" })
        : unchanged(session);
    case "submissionRejected":
      return session.status === "submitting"
        ? changed(session, { status: "editing" })
        : unchanged(session);
  }
}

export function sameInteractionKey(
  left: InteractionKey | null,
  right: InteractionKey | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.workerGeneration === right.workerGeneration &&
      left.sessionGeneration === right.sessionGeneration &&
      left.promptId === right.promptId)
  );
}

function choicesById(
  spec: ActiveInteractionSpec,
): ReadonlyMap<ChoiceId, InteractionChoice> {
  const choices = new Map<ChoiceId, InteractionChoice>();
  for (const choice of interactionChoicesInPromptOrder(spec))
    choices.set(choice.id, choice);
  return choices;
}

function choiceIdsInPromptOrder(
  spec: ActiveInteractionSpec,
): readonly ChoiceId[] {
  return Object.freeze(
    interactionChoicesInPromptOrder(spec).map(({ id }) => id),
  );
}

export function interactionSessionChoiceIds(
  session: InteractionSession,
  spec: ActiveInteractionSpec,
): readonly ChoiceId[] {
  switch (spec.constraints.controlFamily) {
    case "counter": {
      const result: ChoiceId[] = [];
      for (const choiceId of session.order) {
        for (
          let amount = session.allocations.get(choiceId) ?? 0;
          amount > 0;
          amount -= 1
        ) {
          result.push(choiceId);
        }
      }
      return Object.freeze(result);
    }
    case "order":
      return session.order;
    case "single":
    case "multiple":
    case "toggle":
      return session.selectedChoiceIds;
  }
}

function allocationTotal(allocations: ReadonlyMap<ChoiceId, number>): number {
  let total = 0;
  for (const amount of allocations.values()) total += amount;
  return total;
}

function submit(
  session: InteractionSession,
  spec: ActiveInteractionSpec,
  choiceIds: readonly ChoiceId[],
): InteractionSessionReduction {
  return Object.freeze({
    session,
    command: Object.freeze({
      type: "submit" as const,
      key: spec.key,
      choiceIds: Object.freeze([...choiceIds]),
    }),
  });
}

function changed(
  session: InteractionSession,
  patch: Partial<InteractionSession>,
): InteractionSessionReduction {
  return Object.freeze({
    session: freezeSession({ ...session, ...patch }),
    command: null,
  });
}

function unchanged(session: InteractionSession): InteractionSessionReduction {
  return Object.freeze({ session, command: null });
}

function freezeSession(session: InteractionSession): InteractionSession {
  return Object.freeze(session);
}
