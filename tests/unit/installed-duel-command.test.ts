import { describe, expect, it } from "vitest";
import {
  parseDuelCommand,
  type DuelCommand,
} from "../../src/battle/duel/contracts/duel-command.ts";
import { TEST_CONTENT_SET_REF } from "../fixtures/installed-gameplay.ts";

describe("installed duel initialize command", () => {
  it("carries one exact clone-safe ContentSetRef", () => {
    const command = parseDuelCommand({
      type: "initialize",
      content: structuredClone(TEST_CONTENT_SET_REF),
    });

    expect(command).toEqual({
      type: "initialize",
      content: TEST_CONTENT_SET_REF,
    });
    expect(command satisfies DuelCommand).toBe(command);
  });

  it("rejects initialization without content or with an extra key", () => {
    expect(() => parseDuelCommand({ type: "initialize" })).toThrow(
      "Duel initialize command requires installed content",
    );
    expect(() =>
      parseDuelCommand({
        type: "initialize",
        content: TEST_CONTENT_SET_REF,
        fallback: true,
      }),
    ).toThrow();
  });

  it("rejects malformed and mismatched exact refs", () => {
    expect(() =>
      parseDuelCommand({
        type: "initialize",
        content: {
          ...TEST_CONTENT_SET_REF,
          catalogSha256: "0".repeat(64),
        },
      }),
    ).toThrow("Duel initialize command content ref is invalid");
  });
});
