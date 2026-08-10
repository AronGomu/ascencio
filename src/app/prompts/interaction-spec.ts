import type { ChoiceId, PromptId } from "../../duel/contracts/ids.ts";
import type {
  ChoiceAction,
  PlayerPrompt,
  PromptChoice,
  PromptContribution,
  PromptKind,
} from "../../duel/contracts/player-prompt.ts";
import type {
  PublicDuelState,
  PublicLocation,
} from "../../duel/contracts/public-duel-state.ts";
import type {
  BoardTargetId,
  BoardViewModel,
} from "../../field/board-view-model.ts";
import { resolvePromptChoiceBoardTarget } from "../../field/card-mapping.ts";
import {
  promptControlFamily,
  type PromptControlFamily,
} from "./prompt-control-family.ts";

export interface InteractionKey {
  readonly workerGeneration: number;
  readonly sessionGeneration: number;
  readonly promptId: PromptId;
}

export interface InteractionContext {
  readonly workerGeneration: number;
  readonly sessionGeneration: number;
}

export interface InteractionChoice {
  readonly id: ChoiceId;
  readonly label: string;
  readonly action: ChoiceAction;
  readonly value?: number | string;
  readonly toggleState?: "selected" | "unselected";
  readonly allocationMaximum?: number;
}

export interface InteractionConstraints {
  readonly controlFamily: PromptControlFamily;
  readonly minimum: number;
  readonly maximum: number;
  readonly cancelable: boolean;
  readonly ordered: boolean;
  readonly requiredTotal?: number;
  readonly sumMode?: "exact" | "atLeast";
  readonly mandatoryContributions: readonly PromptContribution[];
}

export type ActiveInteractionKind =
  | "cardAction"
  | "cardSelection"
  | "placeSelection"
  | "counterAllocation"
  | "order"
  | "nonField";

interface ActiveInteractionSpecBase<Kind extends ActiveInteractionKind> {
  readonly kind: Kind;
  readonly key: InteractionKey;
  readonly promptKind: PromptKind;
  readonly player: PlayerPrompt["player"];
  readonly title: string;
  readonly message?: string;
  readonly fieldCapable: boolean;
  readonly constraints: InteractionConstraints;
  readonly cardChoices: ReadonlyMap<
    BoardTargetId,
    readonly InteractionChoice[]
  >;
  readonly zoneChoices: ReadonlyMap<
    BoardTargetId,
    readonly InteractionChoice[]
  >;
  readonly globalChoices: ReadonlyMap<ChoiceId, InteractionChoice>;
}

export type CardActionSpec = ActiveInteractionSpecBase<"cardAction">;

export type CardSelectionSpec = ActiveInteractionSpecBase<"cardSelection">;

export type PlaceSelectionSpec = ActiveInteractionSpecBase<"placeSelection">;

export type CounterAllocationSpec =
  ActiveInteractionSpecBase<"counterAllocation">;

export type OrderSpec = ActiveInteractionSpecBase<"order">;

export interface NonFieldSpec extends ActiveInteractionSpecBase<"nonField"> {
  readonly fieldCapable: false;
}

export type ActiveInteractionSpec =
  | CardActionSpec
  | CardSelectionSpec
  | PlaceSelectionSpec
  | CounterAllocationSpec
  | OrderSpec
  | NonFieldSpec;

export type InteractionSpec =
  { readonly kind: "inactive" } | ActiveInteractionSpec;

export const INTERACTION_SPEC_KINDS = {
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

const CHOICE_ACTIONS = {
  summon: true,
  specialSummon: true,
  flipSummon: true,
  setMonster: true,
  setSpellTrap: true,
  activate: true,
  changePosition: true,
  attack: true,
  battlePhase: true,
  mainPhase2: true,
  endPhase: true,
  shuffle: true,
  yes: true,
  no: true,
  pass: true,
  cancel: true,
  finish: true,
  select: true,
} as const satisfies Readonly<Record<ChoiceAction, true>>;
const PUBLIC_LOCATIONS = {
  deck: true,
  hand: true,
  monster: true,
  spellTrap: true,
  field: true,
  graveyard: true,
  banished: true,
  extra: true,
} as const satisfies Readonly<Record<PublicLocation, true>>;
const INACTIVE_SPEC = Object.freeze({ kind: "inactive" as const });

function nonEndPhaseGlobalChoiceCount(spec: ActiveInteractionSpec): number {
  return [...spec.globalChoices.values()].filter(
    (choice) => choice.action !== "endPhase",
  ).length;
}

export function fieldActionBarRequired(spec: ActiveInteractionSpec): boolean {
  if (spec.kind === "nonField") return false;
  if (spec.kind === "placeSelection" && spec.constraints.maximum === 1)
    return nonEndPhaseGlobalChoiceCount(spec) > 0;
  return (
    spec.kind === "cardSelection" ||
    spec.kind === "placeSelection" ||
    spec.kind === "counterAllocation" ||
    spec.kind === "order" ||
    nonEndPhaseGlobalChoiceCount(spec) > 0
  );
}

export function endPhaseChoice(
  spec: ActiveInteractionSpec | null,
): InteractionChoice | null {
  if (spec === null) return null;
  for (const choice of spec.globalChoices.values()) {
    if (choice.action === "endPhase") return choice;
  }
  return null;
}

export function interactionKey(
  workerGeneration: number,
  sessionGeneration: number,
  promptId: PromptId,
): InteractionKey {
  return Object.freeze({ workerGeneration, sessionGeneration, promptId });
}

export function mapPromptToInteractionSpec(
  prompt: PlayerPrompt | null,
  snapshot: PublicDuelState | null,
  board: BoardViewModel | null,
  context: InteractionContext,
): InteractionSpec {
  if (prompt === null) return INACTIVE_SPEC;

  const kind: ActiveInteractionKind | undefined = (
    INTERACTION_SPEC_KINDS as Partial<Record<string, ActiveInteractionKind>>
  )[prompt.kind];
  if (kind === undefined) return INACTIVE_SPEC;

  const cardEntries = new Map<BoardTargetId, InteractionChoice[]>();
  const zoneEntries = new Map<BoardTargetId, InteractionChoice[]>();
  const globalEntries = new Map<ChoiceId, InteractionChoice>();
  const duplicateIds = duplicateChoiceIds(prompt.choices);

  for (const rawChoice of prompt.choices) {
    const choice = sanitizeChoice(rawChoice);
    if (choice === undefined || duplicateIds.has(choice.id)) continue;

    const targetKind = targetKindFor(kind, rawChoice);
    if (targetKind === "invalid") continue;
    if (targetKind === "global" || board === null) {
      globalEntries.set(choice.id, choice);
      continue;
    }

    const resolution = resolvePromptChoiceBoardTarget(
      rawChoice,
      snapshot,
      board,
    );
    if (resolution.kind === "nonField") {
      globalEntries.set(choice.id, choice);
      continue;
    }
    const entries = targetKind === "card" ? cardEntries : zoneEntries;
    appendChoice(entries, resolution.targetId, choice);
  }

  const cardChoices = freezeChoiceMap(cardEntries);
  const zoneChoices = freezeChoiceMap(zoneEntries);
  const globalChoices = Object.freeze(new Map(globalEntries));
  const fieldCapable = cardChoices.size > 0 || zoneChoices.size > 0;
  const base = {
    key: interactionKey(
      context.workerGeneration,
      context.sessionGeneration,
      prompt.id,
    ),
    promptKind: prompt.kind,
    player: prompt.player,
    title: prompt.title,
    ...(prompt.message === undefined ? {} : { message: prompt.message }),
    fieldCapable,
    constraints: constraintsFor(prompt),
    cardChoices,
    zoneChoices,
    globalChoices,
  };

  switch (kind) {
    case "cardAction":
      return Object.freeze({ kind, ...base });
    case "cardSelection":
      return Object.freeze({ kind, ...base });
    case "placeSelection":
      return Object.freeze({ kind, ...base });
    case "counterAllocation":
      return Object.freeze({ kind, ...base });
    case "order":
      return Object.freeze({ kind, ...base });
    case "nonField":
      return Object.freeze({ kind, ...base, fieldCapable: false });
  }
}

function constraintsFor(prompt: PlayerPrompt): InteractionConstraints {
  const mandatoryContributions = Object.freeze(
    (prompt.mandatoryContributions ?? []).map((value) =>
      Object.freeze({ ...value }),
    ),
  );
  return Object.freeze({
    controlFamily: promptControlFamily(prompt.kind),
    minimum: prompt.minimum,
    maximum: prompt.maximum,
    cancelable: prompt.cancelable,
    ordered: prompt.ordered,
    ...(prompt.requiredTotal === undefined
      ? {}
      : { requiredTotal: prompt.requiredTotal }),
    ...(prompt.sumMode === undefined ? {} : { sumMode: prompt.sumMode }),
    mandatoryContributions,
  });
}

function sanitizeChoice(choice: PromptChoice): InteractionChoice | undefined {
  if (
    typeof choice !== "object" ||
    choice === null ||
    typeof choice.id !== "string" ||
    choice.id.length === 0 ||
    typeof choice.label !== "string" ||
    typeof choice.action !== "string" ||
    !Object.hasOwn(CHOICE_ACTIONS, choice.action) ||
    (choice.value !== undefined &&
      typeof choice.value !== "string" &&
      (typeof choice.value !== "number" || !Number.isFinite(choice.value))) ||
    (choice.selected !== undefined && typeof choice.selected !== "boolean") ||
    (choice.allocationMaximum !== undefined &&
      (!Number.isSafeInteger(choice.allocationMaximum) ||
        choice.allocationMaximum < 0))
  ) {
    return undefined;
  }
  return Object.freeze({
    id: choice.id,
    label: choice.label,
    action: choice.action,
    ...(choice.value === undefined ? {} : { value: choice.value }),
    ...(choice.selected === undefined
      ? {}
      : { toggleState: choice.selected ? "selected" : "unselected" }),
    ...(choice.allocationMaximum === undefined
      ? {}
      : { allocationMaximum: choice.allocationMaximum }),
  });
}

function targetKindFor(
  specKind: ActiveInteractionKind,
  choice: PromptChoice,
): "card" | "zone" | "global" | "invalid" {
  const hasCard = choice.card !== undefined;
  const hasPlace = choice.place !== undefined;
  if (hasCard && hasPlace) return "invalid";

  switch (specKind) {
    case "cardAction":
    case "cardSelection":
    case "order":
      if (hasPlace) return "invalid";
      return hasCard
        ? isValidCardTarget(choice.card)
          ? "card"
          : "invalid"
        : "global";
    case "counterAllocation":
      return hasCard && choice.allocationMaximum !== undefined
        ? isValidCardTarget(choice.card)
          ? "card"
          : "invalid"
        : hasCard
          ? "invalid"
          : "global";
    case "placeSelection":
      if (hasCard) return "invalid";
      return hasPlace
        ? isValidPlaceTarget(choice.place)
          ? "zone"
          : "invalid"
        : "global";
    case "nonField":
      return hasCard || hasPlace ? "invalid" : "global";
  }
}

function isValidCardTarget(card: PromptChoice["card"]): boolean {
  return (
    card !== undefined &&
    typeof card === "object" &&
    typeof card.instanceId === "string" &&
    card.instanceId.length > 0 &&
    (card.controller === 0 || card.controller === 1) &&
    typeof card.location === "string" &&
    Object.hasOwn(PUBLIC_LOCATIONS, card.location) &&
    Number.isSafeInteger(card.sequence) &&
    card.sequence >= 0
  );
}

function isValidPlaceTarget(place: PromptChoice["place"]): boolean {
  return (
    place !== undefined &&
    typeof place === "object" &&
    (place.player === 0 || place.player === 1) &&
    (place.location === "monster" ||
      place.location === "spellTrap" ||
      place.location === "field" ||
      place.location === "pendulum") &&
    Number.isSafeInteger(place.sequence) &&
    place.sequence >= 0
  );
}

function duplicateChoiceIds(
  choices: readonly PromptChoice[],
): ReadonlySet<ChoiceId> {
  const seen = new Set<ChoiceId>();
  const duplicates = new Set<ChoiceId>();
  for (const choice of choices) {
    if (typeof choice?.id !== "string") continue;
    if (seen.has(choice.id)) duplicates.add(choice.id);
    seen.add(choice.id);
  }
  return duplicates;
}

function appendChoice(
  entries: Map<BoardTargetId, InteractionChoice[]>,
  targetId: BoardTargetId,
  choice: InteractionChoice,
): void {
  const current = entries.get(targetId);
  if (current === undefined) entries.set(targetId, [choice]);
  else current.push(choice);
}

function freezeChoiceMap(
  entries: ReadonlyMap<BoardTargetId, readonly InteractionChoice[]>,
): ReadonlyMap<BoardTargetId, readonly InteractionChoice[]> {
  return Object.freeze(
    new Map(
      [...entries].map(([targetId, choices]) => [
        targetId,
        Object.freeze([...choices]),
      ]),
    ),
  );
}
