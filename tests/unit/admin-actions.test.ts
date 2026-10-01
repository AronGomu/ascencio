import { PROTOTYPE_RULESET } from "../../src/decks/validation/index.ts";
import type { ShellApplication } from "../../src/shell/core/shell-application.ts";
import { installedGameplayFixture } from "../fixtures/installed-gameplay.ts";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_ROUTES,
  ADMIN_STORAGE_TARGETS,
  ADMIN_TEST_DECK_ID,
  buildAdminTestDeck,
  resetOperationalStorageTarget,
  type AdminStorageTarget,
} from "../../src/shell/admin/admin-actions.ts";

function target(id: string): AdminStorageTarget {
  const found = ADMIN_STORAGE_TARGETS.find((entry) => entry.id === id);
  expect(found, `storage target ${id}`).toBeDefined();
  return found!;
}

describe("admin route index", () => {
  it("covers routes reachable without an id and excludes admin", () => {
    const kinds = ADMIN_ROUTES.map((route) => route.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "home",
        "free-play",
        "free-play-decks",
        "free-play-collection",
        "story",
        "story-decks",
        "story-collection",
      ]),
    );
    expect(kinds).not.toContain("admin");
  });
});

describe("admin storage targets", () => {
  it("targets explicit JSON user namespaces", () => {
    expect(target("decks")).toMatchObject({
      kind: "user",
      name: "user-data.json",
      namespaces: ["decks", "deck-meta", "deck-autosaves"],
    });
    expect(target("story-saves").namespaces).toEqual(["story"]);
    expect(target("preferences").namespaces).toEqual([
      "preferences",
      "story-read-log",
    ]);
  });

  it("classifies duel snapshots as operational IndexedDB", () => {
    expect(target("duel-snapshots")).toMatchObject({
      kind: "indexeddb",
      name: "ygo-story-duel",
    });
  });
});

describe("resetOperationalStorageTarget", () => {
  it("deletes an operational IndexedDB database", async () => {
    const name = `admin-reset-${crypto.randomUUID()}`;
    const database = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore("rows");
      },
    });
    database.close();

    await expect(
      resetOperationalStorageTarget(
        { id: "probe", label: "Probe", kind: "indexeddb", name },
        indexedDB,
      ),
    ).resolves.toEqual({ outcome: "deleted" });
  });

  it("rejects user namespace targets without injected user data reset", async () => {
    await expect(
      resetOperationalStorageTarget(target("decks"), indexedDB),
    ).rejects.toThrow(
      "User namespace reset requires injected user data capability",
    );
  });
});

describe("buildAdminTestDeck", () => {
  it("returns installed default deck", () => {
    const gameplay = installedGameplayFixture();
    const pool = new Set(gameplay.cards.map(({ code }) => code));
    const deck = buildAdminTestDeck(gameplay);
    expect(deck.main).toHaveLength(40);
    for (const code of [...deck.main, ...deck.extra, ...deck.side])
      expect(pool.has(code)).toBe(true);
  });

  it("uses a fixed deck id", () => {
    expect(ADMIN_TEST_DECK_ID).toBe("admin-test-deck");
  });
});

// Root owns acquisition; Admin gets only the cancellable action.
describe("seedAdminTestDeck", () => {
  it("acquires freeplay, writes through that session, closes before returning", async () => {
    const { seedAdminTestDeck } =
      await import("../../src/shell/admin/admin-actions.ts");
    const order: string[] = [];
    const gameplay = installedGameplayFixture();
    const create = vi.fn(async () => {
      order.push("write");
    });
    const application = {
      acquire: vi.fn(async () => {
        order.push("acquire");
        return {
          kind: "freeplay",
          inputs: {
            presentation: gameplay,
            editor: { ruleset: PROTOTYPE_RULESET },
            users: { createDeckRepository: () => ({ create }) },
          },
          close: async () => {
            order.push("flush-close-release");
          },
        };
      }),
    } as unknown as ShellApplication;
    const signal = new AbortController().signal;
    await seedAdminTestDeck(
      application,
      signal,
      () => new Date("2026-08-14T00:00:00.000Z"),
    );
    expect(application.acquire).toHaveBeenCalledWith("freeplay", signal);
    expect(order).toEqual(["acquire", "write", "flush-close-release"]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ADMIN_TEST_DECK_ID,
        ...buildAdminTestDeck(gameplay),
        validation: {
          status: "valid",
          issues: [],
          rulesetRevision: { ruleset: PROTOTYPE_RULESET }.ruleset.revision,
        },
      }),
      { undo: [], redo: [], nextSequence: 1 },
    );
  });

  it.each(["cancel", "write", "close"])(
    "closes session after %s failure",
    async (failure) => {
      const { seedAdminTestDeck } =
        await import("../../src/shell/admin/admin-actions.ts");
      const controller = new AbortController();
      const gameplay = installedGameplayFixture();
      const create = vi.fn(async () => {
        if (failure === "write") throw new Error("STORAGE_QUOTA_EXCEEDED");
      });
      const close = vi.fn(async () => {
        if (failure === "close") throw new Error("STORAGE_UNAVAILABLE");
      });
      const application = {
        acquire: async () => {
          if (failure === "cancel") controller.abort();
          return {
            inputs: {
              presentation: gameplay,
              editor: { ruleset: PROTOTYPE_RULESET },
              users: { createDeckRepository: () => ({ create }) },
            },
            close,
          };
        },
      } as unknown as ShellApplication;
      await expect(
        seedAdminTestDeck(application, controller.signal),
      ).rejects.toThrow(
        failure === "cancel"
          ? "aborted"
          : failure === "write"
            ? "STORAGE_QUOTA_EXCEEDED"
            : "STORAGE_UNAVAILABLE",
      );
      expect(close).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(failure === "cancel" ? 0 : 1);
    },
  );

  it("preserves missing-package/admission failures without repository access", async () => {
    const { seedAdminTestDeck } =
      await import("../../src/shell/admin/admin-actions.ts");
    for (const message of [
      "APP_CONTENT_REQUIRED:duel-core,card-library,freeplay",
      "APP_SESSION_ACTIVE",
    ]) {
      const application = {
        acquire: async () => {
          throw new Error(message);
        },
      } as unknown as ShellApplication;
      await expect(
        seedAdminTestDeck(application, new AbortController().signal),
      ).rejects.toThrow(message);
    }
  });
});
