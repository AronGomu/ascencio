import { beforeAll, describe, expect, it, vi } from "vitest";
import { exactInstalledRuntime } from "../fixtures/exact-installed-runtime.ts";
import { createBrowserDuelWorkerRuntime } from "../../src/battle/worker/create-browser-runtime.ts";
import { OcgCoreAdapter } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import {
  loadInstalledGameplay,
  type InstalledGameplay,
} from "../../src/content/index.ts";
import { createLegacyBattleRuntimeSource } from "../../src/shell/adapters/legacy-battle-runtime.ts";
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import { HeadlessDuelController } from "../../src/battle/worker/HeadlessDuelController.ts";
import {
  cardCode,
  duelId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { BattleRuntimeInput } from "../../src/battle/ports/index.ts";

let fixture: Awaited<ReturnType<typeof exactInstalledRuntime>>;
let input: BattleRuntimeInput;
let gameplay: InstalledGameplay;

beforeAll(async () => {
  fixture = await exactInstalledRuntime();
  const result = await loadInstalledGameplay(fixture.reader, fixture.content);
  if (result.kind !== "ok") throw new Error(result.code);
  gameplay = result.value;
  input = await createLegacyBattleRuntimeSource(fixture.reader, gameplay).load(
    new AbortController().signal,
  );
}, 120_000);

describe("exact installed browser runtime on real WASM", () => {
  it("rejects one-byte-mutated frozen WASM before engine initialization", async () => {
    const runtime = createBrowserDuelWorkerRuntime();
    const initialize = vi.spyOn(OcgCoreAdapter, "initialize");
    const wasmBinary = input.wasmBinary.slice(0);
    new Uint8Array(wasmBinary)[wasmBinary.byteLength - 1]! ^= 1;
    try {
      const events = await runtime.handle({
        type: "initialize",
        runtime: { ...input, wasmBinary },
      });
      expect(initialize).not.toHaveBeenCalled();
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "error",
          error: expect.objectContaining({
            code: "snapshot_validation_failed",
          }),
        }),
      );
      expect(events.some(({ type }) => type === "ready")).toBe(false);
    } finally {
      runtime.dispose();
      initialize.mockRestore();
    }
  });

  it("preserves engine_initialization_failed for actual engine version mismatch", async () => {
    const runtime = createBrowserDuelWorkerRuntime();
    const initialize = vi.spyOn(OcgCoreAdapter, "initialize");
    const version = vi
      .spyOn(OcgCoreAdapter.prototype, "getVersion")
      .mockReturnValue([12, 0]);
    try {
      const events = await runtime.handle({
        type: "initialize",
        runtime: input,
      });
      expect(initialize).toHaveBeenCalledOnce();
      expect(version).toHaveBeenCalled();
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "error",
          error: expect.objectContaining({
            code: "engine_initialization_failed",
            recoverable: false,
          }),
        }),
      );
      expect(events.some(({ type }) => type === "ready")).toBe(false);
    } finally {
      runtime.dispose();
      version.mockRestore();
      initialize.mockRestore();
    }
  });

  it("loads a fresh WASM buffer for the exact same snapshot", async () => {
    const source = createLegacyBattleRuntimeSource(fixture.reader, gameplay);
    const first = await source.load(new AbortController().signal);
    const second = await source.load(new AbortController().signal);

    expect(first.snapshotId).toBe(fixture.content.snapshot.runtimeSnapshotId);
    expect(second.snapshotId).toBe(first.snapshotId);
    expect(first.wasmBinary).not.toBe(second.wasmBinary);
    expect(first.wasmBinary.byteLength).toBeGreaterThan(0);
    expect(second.wasmBinary.byteLength).toBe(first.wasmBinary.byteLength);
  }, 120_000);

  it("preloads support without permitting either seat to sleeve support-only cards", async () => {
    expect(gameplay.cards.some(({ code }) => code === 73915052)).toBe(false);
    const runtime = createBrowserDuelWorkerRuntime();
    const createDuel = vi.spyOn(OcgCoreAdapter.prototype, "createDuel");
    try {
      const initialized = await runtime.handle({
        type: "initialize",
        runtime: input,
      });
      expect(initialized.find(({ type }) => type === "error")).toBeUndefined();
      expect(initialized).toContainEqual(
        expect.objectContaining({ type: "ready", coreVersion: [11, 0] }),
      );
      const deck = gameplay.decks.find(
        ({ id }) => id === gameplay.defaults.starterDeckId,
      )!;
      const good = {
        kind: "cards" as const,
        main: deck.main,
        extra: deck.extra,
        side: deck.side,
      };
      const bad = { ...good, main: [73915052, ...good.main.slice(1)] };
      for (const seat of ["player", "opponent"] as const) {
        const events = await runtime.handle({
          type: "startDuel",
          duelId: duelId(`support-${seat}`),
          player: seat === "player" ? bad : good,
          opponent: seat === "opponent" ? bad : good,
        });
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "error",
            error: expect.objectContaining({
              code: "unsupported_card",
              message: expect.stringContaining(
                "outside installed chapter content",
              ),
            }),
          }),
        );
        expect(createDuel).not.toHaveBeenCalled();
      }
      const events = await runtime.handle({
        type: "startDuel",
        duelId: duelId("installed-valid"),
        player: good,
        opponent: good,
      });
      expect(events.find(({ type }) => type === "error")).toBeUndefined();
      expect(createDuel).toHaveBeenCalledOnce();
      const options = createDuel.mock.calls[0]![0];
      expect(options.cardReader(73915052)).toMatchObject({ code: 73915052 });
      expect(options.scriptReader("c73915051.lua")).toContain(
        "Duel.CreateToken",
      );
      expect(await runtime.handle({ type: "surrender" })).toContainEqual({
        type: "result",
        result: { type: "surrendered", winner: 1, loser: 0 },
      });
    } finally {
      runtime.dispose();
      createDuel.mockRestore();
    }
  }, 120_000);

  it("legally activates Scapegoat and resolves four Sheep Tokens", async () => {
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: input.wasmBinary.slice(0),
    });
    const cards = new Map(
      input.cards.map((card) => [
        Number(card.code),
        {
          ...card,
          code: Number(card.code),
          setcodes: [...card.setcodes],
          race: BigInt(card.race),
          link_marker: card.linkMarker,
        },
      ]),
    );
    const dependencies = {
      cards,
      texts: new Map(input.texts.map((text) => [Number(text.code), text])),
      scripts: new Map(input.scripts.map(({ name, source }) => [name, source])),
      strings: input.strings,
      images: new Map(),
      counts: {
        cards: input.cards.length,
        texts: input.texts.length,
        scripts: input.scripts.length,
        globals: input.requiredScripts.globals.length,
        images: 0,
      },
    };
    expect(dependencies.counts).toMatchObject({
      cards: 14794,
      texts: 14794,
      scripts: 13549,
      globals: 25,
    });
    for (const code of [73915052, 73915053, 73915054, 73915055])
      expect(dependencies.cards.has(code)).toBe(true);
    const main = [
      73915051,
      ...gameplay.decks[0]!.main.filter((code) => code !== 73915051),
    ]
      .slice(0, 40)
      .map(cardCode);
    const deck = { main, extra: [], side: [] };
    const diagnostics: unknown[] = [];
    const session = DuelSession.create({
      adapter,
      dependencies,
      playerDeck: deck,
      opponentDeck: deck,
      configuration: {
        mode: "programmed",
        rules: "mr3",
        seed: [1n, 2n, 3n, 4n],
        playerDeckOrder: main,
        opponentDeckOrder: main,
      },
      onEngineDiagnostic: (value) => diagnostics.push(value),
    });
    const controller = new HeadlessDuelController({
      session,
      dependencies,
      snapshotId: snapshotId(input.snapshotId),
      presetId: "installed-scapegoat",
      deckCounts: [main.length, main.length],
      extraDeckCounts: [0, 0],
      extraMonsterZones: false,
    });
    let activated = false;
    try {
      let advance = controller.advance();
      for (let step = 0; step < 30; step++) {
        const tokens = advance.state.players[0].monsters.filter(
          (card) =>
            card.code !== undefined &&
            card.code >= 73915052 &&
            card.code <= 73915055,
        );
        if (tokens.length === 4) {
          expect(activated).toBe(true);
          expect(diagnostics).toEqual([]);
          return;
        }
        const prompt = advance.prompt;
        if (!prompt) throw new Error("No Scapegoat prompt");
        const scapegoat = prompt.choices.find(
          (choice) =>
            choice.action === "activate" && choice.card?.code === 73915051,
        );
        const choice =
          scapegoat ??
          prompt.choices.find(
            (choice) => choice.action === "pass" || choice.action === "no",
          ) ??
          prompt.choices[0]!;
        if (scapegoat) activated = true;
        advance = controller.respond(prompt.id, [choice.id]);
      }
      throw new Error("Scapegoat did not resolve four Sheep Tokens");
    } finally {
      session.dispose();
    }
  }, 120_000);
});
