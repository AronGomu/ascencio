import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const screen = readFileSync(
  "src/shell/screens/InstallContentScreen.svelte",
  "utf8",
);
const root = readFileSync("src/shell/AppShell.svelte", "utf8");

// Static guards only: no screen rendering, picker, import or restore UI actions.
describe("manual lifecycle composition safety", () => {
  it("root guards every store route before Story reset; mode acquisition cannot bypass guard", () => {
    const subscription = root.slice(
      root.indexOf("const unsubscribe = store.subscribe"),
      root.indexOf("/* Project the requested route"),
    );
    expect(subscription).toMatch(
      /manualContent\?\.view\.navigationBlocked === true/,
    );
    expect(subscription).toMatch(
      /store\.navigate\(INSTALL_CONTENT_ROUTE, \{ replace: true \}\);\s+return;/,
    );
    expect(subscription.indexOf("navigationBlocked")).toBeLessThan(
      subscription.indexOf("handoff.reset()"),
    );
    const reconciler = root.slice(
      root.indexOf("const requestedMode ="),
      root.indexOf("const mode = ready"),
    );
    expect(reconciler).toContain(
      "manualContent?.view.navigationBlocked === true",
    );
    expect(root).toContain(
      'globalThis.addEventListener("beforeunload", protectRestore)',
    );
    expect(root).toContain(
      'globalThis.removeEventListener("beforeunload", protectRestore)',
    );
  });

  it("root invalidates restored ownership without checkpoint deletion or recursive adapter admission", () => {
    const refresh = root.slice(
      root.indexOf("async function refreshRootAfterRestore"),
      root.indexOf("async function resetUserTarget"),
    );
    expect(refresh).toContain("handoff.invalidate()");
    expect(refresh).not.toContain("handoff.reset()");
    expect(refresh).not.toContain("refreshModeConsumers()");
    expect(refresh).toContain("storyDeckToken += 1");
    expect(refresh).toContain("collectionToken += 1");
    expect(refresh).toContain("invalidateFreePlayDeckCache()");
    expect(refresh).toContain("applyHydratedUserState(owner)");
    const teardown = root.slice(root.indexOf("const manualDisposal ="));
    expect(teardown.indexOf("await manualDisposal")).toBeLessThan(
      teardown.indexOf("await disposeRoot()"),
    );
  });

  it("remount only subscribes and refreshes persistent controller; conflicts disable native controls", () => {
    expect(screen).not.toContain("createManualContentController(");
    expect(screen).not.toContain("manual?.dispose()");
    expect(screen).toMatch(
      /view\?\.busy === true \|\|\s+view\?\.refreshPending === true \|\|\s+view\?\.state.kind === "restore-outcome-unknown" \|\|\s+removeCandidate !== null/,
    );
    for (const selector of [
      "content-import-files",
      "user-data-export",
      "user-data-import-file",
      "user-data-export-before-restore",
      "user-data-restore-confirm",
      "user-data-restore-cancel",
    ]) {
      expect(
        screen
          .slice(screen.indexOf(`data-cy="${selector}"`))
          .split(/onclick=|onchange=/)[0],
      ).toContain("disabled={actionsBlocked}");
    }
    expect(screen).toMatch(
      /disabled=\{view\?\.navigationBlocked === true \|\|\s+updateView\?\.phase === "committing"\}/,
    );
    expect(screen).toMatch(
      /view\?\.navigationBlocked !== true &&\s+updateView\?\.phase !== "committing"\s+\) \{\s+appUpdates\?\.cancel\(\);\s+onback\(\);/,
    );
    expect(screen).toContain(
      '{view.refreshPending ? "Retry refresh" : "Retry"}',
    );
    expect(screen).toContain(
      'role="alert" data-cy="user-data-restore-outcome-unknown"',
    );
    expect(screen).toContain('{#if view.state.kind === "failed"}');
    expect(screen).toContain("removeCandidate.version");
    expect(screen).toContain(
      "downloadUserData(blob, (message) => manual?.reportDownload(message))",
    );
  });
});
