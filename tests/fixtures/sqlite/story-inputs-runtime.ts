import { readFileSync, rmSync } from "node:fs";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { ShellUserServices } from "../../../src/shell/core/user-services.ts";
import type {
  ContentQuery,
  LocalStorageClient,
  MediaWarning,
  UserDataStore,
} from "../../../src/storage/index.ts";
import { AtomicPackageRuntime } from "../../../src/storage/runtime/atomic-package-runtime.ts";
import { UserDataRuntime } from "../legacy-user-data-runtime.ts";
import {
  createImportablePackageFixture,
  createUserDataFixture,
  insertAsset,
} from "../../../tests/unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  createRuntimeFixture,
  databaseAdapter,
  fixtureFile,
} from "../../../tests/unit/storage/runtime-fixtures.ts";

export interface StoryInputsHarness {
  readonly storage: LocalStorageClient;
  readonly users: ShellUserServices;
  readonly queries: ContentQuery[];
  readonly warnings: MediaWarning[];
  readonly userReads: { count: number };
  readonly userDatabase: ReturnType<typeof createUserDataFixture>["database"];
  readonly generation: number;
  readonly userFile: string;
  close(): Promise<void>;
}

export async function createStoryInputsHarness(): Promise<StoryInputsHarness> {
  const fixture = createRuntimeFixture();
  const warnings: MediaWarning[] = [];
  const listeners = new Set<(warning: MediaWarning) => void>();
  const content = new AtomicPackageRuntime({
    registry: fixture.registry,
    files: fixture.files,
    now: () => "2026-09-24T12:00:00.000Z",
    randomId: () => crypto.randomUUID(),
    mediaWarning(warning) {
      warnings.push(warning);
      for (const listener of listeners) listener(warning);
    },
  });

  const core = createImportablePackageFixture("duel-core");
  replaceAsset(
    core.database,
    "engine/ocgcore.sync.wasm",
    "application/wasm",
    new Uint8Array(
      readFileSync("vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
    ),
  );
  replaceAsset(
    core.database,
    "engine/vendor-manifest.json",
    "application/json",
    new Uint8Array(
      readFileSync("vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
    ),
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
  for (let code = 2; code <= 20; code += 1) {
    insertCard.run(
      code,
      JSON.stringify({
        code,
        alias: code === 2 ? 1 : 0,
        setcodes: [],
        type: code === 19 ? 0x4000 : 1,
        level: 1,
        attribute: 1,
        race: "1",
        attack: code,
        defense: code,
        lscale: 0,
        rscale: 0,
        linkMarker: 0,
        scope: code === 20 ? 8 : 0,
      }),
    );
    insertText.run(code, "en", `Global Card ${code}`, `Text ${code}`, "[]");
    insertSearch.run(
      "en",
      code,
      `global card ${String(code).padStart(2, "0")}`,
    );
    const source = `return ${code}`;
    insertScript.run(
      `c${code}.lua`,
      source,
      bytesToHex(sha256(new TextEncoder().encode(source))),
    );
  }
  library.database
    .prepare("UPDATE sets SET metadata_json=? WHERE id='fixture-set'")
    .run(
      JSON.stringify({
        id: "fixture-set",
        name: "Fixture Set",
        releaseYear: 2002,
        imageAssetPath: "sets/fixture-set.webp",
      }),
    );
  insertAsset(
    library.database,
    "sets/fixture-set.webp",
    "image/webp",
    new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  );
  library.database.exec("VACUUM");
  library.database.close();

  const freeplay = createImportablePackageFixture("freeplay");
  freeplay.database
    .prepare("UPDATE decks SET cards_json=? WHERE id='starter'")
    .run(JSON.stringify({ main: repeatedRange(2, 15), extra: [], side: [] }));
  freeplay.database
    .prepare("UPDATE freeplay_card_limits SET deck_limit=0 WHERE card_code=1")
    .run();
  freeplay.database
    .prepare("INSERT INTO freeplay_card_limits VALUES (18, 0)")
    .run();
  freeplay.database.exec("VACUUM");
  freeplay.database.close();

  const chapter = createImportablePackageFixture("chapter-01");
  chapter.database
    .prepare("UPDATE decks SET cards_json=? WHERE id='starter'")
    .run(
      JSON.stringify({
        main: [1, ...repeatedRange(2, 14)],
        extra: [],
        side: [],
      }),
    );
  chapter.database.exec("DELETE FROM chapter_card_limits");
  const insertLimit = chapter.database.prepare(
    "INSERT INTO chapter_card_limits VALUES (?, ?)",
  );
  insertLimit.run(1, 1);
  for (let code = 15; code <= 16; code += 1) insertLimit.run(code, 0);
  insertLimit.run(17, 2);
  chapter.database
    .prepare("UPDATE package_meta SET value_json=? WHERE key='config'")
    .run(
      JSON.stringify({
        title: "Chapter 1",
        chapterNumber: 1,
        storyContentId: "prototype-prologue-v1",
        defaults: { starterDeckId: "starter", opponentId: "opponent" },
        setIds: ["fixture-set"],
        mapAssetPath: "media/city-map.svg",
      }),
    );
  insertAsset(
    chapter.database,
    "media/city-map.svg",
    "image/svg+xml",
    new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"),
  );
  const story = JSON.parse(
    (
      chapter.database
        .prepare("SELECT payload_json FROM story_documents")
        .get() as { payload_json: string }
    ).payload_json,
  );
  story.beats.push({
    ...story.beats[0],
    id: "retired-beat",
    text: "This beat exists before the update.",
  });
  chapter.database
    .prepare("UPDATE story_documents SET payload_json=?")
    .run(JSON.stringify(story));
  chapter.database.exec("VACUUM");
  chapter.database.close();

  const imported = await content.importPackages(
    [core, library, freeplay, chapter].map(({ file }) => fixtureFile(file)),
    0,
    new AbortController().signal,
    () => {},
  );
  if (imported.kind === "failed") throw new Error(imported.error.code);

  const userFixture = createUserDataFixture();
  const userFiles = createNodeFileStore();
  const userRuntime = new UserDataRuntime({
    database: databaseAdapter(userFixture.database),
    files: userFiles,
    randomId: () => crypto.randomUUID(),
  });
  const userReads = { count: 0 };
  const userData: UserDataStore = {
    readUser(namespace, key) {
      userReads.count += 1;
      return userRuntime.readUser(namespace, key);
    },
    listUser(namespace) {
      userReads.count += 1;
      return userRuntime.listUser(namespace);
    },
    writeUser: (mutations) => userRuntime.writeUser(mutations),
    exportUserData: () => userRuntime.exportUserData(),
    inspectUserDataBackup: (file) => userRuntime.inspectUserDataBackup(file),
    restoreUserData: (token, revision, confirmed) =>
      userRuntime.restoreUserData(token, revision, confirmed),
  };
  const queries: ContentQuery[] = [];
  const storage: LocalStorageClient = {
    packages: content,
    content: {
      query(request, signal) {
        queries.push(request);
        return content.query(request, signal);
      },
    },
    userData,
    subscribeMediaWarnings(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async close() {
      await userRuntime.close();
      content.close();
    },
  };
  const users = Object.freeze({
    preferences: Object.freeze({}),
    createDeckRepository() {
      throw new Error("DECK_REPOSITORY_NOT_OPENED");
    },
  }) as unknown as ShellUserServices;

  return {
    storage,
    users,
    queries,
    warnings,
    userReads,
    userDatabase: userFixture.database,
    userFile: userFixture.file,
    generation: imported.value.generation,
    async close() {
      await storage.close();
      rmSync(fixture.files.root, { recursive: true, force: true });
      rmSync(userFiles.root, { recursive: true, force: true });
      for (const item of [
        fixture.registryFixture.file,
        userFixture.file,
        core.file,
        library.file,
        freeplay.file,
        chapter.file,
      ])
        rmSync(item, { force: true });
    },
  };
}

function repeatedRange(first: number, last: number): number[] {
  return Array.from(
    { length: last - first + 1 },
    (_, index) => first + index,
  ).flatMap((code) => [code, code, code]);
}

function replaceAsset(
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
