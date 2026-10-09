import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { installNativeContentBridge } from "../e2e-native/native-content-bridge.ts";

declare global {
  interface Window {
    readonly resourceUrlCount: number;
    readonly resourceUrlsCreated: number;
  }
}

test("duel teardown releases workers and image URLs within a retained heap budget", async ({
  page,
  browser,
}, testInfo) => {
  const workers = new Set<object>();
  let createdWorkers = 0;
  page.on("worker", (worker) => {
    createdWorkers += 1;
    workers.add(worker);
    worker.on("close", () => workers.delete(worker));
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installNativeContentBridge(page);
  await page.addInitScript(() => {
    const active = new Set<string>();
    let created = 0;
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      created += 1;
      active.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      active.delete(url);
      revoke(url);
    };
    Object.defineProperty(window, "resourceUrlCount", {
      get: () => active.size,
    });
    Object.defineProperty(window, "resourceUrlsCreated", {
      get: () => created,
    });
  });
  await page.goto("/");
  await expect(page.locator('[data-cy="main-menu-new-game"]')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const snapshots: Array<{
    heapBytes: number;
    workers: number;
    imageUrls: number;
  }> = [];
  const feedbackMs: number[] = [];
  const createdImageUrls: number[] = [];
  for (let cycle = 0; cycle < 6; cycle += 1) {
    const urlsBefore = await page.evaluate(() => window.resourceUrlsCreated);
    await page.evaluate(() => {
      location.hash = "/free-play";
    });
    await page.locator('[data-cy="deck-select-start"]').click();
    await expect(page.locator('[data-cy="duel-field"]')).toBeVisible();
    await expect(page.locator("[data-prompt-kind]")).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('[data-cy="field-hand-p0-viewport"] img')
          .evaluateAll((images) =>
            images.some(
              (image) =>
                image instanceof HTMLImageElement &&
                image.src.startsWith("blob:") &&
                image.complete &&
                image.naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    const createdUrls =
      (await page.evaluate(() => window.resourceUrlsCreated)) - urlsBefore;
    expect(createdUrls).toBeGreaterThan(0);
    createdImageUrls.push(createdUrls);
    expect(workers.size).toBeGreaterThan(0);
    const target = page.locator('[data-field-target][tabindex="0"]').first();
    await expect(target).toBeVisible();
    for (let sample = 0; sample < 6; sample += 1) {
      const duration = await target.evaluate(async (element) => {
        if (!(element instanceof HTMLElement))
          throw new Error("Expected focusable field target");
        element.blur();
        const start = performance.now();
        element.focus();
        if (document.activeElement !== element)
          throw new Error("Field focus did not change");
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return performance.now() - start;
      });
      if (cycle > 0) feedbackMs.push(duration);
    }
    await page.evaluate(() => {
      location.hash = "/";
    });
    await expect(page.locator('[data-cy="main-menu-new-game"]')).toBeVisible();
    await expect.poll(() => workers.size).toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.resourceUrlCount))
      .toBe(0);
    await cdp.send("HeapProfiler.collectGarbage");
    const metrics = await cdp.send("Performance.getMetrics");
    const heapBytes = metrics.metrics.find(
      (metric) => metric.name === "JSHeapUsedSize",
    )?.value;
    expect(heapBytes).toBeGreaterThan(0);
    if (heapBytes === undefined)
      throw new Error("Chromium omitted JSHeapUsedSize");
    snapshots.push({
      heapBytes,
      workers: workers.size,
      imageUrls: await page.evaluate(() => window.resourceUrlCount),
    });
  }
  const baseline = snapshots[0];
  if (!baseline) throw new Error("Missing warm-up snapshot");
  const retainedGrowth = Math.max(
    ...snapshots
      .slice(1)
      .map((snapshot) => snapshot.heapBytes - baseline.heapBytes),
  );
  const sorted = feedbackMs.toSorted((left, right) => left - right);
  const feedbackP95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const evidence = {
    platform: process.platform,
    node: process.version,
    browser: browser.version(),
    profile: {
      viewport: "1280x720",
      cpuThrottle: 4,
      warmupCycles: 1,
      measuredCycles: 5,
    },
    budgets: {
      retainedHeapGrowthBytes: 8 * 1024 * 1024,
      liveWorkersAfterExit: 0,
      imageUrlsAfterExit: 0,
      focusFeedbackP95Ms: 100,
    },
    measurements: {
      snapshots,
      retainedGrowth,
      createdWorkers,
      createdImageUrls,
      feedbackMs,
      feedbackP95,
    },
    scope:
      "Browser main-thread heap, actual Worker lifetimes and object URLs. Native handle and Rust I/O acceptance run separately. Focus feedback ends after two animation frames; it does not measure engine update latency.",
    errors,
  };
  const evidencePath = testInfo.outputPath("resource-budgets.json");
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  await testInfo.attach("resource-budgets", {
    path: evidencePath,
    contentType: "application/json",
  });
  expect(createdWorkers).toBeGreaterThanOrEqual(6);
  expect(retainedGrowth).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(feedbackMs).toHaveLength(30);
  expect(feedbackP95).toBeLessThan(100);
  expect(errors).toEqual([]);
});
