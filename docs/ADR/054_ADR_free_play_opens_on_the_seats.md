# ADR-054: Free play opens on the seats, and reads its library early

Status: accepted · 2026-08-24
Relates: ADR-051 (main menu, free play mode, route contexts — supersedes its free-play menu), ADR-049 (save-owned decks)
Amended (owner ask, duel chrome round): the exit is unchanged in meaning and moved in place. "Leave match" is no longer a shell control painted over the duel; the shell hands the duel an `onleavematch` callback through `BattleFacade`, and the duel offers it in its own options menu under Surrender. A host that owns its exit — a story session — passes `null`, and the menu shows no such item.

## Context

ADR-051 gave free play a menu of its own: Start a match, Deck builder, Return to main menu. Two rounds of use showed what it costs.

1. **Start a match named the screen behind it.** Free play has exactly one thing to ask before a duel — which two decks — and the setup screen already asks it. The menu was a click whose only outcome was the screen the player had already chosen by pressing Free Play.
2. **The deck builder was a screen away from the seats.** A player looking at a deck list and wanting a deck that is not in it had to go back a screen to reach the library the list is read from.
3. **Every visit paid the whole read again.** The setup screen mounted, loaded the battle entry, fetched the packaged card database (14,794 cards over 128 shards), opened the deck library and resolved every local deck — with both seats disabled and "Reading your deck library…" on screen until all of it landed. Leaving a match and starting another paid it a second time; a trip to the deck builder and back paid it a third.

The constraint from ADR-051 stands: the shell is eager and everything else is not, so nothing here may make the battle entry or the card database part of first paint. `build:verify` enforces that as a byte budget per chunk.

## Decision

**`#/free-play` renders the match setup.** The free-play menu is gone. Its three entries survive as controls on the screen that used to be behind it: Start the duel, a **Deck builder** button under the player's seat, and **Main menu** beside Start. The match stays a state of the route rather than a route of its own, so "Leave match" over the duel returns to the seats, and leaving free play ends the match.

**The seats are filled in two stages.** The bundled decks are compiled into this build and need no read at all, so they are on screen and playable on the first paint; the local library replaces that list when it lands. A seat keeps whatever the player has already chosen when the fuller list arrives, then falls back to the remembered pairing, then to the bundled default.

**The listing is read early and held for the page.** `free-play-deck-listing.ts` owns three things: the battle entry loaded at most once, the last completed listing, and a read that any host may start. The main menu starts that read when a player *reaches* for Free Play — pointer over the entry, or focus on it — so the fetch overlaps the travel to the click. Every mount of the setup screen revalidates, so a deck built between two visits appears without the player waiting for it to be proved.

Warming is bound to the reach rather than to the main menu mounting, because the read is the whole card database: a player who came for the story and passes the entry by must not pay for it.

## Consequences

- Free play is two clicks to a duel instead of three, and the deck builder is one click from the list it fills.
- The seats are never empty and never disabled on a warmed page; on a cold one they offer the bundled decks immediately and the player's own a moment later.
- The battle entry now loads when `#/free-play` is opened rather than when a match starts. It is still lazy, still behind its own chunk, and the main menu still loads none of it — what changed is which of the two free-play screens pays for it, and there is only one now.
- A held listing is a listing that can be stale. It is display-only: `parseBattleRequest` still runs against the chosen deck at Start, and a key that no longer resolves is refused there as before.
- The cache lives exactly as long as the page, so tests get `resetFreePlayDeckCacheForTests()` — one test's library must not be the next one's first paint.
- ADR-051's route table is unchanged. Only the meaning of the `#/free-play` row moves: free-play menu → free-play match setup.
