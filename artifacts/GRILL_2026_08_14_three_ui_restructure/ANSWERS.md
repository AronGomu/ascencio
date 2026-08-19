# Grill: three-UI restructure

Goal: restructure/refactor repo per `docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md` — one app, one shell, three lazy UI domains (Duel Simulator, Deck Editor, Visual Novel), parallel worktree development, frozen OCG Core.

Output of this grill feeds `make-plan-aron` (plan + tickets + ADRs + architecture HTML).

## Round 1 — Restructure scope + module boundaries

Doc: [`round-1.html`](round-1.html)

| #   | Question                                                     | Answer | Precision |
| --- | ------------------------------------------------------------ | ------ | --------- |
| 1   | How far does this refactor plan go?                           | Structure + deck editor promoted to production domain | — |
| 2   | Do duel files physically move into `src/battle/` now?         | unanswered → re-asked round 2 | "What are duel files." → fact answered below |
| 3   | Does VN move into `index.html` in this plan?                  | Yes: move to `#/story`, delete `prototype.html` + reviewer specs | Single app, single build. Home page menu selects VN / duel simulator / deck builder. Each part keeps its own URL/path. |
| 4   | Where does the deck editor live after this refactor?          | Move `src/prototypes/deck-builder/` → `src/deck-editor/`, route `#/decks` | — |
| 5   | How are cross-domain import boundaries enforced?              | ESLint `no-restricted-imports` zones + unit test asserting domain public API | — |
| 6   | Does this plan change persistence?                            | Rename to production DBs with one-time migration of existing local decks | — |
| 7   | Is the story-to-duel handoff implemented in this plan?         | Full handoff incl. local deck dispatch into the Worker | "We go all in; set up everything in the same long implementation." |
| 8   | What does the user see when the app opens?                    | Title/home hub with three entries; duel flow at `#/duel` | — |
| 9   | Global chrome: persistent nav or per-domain exit?             | unanswered → re-asked round 2 | Game must play well even with browser nav. Settings option for fullscreen + popup notification on home page. If not 100% vh, add black vertical bars to keep correct resolution ratio. |
| 10  | Do new domains adopt the `data-cy` contract + coverage test?   | Extend contract to shell, deck editor and story in this plan | — |
| 11  | What is the per-ticket validation gate?                        | Full `npm run check` every ticket | — |

## Facts (scout / repo)

### Repo state

- `main` at `aa1fd36`; merge `36a6cff` integrated prototypes. Source: `git log`.
- Entry split: `index.html` → `src/main.ts` (duel or `#/prototype/deck-builder`), `prototype.html` → `src/prototype/main.ts` (VN). Source: `src/main.ts:1-16`, `vite.config.ts`.
- Ports: `DEV_PORT`/`PLAYWRIGHT_PORT` default `4300`; worktrees 4300/4301/4302.
- Vendored core frozen, verified 21 files. Source: `npm run vendor:verify`.
- Gates green: lint, typecheck, format, 1267 tests, build, Chromium 100/100.

### "Duel files" inventory (answer to round-1 Q2)

| Path | Files | Lines | Contents |
| --- | ---: | ---: | --- |
| `src/app/` | 60 | 11,017 | Duel Svelte UI: `App.svelte`, `DuelField.svelte`, 20+ field components, stores, `DuelWorkerClient.ts`, prompts, presentation, image cache |
| `src/duel/` | 28 | 2,910 | Duel contracts (`duel-command.ts`, `public-duel-state.ts`), preset decks, `deck-catalog.ts`, `deck-parser.ts` |
| `src/field/` | 7 | 1,533 | Board view model, pixel geometry, navigation model |
| `src/worker/` | 29 | 8,423 | Worker entrypoints/runtime, `OcgCoreAdapter`, protocol, projection, opponent policy, asset loading |
| `src/storage/` | 2 | 766 | Duel snapshot store + revision cache cleanup |
| `src/styles/app.css` | 1 | 1,846 | Single global stylesheet (shell-level reset + duel field styling mixed) |

Total ≈ **127 files / 26.5k lines**. A physical move rewrites imports in these plus `tests/` (~85 unit + 45 component files) and `e2e/duel-smoke.spec.ts`.

### Contracts and storage

- Deck public API exists: `src/decks/index.ts` exports `deckId`, `DeckId`, `DeckRecord`, `DeckValidationIssue`, `ResolveDeckResult`, `ValidatedDeckSnapshot`, `resolveDeck`, `DeckRepository`.
- `resolveDeck(deckId, repository, catalog, ruleset)` returns `ready | missing | invalid`; ready carries frozen `ValidatedDeckSnapshot` with `ref {type:"local", deckId, revision}`, `main/extra/side`, `validationDigest`. Source: `src/decks/deck-resolver.ts`.
- Deck DB name today: `ygo-story-duel-deck-builder-prototype`. Source: `src/decks/indexeddb-deck-repository.ts:14`.
- VN prototype persistence is `localStorage` key `ygo-vn-prototype:review-state:v1`. Source: `src/prototype/storage/prototype-storage.ts:7`.
- Duel snapshot storage already owns `ygo-story-duel` IndexedDB. Source: `src/storage/snapshot-store.ts`.

### Worker start contract (blocks round-1 Q7 "full handoff")

- `DuelCommand.startDuel` accepts `playerDeckId`/`opponentDeckId` only, and `parseDuelCommand` rejects anything not in the bundled catalog: "Duel startDuel command deck id is not a bundled deck". Source: `src/duel/contracts/duel-command.ts`.
- `DuelWorkerRuntime.#startDuel` builds decks through `resources.createPreset(playerDeckId, opponentDeckId)` and requires `duelId === preset.id`. Source: `src/worker/DuelWorkerRuntime.ts:324-345`.
- Rules profile (MR3 vs MR5 + EMZ geometry) is derived from the selected deck pair and card metadata: `selectedDeckPairRulesProfile`. Custom decks must flow through the same computation. Source: same file; ADR-018.
- Build verifier ties packaged card images to `reviewedCardPool(loadDeckSources())` — packaged art currently equals bundled preset coverage exactly. Source: `scripts/verify-browser-build.ts`.

### Test/build surfaces affected by prototype deletion

- `e2e/` specs: `duel-smoke.spec.ts` (keep), `deck-builder-prototype.spec.ts`, `prototype-entry.spec.ts`, `prototype-flow.spec.ts`, `prototype-accessibility.spec.ts`, `prototype-review-presets.spec.ts`.
- VN reviewer harness: `src/prototype/review/` (`ReviewDrawer.svelte`, `ReviewLauncher.svelte`, `review-presets.ts`, `review-link.ts`) + 43 presets.
- Deck fixture switcher: `src/prototypes/deck-builder/components/PrototypeStateHarness.svelte` + `fixtures/states.ts`.
- Build verifier enforces `prototype.html` existence, prototype isolation scan and a 200 KB prototype budget — all become invalid once entries unify. Source: `scripts/verify-browser-build.ts`.

## Round 2 — Moves, product shell rules, handoff mechanics

Doc: [`round-2.html`](round-2.html)

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | Duel file move | Wrap now; one dedicated no-behavior-change move ticket at plan end | — |
| 2   | Domain folder names | `src/battle`, `src/deck-editor`, `src/story`; routes `#/duel`, `#/decks`, `#/story` | — |
| 3   | Global stylesheet | Full CSS-variable design system extracted first, domains restyled onto it | scope bounded in round 3 |
| 4   | Route table | Five routes + `#/duel/session/:handoffId`; unknown → home | — |
| 5   | Home hub | Product title screen (Story/Decks/Duel/Settings), doubles as dev entry | Also a hidden admin page for testing, URL-only, behind `/admin` |
| 6   | Letterboxing | Shell letterboxes whole app to fixed 16:9 stage | conflicts with Q13 precision → round 3 Q3 |
| 7   | Fullscreen | Settings toggle + one-time dismissible home tip, dismissal persisted | Toggle must be remembered in local storage so returning users land in fullscreen → browser gesture limit, round 3 Q8 |
| 8   | Deck DB | New DB `ygo-story-decks`; move + delete prototype DB after verified copy | — |
| 9   | VN saves | IndexedDB saves, no migration of prototype progress | — |
| 10  | Custom deck → engine | Extend `startDuel` with card-list variant; Worker validates every code against packaged snapshot; deck editor blocks earlier | — |
| 11  | Story opponent deck | unanswered → re-asked round 3 | "Rebase onto main first; look at main for everything new (deck picker already exists, and many other features)." |
| 12  | Prototype removal | Delete `prototype.html`, VN review drawer/presets, deck fixture switcher, all prototype e2e specs; port useful assertions to domain specs | — |
| 13  | Deck editor small viewports | Make deck editor responsive down to 768px in this plan | Below Full HD, design for mobile use, vertical screen → round 3 Q3/Q4 |
| 14  | Bundle budgets | Drop JS budgets during refactor, restore after | Budget optimization comes after restructuring |

## Facts (round 3 scout — branch state)

- **`main` is behind, not ahead.** `plan/feedback-follow-up` = `54fc1b2`, **31 commits not in main**. Source: `git rev-list --left-right --count plan/feedback-follow-up...HEAD` → `31 8`.
- Those commits contain the finished duel-field work: pixel geometry (`1208e62`), square zones (`6dc8c43`), overlay-scroll hands (`3ee22c4`), geometry-anchored phases (`255f18e`), status rail (`4cb0957`), full-height shell (`200a1ac`), persisted display settings v2 (`e663391`), card-list dialog T10–T14, T15 acceptance (`4d391fc`), final review fixes (`8739276`).
- Conflict surface vs restructure: `src/styles/app.css` **+489 / −344**, `vite.config.ts` +9, `scripts/verify-browser-build.ts` +25. Source: `git diff --numstat HEAD...plan/feedback-follow-up`.
- `VN` and `DECKBUILDER` branches both = `7ae8011`, an **ancestor** of `plan/feedback-follow-up`; they carry nothing unique.
- `origin/feature/experience-prototypes` is fully merged into main (`36a6cff`).
- Deck picker already on main: `src/app/components/DeckPicker.svelte`, six bundled decks, persisted pair (ADR-011, ADR-012).
- Build verifier gates beyond byte budgets: engine chunk shape, forbidden Node/engine markers, license identity, active-image coverage vs `reviewedCardPool`, snapshot identity, Worker manifest digest.

## Round 3 — Integration order, responsive law, admin surface

Doc: [`round-3.html`](round-3.html)

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | Integration order | Merge `plan/feedback-follow-up` into main as ticket T1, full `npm run check`, restructure on top | — |
| 2   | Stale branches | Reset to new main, reuse worktrees | Dev branches named `duel-simulator`, `deckbuilder`, `vn`, one per git worktree |
| 3   | Letterbox vs portrait | 16:9 stage above 1024px wide; below 1024px vertical mobile layout regardless of orientation | — |
| 4   | Portrait domains | All three, including a redesigned vertical duel field | — |
| 5   | Admin surface | Hidden hash route `#/admin`, never linked, shipped in production build | — |
| 6   | Admin contents | Route index + state jumps: any screen, seed test deck, launch preset duel, open story chapter, reset each DB | — |
| 7   | Story opponent deck | Story duels reuse the existing deck picker; player chooses both sides | — |
| 8   | Fullscreen restore | Persist preference; one-click Enter fullscreen prompt on home, applied on first interaction | — |
| 9   | Design-system scope | Tokens **plus** a deliberate unified visual language applied to all three domains in this plan | — |
| 10  | Build gates | Keep every correctness gate; suspend only JS byte budgets + obsolete prototype-entry checks | — |

## Facts (round 4 scout — layout surfaces)

- Duel geometry API: `computeFieldGeometry(extraMonsterZones, availableWidth, availableHeight)` with `COLS = 8`, `ZONE_GAP = 5`, `CARD_ASPECT = 72/104`, row/column/EMZ arrays; `createFieldRenderLayout` maps 34 (EMZ) or 32 (no-EMZ) `PhysicalZoneId`s. Portrait needs a second profile. Source: `plan/feedback-follow-up:src/field/duel-field-geometry.ts`.
- Duel visual/geometry evidence already locked: ADR-015 halo semantics, ADR-018 conditional EMZ, DF-16 Chromium parity/perf gate, six-case acceptance matrix, `tests/unit/global-styles.test.ts`.
- VN prototype is already responsive: breakpoints at 30rem/40rem/42rem/48rem, plus e2e overflow checks at 1280×720, 768×1024, 375×667, 667×375. Portrait cost is low.
- Deck editor has exactly one breakpoint: `@media (max-width: 1023px)` → "Desktop viewport required" block. Full portrait redesign required.
- Deck editor interaction already supports keyboard pick-and-drop (`Space` to pick, drop-target buttons), which is a ready-made touch model.
- VN prototype ships authored visual direction boards: `src/prototype/components/VisualDirectionBoards.svelte`, `src/prototype/prototype-colors.ts`.

## Round 4 — Portrait, visual language, recovery

Doc: [`round-4.html`](round-4.html)

| #   | Question | Answer | Precision |
| --- | -------- | ------ | --------- |
| 1   | Portrait duel field strategy | Rotate the landscape stage 90° inside portrait viewports | — |
| 2   | Portrait deck editor strategy | Single-panel tabs Catalog / Deck / Details; tap-to-add and tap-to-move replace drag on touch | — |
| 3   | Restyle vs locked duel evidence | Re-point duel colors at tokens, preserve every semantic distinction; acceptance assertions read token values, never relaxed | — |
| 4   | Visual language source | Derive from the duel field palette (most mature, evidence-backed) | — |
| 5   | Deck picker + local decks | Show bundled decks plus only valid local decks; hide invalid ones | — |
| 6   | Reload during a story duel | Automatically restart the same encounter from the checkpoint | — |
| 7   | Integration ownership | `main` is the integration lane (shell, routes, tokens, contracts, config, cross-domain e2e); `duel-simulator`, `deckbuilder`, `vn` own only domain paths | — |
| 8   | Lane fork point | No forking: run the whole restructure sequentially on `main`; use lanes afterwards | "yes but not for the restructuration" |

## Assumptions logged (not asked)

- **Rotation trigger.** Round 3 says "below 1024px, vertical layout regardless of orientation"; round 4 says the duel rotates 90° in portrait. Resolved as: below 1024px CSS width, portrait-orientation viewports rotate the duel stage 90°; landscape-orientation viewports under 1024px keep the scaled 16:9 stage (already the right shape). Story and deck editor use their vertical layouts below 1024px in both orientations.
- Story duel outcomes reuse the four branches the VN prototype already models: win, loss, abort, technical failure.
- Story content stays the existing prototype prologue; no new authored chapters in this plan.
- `#/admin` is excluded from player-facing navigation but still obeys the `data-cy` contract and the stage rules.
- Deck editor keyboard pick-and-drop remains the accessible path in every layout; pointer drag stays an enhancement.
- Frozen OCG Core is never touched; only the Worker start wrapper and its validation change.
- Names: design tokens in `src/styles/tokens.css` (integration-owned); deck DB `ygo-story-decks`; story saves DB `ygo-story-saves`.
- VN authored direction boards are superseded by the duel-derived palette (round 4 Q4); story keeps its layout/mood, not its raw colors.
- Auto-restart on reload (round 4 Q6) accepts that a player cannot escape an encounter by reloading; surrender remains the in-duel exit.

## Shared understanding

### Goal

Restructure the repository into the ADR-022 three-UI modular monolith — one build, one shell, three lazy domains (Duel Simulator, Deck Editor, Visual Novel) — promote both prototypes to production domains, and wire a full story→deck→duel handoff, without ever touching the frozen `vendor/ocgcore-wasm/0.1.2` engine.

### Settled decisions

**Integration order**

1. Merge `plan/feedback-follow-up` (31 commits, T1–T15) into `main` first; full `npm run check` green before anything else.
2. Reset `VN` / `DECKBUILDER`; dev branches become `duel-simulator`, `deckbuilder`, `vn`, one per worktree.
3. Run the entire restructure **sequentially on `main`**; lanes are used only after it completes.
4. `main` owns shell, routes, tokens, contracts, config, cross-domain e2e.

**Structure**

- One `index.html`, one Vite build. `prototype.html` deleted.
- Folders: `src/shell/`, `src/battle/`, `src/deck-editor/`, `src/story/`; existing duel code wrapped by `src/battle/index.ts` now and physically moved in one final no-behavior-change ticket.
- `src/prototypes/deck-builder/` → `src/deck-editor/`; `src/prototype/` → `src/story/`.
- Routes: `#/`, `#/duel`, `#/decks`, `#/decks/:deckId`, `#/story`, `#/duel/session/:handoffId`, hidden `#/admin`; unknown → home.
- Boundaries enforced by ESLint `no-restricted-imports` zones **and** a public-API unit test.
- `data-cy` contract extended to shell, deck editor and story.
- Prototype harnesses deleted (review drawer, presets, fixture switcher, prototype e2e specs); useful assertions ported into domain specs.

**Product surface**

- Home = product title screen: Story / Decks / Duel / Settings; also the dev entry point.
- `#/admin` hidden but shipped: route index, state jumps, seed test deck, launch preset duel, open story chapter, reset each database.
- 16:9 letterboxed stage above 1024px; below 1024px vertical mobile layouts.
- Portrait: duel rotates the stage 90°; deck editor becomes single-panel tabs with tap-to-add/tap-to-move; story reuses its existing responsive layouts.
- Fullscreen preference persisted; restored through a one-click prompt on home.
- Design tokens derived from the duel palette; all three domains restyled onto them; duel semantic distinctions preserved and asserted through token values.

**Data and engine**

- Deck DB → `ygo-story-decks` via verified copy, then prototype DB deleted.
- Story saves → IndexedDB `ygo-story-saves`; prototype progress not migrated.
- `startDuel` gains an explicit card-list variant; the Worker validates every card code against the packaged snapshot and rejects unsupported cards with a typed error; the deck editor blocks such decks earlier.
- Deck picker lists bundled decks plus valid local decks only; story duels use it for both sides.
- Reload during a story duel restores the pre-duel checkpoint and auto-restarts that encounter.
- Every correctness gate stays; only JS byte budgets and obsolete prototype-entry checks are suspended, restored in a final ticket.
- Every ticket ends green on full `npm run check`.

### Out of scope

- New story chapters, art, audio, localization.
- Bundle-size optimization (deferred to a post-restructure plan).
- Multiplayer, collection, packs, shops, progression economy.
- Any change to vendored OCG Core, its version, loader resolution or vendor manifest.
- Parallel lane execution during the restructure itself.

### Confirmation

Awaiting user confirm before `make-plan-aron` writes the plan, tickets, ADRs and architecture documents.
