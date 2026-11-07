import type { DatabaseSync } from "node:sqlite";
import { PROTOTYPE_RULESET } from "../../src/decks/validation/index.ts";
import type { FixtureGameplay } from "./installed-gameplay.ts";
import { cardCode } from "../../src/cards/index.ts";
import { fixtureCollectionInputs } from "./installed-gameplay.ts";
import {
  createSqliteStoryRepository,
  type StoryBinding,
} from "../../src/story/saves/index.ts";
import { storyBindingFixture, storyReleaseFixture } from "./story-release.ts";
import { installedDuelGameplayFixture } from "./installed-duel-gameplay.ts";
import type { StoryState } from "../../src/story/model/story-state.ts";
import type { StorySlotKey } from "../../src/story/saves/index.ts";
import { unlinkSync, rmdirSync } from "node:fs";
import { UserDataRuntime } from "./legacy-user-data-runtime.ts";
import { createUserDataFixture } from "../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../unit/storage/runtime-fixtures.ts";

let databases = new WeakMap<object, DatabaseSync>();
let runtimes = new WeakMap<object, UserDataRuntime>();
const owned: { runtime: UserDataRuntime; file: string; root: string }[] = [];
export async function resetStorySessionFixture(): Promise<void> {
  runtimes = new WeakMap();
  databases = new WeakMap();
  for (const { runtime, file, root } of owned.splice(0)) {
    await runtime.close();
    unlinkSync(file);
    rmdirSync(root);
  }
}
export function storyInputs(
  gameplay: FixtureGameplay = installedDuelGameplayFixture(),
) {
  const input = fixtureCollectionInputs(gameplay);
  const release = {
    revision: 1,
    chapters: [
      {
        ...storyReleaseFixture().chapters[0]!,
        cardCodes: [
          ...new Set([
            ...gameplay.cards.map((c) => c.code),
            ...gameplay.sets.flatMap((s) => s.cards.map((c) => c.code)),
            ...gameplay.decks.flatMap((d) => [
              ...d.main,
              ...d.extra,
              ...d.side,
            ]),
          ]),
        ].map(cardCode),
        sets: input.sets,
        decks: gameplay.decks,
        opponents: gameplay.opponents,
        defaults: gameplay.defaults,
      },
    ],
  };
  return { release, cards: input.cards };
}
/** Key names isolate test-owned SQLite repositories; never open legacy IDB. */
export function storyUserRuntime(
  key: object = globalThis.indexedDB,
): UserDataRuntime {
  let runtime = runtimes.get(key);
  if (runtime === undefined) {
    const database = createUserDataFixture();
    const files = createNodeFileStore();
    runtime = new UserDataRuntime({
      database: databaseAdapter(database.database),
      files,
      randomId: () => crypto.randomUUID(),
    });
    runtimes.set(key, runtime);
    databases.set(key, database.database);
    owned.push({ runtime, file: database.file, root: files.root });
  }
  return runtime;
}
export function createStorySaveRepository(key: object = globalThis.indexedDB) {
  const target = createSqliteStoryRepository(storyUserRuntime(key));
  return {
    ...target,
    write: (
      slot: StorySlotKey,
      state: StoryState,
      expected: number | null,
      story: StoryBinding = storyBindingFixture(),
    ) => target.write(slot, state, expected, story),
  };
}
export function storyAppProps(
  gameplay: FixtureGameplay = installedDuelGameplayFixture(),
) {
  return {
    ...storyInputs(gameplay),
    ruleset: PROTOTYPE_RULESET,
    saves: createStorySaveRepository(globalThis.indexedDB),
  };
}

export function storyShellProps() {
  const { release, cards, saves } = storyAppProps();
  return { storyRelease: release, storyCards: cards, saves };
}

export function withStorySessionDatabase(
  key: object,
  write: (database: DatabaseSync) => void,
): void {
  storyUserRuntime(key);
  write(databases.get(key)!);
}
