import { describe, expect, it, vi } from "vitest";
import { parseDuelDeckSelection } from "../../src/battle/duel/contracts/duel-deck-selection.ts";
import type { DuelRuntimeResources } from "../../src/battle/worker/DuelWorkerRuntime.ts";
import { resolveDuelDecks } from "../../src/battle/worker/decks/resolve-duel-decks.ts";

const installedMain = Array.from(
  { length: 40 },
  (_, index) => (index % 14) + 1,
);
const installed = parseDuelDeckSelection({
  kind: "cards",
  main: installedMain,
  extra: [],
  side: [],
});
const outside = parseDuelDeckSelection({
  kind: "cards",
  main: [99, ...installedMain.slice(1)],
  extra: [],
  side: [],
});

function resources(): DuelRuntimeResources {
  return {
    dependencies: {
      cards: new Map([...installedMain, 99].map((code) => [code, {}])),
      images: new Map([...installedMain, 99].map((code) => [code, {}])),
    },
    allowedCardCodes: new Set(installedMain),
    allowPresetDecks: false,
    createPreset: vi.fn(),
  } as unknown as DuelRuntimeResources;
}

describe("installed runtime seat enforcement", () => {
  it.each([
    ["player", outside, installed],
    ["opponent", installed, outside],
  ])(
    "rejects an out-of-pool %s seat before preset or engine work",
    (_, player, opponent) => {
      const runtime = resources();

      expect(() => resolveDuelDecks(player, opponent, runtime)).toThrow(
        "outside installed chapter content: 99",
      );
      expect(runtime.createPreset).not.toHaveBeenCalled();
    },
  );

  it("rejects bundled preset backdoors", () => {
    const runtime = resources();
    const preset = parseDuelDeckSelection({
      kind: "preset",
      deckId: "chapter-one-starter",
    });

    expect(() => resolveDuelDecks(preset, installed, runtime)).toThrow(
      "Installed gameplay does not accept bundled preset decks",
    );
    expect(runtime.createPreset).not.toHaveBeenCalled();
  });
});
