import { describe, expect, it } from "vitest";
import { parseBattleRuntimeInput } from "../../src/battle/ports/index.ts";
import { TEST_CONTENT_SET_REF } from "../fixtures/installed-gameplay.ts";

describe("Worker semantic runtime boundary", () => {
  it("rejects legacy activation refs and receipts before engine initialization", () => {
    expect(() => parseBattleRuntimeInput(TEST_CONTENT_SET_REF)).toThrow(
      "BATTLE_RUNTIME_INVALID",
    );
    expect(() =>
      parseBattleRuntimeInput({
        schemaVersion: 1,
        kind: "installed-runtime-v1",
        snapshot: TEST_CONTENT_SET_REF.snapshot,
        runtimePack: TEST_CONTENT_SET_REF.runtime,
      }),
    ).toThrow("BATTLE_RUNTIME_INVALID");
  });
});
