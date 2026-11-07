import type { DuelCommand } from "../../src/battle/duel/contracts/duel-command.ts";
import { describe, expect, expectTypeOf, it } from "vitest";
import { cardCode } from "../../src/cards/index.ts";
import {
  parseBattleRuntimeInput,
  validateBattleRuntime,
  type BattleRuntimeInput,
  type InitializeRuntimeCommand,
} from "../../src/battle/ports/index.ts";

function runtimeInput(): BattleRuntimeInput {
  return {
    schemaVersion: 1,
    snapshotId: "a".repeat(64),
    coreVersion: [11, 0],
    wasmBinary: new ArrayBuffer(8),
    cards: [
      {
        code: cardCode(1),
        alias: 0,
        setcodes: [],
        type: 0x11,
        level: 4,
        attribute: 1,
        race: "1",
        attack: 1_000,
        defense: 1_000,
        lscale: 0,
        rscale: 0,
        linkMarker: 0,
      },
    ],
    texts: [
      {
        code: cardCode(1),
        name: "Normal monster",
        description: "No script required.",
        strings: [],
      },
    ],
    scripts: [{ name: "utility.lua", source: "return {}" }],
    requiredScripts: { cards: [], globals: ["utility.lua"] },
    strings: {
      system: { "1": "Normal Summon" },
      victory: { "0x0": "Surrendered" },
      counter: {},
      setname: {},
    },
    allowedCardCodes: [cardCode(1)],
    ruleset: {
      id: "prototype-single-ruleset",
      revision: "prototype-2026-01",
      quantityByCode: [],
    },
    revisions: { babelCdb: "babel", cardScripts: "scripts" },
  };
}

function replacing(
  input: BattleRuntimeInput,
  changes: Partial<BattleRuntimeInput>,
): BattleRuntimeInput {
  return { ...input, ...changes };
}

describe("BattleRuntimeInput", () => {
  it("binds the public InitializeRuntimeCommand to the internal initialize union", () => {
    expectTypeOf<InitializeRuntimeCommand>().toEqualTypeOf<{
      readonly type: "initialize";
      readonly runtime: BattleRuntimeInput;
    }>();
    expectTypeOf<
      Extract<DuelCommand, { type: "initialize" }>
    >().toEqualTypeOf<InitializeRuntimeCommand>();
  });
  it("accepts clone-safe semantic runtime input while rejecting legacy Content initialization", () => {
    const input = runtimeInput();
    const parsed = parseBattleRuntimeInput(input);

    expect(parsed).toEqual(input);
    expect(parsed).not.toBe(input);
    expect(parsed.wasmBinary).toBe(input.wasmBinary);
    expect(parsed.cards[0]?.race).toBe("1");
    expect(() =>
      parseBattleRuntimeInput({
        catalogSha256: "a".repeat(64),
        snapshot: {},
        runtime: {},
        chapters: [],
      }),
    ).toThrow(new Error("BATTLE_RUNTIME_INVALID"));
  });

  it.each([
    [
      "duplicate cards",
      (input: BattleRuntimeInput) =>
        replacing(input, { cards: [...input.cards, input.cards[0]!] }),
    ],
    [
      "duplicate texts",
      (input: BattleRuntimeInput) =>
        replacing(input, { texts: [...input.texts, input.texts[0]!] }),
    ],
    [
      "duplicate scripts",
      (input: BattleRuntimeInput) =>
        replacing(input, { scripts: [...input.scripts, input.scripts[0]!] }),
    ],
    [
      "duplicate allowed codes",
      (input: BattleRuntimeInput) =>
        replacing(input, { allowedCardCodes: [cardCode(1), cardCode(1)] }),
    ],
    [
      "duplicate required globals",
      (input: BattleRuntimeInput) =>
        replacing(input, {
          requiredScripts: {
            cards: [],
            globals: ["utility.lua", "utility.lua"],
          },
        }),
    ],
    [
      "malformed script name",
      (input: BattleRuntimeInput) =>
        replacing(input, {
          scripts: [
            { name: "runtime/scripts/utility.lua", source: "return {}" },
          ],
        }),
    ],
    [
      "detached WASM",
      (input: BattleRuntimeInput) =>
        replacing(input, { wasmBinary: new ArrayBuffer(0) }),
    ],
    [
      "unsupported version",
      (input: BattleRuntimeInput) => replacing(input, { coreVersion: [12, 0] }),
    ],
  ])("rejects %s", (_, mutate) => {
    expect(() => parseBattleRuntimeInput(mutate(runtimeInput()))).toThrow(
      new Error("BATTLE_RUNTIME_INVALID"),
    );
  });

  it("rejects bounded oversized input before engine initialization", () => {
    const input = runtimeInput();
    expect(() =>
      parseBattleRuntimeInput(
        replacing(input, {
          scripts: [{ name: "utility.lua", source: "x".repeat(1_048_577) }],
        }),
      ),
    ).toThrow(new Error("BATTLE_RUNTIME_INVALID"));
  });

  it("requires indexed card/global inventory but permits genuinely unindexed normal cards", () => {
    const input = runtimeInput();
    expect(() => validateBattleRuntime(input)).not.toThrow();

    const indexed = replacing(input, {
      requiredScripts: { cards: ["c1.lua"], globals: ["utility.lua"] },
    });
    expect(() => validateBattleRuntime(indexed)).toThrow(
      new Error("BATTLE_RUNTIME_INVALID"),
    );
    expect(() =>
      validateBattleRuntime(
        replacing(input, {
          requiredScripts: { cards: [], globals: ["constant.lua"] },
        }),
      ),
    ).toThrow(new Error("BATTLE_RUNTIME_INVALID"));
  });

  it("keeps whole runtime support distinct from allowed chapter pool", () => {
    const input = runtimeInput();
    expect(() =>
      validateBattleRuntime(
        replacing(input, { allowedCardCodes: [cardCode(2)] }),
      ),
    ).toThrow(new Error("BATTLE_RUNTIME_INVALID"));
  });
});
