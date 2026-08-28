# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One primary user: a **single player, alone, offline, at a desktop browser**, playing a story campaign the way the older Yu-Gi-Oh! handheld games were played — a long sitting, no opponent waiting, no clock, no ladder.

They know Yu-Gi-Oh! well enough that the rules are not the interesting part. What they came for is the story, and duels are how the story advances. They are not a competitive player looking for a testing client, and not a newcomer learning what a Normal Summon is.

Phone is a real secondary surface but a lesser one: desktop is where the product is designed and judged, and phone must work without dictating the design. A duel on a portrait phone plays on a stage rotated 90° rather than a second field layout (ADR-024).

The audience beyond that one player is deferred, not absent — see `## Capabilities and Constraints`.

## Product Purpose

An offline single-player Yu-Gi-Oh! **story game**: an authored, chaptered narrative campaign in which every duel is a scene, played on the authoritative OCG rules engine.

**The story is the product.** Confirmed by the owner: if the campaign were cut, the product would be dead; the duel simulator serves the narrative rather than the other way round. This is the ordering rule for every future trade-off — the duel client is world-class infrastructure in service of a story, and when the two conflict, the story's needs win.

Success is a player finishing a chapter and having been moved and argued with by it. Chapter 1 targets **at least 20 key duels** and works as a standalone game; the current cast supplies about 12, and the canon's own preferred fix is rematches over new faces, because an opponent seen again is more dramatic than a new one (`docs/story/chapters/01-duel-monsters.md`).

## Positioning

Confirmed with the owner: what no neighbouring product can truthfully copy is **an authored philosophical story whose thesis is enforced by the world's own rules, running on the real OCG engine, offline and single-player**.

The competitive set fails it in different directions. EDOPro and Dueling Book are rules-accurate but storyless — a client, not a game. Master Duel and Duel Links are live-service, online, monetised, and their story content is a tutorial wrapper around a card economy. The older titles this project is a love letter to — *Spirit Caller*, *The Duelists of the Roses*, *Nightmare Troubadour*, the *World Championship* series — had the story shape but not a modern legal engine.

The mechanism, specifically: the fiction's rules are not flavour text, they are systems.

- A **god banned physical violence as a means of acquisition**, so every conflict is necessarily resolved by play. A duel engaged over a conflict cannot be refused; refusing is losing, and the stake is ceded.
- **Cheating is not forbidden.** It is sanctioned only when discovered and *demonstrated* — if a player establishes by binding logical argument that the other is cheating, the cheater loses automatically. A failed accusation costs time, reputation, and the information you revealed by making it. The duel is therefore an epistemological confrontation as much as a technical one.
- **Magic is hard magic** — fixed, knowable laws with explicit costs. Whoever treats magic as unfathomable mystery is wrong *inside the fiction*, and whoever studies it is right. The epistemological conflict is the narrative engine, not a metaphor for one.
- **Spirits imprint into manufactured cards** across print runs. Not every card is imprinted, so scarcity is real, so there is a market, so there is covetousness — the in-game economy is a consequence of the metaphysics rather than a shop bolted on.

Foundation: objectivist (Ayn Rand) philosophy at every level — aesthetics, values, and the structure of the conflicts. The hero does not begin virtuous; he progresses toward virtue across chapters. `docs/story/scenario/02-philosophy.md` and `03-world-rules.md` own these facts.

## Operating Context

- **Single sitting at a desktop browser, offline.** No server, no account, no network dependency at play time. All rules, cards, scripts and art are local.
- **Two modes, deliberately separate** (ADR-051). The main menu is the front door: New Game, Continue, Load, Settings, then Free Play last.
  - **Story** — the campaign. A save owns its decks, its collection and its money.
  - **Free Play** — pick two decks and duel now, no narrative, no save.
- **Routes carry their world.** `#/story/decks` and `#/free-play/decks` are different libraries; a bookmarked link cannot open the wrong one.
- **Reading, choosing, building, duelling** cycle: the visual novel presents a scene and choices, a duel is handed off with a stake attached, the result returns to the story, and the economy and collection move.
- **One chapter = one Yu-Gi-Oh! era**, each introducing that era's mechanic and raising the story's complexity by one notch: 1 Duel Monsters (Fusion, Ritual), 2 GX, 3 5D's (Synchro), 4 ZEXAL (Xyz), 5 ARC-V (Pendulum), 6 VRAINS (Link). Each chapter has to stand alone as a game.
- **Chapter 1 is a duel academy** — first year, ~15–16 years old, a gentle introduction, a school year, a circle of friends, a climax against a departing third-year. The main plot is **ZAPS**: a corporation selling students performance at the cost of their health.

## Capabilities and Constraints

**Shipped and confirmed by the code.**

- The **rules authority is Project Ignis `ygopro-core`**, vendored as `ocgcore-wasm@0.1.2` and permanently frozen. It alone decides legality, effects and results.
- The engine lives in a **dedicated Web Worker** and never touches the main thread. The UI receives clone-safe typed domain data; raw core messages and indexes stay in the Worker; **opponent hidden information is removed before crossing the boundary**. Presentation state never determines legality.
- **Story economy is real and shipped**: a shop selling sets with rarity and pricing (ADR-035), a card-ownership invariant (ADR-050), and decks buildable only from owned cards (ADR-049). Progress and money live in story state (ADR-033).
- **Deck editor**: click-first editing (ADR-041), autosave recording every command (ADR-044), the whole card database as runtime catalog (ADR-043), three panels on desktop and a single-panel tabbed layout in portrait.
- **Persistence** is IndexedDB (metadata, saves, decks, debug runs) plus Cache Storage (images). Settings survive in `localStorage` under `ygo.ui.v3`.
- **One layout law**, computed in `src/shell/stage-layout.ts` and read by every domain: ≥1024px is a centred 16:9 stage, below that portrait or landscape mobile. `body` never scrolls; the stage clips.
- **Production duels shuffle normally.** Deterministic inputs exist for tests and diagnostics only.
- **Architecture is a modular monolith** with machine-enforced boundaries: four public entries (`src/shell`, `src/story`, `src/deck-editor`, `src/battle`) plus the shared `src/decks` library, checked by ESLint zones and `tests/unit/domain-boundaries.test.ts`. Domains load on demand under per-domain byte budgets enforced by `npm run build:verify`.
- **Every rendered element carries a `data-cy` role attribute**, unique per document, enforced by `tests/unit/data-cy-coverage.test.ts`. Any new UI inherits this contract.

**Binding constraints.**

- **Deployment is private-only, and the build enforces it.** `docs/architecture/07-governance/licensing-and-distribution.md` records why: `ygopro-core` is AGPL-3.0-or-later with unresolved source-availability obligations, BabelCDB redistribution terms are unverified, card images carry no redistribution right from any provider, and Yu-Gi-Oh! names, text, artwork and characters are Konami/Shueisha IP. The Vite package requires explicit `private` build mode, writes `PRIVATE_DEPLOYMENT_ONLY.txt`, and refuses an ordinary production build while the active-image manifest says redistribution is unapproved. **Nothing in future work may weaken this gate, and no work should assume it has cleared.**
- **Intent is eventual public release as a fan game, once and only once those legal blockers clear.** Confirmed with the owner. Design may assume a real audience someday; the build pipeline may not.
- The product is a **fan game with 100% original characters and story**, a parallel universe with no canon link to the official Yu-Gi-Oh! universe.
- The **engine binary, loader resolution and vendor manifest are permanently frozen.** Engine and Project Ignis assets are pinned and activated as one verified snapshot.
- Synchronous core callbacks use preloaded memory and perform no async I/O.
- **Terminology is the game's, not a synonym of it**: duel, duelist, deck, hand, field, zone, phase, Life Points, Extra Deck, Main Deck, Side Deck, summon, set, chain. `docs/GLOSSARY.md` is the shared vocabulary and is kept current.

**Explicitly undecided — do not invent answers.**

- The **shipped visual-novel content contradicts the canon.** `src/story/content/prologue.ts` still ships prototype characters (Rin, Kael), choices and locations that predate `docs/story/` and are superseded by it. Realigning it touches state types, save envelopes, encounter ids, handoff labels and their tests — a round of its own, not yet done.
- The canon's own backlog is open at `docs/story/open-questions.md`: the exact ZAPS mechanism, the corporation's real name, Chapter 1's act structure, the identity of the card giver, Fynn's own card/spirit, and how a "multi against one" duel becomes playable rules. Ten items, all unanswered.
- **Casting is one sheet deep.** Fynn is complete; the nerd is sketched; the girl, the rival, the senior, the dean, three teachers, the shopkeeper and the ZAPS boss are named roles without sheets.
- Story systems beyond what is listed above, progression design, and multiplayer are out of scope.

## Brand Commitments

- **Working name:** YGO Story Duel Simulator. Repository and package are both `ascencio`. A final product name is undecided.
- **Canon language is English.** The source bible was authored in French on 22 August 2026 and translated; the original is preserved verbatim at commit `e411d03`.
- **Tone references, stated by the owner and binding**: *Spirit Caller*, *The Duelists of the Roses*, *Nightmare Troubadour*, the *World Championship* series. These are the felt register — an offline handheld story game — not a mandate to copy their pixel art.
- **The story must generate credible, regular pretexts for playable duels.** A scene that cannot become a duel is doing the wrong job.
- **`docs/story/` is canon and owns runtime content** (ADR-053). Runtime content derives from it and never contradicts it. Every fact has exactly one owning document.
- **`feedback*.md` files are owner-authored input, never a work product.** They record what was actually asked. Read, cite, leave byte-identical.
- Objectivism is the substrate, and there is a stated writing discipline that goes with it: show that the hero's laziness costs *him*, never that it is unkind to others, or the work implicitly validates the morality it means to refute.

## Evidence on Hand

**Real and usable.**

- `docs/story/` — the authored canon: concept, philosophy, world rules, Chapter 1, a complete protagonist sheet, the character creation grid, and the open-questions backlog.
- A **working three-domain application** on trunk: duel simulator, deck editor and visual novel under one shell, all reachable from `index.html`. The three-UI restructure completed 2026-08-15, tagged `restructure-complete`.
- 53 ADRs in `docs/ADR/` recording every accepted decision with its shipping commit.
- A **verified asset snapshot**: engine, card database, card scripts, Project Ignis strings, card images and set images, each with acquisition and verification scripts under `scripts/`.
- Full test surface: unit, component, integration, Playwright E2E and a separate acceptance config, gated by `npm run check`.
- `artifacts/manual_test_checklist.md` — durable human test steps for every shipped slice.
- `artifacts/DESIGN_DIRECTIONS_20.html` — twenty candidate visual worlds derived from this canon, each applied to all three surfaces. Exploratory; **no direction is chosen**.
- `artifacts/DESIGN_REF_2026_08_22_spirit_caller/` — reference research on *Spirit Caller*'s visual identity and UI screens.

**Absences that future work must not fabricate.**

- **No players, no playtests, no feedback from anyone but the owner.** No metrics, no retention data, no reviews, no press, no testimonials, no community.
- **No release, no release date, no distribution channel, no pricing.** The product has never been public and cannot be until the legal blockers clear.
- **No original card art, no character art, no music, no voice.** The card images are third-party assets with no redistribution right.
- **No chosen visual direction and no DESIGN.md.** The incumbent look in `src/styles/tokens.css` is what shipped, not what was decided.
- Chapters 2–6 are a structural table, not written material.

## Product Principles

1. **The story is the product; the engine serves it.** When narrative need and duel-client convenience conflict, the narrative wins. The owner confirmed the ordering: cut the story and the product is dead.
2. **The engine is the only authority, and the boundary is absolute.** Legality, effects and results come from `ygopro-core` in the Worker. Presentation never decides a rule, and opponent hidden information never crosses the boundary — not for a highlight, not for an animation, not for an opponent's benefit.
3. **The world's rules are systems, not flavour.** Cheating that can be caught, conflicts that cannot be refused, magic with knowable costs, scarcity that comes from metaphysics. Anything that presents these as decoration has thrown away the thing that makes this product unlike its competitors.
4. **Offline, private, and complete.** No server, no account, no live service, no telemetry. Everything needed to play is local, and the private-only deployment gate holds until the legal blockers actually clear.
5. **One player, one long sitting, at a desk.** Design for depth and duration rather than for a session that has to survive interruption. Phone must work; phone does not get a vote.

## Accessibility & Inclusion

No formal standard has been established with the owner, and none is claimed. What the code already commits to, and what future work must not regress:

- **`prefers-reduced-motion` is honoured** across the shell, dialogs and the duel field — 18 call sites in `src/`.
- **Native semantic controls throughout.** Svelte owns all interactive UI as real DOM; the duel field is semantic elements with keyboard affordances, not a canvas. Keyboard pick-and-drop mutations exist and are what portrait tap-to-move is built on (ADR-024).
- **Every element carries a role-describing `data-cy`**, enforced by test. It is a test contract rather than an accessibility one, but it means every control has been named by its role.
- **Zone outlines and zone counts are user-controllable display settings**, defaulting on.

Open, and worth a decision before public release: no contrast target, no screen-reader pass, and no colour-blind review has been done. The duel field communicates state partly through colour halos (ADR-031), which is the most likely accessibility debt.
