import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
describe("domain fixture retirement contract", () => {
  it("does not prepare hosted releases or migrate legacy saves", () => {
    for (const path of [
      "e2e/e2e-global/selected-content-fixture.ts",
      "tests/fixtures/selected-content-browser.ts",
    ]) {
      expect(read(path)).not.toMatch(
        /selected-content-release|selected-media-profile|createApplicationService|prepareRelease|openProgressiveContentStore|createStoryMigrationPort|generationSaves/,
      );
    }
  });
  it("keeps test startup and user JSON fault hooks out of production configuration", () => {
    expect(read("vite.config.ts")).not.toMatch(
      /selected-content|domain-fixture/,
    );
    expect(read("src/storage/native/storage-client.ts")).not.toMatch(
      /domain-fixture|fixtureFault/,
    );
    expect(read("src/storage/contracts/validate-content-query.ts")).not.toMatch(
      /fixture|corrupt/,
    );
  });
});

it("keeps one real user owner and same-store production repository factory", () => {
  const fixture = read("tests/fixtures/selected-content-browser.ts");
  expect(fixture.match(/await openLocalStorage\(\)/g)).toHaveLength(1);
  expect(fixture).toContain("createUserPersistenceOwner(client, admission)");
  expect(fixture).toContain("users: owner.services");
  expect(fixture).toContain("await client.packages.acquireSession()");
  expect(fixture).toContain("await service.dispose()");
  expect(fixture).toContain("await owner.close()");
  expect(fixture).not.toMatch(
    /indexedDB|localStorage\.|createStoryMigrationPort/,
  );
});

it("restricts raw user JSON mutations to fixed test fault operations", () => {
  const fixture = read("tests/fixtures/domain-user-json-faults.ts");
  expect(fixture).toContain('operation.kind === "corrupt-story"');
  expect(fixture).toContain('operation.kind === "clear-story"');
  expect(fixture).toContain('operation.kind === "fail-deck-write"');
  expect(fixture).toContain("slots.has(operation.slot)");
  expect(fixture).not.toMatch(/operation\.sql|importPackages|exportUserData/);
});
