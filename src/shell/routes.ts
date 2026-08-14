import { deckId, type DeckId } from "../decks/index.ts";

/* Route ids travel in the URL hash, so they stay restricted to characters that
   survive a copy-paste without escaping and cannot smuggle a path segment. */
const ROUTE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type HandoffId = string & { readonly __handoffId: unique symbol };

export function handoffId(value: string): HandoffId {
  if (!ROUTE_ID.test(value)) throw new Error("Handoff ID is invalid");
  return value as HandoffId;
}

export type AppRoute =
  | { readonly kind: "home" }
  | { readonly kind: "duel" }
  | { readonly kind: "duel-session"; readonly handoffId: HandoffId }
  | { readonly kind: "decks" }
  | { readonly kind: "deck"; readonly deckId: DeckId }
  | { readonly kind: "story" }
  | { readonly kind: "admin" };

export const HOME_ROUTE: AppRoute = { kind: "home" };

export function parseAppRoute(hash: string): AppRoute {
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  if (path === "" || path === "/") return HOME_ROUTE;
  if (!path.startsWith("/")) return HOME_ROUTE;
  const segments = path.slice(1).split("/");

  if (segments.length === 1) {
    switch (segments[0]) {
      case "duel":
        return { kind: "duel" };
      case "decks":
        return { kind: "decks" };
      case "story":
        return { kind: "story" };
      case "admin":
        return { kind: "admin" };
      default:
        return HOME_ROUTE;
    }
  }

  const sessionId = segments[2];
  if (
    segments.length === 3 &&
    segments[0] === "duel" &&
    segments[1] === "session" &&
    sessionId !== undefined &&
    ROUTE_ID.test(sessionId)
  )
    return { kind: "duel-session", handoffId: handoffId(sessionId) };

  const id = segments[1];
  if (
    segments.length === 2 &&
    segments[0] === "decks" &&
    id !== undefined &&
    ROUTE_ID.test(id)
  )
    return { kind: "deck", deckId: deckId(id) };

  return HOME_ROUTE;
}

export function formatAppRoute(route: AppRoute): string {
  switch (route.kind) {
    case "home":
      return "#/";
    case "duel":
      return "#/duel";
    case "duel-session":
      return `#/duel/session/${route.handoffId}`;
    case "decks":
      return "#/decks";
    case "deck":
      return `#/decks/${route.deckId}`;
    case "story":
      return "#/story";
    case "admin":
      return "#/admin";
  }
}
