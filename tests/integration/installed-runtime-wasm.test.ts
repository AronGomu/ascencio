import { beforeAll, describe, expect, it, vi } from "vitest";
import { exactInstalledRuntime } from "../fixtures/exact-installed-runtime.ts";
import {
  createBrowserDuelWorkerRuntime,
  assertInstalledRuntimeReceipt,
} from "../../src/battle/worker/create-browser-runtime.ts";
import { OcgCoreAdapter } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import { loadInstalledGameplay } from "../../src/content/index.ts";
import { loadBrowserRuntimeAssets } from "../../src/battle/worker/assets/browser-runtime-assets.ts";
import { loadInstalledRuntimeDependencies } from "../../src/battle/worker/assets/installed-runtime-dependencies.ts";
import { DuelSession } from "../../src/battle/worker/engine/DuelSession.ts";
import { HeadlessDuelController } from "../../src/battle/worker/HeadlessDuelController.ts";
import {
  cardCode,
  duelId,
  snapshotId,
} from "../../src/battle/duel/contracts/ids.ts";

let fixture: Awaited<ReturnType<typeof exactInstalledRuntime>>;
beforeAll(async () => {
  fixture = await exactInstalledRuntime();
}, 120_000);

describe("exact installed browser runtime on real WASM", () => {
  it("closes Worker reader after typed forged-receipt failure before engine creation", async () => {
    const closes = fixture.closes();
    const createDuel = vi.spyOn(OcgCoreAdapter.prototype, "createDuel");
    const runtime = createBrowserDuelWorkerRuntime({
      openReader: async () => ({ kind: "ok", value: fixture.reader }),
      readReceipt: async () => ({
        kind: "ok",
        value: {
          ...fixture.receipt,
          assetManifestFile: { ...fixture.receipt.assetManifestFile, bytes: 1 },
        },
      }),
    });
    try {
      const events = await runtime.handle({
        type: "initialize",
        content: fixture.content,
      });
      expect(events).toContainEqual(
        expect.objectContaining({
          type: "error",
          error: expect.objectContaining({
            code: "snapshot_validation_failed",
          }),
        }),
      );
      expect(fixture.closes()).toBe(closes + 1);
      expect(createDuel).not.toHaveBeenCalled();
    } finally {
      runtime.dispose();
      createDuel.mockRestore();
    }
  });
  it("verifies exact receipt raw files; rejects forged metadata", async () => {
    await expect(
      assertInstalledRuntimeReceipt(
        fixture.receipt,
        fixture.content,
        fixture.reader,
      ),
    ).resolves.toBeUndefined();
    for (const key of [
      "assetManifestFile",
      "engineManifestFile",
      "runtimeManifestFile",
    ] as const) {
      for (const field of ["bytes", "sha256"] as const) {
        const forged = {
          ...fixture.receipt,
          [key]: {
            ...fixture.receipt[key],
            [field]: field === "bytes" ? 1 : "0".repeat(64),
          },
        };
        await expect(
          assertInstalledRuntimeReceipt(
            forged,
            fixture.content,
            fixture.reader,
          ),
        ).rejects.toThrow("CONTENT_INTEGRITY_FAILED");
      }
    }
  });

  it("preloads support without permitting either seat to sleeve support-only cards", async () => {
    const gameplayResult = await loadInstalledGameplay(
      fixture.reader,
      fixture.content,
    );
    if (gameplayResult.kind !== "ok") throw new Error(gameplayResult.code);
    const gameplay = gameplayResult.value;
    expect(gameplay.cards.some(({ code }) => code === 73915052)).toBe(false);
    const runtime = createBrowserDuelWorkerRuntime({
      openReader: async () => ({ kind: "ok", value: fixture.reader }),
      readReceipt: async () => ({ kind: "ok", value: fixture.receipt }),
    });
    const createDuel = vi.spyOn(OcgCoreAdapter.prototype, "createDuel");
    const closes = fixture.closes();
    try {
      const initialized = await runtime.handle({
        type: "initialize",
        content: fixture.content,
      });
      expect(initialized.find(({ type }) => type === "error")).toBeUndefined();
      expect(fixture.closes()).toBe(closes + 1);
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

  it("legally activates Scapegoat and resolves four Sheep Tokens using exact runtime support", async () => {
    const assets = await loadBrowserRuntimeAssets(
      "https://installed.invalid/",
      {
        expectedManifestSha256: fixture.content.snapshot.runtimeManifestSha256,
        cacheStorage: null,
        fetch: async (input) =>
          new Response(
            fixture.files
              .get(new URL(String(input)).pathname.slice(1))!
              .slice(),
          ),
      },
    );
    const dependencies = await loadInstalledRuntimeDependencies(assets);
    expect(dependencies.counts).toEqual({
      cards: 14794,
      texts: 14794,
      scripts: 13549,
      globals: 25,
      images: 14794,
    });
    for (const code of [73915052, 73915053, 73915054, 73915055])
      expect(dependencies.cards.has(code)).toBe(true);
    const adapter = await OcgCoreAdapter.initialize({
      wasmBinary: assets.wasmBinary,
    });
    const result = await loadInstalledGameplay(fixture.reader, fixture.content);
    if (result.kind !== "ok") throw new Error(result.code);
    const main = [
      73915051,
      ...result.value.decks[0]!.main.filter((code) => code !== 73915051),
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
      snapshotId: snapshotId(fixture.content.snapshot.runtimeSnapshotId),
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
