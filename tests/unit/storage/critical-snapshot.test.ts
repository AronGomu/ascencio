import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  compileSnapshot,
} from "../../../scripts/lib/json-content/compile-snapshot.ts";
import { parseCriticalSnapshot } from "../../../src/storage/snapshot/parse-critical-snapshot.ts";

const empty = {
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
  decks: [{ id: "starter", name: "Starter", main: [1], extra: [], side: [] }],
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
describe("critical JSON snapshots", () => {
  it("has deterministic bytes independent of object insertion order", () => {
    expect(canonicalJson({ b: 1, a: { z: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, z: 2 }, b: 1 }),
    );
    expect(compileSnapshot(empty).sha256).toBe(
      compileSnapshot(structuredClone(empty)).sha256,
    );
  });
  it("rejects unsupported envelopes, unknown fields and duplicate entity IDs", () => {
    expect(() => parseCriticalSnapshot({ ...empty, schemaVersion: 2 })).toThrow(
      "SNAPSHOT_SCHEMA",
    );
    expect(() => parseCriticalSnapshot({ ...empty, surprise: true })).toThrow(
      "SNAPSHOT_SCHEMA",
    );
    expect(() =>
      parseCriticalSnapshot({
        ...empty,
        decks: [...empty.decks, ...empty.decks],
      }),
    ).toThrow("ENTITY_DUPLICATE");
  });
  it("rejects invalid opponents and deck payloads at their JSON pointer", () => {
    expect(() =>
      parseCriticalSnapshot({
        ...empty,
        opponents: [{ ...empty.opponents[0], deckId: "missing" }],
      }),
    ).toThrow("/opponents/0/deckId");
    expect(() =>
      parseCriticalSnapshot({
        ...empty,
        decks: [{ ...empty.decks[0], main: [-1] }],
      }),
    ).toThrow("/decks/0/main");
  });
  it("includes media mappings, but never their contents or digests", () => {
    const mapped = {
      ...empty,
      media: [{ id: "image", path: "media/image.png", mime: "image/png" }],
    };
    const result = compileSnapshot(mapped);
    expect(result.source).toContain("media/image.png");
    expect(() =>
      compileSnapshot({
        ...mapped,
        media: [{ ...mapped.media[0], sha256: "x" }],
      }),
    ).toThrow("SNAPSHOT_SCHEMA");
    expect(
      compileSnapshot({
        ...mapped,
        media: [{ ...mapped.media[0], path: "../save.json" }],
      }).source,
    ).toContain("../save.json");
  });
});
