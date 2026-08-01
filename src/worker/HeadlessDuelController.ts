import {
  DuelOperationError,
  duelOperationError,
} from "../duel/contracts/duel-error.ts";
import type { ChoiceId, PromptId, SnapshotId } from "../duel/contracts/ids.ts";
import type { DuelPresentationEvent } from "../duel/contracts/duel-presentation-event.ts";
import type { DuelResult } from "../duel/contracts/duel-result.ts";
import type { PlayerPrompt } from "../duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../duel/contracts/public-duel-state.ts";
import type { ActiveDuelDependencies } from "./assets/active-duel-dependencies.ts";
import { BoundedDuelTrace, type DuelTrace } from "./diagnostics/duel-trace.ts";
import type { DuelSession } from "./engine/DuelSession.ts";
import type {
  EngineCardQuery,
  EngineCardQueryResult,
  EngineLocationQueryResult,
  EngineMessage,
} from "./engine/OcgCoreAdapter.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
  EngineQueryFlag,
} from "./engine/engine-constants.ts";
import {
  BasicOpponentPolicy,
  toOpponentVisibleState,
  type OpponentPolicy,
} from "./opponent/OpponentPolicy.ts";
import {
  DuelStateProjector,
  type ProjectionReconciliationRequest,
  type QueriedCounter,
  type QueriedOverlayMaterial,
  type QueriedPublicCard,
} from "./projection/DuelStateProjector.ts";
import { PromptRegistry } from "./protocol/PromptRegistry.ts";

export interface DuelAdvance {
  readonly state: PublicDuelState;
  readonly events: readonly DuelPresentationEvent[];
  readonly prompt?: PlayerPrompt;
  readonly result?: DuelResult;
}

export interface HeadlessDuelControllerOptions {
  readonly session: DuelSession;
  readonly dependencies: ActiveDuelDependencies;
  readonly snapshotId: SnapshotId;
  readonly presetId: string;
  readonly deckCounts: readonly [number, number];
  readonly extraDeckCounts: readonly [number, number];
  readonly opponentPolicy?: OpponentPolicy;
  readonly maximumAutomaticResponses?: number;
  readonly promptIdNamespace?: string;
  readonly trace?: BoundedDuelTrace;
}

export class HeadlessDuelController {
  readonly #session: DuelSession;
  readonly #projector: DuelStateProjector;
  readonly #prompts: PromptRegistry;
  readonly #opponent: OpponentPolicy;
  readonly #trace: BoundedDuelTrace;
  readonly #maximumAutomaticResponses: number;
  #result: DuelResult | null = null;
  #ownExtraDeckReconciled = false;

  constructor(options: HeadlessDuelControllerOptions) {
    this.#session = options.session;
    this.#projector = new DuelStateProjector(
      options.snapshotId,
      options.deckCounts,
      options.extraDeckCounts,
      [options.session.initialExtraDeckOrder(0), []],
      options.dependencies,
    );
    this.#trace =
      options.trace ??
      new BoundedDuelTrace(
        options.presetId,
        options.snapshotId,
        options.session.seed,
      );
    this.#prompts = new PromptRegistry(
      options.dependencies,
      options.promptIdNamespace,
      ({ type }) =>
        this.#trace.record({
          kind: "promptDiagnostic",
          detail: `prompt:${type}`,
        }),
    );
    this.#opponent =
      options.opponentPolicy ?? new BasicOpponentPolicy(options.dependencies);
    this.#maximumAutomaticResponses =
      options.maximumAutomaticResponses ?? 1_000;
  }

  advance(): DuelAdvance {
    this.#assertActive();
    try {
      return this.#advanceUntilBoundary();
    } catch (error) {
      this.#fail(error);
      throw error;
    }
  }

  #advanceUntilBoundary(): DuelAdvance {
    this.#ensureOwnExtraDeckReconciled();
    const events: DuelPresentationEvent[] = [];

    for (
      let automaticResponses = 0;
      automaticResponses <= this.#maximumAutomaticResponses;
      automaticResponses += 1
    ) {
      const checkpoint = this.#projector.checkpoint();
      const previousResult = this.#result;
      try {
        const boundary = this.#session.processUntilBoundary();
        for (const [index, status] of boundary.statuses.entries()) {
          this.#trace.record({
            kind: "process",
            status,
            detail: `iteration ${index + 1} of ${boundary.iterations}`,
          });
        }
        let answeredOpponent = false;
        let humanPrompt: PlayerPrompt | undefined;
        const counterRequests = new Map<
          string,
          Extract<
            ProjectionReconciliationRequest,
            { readonly type: "counters" }
          >
        >();

        for (const message of boundary.messages) {
          this.#trace.record({ kind: "message", messageType: message.type });
          const counterKey = counterMessageAddressKey(message);
          const update =
            counterKey !== undefined && counterRequests.has(counterKey)
              ? { events: [], reconciliationRequests: [] }
              : this.#projector.apply(message);
          const immediateRequests: ProjectionReconciliationRequest[] = [];
          for (const request of update.reconciliationRequests) {
            if (request.type === "counters")
              counterRequests.set(counterAddressKey(request), request);
            else immediateRequests.push(request);
          }
          this.#reconcile(immediateRequests);
          if (update.reconciliationFailure !== undefined) {
            this.#trace.record({
              kind: "promptDiagnostic",
              detail: "reconcile:overlayHost:invariant",
            });
            throw new DuelOperationError(
              {
                code: "unsupported_message",
                message: "Unable to reconcile overlayMaterials state",
                recoverable: false,
              },
              new Error(
                `Projection reconciliation failed: ${update.reconciliationFailure}`,
              ),
            );
          }
          events.push(...update.events);
          for (const event of update.events)
            this.#trace.record({ kind: "presentation", detail: event.type });
          if (update.result !== undefined) {
            this.#result = update.result;
            this.#trace.record({
              kind: "result",
              detail: JSON.stringify(update.result),
            });
          }
        }

        this.#reconcile([...counterRequests.values()]);

        for (const message of boundary.messages) {
          const prompt = this.#prompts.publish(message);
          if (prompt === null) continue;
          this.#trace.record({
            kind: "prompt",
            promptId: prompt.id,
            player: prompt.player,
          });
          if (humanPrompt !== undefined) {
            throw duelOperationError(
              "unsupported_message",
              "ocgcore emitted multiple player prompts in one process batch",
            );
          }
          if (prompt.player === 0) {
            humanPrompt = prompt;
            continue;
          }

          const decision = this.#opponent.choose(
            prompt,
            toOpponentVisibleState(this.#projector.snapshot()),
          );
          const response = this.#prompts.respond(prompt.id, decision.choiceIds);
          this.#session.respond(response);
          this.#trace.record({
            kind: "response",
            promptId: prompt.id,
            choiceIds: decision.choiceIds,
            player: 1,
            opponentReason: decision.reason,
          });
          answeredOpponent = true;
        }

        if (this.#result !== null) {
          const result = this.#result;
          this.#closeSession("completed");
          return {
            state: this.#projector.snapshot(),
            events,
            result,
          };
        }
        if (humanPrompt !== undefined) {
          return {
            state: this.#projector.snapshot(),
            events,
            prompt: humanPrompt,
          };
        }
        if (boundary.status === "ended") {
          throw duelOperationError(
            "unsupported_message",
            "ocgcore ended without emitting a duel result",
          );
        }
        if (!answeredOpponent) {
          throw duelOperationError(
            "unsupported_message",
            "ocgcore is waiting but emitted no supported player prompt",
          );
        }
      } catch (error) {
        this.#projector.restore(checkpoint);
        this.#result = previousResult;
        throw error;
      }
    }

    throw duelOperationError(
      "process_timeout",
      `Opponent exceeded ${this.#maximumAutomaticResponses} automatic responses without reaching the human`,
    );
  }

  #ensureOwnExtraDeckReconciled(): void {
    if (this.#ownExtraDeckReconciled) return;
    this.#reconcile([{ type: "extraDeck", player: 0 }]);
    this.#ownExtraDeckReconciled = true;
  }

  #reconcile(requests: readonly ProjectionReconciliationRequest[]): void {
    for (const request of requests) {
      try {
        if (request.type === "extraDeck") {
          this.#projector.reconcileExtraDeck(
            request.player,
            this.#queryExtraDeck(request.player),
          );
        } else if (request.type === "overlayMaterials") {
          this.#projector.reconcileOverlayMaterials(
            request,
            this.#queryOverlayMaterials(request),
          );
        } else {
          this.#projector.reconcileCounters(
            request,
            this.#queryCounters(request),
          );
        }
      } catch (error) {
        const category =
          error instanceof ReconciliationEvidenceError
            ? error.category
            : "invariant";
        const addressClass =
          request.type === "extraDeck"
            ? "extraDeck"
            : request.type === "overlayMaterials"
              ? "overlayHost"
              : "counterHost";
        this.#trace.record({
          kind: "promptDiagnostic",
          detail: `reconcile:${addressClass}:${category}`,
        });
        throw new DuelOperationError(
          {
            code: "unsupported_message",
            message: `Unable to reconcile ${request.type} state`,
            recoverable: false,
          },
          error,
        );
      }
    }
  }

  #queryExtraDeck(player: 0 | 1): readonly QueriedPublicCard[] {
    const flags = queryFlags(false);
    let values: EngineLocationQueryResult;
    try {
      values = this.#session.queryLocation({
        flags,
        controller: player,
        location: EngineLocation.EXTRA as EngineCardQuery["location"],
      });
    } catch (error) {
      throw new ReconciliationEvidenceError("unavailable", error);
    }
    try {
      const result: QueriedPublicCard[] = [];
      for (const value of values) {
        if (value === null) continue;
        const record = queriedCard(value);
        if (record.owner !== player)
          throw new Error("Extra Deck query owner does not match player");
        result.push(record);
      }
      return result;
    } catch (error) {
      throw new ReconciliationEvidenceError("malformed", error);
    }
  }

  #queryOverlayMaterials(
    address: Extract<
      ProjectionReconciliationRequest,
      { readonly type: "overlayMaterials" }
    >,
  ): readonly QueriedOverlayMaterial[] {
    let host: EngineCardQueryResult;
    try {
      host = this.#session.queryCard({
        flags: EngineQueryFlag.OVERLAY_CARD,
        controller: address.controller,
        location: address.location as EngineCardQuery["location"],
        sequence: address.sequence,
        overlaySequence: 0,
      });
    } catch (error) {
      throw new ReconciliationEvidenceError("unavailable", error);
    }
    try {
      if (host === null || !Array.isArray(host.overlayCards))
        throw new Error("Overlay host query omitted material list");
      if (host.overlayCards.length > 256)
        throw new Error("Overlay host query exceeds physical instance limit");
      if (
        host.overlayCards.some(
          (code) => !Number.isSafeInteger(code) || code <= 0,
        )
      )
        throw new Error("Overlay host query returned an invalid material code");
      return host.overlayCards.map((queriedCode, overlaySequence) => {
        try {
          const value = this.#session.queryCard({
            flags: queryFlags(true),
            controller: address.controller,
            location: (address.location |
              EngineLocation.OVERLAY) as EngineCardQuery["location"],
            sequence: address.sequence,
            overlaySequence,
          });
          if (value === null)
            throw new Error("Overlay material query returned an empty slot");
          const record = queriedCard(value);
          if (record.code !== queriedCode)
            throw new Error(
              "Overlay query omitted or contradicted material code",
            );
          return {
            code: queriedCode,
            identityVisible:
              record.isPublic && isFaceUpPosition(record.position),
          };
        } catch {
          this.#trace.record({
            kind: "promptDiagnostic",
            detail: "reconcile:overlayHost:enrichment_unavailable",
          });
          return { code: queriedCode };
        }
      });
    } catch (error) {
      if (error instanceof ReconciliationEvidenceError) throw error;
      throw new ReconciliationEvidenceError("malformed", error);
    }
  }

  #queryCounters(
    address: Extract<
      ProjectionReconciliationRequest,
      { readonly type: "counters" }
    >,
  ): readonly QueriedCounter[] {
    let value: EngineCardQueryResult;
    try {
      value = this.#session.queryCard({
        flags: EngineQueryFlag.COUNTERS as EngineCardQuery["flags"],
        controller: address.controller,
        location: address.location as EngineCardQuery["location"],
        sequence: address.sequence,
        overlaySequence: 0,
      });
    } catch (error) {
      throw new ReconciliationEvidenceError("unavailable", error);
    }
    try {
      if (value === null || !isRecord(value.counters))
        throw new Error("Counter host query omitted counters");
      const entries = Object.entries(value.counters);
      if (entries.length > 256)
        throw new Error("Counter host query exceeds per-card limit");
      return entries
        .map(([key, count]): QueriedCounter => {
          const type = Number(key);
          if (
            !Number.isSafeInteger(type) ||
            type < 1 ||
            type > 0xffff ||
            String(type) !== key
          )
            throw new Error("Counter host query returned an invalid type");
          if (
            !Number.isSafeInteger(count) ||
            (count as number) < 1 ||
            (count as number) > 0xffff
          )
            throw new Error("Counter host query returned an invalid count");
          return { type, count: count as number };
        })
        .sort((left, right) => left.type - right.type);
    } catch (error) {
      throw new ReconciliationEvidenceError("malformed", error);
    }
  }

  respond(promptId: PromptId, choiceIds: readonly ChoiceId[]): DuelAdvance {
    this.#assertActive();
    const prompt = this.#prompts.current;
    if (prompt?.player !== 0) {
      throw duelOperationError(
        "invalid_response",
        "No human prompt is awaiting a response",
      );
    }
    const response = this.#prompts.respond(promptId, choiceIds);
    try {
      this.#session.respond(response);
      this.#trace.record({ kind: "response", promptId, choiceIds, player: 0 });
    } catch (error) {
      this.#fail(error);
      throw error;
    }
    return this.advance();
  }

  surrender(): DuelAdvance {
    this.#assertActive();
    try {
      this.#ensureOwnExtraDeckReconciled();
    } catch (error) {
      this.#fail(error);
      throw error;
    }
    this.#result = { type: "surrendered", winner: 1, loser: 0 };
    this.#trace.record({
      kind: "result",
      detail: JSON.stringify(this.#result),
    });
    this.#closeSession("surrendered");
    return {
      state: this.#projector.snapshot(),
      events: [],
      result: this.#result,
    };
  }

  dispose(): void {
    this.#closeSession("disposed");
  }

  get disposed(): boolean {
    return this.#session.disposed;
  }

  get cleanupUncertain(): boolean {
    return this.#session.cleanupFailed;
  }

  trace(): DuelTrace {
    return this.#trace.snapshot();
  }

  #fail(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.#trace.record({ kind: "error", detail: message });
    try {
      this.#closeSession("failed");
    } catch (cleanupError) {
      const cleanupMessage =
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError);
      this.#trace.record({
        kind: "error",
        detail: `Session cleanup failed: ${cleanupMessage}`,
      });
      throw new AggregateError(
        [error, cleanupError],
        `${message}; session cleanup failed: ${cleanupMessage}`,
        { cause: error },
      );
    }
  }

  #closeSession(
    reason: "completed" | "surrendered" | "failed" | "disposed",
  ): void {
    this.#prompts.clear();
    if (this.#session.disposed) return;
    this.#session.dispose();
    this.#trace.record({
      kind: "lifecycle",
      detail: `session_closed:${reason}`,
    });
  }

  #assertActive(): void {
    if (this.#result !== null) {
      throw duelOperationError("duel_not_active", "Duel has already completed");
    }
    if (this.#session.disposed) {
      throw duelOperationError("duel_not_active", "Duel has been disposed");
    }
  }
}

function counterMessageAddressKey(message: EngineMessage): string | undefined {
  if (
    message.type !== EngineMessageType.ADD_COUNTER &&
    message.type !== EngineMessageType.REMOVE_COUNTER
  )
    return undefined;
  return `${message.controller}:${message.location}:${message.sequence}`;
}

function counterAddressKey(address: {
  readonly controller: number;
  readonly location: number;
  readonly sequence: number;
}): string {
  return `${address.controller}:${address.location}:${address.sequence}`;
}

function queryFlags(includeOverlay = false): EngineCardQuery["flags"] {
  return (EngineQueryFlag.CODE |
    EngineQueryFlag.POSITION |
    EngineQueryFlag.OWNER |
    EngineQueryFlag.IS_PUBLIC |
    EngineQueryFlag.IS_HIDDEN |
    (includeOverlay
      ? EngineQueryFlag.OVERLAY_CARD
      : 0)) as EngineCardQuery["flags"];
}

class ReconciliationEvidenceError extends Error {
  readonly category: "unavailable" | "malformed";

  constructor(category: "unavailable" | "malformed", cause: unknown) {
    super(`Reconciliation evidence is ${category}`, { cause });
    this.name = "ReconciliationEvidenceError";
    this.category = category;
  }
}

function isFaceUpPosition(position: number): boolean {
  return (
    position === EnginePosition.FACE_UP_ATTACK ||
    position === EnginePosition.FACE_UP_DEFENSE
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queriedCard(
  value: Exclude<EngineCardQueryResult, null>,
): QueriedPublicCard {
  if (value.owner !== 0 && value.owner !== 1)
    throw new Error("Card query omitted a valid owner");
  if (
    value.position !== EnginePosition.FACE_UP_ATTACK &&
    value.position !== EnginePosition.FACE_DOWN_ATTACK &&
    value.position !== EnginePosition.FACE_UP_DEFENSE &&
    value.position !== EnginePosition.FACE_DOWN_DEFENSE
  )
    throw new Error("Card query omitted a valid position");
  if (typeof value.isPublic !== "boolean")
    throw new Error("Card query omitted public visibility");
  if (typeof value.isHidden !== "boolean")
    throw new Error("Card query omitted hidden visibility");
  if (
    value.code !== undefined &&
    (!Number.isSafeInteger(value.code) || value.code <= 0)
  )
    throw new Error("Card query returned an invalid code");
  return {
    ...(value.code === undefined ? {} : { code: value.code }),
    owner: value.owner,
    position: value.position,
    isPublic: value.isPublic,
    isHidden: value.isHidden,
  };
}
