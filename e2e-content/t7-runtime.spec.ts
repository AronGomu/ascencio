import { expect, test } from "@playwright/test";
import type { DuelCommand } from "../src/battle/duel/contracts/duel-command.ts";
import type { DuelWorkerEvent } from "../src/battle/duel/contracts/duel-worker-event.ts";

test("Shell semantic runtime initializes real WASM Worker", async ({
  page,
}, testInfo) => {
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/");
  const evidence = await page.evaluate(async () => {
    const { createLegacyBattleRuntimeSource } = await import(
      /* @vite-ignore */ String("/src/shell/adapters/legacy-battle-runtime.ts")
    );
    const { installedDuelGameplayFixture } = await import(
      /* @vite-ignore */ String("/tests/fixtures/installed-duel-gameplay.ts")
    );
    const manifestResponse = await fetch(
      "/generated/runtime/current/manifest.json",
    );
    if (!manifestResponse.ok) throw new Error("Runtime manifest unavailable");
    const manifest = await manifestResponse.json();
    const fixture = installedDuelGameplayFixture();
    const allowedCodes = [
      ...new Set(
        fixture.decks.flatMap(
          (deck: { main: number[]; extra: number[]; side: number[] }) => [
            ...deck.main,
            ...deck.extra,
            ...deck.side,
          ],
        ),
      ),
    ];
    const gameplay = {
      ...fixture,
      cards: allowedCodes.map((code) => ({ code })),
      content: {
        ...fixture.content,
        snapshot: {
          ...fixture.content.snapshot,
          runtimeSnapshotId: manifest.snapshotId,
        },
      },
    };
    const reader = {
      close() {},
      async current() {
        return {
          kind: "ok" as const,
          value: { generation: 1, current: gameplay.content },
        };
      },
      async acquireSession() {
        return { kind: "ok" as const, value: { release() {} } };
      },
      async readFile(_pack: unknown, path: string) {
        const url =
          path === "runtime/current/manifest.json"
            ? "/generated/runtime/current/manifest.json"
            : path === "runtime/engine/ocgcore.sync.wasm"
              ? "/vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"
              : `/generated/assets/current/${path.replace("runtime/assets/current/", "")}`;
        const response = await fetch(url);
        if (!response.ok)
          return { kind: "failed" as const, code: "CONTENT_MISSING" as const };
        return {
          kind: "ok" as const,
          value: { arrayBuffer: () => response.arrayBuffer() },
        };
      },
    };
    const source = createLegacyBattleRuntimeSource(reader as never, gameplay);
    const heapBeforeBytes =
      (
        performance as Performance & {
          memory?: { usedJSHeapSize: number };
        }
      ).memory?.usedJSHeapSize ?? null;
    const sourceStarted = performance.now();
    const runtime = await source.load(new AbortController().signal);
    const sourceLoadMs = performance.now() - sourceStarted;
    const mutantWasm = runtime.wasmBinary.slice(0);
    new Uint8Array(mutantWasm)[mutantWasm.byteLength - 1]! ^= 1;
    const initializePayloadBytes = new Blob([
      JSON.stringify({
        type: "initialize",
        runtime: {
          ...runtime,
          wasmBinary: { byteLength: runtime.wasmBinary.byteLength },
        },
      }),
    ]).size;
    const transferred = runtime.wasmBinary;
    const wasmBytes = transferred.byteLength;
    const worker = new Worker("/src/battle/worker/duel.worker-browser.ts", {
      type: "module",
    });
    const send = (command: DuelCommand, terminal: DuelWorkerEvent["type"]) =>
      new Promise<DuelWorkerEvent>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Worker command timed out")),
          60_000,
        );
        const receive = (event: MessageEvent<DuelWorkerEvent>) => {
          if (event.data.type !== terminal && event.data.type !== "error")
            return;
          clearTimeout(timeout);
          worker.removeEventListener("message", receive);
          if (event.data.type === "error")
            reject(
              new Error(
                `${event.data.error.code}: ${event.data.error.message}`,
              ),
            );
          else resolve(event.data);
        };
        worker.addEventListener("message", receive);
        worker.postMessage(
          command,
          command.type === "initialize" ? [command.runtime.wasmBinary] : [],
        );
      });
    const started = performance.now();
    const ready = await send({ type: "initialize", runtime }, "ready");
    const startupMs = performance.now() - started;
    const heapAfterBytes =
      (
        performance as Performance & {
          memory?: { usedJSHeapSize: number };
        }
      ).memory?.usedJSHeapSize ?? null;
    const deck = gameplay.decks.find(
      (candidate: { id: string }) =>
        candidate.id === gameplay.defaults.starterDeckId,
    )!;
    const selection = {
      kind: "cards" as const,
      main: deck.main,
      extra: deck.extra,
      side: deck.side,
    };
    const prompt = await send(
      {
        type: "startDuel",
        duelId: "t7-browser-real-wasm" as never,
        player: selection,
        opponent: selection,
      },
      "prompt",
    );
    const result = await send({ type: "surrender" }, "result");
    worker.postMessage({ type: "dispose" });
    worker.terminate();
    const mutantWorker = new Worker(
      "/src/battle/worker/duel.worker-browser.ts",
      {
        type: "module",
      },
    );
    const mutantEvents: DuelWorkerEvent[] = [];
    let mutantTimeout: ReturnType<typeof setTimeout>;
    try {
      await new Promise<void>((resolve, reject) => {
        mutantTimeout = setTimeout(
          () => reject(new Error("Mutant Worker timed out")),
          60_000,
        );
        mutantWorker.onerror = () => reject(new Error("Mutant Worker crashed"));
        mutantWorker.onmessage = ({ data }: MessageEvent<DuelWorkerEvent>) => {
          mutantEvents.push(data);
          if (data.type === "error") resolve();
          if (data.type === "ready")
            reject(new Error("Mutant WASM reached ready"));
        };
        mutantWorker.postMessage(
          {
            type: "initialize",
            runtime: { ...runtime, wasmBinary: mutantWasm },
          },
          [mutantWasm],
        );
      });
    } finally {
      clearTimeout(mutantTimeout!);
      mutantWorker.terminate();
    }
    return {
      ready,
      promptType: prompt.type,
      result,
      snapshotId: runtime.snapshotId,
      cards: runtime.cards.length,
      scripts: runtime.scripts.length,
      allowedCards: runtime.allowedCardCodes.length,
      initializePayloadBytes,
      wasmBytes,
      detachedAfterTransfer: transferred.byteLength === 0,
      workerInitializationMs: startupMs,
      sourceLoadMs,
      mutantEvents,
      // Main renderer only; combined startup/heap comparison lives in benchmark.mjs.
      heapBeforeBytes,
      heapAfterBytes,
      heapDeltaBytes:
        heapBeforeBytes === null || heapAfterBytes === null
          ? null
          : heapAfterBytes - heapBeforeBytes,
    };
  });

  expect(evidence).toMatchObject({
    ready: { type: "ready", coreVersion: [11, 0] },
    promptType: "prompt",
    result: { type: "result", result: { type: "surrendered" } },
    detachedAfterTransfer: true,
  });
  expect(evidence.mutantEvents).toContainEqual(
    expect.objectContaining({
      type: "error",
      error: expect.objectContaining({ code: "snapshot_validation_failed" }),
    }),
  );
  expect(evidence.mutantEvents.some(({ type }) => type === "ready")).toBe(
    false,
  );
  expect(evidence.cards).toBeGreaterThan(evidence.allowedCards);
  expect(evidence.scripts).toBeGreaterThan(0);
  expect(workers).toContainEqual(
    expect.stringContaining("duel.worker-browser.ts"),
  );
  await testInfo.attach("t7-real-browser-runtime", {
    body: JSON.stringify({ evidence, workers }, null, 2),
    contentType: "application/json",
  });
});
