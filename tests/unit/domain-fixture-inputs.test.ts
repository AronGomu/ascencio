import { loadCollectionCatalog } from "../../src/story/collection/collection-cards.ts";
import {
  domainCorpusExpectations,
  digest,
} from "../fixtures/domain-corpus-expectations.ts";
import { unlinkSync, rmdirSync, existsSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { packageQueryFixture } from "../fixtures/package-query.ts";
import { loadFreeplayInputs } from "../../src/shell/adapters/sqlite-freeplay-inputs.ts";
import { loadStoryInputs } from "../../src/shell/adapters/sqlite-story-inputs.ts";
import { createSqliteUserServices } from "../../src/shell/adapters/sqlite-user-services.ts";
import { UserDataRuntime } from "../fixtures/legacy-user-data-runtime.ts";
import { createUserDataFixture } from "./storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "./storage/runtime-fixtures.ts";
import type { LocalStorageClient } from "../../src/storage/index.ts";

it("domain fixture loads current Freeplay and Story semantic adapters from normalized SQLite", async () => {
  const expected = domainCorpusExpectations();
  const fixture = await packageQueryFixture();
  const db = createUserDataFixture();
  const files = createNodeFileStore();
  const users = new UserDataRuntime({
    database: databaseAdapter(db.database),
    files,
    randomId: () => crypto.randomUUID(),
  });
  const storage = {
    content: fixture.content,
    userData: users,
    packages: {
      current: async () => ({
        kind: "ok",
        value: { generation: 1, packages: fixture.packages },
      }),
    },
    // Adapters only read these ports; user operations still execute real SQLite.
  } as unknown as LocalStorageClient;
  try {
    const services = createSqliteUserServices(users);
    const freeplay = await loadFreeplayInputs(
      storage,
      services,
      new AbortController().signal,
    );
    try {
      expect(
        freeplay.cards
          .all()
          .map(({ code }) => code)
          .sort((a, b) => a - b),
      ).toEqual(expected.codes);
      expect(freeplay.cards.all()).toHaveLength(expected.codes.length);
      expect(freeplay.presentation.decks).toEqual(expected.decks);
      expect(freeplay.presentation.opponents).toEqual(
        expected.opponents.map(({ id, name, line, deckId }) => ({
          id,
          name,
          line,
          deckId,
        })),
      );
      expect(freeplay.presentation.defaults).toEqual(expected.config.defaults);
      expect(freeplay.collectionSets).toHaveLength(expected.globalSetCount);
      const globalSets = await fixture.content.query(
        { kind: "sets", packageId: "card-library" },
        new AbortController().signal,
      );
      expect(globalSets.kind).toBe("ok");
      if (globalSets.kind === "ok") {
        expect(
          globalSets.value.some(({ releaseYear }) => releaseYear === null),
        ).toBe(true);
        expect(freeplay.collectionSets).toEqual(globalSets.value);
      }
      const collection = await loadCollectionCatalog(
        freeplay.cards,
        freeplay.collectionSets,
      );
      expect(
        collection.cards.map(({ code }) => code).sort((a, b) => a - b),
      ).toEqual(expected.codes);
      expect(expected.ghostCodes).toContain(46986414);
      for (const code of expected.ghostCodes)
        expect(collection.rarityByCode.get(code)).toBe("ghost-rare");
      const runtime = await freeplay.battle.load(new AbortController().signal);
      expect(
        runtime.cards.map(({ code }) => code).sort((a, b) => a - b),
      ).toEqual(expected.codes);
      expect(runtime.cards).toHaveLength(expected.codes.length);
      expect(
        Object.fromEntries(
          runtime.scripts.map(({ name, source }) => [name, digest(source)]),
        ),
      ).toEqual(expected.scriptHashes);
      expect(runtime.scripts).toHaveLength(
        Object.keys(expected.scriptHashes).length,
      );
      expect(runtime.wasmBinary.byteLength).toBe(expected.wasm.byteLength);
      expect(digest(new Uint8Array(runtime.wasmBinary))).toBe(
        digest(expected.wasm),
      );
      expect(runtime.coreVersion).toEqual(expected.core.coreVersion);
      expect(runtime.strings).toEqual(expected.core.strings);
      const vendor = await fixture.content.query(
        {
          kind: "asset",
          packageId: "duel-core",
          path: expected.core.vendorManifestPath,
        },
        new AbortController().signal,
      );
      expect(vendor.kind).toBe("ok");
      if (vendor.kind === "ok") {
        expect(vendor.value!.bytes.byteLength).toBe(expected.vendor.byteLength);
        expect(digest(vendor.value!.bytes)).toBe(digest(expected.vendor));
      }
      const cardRefs = fixture.domain.media
        .filter(({ path }) => path.startsWith("cards/"))
        .map(({ path, source }) => [path, source])
        .sort();
      expect(cardRefs).toEqual(
        expected.codes
          .flatMap((code) =>
            ["full", "cropped"].map((variant) => [
              `cards/${variant}/${code}.jpg`,
              `images/${variant}/${code}.jpg`,
            ]),
          )
          .sort(),
      );
    } finally {
      freeplay.close();
    }
    const story = await loadStoryInputs(
      storage,
      services,
      "chapter-01",
      new AbortController().signal,
    );
    try {
      const chapter = story.release.chapters[0]!;
      expect(
        story.cards
          .all()
          .map(({ code }) => code)
          .sort((a, b) => a - b),
      ).toEqual(expected.codes);
      expect(chapter.cardCodes).toEqual(expected.chapterCodes);
      expect(chapter.cardCodes).toHaveLength(expected.chapterCodes.length);
      expect(chapter.document).toEqual(expected.document);
      expect(chapter.decks).toEqual(expected.decks);
      expect(chapter.opponents).toEqual(expected.opponents);
      expect(
        chapter.sets.map(({ id, name, releaseYear }) => ({
          id,
          name,
          releaseYear,
        })),
      ).toEqual(
        expected.sets.map(({ id, name, releaseYear }) => ({
          id,
          name,
          releaseYear,
        })),
      );
      expect(
        expected.config.setIds.map((id) =>
          fixture.domain.sets.find((set) => set.id === id),
        ),
      ).toEqual(expected.sets);
      expect(chapter.sets.map(({ id }) => id)).toEqual(expected.config.setIds);
      expect(expected.mapImage).toEqual({
        packId: "chapter-01",
        path: `story/media/chapter-01/${expected.config.mapAssetPath!.slice("media/".length)}`,
      });
      const query = vi.spyOn(fixture.content, "query");
      await story.media.acquireMap("chapter-01", new AbortController().signal);
      expect(query).toHaveBeenCalledWith(
        {
          kind: "asset",
          packageId: "chapter-01",
          path: expected.config.mapAssetPath,
        },
        expect.any(AbortSignal),
      );
      query.mockClear();
      const images = await story.gameplay.images();
      images.dispose();
      expect(query.mock.calls.map(([request]) => request)).toEqual(
        expected.config.setIds.map((setId) => ({ kind: "set-image", setId })),
      );
      query.mockRestore();
      const runtime = await story.gameplay.battle.load(
        new AbortController().signal,
      );
      expect(runtime.allowedCardCodes.slice().sort((a, b) => a - b)).toEqual(
        expected.chapterCodes,
      );
      expect(digest(new Uint8Array(runtime.wasmBinary))).toBe(
        digest(expected.wasm),
      );
      expect(
        Object.fromEntries(
          runtime.scripts.map(({ name, source }) => [name, digest(source)]),
        ),
      ).toEqual(expected.scriptHashes);
      expect(story.users).toBe(services);
    } finally {
      story.close();
    }
  } finally {
    await users.close();
    unlinkSync(db.file);
    rmdirSync(files.root);
    fixture.close();
    expect(existsSync(fixture.root)).toBe(false);
  }
}, 120_000);
