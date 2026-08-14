import { describe, expect, it } from "vitest";
import { deckId } from "../../src/decks/index.ts";
import {
  formatAppRoute,
  handoffId,
  HOME_ROUTE,
  parseAppRoute,
  type AppRoute,
} from "../../src/shell/routes.ts";

const KNOWN_ROUTES: ReadonlyArray<readonly [string, AppRoute]> = [
  ["", HOME_ROUTE],
  ["#", HOME_ROUTE],
  ["#/", HOME_ROUTE],
  ["#/duel", { kind: "duel" }],
  ["#/duel/session/abc", { kind: "duel-session", handoffId: handoffId("abc") }],
  ["#/decks", { kind: "decks" }],
  ["#/decks/deck-1", { kind: "deck", deckId: deckId("deck-1") }],
  ["#/story", { kind: "story" }],
  ["#/admin", { kind: "admin" }],
];

const EVERY_ROUTE: readonly AppRoute[] = [
  HOME_ROUTE,
  { kind: "duel" },
  { kind: "duel-session", handoffId: handoffId("abc") },
  { kind: "decks" },
  { kind: "deck", deckId: deckId("deck-1") },
  { kind: "story" },
  { kind: "admin" },
];

describe("parseAppRoute", () => {
  it("parses every known hash", () => {
    for (const [hash, route] of KNOWN_ROUTES)
      expect(parseAppRoute(hash), hash).toEqual(route);
  });

  it("falls back to home for unknown or malformed hashes", () => {
    const unknown = [
      "#/nope",
      "#/decks/",
      "#//",
      "#/duel/session/",
      "#/duel/session",
      "#/duel/extra",
      "#/decks/deck-1/extra",
      "#decks",
      "#/decks/bad id",
    ];
    for (const hash of unknown)
      expect(parseAppRoute(hash), hash).toEqual(HOME_ROUTE);
  });

  it("rejects oversized ids", () => {
    const oversized = "a".repeat(600);
    expect(parseAppRoute(`#/decks/${oversized}`)).toEqual(HOME_ROUTE);
    expect(parseAppRoute(`#/duel/session/${oversized}`)).toEqual(HOME_ROUTE);
  });
});

describe("formatAppRoute", () => {
  it("formats every route", () => {
    expect(formatAppRoute(HOME_ROUTE)).toBe("#/");
    expect(formatAppRoute({ kind: "duel" })).toBe("#/duel");
    expect(
      formatAppRoute({ kind: "duel-session", handoffId: handoffId("abc") }),
    ).toBe("#/duel/session/abc");
    expect(formatAppRoute({ kind: "decks" })).toBe("#/decks");
    expect(formatAppRoute({ kind: "deck", deckId: deckId("deck-1") })).toBe(
      "#/decks/deck-1",
    );
    expect(formatAppRoute({ kind: "story" })).toBe("#/story");
    expect(formatAppRoute({ kind: "admin" })).toBe("#/admin");
  });

  it("round-trips through parseAppRoute", () => {
    for (const route of EVERY_ROUTE)
      expect(parseAppRoute(formatAppRoute(route)), route.kind).toEqual(route);
  });
});

describe("handoffId", () => {
  it("rejects values outside the id shape", () => {
    expect(() => handoffId("")).toThrow();
    expect(() => handoffId("bad id")).toThrow();
    expect(() => handoffId("a".repeat(129))).toThrow();
  });
});
