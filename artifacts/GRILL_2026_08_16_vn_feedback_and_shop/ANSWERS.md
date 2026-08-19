# Grill: vn_feedback_and_shop

## Round 1 — General UI + Economy + Shop

| # | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1 | "Open Pose Menu" = "Open pause menu" button? | Yes — speech-to-text artifact | — |
| 2 | Gear position on map/system screens | **Top-right, same spot as narrative utility bar gear** (override; plan had bottom-left) | — |
| 3 | What does Hide UI hide? | **Everything except the toggle button itself** (override; plan had bar-stays) | — |
| 4 | Return-to-menu scope | VN only in this plan; duel/deck logged for their lanes | — |
| 5 | DP/collection persistence | Inside `StoryState`: loading a save rolls economy back with the story | — |
| 6 | Top bar position/screens | Top-left; narrative + map + shop screens | — |
| 7 | Shop entry points | Map hotspot + top-bar icon from narrative and map, unrestricted for now | — |
| 8 | Prototype set catalog | **Bundle real set/rarity JSON scraped now** (override; plan had deterministic partition) | Take the first 50 original sets from YGO |
| 9 | Pack size/price | 9 cards (8 common + 1 rare-or-better) at 100 DP | — |
| 10 | Sell ladder | 10 / 25 / 50 / 100 / 250 / 500 / 1000 (common→ghost) | — |
| 11 | Rarity source + palette | Inference rules + proposed palette selected | **Use the original rarity from the YGO set itself** → real data primary, inference = fallback |
| 12 | Sequential opening | Click/Enter reveals next card; Skip; reduced-motion instant | — |

## Facts (scout)

- `story-global-pause` "Open pause menu" floating button exists in `src/story/StoryApp.svelte`; no pose feature anywhere — source: read of `src/story/`
- Save/Load/Settings already inside `PauseOverlay.svelte` — source: read
- Packaged catalog ≈ 120 cards via `activeCatalog()` (`src/decks/catalog/active-catalog.ts`); no set membership, no rarity — source: read
- Story chunk budget 86,250 B in `scripts/lib/domain-chunk-closure.ts`; asset pipeline precedent: `assets-source-lock.json`, `scripts/download-*.ts`, verified-snapshot rule — source: read
- Story → `src/decks/**` deep imports legal (`eslint.config.js` zones) — source: read

## Round 2 — Real set data

| # | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1 | Lineage of "first 50 sets" | TCG English release order, first 50 booster sets (LOB, MRD, SRL, PSV, …) | — |
| 2 | Acquisition | **Hand-assembled JSON committed once, no script** | Static info; no pinning/verify needed |
| 3 | Set lists vs packaged pool | **Show full real lists; placeholder art for missing cards** | Find a solution for missing cards — update the card-download script to fetch them |
| 4 | Packaged cards outside the 50 sets | Unpurchasable; test data, will never appear in the actual game | **New feature: buy singles** — every card buyable as a single once its set is released, at 4× its sell price (common = 40 DP) |
| 5 | Rarity fallback | Ordered inference rules from round 1 | — (multi-rarity merge rule left unanswered) |
| 6 | JSON runtime home | `public/` static asset, lazy-fetched on first shop entry, typed + validated | Must be PWA-offline: after an update download, the game plays fully offline |

## Shared understanding

- **Goal:** apply `feedback-vn.md` in `src/story/` — menu/bar cleanup, DP economy, map shop node, shop prototype (keeper, 50 real sets, packs, opening, singles, sell) — VN fully usable offline as part of the PWA.
- **Settled — General UI:**
  - "Open Pose Menu" = the floating "Open pause menu" button; it dies.
  - Gear icon replaces Pause in the narrative bar; on map/system screens the gear sits **top-right, same spot as the narrative bar gear**. Overlay retitled "Menu" (Save/Load/Settings already inside).
  - Hide UI = toggle in place; when hidden **everything hides except the toggle button itself**.
  - Auto/Skip lose the "experimental" label.
  - Return-to-menu: VN title screen only this plan; duel/deck equivalents logged for their lanes.
  - Top bar: **top-left**, on narrative + map + shop screens: DP pill · shop icon (hidden in shop) · deck icon → `#/decks` hash-jump. Booster chip joins in shop.
- **Settled — Economy:** DP start 1000 inside `StoryState`; loading a save rolls DP/collection back with the story (save schema v2, v1 migrates). Pack = 9 cards (8 common + 1 rare-or-better) at 100 DP. Sell ladder common→ghost: 10 / 25 / 50 / 100 / 250 / 500 / 1000. **Singles: buyable at 4× sell price once their set is released** (common 40 DP).
- **Settled — Shop:** entry via map hotspot + top-bar icon (narrative/map), unrestricted for now. Keeper greeting with VN beats → Buy / Sell / Leave. Set browser scaled for hundreds with latest-unlocked row. Card-list window: grid + left preview + hover zoom + rarity halos. Booster dialog: steppers, Open (click/Enter per-card reveal, Skip, reduced-motion instant) and Open All (brief animation → full recap screen).
- **Settled — Set data:** first 50 TCG English booster sets, hand-assembled JSON (id, name, year, cards `{code, name, rarity}`) committed once — no pinning ceremony. Served from `public/`, lazy-fetched on shop entry, validated on load, cached for full offline PWA play. Full real lists shown; missing art solved by extending the existing card image download script (root `scripts/` — main-lane flag); placeholder art until covered. Real printed rarity primary; round-1 inference rules as fallback. Packaged cards outside the 50 sets: invisible to the shop (test data).
- **Assumptions (unanswered micro-points, defaults chosen):**
  - Multi-rarity printings in one set → **highest rarity wins** for halo/price.
  - Singles purchase UI lives in the set card-list window (per-card Buy button at 4× sell) — the natural surface; no separate singles screen.
  - "Set released" == set unlocked (same flag) until a release/progression system exists.
  - Non-packaged cards bought as packs/singles enter the collection by code with JSON name + downloaded/placeholder art; they stay unusable in decks/duels until the engine snapshot expands (out of scope).
- **Out of scope:** duel/deck return-to-menu buttons (their lanes), shop access restrictions, deck-builder current/default-deck management, engine snapshot expansion, collection-restricted deck building.
