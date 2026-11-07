import { rmdirSync, unlinkSync } from "node:fs";
import { createSqliteUserServices } from "../../src/shell/adapters/sqlite-user-services.ts";
import { UserDataRuntime } from "./legacy-user-data-runtime.ts";
import { createUserDataFixture } from "../unit/storage/sqlite-fixtures.ts";
import {
  createNodeFileStore,
  databaseAdapter,
} from "../unit/storage/runtime-fixtures.ts";

export function sqliteStoryReader(fault?: (point: string) => void) {
  const user = createUserDataFixture();
  const files = createNodeFileStore();
  const runtime = new UserDataRuntime({
    database: databaseAdapter(user.database),
    files,
    fault,
    randomId: () => crypto.randomUUID(),
  });
  return {
    runtime,
    database: user.database,
    preferences: createSqliteUserServices(runtime).preferences,
    async close() {
      await runtime.close();
      unlinkSync(user.file);
      rmdirSync(files.root);
    },
  };
}
