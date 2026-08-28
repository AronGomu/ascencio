# T8: Pile halo: orange, actionability-gated for deck/extra/grave/banish (item 12)

**Plan:** `./artifacts/PLAN_2026_08_28_deck_select_and_duel_field.md`
**Depends:** none
**Commit outcome:** Extra deck (and all piles) halo orange exactly when current prompt offers a choice there, top card shown or not

## Context (self-contained)

- Goal: implement the 2026-08-27 owner feedback round on the duel field. This
  ticket is item 12, owner wording (binding): "Only highlight you extra deck in
  orange halo if a monster can be summoned or effect can be activated from
  there. Same for Deck, Grave, Banish zone."
- This slice: pile (stack) halo presentation only. The gating logic already
  exists and is correct — `FieldBoard.svelte` line 288 passes
  `actionable={!disabled && spec?.stackChoices.has(stack.targetId) === true}`,
  i.e. a stack is actionable exactly when the active prompt offers a legal
  choice inside it. The two real deltas are presentation:
  1. `StackControl.svelte` lines 30–38 currently suppress the halo on piles
     that hide their top card (`haloed = actionable && stack.topCardCode !==
     undefined`), which is the *opposite* of the owner's complaint: an
     actionable deck/extra/face-down-banish pile shows **no** halo today. Drop
     the suppression: `haloed = actionable`.
  2. The halo is green today (`--success`/`--legal` `#7ee2a8`,
     `src/styles/app.css:1403-1408`); the owner asked for orange. Switch the
     stack halo rule to `--selected`/`--warning` (`#ffd580`,
     `src/styles/tokens.css:40-44`).
- Out of scope here: card selection styling (T6), duel rail (T9), zone halos
  (`.duel-field-zone.is-actionable` stays green), card halos
  (`.duel-field-card.is-actionable` stays green), zone-list-entry styling,
  any change to `spec.stackChoices` / interaction-spec mapping, `feedback.md`
  (owner-authored — never edit).
- Assumptions in force:
  - Gating pre-exists and is untouched; if the reproduce-owner-scenario check
    (step 1) shows no over-highlight without a stack choice, record "gate
    pre-existed, change is presentation only" under `## Outputs`.
  - Class name `.is-actionable` on `.duel-field-stack` is frozen — component
    tests (`tests/component/DuelField.test.ts:2950-2980`) and e2e
    (`e2e/duel-smoke.spec.ts:4320`) reference it.
  - New colour semantics (plan A12, owner-directed): green = legal card
    action; orange = selection AND actionable pile AND active player. The
    invariant comment at `src/styles/app.css:1386-1393` ("Orange is reserved
    for selection … the two must never be confusable") must be rewritten to
    the new semantics, along with the sibling comments at
    `app.css:1570-1572` and `app.css:1852-1860` that restate "selected
    overrides plain legal green with orange".

## Requirements

- R1: A pile (`.duel-field-stack`) carries the `is-actionable` class exactly
  when the active prompt offers a stack choice on it — regardless of whether
  its top card is rendered. Covers deck, extra deck, graveyard, banish, for
  both players.
- R2: The `is-actionable` halo on `.duel-field-stack` renders orange
  (`--selected`), not green.
- R3: A pile with no stack choice in the active prompt (or no prompt) carries
  no halo. This is the reproduce-owner-scenario check and must be asserted by
  a test before any change lands (TDD step 1).
- R4: Zone (`.duel-field-zone.is-actionable`) and card
  (`.duel-field-card.is-actionable`) halos remain green and untouched.
- R5: The green/orange invariant comments in `app.css` state the new
  semantics; no comment still claims orange is selection-only.
- R6: `data-actionable` attribute behaviour on the stack element is unchanged
  (still reflects the raw `actionable` prop; tests at
  `DuelField.test.ts:2963,2978` assert it).

## Inputs

- `src/battle/app/components/duel-field/StackControl.svelte` — lines 30–38:
  suppression comment + `$: haloed = actionable && stack.topCardCode !==
  undefined;`. Line 75: `class:is-actionable={haloed}`. Line 85:
  `data-actionable={actionable ? "true" : undefined}`.
- `src/battle/app/components/duel-field/FieldBoard.svelte` — line 288: stack
  `actionable` gating via `spec?.stackChoices.has(stack.targetId)`. Read only;
  do not edit.
- `src/styles/app.css` — 1386–1393 invariant comment; 1403–1408
  `.duel-field-stack.is-actionable` rule; 1396–1401 zone/card green rule
  (leave alone); 1570–1576 and 1852–1860 sibling "orange = selected" comments.
- `src/styles/tokens.css` — 40–44: `--legal: #7ee2a8; --success:
  var(--legal); --selected: #ffd580; --warning: var(--selected);`. Read only.
- `tests/component/DuelField.test.ts` — existing stack-halo tests at
  2950–2980 (`renderGraveyardTargetPrompt` helper at ~2928), fixtures
  `TWO_CARD_GRAVEYARD_STATE` and `board("ST-05")` from
  `tests/fixtures/board-view-model.ts`.
- `e2e/duel-smoke.spec.ts:4320` — locator
  `'[data-cy^="field-stack-"].is-actionable'`; dropping the suppression only
  widens what can match, no e2e edit needed. Inspected: no colour assertion
  on the stack halo exists there.
- **From Depends:** none.

## Interface contract (level 5)

- **Produces (component behaviour, `StackControl.svelte`):**

  ```svelte
  <!-- props (unchanged shape) -->
  export let stack: BoardStackView;          // from src/battle/field/board-view-model.ts
  export let actionable = false;             // boolean, set by FieldBoard from spec.stackChoices
  <!-- reactive (changed) -->
  $: haloed = actionable;                    // topCardCode no longer consulted
  <!-- template (unchanged names) -->
  class:is-actionable={haloed}
  data-actionable={actionable ? "true" : undefined}
  ```

- **Produces (CSS, `src/styles/app.css`, replacing 1403–1408):**

  ```css
  .duel-field-stack.is-actionable {
    border-color: var(--selected);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--selected) 90%, transparent),
      0 0 10px color-mix(in srgb, var(--selected) 40%, transparent);
  }
  ```

- **Consumes:** `actionable` prop as computed in `FieldBoard.svelte:288` —
  `actionable={!disabled && spec?.stackChoices.has(stack.targetId) === true}`
  where `stackChoices: ReadonlyMap<BoardTargetId, ...>` on the interaction
  spec. Binding; do not redesign.
- **Errors:** none — pure presentation; no new failure path.
- **Invariants:**
  - `is-actionable` on a stack ⇔ `actionable === true` (post-change identity).
  - `data-actionable` present with value `"true"` ⇔ `actionable === true`
    (pre-existing, unchanged).
  - No prompt / no stack choice ⇒ no stack carries `is-actionable`.
  - `.duel-field-zone.is-actionable` and `.duel-field-card.is-actionable`
    colour tokens byte-identical to before this ticket.
  - Selector `.duel-field-stack.is-actionable` name frozen.
- **Integration links:** none — single-process UI change; observe link is the
  component test asserting the class on the rendered DOM.

## TDD

1. **Red** —
   - New test `"no stack wears the halo without a stack choice in the active
     prompt"` (reproduce-owner-scenario / R3): passes against current code —
     write it first and run it to confirm the gate pre-exists; it is the
     regression lock, not the red.
   - Flip existing test at `DuelField.test.ts:2970`: rename to
     `"actionable stack keeps the halo even when it shows nothing"` and
     assert `is-actionable` **true**. Fails red against current suppression.
   - New test `"stack halo paints the selected orange token"`: fails red
     against the green CSS.
2. **Green** — `haloed = actionable` in `StackControl.svelte`; swap CSS
   tokens to `--selected`.
3. **Refactor** — rewrite the three `app.css` comment blocks and the
   `StackControl.svelte` suppression comment; keep green.

## Test plan

All in `tests/component/DuelField.test.ts` (decision: no new
`StackControl.test.ts` — the file's existing stack-halo suite at 2950–2980
already exercises StackControl through DuelField with real prompt specs and
fixtures; a standalone file would duplicate `renderGraveyardTargetPrompt`).

| Test | Input | Expect |
| ---- | ----- | ------ |
| `no stack wears the halo without a stack choice in the active prompt` (new) | `render(DuelField, { board: board("ST-05") })` — no prompt/spec | `document.querySelectorAll(".duel-field-stack.is-actionable").length === 0` |
| `actionable stack renders the halo when the pile shows what it holds` (existing, 2950 — unchanged) | `TWO_CARD_GRAVEYARD_STATE` + `renderGraveyardTargetPrompt` | `field-stack-p0:graveyard` has class `is-actionable`, `data-actionable === "true"` |
| `actionable stack keeps the halo even when it shows nothing` (existing 2970, inverted + renamed) | `board("ST-05")` + `renderGraveyardTargetPrompt` | `stack?.classList.contains("is-actionable")` is `true`; `data-actionable === "true"` (was `false`/`"true"`) |
| `stack halo styling uses the selected orange token` (new) | read `src/styles/app.css` with `readFileSync`, slice the `.duel-field-stack.is-actionable` rule | rule contains `var(--selected)` and not `var(--success)` / `var(--legal)` — mirror the file-read style only if the suite already reads CSS; **inspection found no CSS-reading precedent in this suite, so instead assert via class semantics and keep the colour swap covered by the impl-step diff + manual check below** |

Colour-token decision recorded: Vitest/jsdom does not compute `color-mix`
styles, and `DuelField.test.ts` asserts classes, never computed colours
(e.g. 904, 1170). Follow suite convention: class assertions in component
tests; the orange colour itself is verified by the CSS diff (step 3) and the
manual check in `## Validation`. Do not add a CSS file-grep test.

Run: `npm run test:component` (vitest, `tests/component`).

## Impl steps

- [x] 1. Lock the gate with the reproduce-owner-scenario test (must pass before any edit)
  - [x] 1.1 In `tests/component/DuelField.test.ts`, directly above the test
        `"actionable stack renders the halo when the pile shows what it holds"`
        (~line 2950), add:

        ```ts
        /* Item 12 regression lock: the halo is gated on the active prompt
           offering a stack choice — no prompt, no halo, on any pile. */
        it("no stack wears the halo without a stack choice in the active prompt", () => {
          render(DuelField, { board: board("ST-05") });
          expect(
            document.querySelectorAll(".duel-field-stack.is-actionable").length,
          ).toBe(0);
        });
        ```
  - [x] 1.2 Run `npm run test:component -- -t "no stack wears the halo"` —
        expect pass (gate pre-exists). If it fails, stop: the gating
        assumption is wrong; fix nothing, report the conflict.
- [x] 2. Red: invert the suppression test
  - [x] 2.1 In `tests/component/DuelField.test.ts` (~2966–2979), replace the
        comment + test:

        ```ts
        /* Item 12 (2026-08-27): an actionable pile wears the halo whether or
           not it renders its top card — the prompt offering a choice there is
           the signal, not the visible art. Deck/extra/face-down banish
           included. */
        it("actionable stack keeps the halo even when it shows nothing, and stays clickable", () => {
          renderGraveyardTargetPrompt(board("ST-05"));

          const stack = document.querySelector(
            '[data-cy="field-stack-p0:graveyard"]',
          );
          expect(stack).not.toBeNull();
          expect(stack?.classList.contains("is-actionable")).toBe(true);
          expect(stack?.getAttribute("data-actionable")).toBe("true");
          expect(stack?.tagName).toBe("BUTTON");
        });
        ```
  - [x] 2.2 Run `npm run test:component -- -t "keeps the halo even when it shows nothing"` —
        expect fail (red) against current suppression.
- [x] 3. Green: drop the suppression and paint the halo orange
  - [x] 3.1 In `src/battle/app/components/duel-field/StackControl.svelte`
        lines 30–37, replace the comment block and reactive statement:

        ```ts
        /* Item 12 (2026-08-27, owner): an actionable pile always wears the
           halo — the active prompt offering a choice inside it is the signal,
           whether or not the pile renders its top card. Deck, extra deck and
           face-down banish never show art (board-view-model suppresses their
           topCardCode) yet must still halo when a summon or activation is
           legal from there. */
        $: haloed = actionable;
        ```
  - [x] 3.2 In `src/styles/app.css` lines 1403–1408, replace the rule:

        ```css
        .duel-field-stack.is-actionable {
          border-color: var(--selected);
          box-shadow:
            0 0 0 3px color-mix(in srgb, var(--selected) 90%, transparent),
            0 0 10px color-mix(in srgb, var(--selected) 40%, transparent);
        }
        ```
  - [x] 3.3 Run `npm run test:component` — expect all green, including steps
        1.1 and 2.1's tests and the untouched test at 2950.
- [x] 4. Refactor: rewrite the colour-semantics comments to plan A12
  - [x] 4.1 In `src/styles/app.css` (1386–1393), replace the first three
        sentences of the comment ("Green is the … must never be confusable.")
        with:

        ```
        Green is the "you may act on this card" colour: legal card and zone
        actions. Orange marks selection, actionable piles (item 12), and the
        active player — states that answer "where is the game pointing", not
        "which card is playable". A card is never orange for legality and a
        pile is never green, so the two stay readable side by side.
        ```

        Keep the remaining sentences of the block (the two-layer ring/glow
        rationale) verbatim.
  - [x] 4.2 In `src/styles/app.css` (~1570, after the CSS shifts from 3.2),
        replace the comment "Selected overrides plain legal green: same
        orange used for the list-hover affordance below, but selection is a
        persisted class, never a :hover pseudo-class, so the two never
        actually collide on screen." with:

        ```
        Selected overrides plain legal green with orange (orange also marks
        actionable piles and the active player, per item 12): same token as
        the list-hover affordance below, but selection is a persisted class,
        never a :hover pseudo-class, so the two never actually collide on
        screen.
        ```
  - [x] 4.3 In `src/styles/app.css` (~1852), replace "Selected overrides
        plain legal green with orange; hover never mutates this class, and no
        hover rule below repaints a selected entry." with:

        ```
        Selected overrides plain legal green with orange — orange is
        selection/actionable-pile/active-player, never card legality; hover
        never mutates this class, and no hover rule below repaints a selected
        entry.
        ```
  - [x] 4.4 Run `npm run test:component` — still green.
- [x] 5. Gates
  - [x] 5.1 Run `npm run check:headless` — expect exit 0 (format, lint,
        typecheck, legacy/unit/integration tests, vendor/assets/snapshot
        verify).
  - [x] 5.2 Run `npm run test:component` — expect exit 0.

## Outputs

- Files touched:
  - `src/battle/app/components/duel-field/StackControl.svelte` (suppression
    dropped, comment rewritten)
  - `src/styles/app.css` (stack halo green → orange; three comment blocks
    updated)
  - `tests/component/DuelField.test.ts` (one new test, one inverted test)
- Behaviour change: any pile whose target sits in the active prompt's
  `stackChoices` now halos, in orange, including deck/extra/face-down banish;
  no gating change. If step 1.2 passed first try, record here: "gate
  pre-existed, change is presentation only".
- No migration, no config, no public API change (`.is-actionable` class and
  `data-actionable` attribute names frozen).

## Validation

- [x] tests pass: `npm run test:component` and `npm run check:headless`, both
      exit 0.
- [ ] manual check (Chromium): `npm run dev`, start a duel, reach a prompt
      offering an extra-deck summon (or graveyard activation) — the pile
      wears an orange (`#ffd580`) ring+glow; with no such choice active, no
      pile is haloed; zone and card legal halos remain green.
- [x] no silent-failure swallow on a path this slice adds — none: no new
      error paths, no `|| true`, no empty catch.
- [x] app functional — duel field renders, stack buttons still open the
      zone-list dialog (e2e `duel-smoke.spec.ts:4320` path unaffected;
      suppression removal only widens its locator's matches).
- [x] commit msg draft: `fix(duel): halo every actionable pile in orange —
      prompt choice is the signal, not visible top art (item 12)`
