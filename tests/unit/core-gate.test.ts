import { shellGameplayFixture as installedGameplayFixture } from "../fixtures/shell-gameplay.ts";
import { describe, expect, it, vi } from "vitest";
import { deckId } from "../../src/decks/index.ts";
import {
  coreGateMessage,
  loadCoreStartup,
  routeForCoreGate,
  type CoreGate,
} from "../../src/shell/core/core-gate.ts";
import {
  INSTALL_CONTENT_ROUTE,
  type AppRoute,
} from "../../src/shell/routes.ts";

const locked: CoreGate = { kind: "locked", reason: "content-required" };
const ready: CoreGate = {
  kind: "ready",
  gameplay: installedGameplayFixture(),
  reader: null,
  generation: 1,
};

const gameplayRoutes: readonly AppRoute[] = [
  { kind: "free-play" },
  { kind: "free-play-decks" },
  { kind: "free-play-deck", deckId: deckId("one") },
  { kind: "free-play-collection" },
  { kind: "story" },
  { kind: "story-decks" },
  { kind: "story-deck", deckId: deckId("one") },
  { kind: "story-collection" },
  { kind: "duel-session", handoffId: "session" as never },
  { kind: "admin" },
];

describe("CORE startup gate", () => {
  it("missing Web Locks blocks without consulting network or legacy stores", async () => {
    const fetch = vi.fn();
    const startup = await loadCoreStartup(
      fetch,
      "https://example.test/",
      {} as IDBFactory,
    );
    expect(startup.gate).toEqual({
      kind: "locked",
      reason: "storage-unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("missing browser storage blocks before network", async () => {
    const fetch = vi.fn();
    expect(
      (await loadCoreStartup(fetch, "https://example.test/", undefined)).gate,
    ).toEqual({ kind: "locked", reason: "storage-unavailable" });
    expect(fetch).not.toHaveBeenCalled();
    expect(coreGateMessage(locked)).toContain("Content is required");
  });

  it.each([{ kind: "checking" } as CoreGate, locked])(
    "projects every gameplay route to installer while $kind",
    (gate) => {
      for (const route of gameplayRoutes)
        expect(routeForCoreGate(route, gate), route.kind).toBe(
          INSTALL_CONTENT_ROUTE,
        );
    },
  );

  it("keeps CORE routes available while locked", () => {
    expect(routeForCoreGate({ kind: "home" }, locked)).toStrictEqual({
      kind: "home",
    });
    expect(routeForCoreGate(INSTALL_CONTENT_ROUTE, locked)).toBe(
      INSTALL_CONTENT_ROUTE,
    );
  });

  it("keeps gameplay routes unchanged only when ready", () => {
    for (const route of gameplayRoutes)
      expect(routeForCoreGate(route, ready)).toBe(route);
  });
});
