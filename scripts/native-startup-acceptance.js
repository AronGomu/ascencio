/* global window, document, performance, setTimeout, requestAnimationFrame, URL */
// Runs only through the opt-in native debug fixture, inside the actual webview.
(async () => {
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const measurements = [];
  const globalErrors = [];
  const errorListener = (event) => globalErrors.push(String(event.error?.stack ?? event.error ?? event.message));
  const rejectionListener = (event) => globalErrors.push(String(event.reason?.stack ?? event.reason));
  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", rejectionListener);
  const frameIntervals = [];
  let previousFrame = null;
  let frameId;
  const frame = (time) => {if (previousFrame !== null && frameIntervals.length < 4096) frameIntervals.push(time - previousFrame); previousFrame = time; frameId = requestAnimationFrame(frame);};
  frameId = requestAnimationFrame(frame);
  const liveUrls = new Set();
  let peakUrls = 0;
  const createUrl = URL.createObjectURL.bind(URL);
  const revokeUrl = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (value) => {const url = createUrl(value); liveUrls.add(url); peakUrls = Math.max(peakUrls, liveUrls.size); return url;};
  URL.revokeObjectURL = (value) => {liveUrls.delete(value); revokeUrl(value);};
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function element(id, timeout = 15000) {
    const locate = () => document.querySelector(`[data-cy="${id}"]`);
    const existing = locate();
    if (existing) return existing;
    return new Promise((resolve, reject) => {
      const observer = new window.MutationObserver(() => {
        const value = locate();
        if (value) { observer.disconnect(); window.clearTimeout(timer); resolve(value); }
      });
      const timer = setTimeout(() => {
        observer.disconnect(); reject(new Error(`NATIVE_ACCEPTANCE_ELEMENT_MISSING:${id}`));
      }, timeout);
      observer.observe(document.documentElement, {subtree:true, childList:true});
    });
  }
  async function click(id, target) {
    const started = performance.now();
    const button = await element(id);
    if (button.disabled) throw new Error(`NATIVE_ACCEPTANCE_DISABLED:${id}`);
    button.click();
    if (target) await element(target);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    measurements.push({ action: id, durationMs: performance.now() - started });
  }
  async function until(condition, timeout = 15000) {
    const deadline = performance.now() + timeout;
    while (!condition()) {
      if (performance.now() >= deadline) throw new Error("NATIVE_ACCEPTANCE_MEDIA_TIMEOUT");
      await wait(50);
    }
  }
  const report = { kind: "native-webview", measurements, status: "running" };
  try {
    await element("main-menu-screen");
    report.searchComputeSamplesMs = window.__ASCENCIO_SEARCH_BENCHMARK__?.();
    await click("main-menu-install-content", "install-content-screen");
    await element("mod-settings");
    await click("install-content-back", "main-menu-screen");
    await click("main-menu-free-play", "deck-select-start");
    const covers = () => [...document.querySelectorAll('img[data-cy^="deck-tile-art-"]')];
    await until(() => covers().some(image => image.complete && image.naturalWidth > 0));
    const coverId = covers()[0].getAttribute("data-cy");
    const placeholderId = coverId.replace("deck-tile-art-", "deck-tile-art-placeholder-");
    const originalUrl = covers()[0].src;
    await invoke("native_io_trace_media_fixture", {operation: "replace"});
    await until(() => covers().some(image => image.src !== originalUrl && image.complete && image.naturalWidth > 0));
    for (const operation of ["truncate", "unsupported", "delete", "oversized"]) {
      await invoke("native_io_trace_media_fixture", {operation});
      await element(placeholderId, 20000);
      if (document.querySelector(`[data-cy="${coverId}"]`)) throw new Error("NATIVE_ACCEPTANCE_CROP_FALLBACK");
      if ((await element("deck-select-start")).disabled) throw new Error("NATIVE_ACCEPTANCE_MEDIA_BLOCKED_CONTROLS");
      const failedUrl = covers()[0]?.src;
      await invoke("native_io_trace_media_fixture", {operation: "restore"});
      await until(() => covers().some(image => image.src !== failedUrl && image.complete && image.naturalWidth > 0));
    }
    report.mediaRecovered = true;
    report.missingCropsUsePlaceholder = true;
    await click("deck-select-start", "duel-field");
    await element("field-hand-p0-viewport");
    report.moddedCardInHand = document.querySelector('[data-cy="field-hand-p0-viewport"]').innerHTML.includes("Native Mod Card");
    await click("duel-right-rail-options", "menu-dialog");
    await click("menu-dialog-surrender-button", "menu-dialog-surrender-confirm-button");
    await click("menu-dialog-surrender-confirm-button", "app-restart-duel-button");
    await click("app-restart-duel-button", "duel-field");
    await click("duel-right-rail-options", "menu-dialog");
    await click("menu-dialog-leave-match-button", "deck-select-start");
    await click("deck-select-back", "main-menu-screen");
    window.location.hash = "#/free-play/decks";
    await element("deck-editor-app");
    await element("deck-library");
    window.location.hash = "#/";
    await element("main-menu-new-game");
    await click("main-menu-new-game", "story-narrative-dialogue");
    await click("story-narrative-menu", "story-pause-save");
    await click("story-pause-save");
    const saveDeadline = performance.now() + 15000;
    let saveButton;
    while (!saveButton && performance.now() < saveDeadline) {
      saveButton = document.querySelector('[data-cy="story-save-load-overwrite-confirm"], [data-cy="story-save-load-save"]');
      if (!saveButton) await wait(50);
    }
    if (!saveButton) throw new Error("NATIVE_ACCEPTANCE_SAVE_ACTION_MISSING");
    saveButton.click();
    while (document.querySelector('[data-cy="story-overlay-save-load-title"]') && performance.now() < saveDeadline) {
      if (document.querySelector('[data-cy="story-save-load-failure"]')) throw new Error("NATIVE_ACCEPTANCE_SAVE_FAILED");
      await wait(50);
    }
    if (document.querySelector('[data-cy="story-overlay-save-load-title"]')) throw new Error("NATIVE_ACCEPTANCE_SAVE_TIMEOUT");
    window.location.hash = "#/";
    await element("main-menu-screen");
    await wait(100);
    await click("main-menu-continue", "story-narrative-dialogue");
    window.location.hash = "#/";
    await element("main-menu-screen");
    for (let iteration = 0; iteration < 10; iteration++) {
      await click("main-menu-free-play", "deck-select-start");
      await click("deck-select-back", "main-menu-screen");
    }
    report.duelRestarted = true;
    report.storySavedAndContinued = true;
    report.deckEditorMounted = true;
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = String(error);
  }
  window.cancelAnimationFrame(frameId);
  report.frameIntervalsMs = frameIntervals;
  report.globalErrors = globalErrors;
  window.removeEventListener("error", errorListener);
  window.removeEventListener("unhandledrejection", rejectionListener);
  report.trace = await window.__ASCENCIO_IO_TRACE__?.snapshot();
  report.liveObjectUrls = liveUrls.size;
  report.peakObjectUrls = peakUrls;
  URL.createObjectURL = createUrl;
  URL.revokeObjectURL = revokeUrl;
  await invoke("native_io_trace_acceptance_result", { report });
  await invoke("plugin:event|emit", {event: "application-close-requested", payload: null});
})();
