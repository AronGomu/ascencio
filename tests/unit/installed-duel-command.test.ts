import { describe, expect, it } from "vitest";
import {
  parseDuelCommand,
  type DuelCommand,
} from "../../src/battle/duel/contracts/duel-command.ts";
import {
  TEST_CONTENT_SET_REF,
  TEST_RUNTIME_INPUT,
} from "../fixtures/installed-gameplay.ts";

describe("semantic duel initialize command", () => {
  it("carries one clone-safe runtime DTO", () => {
    const runtime = {
      ...TEST_RUNTIME_INPUT,
      wasmBinary: TEST_RUNTIME_INPUT.wasmBinary.slice(0),
    };
    const command = parseDuelCommand({ type: "initialize", runtime });

    expect(command).toEqual({ type: "initialize", runtime });
    expect(command satisfies DuelCommand).toBe(command);
  });

  it("rejects initialization without runtime or with an extra key", () => {
    expect(() => parseDuelCommand({ type: "initialize" })).toThrow(
      "Duel initialize command requires runtime input",
    );
    expect(() =>
      parseDuelCommand({
        type: "initialize",
        runtime: TEST_RUNTIME_INPUT,
        fallback: true,
      }),
    ).toThrow();
  });

  it("rejects legacy installed refs", () => {
    expect(() =>
      parseDuelCommand({
        type: "initialize",
        runtime: TEST_CONTENT_SET_REF,
      }),
    ).toThrow("BATTLE_RUNTIME_INVALID");
  });
});
