import { UserDataRuntime } from "../../src/storage/runtime/user-data-runtime.ts";
import { createUserDataFixture } from "../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../unit/storage/runtime-fixtures.ts";

export function sqliteUserRuntime() {
  const database = createUserDataFixture();
  return new UserDataRuntime({
    database: databaseAdapter(database.database),
    files: createNodeFileStore(),
    randomId: () => crypto.randomUUID(),
  });
}
