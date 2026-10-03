/* global window, document, setTimeout */
(async () => {
  if (window.__ASCENCIO_NATIVE_RECOVERY_RUNNING__) return;
  window.__ASCENCIO_NATIVE_RECOVERY_RUNNING__ = true;
  const invoke = window.__TAURI_INTERNALS__.invoke;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const find = (id) => document.querySelector(`[data-cy="${id}"]`);
  async function until(condition, timeout = 30000) {
    const end = window.performance.now() + timeout;
    while (!condition()) {
      if (window.performance.now() > end) throw new Error("NATIVE_MAINTENANCE_TIMEOUT");
      await wait(50);
    }
  }
  async function click(id) {
    await until(() => find(id) && !find(id).disabled);
    find(id).click();
  }
  async function installed() {
    await until(() => find("main-menu-screen") || find("install-content-screen"));
    if (find("main-menu-screen")) await click("main-menu-install-content");
    await until(() => find("installed-package-list"));
  }
  async function restart() {
    await click("startup-maintenance-restart");
    await until(() => !find("install-content-screen"));
    await until(() => find("main-menu-screen") || find("installed-package-list"));
  }
  function submit(id, value, name) {
    const transfer = new window.DataTransfer();
    transfer.items.add(new window.File([value], name, {type: "application/json"}));
    find(id).files = transfer.files;
    find(id).dispatchEvent(new window.Event("change", {bubbles: true}));
  }
  const report = {kind: "native-maintenance-recovery", scenario: "maintenance", status: "running"};
  const errors = [];
  const onerror = (event) => errors.push(String(event.error ?? event.message ?? event.reason));
  window.addEventListener("error", onerror);
  window.addEventListener("unhandledrejection", onerror);
  try {
    report.stage = "remove-chapter";
    await installed();
    await click("content-remove-chapter-01");
    await click("content-remove-confirm");
    await until(() => !find("content-package-chapter-01"));
    if (!find("install-content-back").disabled) throw new Error("NATIVE_MAINTENANCE_NAVIGATION_UNBLOCKED");
    await restart();
    await installed();
    if (find("content-package-chapter-01")) throw new Error("NATIVE_MAINTENANCE_REMOVAL_NOT_PERSISTED");
    report.stage = "import-chapter";
    await click("content-verify");
    await until(() => find("startup-maintenance-restart") && !find("startup-maintenance-restart").disabled);
    const chapter = await invoke("native_io_trace_chapter_fixture");
    submit("content-import-files", chapter, "chapter-01.critical.json");
    await until(() => find("content-package-chapter-01"));
    await restart();
    await installed();
    if (!find("content-package-chapter-01")) throw new Error("NATIVE_MAINTENANCE_IMPORT_NOT_PERSISTED");
    report.chapterRemovedImportedAndRestarted = true;
    report.stage = "restore-backup";
    const backup = {format: "ascencio-user-data-json", schemaVersion: 1, revision: 1, records: [
      {namespace: "deck-meta", key: "defaultDeck", revision: 1, payload: null},
      {namespace: "deck-meta", key: "lastOpened", revision: 1, payload: null},
      {namespace: "preferences", key: "content-mods", revision: 1, payload: {schemaVersion: 1, mode: "modded", root: {kind: "managed", path: null}, enabled: []}},
    ]};
    submit("user-data-import-file", JSON.stringify(backup), "isolated-backup.json");
    await until(() => find("user-data-restore-confirm"));
    report.restoreConfirmationShown = true;
    await click("user-data-restore-confirm");
    await until(() => !find("user-data-restore-dialog"));
    if (!find("install-content-back").disabled) throw new Error("NATIVE_MAINTENANCE_RESTORE_NAVIGATION_UNBLOCKED");
    await restart();
    await until(() => find("main-menu-screen") || find("installed-package-list"));
    report.backupRestoredAndReadmitted = true;
    report.trace = await window.__ASCENCIO_IO_TRACE__?.snapshot();
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = String(error);
    report.surface = document.body.innerText.slice(0,8192);
  }
  report.globalErrors = errors;
  if (errors.length) report.status = "failed";
  window.removeEventListener("error", onerror);
  window.removeEventListener("unhandledrejection", onerror);
  await invoke("native_io_trace_acceptance_result", {report});
  await invoke("plugin:event|emit", {event: "application-close-requested", payload: null});
})();
