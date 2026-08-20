# ADR-002: Universal `data-cy` Selector Contract

> Status: accepted; planned
> Decided: 2026-08-08
> Owners: presentation architecture
> Plan: [`../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md`](../../artifacts/PLAN_2026_08_08_duel_field_ux_overhaul.md) — T1

## Context

Component and browser tests select DOM by ARIA role plus visible text. Role queries prove accessibility. They also break on every copy edit, and they cannot address elements with no role and no text — wrappers, art frames, halos, pills, chips.

The duel-field UX overhaul deletes or moves nearly every panel. Each move rewrites the selectors of the tests around it. Cost per ticket is high and the failures read as product regressions rather than selector drift.

Existing state: zero `data-cy` attributes in `src/`, 1869-line Playwright spec, three component specs, all role-and-text based.

## Decision

1. Every HTML element rendered by a Svelte component under `src/battle/app/` carries `data-cy`.
2. `data-cy` acts as the element's variable name: kebab-case, describes role not styling, unique inside a rendered document, stable across renders.
3. Loop-rendered elements suffix the item's stable id, for example `` data-cy={`field-card-${card.id}`} ``.
4. Enforcement is a static unit test, `tests/unit/data-cy-coverage.test.ts`, scanning `src/battle/app/**/*.svelte` for element open tags with no `data-cy` and for repeated static values.
5. The scanner covers `<svelte:element>` and skips component tags, `<svelte:head>` contents, script blocks, style blocks and comments.
6. Structural tests select by `data-cy`. Accessibility tests keep selecting by role and accessible name.
7. `data-cy` never carries behaviour. No CSS hook, no runtime read.

## Alternatives rejected

- **Interactive elements only.** Cheaper, but leaves the halo, art frame and pill wrappers unaddressable — exactly the elements this overhaul adds.
- **`data-testid`.** Same mechanics, different name. `data-cy` chosen because the user asked for it by name.
- **Render-based coverage gate.** Only reaches mounted branches; a static scan reaches every `{#if}` arm.

## Consequences

- Retrofit touches all sixteen existing Svelte files once, including three that later tickets delete. Accepted: the gate stays green at every commit.
- Static scanning needs a real tokenizer, not a regex: `onclick={() => f()}` contains `>` inside an attribute value.
- Selector churn from copy edits disappears. Selector churn from renaming a `data-cy` becomes a deliberate, reviewable act.
- Markup grows by one attribute per element. No runtime cost.
