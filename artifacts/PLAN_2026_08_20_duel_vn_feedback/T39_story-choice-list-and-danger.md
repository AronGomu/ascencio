# T39: Choice list and danger styling

**Plan:** `./artifacts/PLAN_2026_08_20_duel_vn_feedback.md`
**Depends:** T1
**Commit outcome:** Every multiple choice in the story — narrative branches and the shopkeeper menu — uses one centred component with large buttons, and cancelling actions are red.

## Context (self-contained)

- Goal: land `feedback-duel.md` and `feedback-vn.md` as one ticket chain on `main`. This ticket is `feedback-vn.md` general items 4 and 5.
- This slice: a story-local shared choice component plus a danger class, applied to every existing choice surface.
- Out of scope here: the duel's buttons, the shell's menus, new story content.
- Assumptions in force: the component is story-local (`src/story/components/`), not a shell primitive; "red" is a story danger class, applied to cancel/leave/back-out actions such as "Leave shop".

## Requirements

- One `ChoiceList` component renders a vertical list of large, centred choice buttons.
- The narrative choice screen and the shopkeeper greeting both use it.
- A choice may be marked as the cancelling action and then renders with the danger style.
- Keyboard order follows visual order, and the first choice receives focus on mount.
- Existing `data-cy` values for those choices keep resolving so their tests do not silently stop covering the flow.

## Inputs

- `src/story/screens/NarrativeScreen.svelte` — the authored branch choices (`ChoiceId = "trust-rin" | "challenge-rin" | "observe-first"`, `data-cy` prefixed `story-narrative-`).
- `src/story/shop/ShopGreetingScreen.svelte` — buy / sell / leave (`data-cy` prefixed `story-shop-greeting-`), where "Leave shop" is the cancelling action.
- `src/story/styles.css:34-43` — the story's base button rule (44px floor, accent background); add the danger variant beside it using `--danger` from `src/styles/tokens.css`.
- `src/story/model/story-state.ts` — `ChoiceId`.
- `tests/unit/global-styles.test.ts` — forbids raw colours in the stylesheet; use the token.
- Tests: `tests/component/story/`.

## From Depends

- T1 changed documentation only; `src/` is unchanged from `main`.

## TDD

1. **Red** — add `tests/component/story/choice-list.test.ts` with the cases below.
2. **Green** — write `ChoiceList.svelte`, add the danger class, and adopt both screens.
3. **Refactor** — delete the per-screen choice markup and styles that the component replaces.

## Test plan

| Test                                                | Input                           | Expect                                             |
| --------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `renders one button per choice in order`            | three choices                   | three buttons, DOM order equal to input order      |
| `focuses the first choice on mount`                 | mount                           | `document.activeElement` is the first button       |
| `invokes the choice callback with its id`           | click the second                | callback called once with that id                  |
| `a cancelling choice carries the danger class`      | `{ id: "leave", danger: true }` | that button has the story danger class             |
| `narrative choices use the component`               | mount the narrative screen      | the choice buttons are the component's             |
| `shop greeting uses the component`                  | mount the greeting              | buy / sell / leave rendered by it; leave is danger |
| `existing data-cy values still resolve`             | both screens                    | the previous `data-cy` values are all present      |
| `the danger style uses the token, not a raw colour` | `story/styles.css`              | contains `var(--danger)`, no hex literal           |

## Impl steps

- [ ] 1. Add the failing component test; run `npx vitest run tests/component/story/choice-list.test.ts`.
- [ ] 2. Create `src/story/components/ChoiceList.svelte` with props `choices: readonly { id: string; label: string; danger?: boolean; dataCy: string }[]`, `onchoose: (id: string) => void`, and a container at `data-cy="story-choice-list"`.
- [ ] 3. Style it in `src/story/styles.css`: centred column, `width: min(28rem, 100%)`, large buttons (`min-height: 3.25rem`, `font-size: var(--text-md)`), and a `.story-danger` rule using `var(--danger)`.
- [ ] 4. Focus the first button on mount, matching the pattern in `TitleScreen.svelte`.
- [ ] 5. Replace the narrative screen's choice markup with `ChoiceList`, passing each existing `data-cy` value through so its tests keep resolving.
- [ ] 6. Replace the shop greeting's three buttons with `ChoiceList`, marking "Leave shop" as `danger: true`.
- [ ] 7. Apply `.story-danger` to the other cancelling actions in the story: the sell screen's cancel and the impact dialog's cancel if present.
- [ ] 8. Delete the replaced per-screen styles.
- [ ] 9. Run `npx vitest run tests/component/story tests/unit/global-styles.test.ts tests/unit/data-cy-coverage.test.ts`.

## Outputs

- Files touched: `src/story/components/ChoiceList.svelte` (new), `src/story/screens/NarrativeScreen.svelte`, `src/story/shop/ShopGreetingScreen.svelte`, `src/story/styles.css`, `tests/component/story/choice-list.test.ts` (new).
- Behaviour change: choices look and behave the same everywhere; cancelling actions are red.
- Migration/config: none.

## Validation

- [ ] `npx vitest run tests/component/story/choice-list.test.ts` passes
- [ ] `npx vitest run tests/unit/global-styles.test.ts` passes
- [ ] `npm run check:headless` passes
- [ ] manual: a narrative branch and the shopkeeper menu look identical in layout; Leave shop is red
- [ ] app functional — every choice still advances the story
- [ ] commit msg draft: `feat(story): one centred choice component and a red cancelling style`
