# T9: Right pane: orange active-player avatar+LP borders, bigger avatar (RP1,RP2)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** none
**Commit outcome:** Identity-block active border gone; avatar img + LP border orange when active, grey otherwise; avatar bigger on full HD.

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field and its right pane. This ticket covers Right Pane items 1 and 2, owner wording (binding):
  - RP1: "Remove the border around the avatar when it's the current turn of the player. Instead, update the border around the avatar itself and the life points to be orange. Orange should indicate the active player, and neutral, meaning grey, indicates a non-active player."
  - RP2: "On full hd screen, make the avatar image for both player and opponent bigger"
- This slice: the right rail only — `src/battle/app/components/DuelRail.svelte` and its rules in `src/styles/app.css`. Today the active player is marked by a 2px teal border around the whole identity block (avatar + LP together); the avatar has its own always-on 4px teal border and the LP plate a 2px border whose colour is hijacked by the LP tier classes. After this ticket the identity-block border mechanism is gone, and the avatar's 4px border plus the LP's 2px border are the sole turn indicator: orange (`--selected`) when that player is active, grey (`--border`) otherwise. Avatar/LP width cap rises from 0.26 to 0.32 of `--stage-h`.
- Out of scope here: no duel-field changes (`src/battle/field/`, `DuelField*`), no shell/story/deck-editor files, no token value changes in `src/styles/tokens.css`, never edit `feedback.md` or any `feedback*.md`. `DuelRail.svelte`, `src/styles/app.css`, `tests/component/DuelRail.test.ts` and `artifacts/manual_test_checklist.md` are the only files touched.
- Assumptions in force:
  - Brief said "LP likely has no border today — verify". Codebase wins: LP already has `border: 2px solid var(--accent)` (app.css:591) and the tier classes `is-high/is-mid/is-low` set `border-color: currentColor` (app.css:599–610). The `currentColor` border rules are removed so the active/grey scheme owns the border; tier classes keep their text colour only.
  - Grey token choice (plan left it open, recorded here): inactive border colour is `var(--border)` (#697895, tokens.css:21) — the repo's standard neutral border grey. Orange is `var(--selected)` (#ffd580, tokens.css:41).
  - RP2 target value 0.32 is provisional per plan A9: if 1920×1080 overflows at 0.32, the largest fitting value wins and the actual value is recorded in the commit message and the rationale comment.
  - The identity wrapper `<div class="duel-right-rail__identity">` stays (grid layout depends on it); only its `class:active` binding and its border CSS go.

## Requirements

- The identity block (`.duel-right-rail__identity`) no longer renders any border in any state; its `border`/`border-color` rules and the `class:active` bindings on the two wrapper divs are deleted.
- Avatar `<img>` border: 4px solid, `var(--selected)` when that player is the turn player, `var(--border)` otherwise. Both players.
- LP plate (`.duel-right-rail__life`) border: 2px solid, `var(--selected)` when active, `var(--border)` otherwise. Both players. LP tier classes no longer touch `border-color`; their text colour behaviour is unchanged.
- Exactly one player is "active" at a time, driven by the existing `turnPlayer` prop (`PlayerIndex`, `0 | 1`); player N's avatar and LP carry class `active` iff `turnPlayer === N`.
- Avatar/LP width cap becomes `min(100%, calc(var(--stage-h, 100svh) * 0.32))`; the rationale comment above it is updated to name the new factor.
- On a 1920×1080 viewport both identities plus the status band still fit the rail without vertical overflow.
- `npm run check:headless` and `npm run test:component` are green.
- `artifacts/manual_test_checklist.md` gains a section covering the new behaviour, matching the file's existing conventions (H3 heading, `- [ ]` steps, plain owner-readable language).

## Inputs

- `src/battle/app/components/DuelRail.svelte` — opponent identity div with `class:active={turnPlayer === 1}` (line ~93), opponent avatar img `data-cy="duel-player-avatar-1"` (~98–103), opponent LP p (~104–113); player identity div `class:active={turnPlayer === 0}` (~134), player LP p (~138–147), player avatar img `data-cy="duel-player-avatar-0"` (~148–153). Props: `turnPlayer: PlayerIndex`, `lifePoints: readonly [number, number]`.
- `src/styles/app.css` — `.duel-right-rail__identity { … border: 2px solid transparent; }` (560–564), `.duel-right-rail__identity.active { border-color: var(--accent); }` (565–567), rationale comment (568–574), width cap `.duel-right-rail__identity img, .duel-right-rail__life { width: min(100%, calc(var(--stage-h, 100svh) * 0.26)); }` (575–578), avatar border `border: 4px solid var(--accent)` inside `.duel-right-rail__identity img` (579–586), LP plate `border: 2px solid var(--accent)` inside `.duel-right-rail__life` (587–598), tier rules `.duel-right-rail__life.is-high/.is-mid/.is-low { color: …; border-color: currentColor; }` (599–610).
- `src/styles/tokens.css` — read-only: `--border: #697895` (21), `--selected: #ffd580` (41).
- `tests/component/DuelRail.test.ts` — existing suite `describe("DuelRail", …)`; shared `props` object has `turnPlayer: 1 as const`; helpers `mockMotionPreference`, `mockAnimationFrames`, `lifeText`.
- `artifacts/manual_test_checklist.md` — append target; sections are `### <plain-language title>` followed by `- [ ]` steps.
- **From Depends:** none.

## Interface contract (level 5)

- **Produces (Svelte template, both identity blocks — exact class bindings):**

  ```svelte
  <!-- opponent block: identity div keeps ONLY class + data-cy, no class:active -->
  <div class="duel-right-rail__identity" data-cy="duel-right-rail-opponent">
    <img
      class:active={turnPlayer === 1}
      src={opponentAvatarUrl || AVATAR_PLACEHOLDER}
      alt=""
      aria-hidden="true"
      data-cy="duel-player-avatar-1"
    />
    <p
      class="duel-right-rail__life"
      class:active={turnPlayer === 1}
      class:is-high={lifePoints[1] > 4000}
      class:is-mid={lifePoints[1] >= 2000 && lifePoints[1] <= 4000}
      class:is-low={lifePoints[1] < 2000}
      data-cy="duel-right-rail-life-points-1"
    >
  ```

  Player block mirrors it with index `0` (`class:active={turnPlayer === 0}` on `duel-player-avatar-0` and `duel-right-rail-life-points-0`); its LP p comes before its img, order unchanged.

- **Produces (CSS, `src/styles/app.css` — final state of the touched rules, verbatim):**

  ```css
  .duel-right-rail__identity {
    display: grid;
    justify-items: center;
  }
  /* (comment block updated, see impl step 2.2) */
  .duel-right-rail__identity img,
  .duel-right-rail__life {
    width: min(100%, calc(var(--stage-h, 100svh) * 0.32));
  }
  .duel-right-rail__identity img {
    display: block;
    height: auto;
    aspect-ratio: 1;
    object-fit: cover;
    border: 4px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .duel-right-rail__identity img.active {
    border-color: var(--selected);
  }
  .duel-right-rail__life {
    display: block;
    margin: 0.35rem auto 0;
    padding: 0.3rem 0;
    border: 2px solid var(--border);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--bg-deep) 70%, transparent);
    font-size: 1.35rem;
    font-weight: 800;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .duel-right-rail__life.active {
    border-color: var(--selected);
  }
  .duel-right-rail__life.is-high {
    color: var(--success);
  }
  .duel-right-rail__life.is-mid {
    color: var(--warning);
  }
  .duel-right-rail__life.is-low {
    color: var(--danger);
  }
  ```

  `.duel-right-rail__life.active` must appear **after** the three tier rules in source order is not required (tier rules no longer set border-color), but keep it adjacent to `.duel-right-rail__life` for readability. Deleted outright: `.duel-right-rail__identity.active { border-color: var(--accent); }` and the `border: 2px solid transparent;` line.

- **Consumes:** `export let turnPlayer: PlayerIndex` where `PlayerIndex = 0 | 1` from `src/battle/duel/contracts/public-duel-state.ts` — existing prop, unchanged. Tokens `--selected` (#ffd580) and `--border` (#697895) from `src/styles/tokens.css` — read-only.
- **Errors:** none — pure presentation; no new failure path.
- **Invariants:**
  - For every render, `avatar-N.classList.contains("active") === lifePoints-N-element.classList.contains("active") === (turnPlayer === N)`; exactly one of the two players carries `active`.
  - `data-cy` values, DOM order (avatar-1, life-1, life-0, avatar-0) and placeholder-src behaviour are unchanged.
  - Legality/turn state remains engine-authoritative; this styling never determines legality.
  - No element gains or loses a `data-cy` (data-cy coverage test stays green).
- **Integration links:** none — single component + stylesheet, no process/host boundary crossed. Observe link = component test class assertions + manual checklist section.

## TDD

1. **Red** — add test `"avatar and life borders track the turn player"` to `tests/component/DuelRail.test.ts` (asserts the `active` class placement below). It fails: today `active` sits on the identity wrappers, not on img/LP. Also extend the first test to assert the wrappers no longer carry `active` — fails today too.
2. **Green** — move the `class:active` bindings in `DuelRail.svelte` per the contract; make CSS changes.
3. **Refactor** — none expected; keep green.

## Test plan

Run: `npm run test:component -- tests/component/DuelRail.test.ts` (Vitest, jsdom).

| Test | Input | Expect |
| ---- | ----- | ------ |
| `avatar and life borders track the turn player` (new) | render with `{...props, turnPlayer: 1}`; then `rerender({...props, turnPlayer: 0})` | With turnPlayer 1: `[data-cy="duel-player-avatar-1"]` and `[data-cy="duel-right-rail-life-points-1"]` have class `active`; `avatar-0`/`life-points-0` do not. After rerender to 0: inverted. Also both `[data-cy="duel-right-rail-opponent"]` and `[data-cy="duel-right-rail-player"]` never contain class `active`. |
| `renders turn, ordered identities, status and dots` (existing, extended) | unchanged props (`turnPlayer: 1`) | Existing assertions unchanged and green; add: `rail.querySelector('[data-cy="duel-right-rail-opponent"]')!.classList.contains("active")` is `false`, same for `duel-right-rail-player`. |
| all other existing tests | unchanged | Green untouched — placeholder src, LP tier classes, tween tests do not assert borders. |

## Impl steps

- [x] 1. Red: failing active-class tests
  - [x] 1.1 In `tests/component/DuelRail.test.ts`, inside `describe("DuelRail", …)` after the test `"life plates carry their state class"`, add:

    ```ts
    it("avatar and life borders track the turn player", async () => {
      const { rerender } = render(DuelRail, { ...props, turnPlayer: 1 as const });
      const active = (cy: string) =>
        document.querySelector(`[data-cy="${cy}"]`)!.classList.contains("active");
      expect(active("duel-player-avatar-1")).toBe(true);
      expect(active("duel-right-rail-life-points-1")).toBe(true);
      expect(active("duel-player-avatar-0")).toBe(false);
      expect(active("duel-right-rail-life-points-0")).toBe(false);
      expect(active("duel-right-rail-opponent")).toBe(false);
      expect(active("duel-right-rail-player")).toBe(false);

      await rerender({ ...props, turnPlayer: 0 as const });
      expect(active("duel-player-avatar-0")).toBe(true);
      expect(active("duel-right-rail-life-points-0")).toBe(true);
      expect(active("duel-player-avatar-1")).toBe(false);
      expect(active("duel-right-rail-life-points-1")).toBe(false);
      expect(active("duel-right-rail-opponent")).toBe(false);
      expect(active("duel-right-rail-player")).toBe(false);
    });
    ```

  - [x] 1.2 Run `npm run test:component -- tests/component/DuelRail.test.ts` — the new test must fail (wrapper divs carry `active` today, img/LP do not).
- [x] 2. Green: move `active` in the component, rewire the CSS
  - [x] 2.1 In `src/battle/app/components/DuelRail.svelte`: delete `class:active={turnPlayer === 1}` from the div `data-cy="duel-right-rail-opponent"` and `class:active={turnPlayer === 0}` from the div `data-cy="duel-right-rail-player"`; add `class:active={turnPlayer === 1}` to the img `data-cy="duel-player-avatar-1"` and to the p `data-cy="duel-right-rail-life-points-1"`; add `class:active={turnPlayer === 0}` to the img `data-cy="duel-player-avatar-0"` and to the p `data-cy="duel-right-rail-life-points-0"` — exactly as in the Interface contract template fragment.
  - [x] 2.2 In `src/styles/app.css` (~560–610): apply the CSS block from the Interface contract verbatim — remove `border: 2px solid transparent;` from `.duel-right-rail__identity`; delete the `.duel-right-rail__identity.active` rule; change the width cap factor `0.26` → `0.32`; avatar border → `4px solid var(--border)` plus new rule `.duel-right-rail__identity img.active { border-color: var(--selected); }`; LP border → `2px solid var(--border)` plus new rule `.duel-right-rail__life.active { border-color: var(--selected); }`; delete `border-color: currentColor;` from `.is-high`, `.is-mid`, `.is-low` (keep their `color:` lines). Update the rationale comment above the width-cap rule: replace "roughly a third" wording so it names the 0.32 cap, e.g. keep the existing explanation but end with "…the square is capped at 0.32 of `--stage-h`" — the comment must state the current factor.
  - [x] 2.3 Run `npm run test:component -- tests/component/DuelRail.test.ts` — whole file green.
- [x] 3. Manual full-HD fit check (plan A9)
  - [x] 3.1 Run `npm run dev` (port 4300), open Chromium at 1920×1080 (device toolbar, no scaling), start a duel via `#/free-play`. Verify: both avatars visibly larger than before; both identities plus the status band fit the rail with no vertical overflow/scroll; active player's avatar and LP borders are orange (#ffd580), the other player's grey (#697895); no border around either identity block; after ending the turn the orange side swaps.
  - [x] 3.2 (not triggered — no overflow at 0.32, factor stays 0.32) If the rail overflows vertically at 0.32: lower the factor in the `width: min(...)` rule in steps of 0.01 until it fits, update the rationale comment to the final value, and record the actual factor in the commit message body.
- [x] 4. Manual checklist + gates
  - [x] 4.1 Append to `artifacts/manual_test_checklist.md` (end of file):

    ```md
    ### Orange means active player in the right rail

    - [ ] Start a duel and look at the right rail: nothing draws a border around an avatar-and-LP block as a whole any more.
    - [ ] The player whose turn it is has an orange border on their avatar picture **and** on their LP plate; the other player's avatar and LP borders are grey.
    - [ ] End the turn: the orange borders move to the other player, the grey to you. Only ever one side is orange.
    - [ ] Take LP into the yellow (≤4000) and red (<2000) tiers: the LP number changes colour but its border stays governed by whose turn it is.
    - [ ] On a full HD window (1920×1080), both avatar images are visibly bigger than before, and the rail still shows both identities and the status text without anything spilling out.
    ```

  - [x] 4.2 Run `npm run test:component` — green.
  - [x] 4.3 Run `npm run check:headless` — green (types, lint, data-cy coverage, boundaries).

## Outputs

- Files touched: `src/battle/app/components/DuelRail.svelte`, `src/styles/app.css`, `tests/component/DuelRail.test.ts`, `artifacts/manual_test_checklist.md`.
- Behaviour change: active-player indication moves from an identity-block outline to orange avatar+LP borders (grey when inactive); LP tier classes no longer tint the LP border; avatar/LP width cap 0.26 → 0.32 of `--stage-h`.
- No public API, no migration, no config change.

## Validation

- [x] tests pass: `npm run test:component` and `npm run check:headless`, both exit 0.
- [x] manual check: step 3.1 performed on 1920×1080 Chromium; final width factor recorded if it deviates from 0.32.
- [x] no silent-failure swallow on a path this slice adds — none: no new runtime logic beyond class bindings; no `|| true`, empty catch, or discarded promise introduced.
- [x] app functional — duel starts, rail renders, turn swap recolours borders; no broken path from this slice.
- [x] commit msg draft: `feat(duel): mark the active player with orange avatar and LP borders, grow the rail avatars` (body notes RP1+RP2, the removed identity-block border, and the actual width factor if not 0.32).
