import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as shell from "../../../src/shell/settings/shell-settings.ts";
import * as battle from "../../../src/battle/app/stores/persisted-ui-state.ts";

describe("retired Shell/Battle preference persistence", () => {
  it("exposes only domain defaults, not legacy storage APIs", () => {
    expect(Object.keys(shell)).toEqual(["DEFAULT_SHELL_SETTINGS"]);
    expect(Object.keys(battle)).toEqual(["DEFAULT_PERSISTED_UI_STATE"]);
  });

  it("contains no legacy adapters, migration or compatibility fixture", () => {
    for (const file of [
      "src/shell/settings/shell-settings.ts",
      "src/battle/app/stores/persisted-ui-state.ts",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(
        /localStorage|defaultStorage|Pick<Storage|JSON\.(parse|stringify)|migrateFromV2/,
      );
    }
    expect(existsSync("tests/fixtures/legacy-user-preference-ports.ts")).toBe(
      false,
    );
    expect(readFileSync("src/battle/app/App.svelte", "utf8")).not.toMatch(
      /hasPersistedUiState|localStorage/,
    );
  });
});
