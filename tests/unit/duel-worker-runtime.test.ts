import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import {
  DuelOperationError,
  duelOperationError,
  type DuelErrorCode,
} from "../../src/duel/contracts/duel-error.ts";
import {
  createFakeOcgCoreAdapter,
  FAKE_DEPENDENCIES,
  FAKE_PRESET,
  FAKE_SNAPSHOT_ID,
} from "../fixtures/fake-ocgcore-adapter.ts";
import type { DuelRuntimeResources } from "../../src/worker/DuelWorkerRuntime.ts";
import {
  DuelWorkerRuntime,
  toDuelError,
} from "../../src/worker/DuelWorkerRuntime.ts";
import { EngineInitializationError } from "../../src/worker/engine/OcgCoreAdapter.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
  EngineProcess,
} from "../../src/worker/engine/engine-constants.ts";

const WIN_MESSAGE = {
  type: EngineMessageType.WIN,
  player: 1,
  reason: 1,
} as const;

const counterReconciliationFailureProgram = () => ({
  steps: [
    {
      status: EngineProcess.WAITING,
      messages: [
        {
          type: EngineMessageType.REMOVE_COUNTER,
          counter_type: 1,
          controller: 0 as const,
          location: EngineLocation.MONSTER,
          sequence: 0,
          count: 1,
        },
      ],
    },
  ],
});

const reconciliationFailureProgram = () => ({
  steps: [
    {
      status: EngineProcess.WAITING,
      messages: [
        {
          type: EngineMessageType.MOVE,
          card: 97590747,
          from: {
            controller: 0 as const,
            location: EngineLocation.DECK,
            sequence: 0,
            position: EnginePosition.FACE_DOWN_DEFENSE,
          },
          to: {
            controller: 0 as const,
            location: EngineLocation.MONSTER,
            sequence: 0,
            position: EnginePosition.FACE_UP_ATTACK,
          },
        },
        {
          type: EngineMessageType.MOVE,
          card: 5053103,
          from: {
            controller: 0 as const,
            location: EngineLocation.DECK,
            sequence: 1,
            position: EnginePosition.FACE_DOWN_DEFENSE,
          },
          to: {
            controller: 0 as const,
            location: EngineLocation.MONSTER,
            sequence: 0,
            position: EnginePosition.FACE_UP_ATTACK,
            overlay_sequence: 0,
          },
        },
      ],
    },
  ],
});

describe("DuelWorkerRuntime command lifecycle", () => {
  it("does not report a terminal controller failure as recoverable input", () => {
    expect(
      toDuelError(new Error("No supported basic opponent choice"), {
        terminal: true,
      }),
    ).toMatchObject({ code: "engine_error", recoverable: false });
  });

  it.each([
    ["Core exceeded 2 process iterations", "process_timeout"],
    [
      "ocgcore is waiting but emitted no supported player prompt",
      "unsupported_message",
    ],
    ["Stale or unknown prompt ID: duel-1-prompt-1", "stale_prompt"],
    ["No active duel session", "duel_not_active"],
  ] as const)("classifies %s", (message, code) => {
    expect(
      toDuelError(duelOperationError(code as DuelErrorCode, message)),
    ).toMatchObject({ code });
  });

  it("serializes concurrent commands, initializes once, and permits restart after completion", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({
      steps: [
        {
          status: EngineProcess.END,
          messages: [WIN_MESSAGE],
        },
      ],
    }));
    const resources = createResources(harness.adapter);
    const initialization = deferred<DuelRuntimeResources>();
    const initializeResources = vi.fn(() => initialization.promise);
    const runtime = new DuelWorkerRuntime(initializeResources);

    const firstInitialize = runtime.handle({ type: "initialize" });
    const secondInitialize = runtime.handle({ type: "initialize" });
    const firstStart = runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });

    await Promise.resolve();
    expect(initializeResources).toHaveBeenCalledTimes(1);
    expect(harness.counters.createDuel).toBe(0);
    initialization.resolve(resources);

    await expect(firstInitialize).resolves.toEqual([
      {
        type: "ready",
        coreVersion: [11, 0],
        snapshotId: FAKE_SNAPSHOT_ID,
      },
    ]);
    await expect(secondInitialize).resolves.toEqual([
      {
        type: "ready",
        coreVersion: [11, 0],
        snapshotId: FAKE_SNAPSHOT_ID,
      },
    ]);
    expect((await firstStart).at(-1)).toEqual({
      type: "result",
      result: { type: "completed", winner: 1, loser: 0, reason: 1 },
    });
    expect(harness.counters).toEqual({ createDuel: 1, destroyDuel: 1 });

    const restarted = await runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    expect(restarted.at(-1)).toEqual({
      type: "result",
      result: { type: "completed", winner: 1, loser: 0, reason: 1 },
    });
    expect(harness.counters).toEqual({ createDuel: 2, destroyDuel: 2 });
    runtime.dispose();
  });

  it("allocates event sequences monotonically and resets them for each duel session", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({
      steps: [
        {
          status: EngineProcess.END,
          messages: [
            { type: EngineMessageType.NEW_TURN, player: 0 as const },
            { type: EngineMessageType.NEW_PHASE, phase: 4 },
            WIN_MESSAGE,
          ],
        },
      ],
    }));
    const runtime = new DuelWorkerRuntime(async () =>
      createResources(harness.adapter),
    );
    await runtime.handle({ type: "initialize" });

    const first = await runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    expect(
      first
        .filter((event) => event.type === "event")
        .map(({ eventSequence }) => eventSequence),
    ).toEqual([1, 2]);

    const second = await runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    expect(
      second
        .filter((event) => event.type === "event")
        .map(({ eventSequence }) => eventSequence),
    ).toEqual([1, 2]);
    runtime.dispose();
  });

  it("streams initialization progress before ready", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }));
    const initialization = deferred<DuelRuntimeResources>();
    const runtime = new DuelWorkerRuntime((progress) => {
      progress("manifest", 0.25);
      return initialization.promise;
    });
    const progressEvents: unknown[] = [];

    const pending = runtime.handle({ type: "initialize" }, (event) => {
      progressEvents.push(event);
    });
    await Promise.resolve();

    expect(progressEvents).toEqual([
      { type: "loading", stage: "manifest", progress: 0.25 },
    ]);
    initialization.resolve(createResources(harness.adapter));
    await expect(pending).resolves.toEqual([
      {
        type: "ready",
        coreVersion: [11, 0],
        snapshotId: FAKE_SNAPSHOT_ID,
      },
    ]);
    runtime.dispose();
  });

  it("invalidates a pending initialization and suppresses late events when disposed", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }));
    const initialization = deferred<DuelRuntimeResources>();
    let initializationSignal: AbortSignal | undefined;
    const initializeResources = vi.fn(
      (_progress: unknown, signal: AbortSignal) => {
        initializationSignal = signal;
        return initialization.promise;
      },
    );
    const runtime = new DuelWorkerRuntime(initializeResources);

    const pending = runtime.handle({ type: "initialize" });
    await Promise.resolve();
    expect(initializeResources).toHaveBeenCalledTimes(1);
    expect(initializationSignal?.aborted).toBe(false);

    await expect(runtime.handle({ type: "dispose" })).resolves.toEqual([]);
    expect(initializationSignal?.aborted).toBe(true);
    initialization.resolve(createResources(harness.adapter));

    await expect(pending).resolves.toEqual([]);
    await expect(runtime.handle({ type: "initialize" })).resolves.toEqual([]);
    expect(harness.counters).toEqual({ createDuel: 0, destroyDuel: 0 });
  });

  it("cleans a provisional session when diagnostic logging disposes the runtime", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }), {
      createDiagnostic: { type: 1, message: "fake diagnostic" },
    });
    const runtimeRef: { current?: DuelWorkerRuntime } = {};
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(() => runtimeRef.current?.dispose()),
      error: vi.fn(),
    };
    const runtime = new DuelWorkerRuntime(
      async () => createResources(harness.adapter),
      { logger },
    );
    runtimeRef.current = runtime;
    await runtime.handle({ type: "initialize" });

    await expect(
      runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id }),
    ).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "duel.worker.engine.session.diagnostic",
        message: "fake diagnostic",
      }),
    );
    expect(harness.counters).toEqual({ createDuel: 1, destroyDuel: 1 });
    expect(harness.activeHandles()).toBe(0);
  });

  it("retains engine diagnostics in the downloadable bounded trace", async () => {
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.END,
            messages: [WIN_MESSAGE],
          },
        ],
      }),
      { createDiagnostic: { type: 7, message: "fixture core diagnostic" } },
    );
    const runtime = new DuelWorkerRuntime(
      async () => createResources(harness.adapter),
      {
        logger: {
          debug: vi.fn(),
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        },
      },
    );
    await runtime.handle({ type: "initialize" });
    await runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id });

    const [diagnostics] = await runtime.handle({ type: "requestDiagnostics" });
    expect(diagnostics).toMatchObject({
      type: "diagnostics",
      trace: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            kind: "engineDiagnostic",
            diagnosticType: 7,
            detail: "engine diagnostic emitted",
          }),
        ]),
      },
    });
    runtime.dispose();
  });

  it("defers reentrant diagnostic disposal until core processing unwinds", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({
      steps: [
        {
          status: EngineProcess.WAITING,
          diagnostic: { type: 1, message: "process diagnostic" },
          messages: [
            {
              type: EngineMessageType.SELECT_YES_NO,
              player: 0,
              description: 0n,
            },
          ],
        },
      ],
    }));
    const runtimeRef: { current?: DuelWorkerRuntime } = {};
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(() => runtimeRef.current?.dispose()),
      error: vi.fn(),
    };
    const runtime = new DuelWorkerRuntime(
      async () => createResources(harness.adapter),
      { logger },
    );
    runtimeRef.current = runtime;
    await runtime.handle({ type: "initialize" });

    await expect(
      runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id }),
    ).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: "process diagnostic" }),
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(harness.counters).toEqual({ createDuel: 1, destroyDuel: 1 });
    expect(harness.activeHandles()).toBe(0);
  });

  it("logs direct runtime disposal failures before propagating them", async () => {
    const cleanupError = new Error("fake runtime cleanup failure");
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [
          {
            status: EngineProcess.WAITING,
            messages: [
              {
                type: EngineMessageType.SELECT_YES_NO,
                player: 0,
                description: 0n,
              },
            ],
          },
        ],
      }),
      { destroyError: cleanupError },
    );
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const runtime = new DuelWorkerRuntime(
      async () => createResources(harness.adapter),
      { logger },
    );
    await runtime.handle({ type: "initialize" });
    await runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id });

    expect(() => runtime.dispose()).toThrow(cleanupError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "duel.worker.session.cleanup.failed",
        err: cleanupError,
      }),
    );
    expect(harness.counters.destroyDuel).toBe(1);
  });

  it("poisons the runtime after uncertain core-handle cleanup", async () => {
    const harness = await createFakeOcgCoreAdapter(
      () => ({
        steps: [{ status: EngineProcess.END, messages: [WIN_MESSAGE] }],
      }),
      { destroyError: new Error("uncertain destroy") },
    );
    const runtime = new DuelWorkerRuntime(async () =>
      createResources(harness.adapter),
    );
    await runtime.handle({ type: "initialize" });

    const failed = await runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    expect(failed).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ recoverable: false }),
      }),
    ]);
    expect(runtime.replacementRequired).toBe(true);
    await expect(
      runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id }),
    ).resolves.toEqual([]);
  });

  it("bounds the pending command queue while initialization is blocked", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }));
    const initialization = deferred<DuelRuntimeResources>();
    const runtime = new DuelWorkerRuntime(() => initialization.promise, {
      maximumQueuedCommands: 1,
    });

    const pending = runtime.handle({ type: "initialize" });
    await Promise.resolve();
    const overflow = await runtime.handle({ type: "initialize" });
    expect(overflow).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          code: "invalid_command",
          recoverable: true,
        }),
      }),
    ]);

    await runtime.handle({ type: "dispose" });
    initialization.resolve(createResources(harness.adapter));
    await expect(pending).resolves.toEqual([]);
  });

  it("preserves typed initialization errors and reports invalid lifecycle commands", async () => {
    const initializationError = new EngineInitializationError({
      code: "engine_initialization_failed",
      message: "fake initialization failure",
      recoverable: false,
    });
    const initializeResources = vi.fn(async () => {
      throw initializationError;
    });
    const runtime = new DuelWorkerRuntime(initializeResources);

    const initialized = await runtime.handle({ type: "initialize" });
    expect(initialized).toEqual([
      {
        type: "error",
        error: initializationError.duelError,
      },
    ]);

    expect(await runtime.handle({ type: "initialize" })).toEqual(initialized);
    expect(initializeResources).toHaveBeenCalledTimes(1);

    const surrendered = await runtime.handle({ type: "surrender" });
    expect(surrendered).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          code: "duel_not_active",
          recoverable: true,
        }),
      }),
    ]);
    runtime.dispose();
  });

  it("returns a bounded sensitive diagnostic trace after completion", async () => {
    const harness = await createFakeOcgCoreAdapter(() => ({
      steps: [
        {
          status: EngineProcess.END,
          messages: [WIN_MESSAGE],
        },
      ],
    }));
    const runtime = new DuelWorkerRuntime(async () => ({
      ...createResources(harness.adapter),
      revisions: {
        babelCdb: "babel-revision",
        cardScripts: "script-revision",
        distribution: "string-revision",
        activeImageManifestSha256: "f".repeat(64),
      },
    }));
    await runtime.handle({ type: "initialize" });
    await runtime.handle({ type: "startDuel", duelId: FAKE_PRESET.id });

    const [diagnostics] = await runtime.handle({ type: "requestDiagnostics" });
    expect(diagnostics).toMatchObject({
      type: "diagnostics",
      trace: {
        schemaVersion: 2,
        sensitivity: "contains-production-seed",
        snapshotId: FAKE_SNAPSHOT_ID,
        coreVersion: [11, 0],
        revisions: {
          babelCdb: "babel-revision",
          activeImageManifestSha256: "f".repeat(64),
        },
      },
    });
    if (diagnostics?.type !== "diagnostics")
      throw new Error("Expected diagnostics event");
    expect(diagnostics.trace.seed).toHaveLength(4);
    expect(diagnostics.trace.entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(diagnostics.trace)).not.toContain("wasmBinary");
    runtime.dispose();
  });

  it("keeps reconciliation causes internal while routine Worker logs stay sanitized", async () => {
    const hiddenSentinel = "private-reconciliation-card-5053103";
    const harness = await createFakeOcgCoreAdapter(
      reconciliationFailureProgram,
      {
        queryCard: () => {
          throw new Error(hiddenSentinel);
        },
      },
    );

    const internalRuntime = new DuelWorkerRuntime(async () =>
      createResources(harness.adapter),
    );
    await internalRuntime.handle({ type: "initialize" });
    let internalFailure: unknown;
    const internalEvents = await internalRuntime.handle(
      { type: "startDuel", duelId: FAKE_PRESET.id },
      undefined,
      (error) => {
        internalFailure = error;
      },
    );
    expect(internalFailure).toBeInstanceOf(DuelOperationError);
    expect(inspect(internalFailure, { depth: 8 })).toContain(hiddenSentinel);
    expect(JSON.stringify(internalEvents)).not.toContain(hiddenSentinel);
    const internalTrace = await internalRuntime.handle({
      type: "requestDiagnostics",
    });
    expect(JSON.stringify(internalTrace)).not.toContain(hiddenSentinel);
    internalRuntime.dispose();

    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const loggedRuntime = new DuelWorkerRuntime(
      async () => createResources(harness.adapter),
      { logger },
    );
    await loggedRuntime.handle({ type: "initialize" });
    const publicEvents = await loggedRuntime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    const publicTrace = await loggedRuntime.handle({
      type: "requestDiagnostics",
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "duel.worker.command.failed",
        err: expect.objectContaining({
          name: "DuelOperationError",
          message: "Unable to reconcile overlayMaterials state",
          code: "unsupported_message",
        }),
      }),
    );
    expect(inspect(logger.error.mock.calls, { depth: 8 })).not.toContain(
      hiddenSentinel,
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      hiddenSentinel,
    );
    expect(JSON.stringify([publicEvents, publicTrace])).not.toContain(
      hiddenSentinel,
    );
    loggedRuntime.dispose();
  });

  it("sanitizes reconciliation causes nested by cleanup failure in routine logs", async () => {
    const hiddenSentinel = "private-structural-cause-5053103";
    const cleanupMessage = "expected unrelated cleanup failure";
    const internalCleanup = new Error(cleanupMessage);
    const internalHarness = await createFakeOcgCoreAdapter(
      counterReconciliationFailureProgram,
      {
        destroyError: internalCleanup,
        queryCard: () => {
          throw new Error(hiddenSentinel);
        },
      },
    );
    const internalRuntime = new DuelWorkerRuntime(async () =>
      createResources(internalHarness.adapter),
    );
    await internalRuntime.handle({ type: "initialize" });
    let internalFailure: unknown;
    const internalEvents = await internalRuntime.handle(
      { type: "startDuel", duelId: FAKE_PRESET.id },
      undefined,
      (error) => {
        internalFailure = error;
      },
    );
    expect(internalFailure).toBeInstanceOf(AggregateError);
    const aggregate = internalFailure as AggregateError;
    expect(aggregate.errors[0]).toBeInstanceOf(DuelOperationError);
    expect(aggregate.errors[1]).toBe(internalCleanup);
    expect(inspect(aggregate, { depth: 8 })).toContain(hiddenSentinel);
    expect(JSON.stringify(internalEvents)).toContain(
      "Unable to reconcile counters state",
    );
    expect(JSON.stringify(internalEvents)).not.toContain(hiddenSentinel);
    expect(JSON.stringify(internalEvents)).not.toContain(cleanupMessage);
    const internalTrace = await internalRuntime.handle({
      type: "requestDiagnostics",
    });
    expect(JSON.stringify(internalTrace)).not.toContain(hiddenSentinel);

    const loggedCleanup = new Error(cleanupMessage);
    const loggedHarness = await createFakeOcgCoreAdapter(
      counterReconciliationFailureProgram,
      {
        destroyError: loggedCleanup,
        queryCard: () => {
          throw new Error(hiddenSentinel);
        },
      },
    );
    const logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const loggedRuntime = new DuelWorkerRuntime(
      async () => createResources(loggedHarness.adapter),
      { logger },
    );
    await loggedRuntime.handle({ type: "initialize" });
    const publicEvents = await loggedRuntime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    const publicTrace = await loggedRuntime.handle({
      type: "requestDiagnostics",
    });
    const commandFailure = logger.error.mock.calls.find(
      ([entry]) => entry.event === "duel.worker.command.failed",
    );
    expect(commandFailure).toBeDefined();
    const loggedError = commandFailure?.[0].err as {
      readonly errors: readonly unknown[];
    };
    expect(Object.isFrozen(loggedError)).toBe(true);
    expect(Object.isFrozen(loggedError.errors)).toBe(true);
    expect(loggedError.errors[1]).toBe(loggedCleanup);
    expect(inspect(logger.error.mock.calls, { depth: 8 })).toContain(
      cleanupMessage,
    );
    expect(inspect(logger.error.mock.calls, { depth: 8 })).not.toContain(
      hiddenSentinel,
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      hiddenSentinel,
    );
    expect(JSON.stringify(publicEvents)).toContain(
      "Unable to reconcile counters state",
    );
    expect(JSON.stringify(publicEvents)).not.toContain(cleanupMessage);
    expect(JSON.stringify([publicEvents, publicTrace])).not.toContain(
      hiddenSentinel,
    );
  });

  it("releases a failed controller so a later duel can start cleanly", async () => {
    let duelNumber = 0;
    const harness = await createFakeOcgCoreAdapter(() => {
      duelNumber += 1;
      return duelNumber === 1
        ? { steps: [{ error: new Error("fake engine failure") }] }
        : {
            steps: [
              {
                status: EngineProcess.END,
                messages: [WIN_MESSAGE],
              },
            ],
          };
    });
    const runtime = new DuelWorkerRuntime(async () =>
      createResources(harness.adapter),
    );
    await runtime.handle({ type: "initialize" });

    const failures: { error: unknown; code: string }[] = [];
    const failed = await runtime.handle(
      {
        type: "startDuel",
        duelId: FAKE_PRESET.id,
      },
      undefined,
      (error, context) => failures.push({ error, code: context.code }),
    );
    expect(failed).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ code: "engine_error" }),
      }),
    ]);
    expect(harness.counters).toEqual({ createDuel: 1, destroyDuel: 1 });
    expect(failures).toEqual([
      { error: expect.any(Error), code: "engine_error" },
    ]);

    const restarted = await runtime.handle({
      type: "startDuel",
      duelId: FAKE_PRESET.id,
    });
    expect(restarted.at(-1)).toEqual({
      type: "result",
      result: { type: "completed", winner: 1, loser: 0, reason: 1 },
    });
    expect(harness.counters).toEqual({ createDuel: 2, destroyDuel: 2 });
    runtime.dispose();
  });
});

function createResources(
  adapter: DuelRuntimeResources["adapter"],
): DuelRuntimeResources {
  return {
    adapter,
    dependencies: FAKE_DEPENDENCIES,
    preset: FAKE_PRESET,
    snapshotId: FAKE_SNAPSHOT_ID,
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill;
  });
  return { promise, resolve };
}
