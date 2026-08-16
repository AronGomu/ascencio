# T10: Right rail redesign

**Plan:** `./ai-artifacts/PLAN_2026_08_16_duel_feedback_round_4.md`
**Depends:** none
**Commit outcome:** Right rail has a distinct header (turn/phase + options, separated by a rule), full-width fat-bordered avatar placeholders (not card backs), "LP 8000"-style bordered plates with green/orange/red states and animated updates, and a status block centered on the field's vertical middle.

## Context (self-contained)

- Goal: duel feedback round 4 — YGO story duel simulator (Svelte 5). Right Side Panel feedback: (1) real avatar placeholder instead of face-down card; (2) LP inside a border, bigger, centered (YGO aesthetic); (3) line separation under the top row like a header; (4) avatar takes whole panel width; (5) fat border all around avatars; (6) action prompt stays aligned with middle of duel field.
- Grill decisions (confirmed — `ai-artifacts/GRILL_2026_08_16_duel_feedback_round_4/ANSWERS.md` round 1 Q9): LP text = `LP 8000` (label-left, NO thousands separator). Color states: green when `lp > 4000`, orange when `2000 ≤ lp ≤ 4000`, red when `lp < 2000`. Animate the number when LP changes (~600 ms count tween, disabled under `prefers-reduced-motion`). Both plates.
- This slice: `src/battle/app/components/DuelRail.svelte` + rail CSS (`src/styles/app.css` ~lines 402–490) + `App.svelte` avatar props.
- Today: `App.svelte` passes `playerAvatarUrl={imageLibrary?.cardBackUrl ?? ""}` (same for opponent) → rail shows card backs. `AVATAR_PLACEHOLDER` const in DuelRail is a plain circle SVG. Rail layout: `.duel-right-rail` column; `__top` row (turn/phase strong + ⚙ button); opponent `__identity` (img + `<p>` LP); `__status` (h2/p/dots); player `__identity`.
- Out of scope here: real avatar art assets (story avatars come later — placeholder only), settings dialog, rail width, turn/phase copy.
- Assumptions in force: rail spans the duel field height (`.duel-shell` grid), so vertically centering the status inside the rail ≈ field middle.

## Requirements

- `App.svelte`: pass `playerAvatarUrl=""` and `opponentAvatarUrl=""` (delete the cardBackUrl fallbacks) so the placeholder shows until real avatars exist.
- `DuelRail.svelte` `AVATAR_PLACEHOLDER`: replace circle with a person-silhouette data-URI SVG, square viewBox, e.g. `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' fill='%2318243b'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%23697895'/%3E%3Cpath d='M16 88c4-20 18-28 32-28s28 8 32 28z' fill='%23697895'/%3E%3C/svg%3E`.
- Structure changes in `DuelRail.svelte`:
  - Wrap top row in `<header class="duel-right-rail__header" data-cy="duel-right-rail-header">` (keeps existing children + data-cy values).
  - LP paragraph per identity becomes `<p class="duel-right-rail__life" data-cy="duel-right-rail-life-points-{0|1}">LP {displayed}</p>` (keep data-cy values — tests + e2e read them; rendered TEXT changes from `8,000 LP` to `LP 8000` — grep + update every test asserting the old format: `grep -rn "LP" tests/ e2e/ | grep -i "life\|8,000\|8000"`).
  - LP state classes on the same element: `class:is-high={lp > 4000}`, `class:is-mid={lp >= 2000 && lp <= 4000}`, `class:is-low={lp < 2000}`.
  - LP animation: `displayed` per player tweens toward the real value — use `svelte/motion` `tweened(lifePoints[i], { duration: 600 })` rounded on render; respect reduced motion (`matchMedia("(prefers-reduced-motion: reduce)")` → duration 0). Keep it inside `DuelRail.svelte`; no store changes.
- CSS (`src/styles/app.css`, rail block):
  - `.duel-right-rail__header { border-bottom: 2px solid var(--border, color-mix(in srgb, var(--text) 25%, transparent)); padding-bottom: 0.5rem; margin-bottom: 0.25rem; }` — use an existing border token if one exists (`grep -n "\-\-border\|--surface-strong" src/styles/tokens.css`); pick the token, never hardcode.
  - `.duel-right-rail__identity img { width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; border: 4px solid var(--accent); border-radius: var(--radius-sm); }` (full width + fat border all around).
  - `.duel-right-rail__life { display: block; width: 100%; margin: 0.35rem auto 0; padding: 0.3rem 0; border: 2px solid var(--accent); border-radius: var(--radius-sm); background: color-mix(in srgb, var(--bg-deep) 70%, transparent); font-size: 1.35rem; font-weight: 800; text-align: center; font-variant-numeric: tabular-nums; }` (YGO-style LP counter: bold number in a plate).
  - LP states: `.duel-right-rail__life.is-high { color: var(--success); }`, `.is-mid { color: var(--warning); }`, `.is-low { color: var(--danger); }` (tokens from `src/styles/tokens.css`; border may share the state color — `border-color: currentColor`).
  - `.duel-right-rail__status { flex: 1; display: grid; place-content: center; text-align: center; }` — status (action prompt) rides the rail's vertical middle (#6).
  - Delete/adjust the old `__identity img` sizing rules that conflict.
- Repo data-cy gate: any new element carries `data-cy` (`tests/unit/data-cy-coverage.test.ts` scans `src/battle/**/*.svelte`).

## Inputs

- `src/battle/app/components/DuelRail.svelte` (full file, 86 lines).
- `src/styles/app.css` rail rules: `.duel-right-rail`, `__top`, `__options`, `__identity`, `__status`, `__dots`.
- `src/battle/app/App.svelte` — `<DuelRail … playerAvatarUrl={imageLibrary?.cardBackUrl ?? ""} opponentAvatarUrl={imageLibrary?.cardBackUrl ?? ""} …/>`.
- `tests/component/DuelRail.test.ts` — existing expectations (turn/phase text, LP text, data-cy hooks).

## TDD

1. **Red** — `tests/component/DuelRail.test.ts`:
   - test name: `falls back to the avatar placeholder when no avatar url is given` — render with `playerAvatarUrl=""` → `[data-cy="duel-player-avatar-0"]` `src` starts with `data:image/svg+xml` and is NOT the old circle (assert contains `path` silhouette marker, e.g. `M16 88c4-20`).
   - test name: `renders a header row and bordered life points` — `[data-cy="duel-right-rail-header"]` exists; `[data-cy="duel-right-rail-life-points-0"]` has class `duel-right-rail__life` and text `LP 8000`.
   - test name: `life plates carry their state class` — render with `lifePoints={[8000, 3000]}` → plate 0 has `is-high`, plate 1 has `is-mid`; rerender `[1500, 8000]` → plate 0 `is-low`.
   - test name: `life updates settle on the new value` — rerender with changed LP; `await` until text shows the target (tween end); with reduced motion mocked, text updates immediately.
2. **Green** — impl below.
3. **Refactor** — none.

## Test plan

| Test | Input | Expect |
| ---- | ----- | ------ |
| falls back to avatar placeholder | empty avatar urls | silhouette data URI in both imgs |
| header row + bordered LP | default render | header element + `duel-right-rail__life` + text `LP 8000` |
| life state classes | 8000 / 3000 / 1500 | `is-high` / `is-mid` / `is-low` |
| life tween settles | LP change | text reaches target; instant under reduced motion |
| existing DuelRail suite | — | stays green after text-format updates |

## Impl steps

- [ ] 1. Red tests; `npm run test:component -- tests/component/DuelRail.test.ts`.
- [ ] 2. `DuelRail.svelte`: new placeholder SVG, `<header>` wrapper, `__life` class + `LP {value}` format + state classes + `tweened` animation on both LP paragraphs.
- [ ] 3. `App.svelte`: avatar props → `""` (grep `AvatarUrl` in App.svelte; two props on the DuelRail call).
- [ ] 4. CSS per Requirements; check tokens first (`src/styles/tokens.css`) and use existing border/accent tokens.
- [ ] 5. `grep -rn "8,000 LP\|toLocaleString" src/battle tests/ e2e/` — update every old-format expectation.
- [ ] 6. `npm run test:component && npm run typecheck && npm run lint && npm run format:check`.
- [ ] 7. Manual check: dev duel — header rule; full-width fat-border silhouettes; `LP 8000` plates; take damage below 4000 → orange, below 2000 → red; number visibly counts down; status text vertically centered; thinking dots animate.

## Outputs

- Files touched: `DuelRail.svelte`, `App.svelte`, `src/styles/app.css`, `tests/component/DuelRail.test.ts`.
- Behavior: visual only; all `data-cy` selectors preserved.
- Migrate/config: none.

## Validation

- [ ] tests pass: `npm run test:component`
- [ ] manual check: rail matches the six feedback points
- [ ] app functional — no broken path from this slice
- [ ] commit msg draft: `feat(rail): header rule, avatar placeholders, stateful animated LP plates, centered status`
