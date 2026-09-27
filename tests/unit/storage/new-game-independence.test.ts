import { createImportablePackageFixture } from "./sqlite-fixtures.ts";
import { fixtureFile } from "./runtime-fixtures.ts";
import { createSqliteStoryRepository } from "../../../src/story/saves/sqlite-story-repository.ts";
import { storyBindingFixture } from "../../fixtures/story-release.ts";
// @vitest-environment node
import { statSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";
import {
  loadStoryInputs,
  closeStoryInputs,
} from "../../../src/shell/adapters/sqlite-story-inputs.ts";
import { createSqliteApplicationService } from "../../../src/shell/application/sqlite-application-service.ts";
import type { ShellUserServices } from "../../../src/shell/core/user-services.ts";
import { buildInstalledStarterGrant } from "../../../src/story/decks/starter-grant.ts";
import { createInitialStoryState } from "../../../src/story/model/story-state.ts";
import { reduceStory } from "../../../src/story/model/story-reducer.ts";
import {
  type LocalStorageClient,
  type PackageId,
  type PackageManifest,
  type StorageResult,
  type UserDataStore,
} from "../../../src/storage/index.ts";
import { CONTENT_REGISTRY_SCHEMA_SQL } from "../../../src/storage/schema/index.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import type { RuntimeFileStore } from "../../../src/storage/runtime/runtime-ports.ts";
import { createStoryInputsHarness } from "../../fixtures/sqlite/story-inputs-runtime.ts";
import { databaseAdapter } from "./runtime-fixtures.ts";

const AUTHORITATIVE_PACKAGES = {
  "duel-core": {
    path: ".tmp/manual-sqlite-t2-final/generated/content-packages/duel-core/1.0.0.sqlite",
    sha256: "52ab0c9cd83bbba6bf88c782a8ae2f12d5ec49b2c18e08e4a4ddedaf3aa78f9c",
  },
  "card-library": {
    path: ".tmp/manual-sqlite-t2-final/generated/content-packages/card-library/1.0.0.sqlite",
    sha256: "34da2e1e11125f4ad2ee3ad3fbe9fcf2761ad2dc33adbe5e00f7093b0799c5f2",
  },
  freeplay: {
    path: ".tmp/manual-sqlite-t4a-repair/generated/content-packages/freeplay/1.0.0.sqlite",
    sha256: "94f823fb63bb190304845feae0d527dcb6ec6ecbd24a971513b52a3bc48859d8",
  },
  "chapter-01": {
    path: ".tmp/manual-sqlite-t2-final/generated/content-packages/chapter-01/1.0.0.sqlite",
    sha256: "1bec727903e32cc4768eb844ef91d10f6763a854a67d1e4381fd4fd6ebba3307",
  },
} as const;
type AcceptedPackageId = keyof typeof AUTHORITATIVE_PACKAGES;

function ok<T>(value: T): StorageResult<T> {
  return { kind: "ok", value };
}

function users(): ShellUserServices {
  return {
    preferences: {} as ShellUserServices["preferences"],
    createDeckRepository: vi.fn() as ShellUserServices["createDeckRepository"],
  };
}

describe("New Game independence", () => {
  it("acquires current Story inputs without reading or replacing a broken old slot", async () => {
    const harness = await createStoryInputsHarness();
    const oldPayload = JSON.stringify({
      schemaVersion: 6,
      slot: "manual:1",
      revision: 1,
      savedAt: 1,
      state: { removedBeat: "missing", removedOpponent: "missing" },
      story: {
        chapterId: "removed-chapter",
        contentId: "prototype-prologue-v1",
        revision: 1,
        completedChapterIds: [],
      },
    });
    harness.userDatabase
      .prepare("INSERT INTO user_records VALUES ('story', 'manual:1', 1, ?)")
      .run(oldPayload);
    const before = harness.userDatabase
      .prepare(
        "SELECT revision, payload_json FROM user_records WHERE namespace='story' AND record_key='manual:1'",
      )
      .get();
    harness.userReads.count = 0;
    const service = createSqliteApplicationService({
      storage: harness.storage,
      users: harness.users,
      flushUserWrites: async () => ok(undefined),
    });

    const session = await service.application.acquire(
      "story",
      new AbortController().signal,
    );
    const chapter = session.inputs.release.chapters[0]!;
    const fresh = reduceStory(createInitialStoryState(), {
      type: "new-game",
      starterGrant: buildInstalledStarterGrant(
        chapter,
        session.inputs.gameplay.editor().ruleset,
      ),
    });

    expect(fresh.screen).toBe("narrative");
    expect(fresh.decks[0]?.name).toBe(
      chapter.decks.find(({ id }) => id === chapter.defaults.starterDeckId)
        ?.name,
    );
    expect(harness.userReads.count).toBe(0);
    expect(
      harness.userDatabase
        .prepare(
          "SELECT revision, payload_json FROM user_records WHERE namespace='story' AND record_key='manual:1'",
        )
        .get(),
    ).toEqual(before);

    await session.close();
    await service.dispose();
    await harness.close();
  }, 120_000);

  it("loads authoritative accepted packages read-only under an acquired generation lease", async () => {
    const registry = new DatabaseSync(":memory:");
    registry.exec(CONTENT_REGISTRY_SCHEMA_SQL);
    registry
      .prepare("UPDATE registry_state SET generation=41 WHERE singleton=1")
      .run();
    const paths = new Map<string, string>();
    const manifests = new Map<AcceptedPackageId, PackageManifest>();
    for (const [packageId, source] of Object.entries(
      AUTHORITATIVE_PACKAGES,
    ) as [
      AcceptedPackageId,
      (typeof AUTHORITATIVE_PACKAGES)[AcceptedPackageId],
    ][]) {
      const absolute = path.resolve(source.path);
      const packageDatabase = new DatabaseSync(absolute, { readOnly: true });
      const row = packageDatabase
        .prepare("SELECT * FROM package_manifest")
        .get() as {
        package_id: PackageId;
        package_type: PackageManifest["packageType"];
        version: string;
        schema_version: 1;
        dependencies_json: string;
        created_at: string;
      };
      packageDatabase.close();
      const manifest: PackageManifest = {
        packageId: row.package_id,
        packageType: row.package_type,
        version: row.version,
        schemaVersion: row.schema_version,
        dependencies: JSON.parse(
          row.dependencies_json,
        ) as PackageManifest["dependencies"],
        createdAt: row.created_at,
      };
      const fileKey = `/accepted/${packageId}.sqlite`;
      paths.set(fileKey, absolute);
      manifests.set(packageId, manifest);
      registry
        .prepare("INSERT INTO installed_packages VALUES (?, ?, ?, ?, ?, ?)")
        .run(
          packageId,
          JSON.stringify(manifest),
          fileKey,
          statSync(absolute).size,
          source.sha256,
          "2026-09-24T00:00:00.000Z",
        );
    }

    let openedHandles = 0;
    let closedHandles = 0;
    const files: RuntimeFileStore = {
      reserveMinimumCapacity: async () => undefined,
      importDatabase: async () => {
        throw new Error("READ_ONLY_PROBE");
      },
      openDatabase(fileKey) {
        const source = paths.get(fileKey);
        if (source === undefined) throw new Error("PACKAGE_NOT_FOUND");
        openedHandles += 1;
        const database = databaseAdapter(
          new DatabaseSync(source, { readOnly: true }),
        );
        return {
          ...database,
          close() {
            closedHandles += 1;
            database.close();
          },
        };
      },
      exportDatabase: async () => {
        throw new Error("READ_ONLY_PROBE");
      },
      has: (fileKey) => paths.has(fileKey),
      list: () => [...paths.keys()],
      unlink: () => {
        throw new Error("READ_ONLY_PROBE");
      },
      close: () => undefined,
    };
    const runtime = new AtomicPackageRuntime({
      registry: databaseAdapter(registry),
      files,
      now: () => "2026-09-24T00:00:00.000Z",
      randomId: () => "read-only-probe",
    });
    const userOps: string[] = [];
    const failedUserOperation = <T>(
      operation: string,
    ): Promise<StorageResult<T>> => {
      userOps.push(operation);
      return Promise.resolve({
        kind: "failed",
        error: { code: "STORAGE_UNAVAILABLE" },
      });
    };
    const userData: UserDataStore = {
      readUser: () => failedUserOperation("readUser"),
      listUser: () => failedUserOperation("listUser"),
      writeUser: () => failedUserOperation("writeUser"),
      exportUserData: () => failedUserOperation("exportUserData"),
      inspectUserDataBackup: () => failedUserOperation("inspectUserDataBackup"),
      restoreUserData: () => failedUserOperation("restoreUserData"),
    };
    const queries: string[] = [];
    const storage: LocalStorageClient = {
      packages: runtime,
      content: {
        query(request, signal) {
          queries.push(JSON.stringify(request));
          return runtime.query(request, signal);
        },
      },
      userData,
      subscribeMediaWarnings: () => () => undefined,
      async close() {
        runtime.close();
      },
    };

    const lease = await storage.packages.acquireSession();
    expect(lease.kind).toBe("ok");
    if (lease.kind === "failed") throw new Error(lease.error.code);
    const inputs = await loadStoryInputs(
      storage,
      users(),
      "chapter-01",
      new AbortController().signal,
    );
    const battle = await inputs.gameplay.battle.load(
      new AbortController().signal,
    );

    expect(inputs.cards.all()).toHaveLength(14_794);
    expect(inputs.release.chapters[0]?.sets).toHaveLength(75);
    expect(inputs.release.chapters[0]?.decks).toHaveLength(2);
    expect(inputs.release.chapters[0]?.opponents).toHaveLength(3);
    expect(battle.cards).toHaveLength(14_794);
    expect(battle.scripts).toHaveLength(13_549);
    expect(userOps).toEqual([]);
    expect(
      queries.filter((request) => request.includes('"kind":"asset"')),
    ).toEqual([
      JSON.stringify({
        kind: "asset",
        packageId: "duel-core",
        path: "engine/ocgcore.sync.wasm",
      }),
      JSON.stringify({
        kind: "asset",
        packageId: "duel-core",
        path: "engine/vendor-manifest.json",
      }),
    ]);

    closeStoryInputs(inputs);
    await lease.value.release();
    await storage.close();
    expect(openedHandles).toBe(closedHandles);
    console.info(
      "T6B_AUTHORITATIVE_PROBE",
      JSON.stringify({
        generation: 41,
        packages: Object.fromEntries(
          Object.entries(AUTHORITATIVE_PACKAGES).map(([packageId, source]) => [
            packageId,
            { path: path.resolve(source.path), sha256: source.sha256 },
          ]),
        ),
        counts: {
          cards: inputs.cards.all().length,
          sets: inputs.release.chapters[0]!.sets.length,
          decks: inputs.release.chapters[0]!.decks.length,
          opponents: inputs.release.chapters[0]!.opponents.length,
          scripts: battle.scripts.length,
        },
        userOps,
        openedHandles,
        closedHandles,
      }),
    );
  }, 120_000);
});

it("G1 valid semantic-breaking chapter update preserves exact SQLite user bytes; New Game uses current defaults", async () => {
  const h = await createStoryInputsHarness();
  const replacement = createImportablePackageFixture("chapter-01");
  try {
    const previous = await loadStoryInputs(
      h.storage,
      h.users,
      "chapter-01",
      new AbortController().signal,
    );
    expect(previous.release.chapters[0]!.document!.beats[1]!.id).toBe(
      "retired-beat",
    );
    expect(previous.release.chapters[0]!.defaults.opponentId).toBe("opponent");
    previous.close();
    const saves = createSqliteStoryRepository(h.storage.userData);
    for (const slot of ["manual:1", "autosave", "checkpoint:pre-duel"] as const)
      expect(
        (
          await saves.write(
            slot,
            {
              ...createInitialStoryState(),
              narrativeIndex: 1,
              shopSetId: "fixture-set",
              boosters: { "fixture-set": 1 },
            },
            0,
            {
              ...storyBindingFixture(),
              chapterId: "chapter-01",
              revision: h.generation,
            },
          )
        ).kind,
      ).toBe("written");
    const bytes = readFileSync(h.userFile);
    const rows = h.userDatabase
      .prepare("SELECT * FROM user_records ORDER BY record_key")
      .all();
    h.userReads.count = 0;
    const db = replacement.database;
    db.prepare("UPDATE package_manifest SET version='2.0.0'").run();
    db.exec(
      "DELETE FROM chapter_card_limits; DELETE FROM opponents; DELETE FROM decks;",
    );
    const main = Array.from({ length: 40 }, (_, i) => 3 + (i % 14));
    db.prepare("INSERT INTO decks VALUES (?, ?, ?)").run(
      "current-starter",
      "Current starter",
      JSON.stringify({ main, extra: [], side: [] }),
    );
    db.prepare("INSERT INTO opponents VALUES (?, ?, ?, ?, ?)").run(
      "current-opponent",
      "Current opponent",
      "Ready",
      "current-starter",
      "basic",
    );
    db.prepare("UPDATE package_meta SET value_json=? WHERE key='config'").run(
      JSON.stringify({
        title: "Current chapter",
        chapterNumber: 1,
        storyContentId: "prototype-prologue-v1",
        defaults: {
          starterDeckId: "current-starter",
          opponentId: "current-opponent",
        },
        setIds: [],
        mapAssetPath: null,
      }),
    );
    const document = JSON.parse(
      (
        db.prepare("SELECT payload_json FROM story_documents").get() as {
          payload_json: string;
        }
      ).payload_json,
    );
    document.beats[0].id = "current-beat";
    document.beats[0].text = "Current opening.";
    db.prepare("UPDATE story_documents SET payload_json=?").run(
      JSON.stringify(document),
    );
    db.close();
    const imported = await h.storage.packages.importPackages(
      [fixtureFile(replacement.file)],
      h.generation,
      new AbortController().signal,
      () => undefined,
    );
    expect(imported.kind).toBe("ok");
    const inputs = await loadStoryInputs(
      h.storage,
      h.users,
      "chapter-01",
      new AbortController().signal,
    );
    try {
      const chapter = inputs.release.chapters[0]!;
      expect(chapter.document?.beats[0]?.id).toBe("current-beat");
      expect(chapter.document?.beats).toHaveLength(1);
      expect(
        chapter.document?.beats.some((beat) => beat.id === "retired-beat"),
      ).toBe(false);
      expect(
        chapter.opponents.some((opponent) => opponent.id === "opponent"),
      ).toBe(false);
      expect(chapter.sets).toEqual([]);
      expect(chapter.defaults.opponentId).toBe("current-opponent");
      const fresh = reduceStory(createInitialStoryState(), {
        type: "new-game",
        starterGrant: buildInstalledStarterGrant(
          chapter,
          inputs.gameplay.editor().ruleset,
        ),
      });
      expect(fresh.narrativeIndex).toBe(0);
      expect(fresh.decks[0]?.name).toBe("Current starter");
      expect(fresh.decks[0]?.main).toEqual(main);
      expect(h.userReads.count).toBe(0);
      expect(readFileSync(h.userFile)).toEqual(bytes);
      expect(
        h.userDatabase
          .prepare("SELECT * FROM user_records ORDER BY record_key")
          .all(),
      ).toEqual(rows);
    } finally {
      inputs.close();
    }
  } finally {
    await h.close();
    rmSync(replacement.file);
  }
});
