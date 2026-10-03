import { describe, expect, it } from "vitest";
import {
  composeMods,
  modEngineCode,
  ModCompositionFailure,
} from "../../../src/storage/mods/compose-mods.ts";
import type { CriticalSnapshot } from "../../../src/storage/contracts/critical-snapshot.ts";
import type {
  LoadedMod,
  ModManifest,
} from "../../../src/storage/mods/mod-contracts.ts";

const base: CriticalSnapshot = {
  schemaVersion: 1,
  compilerVersion: 1,
  manifest: {
    packageId: "freeplay",
    packageType: "freeplay",
    version: "1.1.0",
    schemaVersion: 1,
    dependencies: [
      { packageId: "card-library", requirement: "exact", version: "1.1.0" },
    ],
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  config: {
    title: "Freeplay",
    defaults: { starterDeckId: "starter", opponentId: "opponent" },
    rulesetId: "freeplay",
  },
  cards: [],
  scripts: [],
  sets: [],
  decks: [{ id: "starter", name: "Starter", main: [], extra: [], side: [] }],
  opponents: [
    {
      id: "opponent",
      name: "Opponent",
      line: "",
      deckId: "starter",
      policyId: "basic",
    },
  ],
  limits: [],
  stories: [],
  media: [],
};
function mod(
  id: string,
  deps: string[] = [],
  resolves: string[] = [],
  title = id,
): LoadedMod {
  const manifest: ModManifest = {
    schemaVersion: 1,
    id,
    version: "1.0.0",
    contentApi: 1,
    base: [{ packageId: "freeplay", version: "1.1.0" }],
    dependencies: deps.map((id) => ({ id, version: "1.0.0" })),
    entities: [
      {
        kind: "config",
        packageId: "freeplay",
        operation: "override",
        id: "config",
        path: "config.json",
        resolves,
      },
    ],
    media: [],
  };
  return {
    manifest,
    files: [{ path: "config.json", value: { ...base.config, title } }],
    sha256: "a".repeat(64),
  };
}
describe("explicit mod composition", () => {
  it("applies an override without mutating the base and records save identity", () => {
    const result = composeMods([base], [mod("custom")], ["base"]);
    expect((result.packs[0]!.config as { title: string }).title).toBe("custom");
    expect((base.config as { title: string }).title).toBe("Freeplay");
    expect(result.composition.requiredMods[0]!.id).toBe("custom");
    expect(result.composition.identity).toMatch(/^[a-f0-9]{64}$/);
  });
  it("fails ambiguous writes with both sources, and accepts a dependency-backed resolution", () => {
    try {
      composeMods([base], [mod("alpha"), mod("beta")], ["base"]);
      throw new Error("expected failure");
    } catch (e) {
      expect(e).toBeInstanceOf(ModCompositionFailure);
      const d = (e as ModCompositionFailure).diagnostics[0]!;
      expect(d.code).toBe("MOD_OVERRIDE_CONFLICT");
      expect(d.source!.modId).toBe("beta");
      expect(d.notes[0]!.source!.modId).toBe("alpha");
    }
    const result = composeMods(
      [base],
      [mod("beta", ["alpha"], ["alpha"]), mod("alpha")],
      ["base"],
    );
    expect((result.packs[0]!.config as { title: string }).title).toBe("beta");
  });
  it("rejects cycles, missing dependencies and base version mismatches", () => {
    expect(() =>
      composeMods([base], [mod("alpha", ["beta"]), mod("beta", ["alpha"])], []),
    ).toThrow("MOD_COMPOSITION_FAILED");
    expect(() => composeMods([base], [mod("alpha", ["missing"])], [])).toThrow(
      "MOD_COMPOSITION_FAILED",
    );
    const raw = mod("alpha");
    const incompatible = {
      ...raw,
      manifest: {
        ...raw.manifest,
        base: [{ packageId: "freeplay" as const, version: "2.0.0" }],
      },
    };
    expect(() => composeMods([base], [incompatible], [])).toThrow(
      "MOD_COMPOSITION_FAILED",
    );
  });
  it("allocates stable engine codes independent of mod discovery order", () => {
    expect(modEngineCode("alpha:dragon")).toBe(modEngineCode("alpha:dragon"));
    expect(modEngineCode("alpha:dragon")).toBeGreaterThanOrEqual(0x4000_0000);
    expect(modEngineCode("alpha:dragon")).not.toBe(
      modEngineCode("beta:dragon"),
    );
  });
  it("composes disjoint field overrides without dependencies, while overlapping fields require explicit resolution", () => {
    const first = mod("alpha"),
      second = mod("beta");
    const a = {
      ...first,
      files: [{ path: "config.json", value: { fields: { title: "Alpha" } } }],
    };
    const b = {
      ...second,
      files: [
        { path: "config.json", value: { fields: { rulesetId: "custom" } } },
      ],
    };
    const result = composeMods([base], [b, a], ["base"]);
    expect(result.packs[0]?.config).toMatchObject({
      title: "Alpha",
      rulesetId: "custom",
    });
    expect(() =>
      composeMods([base], [a, { ...b, files: a.files }], []),
    ).toThrow("MOD_COMPOSITION_FAILED");
  });
});

it("admits readable additive cards and resolves their script/deck references without changing official definitions", () => {
  const library: CriticalSnapshot = {
    ...base,
    manifest: {
      ...base.manifest,
      packageId: "card-library",
      packageType: "card-library",
      dependencies: [
        { packageId: "duel-core", requirement: "exact", version: "1.1.0" },
      ],
    },
    config: {
      defaultLocale: "en",
      locales: ["en"],
      revisions: { babelCdb: "fixture", cardScripts: "fixture" },
      requiredScripts: { cards: [], globals: [] },
    },
    decks: [],
    opponents: [],
  };
  const id = "custom:dragon";
  const card = {
    schemaVersion: 1,
    id,
    engine: {
      code: 0,
      alias: 0,
      setcodes: [],
      level: 4,
      attack: 1500,
      defense: 1000,
      lscale: 0,
      rscale: 0,
      linkMarker: 0,
      scope: 3,
    },
    classification: {
      types: ["monster", "effect"],
      attributes: ["earth"],
      races: ["warrior"],
    },
    texts: [
      { locale: "en", name: "Dragon", description: "Fixture", strings: [] },
    ],
  };
  const loaded: LoadedMod = {
    manifest: {
      ...mod("custom").manifest,
      base: [
        { packageId: "card-library", version: "1.1.0" },
        { packageId: "freeplay", version: "1.1.0" },
      ],
      entities: [
        {
          kind: "cards",
          packageId: "card-library",
          operation: "add",
          id,
          path: "card.json",
          resolves: [],
        },
        {
          kind: "scripts",
          packageId: "card-library",
          operation: "add",
          id: `card:${id}`,
          path: "card.lua",
          resolves: [],
        },
        {
          kind: "decks",
          packageId: "freeplay",
          operation: "override",
          id: "starter",
          path: "deck.json",
          resolves: [],
        },
      ],
    },
    files: [
      { path: "card.json", value: card },
      { path: "card.lua", value: "function initial_effect(c) end" },
      { path: "deck.json", value: { fields: { main: [id] } } },
    ],
    sha256: "c".repeat(64),
  };
  let result: ReturnType<typeof composeMods>;
  try {
    result = composeMods([library, base], [loaded], []);
  } catch (error) {
    throw new Error(
      JSON.stringify((error as ModCompositionFailure).diagnostics),
    );
  }
  const code = modEngineCode(id);
  expect(result.packs[0]!.cards[0]!.definition).toMatchObject({
    code,
    type: 33,
    attribute: 1,
    race: "1",
  });
  expect(result.packs[0]!.scripts[0]!.name).toBe(`c${code}.lua`);
  expect(result.packs[1]!.decks[0]!.main).toEqual([code]);
  expect(library.cards).toEqual([]);
  const missingScript = {
    ...loaded,
    manifest: {
      ...loaded.manifest,
      entities: loaded.manifest.entities.filter((e) => e.kind !== "scripts"),
    },
    files: loaded.files.filter((f) => f.path !== "card.lua"),
  };
  expect(() => composeMods([library, base], [missingScript], [])).toThrow(
    "MOD_COMPOSITION_FAILED",
  );
});
