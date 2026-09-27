import { loadNormalizedCatalog } from "../../scripts/lib/sqlite-content/normalized-package-source.ts";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { vi } from "vitest";
import * as coreGate from "../../src/shell/core/core-gate.ts";
import { createSqliteApplicationService } from "../../src/shell/application/sqlite-application-service.ts";
import { createUserPersistenceOwner } from "../../src/shell/application/user-persistence-owner.ts";
import { createApplicationAdmission } from "../../src/shell/application/application-admission.ts";
import { AtomicPackageRuntime } from "../../src/storage/runtime/atomic-package-runtime.ts";
import type {
  LocalStorageClient,
  MediaWarning,
} from "../../src/storage/index.ts";
import type { GenerationSaveRepository } from "../../src/story/saves/index.ts";
import {
  nodePackageDatabase,
  insertFixtureAsset,
} from "./node-package-database.ts";
import { createRuntimeFixture } from "../unit/storage/runtime-fixtures.ts";
import { installedDuelGameplayFixture } from "./installed-duel-gameplay.ts";
import {
  installedGameplayFixture,
  TEST_RUNTIME_INPUT,
  type FixtureGameplay,
} from "./installed-gameplay.ts";
import { storyReleaseFixture } from "./story-release.ts";
import { storyUserRuntime } from "./story-session.ts";

const disposals: (() => Promise<void>)[] = [];
export async function disposeSemanticShells(): Promise<void> {
  for (const dispose of disposals.splice(0)) await dispose();
}

/** Small native SQLite rows enter production query/admission/session adapters.
 * No package import/export; no hosted reader or selector facade.
 */
export async function semanticShellStartup(
  gameplay: FixtureGameplay = installedDuelGameplayFixture(),
  saves?: GenerationSaveRepository,
) {
  const fixture = createRuntimeFixture();
  const ids = ["duel-core", "card-library", "freeplay", "chapter-01"] as const;
  const packageFiles: string[] = [];
  const defaultCards = installedGameplayFixture().cards;
  const byCode = new Map(
    [...gameplay.cards, ...defaultCards].map((card) => [card.code, card]),
  );
  const required = new Set(
    gameplay.decks.flatMap((deck) => [
      ...deck.main,
      ...deck.extra,
      ...deck.side,
    ]),
  );
  if ([...required].some((code) => !byCode.has(code))) {
    const normalized = await loadNormalizedCatalog(
      "assets/content/card-library",
      ["en"],
    );
    for (const code of required) {
      if (byCode.has(code)) continue;
      const record = normalized.cards.find((row) => row.code === code);
      const text = normalized.texts.find((row) => row.cardCode === code);
      if (record === undefined || text === undefined)
        throw new Error(`Missing fixture deck card ${code}`);
      byCode.set(code, {
        code,
        record: { ...record, ot: record.scope },
        text: { ...text, code },
        fullImage: { packId: "chapter-01", path: `cards/${code}.jpg` },
        croppedImage: {
          packId: "chapter-01",
          path: `cards/${code}-cropped.jpg`,
        },
      });
    }
  }
  const cards = [...byCode.values()].sort((a, b) => a.code - b.code);
  for (const [index, id] of ids.entries()) {
    const pack = nodePackageDatabase(
      fixture.files.root,
      id,
      ids[index - 1] ?? null,
    );
    const db = pack.database;
    let config: unknown;
    if (id === "duel-core") {
      config = {
        coreVersion: [11, 0],
        wasmPath: "engine/ocgcore.sync.wasm",
        vendorManifestPath: "engine/vendor-manifest.json",
        strings: TEST_RUNTIME_INPUT.strings,
      };
      insertFixtureAsset(
        db,
        "engine/ocgcore.sync.wasm",
        "application/wasm",
        readFileSync("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
      );
      insertFixtureAsset(
        db,
        "engine/vendor-manifest.json",
        "application/json",
        readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
      );
    } else if (id === "card-library") {
      config = {
        defaultLocale: "en",
        locales: ["en"],
        revisions: TEST_RUNTIME_INPUT.revisions,
        requiredScripts: { cards: [], globals: ["utility.lua"] },
      };
      const cardRow = db.prepare("INSERT INTO cards VALUES (?, ?)");
      const text = db.prepare("INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)");
      for (const { code, record, text: words } of cards) {
        cardRow.run(code, JSON.stringify({ ...record, scope: record.ot }));
        text.run(
          code,
          "en",
          words.name,
          words.description,
          JSON.stringify(words.strings),
        );
      }
      db.prepare("INSERT INTO scripts VALUES (?, ?, ?)").run(
        "utility.lua",
        "return {}",
        createHash("sha256").update("return {}").digest("hex"),
      );
      const set = db.prepare("INSERT INTO sets VALUES (?, ?)");
      const member = db.prepare(
        "INSERT INTO set_cards VALUES (?, ?, ?, ?, ?, ?)",
      );
      for (const row of gameplay.sets) {
        set.run(
          row.id,
          JSON.stringify({
            id: row.id,
            name: row.name,
            releaseYear: row.releaseYear,
          }),
        );
        for (const card of row.cards)
          member.run(
            row.id,
            card.code,
            card.printingCode,
            card.rarity,
            card.sourceRarity,
            card.sourceRarityCode,
          );
      }
    } else {
      config =
        id === "freeplay"
          ? {
              title: "Fixture",
              defaults: gameplay.defaults,
              rulesetId: "prototype-single-ruleset",
            }
          : {
              title: "Fixture",
              chapterNumber: 1,
              defaults: gameplay.defaults,
              storyContentId: "prototype-prologue-v1",
              setIds: gameplay.sets.map((set) => set.id),
              mapAssetPath: null,
            };
      const deck = db.prepare("INSERT INTO decks VALUES (?, ?, ?)");
      for (const { id, name, main, extra, side } of gameplay.decks)
        deck.run(id, name, JSON.stringify({ main, extra, side }));
      const opponent = db.prepare(
        "INSERT INTO opponents VALUES (?, ?, ?, ?, ?)",
      );
      for (const row of gameplay.opponents)
        opponent.run(row.id, row.name, row.line, row.deckId, row.policyId);
      if (id === "chapter-01")
        db.prepare("INSERT INTO story_documents VALUES (?, ?)").run(
          "prototype-prologue-v1",
          JSON.stringify(storyReleaseFixture().chapters[0]!.document),
        );
    }
    db.prepare("UPDATE package_meta SET value_json=? WHERE key='config'").run(
      JSON.stringify(config),
    );
    db.close();
    const bytes = readFileSync(pack.file);
    const fileKey = id;
    const destination = `${fixture.files.root}/${encodeURIComponent(fileKey)}`;
    writeFileSync(destination, bytes);
    unlinkSync(pack.file);
    packageFiles.push(destination);
    fixture.registry.run(
      "INSERT INTO installed_packages VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        JSON.stringify(pack.manifest),
        fileKey,
        bytes.length,
        createHash("sha256").update(bytes).digest("hex"),
        "2026-09-24T00:00:00.000Z",
      ],
    );
  }
  fixture.registry.exec("UPDATE registry_state SET generation=1");
  const warningListeners = new Set<(warning: MediaWarning) => void>();
  const runtime = new AtomicPackageRuntime({
    mediaWarning: (warning) => {
      for (const listener of warningListeners) listener(warning);
    },
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T00:00:00.000Z",
    randomId: () => crypto.randomUUID(),
  });
  const userData = storyUserRuntime(globalThis.indexedDB ?? fixture);
  const storage: LocalStorageClient = {
    packages: runtime,
    content: { query: (request, signal) => runtime.query(request, signal) },
    userData,
    subscribeMediaWarnings: (listener) => {
      warningListeners.add(listener);
      return () => {
        warningListeners.delete(listener);
      };
    },
    close: async () => runtime.close(),
  };
  const admission = createApplicationAdmission();
  const ready = createUserPersistenceOwner(storage, admission).then((owner) => {
    const service = createSqliteApplicationService({
      storage,
      users: owner.services,
      admission,
      flushUserWrites: () => owner.flush(),
    });
    const application = service.application;
    // Fault-focused callers may wrap only repository operations, never content loading.
    if (saves !== undefined) {
      const acquire = application.acquire.bind(application);
      application.acquire = async (mode, signal) => {
        const session = await acquire(mode, signal);
        return (
          session.kind === "story"
            ? { ...session, inputs: { ...session.inputs, saves } }
            : session
        ) as typeof session;
      };
    }
    return { service, owner, application };
  });
  disposals.push(async () => {
    const { service } = await ready;
    await service.dispose();
    await runtime.close();
    for (const file of packageFiles) unlinkSync(file);
    unlinkSync(fixture.registryFixture.file);
    rmdirSync(fixture.files.root);
  });
  return ready.then(
    ({ owner, service, application }): coreGate.CoreStartup => ({
      gate: { kind: "ready", generation: 1 },
      userPersistence: saves === undefined ? owner : { ...owner, saves },
      application,
      applicationStatus: service.status,
      subscribeApplicationStatus: service.subscribeStatus,
      dispose: () => service.dispose(),
    }),
  );
}

export function semanticShellFixture(
  gameplay?: FixtureGameplay,
  saves?: GenerationSaveRepository,
) {
  const ready = semanticShellStartup(gameplay, saves);
  vi.spyOn(coreGate, "loadCoreStartup").mockImplementation(() => ready);
  return { initialCoreGate: null };
}
