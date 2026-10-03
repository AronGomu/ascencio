/* global window, document, setTimeout, requestAnimationFrame, MutationObserver */
// Opt-in native error-screen acceptance. No production runtime reads or fixture writes.
(async () => {
  if (window.__ASCENCIO_NATIVE_RECOVERY_RUNNING__) return;
  window.__ASCENCIO_NATIVE_RECOVERY_RUNNING__ = true;
  const scenario = window.__ASCENCIO_NATIVE_RECOVERY__;
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const find = (id) => document.querySelector(`[data-cy="${id}"]`);
  async function until(condition, timeout = 30000) {
    const end = window.performance.now() + timeout;
    while (!condition()) {
      if (window.performance.now() > end) throw new Error("NATIVE_RECOVERY_TIMEOUT");
      await wait(50);
    }
  }
  const errors = [];
  const errorListener = (event) => errors.push(String(event.error ?? event.message));
  const rejectionListener = (event) => errors.push(String(event.reason));
  window.addEventListener("error", errorListener);
  window.addEventListener("unhandledrejection", rejectionListener);
  const report = {kind: "native-startup-recovery", scenario, status: "running"};
  report.progressSamples = [];
  function sampleProgress() {
    const bar = find("startup-progress-track");
    if (!bar) return;
    const sample = { heading: find("startup-heading")?.textContent.trim(), percentage: Number(bar.getAttribute("aria-valuenow")) };
    if (!Number.isFinite(sample.percentage) || sample.percentage < 0 || sample.percentage > 100) throw new Error("NATIVE_RECOVERY_PROGRESS_INVALID");
    const previous = report.progressSamples.at(-1);
    const freshAttempt = sample.heading === "Preparing application…" || sample.heading === "Restoring bundled content…";
    if (previous && sample.percentage < previous.percentage && !freshAttempt)
      throw new Error("NATIVE_RECOVERY_PROGRESS_DECREASED");
    if (JSON.stringify(sample) !== JSON.stringify(report.progressSamples.at(-1)) && report.progressSamples.length < 128)
      report.progressSamples.push(sample);
  }
  const observer = new MutationObserver(sampleProgress);
  observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["aria-valuenow"]});
  sampleProgress();
  try {
    if (scenario === "reopened") {
      await until(() => find("main-menu-screen"));
      report.action = "reopen-after-external-correction";
    } else {
      await until(() => find("startup-error-message"));
      await new Promise(requestAnimationFrame);
      if (find("main-menu-screen")) throw new Error("NATIVE_RECOVERY_PARTIAL_READY");
      const expected = {
        "invalid-user": "USER_DATA_INVALID",
        "invalid-base": "BASE_HASH_MISMATCH",
        "invalid-mod-json": "MOD_JSON_SYNTAX",
        "invalid-mod-lua": "MOD_LUA_SYNTAX",
        "missing-mod-root": "MOD_ROOT_UNAVAILABLE",
      }[scenario];
      report.initialLog = await invoke("native_startup_log_status");
      report.initialCode = report.initialLog.diagnostics.find(d => d.severity === "error")?.code;
      if (report.initialCode !== expected) throw new Error(`NATIVE_RECOVERY_WRONG_CODE:${report.initialCode}`);
      report.headingFocused = document.activeElement === find("startup-heading");
      if (!report.headingFocused) throw new Error("NATIVE_RECOVERY_FOCUS_MISSING");
      if (!report.initialLog.path || report.initialLog.loggingError) throw new Error("NATIVE_RECOVERY_LOG_MISSING");
      report.initialSource = report.initialLog.diagnostics.find(d => d.severity === "error")?.source;
      if (["invalid-user", "invalid-mod-json", "invalid-mod-lua"].includes(scenario) && !report.initialSource?.line)
        throw new Error("NATIVE_RECOVERY_LINE_MISSING");
      const buttons = [...document.querySelectorAll('[data-cy="startup-actions"] button')].map(b => b.textContent.trim());
      if (JSON.stringify(buttons) !== JSON.stringify(["Restore", "Open Log", "Copy Error", "Close"]))
        throw new Error("NATIVE_RECOVERY_ACTIONS_CHANGED");
      if (scenario !== "invalid-base") {
        if (!find("startup-repair-content").disabled) throw new Error("NATIVE_RECOVERY_UNRELATED_RESTORE_ENABLED");
        report.status = "closed-error";
        report.action = "startup-quit";
        report.initialTrace = await window.__ASCENCIO_IO_TRACE__?.snapshot();
        report.globalErrors = errors;
        await invoke("native_io_trace_acceptance_result", {report});
        observer.disconnect();
        find("startup-quit").click();
        return;
      }
      find("startup-repair-content").click();
      await until(() => find("main-menu-screen"), 45000);
      report.action = "startup-repair-content";
    }
    report.status = "passed";
    report.trace = await window.__ASCENCIO_IO_TRACE__?.snapshot();
  } catch (error) {
    report.status = "failed";
    report.error = String(error);
  }
  report.globalErrors = errors;
  observer.disconnect();
  if (errors.length) report.status = "failed";
  window.removeEventListener("error", errorListener);
  window.removeEventListener("unhandledrejection", rejectionListener);
  await invoke("native_io_trace_acceptance_result", {report});
  await invoke("plugin:event|emit", {event: "application-close-requested", payload: null});
})();
