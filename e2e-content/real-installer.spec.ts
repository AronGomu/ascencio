import type { DuelCommand } from "../src/battle/duel/contracts/duel-command.ts";
import type { DuelWorkerEvent } from "../src/battle/duel/contracts/duel-worker-event.ts";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Exact private producer run is required, never silently replace it with fixtures.
test("real Chapter 1 Free Play both seats enforce chapter pool", async ({
  page,
}, testInfo) => {
  const run = process.env.CONTENT_RUN;
  expect(run, "CONTENT_RUN must name a verified T3 run").toMatch(
    /^generated\/asset-delivery\/runs\/[a-f0-9-]{36}$/,
  );
  const candidate = JSON.parse(
    await readFile(path.join(run!, "candidate.json"), "utf8"),
  ) as { snapshot: { key: string; sha256: string } };
  const snapshot = JSON.parse(
    await readFile(path.join(run!, "objects", candidate.snapshot.key), "utf8"),
  ) as {
    prod: {
      index: { sha256: string; bytes: number };
      runtimeSnapshotId: string;
    };
  };
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));
  await page.goto("/#/install-content");
  await expect(
    page.locator('[data-cy="install-content-install-chapter-01"]'),
  ).toBeEnabled();
  const bootstrap = await (
    await page.request.get("/core-bootstrap.json")
  ).json();
  expect(bootstrap.delivery.index).toEqual({
    sha256: snapshot.prod.index.sha256,
    bytes: snapshot.prod.index.bytes,
  });
  await page.locator('[data-cy="install-content-install-chapter-01"]').click();
  await expect(
    page.locator('[data-cy="install-content-ready-chapter-01"]'),
  ).toContainText("Verified installed", { timeout: 240_000 });
  await expect(page.locator('[data-cy="install-content-status"]')).toHaveText(
    "Installed content is ready.",
  );
  const evidence = await page.evaluate(async () => {
    const { openContentReader } = await import(
      /* @vite-ignore */ String("/src/content/index.ts")
    );
    const { readInstalledRuntimeReceipt } = await import(
      /* @vite-ignore */ String(
        "/src/shell/adapters/legacy-installed-runtime-receipt.ts",
      )
    );
    const opened = await openContentReader();
    if (opened.kind !== "ok") return opened;
    try {
      const state = await opened.value.current();
      if (state.kind !== "ok" || !state.value.current) return state;
      const ref = state.value.current;
      const receipt = await readInstalledRuntimeReceipt(
        ref.snapshot,
        ref.runtime,
      );
      return {
        state,
        receipt,
        jobs: await new Promise((resolve, reject) => {
          const request = indexedDB.open("ygo-story-content");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result;
            const rows = db.transaction("jobs").objectStore("jobs").getAll();
            rows.onerror = () => {
              db.close();
              reject(rows.error);
            };
            rows.onsuccess = () => {
              db.close();
              resolve(rows.result);
            };
          };
        }),
      };
    } finally {
      opened.value.close();
    }
  });
  expect(evidence).toMatchObject({
    state: {
      kind: "ok",
      value: {
        generation: 1,
        current: {
          catalogSha256: snapshot.prod.index.sha256,
          snapshot: { runtimeSnapshotId: snapshot.prod.runtimeSnapshotId },
        },
      },
    },
    receipt: {
      kind: "ok",
      value: { schemaVersion: 1, kind: "installed-runtime-v1" },
    },
    jobs: [{ progress: { phase: "complete" } }],
  });
  expect(workers).toEqual([]);
  await testInfo.attach("exact-input-and-installed-receipt", {
    body: JSON.stringify(
      { run, candidate, bootstrap, evidence, workers },
      null,
      2,
    ),
    contentType: "application/json",
  });
  // Real production Worker entry/parse boundary. Instrument engine creation in
  // Chromium only; no test switches or counters ship in production code.
  const probeCreated = page.waitForEvent("worker");
  await page.evaluate(() => {
    (window as unknown as { t6Worker: Worker }).t6Worker = new Worker(
      "/src/battle/worker/duel.worker-browser.ts",
      { type: "module" },
    );
  });
  const probe = await probeCreated;
  await probe.evaluate(async () => {
    const { OcgCoreAdapter } = await import(
      /* @vite-ignore */ String("/src/battle/worker/engine/OcgCoreAdapter.ts")
    );
    const scope = globalThis as unknown as { t6CreateDuel: number };
    scope.t6CreateDuel = 0;
    const create = OcgCoreAdapter.prototype.createDuel;
    OcgCoreAdapter.prototype.createDuel = function (...args: unknown[]) {
      scope.t6CreateDuel++;
      return create.apply(this, args);
    };
  });
  const rejectedSeats = await page.evaluate(async () => {
    const { openContentReader, loadInstalledGameplay } = await import(
      /* @vite-ignore */ String("/src/content/index.ts")
    );
    const { createLegacyBattleRuntimeSource } = await import(
      /* @vite-ignore */ String("/src/shell/adapters/legacy-battle-runtime.ts")
    );
    const opened = await openContentReader();
    if (opened.kind !== "ok") throw new Error(opened.code);
    const worker = (window as unknown as { t6Worker: Worker }).t6Worker;
    const send = (command: DuelCommand, terminal: DuelWorkerEvent["type"]) =>
      new Promise<DuelWorkerEvent[]>((resolve, reject) => {
        const events: DuelWorkerEvent[] = [];
        const timeout = setTimeout(() => {
          worker.removeEventListener("message", receive);
          reject(new Error("Production Worker response timed out"));
        }, 120_000);
        function receive(event: MessageEvent<DuelWorkerEvent>) {
          events.push(event.data);
          if (event.data.type === terminal || event.data.type === "error") {
            clearTimeout(timeout);
            worker.removeEventListener("message", receive);
            resolve(events);
          }
        }
        worker.addEventListener("message", receive);
        worker.postMessage(
          command,
          command.type === "initialize" ? [command.runtime.wasmBinary] : [],
        );
      });
    try {
      const state = await opened.value.current();
      if (state.kind !== "ok" || !state.value.current)
        throw new Error("No installed content");
      const content = state.value.current;
      const loaded = await loadInstalledGameplay(opened.value, content);
      if (loaded.kind !== "ok") throw new Error(loaded.code);
      const runtime = await createLegacyBattleRuntimeSource(
        opened.value,
        loaded.value,
      ).load(new AbortController().signal);
      const deck = loaded.value.decks.find(
        (deck: { id: string }) =>
          deck.id === loaded.value.defaults.starterDeckId,
      );
      const good = {
        kind: "cards" as const,
        main: deck.main,
        extra: deck.extra,
        side: deck.side,
      };
      const outside = 73915052;
      if (
        loaded.value.cards.some(
          (card: { code: number }) => card.code === outside,
        )
      )
        throw new Error("Support-only probe entered chapter pool");
      const bad = { ...good, main: [outside, ...good.main.slice(1)] };
      const initialized = await send({ type: "initialize", runtime }, "ready");
      if (!initialized.some(({ type }) => type === "ready"))
        throw new Error(JSON.stringify(initialized));
      const results = [];
      for (const seat of ["player", "opponent"] as const) {
        const events = await send(
          {
            type: "startDuel",
            duelId: `out-of-pool-${seat}` as never,
            player: seat === "player" ? bad : good,
            opponent: seat === "opponent" ? bad : good,
          },
          "error",
        );
        results.push({ seat, outside, events });
      }
      return { results, good };
    } finally {
      opened.value.close();
    }
  });
  expect(rejectedSeats.results).toHaveLength(2);
  for (const rejected of rejectedSeats.results) {
    expect(rejected.events).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          code: "unsupported_card",
          message: expect.stringContaining(
            "outside installed chapter content: 73915052",
          ),
        }),
      }),
    ]);
  }
  const createDuelCount = await probe.evaluate(
    () => (globalThis as unknown as { t6CreateDuel: number }).t6CreateDuel,
  );
  expect(createDuelCount).toBe(0);
  await testInfo.attach("production-boundary-rejected-seats", {
    body: JSON.stringify({ rejectedSeats, createDuelCount }, null, 2),
    contentType: "application/json",
  });
  const probeResult = await page.evaluate(async (good) => {
    const worker = (window as unknown as { t6Worker: Worker }).t6Worker;
    const send = (command: DuelCommand, terminal: DuelWorkerEvent["type"]) =>
      new Promise<DuelWorkerEvent>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.removeEventListener("message", receive);
          reject(new Error("Valid probe duel timed out"));
        }, 30_000);
        function receive(event: MessageEvent<DuelWorkerEvent>) {
          if (event.data.type !== terminal && event.data.type !== "error")
            return;
          clearTimeout(timeout);
          worker.removeEventListener("message", receive);
          if (event.data.type === "error")
            reject(new Error(event.data.error.message));
          else resolve(event.data);
        }
        worker.addEventListener("message", receive);
        worker.postMessage(
          command,
          command.type === "initialize" ? [command.runtime.wasmBinary] : [],
        );
      });
    await send(
      {
        type: "startDuel",
        duelId: "calibrated-valid-probe" as never,
        player: good,
        opponent: good,
      },
      "prompt",
    );
    return send({ type: "surrender" }, "result");
  }, rejectedSeats.good);
  expect(probeResult).toEqual({
    type: "result",
    result: { type: "surrendered", winner: 1, loser: 0 },
  });
  const calibratedCount = await probe.evaluate(
    () => (globalThis as unknown as { t6CreateDuel: number }).t6CreateDuel,
  );
  expect(calibratedCount).toBe(1);
  await testInfo.attach("calibrated-engine-counter-valid-terminal", {
    body: JSON.stringify(
      { createDuelCount, calibratedCount, probeResult },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.evaluate(() =>
    (window as unknown as { t6Worker: Worker }).t6Worker.terminate(),
  );
  await page.locator('[data-cy="install-content-back"]').click();
  await expect(page.locator('[data-cy="main-menu-screen"]')).toBeVisible();
  await page.goto("/#/free-play");
  await expect(page.locator('[data-cy="deck-select-screen"]')).toBeVisible({
    timeout: 120_000,
  });
  const chapterDecks = page.locator('[data-cy^="deck-tile-chapter:"]');
  await expect(chapterDecks).toHaveCount(2);
  await expect(page.locator('[data-cy^="deck-tile-preset:"]')).toHaveCount(0);
  const start = page.locator('[data-cy="deck-select-start"]');
  await expect(start).toBeEnabled();
  await start.click();
  await expect(page.locator('[data-cy="duel-field-board"]')).toBeVisible({
    timeout: 120_000,
  });
  expect(workers).toHaveLength(2);
  await page.locator('[data-cy="duel-right-rail-options"]').click();
  await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
  await page
    .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
    .click();
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  await testInfo.attach("installed-free-play-result", {
    body: JSON.stringify(
      {
        content: evidence.state.value.current,
        chapterDeckCount: await chapterDecks.count(),
        workers,
        result: "surrendered",
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  await page.screenshot({
    path: "artifacts/CORE_ACCEPTANCE/T6/real-installed-free-play.png",
  });
});
