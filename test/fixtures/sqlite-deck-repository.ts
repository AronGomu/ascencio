import { existsSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { DeckRepository } from "../../src/decks/repository/index.ts";
import { createSqliteDeckRepository } from "../../src/decks/repository/sqlite.ts";
import { UserDataRuntime } from "./legacy-user-data-runtime.ts";
import { createUserDataFixture } from "../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../unit/storage/runtime-fixtures.ts";

export type TestDeckRepository = DeckRepository & {
  close(): Promise<void>;
};

const databases = new Map<string, string>();
const handles: { close(): Promise<void>; readonly root: string }[] = [];

/** Named isolated SQLite files let fixtures seed, share, close and reopen the
 * same library. Only tests own these connections; production uses Shell's client.
 */
export async function openTestDeckRepository(
  name = "default",
): Promise<TestDeckRepository> {
  let file = databases.get(name);
  if (file === undefined) {
    const fixture = createUserDataFixture();
    file = fixture.file;
    fixture.database.close();
    databases.set(name, file);
  }
  const files = createNodeFileStore();
  const runtime = new UserDataRuntime({
    database: databaseAdapter(new DatabaseSync(file)),
    files,
    randomId: () => crypto.randomUUID(),
  });
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= runtime.close());
  handles.push({ close, root: files.root });
  return Object.assign(createSqliteDeckRepository(runtime), { close });
}

export function testDeckDatabaseBytes(name: string): Uint8Array {
  const file = databases.get(name);
  if (file === undefined)
    throw new Error(`Unknown test deck database: ${name}`);
  return new Uint8Array(readFileSync(file));
}

/** Raw access only for corruption/dangling-pointer tests, never storage mocks. */
export function withTestDeckDatabase<T>(
  name: string,
  read: (database: DatabaseSync) => T,
): T {
  const file = databases.get(name);
  if (file === undefined)
    throw new Error(`Unknown test deck database: ${name}`);
  const database = new DatabaseSync(file);
  try {
    return read(database);
  } finally {
    database.close();
  }
}

/** Call after component cleanup/controller teardown, so pending writes settle
 * before closing connections and removing only this fixture's own files.
 */
export async function disposeTestDeckRepositories(): Promise<void> {
  for (const handle of handles.splice(0)) {
    await handle.close();
    rmdirSync(handle.root);
  }
  for (const file of databases.values()) {
    if (existsSync(file)) unlinkSync(file);
  }
  databases.clear();
}
