import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { duelFieldRenderFailureUrl } from "../tests/fixtures/duel-field-component-failure.ts";

interface BrowserCapture {
  readonly commands: readonly Readonly<Record<string, unknown>>[];
  readonly events: readonly Readonly<Record<string, unknown>>[];
  readonly workers: number;
  readonly terminations: number;
  readonly imageUrls: {
    readonly created: readonly string[];
    readonly revoked: readonly string[];
    readonly active: ReadonlySet<string>;
  };
  readonly eventPaints: Array<{
    readonly type: string;
    readonly receivedAt: number;
    readonly paintedAt: number;
    readonly duration: number;
  }>;
  readonly longTasks: Array<{
    readonly name: string;
    readonly duration: number;
  }>;
  readonly listeners: { readonly added: number; readonly removed: number };
}

declare global {
  interface Window {
    readonly __duelCapture: BrowserCapture;
  }
}

interface CapturedStateEvent {
  readonly type: "state";
  readonly state: {
    readonly snapshotId: string;
    readonly players: readonly [
      { readonly hand: readonly unknown[]; readonly handCount: number },
      { readonly hand: readonly unknown[]; readonly handCount: number },
    ];
  };
}

interface CapturedPromptEvent {
  readonly type: "prompt";
  readonly prompt: { readonly id: string; readonly kind: string };
}

async function startPresetDuel(page: Page): Promise<void> {
  const start = page.locator('[data-cy="deck-picker-start-button"]');
  await expect(start).toBeEnabled({ timeout: 120_000 });
  await start.click();
}

const RESPONSIVE_VIEWPORTS = [
  { id: "VP-01", width: 1366, height: 768 },
  { id: "VP-02", width: 1920, height: 1080 },
  { id: "VP-04", width: 1024, height: 768 },
  { id: "VP-05", width: 667, height: 375 },
  { id: "VP-06", width: 375, height: 667 },
  { id: "VP-07", width: 640, height: 360, zoomEquivalent: "1280x720@200%" },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const capture = {
      commands: [] as unknown[],
      events: [] as unknown[],
      workers: 0,
      terminations: 0,
      imageUrls: {
        created: [] as string[],
        revoked: [] as string[],
        active: new Set<string>(),
      },
      eventPaints: [] as Array<{
        type: string;
        receivedAt: number;
        paintedAt: number;
        duration: number;
      }>,
      longTasks: [] as Array<{ name: string; duration: number }>,
      listeners: { added: 0, removed: 0 },
    };
    Object.defineProperty(window, "__duelCapture", { value: capture });

    const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
    const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource): string => {
      const url = nativeCreateObjectURL(object);
      capture.imageUrls.created.push(url);
      capture.imageUrls.active.add(url);
      return url;
    };
    URL.revokeObjectURL = (url: string): void => {
      capture.imageUrls.revoked.push(url);
      capture.imageUrls.active.delete(url);
      nativeRevokeObjectURL(url);
    };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: AddEventListenerOptions | boolean,
    ): void {
      if (
        this === window ||
        this === document ||
        this === document.body ||
        this === document.documentElement
      )
        capture.listeners.added += 1;
      return Reflect.apply(nativeAddEventListener, this, [
        type,
        callback,
        options,
      ]) as void;
    };
    EventTarget.prototype.removeEventListener = function (
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: EventListenerOptions | boolean,
    ): void {
      if (
        this === window ||
        this === document ||
        this === document.body ||
        this === document.documentElement
      )
        capture.listeners.removed += 1;
      return Reflect.apply(nativeRemoveEventListener, this, [
        type,
        callback,
        options,
      ]) as void;
    };

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          capture.longTasks.push({
            name: entry.name,
            duration: entry.duration,
          });
      }).observe({ entryTypes: ["longtask"] });
    } catch {
      // Long Task API may be unavailable in non-Chromium hygiene projects.
    }

    const NativeWorker = window.Worker;
    const nativePostMessage = NativeWorker.prototype.postMessage;
    const nativeTerminate = NativeWorker.prototype.terminate;
    Object.defineProperty(NativeWorker.prototype, "postMessage", {
      configurable: true,
      value: function (
        this: Worker,
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ): void {
        capture.commands.push(structuredClone(message));
        Reflect.apply(
          nativePostMessage,
          this,
          options === undefined ? [message] : [message, options],
        );
      },
    });

    class InspectableWorker extends NativeWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        capture.workers += 1;
        this.addEventListener("message", (event) => {
          capture.events.push(structuredClone(event.data));
          const receivedAt = performance.now();
          const eventType =
            typeof event.data === "object" &&
            event.data !== null &&
            "type" in event.data &&
            typeof event.data.type === "string"
              ? event.data.type
              : "unknown";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const paintedAt = performance.now();
              capture.eventPaints.push({
                type: eventType,
                receivedAt,
                paintedAt,
                duration: paintedAt - receivedAt,
              });
            });
          });
        });
      }

      terminate(): void {
        capture.terminations += 1;
        Reflect.apply(nativeTerminate, this, []);
      }
    }
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: InspectableWorker,
    });
  });
});

test("production bundle initializes the real Worker and sends one opaque choice once", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const startupBeganAt = Date.now();
  await page.goto("./");
  await startPresetDuel(page);

  /* Without the removed "Shuffle Deck" idle command, an opening Main Phase
     with no legal global action beyond ending the turn never mounts the
     conditional field action bar (`fieldActionBarRequired`), so readiness is
     asserted on the field's own prompt-kind marker and the preview panel's
     status line instead of the bar's title node. */
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind="idleCommand"]'),
  ).toBeVisible({ timeout: 120_000 });
  await expect(
    page.locator('[data-cy="card-preview-status"]', {
      hasText: "Choose a Main Phase action",
    }),
  ).toBeVisible({ timeout: 120_000 });
  expect(Date.now() - startupBeganAt).toBeLessThan(15_000);
  await enableDuelHud(page);
  await expect(page.getByRole("heading", { name: "Your turn" })).toBeVisible();
  await expect(
    page.locator('[data-cy="duel-header-life-points-p0"]'),
  ).toBeVisible();
  const field = page.getByRole("region", { name: "Duel field" });
  await expect(field).toBeVisible();
  // T8: hand zones paint no ZoneControl/`data-zone-id`; 34 physical zones
  // minus the 2 hand zones leaves 32 painted ones.
  await expect(field.locator("[data-zone-id]")).toHaveCount(32);
  // The top-right status pills (T3) are gone; the in-field phase strip is
  // the current-phase indicator now.
  await expect(field.locator('[data-cy="field-phase-strip"]')).toBeVisible();
  const currentPhaseChip = field.locator(
    '[data-cy="field-phase-chip-draw"].is-current, [data-cy="field-phase-chip-standby"].is-current, [data-cy="field-phase-chip-main1"].is-current',
  );
  await expect(currentPhaseChip).toHaveCount(1);
  await expect(
    page.locator('[data-cy="duel-header-life-points-p0"]'),
  ).toHaveText("8,000 LP");
  await expect(
    page.locator('[data-cy="duel-header-life-points-p1"]'),
  ).toHaveText("8,000 LP");
  await expect(
    field.getByRole("article", { name: /Hidden opponent hand card/ }).first(),
  ).toBeVisible();
  await expect(field.getByRole("img").first()).toHaveAttribute("src", /.+/);

  const promptTitle = page.locator('[data-cy="card-preview-status"]', {
    hasText: "Choose a Main Phase action",
  });
  await expect(promptTitle).toBeVisible();

  await page.locator('[data-cy="app-menubar-settings-button"]').click();
  await page.locator('[data-cy="menu-dialog-settings-button"]').click();
  await expect(page.locator('[data-cy="settings-engine-version"]')).toHaveText(
    /ocgcore 11\.0/,
  );
  await page.locator('[data-cy="settings-dialog-close-button"]').click();

  const capture = await readCapture(page);
  const ready = capture.events.find((event) => event.type === "ready");
  expect(ready).toEqual({
    type: "ready",
    coreVersion: [11, 0],
    snapshotId: expect.stringMatching(/^[a-f0-9]{64}$/),
    activeImageManifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  const stateEvents = capture.events.filter(
    (event) => event.type === "state",
  ) as unknown as CapturedStateEvent[];
  expect(stateEvents.length).toBeGreaterThan(0);
  for (const event of stateEvents) {
    expect(event.state.players[1].hand).toEqual([]);
    expect(event.state.players[1].handCount).toBeGreaterThan(0);
  }
  const runtimeManifest = JSON.parse(
    await readFile("generated/runtime/current/manifest.json", "utf8"),
  ) as { readonly snapshotId: string };
  expect(stateEvents.at(-1)?.state.snapshotId).toBe(runtimeManifest.snapshotId);

  expect(
    requests.some((url) =>
      url.includes("/ygo-story-duel/runtime/current/manifest.json"),
    ),
  ).toBe(true);
  expect(
    requests.some((url) =>
      url.includes("/ygo-story-duel/runtime/engine/ocgcore.sync.wasm"),
    ),
  ).toBe(true);
  expect(
    requests
      .filter((url) => url.includes("/runtime/"))
      .every((url) => url.includes("/ygo-story-duel/runtime/")),
  ).toBe(true);
  expect(
    requests.some((url) =>
      /\/ygo-story-duel\/runtime\/images\/\d+\.jpg$/.test(url),
    ),
  ).toBe(true);

  const prompt = capture.events.find(
    (event) => event.type === "prompt",
  ) as unknown as CapturedPromptEvent | undefined;
  expect(prompt).toBeDefined();
  const endTurn = field.getByRole("button", {
    name: "End turn",
    exact: true,
  });
  await endTurn.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect
    .poll(async () => {
      const latest = await readCapture(page);
      return latest.commands.filter(
        (command) =>
          command.type === "respond" && command.promptId === prompt?.prompt.id,
      ).length;
    })
    .toBe(1);

  const commands = (await readCapture(page)).commands;
  expect(JSON.stringify(commands)).not.toMatch(
    /"seed"|"deckOrder"|"startupScript"|"programmed"|"mode"/,
  );
});

test("deck picker persists a chosen pair and Change decks returns without auto-start", async ({
  page,
}) => {
  await page.goto("./");
  const picker = page.locator('[data-cy="deck-picker"]');
  await expect(picker).toBeVisible({ timeout: 120_000 });
  expect(
    (await readCapture(page)).commands.filter(
      (command) => command.type === "startDuel",
    ),
  ).toHaveLength(0);

  await page
    .locator('[data-cy="deck-picker-option-player-burning-abyss"]')
    .click();
  await page
    .locator('[data-cy="deck-picker-option-opponent-shaddoll"]')
    .click();
  await expect(
    page.locator('[data-cy="deck-picker-option-player-burning-abyss"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-cy="deck-picker-option-opponent-shaddoll"]'),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ygo.ui.v1") ?? "null"),
    ),
  ).toEqual({
    version: 1,
    windows: { zoneList: null, confirm: null },
    decks: { player: "burning-abyss", opponent: "shaddoll" },
  });

  await page.locator('[data-cy="deck-picker-start-button"]').click();
  await expect(page.locator('[data-cy="duel-field"]')).toBeVisible({
    timeout: 120_000,
  });
  expect(
    (await readCapture(page)).commands.filter(
      (command) => command.type === "startDuel",
    ),
  ).toEqual([
    {
      type: "startDuel",
      duelId: "bundled-v1:burning-abyss:vs:shaddoll",
      playerDeckId: "burning-abyss",
      opponentDeckId: "shaddoll",
    },
  ]);

  await page.reload();
  await expect(picker).toBeVisible({ timeout: 120_000 });
  await expect(
    page.locator('[data-cy="deck-picker-option-player-burning-abyss"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-cy="deck-picker-option-opponent-shaddoll"]'),
  ).toHaveAttribute("aria-pressed", "true");

  await page.locator('[data-cy="deck-picker-start-button"]').click();
  await expect(page.locator('[data-cy="duel-field"]')).toBeVisible({
    timeout: 120_000,
  });
  await surrenderThroughMenu(page);
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  await page.locator('[data-cy="duel-result-change-decks-button"]').click();
  await expect(picker).toBeVisible({ timeout: 120_000 });
  await expect(
    page.locator('[data-cy="deck-picker-option-player-burning-abyss"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator('[data-cy="deck-picker-option-opponent-shaddoll"]'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(
      async () =>
        (await readCapture(page)).commands.filter(
          (command) => command.type === "startDuel",
        ).length,
    )
    .toBe(1);
});

test("panels stay hidden until settings enable them", async ({ page }) => {
  await page.goto("./");
  await startPresetDuel(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({ timeout: 120_000 });

  await expect(page.locator('[data-cy="duel-hud"]')).toHaveCount(0);
  await expect(page.locator('[data-cy="workspace-grid"]')).toHaveCount(0);

  await enableDuelHud(page);
  await enableWorkspace(page);

  await expect(page.locator('[data-cy="duel-hud"]')).toBeVisible();
  await expect(page.locator('[data-cy="workspace-grid"]')).toBeVisible();
});

test("duel HUD keeps hidden stacks count-only and tray image work mounted on demand", async ({
  page,
}, testInfo) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/runtime\/images\/\d+\.jpg$/.test(request.url()))
      imageRequests.push(request.url());
  });
  await page.goto("./");
  await startPresetDuel(page);
  await enableDuelHud(page);

  const hud = page.getByRole("region", { name: "Duel HUD" });
  await expect(hud).toBeVisible({ timeout: 120_000 });
  await expect(hud.getByText(/8,000 LP/).first()).toBeVisible();
  await expect(hud.getByText(/Turn \d+/)).toBeVisible();
  await expect(hud.getByText(/main 1|draw|standby|battle|end/)).toBeVisible();

  const opponentDeck = hud.getByRole("region", {
    name: /Opponent Deck, \d+ cards/,
  });
  await expect(opponentDeck.getByText("Count only")).toBeVisible();
  await expect(
    opponentDeck.getByRole("button", { name: /Open Opponent Deck/ }),
  ).toHaveCount(0);
  await expect(hud.locator("[data-card-code]")).toHaveCount(0);

  const beforeTray = imageRequests.length;
  const ownExtra = hud.getByRole("button", {
    name: /Open Your Extra Deck tray, \d+ cards/,
  });
  if ((await ownExtra.count()) > 0) {
    await ownExtra.click();
    const tray = page.getByRole("region", { name: "Your Extra Deck tray" });
    await expect(tray).toBeVisible();
    expect(
      await tray.getByRole("button", { name: /^Inspect / }).count(),
    ).toBeLessThanOrEqual(24);
    await tray
      .getByRole("button", { name: "Close Your Extra Deck tray" })
      .click();
    await expect(tray).toHaveCount(0);
    await expect(ownExtra).toBeFocused();
  }
  expect(imageRequests.length).toBe(beforeTray);

  const screenshotPath = testInfo.outputPath("df-11-hud.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("df-11-hud", {
    path: screenshotPath,
    contentType: "image/png",
  });
  const networkPath = testInfo.outputPath("df-11-privacy-network.json");
  await writeFile(
    networkPath,
    JSON.stringify(
      {
        activeImageRequests: imageRequests,
        trayAddedRequests: imageRequests.length - beforeTray,
        opponentDeckContentsMounted: false,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("df-11-privacy-network", {
    path: networkPath,
    contentType: "application/json",
  });
});

test("repeated restart replaces the Worker and clears presentation state", async ({
  page,
}) => {
  await page.goto("./");
  await startPresetDuel(page);
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    await expect(
      page.locator('[data-cy="duel-field"][data-prompt-kind]'),
    ).toBeVisible({
      timeout: 120_000,
    });
    if (cycle === 1) {
      await page.locator('[data-cy="app-menubar-settings-button"]').click();
      await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
      await page
        .locator('[data-cy="menu-dialog-surrender-cancel-button"]')
        .click();
      // Cancelling returns to the menu's main view (still open); reopen the
      // surrender confirmation from there rather than the outer trigger,
      // which sits behind the still-open dialog backdrop.
      await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
      await page
        .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
        .click();
    } else {
      await surrenderThroughMenu(page);
    }
    const surrenderedHeading = page.getByRole("heading", {
      name: "Duel surrendered",
    });
    await expect(surrenderedHeading).toBeVisible();
    await expect(surrenderedHeading).toBeFocused();
    await page.getByRole("button", { name: "Start another duel" }).click();
    await expect
      .poll(async () => (await readCapture(page)).workers)
      .toBe(cycle + 1);
  }
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });
  const capture = await readCapture(page);
  expect(
    capture.commands.filter(({ type }) => type === "dispose"),
  ).toHaveLength(2);
  expect(
    capture.commands.filter(({ type }) => type === "initialize"),
  ).toHaveLength(3);
});

test("refresh during loading and after completion starts a clean duel", async ({
  page,
}, testInfo) => {
  let releaseManifest!: () => void;
  let markBlocked!: () => void;
  const manifestBlocked = new Promise<void>((resolve) => {
    markBlocked = resolve;
  });
  const manifestRelease = new Promise<void>((resolve) => {
    releaseManifest = resolve;
  });
  let blockFirstManifest = true;
  await page.route("**/runtime/current/manifest.json", async (route) => {
    if (blockFirstManifest) {
      blockFirstManifest = false;
      markBlocked();
      await manifestRelease;
    }
    await route.continue();
  });

  await page.goto("./");
  await manifestBlocked;
  const reloadDuringLoading = page.reload();
  releaseManifest();
  await reloadDuringLoading;
  await startPresetDuel(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });

  await surrenderThroughMenu(page);
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  const diagnosticDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download diagnostics" }).click();
  const download = await diagnosticDownload;
  expect(download.suggestedFilename()).toMatch(
    /^ygo-duel-diagnostics-.*\.json$/,
  );
  const downloadPath = testInfo.outputPath(
    "duel-diagnostics-CONTAINS-PRODUCTION-SEED.json",
  );
  await download.saveAs(downloadPath);
  const diagnostic = JSON.parse(await readFile(downloadPath, "utf8")) as {
    readonly trace: { readonly sensitivity: string };
  };
  expect(diagnostic.trace.sensitivity).toBe("contains-production-seed");
  await page.reload();
  await startPresetDuel(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toHaveCount(0);
});

test("mounted card image leases return to baseline across tray, restart, and destroy", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await startPresetDuel(page);
  await enableDuelHud(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });
  await expect
    .poll(async () => {
      const state = await mountedImageLeaseState(page);
      return state.activeCount > 0 && state.activeMatchesMounted;
    })
    .toBe(true);
  const baseline = await mountedImageLeaseState(page);
  const revokedBefore = await page.evaluate(
    () => window.__duelCapture.imageUrls.revoked.length,
  );

  const ownExtra = page.getByRole("button", {
    name: /Open Your Extra Deck tray, \d+ cards/,
  });
  if ((await ownExtra.count()) > 0) {
    await ownExtra.click();
    await expect(
      page.getByRole("region", { name: "Your Extra Deck tray" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close Your Extra Deck tray" })
      .click();
    await expect
      .poll(async () => mountedImageLeaseState(page))
      .toEqual(baseline);
  }

  await surrenderThroughMenu(page);
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start another duel" }).click();
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });
  await expect
    .poll(async () => {
      const state = await mountedImageLeaseState(page);
      return state.activeCount > 0 && state.activeMatchesMounted;
    })
    .toBe(true);
  const restarted = await mountedImageLeaseState(page);
  expect(restarted.activeUrls).not.toEqual(baseline.activeUrls);
  expect(
    restarted.activeUrls.filter((url) => baseline.activeUrls.includes(url)),
  ).toEqual([]);
  expect(
    await page.evaluate(() => window.__duelCapture.imageUrls.revoked.length),
  ).toBeGreaterThan(revokedBefore);

  const evidence = await page.evaluate(() => ({
    created: window.__duelCapture.imageUrls.created.length,
    revoked: window.__duelCapture.imageUrls.revoked.length,
    active: window.__duelCapture.imageUrls.active.size,
  }));
  const evidencePath = testInfo.outputPath("df-13-object-url-lifecycle.json");
  await writeFile(
    evidencePath,
    JSON.stringify({ baseline, restarted, ...evidence }, null, 2),
  );
  await testInfo.attach("df-13-object-url-lifecycle", {
    path: evidencePath,
    contentType: "application/json",
  });

  await page.goto("about:blank");
  await expect
    .poll(async () =>
      page.evaluate(() => window.__duelCapture.imageUrls.active.size),
    )
    .toBe(0);
});

test("slow image preload cannot delay a legal Worker response", async ({
  page,
}, testInfo) => {
  let markBlocked!: () => void;
  let releaseImages!: () => void;
  const blocked = new Promise<void>((resolve) => (markBlocked = resolve));
  const released = new Promise<void>((resolve) => (releaseImages = resolve));
  let first = true;
  await page.route(/\/runtime\/images\/\d+\.jpg$/, async (route) => {
    if (first) {
      first = false;
      markBlocked();
    }
    await released;
    await route.abort("failed");
  });

  await page.goto("./");
  await startPresetDuel(page);
  await blocked;
  const controls = page.locator('[data-cy="duel-field"][data-prompt-kind]');
  await expect(controls).toBeVisible({ timeout: 120_000 });
  await expect(controls.getByRole("button").first()).toBeEnabled();
  const field = page.getByRole("region", { name: "Duel field" });
  await expect(field.getByRole("img").first()).toHaveAttribute(
    "src",
    /^data:image\/svg\+xml/,
  );
  const capture = await readCapture(page);
  const prompt = capture.events.find(
    (event) => event.type === "prompt",
  ) as unknown as CapturedPromptEvent;
  await field.getByRole("button", { name: "End turn", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await readCapture(page)).commands.filter(
          (command) =>
            command.type === "respond" && command.promptId === prompt.prompt.id,
        ).length,
    )
    .toBe(1);
  const evidencePath = testInfo.outputPath("df-13-nonblocking-input.json");
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        imagePreloadSettled: false,
        workerResponseCount: 1,
        fieldImageSource: await field
          .getByRole("img")
          .first()
          .getAttribute("src"),
      },
      null,
      2,
    ),
  );
  await testInfo.attach("df-13-nonblocking-input", {
    path: evidencePath,
    contentType: "application/json",
  });
  releaseImages();
});

test("missing active images use deterministic placeholders without blocking input", async ({
  page,
}) => {
  await page.route(/\/runtime\/images\/\d+\.jpg$/, (route) =>
    route.abort("failed"),
  );
  await page.goto("./");
  await startPresetDuel(page);
  const controls = page.locator('[data-cy="duel-field"][data-prompt-kind]');
  await expect(controls).toBeVisible({ timeout: 120_000 });
  await expect(
    page.locator(".image-warning").getByText(/card images? .*placeholder/i),
  ).toBeVisible();
  const promptImage = controls.locator("img").first();
  await expect(promptImage).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(controls.getByRole("button").first()).toBeEnabled();
});

test("forced Worker initialization timeout terminates and replaces the Worker", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout;
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) =>
      nativeSetTimeout(
        handler,
        timeout === 120_000 ? 1 : timeout,
        ...args,
      )) as typeof window.setTimeout;
  });
  await page.goto("./");
  const timeoutHeading = page.getByRole("heading", {
    name: /Duel Worker did not initialize within 120000ms/,
  });
  await expect(timeoutHeading).toBeVisible({ timeout: 30_000 });
  await expect(timeoutHeading).toBeFocused();
  await expect
    .poll(async () => (await readCapture(page)).terminations)
    .toBeGreaterThan(0);
  expect((await readCapture(page)).workers).toBeGreaterThanOrEqual(2);
});

test("injected DOM field failure preserves fallback controls and one opaque response", async ({
  page,
}) => {
  await page.goto(duelFieldRenderFailureUrl());
  await startPresetDuel(page);
  await expect(
    page.getByRole("heading", { name: "Interactive field could not render" }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(
    page.getByText("Injected duel field component failure"),
  ).toHaveCount(0);
  await page.locator('[data-cy="app-menubar-settings-button"]').click();
  await expect(
    page.locator('[data-cy="menu-dialog-surrender-button"]'),
  ).toBeVisible();
  await page.locator('[data-cy="menu-dialog-close-button"]').click();
  // The interactive field failed to render, so the field surface can never
  // host this prompt; reveal the workspace so the docked prompt panel can.
  await enableWorkspace(page);
  const promptControls = page.locator("[data-prompt-kind]");
  await expect(promptControls).toBeVisible();
  const prompt = (await readCapture(page)).events.find(
    (event) => event.type === "prompt",
  ) as unknown as CapturedPromptEvent | undefined;
  expect(prompt).toBeDefined();
  const endTurn = promptControls.getByRole("button", {
    name: "End turn",
    exact: true,
  });
  await endTurn.evaluate((element) => {
    (element as HTMLButtonElement).click();
    (element as HTMLButtonElement).click();
  });
  await expect
    .poll(
      async () =>
        (await readCapture(page)).commands.filter(
          (command) =>
            command.type === "respond" &&
            command.promptId === prompt?.prompt.id,
        ).length,
    )
    .toBe(1);
  await page.getByRole("button", { name: "Retry duel field" }).click();
  await expect(page.getByRole("region", { name: "Duel field" })).toBeVisible();
});

test("mobile layout preserves controls and honors reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  const fieldRegion = page.getByRole("region", { name: "Duel field" });
  await expect(fieldRegion).toBeVisible();
  const dimensions = await fieldRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  const firstDecision = page.locator("[data-prompt-kind] button").first();
  const box = await firstDecision.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
});

test("wheel over the duel field scrolls the page", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 420 });
  await page.goto("./");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  const field = page.locator('[data-cy="duel-field"]');
  await expect(field).toBeVisible();
  const box = await field.boundingBox();
  if (box === null) throw new Error("Duel field has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
});

test("dragging a hand card onto a highlighted zone plays it", async ({
  page,
}) => {
  /* A pointer gesture is driven in viewport coordinates, so the whole board —
     the hand row and the monster row at once — has to be on screen. The
     default 720px-tall viewport puts the hand below the fold, where
     `elementFromPoint` returns null and every synthetic move is a no-op. */
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto("./");
  await startPresetDuel(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind="idleCommand"]'),
  ).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const field = page.getByRole("region", { name: "Duel field" });

  /* Match the engine's own action id through the chip's `data-cy` suffix,
     never the chip's word: `cardActionLabel` prints `Set` for both
     `setMonster` and `setSpellTrap`, so a text match could pick a spell and
     then fail on a monster zone for a reason unrelated to dragging. */
  const handChip = (action: string): Locator =>
    field.locator(
      `.duel-field-card[data-card-zone-id="p0:hand"] [data-cy^="card-action-chip-"][data-cy$="-${action}"]`,
    );
  /* Any placement the hand offers exercises the same seam, so the walker tries
     the monster row first and falls back to the backrow rather than skipping.
     `activate` is deliberately absent: `dropChoiceForZone` prefers it over
     `setSpellTrap` for a card offering both, and an activated Spell need not
     stay in the zone it was placed in, so it cannot carry the "one gesture,
     two responses" assertions below. */
  const PLACEMENTS = [
    { action: "summon", zoneKind: "mainMonster" },
    { action: "setMonster", zoneKind: "mainMonster" },
    { action: "setSpellTrap", zoneKind: "spellTrap" },
  ] as const;

  const firstEmptyZone = async (
    zoneKind: "mainMonster" | "spellTrap",
  ): Promise<string | null> =>
    field.evaluate((element, kind) => {
      for (let sequence = 0; sequence < 5; sequence += 1) {
        const zoneId = `p0:${kind}:${sequence}`;
        if (
          element.querySelector(
            `.duel-field-card[data-card-zone-id="${zoneId}"]`,
          ) === null
        )
          return zoneId;
      }
      return null;
    }, zoneKind);

  let chosen: { readonly chip: Locator; readonly zoneId: string } | null = null;
  for (const placement of PLACEMENTS) {
    const zoneId = await firstEmptyZone(placement.zoneKind);
    if (zoneId === null) continue;
    const chips = handChip(placement.action);
    const total = await chips.count();
    for (let index = 0; index < total; index += 1) {
      const chip = chips.nth(index);
      /* A card offering both would resolve to `activate` on a backrow drop,
         which this test cannot assert on. Skip to the next card instead. */
      if (
        placement.action === "setSpellTrap" &&
        (await chip.evaluate(
          (element) =>
            element
              .closest(".duel-field-card")
              ?.querySelector(
                '[data-cy^="card-action-chip-"][data-cy$="-activate"]',
              ) != null,
        ))
      )
        continue;
      chosen = { chip, zoneId };
      break;
    }
    if (chosen !== null) break;
  }
  if (chosen === null) {
    test.skip(
      true,
      "opening hand offers no summon, no monster set and no settable spell or trap — there is no placement of any kind to drag",
    );
    return;
  }

  const { chip, zoneId: targetZoneId } = chosen;
  const cardId = await chip.evaluate(
    (element) =>
      element.closest(".duel-field-card")?.getAttribute("data-card-id") ?? "",
  );
  expect(cardId).not.toBe("");
  const dragTarget = field.locator(`[data-cy="field-card-target-${cardId}"]`);
  const targetZone = field.locator(`[data-zone-id="${targetZoneId}"]`);

  await dragTarget.scrollIntoViewIfNeeded();
  const cardBox = await dragTarget.boundingBox();
  const zoneBox = await targetZone.boundingBox();
  if (cardBox === null || zoneBox === null)
    throw new Error("Missing drag geometry");
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(
    cardBox.y + cardBox.height <= viewportHeight &&
      zoneBox.y + zoneBox.height <= viewportHeight,
    `hand card (bottom ${cardBox.y + cardBox.height}) and target zone (bottom ${zoneBox.y + zoneBox.height}) must both sit inside the ${viewportHeight}px viewport for a pointer drag`,
  ).toBe(true);
  const from = {
    x: cardBox.x + cardBox.width / 2,
    y: cardBox.y + cardBox.height / 2,
  };
  const to = {
    x: zoneBox.x + zoneBox.width / 2,
    y: zoneBox.y + zoneBox.height / 2,
  };

  const before = await readCapture(page);
  const idlePrompt = [...before.events]
    .reverse()
    .find((event) => event.type === "prompt") as unknown as
    CapturedPromptEvent | undefined;
  expect(idlePrompt?.prompt.kind).toBe("idleCommand");
  const idlePromptId = idlePrompt?.prompt.id;
  const responsesBefore = before.commands.filter(
    (command) => command.type === "respond",
  ).length;

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(
    from.x + (to.x - from.x) / 3,
    from.y + (to.y - from.y) / 3,
    { steps: 4 },
  );
  await page.mouse.move(
    from.x + ((to.x - from.x) * 2) / 3,
    from.y + ((to.y - from.y) * 2) / 3,
    { steps: 4 },
  );
  await expect(targetZone).toHaveAttribute("data-drop-candidate", "true");
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();

  await expect(
    field.locator(`.duel-field-card[data-card-zone-id="${targetZoneId}"]`),
  ).toHaveCount(1, { timeout: 30_000 });
  await expect(targetZone).not.toHaveAttribute("data-drop-candidate", "true");

  // One gesture, two responses up front: the chosen action, then the engine's
  // own place prompt answered from the armed zone. Trivial follow-on prompts
  // (e.g. a chain nothing can answer but Pass) may auto-resolve afterward, so
  // only the first two new responses are asserted in order; neither prompt
  // may be answered twice.
  const capture = await readCapture(page);
  const responds = capture.commands.filter(
    (command) => command.type === "respond",
  );
  const newResponds = responds.slice(responsesBefore);
  expect(newResponds.length).toBeGreaterThanOrEqual(2);
  const placeResponse = newResponds[1];
  expect(newResponds[0]?.promptId).toBe(idlePromptId);
  expect(placeResponse?.promptId).not.toBe(idlePromptId);
  const respondsByPrompt = new Map<unknown, number>();
  for (const command of responds)
    respondsByPrompt.set(
      command.promptId,
      (respondsByPrompt.get(command.promptId) ?? 0) + 1,
    );
  expect([...respondsByPrompt.values()].filter((count) => count > 1)).toEqual(
    [],
  );
  const placePrompt = capture.events.find(
    (event) =>
      event.type === "prompt" &&
      (event.prompt as { readonly id?: string } | undefined)?.id ===
        placeResponse?.promptId,
  ) as unknown as CapturedPromptEvent | undefined;
  expect(placePrompt?.prompt.kind).toBe("selectPlace");
});

test("hovering a hand card fills the preview panel sharing the field row", async ({
  page,
}) => {
  // 1366 is above the 79rem (1264px) stacking breakpoint, so the panel is
  // beside the field here; below it the panel drops under the board instead.
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });

  const field = page.locator('[data-cy="duel-field"]');
  const panel = page.locator('[data-cy="card-preview-panel"]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-cy="card-preview-empty"]')).toBeVisible();
  await assertSharesFieldRow(page, "empty preview");

  const handCard = page
    .locator(
      '[data-cy="duel-field"] .duel-field-card[data-card-zone-id="p0:hand"]',
    )
    .first();
  await expect(handCard).toBeVisible();
  await handCard.hover();

  await expect(panel.locator('[data-cy="card-preview-name"]')).not.toBeEmpty();
  await expect(
    panel.locator('[data-cy="card-preview-image"]'),
  ).not.toHaveAttribute("src", "");
  await assertSharesFieldRow(page, "populated preview");

  // The panel is presentation only: nothing in it is focusable or clickable.
  expect(await panel.locator("button, a, [tabindex]").count()).toBe(0);
  expect(await field.count()).toBe(1);
});

test("a passive opponent hand card receives a real hover", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("./");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });

  const card = page
    .locator(
      '.duel-field-card[data-card-zone-id="p1:hand"]:not(.is-actionable)',
    )
    .first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS("pointer-events", "auto");
  await card.hover();

  await expect(page.locator('[data-cy="card-preview-name"]')).toHaveText(
    "Face-down card",
  );
});

test("opponent pile inversion rotates images only", async ({ page }) => {
  await page.goto("./");

  const orientations = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.innerHTML = `
      <div class="duel-field-stack" data-test-stack="player">
        <div class="duel-field-stack__art"><img alt="" /></div>
        <span class="duel-field-stack__name">Deck</span>
        <strong class="duel-field-stack__count">40</strong>
      </div>
      <div class="duel-field-stack is-opponent" data-test-stack="opponent">
        <div class="duel-field-stack__art"><img alt="" /></div>
        <span class="duel-field-stack__name">Deck</span>
        <strong class="duel-field-stack__count">40</strong>
      </div>
      <div class="zone-list-entry" data-test-entry="player">
        <img alt="" />
        <span class="zone-list-entry__position">1</span>
        <div class="card-action-chips"></div>
      </div>
      <div class="zone-list-entry is-opponent" data-test-entry="opponent">
        <img alt="" />
        <span class="zone-list-entry__position">1</span>
        <div class="card-action-chips"></div>
      </div>
    `;
    document.body.append(fixture);

    const orientation = (selector: string): readonly number[] => {
      const element = fixture.querySelector(selector);
      if (element === null) throw new Error(`Missing CSS fixture: ${selector}`);
      const transform = getComputedStyle(element).transform;
      const matrix =
        transform === "none"
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(transform);
      return [matrix.a, matrix.b, matrix.c, matrix.d];
    };

    return {
      playerStackRoot: orientation('[data-test-stack="player"]'),
      playerStackArt: orientation(
        '[data-test-stack="player"] .duel-field-stack__art',
      ),
      playerStackImage: orientation('[data-test-stack="player"] img'),
      playerStackName: orientation(
        '[data-test-stack="player"] .duel-field-stack__name',
      ),
      playerStackCount: orientation(
        '[data-test-stack="player"] .duel-field-stack__count',
      ),
      opponentStackRoot: orientation('[data-test-stack="opponent"]'),
      opponentStackArt: orientation(
        '[data-test-stack="opponent"] .duel-field-stack__art',
      ),
      opponentStackImage: orientation('[data-test-stack="opponent"] img'),
      opponentStackName: orientation(
        '[data-test-stack="opponent"] .duel-field-stack__name',
      ),
      opponentStackCount: orientation(
        '[data-test-stack="opponent"] .duel-field-stack__count',
      ),
      playerEntryRoot: orientation('[data-test-entry="player"]'),
      playerEntryImage: orientation('[data-test-entry="player"] > img'),
      playerEntryPosition: orientation(
        '[data-test-entry="player"] .zone-list-entry__position',
      ),
      playerEntryChips: orientation(
        '[data-test-entry="player"] .card-action-chips',
      ),
      opponentEntryRoot: orientation('[data-test-entry="opponent"]'),
      opponentEntryImage: orientation('[data-test-entry="opponent"] > img'),
      opponentEntryPosition: orientation(
        '[data-test-entry="opponent"] .zone-list-entry__position',
      ),
      opponentEntryChips: orientation(
        '[data-test-entry="opponent"] .card-action-chips',
      ),
    };
  });

  const upright = [1, 0, 0, 1];
  const inverted = [-1, 0, 0, -1];
  const expectedOrientations = {
    playerStackRoot: upright,
    playerStackArt: upright,
    playerStackImage: upright,
    playerStackName: upright,
    playerStackCount: upright,
    opponentStackRoot: upright,
    opponentStackArt: upright,
    opponentStackImage: inverted,
    opponentStackName: upright,
    opponentStackCount: upright,
    playerEntryRoot: upright,
    playerEntryImage: upright,
    playerEntryPosition: upright,
    playerEntryChips: upright,
    opponentEntryRoot: upright,
    opponentEntryImage: inverted,
    opponentEntryPosition: upright,
    opponentEntryChips: upright,
  } as const;

  for (const [name, expectedOrientation] of Object.entries(
    expectedOrientations,
  )) {
    const actualOrientation = orientations[name as keyof typeof orientations];
    expect(actualOrientation, name).toHaveLength(expectedOrientation.length);
    for (const [index, component] of expectedOrientation.entries())
      expect(actualOrientation[index], `${name}[${index}]`).toBeCloseTo(
        component,
        6,
      );
  }
});

test("responsive field compositions contain controls across supported viewports", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await startPresetDuel(page);
  await enableDuelHud(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });

  /* Whether any card is actionable is seed-dependent, so the chip block below
     stays guarded — but a run where it never fired proves nothing about chips,
     and used to pass silently. Counted here, asserted after the loop. */
  let chipViewportsExercised = 0;

  for (const viewport of RESPONSIVE_VIEWPORTS) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator("[data-prompt-kind]")).toBeVisible();
    const viewportLabel =
      "zoomEquivalent" in viewport
        ? `${viewport.id} ${viewport.zoomEquivalent}`
        : viewport.id;
    await assertNoPageWideHorizontalOverflow(page, viewportLabel);

    // The card preview panel shares the field's grid row only above the 79rem
    // (1264px) stacking breakpoint. At or below it the field must be full
    // width with the panel underneath, or the board's 52rem min-width would
    // push horizontal overflow onto the page — which the assertion above and
    // the per-field one below both forbid from 1024px up.
    const rowLayout = await page.evaluate(() => {
      const rect = (selector: string): DOMRect | null =>
        document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const row = rect('[data-cy="duel-row"]');
      const fieldBox = rect('[data-cy="duel-field"]');
      const panelBox = rect('[data-cy="card-preview-panel"]');
      return row === null || fieldBox === null || panelBox === null
        ? null
        : {
            rowWidth: row.width,
            fieldWidth: fieldBox.width,
            fieldTop: fieldBox.top,
            fieldBottom: fieldBox.bottom,
            panelTop: panelBox.top,
            panelBottom: panelBox.bottom,
          };
    });
    if (rowLayout === null)
      throw new Error(`${viewportLabel} duel row is not mounted`);
    if (viewport.width >= 1264) {
      expect(
        rowLayout.panelTop,
        `${viewportLabel} preview panel shares the field row`,
      ).toBeLessThanOrEqual(rowLayout.fieldTop + 2);
      expect(
        rowLayout.fieldWidth,
        `${viewportLabel} field yields its row to the panel`,
      ).toBeLessThan(rowLayout.rowWidth - 300);
    } else {
      // The preview panel is the LEFT column of `.duel-row` (moved there
      // ahead of this ticket), so it is first in DOM order and stacks
      // above the field, not below it, once the row collapses to one
      // column.
      expect(
        rowLayout.fieldTop,
        `${viewportLabel} field stacks below the preview panel`,
      ).toBeGreaterThanOrEqual(rowLayout.panelBottom - 1);
      expect(
        Math.abs(rowLayout.fieldWidth - rowLayout.rowWidth),
        `${viewportLabel} stacked field is full width`,
      ).toBeLessThanOrEqual(1);
    }

    const field = page.getByRole("region", { name: "Duel field" });
    await expect(field).toBeVisible();
    const fieldMetrics = await field.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowX: getComputedStyle(element).overflowX,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(fieldMetrics.scrollWidth).toBeGreaterThanOrEqual(
      fieldMetrics.clientWidth,
    );
    expect(fieldMetrics.scrollHeight).toBeGreaterThanOrEqual(
      fieldMetrics.clientHeight,
    );
    if (fieldMetrics.scrollWidth > fieldMetrics.clientWidth)
      expect(fieldMetrics.overflowX).toMatch(/auto|scroll/);
    if (fieldMetrics.scrollHeight > fieldMetrics.clientHeight)
      expect(fieldMetrics.overflowY).toMatch(/auto|scroll/);
    // Desktop widths must show the whole board with no horizontal panning.
    // Below 1024px the board's min-width still applies, because keeping every
    // field target at 44px outranks avoiding a horizontal scrollbar there.
    if (viewport.width >= 1024)
      expect(
        fieldMetrics.scrollWidth,
        `${viewportLabel} duel field has no horizontal overflow`,
      ).toBeLessThanOrEqual(fieldMetrics.clientWidth + 1);

    const board = field.getByRole("group", { name: "Standard duel board" });
    await expect(board).toBeVisible();
    const boardRatio = await board.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.width / box.height;
    });
    expect(boardRatio).toBeGreaterThan(1.7);
    expect(boardRatio).toBeLessThan(1.85);

    const targets = field.locator("[data-field-target]");
    const boxes = await targets.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    expect(boxes.length).toBeGreaterThan(0);
    expect(
      boxes.every(({ width, height }) => width >= 44 && height >= 44),
    ).toBe(true);

    // T8: both hand bands span exactly S/T1's left edge through S/T5's right
    // edge, the pile column keeps the same edge-to-edge gap as the adjacent
    // central-zone spacing, both arrows stay >=44px, and the hand viewport
    // can scroll past its clientWidth.
    for (const player of [0, 1] as const) {
      const geometry = await page.evaluate((currentPlayer: 0 | 1) => {
        const rect = (selector: string): DOMRect | null =>
          document.querySelector(selector)?.getBoundingClientRect() ?? null;
        return {
          spellTrap1: rect(`[data-zone-id="p${currentPlayer}:spellTrap:0"]`),
          spellTrap4: rect(`[data-zone-id="p${currentPlayer}:spellTrap:3"]`),
          spellTrap5: rect(`[data-zone-id="p${currentPlayer}:spellTrap:4"]`),
          monster4: rect(`[data-zone-id="p${currentPlayer}:mainMonster:3"]`),
          hand: rect(`[data-cy="field-hand-band-p${currentPlayer}"]`),
          deck: rect(`[data-cy="field-stack-p${currentPlayer}:deck"]`),
          gy: rect(`[data-cy="field-stack-p${currentPlayer}:graveyard"]`),
          banished: rect(`[data-cy="field-stack-p${currentPlayer}:banished"]`),
          monster5: rect(`[data-zone-id="p${currentPlayer}:mainMonster:4"]`),
          previous: rect(`[data-cy="field-hand-p${currentPlayer}-previous"]`),
          next: rect(`[data-cy="field-hand-p${currentPlayer}-next"]`),
          viewport: (() => {
            const element = document.querySelector(
              `[data-cy="field-hand-p${currentPlayer}-viewport"]`,
            );
            return element === null
              ? null
              : {
                  scrollWidth: element.scrollWidth,
                  clientWidth: element.clientWidth,
                };
          })(),
        };
      }, player);
      if (
        geometry.spellTrap1 === null ||
        geometry.spellTrap4 === null ||
        geometry.spellTrap5 === null ||
        geometry.monster4 === null ||
        geometry.hand === null ||
        geometry.deck === null ||
        geometry.gy === null ||
        geometry.banished === null ||
        geometry.monster5 === null ||
        geometry.previous === null ||
        geometry.next === null ||
        geometry.viewport === null
      )
        throw new Error(
          `${viewportLabel} p${player} hand/pile geometry hooks missing`,
        );
      expect(
        Math.abs(geometry.hand.left - geometry.spellTrap1.left),
        `${viewportLabel} p${player} hand band left edge tracks S/T1`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(geometry.hand.right - geometry.spellTrap5.right),
        `${viewportLabel} p${player} hand band right edge tracks S/T5`,
      ).toBeLessThanOrEqual(2);
      // Piles render narrower than a full zone slot (StackControl fills a
      // card's own footprint, not the zone chrome's), so edges alone are not
      // comparable across a zone/stack pair — center-to-center pitch is,
      // and is what "same spacing as adjacent central zones" (T8) means:
      // every pile column sits exactly one more 95-design-px step out.
      const center = (rect: { left: number; right: number }): number =>
        (rect.left + rect.right) / 2;
      const spellTrapPitch =
        center(geometry.spellTrap5) - center(geometry.spellTrap4);
      const monsterPitch =
        center(geometry.monster5) - center(geometry.monster4);
      expect(
        Math.abs(
          center(geometry.deck) - center(geometry.spellTrap5) - spellTrapPitch,
        ),
        `${viewportLabel} p${player} S/T5\u2192Deck centre pitch matches central-zone spacing`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(
          center(geometry.gy) - center(geometry.monster5) - monsterPitch,
        ),
        `${viewportLabel} p${player} M5\u2192GY centre pitch matches central-zone spacing`,
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(
          center(geometry.banished) - center(geometry.gy) - monsterPitch,
        ),
        `${viewportLabel} p${player} GY\u2192Banished centre pitch matches central-zone spacing`,
      ).toBeLessThanOrEqual(2);
      expect(geometry.previous.width).toBeGreaterThanOrEqual(44);
      expect(geometry.previous.height).toBeGreaterThanOrEqual(44);
      expect(geometry.next.width).toBeGreaterThanOrEqual(44);
      expect(geometry.next.height).toBeGreaterThanOrEqual(44);
      expect(
        geometry.viewport.scrollWidth,
        `${viewportLabel} p${player} hand viewport can scroll to reach every card`,
      ).toBeGreaterThanOrEqual(geometry.viewport.clientWidth);
    }

    const entry = field.locator("[data-field-target][tabindex='0']");
    await keyboardFocus(page, entry);
    await entry.evaluate((element) =>
      element.scrollIntoView({ block: "nearest", inline: "nearest" }),
    );
    await assertRectInsideViewport(
      page,
      entry,
      `${viewport.id} focused field target`,
    );
    expect(
      await entry.evaluate((element) => ({
        focusVisible: element.matches(":focus-visible"),
        outline: getComputedStyle(element).outlineStyle,
      })),
    ).toEqual({ focusVisible: true, outline: "solid" });

    /* Opening idleCommand has no required action bar. Its geometry gate now
       lives in the full-duel walker, which reaches a required bar, asserts its
       geometry, then fails if no bar was exercised. */

    // Unlike the action bar, the End turn corner button is always mounted, so
    // this check runs unconditionally at every viewport.
    const endTurnButton = field.locator('[data-cy="field-end-turn-button"]');
    await expect(endTurnButton).toBeVisible();
    const endTurnRect = await endTurnButton.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        left: box.left,
        bottom: box.bottom,
        right: box.right,
      };
    });
    // T3 moved End turn from a bottom-pinned corner outside the board into
    // the board's free band between the two banished zones (by design, per
    // the ticket's geometry table), so it now legitimately sits inside the
    // board's bounding rect. The check that still matters is that it never
    // sits over a playable target, so it can never swallow a click meant
    // for a card or a zone.
    const targetRects = await field
      .locator("[data-field-target]")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return {
            top: box.top,
            left: box.left,
            bottom: box.bottom,
            right: box.right,
          };
        }),
      );
    expect(targetRects.length).toBeGreaterThan(0);
    const buttonOverlapsATarget = targetRects.some(
      (rect) =>
        endTurnRect.left < rect.right &&
        endTurnRect.right > rect.left &&
        endTurnRect.top < rect.bottom &&
        endTurnRect.bottom > rect.top,
    );
    expect(
      buttonOverlapsATarget,
      `${viewportLabel} End turn corner button (rect ${JSON.stringify(endTurnRect)}) must not overlap any playable field target`,
    ).toBe(false);

    await captureResponsiveState(page, testInfo, viewport.id, "ST-01");

    const actionTarget = field
      .locator("[data-field-target][aria-label^='Legal action, Open actions']")
      .first();
    if ((await actionTarget.count()) > 0) {
      chipViewportsExercised += 1;
      // scrollIntoViewIfNeeded() only scrolls far enough to make the element
      // visible, parking it flush against a viewport edge. The chips are
      // wider than the card and centred on it, so at narrow viewports that
      // leaves them poking past the edge depending on which card is
      // actionable. Centring the card first is what a user panning to it
      // would actually do, and makes the chip-overflow assertion below
      // deterministic instead of seed-dependent.
      await actionTarget.evaluate((element) => {
        element.scrollIntoView({ block: "center", inline: "center" });
      });
      const cardId = (
        (await actionTarget.getAttribute("data-cy")) ?? ""
      ).replace(/^field-card-target-/, "");
      // The chips element is always mounted for an actionable card and is
      // merely `display: none` until the card is hovered, holds focus, or is
      // the pinned menu target. Every assertion here is therefore about
      // visibility; `toHaveCount` would pass or fail for the wrong reason.
      const chips = field.locator(`[data-cy="card-action-chips-${cardId}"]`);

      /* Hover and focus are the plan's headline reveal triggers and the pinned
         path below exercises neither, so assert each on its own. Both the
         pointer and focus are dropped first, or the previous state would carry
         the assertion. */
      await page.mouse.move(0, 0);
      await actionTarget.evaluate((element: HTMLElement) => element.blur());
      await expect(chips).toBeHidden();
      await actionTarget.hover();
      await expect(chips).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(chips).toBeHidden();
      await actionTarget.focus();
      await expect(chips).toBeVisible();
      // A card offering exactly one action fires it directly on click (T5)
      // instead of pinning the chip menu, so the pin/Escape round trip below
      // only applies to a card that actually opens a menu.
      const chipChoiceCount = await chips.locator("button").count();
      await actionTarget.evaluate((element: HTMLElement) => element.blur());
      await expect(chips).toBeHidden();

      if (chipChoiceCount > 1) {
        await actionTarget.click();
        await expect(chips).toBeVisible();
        await assertRectInsideViewport(
          page,
          chips,
          `${viewport.id} card action chips`,
        );
        await captureResponsiveState(page, testInfo, viewport.id, "ST-05");
        await page.keyboard.press("Escape");
        // Escape unpins and hands focus back to the card target. Focus and the
        // lingering pointer each keep the chips shown on their own, so drop both
        // before asserting that the pinned state is really gone.
        await expect(actionTarget).toBeFocused();
        await page.mouse.move(0, 0);
        await actionTarget.evaluate((element: HTMLElement) => element.blur());
        await expect(chips).toBeHidden();
      }
    }

    const trayButton = page
      .getByRole("button", { name: /Open Your (Extra Deck|GY|Banished) tray/ })
      .first();
    if ((await trayButton.count()) > 0) {
      await trayButton.scrollIntoViewIfNeeded();
      await trayButton.click();
      const tray = page.getByRole("region", {
        name: /Your (Extra Deck|GY|Banished) tray/,
      });
      await expect(tray).toBeVisible();
      await assertRectInsideViewport(page, tray, `${viewport.id} card tray`);
      await captureResponsiveState(page, testInfo, viewport.id, "ST-09");
      await tray.getByRole("button", { name: /^Close / }).click();
      await expect(tray).toHaveCount(0);
    }

    if (viewport.id === "VP-07") {
      expect(
        await page.evaluate(() => document.documentElement.style.zoom),
      ).toBe("");
      expect(
        await field.evaluate((element) => getComputedStyle(element).transform),
      ).toBe("none");
    }
  }

  expect(
    chipViewportsExercised,
    `no viewport offered an actionable card, so the chip hover/focus reveal, the chip visibility and viewport-containment assertions, the ST-05 evidence capture and the Escape round trip never ran at any of the ${RESPONSIVE_VIEWPORTS.length} viewports`,
  ).toBeGreaterThan(0);
});

test("DF-16 Chromium pinned parity/perf/resource gate records automated evidence", async ({
  page,
  browser,
}, testInfo) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable").catch(() => undefined);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("./");
  await startPresetDuel(page);
  await enableDuelHud(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.getByRole("region", { name: "Duel field" })).toBeVisible();
  await page.waitForFunction(
    () =>
      window.__duelCapture.eventPaints.some((entry) => entry.type === "state"),
    undefined,
    { timeout: 30_000 },
  );

  await page.evaluate(() => {
    window.__duelCapture.longTasks.length = 0;
  });
  for (let run = 0; run < 5; run += 1) await measureTwoFrameLatency(page);
  const updatePaintSamples: number[] = [];
  const actionLatencySamples: number[] = [];
  for (let run = 0; run < 30; run += 1) {
    updatePaintSamples.push(await measureTwoFrameLatency(page));
    actionLatencySamples.push(await measureFocusFeedbackLatency(page));
  }

  const normalLongTasks = (await readCapture(page)).longTasks.filter(
    (entry) => entry.duration > 50,
  );
  await runTrayCycle(page, 1);
  await runRestartCycle(page);
  await runTrayCycle(page, 1);
  const resourceBefore = await browserResourceSnapshot(page, cdp);
  await runTrayCycle(page, 3);
  await runRestartCycle(page);
  await runTrayCycle(page, 3);
  const resourceAfter = await browserResourceSnapshot(page, cdp);

  const updatePaint = summarizeSamples(updatePaintSamples);
  const actionLatency = summarizeSamples(actionLatencySamples);
  const objectUrlGrowth =
    resourceAfter.objectUrls.active - resourceBefore.objectUrls.active;
  const obsoleteObjectUrlOverlap = resourceBefore.objectUrls.activeUrls.filter(
    (url) => resourceAfter.objectUrls.activeUrls.includes(url),
  );
  const objectUrlLeak =
    !resourceBefore.objectUrls.activeMatchesMounted ||
    !resourceAfter.objectUrls.activeMatchesMounted ||
    obsoleteObjectUrlOverlap.length > 0;
  const listenerGrowth =
    resourceAfter.listeners.active - resourceBefore.listeners.active;
  const droppedFrames = updatePaintSamples.filter(
    (sample) => sample > 50,
  ).length;
  const removalGate =
    updatePaint.p95 < 50 &&
    actionLatency.p95 < 100 &&
    normalLongTasks.length === 0 &&
    !objectUrlLeak &&
    listenerGrowth === 0;

  const evidence = {
    acceptance: removalGate ? "pass" : "fail",
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
    },
    profile: {
      os: "linux-headless",
      viewport: "1280x720",
      deviceScaleFactor: 1,
      cpuThrottlingRate: 4,
      networkThrottleAfterFixtureLoad: "none",
      warmUpRuns: 5,
      measuredRuns: 30,
      percentileMethod: "nearest-rank",
      markBoundaries: {
        updateToPaint:
          "accepted public browser event/two requestAnimationFrame callbacks",
        inputFeedback: "focus request/two requestAnimationFrame callbacks",
      },
    },
    thresholds: {
      updateToPaintP95Ms: 50,
      inputFeedbackP95Ms: 100,
      normalLongTaskMs: 50,
    },
    workloads: {
      normalPrompt: {
        updateToPaintMs: updatePaint,
        inputFeedbackMs: actionLatency,
        longTasks: normalLongTasks,
      },
      pathological: { reducedMotionAndZoomCoveredByChromiumSuite: true },
      sixtyCardTray: {
        trayCycles: 6,
        objectUrlGrowth,
        activeMatchesMountedBefore:
          resourceBefore.objectUrls.activeMatchesMounted,
        activeMatchesMountedAfter:
          resourceAfter.objectUrls.activeMatchesMounted,
        obsoleteObjectUrlOverlap: obsoleteObjectUrlOverlap.length,
      },
      burst: { restartCycles: 1, listenerGrowth, droppedFrames },
    },
    resources: {
      before: publicResourceSnapshot(resourceBefore),
      after: publicResourceSnapshot(resourceAfter),
    },
    privacy: {
      hiddenOpponentHandInWorkerEvents: false,
      restrictedCardArtInMetrics: false,
    },
  };

  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/df-16-results.json",
    JSON.stringify(evidence, null, 2),
  );
  const artifactPath = testInfo.outputPath("df-16-results.json");
  await writeFile(artifactPath, JSON.stringify(evidence, null, 2));
  await testInfo.attach("df-16-results", {
    path: artifactPath,
    contentType: "application/json",
  });

  expect(updatePaint.p95).toBeLessThan(50);
  expect(actionLatency.p95).toBeLessThan(100);
  expect(normalLongTasks).toHaveLength(0);
  expect(objectUrlLeak).toBe(false);
  expect(listenerGrowth).toBe(0);
  expect(removalGate).toBe(true);
});

test("spatial field navigation has one visible 44px keyboard entry without a trap", async ({
  page,
}, testInfo) => {
  await page.goto("./");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  const field = page.getByRole("region", { name: "Duel field" });
  const board = field.getByRole("group", { name: "Standard duel board" });
  const targets = board.locator("[data-field-target]");
  await expect(targets).not.toHaveCount(0);
  await expect(field.locator("[data-field-target][tabindex='0']")).toHaveCount(
    1,
  );
  await expect(field.locator("[role=application], [role=grid]")).toHaveCount(0);

  const entry = field.locator("[data-field-target][tabindex='0']");
  await keyboardFocus(page, entry);
  expect(
    await entry.evaluate((element) => ({
      focusVisible: element.matches(":focus-visible"),
      outline: getComputedStyle(element).outlineStyle,
    })),
  ).toEqual({ focusVisible: true, outline: "solid" });

  const boxes = await targets.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        target: (element as HTMLElement).dataset.fieldTarget,
        width: box.width,
        height: box.height,
      };
    }),
  );
  expect(boxes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(
    true,
  );

  expect(
    await entry.evaluate(
      (element) =>
        element
          .closest(".duel-field-card")
          ?.getAttribute("data-card-zone-id") === "p0:hand",
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "200%";
  });
  await entry.scrollIntoViewIfNeeded();
  expect(
    await entry.evaluate((element) => ({
      focusVisible: element.matches(":focus-visible"),
      outline: getComputedStyle(element).outlineStyle,
    })),
  ).toEqual({ focusVisible: true, outline: "solid" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "";
  });

  const before = await entry.getAttribute("data-field-target");
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.press(key);
    const active = field.locator(":focus");
    await expect(active).toHaveAttribute("data-field-target", /.+/);
    if ((await active.getAttribute("data-field-target")) !== before) break;
  }
  await page.keyboard.press("Tab");
  await expect(board.locator(":focus")).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(board.locator(":focus")).toHaveCount(1);

  const evidencePath = testInfo.outputPath("df-14-keyboard-field.json");
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        oneTabStop: true,
        focusVisible: true,
        zoom200FocusVisible: true,
        overlappingHandFocusVisible: true,
        boxes,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("df-14-keyboard-field", {
    path: evidencePath,
    contentType: "application/json",
  });
});

test("a full preset duel can be completed using keyboard controls only with one response per prompt", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  await page.goto("./");
  await startPresetDuel(page);
  await expect(
    page.locator('[data-cy="duel-field"][data-prompt-kind]'),
  ).toBeVisible({
    timeout: 120_000,
  });
  // This walker answers every prompt itself and asserts exactly one response
  // per prompt id. T4's default-on auto-answer of trivial prompts (chain
  // Pass, single-option, single-position) resolves those from a background
  // `queueMicrotask` and would race this walker's own async round trip for
  // the same prompts, so the walk turns the setting off first — exactly the
  // choice a player who wants full manual control would make. T5's default-on
  // auto-placement is the same class of race for `selectPlace` prompts the
  // walker means to answer by hand, so it is turned off too.
  await disableAutoResolveTrivialPrompts(page);
  await disableAutoPlaceCards(page);
  await expect(
    (await activePromptControls(page)).getByRole("button").first(),
  ).toBeEnabled({ timeout: 30_000 });

  const field = page.getByRole("region", { name: "Duel field" });
  const answeredPromptIds = new Set<string>();
  // Opponent hand cards render upright, so the only sideways cards in a duel are
  // real defense-position monsters. Ask the walker to produce one so the
  // focus-visibility assertion on rotated card art has something to focus.
  const setup = { needsDefense: true };
  let fieldResponses = 0;
  let fieldActionBarGeometryChecks = 0;
  let defenseFocusVisible = false;
  for (let step = 0; step < 200; step += 1) {
    const result = page.locator(".result-panel");
    if (await result.isVisible()) break;

    const controls = await activePromptControls(page);
    await controls.waitFor({ state: "visible", timeout: 30_000 });
    const kind = await controls.getAttribute("data-prompt-kind");
    if (kind === null) throw new Error("Prompt kind is missing");
    const prompt = [...(await readCapture(page)).events]
      .reverse()
      .find((event) => event.type === "prompt") as
      (CapturedPromptEvent & Readonly<Record<string, unknown>>) | undefined;
    if (prompt === undefined) throw new Error("Captured prompt is missing");
    if (!defenseFocusVisible) {
      const defenseTarget = field
        .locator(
          ".duel-field-card[data-orientation='sideways'] [data-field-target], .duel-field-card[data-orientation='sideways'][data-field-target]",
        )
        .first();
      const defenseOnBoard =
        (await defenseTarget.count()) > 0 && (await defenseTarget.isVisible());
      if (defenseOnBoard)
        defenseFocusVisible = await focusSidewaysCardWithKeyboard(page, field);
      // Whether a given Main Phase offers a settable monster depends on the
      // duel's random seed, so one opportunistic attempt is not enough: keep
      // asking every Main Phase until the board actually holds a sideways
      // card, and ask again if that card leaves the board before the walker
      // managed to focus it.
      setup.needsDefense = !defenseFocusVisible && !defenseOnBoard;
    }
    const responseCountBefore = (await readCapture(page)).commands.filter(
      (command) =>
        command.type === "respond" && command.promptId === prompt.prompt.id,
    ).length;
    const actionBar = field.locator('[data-cy="field-action-bar"]');
    if (fieldActionBarGeometryChecks === 0 && (await actionBar.count()) > 0) {
      await assertFieldActionBarGeometry(
        page,
        field,
        `full-duel ${kind} prompt`,
      );
      fieldActionBarGeometryChecks += 1;
    }

    if (
      (await answerPromptWithKeyboard(page, controls, kind, setup)) === "field"
    )
      fieldResponses += 1;
    // The field surface reuses `section.duel-field` across prompts and only
    // mutates its `data-prompt-kind` attribute in place (no element swap),
    // and consecutive prompts can share the same kind (e.g. two idleCommand
    // decisions in a row), so neither "element disconnected" nor "kind
    // changed" reliably signals the engine moved past this prompt. The
    // engine's own prompt id is the one thing guaranteed to change (or the
    // duel to complete), so wait on that directly.
    await expect
      .poll(
        async () => {
          if (await result.isVisible()) return true;
          const latest = [...(await readCapture(page)).events]
            .reverse()
            .find((event) => event.type === "prompt") as
            | (CapturedPromptEvent & Readonly<Record<string, unknown>>)
            | undefined;
          return latest !== undefined && latest.prompt.id !== prompt.prompt.id;
        },
        { timeout: 30_000 },
      )
      .toBe(true);
    await expect
      .poll(
        async () =>
          (await readCapture(page)).commands.filter(
            (command) =>
              command.type === "respond" &&
              command.promptId === prompt.prompt.id,
          ).length,
      )
      .toBe(responseCountBefore + 1);
    expect(answeredPromptIds.has(prompt.prompt.id)).toBe(false);
    answeredPromptIds.add(prompt.prompt.id);
  }

  expect(answeredPromptIds.size).toBeGreaterThan(0);
  expect(fieldResponses).toBeGreaterThan(0);
  // Prevent `count() > 0` from silently deleting the geometry gate.
  expect(fieldActionBarGeometryChecks).toBeGreaterThan(0);
  expect(defenseFocusVisible).toBe(true);
  for (const promptId of answeredPromptIds) {
    expect(
      (await readCapture(page)).commands.filter(
        (command) =>
          command.type === "respond" && command.promptId === promptId,
      ),
    ).toHaveLength(1);
  }

  const result = page.locator(".result-panel");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText(/You won|Opponent won/);
  await expect(result).not.toContainText("surrendered");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    result.getByRole("button", { name: "Download diagnostics" }).click(),
  ]);
  const downloadPath = await download.path();
  if (downloadPath === null) throw new Error("Diagnostic download has no path");
  const diagnostics = JSON.parse(await readFile(downloadPath, "utf8")) as {
    readonly schemaVersion: number;
    readonly sensitivity: string;
    readonly application: { readonly buildId: string };
    readonly trace: {
      readonly seed: readonly string[];
      readonly entries: readonly unknown[];
    };
  };
  expect(diagnostics).toMatchObject({
    schemaVersion: 2,
    sensitivity: "contains-production-seed",
    application: { buildId: expect.stringMatching(/^0\.1\.0\+/) },
  });
  expect(diagnostics.trace.seed).toHaveLength(4);
  expect(diagnostics.trace.entries.length).toBeGreaterThan(0);

  const evidencePath = testInfo.outputPath("df-14-full-keyboard-duel.json");
  await writeFile(
    evidencePath,
    JSON.stringify(
      {
        completedWithoutPointer: true,
        result: await result.getByRole("heading").textContent(),
        responses: answeredPromptIds.size,
        fieldResponses,
        fieldActionBarGeometryChecks,
        duplicateResponses: 0,
        defenseFocusVisible,
      },
      null,
      2,
    ),
  );
  await testInfo.attach("df-14-full-keyboard-duel", {
    path: evidencePath,
    contentType: "application/json",
  });
});

// Non-field prompts render inside the modal dialog while field-capable
// prompts render on `section.duel-field` itself, and `section.duel-field`
// always carries `data-prompt-kind` as a readiness marker (T5). When a
// non-field prompt is open, both elements carry the attribute at once, so
// callers that need the one actually hosting live controls must prefer the
// dialog when it is present.
async function activePromptControls(page: Page): Promise<Locator> {
  const dialogControls = page.locator(
    '[data-cy="prompt-dialog"] [data-prompt-kind]',
  );
  if ((await dialogControls.count()) > 0) return dialogControls;
  return page.locator('[data-cy="duel-field"][data-prompt-kind]');
}

async function answerPromptWithKeyboard(
  page: Page,
  controls: Locator,
  kind: string,
  setup: { needsDefense: boolean },
): Promise<"field" | "prompt"> {
  const field = page.getByRole("region", { name: "Duel field" });
  switch (kind) {
    case "idleCommand":
      if (setup.needsDefense && (await setHandMonsterWithKeyboard(page, field)))
        return "field";
      await activatePreferredButton(page, field, [
        "End turn",
        "Enter Battle Phase",
      ]);
      return "field";
    case "battleCommand":
      await activatePreferredButton(page, field, [
        "Enter Main Phase 2",
        "End Battle Phase",
      ]);
      return "field";
    case "yesNo":
    case "effectYesNo":
      await activatePreferredButton(page, controls, ["No"]);
      return "prompt";
    case "chain":
      await expect(page.locator('[data-cy="prompt-dialog"]')).toHaveCount(0);
      await expect(
        page.locator('[data-cy="card-preview-status"]', {
          hasText: "Do you respond?",
        }),
      ).toHaveAttribute("data-has-priority", "true");
      await answerChainOnField(page, field);
      return "field";
    case "selectUnselectCard":
      if (
        (await hasEnabledButton(field, "Finish")) ||
        (await hasEnabledButton(field, "Cancel"))
      ) {
        await activatePreferredButton(page, field, ["Finish", "Cancel"]);
        return "field";
      }
      await activatePreferredButton(page, controls, ["Finish", "Cancel"]);
      return "prompt";
    case "sortCard":
    case "sortChain":
      if (
        await field
          .getByRole("button", { name: "Confirm order" })
          .isVisible()
          .catch(() => false)
      ) {
        await keyboardActivate(
          page,
          field.getByRole("button", { name: "Confirm order" }),
        );
        return "field";
      }
      await keyboardActivate(
        page,
        controls.getByRole("button", { name: "Confirm order" }),
      );
      return "prompt";
    case "selectCounter":
      if (
        await field
          .getByRole("button", { name: "Confirm allocation" })
          .isVisible()
          .catch(() => false)
      ) {
        await allocateCounters(page, field);
        return "field";
      }
      await allocateCounters(page, controls);
      return "prompt";
    case "selectCard":
    case "selectTribute":
    case "selectSum":
    case "selectPlace":
    case "selectDisabledField":
      if (await chooseValidFieldSubset(page, field)) return "field";
      await chooseValidCheckboxSubset(page, controls);
      return "prompt";
    case "announceAttribute":
    case "announceRace":
      await chooseValidCheckboxSubset(page, controls);
      return "prompt";
    default:
      await activatePreferredButton(page, controls, []);
      return "prompt";
  }
}

// The engine labels both `setMonster` and `setSpellTrap` "Set <card>", and the
// chips collapse both to the word "Set", so the walker matches the engine
// action id carried by each chip's `data-cy` instead of its text. Matching the
// label is what made this walker non-deterministic: a hand whose first
// actionable card was a spell or trap set a backrow card, which renders
// upright, and the duel then never gained a sideways card at all.
// The suffix match survives the rename away from the old action menu
// untouched: its items ended in `-choice-${choice.id}` and chips are
// `card-action-chip-${choice.id}`, so both still end in `-setMonster`.
const MONSTER_SET_ACTION = "setMonster";
const MONSTER_SET_CHIP = `[data-cy$="-${MONSTER_SET_ACTION}"]`;

/**
 * Sets one hand monster face-down using only the keyboard, so the board gains a
 * genuine defense-position (sideways) card. Every hand card is inspected, so
 * the result does not depend on the order the duel's random seed dealt the
 * hand. Returns false when no hand card offers a monster set, leaving the
 * prompt unanswered for the caller to end the turn and try again next Main
 * Phase.
 */
async function setHandMonsterWithKeyboard(
  page: Page,
  field: Locator,
): Promise<boolean> {
  const openers = field.getByRole("button", {
    name: /^Legal action, Open actions for .+ in Your Hand$/,
  });
  for (let index = 0; index < (await openers.count()); index += 1) {
    const opener = openers.nth(index);
    if (!(await opener.isEnabled())) continue;
    const cardId = ((await opener.getAttribute("data-cy")) ?? "").replace(
      /^field-card-target-/,
      "",
    );
    const chips = field.locator(`[data-cy="card-action-chips-${cardId}"]`);
    const chipButtonCount = await chips.locator("button").count();
    if (chipButtonCount === 0) continue;
    if (chipButtonCount === 1) {
      // A single-choice card fires that choice directly on activation (T5)
      // instead of pinning a menu, so this helper only bothers activating it
      // when the one choice on offer is the monster set it exists to produce.
      if ((await chips.locator(MONSTER_SET_CHIP).count()) === 0) continue;
      await keyboardActivate(page, opener);
      // The response goes pending, which drops the card out of its
      // actionable state and unmounts these chips with it. Waiting on that
      // keeps the caller from racing the next prompt.
      await expect(chips).toBeHidden();
      return true;
    }
    await keyboardActivate(page, opener);
    // Activating the card pins its chips and moves focus onto the first one;
    // waiting for that focus to land is what makes the arrow walk below
    // deterministic.
    await expect(chips).toBeVisible();
    await expect(chips.locator(":focus")).toHaveCount(1);
    if ((await chips.locator(MONSTER_SET_CHIP).count()) > 0) {
      const items = chips.locator("button");
      for (let move = 0; move < (await items.count()); move += 1) {
        const focused = chips.locator(":focus");
        if ((await focused.count()) === 0) break;
        const focusedId = (await focused.getAttribute("data-cy")) ?? "";
        if (focusedId.endsWith(`-${MONSTER_SET_ACTION}`)) {
          await page.keyboard.press("Enter");
          // The response goes pending, which drops the card out of its
          // actionable state and unmounts these chips with it. Waiting on that
          // keeps the caller from racing the next prompt.
          await expect(chips).toBeHidden();
          return true;
        }
        await page.keyboard.press("ArrowRight");
      }
    }
    // Escape unpins and returns focus to the card target. The chips stay
    // mounted and stay shown while that target holds focus, so the check is
    // that focus came home, not that anything was removed.
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  }
  return false;
}

async function hasEnabledButton(
  scope: Locator,
  label: string,
): Promise<boolean> {
  const candidate = scope.getByRole("button", { name: label, exact: true });
  return (
    (await candidate.count()) > 0 &&
    (await candidate.first().isVisible()) &&
    (await candidate.first().isEnabled())
  );
}

async function answerChainOnField(page: Page, field: Locator): Promise<void> {
  if (await hasEnabledButton(field, "Pass")) {
    await activatePreferredButton(page, field, ["Pass"]);
    return;
  }

  const globalChoice = field
    .locator('[data-cy^="field-action-bar-choice-"]:enabled')
    .first();
  if ((await globalChoice.count()) > 0) {
    await keyboardActivate(page, globalChoice);
    return;
  }

  const cardTarget = field
    .locator("[data-field-target][aria-label^='Legal action']")
    .first();
  if ((await cardTarget.count()) > 0) {
    const cardId = ((await cardTarget.getAttribute("data-cy")) ?? "").replace(
      /^field-card-target-/,
      "",
    );
    const chips = field.locator(`[data-cy="card-action-chips-${cardId}"]`);
    const chipButtons = chips.getByRole("button");
    const choiceCount = await chipButtons.count();
    await keyboardActivate(page, cardTarget);
    if (choiceCount > 1) {
      await expect(chips).toBeVisible();
      await keyboardActivate(page, chipButtons.first());
    }
    return;
  }

  const stack = field
    .locator('[data-cy^="field-stack-"].is-actionable')
    .first();
  if ((await stack.count()) > 0) {
    await keyboardActivate(page, stack);
    const dialog = page.locator('[data-cy="zone-list-dialog"]');
    await expect(dialog).toBeVisible();
    const buttons = dialog.getByRole("button");
    for (let index = 0; index < (await buttons.count()); index += 1) {
      const button = buttons.nth(index);
      const name =
        (await button.getAttribute("aria-label")) ??
        (await button.textContent()) ??
        "";
      if (!/^Close\b/.test(name.trim()) && (await button.isEnabled())) {
        await keyboardActivate(page, button);
        return;
      }
    }
  }

  throw new Error("Inline chain prompt has no enabled field response");
}

async function chooseValidFieldSubset(
  page: Page,
  field: Locator,
): Promise<boolean> {
  const confirm = field.getByRole("button", {
    name: /Confirm (selection|placement)/,
  });
  const choices = field.locator("[data-field-target][aria-pressed]");
  if ((await confirm.count()) === 0) {
    // A single-place prompt (auto-place off) submits the instant any one of
    // its legal zones is clicked: no Confirm bar ever renders for it.
    const count = await choices.count();
    if (count === 0) return false;
    await keyboardActivate(page, choices.first());
    return true;
  }
  if (await confirm.isEnabled()) {
    await keyboardActivate(page, confirm);
    return true;
  }
  const count = await choices.count();
  if (count === 0 || count > 12) return false;
  for (let mask = 1; mask < 1 << count; mask += 1) {
    for (let index = 0; index < count; index += 1) {
      const choice = choices.nth(index);
      const desired = (mask & (1 << index)) !== 0;
      if (((await choice.getAttribute("aria-pressed")) === "true") !== desired)
        await keyboardActivate(page, choice);
    }
    if (await confirm.isEnabled()) {
      await keyboardActivate(page, confirm);
      return true;
    }
  }
  return false;
}

async function activatePreferredButton(
  page: Page,
  controls: Locator,
  labels: readonly string[],
): Promise<void> {
  for (const label of labels) {
    const candidate = controls.getByRole("button", {
      name: label,
      exact: true,
    });
    if ((await candidate.count()) > 0 && (await candidate.isEnabled())) {
      await keyboardActivate(page, candidate);
      return;
    }
  }
  const candidates = controls.getByRole("button");
  for (let index = 0; index < (await candidates.count()); index += 1) {
    const candidate = candidates.nth(index);
    if (await candidate.isEnabled()) {
      await keyboardActivate(page, candidate);
      return;
    }
  }
  throw new Error("Prompt has no enabled button");
}

async function chooseValidCheckboxSubset(
  page: Page,
  controls: Locator,
): Promise<void> {
  const confirm = controls.getByRole("button", { name: "Confirm selection" });
  if (await confirm.isEnabled()) {
    await keyboardActivate(page, confirm);
    return;
  }
  const checkboxes = controls.getByRole("checkbox");
  const count = await checkboxes.count();
  if (count > 12) throw new Error(`Cannot enumerate ${count} prompt choices`);

  for (let mask = 1; mask < 1 << count; mask += 1) {
    for (let index = 0; index < count; index += 1) {
      const checkbox = checkboxes.nth(index);
      const desired = (mask & (1 << index)) !== 0;
      if ((await checkbox.isChecked()) !== desired)
        await keyboardActivate(page, checkbox);
    }
    if (await confirm.isEnabled()) {
      await keyboardActivate(page, confirm);
      return;
    }
  }

  const cancel = controls.getByRole("button", { name: "Cancel", exact: true });
  if ((await cancel.count()) > 0) {
    await keyboardActivate(page, cancel);
    return;
  }
  throw new Error("No valid checkbox selection was found");
}

async function allocateCounters(page: Page, controls: Locator): Promise<void> {
  const confirm = controls.getByRole("button", { name: "Confirm allocation" });
  const addButtons = controls.getByRole("button", {
    name: /Add one counter to/,
  });
  for (
    let attempt = 0;
    attempt < 256 && !(await confirm.isEnabled());
    attempt += 1
  ) {
    let allocated = false;
    for (let index = 0; index < (await addButtons.count()); index += 1) {
      const add = addButtons.nth(index);
      if (await add.isEnabled()) {
        await keyboardActivate(page, add);
        allocated = true;
        break;
      }
    }
    if (!allocated) throw new Error("Counter prompt has no valid allocation");
  }
  await keyboardActivate(page, confirm);
}

async function focusSidewaysCardWithKeyboard(
  page: Page,
  field: Locator,
): Promise<boolean> {
  await keyboardFocus(page, field.locator("[data-field-target][tabindex='0']"));
  if (await sweepRowsUpwardForSidewaysCard(page, field)) return true;
  // The sweep only walks rows upwards, so every row below wherever roving
  // focus happened to sit stayed unvisited - and which row that is depends on
  // the prompt the duel is currently on. Drop to the bottom row and sweep the
  // rest of the board.
  for (let move = 0; move < 16; move += 1) {
    const target = await field
      .locator(":focus")
      .getAttribute("data-field-target");
    await page.keyboard.press("ArrowDown");
    if (
      (await field.locator(":focus").getAttribute("data-field-target")) ===
      target
    )
      break;
  }
  return await sweepRowsUpwardForSidewaysCard(page, field);
}

/**
 * Walks the board upwards row by row from the focused control, asserting the
 * focus ring on the first sideways card it lands on. Returns false when the
 * sweep runs out of board without meeting one.
 */
async function sweepRowsUpwardForSidewaysCard(
  page: Page,
  field: Locator,
): Promise<boolean> {
  for (let row = 0; row < 12; row += 1) {
    await page.keyboard.press("Home");
    for (let column = 0; column < 24; column += 1) {
      const active = field.locator(":focus");
      if (
        await active.evaluate(
          (element) =>
            element
              .closest(".duel-field-card")
              ?.getAttribute("data-orientation") === "sideways",
        )
      ) {
        const focusStyle = await active.evaluate((element) => {
          const card = element.closest<HTMLElement>(".duel-field-card");
          const visual = element.matches(".duel-field-card")
            ? element
            : card?.querySelector<HTMLElement>(".duel-field-card__art");
          return {
            active: card?.classList.contains("is-navigation-active") ?? false,
            outline: visual && getComputedStyle(visual).outlineStyle,
          };
        });
        expect(focusStyle).toEqual({ active: true, outline: "solid" });
        return true;
      }
      const target = await active.getAttribute("data-field-target");
      await page.keyboard.press("ArrowRight");
      if (
        (await field.locator(":focus").getAttribute("data-field-target")) ===
        target
      )
        break;
    }
    await page.keyboard.press("Home");
    const target = await field
      .locator(":focus")
      .getAttribute("data-field-target");
    await page.keyboard.press("ArrowUp");
    if (
      (await field.locator(":focus").getAttribute("data-field-target")) ===
      target
    )
      break;
  }
  return false;
}

async function keyboardActivate(page: Page, target: Locator): Promise<void> {
  await keyboardFocus(page, target);
  const element = await target.elementHandle();
  if (element === null) throw new Error("Keyboard target disappeared");
  const isCheckbox = await element.evaluate(
    (node) => node instanceof HTMLInputElement && node.type === "checkbox",
  );
  await page.keyboard.press(isCheckbox ? "Space" : "Enter");
}

async function keyboardFocus(page: Page, target: Locator): Promise<void> {
  await target.waitFor({ state: "visible" });
  const fieldTarget = await target.getAttribute("data-field-target");
  if (fieldTarget !== null) {
    await keyboardFocusFieldTarget(page, target, fieldTarget);
    return;
  }
  await keyboardTabFocus(page, target);
}

async function keyboardFocusFieldTarget(
  page: Page,
  target: Locator,
  fieldTarget: string,
): Promise<void> {
  const board = target.locator(
    "xpath=ancestor::*[@aria-label='Standard duel board']",
  );
  await keyboardTabFocus(
    page,
    board.locator("[data-field-target][tabindex='0']"),
  );
  for (let move = 0; move < 24; move += 1) {
    const active = board.locator(":focus");
    if ((await active.getAttribute("data-field-target")) === fieldTarget)
      return;
    const before = await active.getAttribute("data-field-target");
    await page.keyboard.press("ArrowDown");
    if (
      (await board.locator(":focus").getAttribute("data-field-target")) ===
      before
    )
      break;
  }
  for (let row = 0; row < 16; row += 1) {
    await page.keyboard.press("Home");
    for (let column = 0; column < 32; column += 1) {
      const active = board.locator(":focus");
      if ((await active.getAttribute("data-field-target")) === fieldTarget)
        return;
      const before = await active.getAttribute("data-field-target");
      await page.keyboard.press("ArrowRight");
      if (
        (await board.locator(":focus").getAttribute("data-field-target")) ===
        before
      )
        break;
    }
    await page.keyboard.press("Home");
    const before = await board
      .locator(":focus")
      .getAttribute("data-field-target");
    await page.keyboard.press("ArrowUp");
    if (
      (await board.locator(":focus").getAttribute("data-field-target")) ===
      before
    )
      break;
  }
  throw new Error(
    `Unable to spatially focus keyboard target: ${await target.getAttribute("aria-label")}`,
  );
}

async function keyboardTabFocus(page: Page, target: Locator): Promise<void> {
  await target.waitFor({ state: "visible" });
  const element = await target.elementHandle();
  if (element === null) throw new Error("Keyboard target disappeared");
  for (let tab = 0; tab < 256; tab += 1) {
    if (await element.evaluate((node) => document.activeElement === node))
      break;
    await page.keyboard.press("Tab");
  }
  if (!(await element.evaluate((node) => document.activeElement === node))) {
    throw new Error(
      `Unable to focus keyboard target: ${await target.getAttribute("aria-label")}`,
    );
  }
}

async function captureResponsiveState(
  page: Page,
  testInfo: TestInfo,
  viewportId: string,
  stateId: "ST-01" | "ST-05" | "ST-09",
): Promise<void> {
  const screenshotPath = testInfo.outputPath(
    `df-15-${viewportId}-${stateId}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`df-15-${viewportId}-${stateId}`, {
    path: screenshotPath,
    contentType: "image/png",
  });
}

async function assertSharesFieldRow(page: Page, label: string): Promise<void> {
  const boxes = await page.evaluate(() => {
    const rect = (selector: string): DOMRect | null =>
      document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const fieldBox = rect('[data-cy="duel-field"]');
    const panelBox = rect('[data-cy="card-preview-panel"]');
    return fieldBox === null || panelBox === null
      ? null
      : {
          fieldY: fieldBox.y,
          panelY: panelBox.y,
          fieldHeight: fieldBox.height,
          panelHeight: panelBox.height,
          fieldLeft: fieldBox.left,
          panelRight: panelBox.right,
        };
  });
  if (boxes === null) throw new Error(`${label}: missing field or panel box`);
  expect(
    Math.abs(boxes.fieldY - boxes.panelY),
    `${label} shares the field row top (${boxes.fieldY} vs ${boxes.panelY})`,
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(boxes.fieldHeight - boxes.panelHeight),
    `${label} matches the field height (${boxes.fieldHeight} vs ${boxes.panelHeight})`,
  ).toBeLessThanOrEqual(2);
  // The preview panel is the LEFT column of `.duel-row` (moved there ahead
  // of this ticket); it must sit to the left of the field, not beside it on
  // the right or over it.
  expect(
    boxes.panelRight,
    `${label} sits left of the field, not over it`,
  ).toBeLessThanOrEqual(boxes.fieldLeft + 1);
}

async function assertNoPageWideHorizontalOverflow(
  page: Page,
  label: string,
): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      bodyScrollWidth: document.body.scrollWidth,
      rootScrollWidth: root.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(
    Math.max(metrics.bodyScrollWidth, metrics.rootScrollWidth),
    `${label} page-wide horizontal overflow`,
  ).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

async function assertFieldActionBarGeometry(
  page: Page,
  field: Locator,
  label: string,
): Promise<void> {
  const bar = field.locator('[data-cy="field-action-bar"]');
  await expect(bar).toBeVisible();
  await bar.scrollIntoViewIfNeeded();
  await assertRectInsideViewport(page, bar, `${label} field action bar`);
  const board = field.getByRole("group", { name: "Standard duel board" });
  const barRect = await bar.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
  const boardRect = await board.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom };
  });
  expect(
    barRect.top,
    `${label} field action bar (top ${barRect.top}) must clear the duel board (bottom ${boardRect.bottom})`,
  ).toBeGreaterThanOrEqual(boardRect.bottom - 1);
}

async function assertRectInsideViewport(
  page: Page,
  target: Locator,
  label: string,
): Promise<void> {
  const rect = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      width: box.width,
      height: box.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
  expect(rect.width, `${label} width`).toBeGreaterThan(0);
  expect(rect.height, `${label} height`).toBeGreaterThan(0);
  expect(rect.left, `${label} left`).toBeGreaterThanOrEqual(-1);
  expect(rect.top, `${label} top`).toBeGreaterThanOrEqual(-1);
  expect(rect.right, `${label} right`).toBeLessThanOrEqual(
    rect.viewportWidth + 1,
  );
  expect(rect.bottom, `${label} bottom`).toBeLessThanOrEqual(
    rect.viewportHeight + 1,
  );
}

async function measureTwoFrameLatency(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const startedAt = performance.now();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(performance.now() - startedAt));
        });
      }),
  );
}

async function measureFocusFeedbackLatency(page: Page): Promise<number> {
  const field = page.getByRole("region", { name: "Duel field" });
  const target = field.locator("[data-field-target]").first();
  await target.waitFor({ state: "visible" });
  return target.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const startedAt = performance.now();
        (element as HTMLElement).focus();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve(performance.now() - startedAt));
        });
      }),
  );
}

function summarizeSamples(samples: readonly number[]): {
  readonly p50: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
  readonly samples: readonly number[];
} {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: nearestRank(sorted, 50),
    p95: nearestRank(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted.at(-1) ?? 0,
    samples,
  };
}

function nearestRank(
  sortedSamples: readonly number[],
  percentile: number,
): number {
  if (sortedSamples.length === 0) return 0;
  const rank = Math.ceil((percentile / 100) * sortedSamples.length);
  return sortedSamples[Math.max(0, rank - 1)] ?? 0;
}

async function browserResourceSnapshot(
  page: Page,
  cdp: CDPSession,
): Promise<{
  readonly heapUsedBytes: number | null;
  readonly objectUrls: {
    readonly active: number;
    readonly created: number;
    readonly revoked: number;
    readonly activeUrls: readonly string[];
    readonly mountedUrls: readonly string[];
    readonly activeMatchesMounted: boolean;
  };
  readonly listeners: {
    readonly active: number;
    readonly added: number;
    readonly removed: number;
  };
}> {
  await cdp.send("HeapProfiler.collectGarbage").catch(() => undefined);
  const metrics = (await cdp.send("Performance.getMetrics").catch(() => ({
    metrics: [],
  }))) as {
    readonly metrics?: readonly {
      readonly name: string;
      readonly value: number;
    }[];
  };
  const heapUsed = metrics.metrics?.find(
    ({ name }) => name === "JSHeapUsedSize",
  )?.value;
  const capture = await page.evaluate(() => {
    const activeUrls = [...window.__duelCapture.imageUrls.active].sort();
    const mountedUrls = [
      ...new Set(
        [...document.querySelectorAll<HTMLImageElement>("img")]
          .map((image) => image.currentSrc || image.src)
          .filter((src) => src.startsWith("blob:")),
      ),
    ].sort();
    return {
      objectUrls: {
        active: activeUrls.length,
        created: window.__duelCapture.imageUrls.created.length,
        revoked: window.__duelCapture.imageUrls.revoked.length,
        activeUrls,
        mountedUrls,
        activeMatchesMounted:
          activeUrls.length === mountedUrls.length &&
          activeUrls.every((url, index) => url === mountedUrls[index]),
      },
      listeners: {
        active:
          window.__duelCapture.listeners.added -
          window.__duelCapture.listeners.removed,
        added: window.__duelCapture.listeners.added,
        removed: window.__duelCapture.listeners.removed,
      },
    };
  });
  return {
    heapUsedBytes: heapUsed ?? null,
    objectUrls: capture.objectUrls,
    listeners: capture.listeners,
  };
}

function publicResourceSnapshot(
  snapshot: Awaited<ReturnType<typeof browserResourceSnapshot>>,
): {
  readonly heapUsedBytes: number | null;
  readonly objectUrls: {
    readonly active: number;
    readonly created: number;
    readonly revoked: number;
    readonly mounted: number;
    readonly activeMatchesMounted: boolean;
  };
  readonly listeners: {
    readonly active: number;
    readonly added: number;
    readonly removed: number;
  };
} {
  return {
    heapUsedBytes: snapshot.heapUsedBytes,
    objectUrls: {
      active: snapshot.objectUrls.active,
      created: snapshot.objectUrls.created,
      revoked: snapshot.objectUrls.revoked,
      mounted: snapshot.objectUrls.mountedUrls.length,
      activeMatchesMounted: snapshot.objectUrls.activeMatchesMounted,
    },
    listeners: snapshot.listeners,
  };
}

async function openSettingsDialog(page: Page): Promise<void> {
  await page.locator('[data-cy="app-menubar-settings-button"]').click();
  await page.locator('[data-cy="menu-dialog-settings-button"]').click();
}

async function enableDuelHud(page: Page): Promise<void> {
  await openSettingsDialog(page);
  await page.locator('[data-cy="settings-show-duel-hud-checkbox"]').check();
  await page.locator('[data-cy="settings-dialog-close-button"]').click();
}

async function disableAutoResolveTrivialPrompts(page: Page): Promise<void> {
  await openSettingsDialog(page);
  await page.locator('[data-cy="settings-auto-resolve-checkbox"]').uncheck();
  await page.locator('[data-cy="settings-dialog-close-button"]').click();
}

async function disableAutoPlaceCards(page: Page): Promise<void> {
  await openSettingsDialog(page);
  await page
    .locator('[data-cy="settings-auto-place-cards-checkbox"]')
    .uncheck();
  await page.locator('[data-cy="settings-dialog-close-button"]').click();
}

async function enableWorkspace(page: Page): Promise<void> {
  await openSettingsDialog(page);
  await page.locator('[data-cy="settings-show-workspace-checkbox"]').check();
  await page.locator('[data-cy="settings-dialog-close-button"]').click();
}

async function surrenderThroughMenu(page: Page): Promise<void> {
  await page.locator('[data-cy="app-menubar-settings-button"]').click();
  await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
  await page
    .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
    .click();
}

async function runTrayCycle(page: Page, cycles: number): Promise<void> {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const trayButton = page
      .getByRole("button", { name: /Open Your (Extra Deck|GY|Banished) tray/ })
      .first();
    if ((await trayButton.count()) === 0) return;
    await trayButton.click();
    const tray = page.getByRole("region", {
      name: /Your (Extra Deck|GY|Banished) tray/,
    });
    await expect(tray).toBeVisible();
    await tray.getByRole("button", { name: /^Close / }).click();
    await expect(tray).toHaveCount(0);
  }
}

async function runRestartCycle(page: Page): Promise<void> {
  await surrenderThroughMenu(page);
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start another duel" }).click();
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
}

async function mountedImageLeaseState(page: Page): Promise<{
  readonly activeCount: number;
  readonly activeMatchesMounted: boolean;
  readonly activeUrls: readonly string[];
  readonly mountedUrls: readonly string[];
}> {
  return page.evaluate(() => {
    const activeUrls = [...window.__duelCapture.imageUrls.active].sort();
    const mountedUrls = [
      ...new Set(
        [...document.querySelectorAll<HTMLImageElement>("img")]
          .map((image) => image.currentSrc || image.src)
          .filter((url) => url.startsWith("blob:")),
      ),
    ].sort();
    return {
      activeCount: activeUrls.length,
      activeMatchesMounted:
        activeUrls.length === mountedUrls.length &&
        activeUrls.every((url, index) => url === mountedUrls[index]),
      activeUrls,
      mountedUrls,
    };
  });
}

async function readCapture(page: Page): Promise<BrowserCapture> {
  return page.evaluate(
    () =>
      (
        window as unknown as Window & {
          readonly __duelCapture: BrowserCapture;
        }
      ).__duelCapture,
  );
}
