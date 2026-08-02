import { readFile, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
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

  await expect(
    page
      .getByRole("region", { name: "Current decision" })
      .getByRole("heading", { name: "Choose a Main Phase action" }),
  ).toBeVisible({ timeout: 120_000 });
  expect(Date.now() - startupBeganAt).toBeLessThan(15_000);
  await expect(page.getByText("ocgcore 11.0")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your turn" })).toBeVisible();
  await expect(page.getByText("8,000 LP").first()).toBeVisible();
  const field = page.getByRole("region", { name: "Duel field" });
  await expect(field).toBeVisible();
  await expect(field.locator("canvas")).toHaveCount(0);
  await expect(field.locator("[data-zone-id]")).toHaveCount(34);
  await expect(
    field.getByRole("article", { name: /Hidden opponent hand card/ }).first(),
  ).toBeVisible();
  await expect(field.getByRole("img").first()).toHaveAttribute("src", /.+/);

  const promptHeading = page
    .getByRole("region", { name: "Current decision" })
    .getByRole("heading", {
      name: "Choose a Main Phase action",
    });
  await expect(promptHeading).toBeFocused();

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

test("duel HUD keeps hidden stacks count-only and tray image work mounted on demand", async ({
  page,
}, testInfo) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/runtime\/images\/\d+\.jpg$/.test(request.url()))
      imageRequests.push(request.url());
  });
  await page.goto("./");

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
  for (let cycle = 1; cycle <= 2; cycle += 1) {
    await expect(page.locator("[data-prompt-kind]")).toBeVisible({
      timeout: 120_000,
    });
    await page.getByRole("button", { name: "Surrender duel" }).click();
    if (cycle === 1) {
      await page.getByRole("button", { name: "Keep playing" }).click();
      await expect(
        page.getByRole("button", { name: "Surrender duel" }),
      ).toBeFocused();
      await page.getByRole("button", { name: "Surrender duel" }).click();
    }
    await page.getByRole("button", { name: "Confirm surrender" }).click();
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
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
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
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });

  await page.getByRole("button", { name: "Surrender duel" }).click();
  await page.getByRole("button", { name: "Confirm surrender" }).click();
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
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
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
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
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

  await page.getByRole("button", { name: "Surrender duel" }).click();
  await page.getByRole("button", { name: "Confirm surrender" }).click();
  await expect(
    page.getByRole("heading", { name: "Duel surrendered" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start another duel" }).click();
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
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
  await blocked;
  const controls = page.locator("[data-prompt-kind]");
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
  const controls = page.locator("[data-prompt-kind]");
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
  await expect(
    page.getByRole("heading", { name: "Interactive field could not render" }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(
    page.getByText("Injected duel field component failure"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Surrender duel" }),
  ).toBeVisible();
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
  await expect(fieldRegion.locator("canvas")).toHaveCount(0);
  const firstDecision = page.locator("[data-prompt-kind] button").first();
  const box = await firstDecision.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(box?.width).toBeGreaterThanOrEqual(44);
});

test("spatial field navigation has one visible 44px keyboard entry without a trap", async ({
  page,
}, testInfo) => {
  await page.goto("./");
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
  await page.goto("./");
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.locator("[data-prompt-kind] button:enabled").first(),
  ).toBeVisible({ timeout: 30_000 });

  const field = page.getByRole("region", { name: "Duel field" });
  const answeredPromptIds = new Set<string>();
  let fieldResponses = 0;
  let defenseFocusVisible = false;
  for (let step = 0; step < 200; step += 1) {
    const result = page.locator(".result-panel");
    if (await result.isVisible()) break;

    const controls = page.locator("[data-prompt-kind]");
    await controls.waitFor({ state: "visible", timeout: 30_000 });
    const controlsElement = await controls.elementHandle();
    if (controlsElement === null)
      throw new Error("Prompt controls disappeared");
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
      if (
        (await defenseTarget.count()) > 0 &&
        (await defenseTarget.isVisible())
      )
        defenseFocusVisible = await focusSidewaysCardWithKeyboard(page, field);
    }
    const responseCountBefore = (await readCapture(page)).commands.filter(
      (command) =>
        command.type === "respond" && command.promptId === prompt.prompt.id,
    ).length;

    if ((await answerPromptWithKeyboard(page, controls, kind)) === "field")
      fieldResponses += 1;
    await page.waitForFunction(
      (element) => !element.isConnected,
      controlsElement,
      { timeout: 30_000 },
    );
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

async function answerPromptWithKeyboard(
  page: Page,
  controls: Locator,
  kind: string,
): Promise<"field" | "prompt"> {
  const field = page.getByRole("region", { name: "Duel field" });
  switch (kind) {
    case "idleCommand":
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
      if (await hasEnabledButton(field, "Pass")) {
        await activatePreferredButton(page, field, ["Pass"]);
        return "field";
      }
      await activatePreferredButton(page, controls, ["Pass"]);
      return "prompt";
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

async function chooseValidFieldSubset(
  page: Page,
  field: Locator,
): Promise<boolean> {
  const confirm = field.getByRole("button", {
    name: /Confirm (selection|placement)/,
  });
  if ((await confirm.count()) === 0) return false;
  if (await confirm.isEnabled()) {
    await keyboardActivate(page, confirm);
    return true;
  }
  const choices = field.locator("[data-field-target][aria-pressed]");
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
