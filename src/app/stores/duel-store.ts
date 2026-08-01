import { writable, type Readable } from "svelte/store";
import type { DuelDiagnosticTrace } from "../../duel/contracts/duel-diagnostics.ts";
import type { DuelError } from "../../duel/contracts/duel-error.ts";
import type { DuelPresentationEvent } from "../../duel/contracts/duel-presentation-event.ts";
import type { DuelResult } from "../../duel/contracts/duel-result.ts";
import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
import type { PublicDuelState } from "../../duel/contracts/public-duel-state.ts";
import { MVP_PRESET_ID } from "../../duel/presets/mvp-preset.ts";
import type {
  DuelClient,
  DuelClientContext,
  DuelClientEvent,
} from "../DuelWorkerClient.ts";
import { validatePromptSelection } from "../prompts/prompt-selection.ts";
import {
  createInactiveInteractionSession,
  reduceInteractionSession,
  sameInteractionKey,
  synchronizeInteractionSession,
  type InteractionSession,
  type InteractionSessionAction,
} from "../prompts/interaction-session.ts";
import {
  interactionKey,
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
  type InteractionKey,
} from "../prompts/interaction-spec.ts";
import type { ChoiceId, SnapshotId } from "../../duel/contracts/ids.ts";
import { mapSnapshotToBoard } from "../../field/board-view-model.ts";
import {
  formatDuelLogEntry,
  type DuelLogSourceType,
} from "../presentation/format-duel-log-entry.ts";

const MAXIMUM_PRESENTATION_EVENTS = 100;
const MAXIMUM_DUEL_LOG_ENTRIES = 2_000;

export type DuelStatus =
  | "idle"
  | "initializing"
  | "loading"
  | "active"
  | "awaiting-input"
  | "completed"
  | "failed";

export interface DuelLoadingState {
  readonly stage: string;
  readonly progress?: number;
}

export interface SequencedPresentationEvent {
  readonly sequence: number;
  readonly event: DuelPresentationEvent;
}

export type DuelLogEntry =
  | {
      readonly kind: "activity";
      readonly logSequence: number;
      readonly sourceType: DuelLogSourceType;
      readonly text: string;
    }
  | {
      readonly kind: "truncated";
      readonly logSequence: 0;
      readonly omittedCount: number;
      readonly text: string;
    };

export interface DuelViewState {
  readonly context: DuelClientContext;
  readonly status: DuelStatus;
  readonly coreVersion: readonly [number, number] | null;
  readonly runtimeSnapshotId: SnapshotId | null;
  readonly activeImageManifestSha256: string | null;
  readonly loading: DuelLoadingState | null;
  readonly snapshot: PublicDuelState | null;
  readonly prompt: PlayerPrompt | null;
  readonly result: DuelResult | null;
  readonly error: DuelError | null;
  readonly diagnostics: DuelDiagnosticTrace | null;
  readonly presentationEvents: readonly SequencedPresentationEvent[];
  readonly duelLog: readonly DuelLogEntry[];
  readonly lastAcceptedEventSequence: number;
  readonly nextPresentationSequence: number;
  readonly nextLogSequence: number;
  readonly responsePending: boolean;
  readonly responsePendingKey: InteractionKey | null;
  readonly interactionSession: InteractionSession;
}

export interface DuelStore extends Readable<DuelViewState> {
  initialize(): boolean;
  start(): boolean;
  respond(choiceIds: readonly ChoiceId[]): boolean;
  dispatchInteraction(action: InteractionSessionAction): boolean;
  surrender(): boolean;
  requestDiagnostics(): boolean;
  retry(): Promise<boolean>;
  restart(): Promise<boolean>;
  clearError(): void;
  destroy(): Promise<void>;
}

export function createInitialDuelViewState(
  context: DuelClientContext,
): DuelViewState {
  return Object.freeze({
    context: Object.freeze({ ...context }),
    status: "idle",
    coreVersion: null,
    runtimeSnapshotId: null,
    activeImageManifestSha256: null,
    loading: null,
    snapshot: null,
    prompt: null,
    result: null,
    error: null,
    diagnostics: null,
    presentationEvents: Object.freeze([]),
    duelLog: Object.freeze([]),
    lastAcceptedEventSequence: 0,
    nextPresentationSequence: 1,
    nextLogSequence: 1,
    responsePending: false,
    responsePendingKey: null,
    interactionSession: createInactiveInteractionSession(),
  });
}

export function reduceDuelViewState(
  state: DuelViewState,
  received: DuelClientEvent,
): DuelViewState {
  if (!sameContext(state.context, received.context)) return state;
  const event = received.event;
  switch (event.type) {
    case "ready":
      return freezeState({
        ...state,
        status: "idle",
        coreVersion: event.coreVersion,
        runtimeSnapshotId: event.snapshotId ?? null,
        activeImageManifestSha256: event.activeImageManifestSha256 ?? null,
        loading: null,
        error: null,
      });
    case "loading":
      return freezeState({
        ...state,
        status: "loading",
        loading: {
          stage: event.stage,
          ...(event.progress === undefined ? {} : { progress: event.progress }),
        },
      });
    case "state":
      return freezeState({
        ...state,
        status: "active",
        snapshot: event.state,
        prompt: state.responsePending ? state.prompt : null,
        responsePending: state.responsePending,
      });
    case "event": {
      if (event.eventSequence <= state.lastAcceptedEventSequence) return state;
      const presentationEntry = Object.freeze({
        sequence: state.nextPresentationSequence,
        event: event.event,
      });
      const formatted = formatDuelLogEntry(event.event);
      const logEntry =
        formatted === null
          ? null
          : Object.freeze({
              kind: "activity" as const,
              logSequence: state.nextLogSequence,
              sourceType: formatted.sourceType,
              text: formatted.text,
            });
      return freezeState({
        ...state,
        presentationEvents: Object.freeze(
          [...state.presentationEvents, presentationEntry].slice(
            -MAXIMUM_PRESENTATION_EVENTS,
          ),
        ),
        duelLog:
          logEntry === null
            ? state.duelLog
            : appendDuelLog(state.duelLog, logEntry),
        lastAcceptedEventSequence: event.eventSequence,
        nextPresentationSequence: state.nextPresentationSequence + 1,
        nextLogSequence:
          logEntry === null ? state.nextLogSequence : state.nextLogSequence + 1,
      });
    }
    case "prompt": {
      const spec = activeInteractionSpec(
        event.prompt,
        state.snapshot,
        received.context,
      );
      const newPrompt = !sameInteractionKey(
        state.interactionSession.key,
        spec.key,
      );
      return freezeState({
        ...state,
        status:
          state.responsePending && !newPrompt ? "active" : "awaiting-input",
        prompt: event.prompt,
        error: state.error?.recoverable === true ? null : state.error,
        responsePending: newPrompt ? false : state.responsePending,
        responsePendingKey: newPrompt ? null : state.responsePendingKey,
        interactionSession: synchronizeInteractionSession(
          state.interactionSession,
          spec,
        ),
      });
    }
    case "diagnostics":
      return freezeState({ ...state, diagnostics: event.trace });
    case "result":
      return freezeState({
        ...state,
        status: "completed",
        prompt: null,
        result: event.result,
        error: null,
        loading: null,
        responsePending: false,
        responsePendingKey: null,
        interactionSession: createInactiveInteractionSession(),
      });
    case "error": {
      const recoverableResponseError =
        (event.error.code === "invalid_response" ||
          event.error.code === "stale_prompt") &&
        state.prompt !== null;
      if (recoverableResponseError) {
        const spec = activeInteractionSpec(
          state.prompt,
          state.snapshot,
          received.context,
        );
        const rejected = reduceInteractionSession(
          state.interactionSession,
          spec,
          { type: "submissionRejected", key: spec.key },
        );
        return freezeState({
          ...state,
          status: "awaiting-input",
          error: event.error,
          responsePending: false,
          responsePendingKey: null,
          interactionSession: rejected.session,
        });
      }
      return freezeState({
        ...state,
        status: "failed",
        prompt: null,
        result: null,
        error: event.error,
        loading: null,
        responsePending: false,
        responsePendingKey: null,
        interactionSession: createInactiveInteractionSession(),
      });
    }
    case "disposed":
      return state;
  }
}

export function createDuelStore(client: DuelClient): DuelStore {
  let current = createInitialDuelViewState(client.context);
  const state = writable(current);
  const set = (next: DuelViewState): void => {
    current = next;
    state.set(next);
  };
  const unsubscribeClient = client.subscribe((event) => {
    set(reduceDuelViewState(current, event));
  });
  let replacementOperation: Promise<boolean> | null = null;
  const startCurrentDuel = (): boolean => {
    const context = client.startDuel(MVP_PRESET_ID);
    if (context === null) return false;
    set(
      freezeState({
        ...createInitialDuelViewState(context),
        status: "active",
        coreVersion: current.coreVersion,
        runtimeSnapshotId: current.runtimeSnapshotId,
        activeImageManifestSha256: current.activeImageManifestSha256,
      }),
    );
    return true;
  };
  const acceptResponse = (
    choiceIds: readonly ChoiceId[],
    expectedKey: InteractionKey | null = null,
  ): boolean => {
    const prompt = current.prompt;
    if (
      prompt === null ||
      current.status !== "awaiting-input" ||
      current.responsePending
    ) {
      return false;
    }
    const key = interactionKey(
      current.context.workerGeneration,
      current.context.sessionGeneration,
      prompt.id,
    );
    if (expectedKey !== null && !sameInteractionKey(expectedKey, key))
      return false;
    const validation = validatePromptSelection(prompt, choiceIds);
    if (!validation.valid) {
      set(
        freezeState({
          ...current,
          error: {
            code: "invalid_response",
            message: validation.message,
            recoverable: true,
          },
        }),
      );
      return false;
    }
    if (!client.respond(prompt.id, choiceIds)) {
      if ((current as DuelViewState).status === "failed") return false;
      set(
        freezeState({
          ...current,
          error: {
            code: "stale_prompt",
            message: "That prompt is no longer active",
            recoverable: true,
          },
        }),
      );
      return false;
    }
    const spec = activeInteractionSpec(
      prompt,
      current.snapshot,
      current.context,
    );
    const accepted = reduceInteractionSession(
      current.interactionSession,
      spec,
      { type: "submissionAccepted", key },
    );
    set(
      freezeState({
        ...current,
        status: "active",
        responsePending: true,
        responsePendingKey: key,
        interactionSession: accepted.session,
        error: null,
      }),
    );
    return true;
  };
  const replaceAndInitialize = (): Promise<boolean> => {
    if (replacementOperation !== null) return replacementOperation;
    set(
      freezeState({
        ...current,
        status: "initializing",
        loading: { stage: "replacing-worker" },
        error: null,
        prompt: null,
        snapshot: null,
        result: null,
        diagnostics: null,
        presentationEvents: Object.freeze([]),
        duelLog: Object.freeze([]),
        lastAcceptedEventSequence: 0,
        nextPresentationSequence: 1,
        nextLogSequence: 1,
        responsePending: true,
        responsePendingKey: null,
        interactionSession: createInactiveInteractionSession(),
      }),
    );
    replacementOperation = (async () => {
      try {
        await client.replace();
        const next = freezeState({
          ...createInitialDuelViewState(client.context),
          status: "initializing" as const,
        });
        set(next);
        if (client.initialize()) return true;
        set(
          freezeState({
            ...next,
            status: "failed",
            error: {
              code: "worker_error",
              message: "Unable to initialize a replacement Duel Worker",
              recoverable: false,
            },
          }),
        );
      } catch (error) {
        set(
          freezeState({
            ...createInitialDuelViewState(client.context),
            status: "failed",
            error: {
              code: "worker_error",
              message:
                error instanceof Error
                  ? `Unable to replace the Duel Worker: ${error.message}`
                  : "Unable to replace the Duel Worker",
              recoverable: false,
            },
          }),
        );
      }
      return false;
    })().finally(() => {
      replacementOperation = null;
    });
    return replacementOperation;
  };

  return {
    subscribe: state.subscribe,
    initialize: () => {
      if (!client.initialize()) return false;
      set(
        freezeState({
          ...createInitialDuelViewState(client.context),
          status: "initializing",
        }),
      );
      return true;
    },
    start: startCurrentDuel,
    respond: (choiceIds) => acceptResponse(choiceIds),
    dispatchInteraction: (action) => {
      const prompt = current.prompt;
      if (prompt === null || current.responsePending) return false;
      const spec = activeInteractionSpec(
        prompt,
        current.snapshot,
        current.context,
      );
      const reduction = reduceInteractionSession(
        current.interactionSession,
        spec,
        action,
      );
      if (reduction.command !== null) {
        return acceptResponse(
          reduction.command.choiceIds,
          reduction.command.key,
        );
      }
      if (reduction.session === current.interactionSession) return false;
      set(freezeState({ ...current, interactionSession: reduction.session }));
      return true;
    },
    surrender: () => {
      if (current.responsePending || !client.surrender()) return false;
      set(
        freezeState({
          ...current,
          status: "active",
          prompt: null,
          responsePending: true,
          responsePendingKey: null,
          interactionSession: createInactiveInteractionSession(),
          error: null,
        }),
      );
      return true;
    },
    requestDiagnostics: () => client.requestDiagnostics(),
    retry: replaceAndInitialize,
    restart: replaceAndInitialize,
    clearError: () => {
      if (current.error?.recoverable !== true) return;
      set(freezeState({ ...current, error: null }));
    },
    destroy: async () => {
      unsubscribeClient();
      await client.dispose();
    },
  };
}

function appendDuelLog(
  existing: readonly DuelLogEntry[],
  entry: Extract<DuelLogEntry, { readonly kind: "activity" }>,
): readonly DuelLogEntry[] {
  const activities =
    existing[0]?.kind === "truncated" ? existing.slice(1) : existing;
  const appended = [...activities, entry];
  if (
    existing[0]?.kind !== "truncated" &&
    appended.length <= MAXIMUM_DUEL_LOG_ENTRIES
  ) {
    return Object.freeze(appended);
  }
  const retained = appended.slice(-(MAXIMUM_DUEL_LOG_ENTRIES - 1));
  const omittedCount = entry.logSequence - retained.length;
  const marker = Object.freeze({
    kind: "truncated" as const,
    logSequence: 0 as const,
    omittedCount,
    text: `${omittedCount} earlier duel event${omittedCount === 1 ? "" : "s"} omitted.`,
  });
  return Object.freeze([marker, ...retained]);
}

function activeInteractionSpec(
  prompt: PlayerPrompt,
  snapshot: PublicDuelState | null,
  context: DuelClientContext,
): ActiveInteractionSpec {
  const boardResult = snapshot === null ? null : mapSnapshotToBoard(snapshot);
  const board = boardResult?.ok === true ? boardResult.value : null;
  const spec = mapPromptToInteractionSpec(prompt, snapshot, board, context);
  if (spec.kind === "inactive")
    throw new Error(`Unsupported active prompt kind: ${prompt.kind}`);
  return spec;
}

function sameContext(
  left: DuelClientContext,
  right: DuelClientContext,
): boolean {
  return (
    left.workerGeneration === right.workerGeneration &&
    left.sessionGeneration === right.sessionGeneration
  );
}

function freezeState(state: DuelViewState): DuelViewState {
  return Object.freeze(state);
}
