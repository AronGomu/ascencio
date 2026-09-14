import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  assertShellPrecacheEntries,
  isAppNavigationRequest,
  isFirstCoreInstall,
  resolveServiceWorkerState,
  shellCacheName,
} from "../../src/shell/pwa/shell-cache-policy.ts";

describe("CORE shell precache policy", () => {
  it("scopes shell caches to the exact app build", () => {
    expect(shellCacheName("0.1.0+abc123")).toBe("ygo-core-shell-0.1.0+abc123");
  });

  it("rejects acquired and runtime payloads from the injected manifest", () => {
    const safe = [
      { url: "index.html", revision: "one" },
      { url: "assets/app.js", revision: "two" },
      { url: "assets/forum.woff2", revision: "three" },
      { url: "app-icon.svg", revision: "four" },
    ];
    expect(assertShellPrecacheEntries(safe)).toBe(safe);

    for (const url of [
      "content/indexes/abc.json",
      "runtime/current/manifest.json",
      "__content/files/abc/card.jpg",
      "assets/core.wasm",
      "chapter-01.zip",
    ])
      expect(() =>
        assertShellPrecacheEntries([{ url, revision: "blocked" }]),
      ).toThrow(`CORE shell precache contains forbidden payload: ${url}`);
  });

  it("exempts only a true first install with no active worker or old shell cache", () => {
    expect(isFirstCoreInstall(false, [])).toBe(true);
    expect(isFirstCoreInstall(true, [])).toBe(false);
    expect(isFirstCoreInstall(false, ["ygo-core-shell-old"])).toBe(false);
    expect(isFirstCoreInstall(false, ["unowned-cache"])).toBe(true);
  });

  it("falls back only for the root or index document inside SW scope", () => {
    const scope = "https://example.test/ygo-story-duel/";
    expect(
      isAppNavigationRequest("https://example.test/ygo-story-duel/", scope),
    ).toBe(true);
    expect(
      isAppNavigationRequest(
        "https://example.test/ygo-story-duel/index.html",
        scope,
      ),
    ).toBe(true);
    for (const url of [
      "https://example.test/ygo-story-duel/content/missing.json",
      "https://example.test/ygo-story-duel/runtime/missing.wasm",
      "https://example.test/ygo-story-duel/__content/files/missing.jpg",
      "https://example.test/ygo-story-duel/not-an-app-route",
      "https://example.test/",
      "https://other.test/ygo-story-duel/",
    ])
      expect(isAppNavigationRequest(url, scope)).toBe(false);
  });

  it("reports offline ready only for a controlled active shell", () => {
    expect(
      resolveServiceWorkerState({
        supported: false,
        controlled: false,
        active: false,
        installing: false,
        waiting: false,
      }).kind,
    ).toBe("unsupported");
    expect(
      resolveServiceWorkerState({
        supported: true,
        controlled: false,
        active: true,
        installing: false,
        waiting: false,
      }).kind,
    ).toBe("reload-required");
    expect(
      resolveServiceWorkerState({
        supported: true,
        controlled: true,
        active: true,
        installing: false,
        waiting: false,
      }).kind,
    ).toBe("offline-ready");
    expect(
      resolveServiceWorkerState({
        supported: true,
        controlled: true,
        active: true,
        installing: false,
        waiting: true,
      }).kind,
    ).toBe("update-waiting");
    expect(
      resolveServiceWorkerState({
        supported: true,
        controlled: false,
        active: false,
        installing: false,
        waiting: false,
        failed: true,
      }).kind,
    ).toBe("failed");
  });

  it("contains no forced activation or live-client claim", async () => {
    const source = await readFile(
      new URL("../../src/service-worker.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("skipWaiting");
    expect(source).not.toContain("clients.claim");
    expect(source).not.toContain("clientsClaim");
  });
});
