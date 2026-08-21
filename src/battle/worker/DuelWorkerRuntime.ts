import { assertNever } from "../duel/contracts/assert-never.ts";
import {
  DuelCommandValidationError,
  type DuelCommand,
} from "../duel/contracts/duel-command.ts";
import type { DuelDiagnosticTrace } from "../duel/contracts/duel-diagnostics.ts";
import {
  duelOperationError,
  type DuelError,
} from "../duel/contracts/duel-error.ts";
import type { DuelDeckSelection } from "../duel/contracts/duel-deck-selection.ts";
import type {
  DuelWorkerEvent,
  RestoreFailureReason,
} from "../duel/contracts/duel-worker-event.ts";
import type { SnapshotId } from "../duel/contracts/ids.ts";
import type { DeckId } from "../duel/presets/deck-catalog.ts";
import type { DuelPreset } from "../duel/presets/duel-preset.ts";
import { selectedDeckPairRulesProfile } from "../duel/presets/duel-rules-profile.ts";
import type { ActiveDuelDependencies } from "./assets/active-duel-dependencies.ts";
import {
  BoundedDuelTrace,
  buildRestorePlan,
  type DuelTrace,
  type DuelTraceEntry,
  type RecordedDuelResponse,
} from "./diagnostics/duel-trace.ts";
import { resolveDuelDecks } from "./decks/resolve-duel-decks.ts";
import { DuelSession } from "./engine/DuelSession.ts";
import { createProductionSeed, type DuelSeed } from "./engine/duel-seed.ts";
import type { OcgCoreAdapter } from "./engine/OcgCoreAdapter.ts";
import {
  BasicOpponentPolicy,
  type OpponentPolicy,
} from "./opponent/OpponentPolicy.ts";
import {
  ReplayDivergenceError,
  ReplayOpponentPolicy,
  type RecordedOpponentResponse,
} from "./opponent/ReplayOpponentPolicy.ts";
import {
  HeadlessDuelController,
  type DuelAdvance,
} from "./HeadlessDuelController.ts";
import { routineLogError, toDuelError } from "./duel-errors.ts";
import {
  safeWorkerLogger,
  workerLog,
  type WorkerLogger,
} from "./diagnostics/worker-log.ts";

const DEFAULT_MAXIMUM_QUEUED_COMMANDS = 128;
const MAXIMUM_RUNTIME_ID_LENGTH = 128;

type QueuedDuelCommand = Exclude<DuelCommand, { readonly type: "dispose" }>;

export { toDuelError };

export interface DuelRuntimeRevisionMetadata {
  readonly babelCdb: string;
  readonly cardScripts: string;
  readonly distribution: string;
  readonly activeImageManifestSha256: string;
}

export interface DuelRuntimeResources {
  readonly adapter: OcgCoreAdapter;
  readonly dependencies: ActiveDuelDependencies;
  readonly createPreset: (
    playerDeckId: DeckId,
    opponentDeckId: DeckId,
  ) => DuelPreset;
  readonly snapshotId: SnapshotId;
  readonly revisions?: DuelRuntimeRevisionMetadata;
}

export type DuelRuntimeInitializer = (
  progress: (stage: string, value?: number) => void,
  signal: AbortSignal,
) => Promise<DuelRuntimeResources>;

export type DuelRuntimeProgressSink = (
  event: Extract<DuelWorkerEvent, { readonly type: "loading" }>,
) => void;

export interface DuelRuntimeFailureContext {
  readonly commandType: DuelCommand["type"];
  readonly code: DuelError["code"];
  readonly runtimeId: string;
  readonly traceMetadata?: Pick<DuelTrace, "presetId" | "snapshotId">;
  readonly traceTail?: readonly DuelTraceEntry[];
}

export type DuelRuntimeFailureSink = (
  error: unknown,
  context: DuelRuntimeFailureContext,
) => void;

export interface DuelWorkerRuntimeOptions {
  readonly maximumQueuedCommands?: number;
  readonly runtimeId?: string;
  readonly logger?: WorkerLogger;
}

/** What the trace cannot say about a duel that has already failed: which decks
    were brought to the table, and which namespace its prompt IDs were minted
    in. A rebuild reuses both, so the recorded answers still name the choices
    they were recorded against. */
interface DuelStartRecord {
  readonly duelId: string;
  readonly player: DuelDeckSelection;
  readonly opponent: DuelDeckSelection;
  readonly promptIdNamespace: string;
}

interface OpenDuelOptions {
  readonly duelId: string;
  readonly player: DuelDeckSelection;
  readonly opponent: DuelDeckSelection;
  readonly seed: DuelSeed;
  readonly snapshotId: SnapshotId;
  readonly promptIdNamespace: string;
  readonly opponentPolicy?: OpponentPolicy;
  readonly publishTrace: (trace: DuelTrace) => void;
}

/** Long enough to name the engine call that refused, short enough that a
    failure message can never become a payload. */
const MAXIMUM_RESTORE_DETAIL_LENGTH = 1_024;

export class DuelWorkerRuntime {
  readonly #initializeResources: DuelRuntimeInitializer;
  #resources: DuelRuntimeResources | null = null;
  #initializationFailure: { readonly error: unknown } | null = null;
  #initializationAbortController: AbortController | null = null;
  #controller: HeadlessDuelController | null = null;
  #lastTrace: DuelTrace | null = null;
  #lastStart: DuelStartRecord | null = null;
  #commandQueue: Promise<void> = Promise.resolve();
  readonly #maximumQueuedCommands: number;
  readonly #runtimeId: string;
  readonly #logger: WorkerLogger;
  #pendingCommands = 0;
  #nextDuelSequence = 0;
  #nextEventSequence = 0;
  #activeCommandDepth = 0;
  #deferredControllerDisposal: HeadlessDuelController | null = null;
  #replacementRequired = false;
  #disposed = false;

  constructor(
    initializeResources: DuelRuntimeInitializer,
    options: DuelWorkerRuntimeOptions = {},
  ) {
    this.#initializeResources = initializeResources;
    this.#maximumQueuedCommands =
      options.maximumQueuedCommands ?? DEFAULT_MAXIMUM_QUEUED_COMMANDS;
    this.#runtimeId = options.runtimeId ?? globalThis.crypto.randomUUID();
    this.#logger = safeWorkerLogger(options.logger ?? workerLog);
    if (
      !Number.isSafeInteger(this.#maximumQueuedCommands) ||
      this.#maximumQueuedCommands <= 0
    ) {
      throw new Error(
        `Invalid Worker command queue limit: ${this.#maximumQueuedCommands}`,
      );
    }
    if (
      this.#runtimeId.trim().length === 0 ||
      this.#runtimeId.length > MAXIMUM_RUNTIME_ID_LENGTH
    ) {
      throw new Error("Invalid Worker runtime ID");
    }
  }

  handle(
    command: DuelCommand,
    progressSink?: DuelRuntimeProgressSink,
    failureSink?: DuelRuntimeFailureSink,
  ): Promise<readonly DuelWorkerEvent[]> {
    if (command.type === "dispose") {
      this.dispose();
      return Promise.resolve([]);
    }
    if (this.#disposed || this.#replacementRequired) return Promise.resolve([]);
    if (this.#pendingCommands >= this.#maximumQueuedCommands) {
      const error = new DuelCommandValidationError(
        `Worker command queue limit of ${this.#maximumQueuedCommands} was reached`,
      );
      const duelError = toDuelError(error);
      this.#reportFailure(
        error,
        {
          commandType: command.type,
          code: duelError.code,
          runtimeId: this.#runtimeId,
        },
        failureSink,
      );
      if (this.#disposed) return Promise.resolve([]);
      return Promise.resolve([{ type: "error", error: duelError }]);
    }

    this.#pendingCommands += 1;
    const operation = this.#commandQueue.then(async () => {
      if (this.#disposed || this.#replacementRequired) return [];
      this.#activeCommandDepth += 1;
      try {
        return await this.#handleCommand(command, progressSink, failureSink);
      } finally {
        this.#activeCommandDepth -= 1;
        if (this.#activeCommandDepth === 0) this.#flushDeferredDisposal();
      }
    });
    const trackedOperation = operation.finally(() => {
      this.#pendingCommands -= 1;
    });
    this.#commandQueue = trackedOperation.then(
      () => undefined,
      () => undefined,
    );
    return trackedOperation;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#initializationAbortController?.abort();
    this.#initializationAbortController = null;
    const controller = this.#controller;
    this.#controller = null;
    this.#resources = null;
    this.#initializationFailure = null;
    if (controller === null) return;
    if (this.#activeCommandDepth > 0) {
      this.#deferredControllerDisposal = controller;
      return;
    }
    this.#disposeController(controller, "runtime_disposed");
  }

  async #handleCommand(
    command: QueuedDuelCommand,
    progressSink?: DuelRuntimeProgressSink,
    failureSink?: DuelRuntimeFailureSink,
  ): Promise<readonly DuelWorkerEvent[]> {
    const events: DuelWorkerEvent[] = [];
    try {
      switch (command.type) {
        case "initialize": {
          await this.#initialize(events, progressSink);
          if (this.#disposed) return [];
          const resources = this.#requireResources();
          events.push({
            type: "ready",
            coreVersion: resources.adapter.getVersion(),
            snapshotId: resources.snapshotId,
            ...(resources.revisions?.activeImageManifestSha256 === undefined
              ? {}
              : {
                  activeImageManifestSha256:
                    resources.revisions.activeImageManifestSha256,
                }),
          });
          break;
        }
        case "startDuel":
          this.#startDuel(
            command.duelId,
            command.player,
            command.opponent,
            events,
          );
          break;
        case "respond": {
          const controller = this.#requireController();
          this.#recordAdvance(
            controller,
            controller.respond(command.promptId, command.choiceIds),
            events,
          );
          break;
        }
        case "surrender": {
          const controller = this.#requireController();
          this.#recordAdvance(controller, controller.surrender(), events);
          break;
        }
        case "requestDiagnostics":
          events.push({ type: "diagnostics", trace: this.#diagnosticTrace() });
          break;
        case "restore":
          this.#restore(events);
          break;
        default:
          assertNever(command);
      }
    } catch (error) {
      if (this.#disposed) return [];
      const controller = this.#controller;
      const trace = controller?.trace();
      if (trace !== undefined) this.#lastTrace = trace;
      const traceTail = trace?.entries.slice(-20);
      const terminal = controller?.disposed === true;
      if (terminal) this.#controller = null;
      if (
        controller?.cleanupUncertain === true ||
        error instanceof AggregateError
      )
        this.#replacementRequired = true;
      const duelError = toDuelError(error, { terminal });
      this.#reportFailure(
        error,
        {
          commandType: command.type,
          code: duelError.code,
          runtimeId: this.#runtimeId,
          ...(trace === undefined
            ? {}
            : {
                traceMetadata: {
                  presetId: trace.presetId,
                  snapshotId: trace.snapshotId,
                },
              }),
          ...(traceTail === undefined || traceTail.length === 0
            ? {}
            : { traceTail }),
        },
        failureSink,
      );
      const canRestore = this.#canRestore();
      events.push({
        type: "error",
        error: duelError,
        ...(canRestore ? { canRestore } : {}),
      });
    }
    return this.#disposed ? [] : events;
  }

  async #initialize(
    events: DuelWorkerEvent[],
    progressSink?: DuelRuntimeProgressSink,
  ): Promise<void> {
    if (this.#resources !== null) return;
    if (this.#initializationFailure !== null) {
      throw this.#initializationFailure.error;
    }

    const abortController = new AbortController();
    this.#initializationAbortController = abortController;
    try {
      const resources = await this.#initializeResources((stage, progress) => {
        if (this.#disposed) return;
        const event = {
          type: "loading" as const,
          stage,
          ...(progress === undefined ? {} : { progress }),
        };
        if (progressSink === undefined) events.push(event);
        else progressSink(event);
      }, abortController.signal);
      if (!this.#disposed) this.#resources = resources;
    } catch (error) {
      if (!this.#disposed) this.#initializationFailure = { error };
      throw error;
    } finally {
      if (this.#initializationAbortController === abortController) {
        this.#initializationAbortController = null;
      }
    }
  }

  #startDuel(
    duelId: string,
    player: DuelDeckSelection,
    opponent: DuelDeckSelection,
    events: DuelWorkerEvent[],
  ): void {
    const resources = this.#requireResources();
    if (this.#controller !== null) {
      throw duelOperationError(
        "duel_already_active",
        "A duel session is already active",
      );
    }
    const promptIdNamespace = `${this.#runtimeId}-duel-${this.#nextDuelSequence + 1}`;
    const controller = this.#openDuel({
      duelId,
      player,
      opponent,
      seed: createProductionSeed(),
      snapshotId: resources.snapshotId,
      promptIdNamespace,
      publishTrace: (trace) => {
        this.#lastTrace = trace;
      },
    });
    if (controller === null) return;
    this.#nextDuelSequence += 1;
    this.#nextEventSequence = 0;
    this.#controller = controller;
    this.#lastStart = Object.freeze({
      duelId,
      player,
      opponent,
      promptIdNamespace,
    });
    try {
      this.#recordAdvance(controller, controller.advance(), events);
    } catch (error) {
      try {
        controller.dispose();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Duel start failed and session cleanup also failed",
          { cause: error },
        );
      }
      throw error;
    }
  }

  /** Builds a duel session and its controller without publishing anything:
      the caller decides whether the result becomes the active duel. Returns
      `null` only when the runtime was disposed while the core was starting. */
  #openDuel(options: OpenDuelOptions): HeadlessDuelController | null {
    const resources = this.#requireResources();
    /* Resolution and card support are settled before any core session exists,
       so a refused deck leaves the runtime exactly as it found it. */
    const decks = resolveDuelDecks(options.player, options.opponent, resources);
    /* Only a preset pair has an id the Worker can derive and check. A duel
       built from an explicit list carries whatever id its caller chose, and
       there is nothing on this side to compare it against. */
    if (decks.presetId !== null && options.duelId !== decks.presetId) {
      throw duelOperationError(
        "invalid_command",
        `Unknown preset duel: ${options.duelId}`,
      );
    }
    const traceId = decks.presetId ?? options.duelId;
    /* One immutable rules/layout decision per selected pair: the engine mode
       and the visible geometry can never disagree about Extra Monster Zones. */
    const profile = selectedDeckPairRulesProfile(
      decks.player,
      decks.opponent,
      resources.dependencies.cards,
    );
    const trace = new BoundedDuelTrace(
      traceId,
      options.snapshotId,
      options.seed,
    );
    trace.record({ kind: "lifecycle", detail: "session creation started" });
    options.publishTrace(trace.snapshot());
    let session: DuelSession;
    try {
      session = DuelSession.create({
        adapter: resources.adapter,
        dependencies: resources.dependencies,
        playerDeck: decks.player,
        opponentDeck: decks.opponent,
        configuration: {
          mode: "production",
          rules: profile.rules,
          seed: options.seed,
        },
        onEngineDiagnostic: ({ type, message, error }) => {
          trace.record({
            kind: "engineDiagnostic",
            diagnosticType: type,
            detail: "engine diagnostic emitted",
          });
          options.publishTrace(trace.snapshot());
          this.#logger.warn({
            event: "duel.worker.engine.session.diagnostic",
            runtimeId: this.#runtimeId,
            duelId: options.duelId,
            diagnosticType: type,
            message,
            ...(error === undefined ? {} : { err: error }),
          });
        },
      });
    } catch (error) {
      trace.record({
        kind: "error",
        detail:
          error instanceof Error ? error.message : "Session creation failed",
      });
      options.publishTrace(trace.snapshot());
      throw error;
    }
    if (this.#disposed) {
      try {
        session.dispose();
      } catch (error) {
        this.#logger.error({
          event: "duel.worker.session.cleanup.failed",
          runtimeId: this.#runtimeId,
          duelId: options.duelId,
          reason: "runtime_disposed_during_creation",
          err: error,
        });
      }
      return null;
    }
    try {
      return new HeadlessDuelController({
        session,
        dependencies: resources.dependencies,
        snapshotId: options.snapshotId,
        presetId: traceId,
        deckCounts: [decks.player.main.length, decks.opponent.main.length],
        extraDeckCounts: [
          decks.player.extra.length,
          decks.opponent.extra.length,
        ],
        extraMonsterZones: profile.extraMonsterZones,
        promptIdNamespace: options.promptIdNamespace,
        ...(options.opponentPolicy === undefined
          ? {}
          : { opponentPolicy: options.opponentPolicy }),
        trace,
      });
    } catch (error) {
      try {
        session.dispose();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Duel start failed and session cleanup also failed",
          { cause: error },
        );
      }
      throw error;
    }
  }

  /**
   * Rebuilds the failed duel from its own recorded answers and hands it back
   * at the last prompt the player owned.
   *
   * Nothing the runtime already holds is touched until the rebuild has
   * reached that prompt: a replay that fails leaves the previous error, its
   * trace and its downloadable report exactly as the player found them.
   */
  #restore(events: DuelWorkerEvent[]): void {
    const resources = this.#requireResources();
    if (this.#controller !== null) {
      events.push({ type: "restore_failed", reason: "duel_active" });
      return;
    }
    const start = this.#lastStart;
    const plan =
      this.#lastTrace === null ? null : buildRestorePlan(this.#lastTrace);
    if (start === null || plan === null) {
      events.push({ type: "restore_failed", reason: "no_restore_point" });
      return;
    }
    const humanResponses: RecordedDuelResponse[] = [];
    const opponentResponses: RecordedOpponentResponse[] = [];
    for (const response of plan.responses) {
      if (response.opponentReason === undefined) humanResponses.push(response);
      else
        opponentResponses.push({
          promptId: response.promptId,
          choiceIds: response.choiceIds,
          reason: response.opponentReason,
        });
    }
    let handedOver = false;
    let controller: HeadlessDuelController | null = null;
    try {
      controller = this.#openDuel({
        duelId: start.duelId,
        player: start.player,
        opponent: start.opponent,
        seed: plan.seed,
        snapshotId: plan.snapshotId,
        promptIdNamespace: start.promptIdNamespace,
        opponentPolicy: new ReplayOpponentPolicy(
          opponentResponses,
          new BasicOpponentPolicy(resources.dependencies),
        ),
        publishTrace: (trace) => {
          if (handedOver) this.#lastTrace = trace;
        },
      });
      if (controller === null) return;
      let advance = controller.advance();
      for (const response of humanResponses) {
        if (advance.prompt?.id !== response.promptId) {
          throw new ReplayDivergenceError(
            `Replay expected to answer ${response.promptId} but the rebuilt duel asked ${advance.prompt?.id ?? "nothing"}`,
          );
        }
        advance = controller.respond(response.promptId, response.choiceIds);
      }
      const prompt = advance.prompt;
      if (prompt === undefined || prompt.id !== plan.stopAtPromptId) {
        throw new ReplayDivergenceError(
          `Replay expected to stop at ${plan.stopAtPromptId} but the rebuilt duel asked ${prompt?.id ?? "nothing"}`,
        );
      }
      /* Disposal during the replay cannot reach a controller the runtime does
         not hold yet, so the last word on whether this session lives belongs
         here rather than to `dispose`. */
      if (this.#disposed) {
        controller.dispose();
        return;
      }
      handedOver = true;
      this.#controller = controller;
      this.#lastTrace = controller.trace();
      events.push(
        { type: "restored" },
        { type: "state", state: advance.state },
        { type: "prompt", prompt },
      );
    } catch (error) {
      const reason: RestoreFailureReason =
        error instanceof ReplayDivergenceError
          ? "replay_diverged"
          : "replay_failed";
      this.#logger.error({
        event: "duel.worker.restore.failed",
        runtimeId: this.#runtimeId,
        reason,
        replayedResponses: plan.responses.length,
        err: routineLogError(error),
      });
      /* Disposal failure is the one case that escapes as an ordinary command
         error: the core handle is then in an unknown state and the Worker has
         to be replaced, which outranks keeping the previous error on screen. */
      if (controller !== null) this.#disposeController(controller, "restore");
      const detail = toDuelError(error).message.slice(
        0,
        MAXIMUM_RESTORE_DETAIL_LENGTH,
      );
      events.push({
        type: "restore_failed",
        reason,
        ...(detail.length === 0 ? {} : { detail }),
      });
    }
  }

  /** Whether a `restore` command sent right now would be accepted. */
  #canRestore(): boolean {
    return (
      !this.#disposed &&
      !this.#replacementRequired &&
      this.#controller === null &&
      this.#lastStart !== null &&
      this.#lastTrace !== null &&
      buildRestorePlan(this.#lastTrace) !== null
    );
  }

  #recordAdvance(
    controller: HeadlessDuelController,
    advance: DuelAdvance,
    events: DuelWorkerEvent[],
  ): void {
    events.push(...this.#advanceEvents(advance));
    if (advance.result !== undefined || controller.disposed) {
      this.#lastTrace = controller.trace();
      this.#controller = null;
    }
  }

  #advanceEvents(advance: DuelAdvance): DuelWorkerEvent[] {
    const events: DuelWorkerEvent[] = advance.events.map((event) => {
      if (this.#nextEventSequence === Number.MAX_SAFE_INTEGER) {
        throw duelOperationError(
          "engine_error",
          "Duel presentation event sequence exhausted",
        );
      }
      this.#nextEventSequence += 1;
      return {
        type: "event",
        eventSequence: this.#nextEventSequence,
        event,
      };
    });
    events.push({ type: "state", state: advance.state });
    if (advance.prompt !== undefined)
      events.push({ type: "prompt", prompt: advance.prompt });
    if (advance.result !== undefined)
      events.push({ type: "result", result: advance.result });
    return events;
  }

  #flushDeferredDisposal(): void {
    const controller = this.#deferredControllerDisposal;
    this.#deferredControllerDisposal = null;
    if (controller !== null)
      this.#disposeController(controller, "deferred_runtime_disposal");
  }

  #disposeController(controller: HeadlessDuelController, reason: string): void {
    try {
      controller.dispose();
    } catch (error) {
      this.#replacementRequired = true;
      this.#logger.error({
        event: "duel.worker.session.cleanup.failed",
        runtimeId: this.#runtimeId,
        reason,
        err: error,
      });
      throw error;
    }
  }

  #reportFailure(
    error: unknown,
    context: DuelRuntimeFailureContext,
    failureSink?: DuelRuntimeFailureSink,
  ): void {
    if (failureSink !== undefined) {
      failureSink(error, context);
      return;
    }
    this.#logger.error({
      event: "duel.worker.command.failed",
      commandType: context.commandType,
      code: context.code,
      runtimeId: context.runtimeId,
      ...(context.traceMetadata === undefined
        ? {}
        : { traceMetadata: context.traceMetadata }),
      ...(context.traceTail === undefined
        ? {}
        : { traceTail: context.traceTail }),
      err: routineLogError(error),
    });
  }

  #diagnosticTrace(): DuelDiagnosticTrace {
    const resources = this.#requireResources();
    const trace = this.#controller?.trace() ?? this.#lastTrace;
    if (trace === null)
      throw duelOperationError(
        "duel_not_active",
        "No duel diagnostics are available yet",
      );
    const lastMessageType = [...trace.entries]
      .reverse()
      .find(
        ({ kind, messageType }) =>
          kind === "message" && messageType !== undefined,
      )?.messageType;
    const lastPrompt = [...trace.entries]
      .reverse()
      .find(
        ({ kind, promptId }) => kind === "prompt" && promptId !== undefined,
      );
    const promptAnswered =
      lastPrompt?.promptId === undefined
        ? true
        : trace.entries.some(
            ({ sequence, kind, promptId }) =>
              sequence > lastPrompt.sequence &&
              kind === "response" &&
              promptId === lastPrompt.promptId,
          );
    return Object.freeze({
      schemaVersion: 2,
      sensitivity: "contains-production-seed",
      presetId: trace.presetId,
      snapshotId: trace.snapshotId,
      seed: trace.seed,
      coreVersion: resources.adapter.getVersion(),
      revisions: Object.freeze({
        enginePackage: "ocgcore-wasm",
        engineVersion: "0.1.2",
        babelCdb: resources.revisions?.babelCdb ?? "identified-by-snapshot",
        cardScripts:
          resources.revisions?.cardScripts ?? "identified-by-snapshot",
        distribution:
          resources.revisions?.distribution ?? "identified-by-snapshot",
        activeImageManifestSha256:
          resources.revisions?.activeImageManifestSha256 ??
          "identified-by-snapshot",
      }),
      entries: trace.entries,
      ...(lastMessageType === undefined ? {} : { lastMessageType }),
      ...(lastPrompt?.promptId === undefined || promptAnswered
        ? {}
        : { pendingPromptId: lastPrompt.promptId }),
    });
  }

  get replacementRequired(): boolean {
    return this.#replacementRequired;
  }

  diagnosticTrace(): DuelDiagnosticTrace | null {
    try {
      return this.#diagnosticTrace();
    } catch {
      return null;
    }
  }

  #requireResources(): DuelRuntimeResources {
    if (this.#resources === null) {
      throw duelOperationError(
        "engine_initialization_failed",
        "Worker must be initialized before starting a duel",
      );
    }
    return this.#resources;
  }

  #requireController(): HeadlessDuelController {
    if (this.#controller === null) {
      throw duelOperationError("duel_not_active", "No active duel session");
    }
    return this.#controller;
  }
}
