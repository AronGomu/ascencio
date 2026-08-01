import { assertNever } from "../../duel/contracts/assert-never.ts";
import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import type {
  BoardCardView,
  BoardTargetId,
  BoardViewModel,
} from "../../field/board-view-model.ts";

export type PresentationCommand =
  | {
      readonly kind: "card-move";
      readonly label: string;
      readonly durationMs: number;
    }
  | {
      readonly kind: "summon" | "set" | "position";
      readonly label: string;
      readonly durationMs: number;
    }
  | {
      readonly kind: "attack";
      readonly label: string;
      readonly durationMs: number;
    }
  | {
      readonly kind: "life-points";
      readonly label: string;
      readonly player: 0 | 1;
      readonly amount?: number;
      readonly durationMs: number;
    }
  | {
      readonly kind: "chain";
      readonly label: string;
      readonly size: number;
      readonly durationMs: number;
    }
  | {
      readonly kind: "notice";
      readonly label: string;
      readonly durationMs: number;
    };

export type DomPresentationCommand =
  | Exclude<
      PresentationCommand,
      { readonly kind: "card-move" | "summon" | "set" | "position" | "attack" }
    >
  | (Extract<PresentationCommand, { readonly kind: "card-move" }> & {
      readonly fromTargetId: BoardTargetId;
      readonly toTargetId: BoardTargetId;
    })
  | (Extract<
      PresentationCommand,
      { readonly kind: "summon" | "set" | "position" }
    > & {
      readonly targetId: BoardTargetId;
    })
  | (Extract<PresentationCommand, { readonly kind: "attack" }> & {
      readonly fromTargetId: BoardTargetId;
      readonly toTargetId: BoardTargetId;
    });

export interface DomPresentationContext {
  readonly currentBoard: BoardViewModel;
  readonly previousBoard?: BoardViewModel;
  readonly attackEndpoints?: {
    readonly fromTargetId: BoardTargetId;
    readonly toTargetId: BoardTargetId;
  };
}

export function presentationCommandForEvent(
  event: DuelPresentationEvent,
  reducedMotion = false,
): PresentationCommand {
  const durationMs = reducedMotion ? 0 : 420;
  switch (event.type) {
    case "cardMoved":
      return {
        kind: "card-move",
        label: `Card moved from ${event.from} to ${event.to}`,
        durationMs,
      };
    case "summon":
      return { kind: "summon", label: "Normal Summon", durationMs };
    case "specialSummon":
      return { kind: "summon", label: "Special Summon", durationMs };
    case "flipSummon":
      return { kind: "summon", label: "Flip Summon", durationMs };
    case "set":
      return { kind: "set", label: "Card set", durationMs };
    case "positionChanged":
      return { kind: "position", label: "Position changed", durationMs };
    case "attack":
      return {
        kind: "attack",
        label: event.direct ? "Direct attack" : "Attack declared",
        durationMs,
      };
    case "damage":
      return {
        kind: "life-points",
        label: `${event.amount} damage`,
        player: event.player,
        amount: -event.amount,
        durationMs,
      };
    case "recover":
      return {
        kind: "life-points",
        label: `${event.amount} LP recovered`,
        player: event.player,
        amount: event.amount,
        durationMs,
      };
    case "lifePointsChanged":
      return {
        kind: "life-points",
        label: `LP ${event.lifePoints}`,
        player: event.player,
        durationMs,
      };
    case "chainChanged":
      return {
        kind: "chain",
        label: event.size === 0 ? "Chain resolved" : `Chain Link ${event.size}`,
        size: event.size,
        durationMs,
      };
    case "duelStarted":
      return { kind: "notice", label: "Duel started", durationMs };
    case "turnStarted":
      return {
        kind: "notice",
        label: `${event.player === 0 ? "Your" : "Opponent's"} turn`,
        durationMs,
      };
    case "phaseChanged":
      return {
        kind: "notice",
        label: `${event.phase} phase`,
        durationMs,
      };
    case "cardDrawn":
      return {
        kind: "notice",
        label: `${event.player === 0 ? "You draw" : "Opponent draws"} ${event.count}`,
        durationMs,
      };
    case "cardsShuffled":
      return {
        kind: "notice",
        label: `${event.location} shuffled`,
        durationMs,
      };
    case "hint":
      return { kind: "notice", label: event.message, durationMs };
    default:
      return assertNever(event);
  }
}

export function presentationCommandForDomEvent(
  event: DuelPresentationEvent,
  context: DomPresentationContext,
  reducedMotion = false,
): DomPresentationCommand {
  const command = presentationCommandForEvent(event, reducedMotion);
  switch (command.kind) {
    case "card-move": {
      const current = cardForEvent(context.currentBoard, event);
      const previous =
        context.previousBoard === undefined
          ? undefined
          : cardForEvent(context.previousBoard, event);
      if (current === undefined || previous === undefined)
        return noticeFor(command);
      return {
        ...command,
        fromTargetId: `zone:${previous.zoneId}`,
        toTargetId: current.targetId,
      };
    }
    case "summon":
    case "set": {
      if (
        event.type !== "summon" &&
        event.type !== "specialSummon" &&
        event.type !== "flipSummon" &&
        event.type !== "set"
      ) {
        return noticeFor(command);
      }
      const target = uniqueCard(context.currentBoard, event.card, event.player);
      return target === undefined
        ? noticeFor(command)
        : { ...command, targetId: target.targetId };
    }
    case "position": {
      if (event.type !== "positionChanged") return noticeFor(command);
      const target = uniqueCard(context.currentBoard, event.card);
      return target === undefined
        ? noticeFor(command)
        : { ...command, targetId: target.targetId };
    }
    case "attack":
      return context.attackEndpoints === undefined
        ? noticeFor(command)
        : { ...command, ...context.attackEndpoints };
    case "life-points":
    case "chain":
    case "notice":
      return command;
  }
}

function cardForEvent(
  board: BoardViewModel,
  event: DuelPresentationEvent,
): BoardCardView | undefined {
  if (event.type !== "cardMoved") return undefined;
  if (event.instanceId !== undefined)
    return board.cards.find(
      ({ instanceId }) => instanceId === event.instanceId,
    );
  return uniqueCard(board, event.card);
}

function uniqueCard(
  board: BoardViewModel,
  code: number | undefined,
  player?: 0 | 1,
): BoardCardView | undefined {
  if (code === undefined) return undefined;
  const matches = board.cards.filter(
    (card) =>
      card.code === code && (player === undefined || card.player === player),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function noticeFor(command: PresentationCommand): DomPresentationCommand {
  return {
    kind: "notice",
    label: command.label,
    durationMs: command.durationMs,
  };
}

export class PresentationScheduler {
  #generation = 0;

  run(
    command: PresentationCommand,
    present: (command: PresentationCommand) => void,
  ): void {
    const generation = this.#generation;
    queueMicrotask(() => {
      if (generation === this.#generation) present(command);
    });
  }

  cancel(): void {
    this.#generation += 1;
  }
}
