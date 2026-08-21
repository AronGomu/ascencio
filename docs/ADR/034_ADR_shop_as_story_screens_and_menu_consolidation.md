# ADR-034: Shop as story-internal screens + VN menu consolidation

Status: accepted · 2026-08-16 (rev. 2 after the user-confirmed VN feedback/shop grill) · Commit: `d81f2fb`

## Context

VN feedback: shop with shopkeeper NPC, reachable from a map location and a top-bar icon; deck icon opening the deck builder; menu cleanup (gear icon, Save/Load/Settings inside one menu, Hide-UI toggle, return-to-menu).

Constraints: ADR-022/ADR-023 — shell owns routes, domains stay behind `index.ts`, story may not import shell or deck-editor internals; `vn` branch owns `src/story/` only.

## Decision

1. **Shop = story screens, not a shell route.** Six ids extend `StoryScreen`: `shop-greeting`, `shop-browse`, `shop-cards`, `shop-sell`, `shop-opening`, `shop-results`. Code lives in `src/story/shop/`. The shell never learns the shop exists; `#/story` URL never changes inside it.
2. **Map node ≠ encounter.** `LocationId` gains `card-shop`; `EncounterId = Exclude<LocationId, "card-shop">` so the duel handoff cannot name the shop. Exported name `EncounterId` unchanged.
3. **Cross-domain jumps = hash writes.** Deck icon and title "Main menu" set `globalThis.location.hash` (`#/decks`, `#/`). Browser API, no import, boundaries intact; shell reacts to `hashchange` as designed.
4. **One menu.** Pause overlay retitled "Menu", already holds Save/Load/Settings/Return-to-Title. Narrative bar: gear icon + History + Auto + Skip + Hide/Show-UI toggle. Other screens: floating gear **top-right, same spot as the narrative bar gear** (grill round 1 override — one gear position everywhere). Text button "Open pause menu" removed. Hide UI hides everything except the toggle button itself.

## Consequences

- Shop state saves/checkpoints with the story for free (ADR-033); shopkeeper dialogue reuses VN idioms (beats, click-to-advance).
- Shop stays private to the story; a future "shop as shared domain" (e.g. reachable from deck editor) would need a shell route + public contract — separate ADR.
- Hash-write navigation loses in-memory story state on domain switch; unsaved-progress semantics equal existing title-exit path. Acceptable; save prompts exist in the menu.
- Floating gear inherits automatically on future story screens (render guard excludes only `title`/`load`/`end`/`narrative`); top bar sits top-left, gear top-right — no collision.

## Rejected

- Shell route `#/story/shop`: leaks a domain-internal screen into shell routing, forces cross-branch work for every shop sub-screen.
- Importing `deck-editor/index.ts` from story to embed the builder: eager cross-domain coupling, boundary tests forbid the useful deep parts anyway.
