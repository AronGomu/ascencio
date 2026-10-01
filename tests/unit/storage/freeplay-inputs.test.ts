import { readFileSync, rmSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { validateFrozenBattleExecutable } from "../../../src/battle/ports/index.ts";
import { cardCode, createCards } from "../../../src/cards/index.ts";
import { OCG_TYPE } from "../../../src/cards/classification/index.ts";
import { cardsDeckCatalog } from "../../../src/decks/catalog/index.ts";
import {
  catalogByCode,
  quantityLimit,
  validateDeckDraft,
  validatePublishedDecks,
} from "../../../src/decks/validation/index.ts";
import { assertInstalledCardPool } from "../../../src/battle/worker/decks/resolve-duel-decks.ts";
import { loadNormalizedCatalog } from "../../../scripts/lib/sqlite-content/normalized-package-source.ts";
import productionDecks from "../../../content/freeplay/decks.json" with { type: "json" };
import productionLimits from "../../../content/freeplay/limits.json" with { type: "json" };
import {
  closeFreeplayInputs,
  loadFreeplayInputs,
} from "../../../src/shell/adapters/sqlite-freeplay-inputs.ts";
import type { ShellUserServices } from "../../../src/shell/core/user-services.ts";
import type {
  ContentQueries,
  ContentQuery,
  LocalStorageClient,
  MediaWarning,
  QueryMap,
  StorageResult,
} from "../../../src/storage/index.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import {
  createImportablePackageFixture,
  createUserDataFixture,
  insertAsset,
} from "./sqlite-fixtures.ts";
import {
  createNodeFileStore,
  createRuntimeFixture,
  databaseAdapter,
  fixtureFile,
} from "./runtime-fixtures.ts";
import { createSqliteUserServices } from "../../../src/shell/adapters/sqlite-user-services.ts";
import { UserDataRuntime } from "../../fixtures/legacy-user-data-runtime.ts";
import {
  createBlankDeck,
  emptyDeckHistory,
  pushDeckUpdate,
} from "../../../src/decks/editing/index.ts";
import { installedSelectableDecks } from "../../../src/battle/decks/installed-selectable-decks.ts";
import { findSelectableDeck } from "../../../src/battle/decks/selectable-decks.ts";
import { parseBattleRequest } from "../../../src/battle/battle-contracts.ts";
import {
  loadFreePlayDecks,
  listedFreePlayDecks,
  refreshFreePlayDecks,
  resetFreePlayDeckCacheForTests,
} from "../../../src/shell/screens/free-play-deck-listing.ts";
import { duplicateLocalDeck } from "../../../src/shell/screens/free-play-deck-actions.ts";
import type { DeckRepository } from "../../../src/decks/repository/index.ts";

interface Harness {
  readonly storage: LocalStorageClient;
  readonly users: ShellUserServices;
  readonly queries: ContentQuery[];
  readonly warnings: MediaWarning[];
  badWasm: boolean;
  dispose(): void;
}

let sharedHarness: Harness;

beforeAll(async () => {
  sharedHarness = await createHarness();
}, 120_000);

beforeEach(() => {
  sharedHarness.queries.length = 0;
  sharedHarness.warnings.length = 0;
  sharedHarness.badWasm = false;
});

afterEach(() => vi.restoreAllMocks());

afterAll(() => sharedHarness.dispose());

function definition(code: number): string {
  return JSON.stringify({
    code,
    alias: code === 499 ? 1 : 0,
    setcodes: [],
    type: code === 500 ? OCG_TYPE.TOKEN : 1,
    level: 1,
    attribute: 1,
    race: "1",
    attack: code,
    defense: code,
    lscale: 0,
    rscale: 0,
    linkMarker: 0,
    scope: code === 501 ? 8 : 0,
  });
}

function updateAsset(
  database: ReturnType<typeof createImportablePackageFixture>["database"],
  path: string,
  mime: string,
  bytes: Uint8Array,
): void {
  database
    .prepare(
      "UPDATE assets SET mime=?, byte_length=?, sha256=?, data=? WHERE path=?",
    )
    .run(mime, bytes.byteLength, bytesToHex(sha256(bytes)), bytes, path);
}

async function createHarness(): Promise<Harness> {
  const fixture = createRuntimeFixture();
  const warnings: MediaWarning[] = [];
  const warningListeners = new Set<(warning: MediaWarning) => void>();
  const runtime = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => crypto.randomUUID(),
    mediaWarning(warning) {
      warnings.push(warning);
      for (const listener of warningListeners) listener(warning);
    },
  });
  const core = createImportablePackageFixture("duel-core");
  const wasm = new Uint8Array(
    readFileSync("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
  );
  const vendorManifest = new Uint8Array(
    readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
  );
  updateAsset(
    core.database,
    "engine/ocgcore.sync.wasm",
    "application/wasm",
    wasm,
  );
  updateAsset(
    core.database,
    "engine/vendor-manifest.json",
    "application/json",
    vendorManifest,
  );
  core.database.exec("VACUUM");
  core.database.close();

  const library = createImportablePackageFixture("card-library");
  const insertCard = library.database.prepare(
    "INSERT INTO cards VALUES (?, ?)",
  );
  const insertText = library.database.prepare(
    "INSERT INTO card_texts VALUES (?, ?, ?, ?, ?)",
  );
  const insertSearch = library.database.prepare(
    "INSERT INTO card_search VALUES (?, ?, ?)",
  );
  const insertScript = library.database.prepare(
    "INSERT INTO scripts VALUES (?, ?, ?)",
  );
  for (let code = 2; code <= 501; code += 1) {
    insertCard.run(code, definition(code));
    insertText.run(code, "en", `Global Card ${code}`, `Text ${code}`, "[]");
    insertSearch.run(
      "en",
      code,
      `global card ${String(code).padStart(3, "0")}`,
    );
    const name = `g${String(code).padStart(4, "0")}.lua`;
    const source = `return ${code}`;
    insertScript.run(
      name,
      source,
      bytesToHex(sha256(new TextEncoder().encode(source))),
    );
  }
  insertAsset(
    library.database,
    "cards/full/1.jpg",
    "image/jpeg",
    new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  );
  library.database.exec("VACUUM");
  library.database.close();

  const freeplay = createImportablePackageFixture("freeplay");
  freeplay.database.exec(
    "INSERT INTO freeplay_card_limits VALUES (16, 1), (17, 2), (18, 0)",
  );
  freeplay.database.close();
  const imported = await runtime.importPackages(
    [
      fixtureFile(freeplay.file),
      fixtureFile(core.file),
      fixtureFile(library.file),
    ],
    0,
    new AbortController().signal,
    () => {},
  );
  expect(imported.kind).toBe("ok");

  const queries: ContentQuery[] = [];
  const harness = {
    queries,
    warnings,
    badWasm: false,
  } as Harness;
  const query = (async <Q extends ContentQuery>(
    request: Q,
    signal: AbortSignal,
  ): Promise<StorageResult<QueryMap[Q["kind"]]>> => {
    queries.push(request);
    if (request.kind === "story") throw new Error("STORY_READ_FORBIDDEN");
    if (
      harness.badWasm &&
      request.kind === "asset" &&
      request.packageId === "duel-core" &&
      request.path === "engine/ocgcore.sync.wasm"
    )
      return {
        kind: "ok",
        value: {
          mime: "application/wasm",
          bytes: new Uint8Array([0, 97, 115, 109]),
        },
      } as StorageResult<QueryMap[Q["kind"]]>;
    return runtime.query(request, signal);
  }) as ContentQueries["query"];
  const users = Object.freeze({
    preferences: Object.freeze({}),
    createDeckRepository: vi.fn(() => {
      throw new Error("DECK_REPOSITORY_NOT_OPENED");
    }),
  }) as unknown as ShellUserServices;
  const storage: LocalStorageClient = {
    packages: runtime,
    content: { query },
    userData: {} as LocalStorageClient["userData"],
    subscribeMediaWarnings(listener) {
      warningListeners.add(listener);
      return () => warningListeners.delete(listener);
    },
    async close() {
      runtime.close();
    },
  };
  Object.assign(harness, {
    storage,
    users,
    dispose() {
      runtime.close();
      rmSync(fixture.files.root, { recursive: true, force: true });
      for (const file of [
        fixture.registryFixture.file,
        core.file,
        library.file,
        freeplay.file,
      ])
        rmSync(file, { force: true });
    },
  });
  return harness;
}

function canonicalSnapshotId(
  packages: readonly {
    readonly packageId: string;
    readonly version: string;
    readonly sha256: string;
  }[],
): string {
  const canonical = JSON.stringify(
    packages
      .map(({ packageId, version, sha256 }) => ({ packageId, version, sha256 }))
      .sort((left, right) => left.packageId.localeCompare(right.packageId)),
  );
  return bytesToHex(sha256(new TextEncoder().encode(canonical)));
}

describe("loadFreeplayInputs", () => {
  it("keeps production Free Play presets legal against actual global metadata and limits", async () => {
    const source = await loadNormalizedCatalog("assets/content/card-library", [
      "en",
    ]);
    const texts = new Map(source.texts.map((text) => [text.cardCode, text]));
    const cards = createCards(
      source.cards.map((card) => ({
        ...card,
        code: cardCode(card.code),
        name: texts.get(card.code)!.name,
        description: texts.get(card.code)!.description,
        strings: texts.get(card.code)!.strings,
        images: {
          full: { code: cardCode(card.code), variant: "full" as const },
          cropped: { code: cardCode(card.code), variant: "cropped" as const },
        },
      })),
    );
    const ruleset = {
      id: "production-freeplay",
      revision: "checked-in-source",
      quantityByCode: new Map(
        productionLimits.map(({ cardCode, deckLimit }) => [
          cardCode,
          deckLimit as 0 | 1 | 2,
        ]),
      ),
    };
    const catalog = new Map(
      cardsDeckCatalog(cards).map((card) => [card.code, card]),
    );
    for (const deck of productionDecks) {
      expect(deck.cards.main, deck.id).toHaveLength(40);
      expect(
        validateDeckDraft(deck.cards, catalog, ruleset).issues.filter(
          ({ severity }) => severity === "error",
        ),
        deck.id,
      ).toEqual([]);
      expect(() =>
        validatePublishedDecks([deck.cards], cards, ruleset),
      ).not.toThrow();
    }
  });

  it("retains package-valid unsupported metadata but excludes it from Worker deck legality", async () => {
    const harness = sharedHarness;
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    try {
      expect(inputs.editor.cards.get(cardCode(501))?.scope).toBe(8);
      expect(inputs.editor.cards.get(cardCode(500))?.type).toBe(OCG_TYPE.TOKEN);
      const runtime = await inputs.battle.load(new AbortController().signal);
      expect(runtime.cards.find(({ code }) => code === 501)).toBeDefined();
      expect(runtime.cards.find(({ code }) => code === 499)?.alias).toBe(1);
      const allowed = new Set<number>(runtime.allowedCardCodes);
      expect(allowed.has(501)).toBe(false);
      expect(allowed.has(500)).toBe(false);
      expect(allowed.has(499)).toBe(true);
      expect(allowed.has(1)).toBe(true);
      for (const code of [500, 501]) {
        expect(() => assertInstalledCardPool([code], allowed)).toThrow();
        const validation = validateDeckDraft(
          { main: [code], extra: [], side: [] },
          new Map(inputs.presentation.cards.map((card) => [card.code, card])),
          {
            id: runtime.ruleset.id,
            revision: runtime.ruleset.revision,
            quantityByCode: new Map(runtime.ruleset.quantityByCode),
          },
        );
        expect(validation.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "unsupported-card",
              cardCode: code,
            }),
          ]),
        );
      }
      expect(() => assertInstalledCardPool([1, 499], allowed)).not.toThrow();
    } finally {
      inputs.close();
    }
  });

  it("aborts pending manifest and script-page siblings when the engine read fails", async () => {
    const harness = sharedHarness;
    const caller = new AbortController();
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      caller.signal,
    );
    const original = harness.storage.content.query;
    const signals: AbortSignal[] = [];
    let pending = 0;
    let scriptPages = 0;
    let failEngine!: (error: Error) => void;
    const engineFailure = new Promise<never>((_, reject) => {
      failEngine = reject;
    });
    vi.spyOn(harness.storage.content, "query").mockImplementation((async <
      Q extends ContentQuery,
    >(
      request: Q,
      signal: AbortSignal,
    ) => {
      signals.push(signal);
      if (request.kind === "asset" && request.path.endsWith(".wasm"))
        return engineFailure;
      if (request.kind === "scripts" && ++scriptPages === 1)
        return original(request, signal);
      return new Promise<StorageResult<QueryMap[Q["kind"]]>>((resolve) => {
        pending += 1;
        signal.addEventListener(
          "abort",
          () => {
            pending -= 1;
            resolve({ kind: "failed", error: { code: "OPERATION_CANCELLED" } });
          },
          { once: true },
        );
        if (request.kind === "scripts")
          failEngine(new Error("injected engine read failure"));
      });
    }) as ContentQueries["query"]);
    const remove = vi.spyOn(caller.signal, "removeEventListener");
    try {
      await expect(inputs.battle.load(caller.signal)).rejects.toThrow(
        "APP_REQUIRED_INPUT_FAILED",
      );
      expect(scriptPages).toBe(2);
      expect(pending).toBe(0);
      expect(new Set(signals).size).toBe(1);
      expect(signals[0]).not.toBe(caller.signal);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(caller.signal.aborted).toBe(false);
      expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    } finally {
      caller.abort();
      inputs.close();
    }
  });

  it("cancels all runtime reads on caller abort and skips already-aborted loads", async () => {
    const harness = sharedHarness;
    const caller = new AbortController();
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      caller.signal,
    );
    const signals: AbortSignal[] = [];
    let pending = 0;
    const query = vi
      .spyOn(harness.storage.content, "query")
      .mockImplementation((async <Q extends ContentQuery>(
        _request: Q,
        signal: AbortSignal,
      ) => {
        signals.push(signal);
        return new Promise<StorageResult<QueryMap[Q["kind"]]>>((resolve) => {
          pending += 1;
          signal.addEventListener(
            "abort",
            () => {
              pending -= 1;
              resolve({
                kind: "failed",
                error: { code: "OPERATION_CANCELLED" },
              });
            },
            { once: true },
          );
        });
      }) as ContentQueries["query"]);
    try {
      const loading = inputs.battle.load(caller.signal);
      expect(pending).toBe(3);
      caller.abort();
      await expect(loading).rejects.toMatchObject({ name: "AbortError" });
      expect(pending).toBe(0);
      expect(signals.every((signal) => signal.aborted)).toBe(true);
      expect(new Set(signals).size).toBe(1);
      query.mockClear();
      await expect(inputs.battle.load(caller.signal)).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(query).not.toHaveBeenCalled();
    } finally {
      inputs.close();
    }
  });
  it("loads complete paginated global metadata and Free Play data without Story", async () => {
    const harness = sharedHarness;
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );

    expect(inputs.users).toBe(harness.users);
    expect(inputs.cards.all()).toHaveLength(501);
    expect(inputs.cards.get(cardCode(501))?.name).toBe("Global Card 501");
    expect(inputs.editor.cards).toBe(inputs.cards);
    expect(inputs.editor.starter).toMatchObject({
      name: "Starter",
      cards: { main: [1] },
    });
    expect(inputs.presentation).toMatchObject({
      cards: expect.arrayContaining([expect.objectContaining({ code: 501 })]),
      decks: [expect.objectContaining({ id: "starter" })],
      opponents: [
        expect.objectContaining({ id: "opponent", deckId: "starter" }),
      ],
      defaults: { starterDeckId: "starter", opponentId: "opponent" },
    });
    expect(harness.queries.filter(({ kind }) => kind === "cards")).toHaveLength(
      2,
    );
    expect(harness.queries.some(({ kind }) => kind === "story")).toBe(false);
    expect(harness.queries.some(({ kind }) => kind === "asset")).toBe(false);
    expect(harness.queries.some(({ kind }) => kind === "scripts")).toBe(false);
    inputs.close();
  });

  it("builds validated frozen runtime identity and preloads every script", async () => {
    const harness = sharedHarness;
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    const stack = await harness.storage.packages.current();
    expect(stack.kind).toBe("ok");

    const caller = new AbortController();
    const remove = vi.spyOn(caller.signal, "removeEventListener");
    const runtime = await inputs.battle.load(caller.signal);
    expect(caller.signal.aborted).toBe(false);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(runtime.snapshotId).toBe(
      canonicalSnapshotId(stack.kind === "ok" ? stack.value.packages : []),
    );
    expect(Object.isFrozen(runtime.wasmBinary)).toBe(true);
    expect(runtime.cards).toHaveLength(501);
    expect(runtime.texts).toHaveLength(501);
    expect(runtime.scripts).toHaveLength(502);
    expect(
      harness.queries.filter(({ kind }) => kind === "scripts"),
    ).toHaveLength(2);
    expect(runtime.ruleset).toMatchObject({ id: "fixture" });
    expect(runtime.ruleset).toEqual({
      id: inputs.editor.ruleset.id,
      revision: inputs.editor.ruleset.revision,
      quantityByCode: [...inputs.editor.ruleset.quantityByCode],
    });
    const freeplay =
      stack.kind === "ok"
        ? stack.value.packages.find(({ packageId }) => packageId === "freeplay")
        : undefined;
    expect(runtime.ruleset.revision).toBe(
      `${freeplay?.version}:${freeplay?.sha256}`,
    );
    await expect(
      validateFrozenBattleExecutable(
        new Uint8Array(
          readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
        ),
        new Uint8Array(runtime.wasmBinary),
      ),
    ).resolves.toBeUndefined();
    expect(harness.queries.some(({ kind }) => kind === "story")).toBe(false);
    inputs.close();
  });

  it("rejects a package-valid but unpinned engine before producing runtime input", async () => {
    const harness = sharedHarness;
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    harness.badWasm = true;
    await expect(
      inputs.battle.load(new AbortController().signal),
    ).rejects.toThrow("BATTLE_RUNTIME_INVALID");
    inputs.close();
  });

  it("keeps optional media lazy and returns null with correlated warning", async () => {
    const harness = sharedHarness;
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fixture");
    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    expect(harness.queries.some(({ kind }) => kind === "asset")).toBe(false);

    await expect(
      inputs.images.acquire(
        cardCode(501),
        "full",
        new AbortController().signal,
      ),
    ).resolves.toBeNull();
    expect(harness.warnings).toEqual([
      {
        packageId: "card-library",
        path: "cards/full/501.jpg",
        reason: "missing",
      },
    ]);
    inputs.close();
  });

  it("stops paginated reads on cancellation and exposes idempotent cleanup", async () => {
    const harness = sharedHarness;
    const controller = new AbortController();
    const original = harness.storage.content.query;
    let cardPages = 0;
    harness.storage.content.query = (async <Q extends ContentQuery>(
      request: Q,
      signal: AbortSignal,
    ) => {
      const result = await original(request, signal);
      if (request.kind === "cards" && ++cardPages === 1) controller.abort();
      return result;
    }) as ContentQueries["query"];
    await expect(
      loadFreeplayInputs(harness.storage, harness.users, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(cardPages).toBe(1);
    harness.storage.content.query = original;

    const inputs = await loadFreeplayInputs(
      harness.storage,
      harness.users,
      new AbortController().signal,
    );
    closeFreeplayInputs(inputs);
    closeFreeplayInputs(inputs);
    await expect(
      inputs.images.acquire(cardCode(1), "full", new AbortController().signal),
    ).rejects.toThrow("SQLITE_IMAGE_SOURCE_CLOSED");
  });
});

describe("Free Play package ruleset propagation", () => {
  const battle = {
    installedSelectableDecks,
    findSelectableDeck,
    parseBattleRequest,
  };
  const filler = Array.from({ length: 13 }, (_, index) => index + 3).flatMap(
    (code) => [code, code, code],
  );

  async function setup(main: readonly number[]) {
    const database = createUserDataFixture();
    const files = createNodeFileStore();
    const userData = new UserDataRuntime({
      database: databaseAdapter(database.database),
      files,
      randomId: () => crypto.randomUUID(),
    });
    const users = createSqliteUserServices(userData);
    const inputs = await loadFreeplayInputs(
      sharedHarness.storage,
      users,
      new AbortController().signal,
    );
    const repository = users.createDeckRepository();
    const catalog = catalogByCode(inputs.presentation.cards);
    const base = createBlankDeck(
      "Package deck",
      catalog,
      inputs.editor.ruleset,
    );
    const deck = {
      ...base,
      main,
      validation: validateDeckDraft(
        { ...base, main },
        catalog,
        inputs.editor.ruleset,
      ),
    };
    const stored = await repository.createAndOpen(
      deck,
      pushDeckUpdate(emptyDeckHistory(), {
        deckId: deck.id,
        before: base,
        after: deck,
        reason: "import",
      }),
    );
    await repository.setDefaultDeck(deck.id);
    return {
      inputs,
      repository,
      catalog,
      stored,
      async close() {
        inputs.close();
        await userData.close();
        rmSync(database.file, { force: true });
        rmSync(files.root, { recursive: true, force: true });
      },
    };
  }

  it("rejects banned package code18 before producing a local battle selection", async () => {
    const h = await setup([...filler, 18]);
    try {
      const listed = await loadFreePlayDecks(
        battle,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      const local = listed.find((deck) => deck.source === "local")!;
      expect(local.selection).toBeNull();
      expect(local.blockReason).toBe(
        "Global Card 18 is forbidden by the pinned ruleset.",
      );
      expect(await h.repository.load(h.stored.deck.id)).toEqual(h.stored);
    } finally {
      await h.close();
    }
  });

  it.each([
    { code: 16, count: 1, legal: true, limit: 1 },
    { code: 16, count: 2, legal: false, limit: 1 },
    { code: 17, count: 2, legal: true, limit: 2 },
    { code: 17, count: 3, legal: false, limit: 2 },
    { code: 2, count: 3, legal: true, limit: 3 },
    { code: 2, count: 4, legal: false, limit: 3 },
    { code: 499, count: 3, legal: true, limit: 3 },
    { code: 500, count: 1, legal: false, limit: 3 },
    { code: 501, count: 1, legal: false, limit: 3 },
  ])(
    "honors package limit $limit for $count copies of $code (selectable=$legal)",
    async ({ code, count, legal, limit }) => {
      const h = await setup([
        ...filler.slice(0, 40 - count),
        ...Array<number>(count).fill(code),
      ]);
      try {
        expect(quantityLimit(h.inputs.editor.ruleset, code)).toBe(limit);
        const listed = await loadFreePlayDecks(
          battle,
          h.inputs.presentation,
          () => h.repository,
          h.inputs.editor.ruleset,
        );
        expect(
          listed.find((deck) => deck.source === "local")!.selection !== null,
        ).toBe(legal);
      } finally {
        await h.close();
      }
    },
  );

  it.each(["local", "chapter"])(
    "stores duplicate validation under supplied package ruleset for %s source",
    async (source) => {
      const h = await setup([...filler, 18]);
      try {
        await duplicateLocalDeck(
          () => h.repository,
          source === "local" ? `local:${h.stored.deck.id}:1` : "chapter:probe",
          source === "chapter"
            ? { name: h.stored.deck.name, lists: h.stored.deck }
            : undefined,
          h.inputs.presentation.cards,
          h.inputs.editor.ruleset,
        );
        const copy = (await h.repository.list()).find(
          (deck) => deck.id !== h.stored.deck.id,
        )!;
        expect(copy.validation.status).toBe("errors");
        expect(copy.validation).toEqual(
          validateDeckDraft(copy, h.catalog, h.inputs.editor.ruleset),
        );
        expect(copy.validation.rulesetRevision).toBe(
          h.inputs.editor.ruleset.revision,
        );
        expect(copy.main).toEqual(h.stored.deck.main);
        expect(copy.revision).toBe(1);
        expect((await h.repository.load(copy.id))?.history).toEqual(
          emptyDeckHistory(),
        );
        expect(await h.repository.load(h.stored.deck.id)).toEqual(h.stored);
        expect(await h.repository.getDefaultDeck()).toBe(h.stored.deck.id);
        expect(await h.repository.getLastOpened()).toBe(h.stored.deck.id);
      } finally {
        await h.close();
      }
    },
  );

  it("threads package ruleset through repository-failure fallback", async () => {
    const h = await setup([...filler, 2]);
    try {
      const list = vi.fn(installedSelectableDecks);
      const listed = await loadFreePlayDecks(
        { ...battle, installedSelectableDecks: list },
        h.inputs.presentation,
        () => {
          throw new Error("repository unavailable");
        },
        h.inputs.editor.ruleset,
      );
      expect(listed.every((deck) => deck.source === "chapter")).toBe(true);
      expect(list).toHaveBeenCalledWith(
        h.inputs.presentation,
        expect.any(Object),
        expect.any(Map),
        h.inputs.editor.ruleset,
      );
    } finally {
      await h.close();
    }
  });

  function listingGate(repository: DeckRepository) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const createRepository = vi.fn(() => ({
      ...repository,
      async list() {
        await gate;
        return repository.list();
      },
    }));
    return { release, createRepository };
  }

  it.each([
    { dimension: "revision", order: "new-first" },
    { dimension: "revision", order: "old-first" },
    { dimension: "id", order: "new-first" },
    { dimension: "id", order: "old-first" },
    { dimension: "snapshot", order: "new-first" },
    { dimension: "snapshot", order: "old-first" },
  ])(
    "coalesces A/B/A by $dimension without promoting stale A ($order)",
    async ({ dimension, order }) => {
      resetFreePlayDeckCacheForTests();
      const h = await setup([...filler, 18]);
      const a = listingGate(h.repository);
      const b = listingGate(h.repository);
      const pending: Promise<unknown>[] = [];
      const ruleset = h.inputs.editor.ruleset;
      const previous = {
        ...ruleset,
        ...(dimension === "revision" ? { revision: "previous" } : {}),
        ...(dimension === "id" ? { id: "previous" } : {}),
        quantityByCode: new Map(),
      };
      const presentation = {
        ...h.inputs.presentation,
        ...(dimension === "snapshot" ? { snapshotId: "previous" } : {}),
      };
      try {
        const old = refreshFreePlayDecks(
          async () => battle,
          presentation,
          a.createRepository,
          previous,
        );
        const current = refreshFreePlayDecks(
          async () => battle,
          h.inputs.presentation,
          b.createRepository,
          ruleset,
        );
        const reused = refreshFreePlayDecks(
          async () => battle,
          presentation,
          a.createRepository,
          previous,
        );
        pending.push(old, current, reused);
        expect.soft(reused).toBe(old);
        expect(current).not.toBe(old);
        if (order === "old-first") {
          a.release();
          await old;
          expect.soft(listedFreePlayDecks(presentation, previous)).toBeNull();
        }
        b.release();
        const latest = await current;
        expect(listedFreePlayDecks(h.inputs.presentation, ruleset)).toBe(
          latest,
        );
        a.release();
        const [older] = await Promise.all([old, reused]);
        expect(
          older.find((deck) => deck.source === "local")?.selection,
        ).not.toBeNull();
        expect(
          latest.find((deck) => deck.source === "local")?.selection,
        ).toBeNull();
        expect.soft(a.createRepository).toHaveBeenCalledTimes(1);
        expect
          .soft(listedFreePlayDecks(h.inputs.presentation, ruleset))
          .toBe(latest);
        expect.soft(listedFreePlayDecks(presentation, previous)).toBeNull();
      } finally {
        a.release();
        b.release();
        await Promise.allSettled(pending);
        resetFreePlayDeckCacheForTests();
        await h.close();
      }
    },
  );

  it.each(["old-first", "new-first"])(
    "reset prevents stale publication or removal of replacement pending key (%s)",
    async (order) => {
      resetFreePlayDeckCacheForTests();
      const h = await setup([...filler, 18]);
      const a = listingGate(h.repository);
      const b = listingGate(h.repository);
      const pending: Promise<unknown>[] = [];
      const {
        presentation,
        editor: { ruleset },
      } = h.inputs;
      try {
        const old = refreshFreePlayDecks(
          async () => battle,
          presentation,
          a.createRepository,
          ruleset,
        );
        pending.push(old);
        resetFreePlayDeckCacheForTests();
        const current = refreshFreePlayDecks(
          async () => battle,
          presentation,
          b.createRepository,
          ruleset,
        );
        pending.push(current);
        expect(current).not.toBe(old);
        if (order === "old-first") {
          a.release();
          await old;
          expect.soft(listedFreePlayDecks(presentation, ruleset)).toBeNull();
          const reused = refreshFreePlayDecks(
            async () => battle,
            presentation,
            b.createRepository,
            ruleset,
          );
          pending.push(reused);
          expect(reused).toBe(current);
        }
        b.release();
        const latest = await current;
        a.release();
        await old;
        expect(listedFreePlayDecks(presentation, ruleset)).toBe(latest);
        expect(b.createRepository).toHaveBeenCalledTimes(1);
        const refreshed = refreshFreePlayDecks(
          async () => battle,
          presentation,
          () => h.repository,
          ruleset,
        );
        pending.push(refreshed);
        expect(refreshed).not.toBe(current);
        expect(listedFreePlayDecks(presentation, ruleset)).toBe(latest);
        const next = await refreshed;
        expect(listedFreePlayDecks(presentation, ruleset)).toBe(next);
        expect(next).not.toBe(latest);
      } finally {
        a.release();
        b.release();
        await Promise.allSettled(pending);
        resetFreePlayDeckCacheForTests();
        await h.close();
      }
    },
  );

  it("reset while pending does not resurrect completed state", async () => {
    resetFreePlayDeckCacheForTests();
    const h = await setup([...filler, 18]);
    const gate = listingGate(h.repository);
    const pending = refreshFreePlayDecks(
      async () => battle,
      h.inputs.presentation,
      gate.createRepository,
      h.inputs.editor.ruleset,
    );
    try {
      resetFreePlayDeckCacheForTests();
      gate.release();
      await pending;
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBeNull();
    } finally {
      gate.release();
      await Promise.allSettled([pending]);
      resetFreePlayDeckCacheForTests();
      await h.close();
    }
  });

  it("retries rejected key without publishing failed fallback or older work", async () => {
    resetFreePlayDeckCacheForTests();
    const h = await setup([...filler, 18]);
    const gate = listingGate(h.repository);
    const previous = {
      ...h.inputs.editor.ruleset,
      revision: "previous",
      quantityByCode: new Map(),
    };
    let fail = true;
    const list = vi.fn<typeof installedSelectableDecks>(async (...args) => {
      if (args[3] === h.inputs.editor.ruleset && fail)
        throw new Error("LISTING_FAILED");
      return installedSelectableDecks(...args);
    });
    const load = async () => ({ ...battle, installedSelectableDecks: list });
    const old = refreshFreePlayDecks(
      load,
      h.inputs.presentation,
      gate.createRepository,
      previous,
    );
    const pending: Promise<unknown>[] = [old];
    try {
      const failed = refreshFreePlayDecks(
        load,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      pending.push(failed);
      await expect(failed).rejects.toThrow("LISTING_FAILED");
      expect(
        list.mock.calls.filter((args) => args[3] === h.inputs.editor.ruleset),
      ).toHaveLength(2);
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBeNull();
      gate.release();
      await old;
      expect
        .soft(listedFreePlayDecks(h.inputs.presentation, previous))
        .toBeNull();
      fail = false;
      const retry = refreshFreePlayDecks(
        load,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      pending.push(retry);
      expect(retry).not.toBe(failed);
      const latest = await retry;
      expect(
        latest.find((deck) => deck.source === "local")?.selection,
      ).toBeNull();
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBe(latest);
    } finally {
      gate.release();
      await Promise.allSettled(pending);
      resetFreePlayDeckCacheForTests();
      await h.close();
    }
  });

  it("retries rejected battle loader without leaving a pending listing", async () => {
    resetFreePlayDeckCacheForTests();
    const h = await setup([...filler, 18]);
    try {
      const load = vi
        .fn()
        .mockRejectedValueOnce(new Error("LOAD_FAILED"))
        .mockResolvedValue(battle);
      const failed = refreshFreePlayDecks(
        load,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      await expect(failed).rejects.toThrow("LOAD_FAILED");
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBeNull();
      const retry = refreshFreePlayDecks(
        load,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      expect(retry).not.toBe(failed);
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBeNull();
      const latest = await retry;
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBe(latest);
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      resetFreePlayDeckCacheForTests();
      await h.close();
    }
  });

  it("never shares an in-flight listing across supplied ruleset revisions", async () => {
    resetFreePlayDeckCacheForTests();
    const h = await setup([...filler, 18]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending: Promise<unknown>[] = [];
    try {
      const previous = {
        ...h.inputs.editor.ruleset,
        revision: "previous",
        quantityByCode: new Map(),
      };
      await refreshFreePlayDecks(
        async () => battle,
        h.inputs.presentation,
        () => h.repository,
        previous,
      );
      const current = refreshFreePlayDecks(
        async () => battle,
        h.inputs.presentation,
        () => ({
          ...h.repository,
          async list() {
            await gate;
            return h.repository.list();
          },
        }),
        h.inputs.editor.ruleset,
      );
      pending.push(current);
      const old = refreshFreePlayDecks(
        async () => battle,
        h.inputs.presentation,
        () => h.repository,
        previous,
      );
      pending.push(old);
      expect(old).not.toBe(current);
      expect(
        (await old).find((deck) => deck.source === "local")?.selection,
      ).not.toBeNull();
      release();
      expect(
        (await current).find((deck) => deck.source === "local")?.selection,
      ).toBeNull();
    } finally {
      release();
      await Promise.all(pending);
      resetFreePlayDeckCacheForTests();
      await h.close();
    }
  });

  it("does not reuse a listing validated under another ruleset revision", async () => {
    resetFreePlayDeckCacheForTests();
    const h = await setup([...filler, 18]);
    try {
      const previous = {
        ...h.inputs.editor.ruleset,
        revision: "previous",
        quantityByCode: new Map(),
      };
      await refreshFreePlayDecks(
        async () => battle,
        h.inputs.presentation,
        () => h.repository,
        previous,
      );
      expect(
        listedFreePlayDecks(h.inputs.presentation, previous)?.find(
          (deck) => deck.source === "local",
        )?.selection,
      ).not.toBeNull();
      expect(
        listedFreePlayDecks(h.inputs.presentation, h.inputs.editor.ruleset),
      ).toBeNull();
      const current = await refreshFreePlayDecks(
        async () => battle,
        h.inputs.presentation,
        () => h.repository,
        h.inputs.editor.ruleset,
      );
      expect(
        current.find((deck) => deck.source === "local")?.selection,
      ).toBeNull();
    } finally {
      resetFreePlayDeckCacheForTests();
      await h.close();
    }
  });
});

it.each([
  "src/shell/screens/free-play-deck-listing.ts",
  "src/shell/screens/free-play-deck-actions.ts",
  "src/battle/app/App.svelte",
])("requires supplied ruleset instead of prototype default in %s", (file) => {
  expect(readFileSync(file, "utf8")).not.toContain("PROTOTYPE_RULESET");
});
