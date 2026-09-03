# ADR-071: Story screens consume the shell stage

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: shell, story presentation
> Amends: ADR-024 §5 (story responsiveness now obeys the shell-owned stage contract)

## Context

ADR-024 gives the shell ownership of one stage box and states that `body` never scrolls because the stage clips. Story screens retained older viewport sizing such as `min-height: 100svh`, plus `vh`/`vw` child dimensions. A story screen mounted inside the stage therefore sized itself against the browser viewport instead of its actual container. On short or scaled windows, background, characters, dialogue, and controls exceeded the clipped stage; the bottom disappeared.

Fifteen story Svelte files currently use `svh`, spanning narrative, map, shop, collection, results, overlays, and battle handoff. Fixing one screen leaves the ownership bug in every sibling.

## Decision

1. Shell remains sole owner of viewport measurement and stage geometry.
2. Story root consumes `width: 100%` and `height: 100%` of that stage. It uses two rows: in-flow header `auto`, screen body `minmax(0, 1fr)`.
3. Story screens size and position against the body container, not browser viewport units. Any retained viewport unit needs an inline reason proving browser viewport ownership.
4. Content-heavy screens scroll inside their body region. Narrative/map stages clip decorative layers inside their own container. `body` remains non-scrolling.
5. One full-width story header shell is reused across narrative, map, shop, and sibling story screens; title/objective slots may be absent per screen.

## Consequences

- Story UI scales with the same box as other domains; shrinking browser no longer cuts off dialogue bottoms.
- Fifteen components need a coordinated CSS migration, not a one-file patch.
- Content scrollbars may appear inside short stage bodies while global page remains fixed.
- Future story components cannot use `100svh` as a convenient full-screen shortcut.

## Alternatives rejected

- Patch NarrativeScreen overflow only: shop/map/overlay siblings retain identical nested-viewport risk.
- Let every story screen compute viewport bounds: duplicates shell policy and drifts across screens.
- Allow body scrolling: breaks ADR-024's stable stage and lets global chrome move.
- Scale the entire story DOM with a transform: text and pointer geometry blur, while long content still needs semantic scrolling.
