# T15: Preview panel stats row

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Card preview panel shows a structured stats line (Attribute · Type · Level/Rank/Link · ATK/DEF for monsters; family · subtype for spells/traps) between name and effect text.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). Grill outcome (confirmed, `ai-artifacts/GRILL_2026_08_16_duel_feedback_round_4/ANSWERS.md` round 2): preview panel gains a stats row so main stats are readable as text, not only off the card art.
- Fact: data already in memory. `App.svelte` builds `ACTIVE_CARDS = activeCatalog()` (`src/decks/catalog/active-catalog.ts`) → `DeckBuilderCardView[]` with `family`, `subtypes`, `attribute`, `race`, `levelRankLink`, `ratingLabel` ("Level" | "Rank" | "Link"), `attack: number | null`, `defense: number | null` (`src/decks/catalog/ocg-card-mapper.ts`). `ACTIVE_CARD_TEXTS = new Map(ACTIVE_CARDS.map((card) => [card.code, card]))` — map values ARE full `DeckBuilderCardView`s, currently consumed through the narrower `CardPreviewText` interface. Zero new data plumbing.
- Out of scope here: pendulum scales / link markers display, deck editor views, HUD, board labels, Inspect removal (T9 owns that).
- Assumptions in force: format decided in grill — monster `"DARK · Spellcaster · Level 4 · ATK 1800 / DEF 1200"`, Link omits DEF (`"… · Link 2 · ATK 1400"`), spell/trap `"Spell · Quick-Play"` (plain `"Spell"` when no subtype). Unknown/`null` ATK or DEF renders `?`.

## Requirements

- `src/battle/app/presentation/card-preview.ts`:
  - Extend `CardPreviewText` with the optional fields it may receive: `readonly family?: "monster" | "spell" | "trap"; readonly subtypes?: readonly string[]; readonly attribute?: string | null; readonly race?: string | null; readonly levelRankLink?: number | null; readonly ratingLabel?: "Level" | "Rank" | "Link" | null; readonly attack?: number | null; readonly defense?: number | null;`
  - New pure function:
    ```ts
    export function formatCardStatsLine(text: CardPreviewText): string | null;
    ```
    monster → `${attribute} · ${race} · ${ratingLabel} ${levelRankLink} · ATK ${atk} / DEF ${def}` where missing attribute/race segments are skipped, `atk`/`def` render `?` for `null`/negative, `ratingLabel === "Link"` drops the `/ DEF …` part. spell/trap → `${Family}${subtype ? " · " + subtype : ""}` with capitalized family. `family` undefined → `null` (no row).
  - `CardPreviewView` gains `readonly statsLine: string | null;` populated by `cardPreviewForCode` via `formatCardStatsLine`.
- `src/battle/app/components/CardPreviewPanel.svelte`: between `<h2 data-cy="card-preview-name">` and the text region, render `{#if preview.statsLine}<p class="card-preview-panel__stats" data-cy="card-preview-stats">{preview.statsLine}</p>{/if}` (data-cy mandatory — repo gate `tests/unit/data-cy-coverage.test.ts`).
- CSS `src/styles/app.css` near existing `.card-preview-panel` rules: `.card-preview-panel__stats { margin: 0.15rem 0 0.4rem; color: var(--muted); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.02em; }`.

## Inputs

- `src/battle/app/presentation/card-preview.ts` — `CardPreviewText`, `CardPreviewView`, `cardPreviewForCode(code, cardTexts)`.
- `src/battle/app/components/CardPreviewPanel.svelte` — body block (`data-cy="card-preview-body"`).
- `src/decks/catalog/ocg-card-mapper.ts` — `DeckBuilderCardView` field list (source of truth for the optional fields; quote, don't import into the battle domain if the domain-boundary test forbids it — check `tests/unit/domain-boundaries.test.ts`; if cross-domain import is forbidden, keep the structural optional fields on `CardPreviewText` as written, no import needed).
- Tests: `tests/unit/card-preview.test.ts`, `tests/component/CardPreviewPanel.test.ts`.

## TDD

1. **Red**
   - `tests/unit/card-preview.test.ts` — `formatCardStatsLine`:
     - `formats a monster stat line` ({family:"monster", attribute:"DARK", race:"Spellcaster", ratingLabel:"Level", levelRankLink:4, attack:1800, defense:1200} → `"DARK · Spellcaster · Level 4 · ATK 1800 / DEF 1200"`).
     - `formats a link monster without defense` (ratingLabel "Link", levelRankLink 2, attack 1400 → `"… · Link 2 · ATK 1400"`).
     - `renders unknown attack as a question mark` (attack null → `ATK ?`).
     - `formats a spell with its subtype` ({family:"spell", subtypes:["Quick-Play"]} → `"Spell · Quick-Play"`).
     - `returns null without family data` ({name, description} only → null).
   - `tests/unit/card-preview.test.ts` — `cardPreviewForCode carries the stats line`.
   - `tests/component/CardPreviewPanel.test.ts` — `renders the stats row between name and effect text` (preview with statsLine → `[data-cy="card-preview-stats"]` present with text); `omits the stats row without stats` (statsLine null → absent).
2. **Green** — impl per Requirements.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| monster stat line | DARK Spellcaster Lv4 1800/1200 | `DARK · Spellcaster · Level 4 · ATK 1800 / DEF 1200` |
| link monster | Link 2, ATK 1400 | no `/ DEF` segment |
| unknown attack | attack null | `ATK ?` |
| spell subtype | Quick-Play spell | `Spell · Quick-Play` |
| no family data | name+description only | `null`, row absent |
| panel renders row | preview with statsLine | `card-preview-stats` visible |

## Impl steps

- [x] 1. Check `tests/unit/domain-boundaries.test.ts` for battle→decks import rules; keep `CardPreviewText` structural (no import) if forbidden. Evidence: battle→decks imports are legal, but ticket specifies structural fields — no import needed or used.
- [x] 2. Write unit tests; `npm run test:unit -- tests/unit/card-preview.test.ts`; red. Evidence: 13 tests failed before impl as expected.
- [x] 3. Implement `formatCardStatsLine` + `CardPreviewText`/`CardPreviewView` extension + `cardPreviewForCode` wiring. Evidence: card-preview.ts extended; 1182 unit tests pass.
- [x] 4. Unit green. Component test (red) → edit `CardPreviewPanel.svelte` + CSS → green. Evidence: 510 component tests pass.
- [x] 5. `npm run test:unit && npm run test:component && npm run typecheck && npm run lint`. Evidence: all pass; check:headless ok.
- [x] 6. Manual check: dev duel — hover monsters (stats line correct), spells/traps (family · subtype), Link monster (no DEF). Delegated to manual_test_checklist.md.

## Outputs

- Files touched: `src/battle/app/presentation/card-preview.ts`, `src/battle/app/components/CardPreviewPanel.svelte`, `src/styles/app.css`, `tests/unit/card-preview.test.ts`, `tests/component/CardPreviewPanel.test.ts`.
- Public API: `CardPreviewView.statsLine`, `formatCardStatsLine(text)`.
- Migrate/config: none.

## Validation

- [x] tests pass: `npm run test:unit`, `npm run test:component`. Evidence: 1182 unit + 510 component pass.
- [x] manual check: stats line matrix above. Delegated to manual_test_checklist.md.
- [x] app functional — no broken path from this slice. Evidence: check:headless ok, typecheck 0 errors.
- [x] commit msg draft: `feat(preview): structured stats row in the card preview panel`
