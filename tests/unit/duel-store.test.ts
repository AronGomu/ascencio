import { describe, expect, it } from "vitest";
import type { DuelWorkerEvent } from "../../src/duel/contracts/duel-worker-event.ts";
import {
  cardInstanceId,
  choiceId,
  promptId,
  snapshotId,
} from "../../src/duel/contracts/ids.ts";
import type { PublicDuelState } from "../../src/duel/contracts/public-duel-state.ts";
import type {
  DuelClient,
  DuelClientContext,
  DuelClientEvent,
} from "../../src/app/DuelWorkerClient.ts";
import {
  createDuelStore,
  createInitialDuelViewState,
  reduceDuelViewState,
} from "../../src/app/stores/duel-store.ts";

const CONTEXT: DuelClientContext = {
  workerGeneration: 2,
  sessionGeneration: 4,
};

const STATE: PublicDuelState = {
  snapshotId: snapshotId("a".repeat(64)),
  revision: 1,
  turn: 1,
  turnPlayer: 0,
  phase: "main1",
  players: [
    {
      player: 0,
      lifePoints: 8000,
      deckCount: 35,
      extraDeckCount: 0,
      handCount: 5,
      hand: [
        {
          instanceId: cardInstanceId("human-card"),
          owner: 0,
          controller: 0,
          location: "hand",
          sequence: 0,
          position: "faceDownDefense",
          faceUp: false,
          counters: [],
          overlayMaterials: [],
        },
      ],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
    {
      player: 1,
      lifePoints: 8000,
      deckCount: 35,
      extraDeckCount: 0,
      handCount: 5,
      hand: [],
      extraDeck: [],
      monsters: [],
      spellsAndTraps: [],
      graveyard: [],
      banished: [],
    },
  ],
  chain: [],
};

const PROMPT_EVENT: DuelWorkerEvent = {
  type: "prompt",
  prompt: {
    id: promptId("prompt-current"),
    kind: "selectCard",
    player: 0,
    title: "Select a card",
    choices: [
      { id: choiceId("choice-current"), label: "Card", action: "select" },
    ],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
  },
};

function apply(
  state: ReturnType<typeof createInitialDuelViewState>,
  event: DuelWorkerEvent,
  context: DuelClientContext = CONTEXT,
): ReturnType<typeof createInitialDuelViewState> {
  return reduceDuelViewState(state, { context, event });
}

class FakeDuelClient implements DuelClient {
  context: DuelClientContext = { workerGeneration: 1, sessionGeneration: 0 };
  readonly #listeners = new Set<(event: DuelClientEvent) => void>();
  replaceFailure: Error | null = null;
  initializeResult = true;
  respondResult = true;
  readonly respondCalls: Array<{
    readonly promptId: string;
    readonly choiceIds: readonly string[];
  }> = [];

  subscribe(listener: (event: DuelClientEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: DuelWorkerEvent): void {
    for (const listener of this.#listeners)
      listener({ context: this.context, event });
  }

  initialize(): boolean {
    return this.initializeResult;
  }

  startDuel(): DuelClientContext {
    this.context = {
      ...this.context,
      sessionGeneration: this.context.sessionGeneration + 1,
    };
    return this.context;
  }

  respond(
    prompt: Parameters<DuelClient["respond"]>[0],
    choiceIds: Parameters<DuelClient["respond"]>[1],
  ): boolean {
    this.respondCalls.push({ promptId: prompt, choiceIds: [...choiceIds] });
    return this.respondResult;
  }

  surrender(): boolean {
    return true;
  }

  requestDiagnostics(): boolean {
    return true;
  }

  async replace(): Promise<{ readonly graceful: boolean }> {
    if (this.replaceFailure !== null) throw this.replaceFailure;
    this.context = {
      workerGeneration: this.context.workerGeneration + 1,
      sessionGeneration: 0,
    };
    return { graceful: true };
  }

  async dispose(): Promise<{ readonly graceful: boolean }> {
    return { graceful: true };
  }
}

describe("duel view-state reducer", () => {
  it("projects ordered Worker events into loading, active, input, and result states", () => {
    let view = createInitialDuelViewState(CONTEXT);
    view = apply(view, { type: "loading", stage: "engine", progress: 0.5 });
    expect(view).toMatchObject({
      status: "loading",
      loading: { stage: "engine", progress: 0.5 },
    });

    view = apply(view, { type: "ready", coreVersion: [11, 0] });
    expect(view).toMatchObject({ status: "idle", coreVersion: [11, 0] });

    view = apply(view, { type: "state", state: STATE });
    expect(view).toMatchObject({ status: "active", snapshot: STATE });

    view = apply(view, PROMPT_EVENT);
    expect(view).toMatchObject({
      status: "awaiting-input",
      prompt: PROMPT_EVENT.prompt,
      responsePending: false,
    });

    view = apply(view, {
      type: "result",
      result: { type: "completed", winner: 0, loser: 1, reason: 1 },
    });
    expect(view).toMatchObject({
      status: "completed",
      prompt: null,
      result: { type: "completed", winner: 0 },
    });
  });

  it("keeps the submitted prompt disabled across the intermediate state event", () => {
    let view = apply(createInitialDuelViewState(CONTEXT), PROMPT_EVENT);
    view = { ...view, status: "active", responsePending: true };
    view = apply(view, { type: "state", state: STATE });
    expect(view).toMatchObject({
      status: "active",
      prompt: PROMPT_EVENT.prompt,
      responsePending: true,
    });
  });

  it("ignores stale Worker/session generations", () => {
    const initial = createInitialDuelViewState(CONTEXT);
    const stale = apply(initial, PROMPT_EVENT, {
      workerGeneration: 1,
      sessionGeneration: 99,
    });
    expect(stale).toBe(initial);
  });

  it("clears prompt, result, error, snapshot, and transient log for a new session", () => {
    let view = createInitialDuelViewState(CONTEXT);
    view = apply(view, { type: "state", state: STATE });
    view = apply(view, PROMPT_EVENT);
    view = apply(view, {
      type: "event",
      eventSequence: 1,
      event: { type: "phaseChanged", phase: "main1" },
    });
    view = apply(view, {
      type: "error",
      error: {
        code: "invalid_response",
        message: "Old recoverable error",
        recoverable: true,
      },
    });

    const next = createInitialDuelViewState({
      workerGeneration: 2,
      sessionGeneration: 5,
    });
    expect(next).toMatchObject({
      status: "idle",
      snapshot: null,
      prompt: null,
      result: null,
      error: null,
      presentationEvents: [],
      duelLog: [],
      lastAcceptedEventSequence: 0,
      nextPresentationSequence: 1,
      nextLogSequence: 1,
    });
    expect(next.context).not.toEqual(view.context);
  });

  it("keeps 100 transient events while retaining approved semantic rows", () => {
    let view = createInitialDuelViewState(CONTEXT);
    for (let index = 1; index <= 101; index += 1) {
      view = apply(view, {
        type: "event",
        eventSequence: index,
        event: { type: "phaseChanged", phase: "main1" },
      });
    }
    expect(view.presentationEvents).toHaveLength(100);
    expect(view.presentationEvents[0]?.sequence).toBe(2);
    expect(view.presentationEvents.at(-1)?.sequence).toBe(101);
    expect(view.duelLog).toHaveLength(101);
    expect(view.duelLog[0]).toMatchObject({
      kind: "activity",
      logSequence: 1,
      sourceType: "phaseChanged",
    });
    expect(view.duelLog.at(-1)).toMatchObject({ logSequence: 101 });
  });

  it("keeps hints transient instead of retaining arbitrary text", () => {
    let view = createInitialDuelViewState(CONTEXT);
    for (let index = 1; index <= 125; index += 1) {
      view = apply(view, {
        type: "event",
        eventSequence: index,
        event: { type: "hint", message: `Event ${index}` },
      });
    }
    expect(view.presentationEvents).toHaveLength(100);
    expect(view.presentationEvents[0]).toEqual({
      sequence: 26,
      event: { type: "hint", message: "Event 26" },
    });
    expect(view.presentationEvents.at(-1)?.sequence).toBe(125);
    expect(view.duelLog).toEqual([]);
    expect(view.nextLogSequence).toBe(1);
  });

  it("deduplicates deliveries by event sequence without deduplicating equal payloads", () => {
    const initial = createInitialDuelViewState(CONTEXT);
    const firstEvent: DuelWorkerEvent = {
      type: "event",
      eventSequence: 1,
      event: { type: "cardDrawn", player: 0, count: 1 },
    };
    const first = apply(initial, firstEvent);
    expect(first.duelLog[0]).toEqual({
      kind: "activity",
      logSequence: 1,
      sourceType: "cardDrawn",
      text: "You drew 1 card.",
    });
    expect(first.duelLog[0]).not.toHaveProperty("event");
    expect(first.duelLog[0]).not.toHaveProperty("eventSequence");
    const replay = apply(first, structuredClone(firstEvent));
    expect(replay).toBe(first);

    const second = apply(first, { ...firstEvent, eventSequence: 2 });
    expect(second.presentationEvents).toHaveLength(2);
    expect(second.duelLog).toHaveLength(2);
    expect(second).toMatchObject({
      lastAcceptedEventSequence: 2,
      nextPresentationSequence: 3,
      nextLogSequence: 3,
    });

    const duplicateState = apply(
      apply(second, { type: "state", state: STATE }),
      {
        type: "state",
        state: STATE,
      },
    );
    expect(duplicateState.duelLog).toBe(second.duelLog);
    expect(duplicateState.nextLogSequence).toBe(3);
  });

  it("caps the durable log at 2,000 total rows with one stable marker", () => {
    let view = createInitialDuelViewState(CONTEXT);
    const checkpoints = new Map<number, typeof view>();
    for (let index = 1; index <= 4_000; index += 1) {
      view = apply(view, {
        type: "event",
        eventSequence: index,
        event: { type: "phaseChanged", phase: "main1" },
      });
      if ([2_000, 2_001, 2_002, 4_000].includes(index))
        checkpoints.set(index, view);
    }

    expect(checkpoints.get(2_000)?.duelLog).toHaveLength(2_000);
    expect(checkpoints.get(2_000)?.duelLog[0]).toMatchObject({
      kind: "activity",
      logSequence: 1,
    });
    expect(checkpoints.get(2_001)?.duelLog).toHaveLength(2_000);
    expect(checkpoints.get(2_001)?.duelLog[0]).toEqual({
      kind: "truncated",
      logSequence: 0,
      omittedCount: 2,
      text: "2 earlier duel events omitted.",
    });
    expect(checkpoints.get(2_001)?.duelLog[1]).toMatchObject({
      logSequence: 3,
    });
    expect(checkpoints.get(2_002)?.duelLog[0]).toMatchObject({
      kind: "truncated",
      omittedCount: 3,
    });
    expect(checkpoints.get(2_002)?.duelLog[1]).toMatchObject({
      logSequence: 4,
    });
    expect(checkpoints.get(4_000)?.duelLog[0]).toMatchObject({
      kind: "truncated",
      omittedCount: 2_001,
    });
    expect(checkpoints.get(4_000)?.duelLog[1]).toMatchObject({
      logSequence: 2_002,
    });
    expect(checkpoints.get(4_000)?.duelLog.at(-1)).toMatchObject({
      logSequence: 4_000,
    });
    expect(
      new Set(
        checkpoints.get(4_000)?.duelLog.map(({ logSequence }) => logSequence),
      ).size,
    ).toBe(2_000);
    expect(Object.isFrozen(checkpoints.get(4_000)?.duelLog)).toBe(true);
    expect(checkpoints.get(4_000)?.duelLog.every(Object.isFrozen)).toBe(true);
    expect(JSON.stringify(checkpoints.get(4_000)?.duelLog)).not.toContain(
      "eventSequence",
    );
    expect(JSON.stringify(checkpoints.get(4_000)?.duelLog)).not.toContain(
      "instanceId",
    );
  });

  it("keeps replay and stale contexts from changing queue or allocator state", () => {
    const view = apply(createInitialDuelViewState(CONTEXT), {
      type: "event",
      eventSequence: 5,
      event: { type: "duelStarted" },
    });
    const replay = apply(view, {
      type: "event",
      eventSequence: 4,
      event: { type: "turnStarted", player: 0, turn: 1 },
    });
    expect(replay).toBe(view);
    const stale = apply(
      view,
      {
        type: "event",
        eventSequence: 6,
        event: { type: "turnStarted", player: 0, turn: 1 },
      },
      { workerGeneration: 9, sessionGeneration: 9 },
    );
    expect(stale).toBe(view);
  });

  it("resets both queues and sequence state on start and replacement paths", async () => {
    const client = new FakeDuelClient();
    const store = createDuelStore(client);
    let current = createInitialDuelViewState(client.context);
    const unsubscribe = store.subscribe((state) => {
      current = state;
    });
    client.emit({
      type: "event",
      eventSequence: 1,
      event: { type: "duelStarted" },
    });
    expect(current.duelLog).toHaveLength(1);

    expect(store.start()).toBe(true);
    expect(current).toMatchObject({
      presentationEvents: [],
      duelLog: [],
      lastAcceptedEventSequence: 0,
      nextPresentationSequence: 1,
      nextLogSequence: 1,
    });
    client.emit({
      type: "event",
      eventSequence: 1,
      event: { type: "duelStarted" },
    });
    expect(current.duelLog).toHaveLength(1);

    await expect(store.restart()).resolves.toBe(true);
    expect(current).toMatchObject({
      status: "initializing",
      presentationEvents: [],
      duelLog: [],
      lastAcceptedEventSequence: 0,
      nextPresentationSequence: 1,
      nextLogSequence: 1,
    });
    unsubscribe();
    await store.destroy();

    const failingClient = new FakeDuelClient();
    const failingStore = createDuelStore(failingClient);
    let failed = createInitialDuelViewState(failingClient.context);
    const unsubscribeFailing = failingStore.subscribe((state) => {
      failed = state;
    });
    failingClient.emit({
      type: "event",
      eventSequence: 1,
      event: { type: "duelStarted" },
    });
    failingClient.replaceFailure = new Error("replacement failed");
    await expect(failingStore.retry()).resolves.toBe(false);
    expect(failed).toMatchObject({
      status: "failed",
      presentationEvents: [],
      duelLog: [],
      lastAcceptedEventSequence: 0,
      nextPresentationSequence: 1,
      nextLogSequence: 1,
    });
    unsubscribeFailing();
    await failingStore.destroy();
  });

  it.each(["invalid_response", "stale_prompt"] as const)(
    "keeps recoverable %s errors actionable and makes terminal errors fail",
    (code) => {
      let view = apply(createInitialDuelViewState(CONTEXT), PROMPT_EVENT);
      view = {
        ...view,
        responsePending: true,
        responsePendingKey: view.interactionSession.key,
        interactionSession: {
          ...view.interactionSession,
          status: "submitting",
          selectedChoiceIds: [choiceId("choice-current")],
        },
      };
      view = apply(view, {
        type: "error",
        error: {
          code,
          message: "Choose again",
          recoverable: true,
        },
      });
      expect(view).toMatchObject({
        status: "awaiting-input",
        prompt: PROMPT_EVENT.prompt,
        responsePending: false,
        responsePendingKey: null,
        error: { recoverable: true },
        interactionSession: {
          status: "editing",
          selectedChoiceIds: [choiceId("choice-current")],
        },
      });

      view = apply(view, {
        type: "error",
        error: {
          code: "engine_error",
          message: "Core failed",
          recoverable: false,
        },
      });
      expect(view).toMatchObject({
        status: "failed",
        prompt: null,
        error: { recoverable: false },
        interactionSession: { key: null, status: "idle" },
      });
    },
  );

  it("accepts one submit across interaction and prompt-control paths", async () => {
    const client = new FakeDuelClient();
    const store = createDuelStore(client);
    let current = createInitialDuelViewState(client.context);
    const unsubscribe = store.subscribe((state) => {
      current = state;
    });
    expect(store.start()).toBe(true);
    client.emit(PROMPT_EVENT);
    const key = current.interactionSession.key;
    if (key === null) throw new Error("Expected active interaction key");

    expect(
      store.dispatchInteraction({
        type: "toggleChoice",
        key,
        choiceId: choiceId("choice-current"),
      }),
    ).toBe(true);
    expect(store.dispatchInteraction({ type: "confirm", key })).toBe(true);
    expect(store.respond([choiceId("choice-current")])).toBe(false);
    expect(client.respondCalls).toEqual([
      {
        promptId: "prompt-current",
        choiceIds: ["choice-current"],
      },
    ]);
    expect(current).toMatchObject({
      responsePending: true,
      responsePendingKey: key,
      interactionSession: { status: "submitting" },
    });

    client.emit({ type: "state", state: STATE });
    client.emit({
      type: "event",
      eventSequence: 1,
      event: { type: "phaseChanged", phase: "main1" },
    });
    client.emit(PROMPT_EVENT);
    expect(current).toMatchObject({
      responsePending: true,
      responsePendingKey: key,
      prompt: PROMPT_EVENT.prompt,
      interactionSession: { status: "submitting" },
    });
    unsubscribe();
    await store.destroy();
  });

  it("marks local submitting only after client acceptance and resets on new key/result/replacement", async () => {
    const client = new FakeDuelClient();
    const store = createDuelStore(client);
    let current = createInitialDuelViewState(client.context);
    const unsubscribe = store.subscribe((state) => {
      current = state;
    });
    store.start();
    client.emit(PROMPT_EVENT);
    const firstKey = current.interactionSession.key;
    if (firstKey === null) throw new Error("Expected active interaction key");

    client.respondResult = false;
    expect(store.respond([choiceId("choice-current")])).toBe(false);
    expect(current.interactionSession.status).toBe("editing");
    expect(current.responsePending).toBe(false);
    expect(store.respond([])).toBe(false);
    expect(client.respondCalls).toHaveLength(1);

    client.respondResult = true;
    expect(store.respond([choiceId("choice-current")])).toBe(true);
    expect(current).toMatchObject({
      responsePending: true,
      responsePendingKey: firstKey,
      interactionSession: { status: "submitting" },
    });

    const nextPrompt: DuelWorkerEvent = {
      ...PROMPT_EVENT,
      prompt: { ...PROMPT_EVENT.prompt, id: promptId("prompt-next") },
    };
    client.emit(nextPrompt);
    expect(current.interactionSession).toMatchObject({
      key: { promptId: "prompt-next" },
      status: "editing",
      selectedChoiceIds: [],
      menuTarget: null,
    });
    expect(
      store.dispatchInteraction({
        type: "toggleChoice",
        key: firstKey,
        choiceId: choiceId("choice-current"),
      }),
    ).toBe(false);
    expect(client.respondCalls).toHaveLength(2);

    client.emit({
      type: "result",
      result: { type: "completed", winner: 0, loser: 1, reason: 1 },
    });
    expect(current.interactionSession).toMatchObject({
      key: null,
      status: "idle",
    });

    await expect(store.restart()).resolves.toBe(true);
    expect(current).toMatchObject({
      responsePending: false,
      responsePendingKey: null,
      interactionSession: { key: null, status: "idle" },
    });
    unsubscribe();
    await store.destroy();
  });
});
