# T2: Deck registry and derived card pool

**Plan:** `./ai-artifacts/PLAN_2026_08_10_duel_field_feedback_round_3.md`
**Depends:** T1
**Commit outcome:** Six decks parse from one registry, the reviewed card pool is derived from those decks instead of a hand-written list, and the browser bundles art and text for every code they use. The duel still auto-starts on the two MVP decks — no user-visible change.

## Context (self-contained)

- Goal: ship the 30 items of `feedback.md`. Item 12 asks for a Burning Abyss, Nekroz, Shaddoll and Spellbook deck plus a pre-duel selection menu.
- This slice: the data and build half of item 12. It adds the four decks, replaces the hand-written card-pool gate with one derived from the bundled decks, and widens the three build-side places that currently name `player.ydk` and `opponent.ydk` literally. The picker UI is the **next** ticket; this one must not change what the user sees.
- Out of scope here: any UI, the deck picker, `localStorage`, `duel-store.ts`, `App.svelte`, the opponent policy, anything in `src/field/**` or `src/app/**`.
- Assumptions in force: **A3** the four `.ydk` files are seeded here from the local catalog and the user may overwrite them later with no code change — deck files are `?raw` imports, pure data. **A4** the registry lists six decks and the two MVP decks stay the default so the e2e walkers keep a deterministic pool. **A5** deck acceptance is manual; no deck-specific automated tests. Structural behaviour here is still test-driven. **A6** six-deck payload caps are `19_000_000` active-image bytes, `22_000_000` active-runtime bytes, `41_000_000` aggregate cold-start bytes and `375_000` initial-JS bytes; the Worker-JS cap stays unchanged. These are minimal rounded caps above measured/projection values of `18_574_132`, `21_533_083`, approximately `40_522_355` and `351_234` bytes. Scout inspection attributes initial-JS growth to intentional main-thread active card text/image metadata; raw `.ydk` remains Worker-only. **A7** `loadActiveDuelDependencies*` requires `ReadonlySet<CardCode>`, so runtimes convert reviewed numeric codes with `cardCode` into a Set rather than passing the ticket's type-invalid array expression.

## Requirements

- A new pure module lists every bundled deck as metadata: a stable id, a display name and the `.ydk` filename. No file reads, no Vite-only syntax, importable from Node tests and from the browser worker alike.
- Two source-loader modules supply the raw `.ydk` text: one browser module using Vite `?raw`, one Node module using `node:fs`. Both produce the same shape.
- Four new `.ydk` files exist with the exact contents specified below.
- `MVP_SUPPORTED_CARD_CODES` is deleted. `validateDeck` takes the reviewed pool as a parameter, and the pool is computed as the union of every bundled deck's codes.
- `scripts/lib/active-image-manifest.ts`, `scripts/lib/active-runtime-files.ts`, and `scripts/verify-browser-build.ts` enumerate **every** `.ydk` in the registry instead of two hardcoded paths. Build verification fails on any missing image or coverage mismatch.
- `src/worker/create-browser-runtime.ts` and `src/worker/create-node-runtime.ts` build preset/pool from registry and preload active dependencies for complete reviewed union, not only default pair.
- Behaviour is unchanged: the duel still starts on the MVP player/opponent pair.
- `npm run build` succeeds and the built bundle carries art for all 120 union codes.

## Inputs

- `src/duel/presets/deck-parser.ts` — `parseYdk`, `validateDeck(deck, catalogCodes, constraints?, cardData?)`, `uniqueDeckCodes(...decks)`, `MVP_DECK_CONSTRAINTS`, `MVP_SUPPORTED_CARD_CODES` (22 literals, to be deleted).
- `src/duel/presets/mvp-preset.ts` — `MVP_PRESET_ID = duelId("mvp-preset-v1")`, `createMvpPreset(playerSource, opponentSource)`.
- `src/duel/presets/mvp-preset-node.ts` — reads the two `.ydk` with `node:fs` via `fileURLToPath(new URL("./decks/player.ydk", import.meta.url))`.
- `src/worker/create-browser-runtime.ts:4-5` — `import opponentDeckSource from "../duel/presets/decks/opponent.ydk?raw"` and the matching player import; line ~167 builds the preset, ~185 calls `uniqueDeckCodes`, ~194 and ~200 call `validateDeck`.
- `src/worker/create-node-runtime.ts:103,113,119` — the same three call sites.
- `scripts/lib/active-image-manifest.ts:26-40` — `deckSources` array with two `readFileSync` calls; the union of their numeric lines drives which images are bundled.
- `scripts/lib/active-runtime-files.ts:28-38` — two async `readFile` calls feeding `uniqueDeckCodes(parseYdk(playerSource), parseYdk(opponentSource))`; preserve async I/O while mapping the registry.
- `scripts/verify-browser-build.ts:416-439` — derives expected image coverage from only `player.ydk`/`opponent.ydk`; `npm run build` invokes it via `build:verify`, so this must switch to the six-deck reviewed pool and reject `missing` explicitly.
- `scripts/lib/active-card-text-manifest.ts` — `buildActiveCardTextManifest(projectRoot, codes)` throws `Missing active card text for browser build: <code>` for any code without an English text record. Every code below has one.
- `tests/fixtures/fake-ocgcore-adapter.ts` imports `MVP_PRESET_ID`; leave that import working.
- **From Depends (T1):** `plan/duel-field-feedback-round-3` is checked out, contains round-2 head `736b374` via merge commit `52eb619`, and is synced to origin at T1 terminal SHA `d715742`. `main` remains untouched per make-aron Git policy. Nothing else from T1.

## Deck data

Every deck file is built by the same rule: the header line `#created by YGO Story Duel Simulator`, then `#main`, then each main-deck code repeated its listed count in the listed order, one per line; then `#extra` and the extra-deck codes the same way; then `!side`. No trailing blank lines beyond the final newline.

### `src/duel/presets/decks/burning-abyss.ydk` — 40 main, 15 extra

Main: `10802915`×3, `20758643`×3, `57143342`×3, `84764038`×3, `73213494`×1, `47728740`×2, `36553319`×2, `734741`×1, `62957424`×1, `41386308`×2, `1475311`×2, `53129443`×1, `81439173`×1, `14087893`×2, `36006208`×2, `63356631`×2, `50078509`×2, `71587526`×2, `5851097`×2, `53582587`×1, `44095762`×2

Extra: `83531441`×3, `48739166`×2, `81330115`×1, `95992081`×1, `4423206`×1, `21501505`×1, `94380860`×1, `21044178`×1, `63746411`×1, `72167543`×1, `75367227`×2

### `src/duel/presets/decks/nekroz.ydk` — 40 main, 15 extra

Main: `26674724`×3, `89463537`×3, `25857246`×2, `74122412`×2, `99185129`×1, `88240999`×1, `52068432`×1, `95492061`×3, `23401839`×3, `8903700`×1, `23434538`×2, `97268402`×2, `51124303`×2, `97211663`×3, `14735698`×2, `96729612`×3, `32807846`×1, `70368879`×1, `53129443`×1, `14087893`×1, `5851097`×1, `84749824`×1

Extra: `79606837`×3, `50091196`×1, `15240238`×1, `88033975`×1, `15028680`×1, `73580471`×1, `44508094`×1, `52687916`×1, `8561192`×1, `41517789`×1, `35952884`×1, `82633039`×1, `21044178`×1

The level-spread Synchros make `Nekroz Kaleidoscope` functional; `Herald of the Arc Light` also supplies the period-appropriate Ritual search interaction.

### `src/duel/presets/decks/shaddoll.ydk` — 40 main, 15 extra

Main: `3717252`×2, `77723643`×2, `37445295`×2, `4939890`×2, `30328508`×2, `41386308`×3, `85087012`×2, `23434538`×2, `97268402`×2, `44394295`×3, `48130397`×2, `81439173`×1, `70368879`×1, `53129443`×1, `14087893`×2, `77505534`×3, `4904633`×2, `53582587`×1, `44095762`×2, `5851097`×2, `84749824`×1

Extra: `20366274`×3, `94977269`×3, `74822425`×2, `48424886`×2, `74009824`×2, `71594310`×1, `48739166`×1, `21044178`×1

### `src/duel/presets/decks/spellbook.ydk` — 40 main, 15 extra

Main: `86585274`×3, `14824019`×3, `26732909`×1, `87608852`×2, `13002461`×2, `41855169`×1, `97268402`×2, `23434538`×2, `89739383`×3, `56981417`×3, `97997309`×3, `52628687`×2, `88616795`×2, `25123082`×2, `61592395`×1, `33981008`×2, `70368879`×1, `53129443`×1, `14087893`×1, `53582587`×1, `44095762`×1, `84749824`×1

Extra: `80117527`×2, `92918648`×2, `12014404`×2, `29669359`×2, `73964868`×2, `84013237`×2, `48739166`×1, `21044178`×1, `71594310`×1

Every code above resolves to an `alias === 0` record in `generated/assets/current/catalog/cards/*.json`, has an English text record, and has an image at `generated/card-images/archive/full/<code>.jpg`. No code appears more than three times in any one deck. The union with the two MVP decks is **120** codes and **17.7 MiB** of bundled art, up from 22 codes.

## API surface this ticket creates

`src/duel/presets/deck-catalog.ts`:

```ts
export type DeckId =
  | "mvp-player"
  | "mvp-opponent"
  | "burning-abyss"
  | "nekroz"
  | "shaddoll"
  | "spellbook";

export interface DeckMetadata {
  readonly id: DeckId;
  readonly name: string;
  /** File name inside `src/duel/presets/decks/`. */
  readonly fileName: string;
}

export const DECK_CATALOG: readonly DeckMetadata[];
export function deckMetadata(id: DeckId): DeckMetadata;
export function isDeckId(value: string): value is DeckId;
export const DEFAULT_PLAYER_DECK_ID: DeckId;   // "mvp-player"
export const DEFAULT_OPPONENT_DECK_ID: DeckId; // "mvp-opponent"
```

Display names: `mvp-player` → `"Starter (Player)"`, `mvp-opponent` → `"Starter (Opponent)"`, `burning-abyss` → `"Burning Abyss"`, `nekroz` → `"Nekroz"`, `shaddoll` → `"Shaddoll"`, `spellbook` → `"Spellbook"`. File names: `player.ydk`, `opponent.ydk`, `burning-abyss.ydk`, `nekroz.ydk`, `shaddoll.ydk`, `spellbook.ydk`.

`src/duel/presets/deck-sources-browser.ts`:

```ts
export const DECK_SOURCES: ReadonlyMap<DeckId, string>;
```

`src/duel/presets/deck-sources-node.ts`:

```ts
export async function loadDeckSources(): Promise<ReadonlyMap<DeckId, string>>;
```

`src/duel/presets/reviewed-card-pool.ts`:

```ts
/** Union of every bundled deck's main and extra codes. Replaces the hand-listed MVP pool. */
export function reviewedCardPool(
  sources: ReadonlyMap<DeckId, string>,
): ReadonlySet<number>;
```

`src/duel/presets/duel-preset.ts`:

```ts
export interface DuelPreset {
  readonly id: DuelId;
  readonly playerDeckId: DeckId;
  readonly opponentDeckId: DeckId;
  readonly player: ParsedDeck;
  readonly opponent: ParsedDeck;
}

export function createDuelPreset(
  playerDeckId: DeckId,
  opponentDeckId: DeckId,
  sources: ReadonlyMap<DeckId, string>,
): DuelPreset;
```

`createDuelPreset` keeps `id` equal to the existing `MVP_PRESET_ID` value `duelId("mvp-preset-v1")` for now; T3 replaces it. `src/duel/presets/mvp-preset.ts` keeps exporting `MVP_PRESET_ID` and `createMvpPreset` so `tests/fixtures/fake-ocgcore-adapter.ts` and `duel-store.ts` keep compiling untouched.

`src/duel/presets/deck-parser.ts` changes signature:

```ts
export function validateDeck(
  deck: ParsedDeck,
  catalogCodes: ReadonlySet<number>,
  constraints?: DeckConstraints,
): void;
export function validateDeck(
  deck: ParsedDeck,
  catalogCodes: ReadonlySet<number>,
  constraints: DeckConstraints,
  cardData: ReadonlyMap<number, { readonly type: number }>,
  reviewedPool: ReadonlySet<number>,
): void;
```

Implementation parameters may remain optional for overload support, but `cardData` and `reviewedPool` are a required pair. Supplying `cardData` without a pool throws `Reviewed card pool is required when card data is supplied`; the public overload makes a four-argument call a type error. The card-data branch reads `reviewedPool` instead of `MVP_SUPPORTED_CARD_CODES`. Unsupported-code error stays `Deck uses card(s) outside the reviewed MVP pool: <codes>`.

## TDD

1. **Red** — write the failing tests named below first, in the files named below. Run them, capture the failure.
2. **Green** — minimum code to pass.
3. **Refactor** — only if needed. Keep green.

## Test plan

New file `tests/unit/deck-catalog.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `DECK_CATALOG lists six decks with unique ids and file names` | `DECK_CATALOG` | length 6; `new Set(ids).size === 6`; `new Set(fileNames).size === 6` |
| `deckMetadata resolves every id in the catalog` | each `id` of `DECK_CATALOG` | returns the matching entry |
| `isDeckId rejects an unknown id` | `"not-a-deck"` | `false` |
| `defaults point at the two MVP decks` | — | `DEFAULT_PLAYER_DECK_ID === "mvp-player"`, `DEFAULT_OPPONENT_DECK_ID === "mvp-opponent"` |

New file `tests/unit/reviewed-card-pool.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `pool is the union of every supplied deck` | a two-entry map with `#main\n1\n2\n` and `#main\n2\n3\n` | `Set {1,2,3}` |
| `pool includes extra deck codes` | one entry with `#main\n1\n#extra\n9\n!side\n` | pool contains `9` |
| `pool of the real bundled decks has 120 codes` | `await loadDeckSources()` | `size === 120` |
| `every bundled deck code is in the pool` | each deck parsed with `parseYdk` | every main and extra code is a member |

New file `tests/unit/deck-sources-node.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `loadDeckSources returns one source per catalog entry` | — | map size 6, every `DeckId` present, every value non-empty |
| `browser and Node source adapters contain identical text per id` | `DECK_SOURCES` vs `await loadDeckSources()` | six equal key/value pairs; catches wrong explicit `?raw` mapping |
| `every bundled deck parses and validates against its constraints` | each source through `parseYdk` | `main.length` is 40 for all six is **not** asserted — assert `main.length >= 40 && main.length <= 60`, `extra.length <= 15`, `side.length === 0` |
| `no bundled deck runs more than three copies of a card` | each parsed deck | every code's count across main+extra is `<= 3` |
| `burning-abyss has 40 main and 15 extra` | `burning-abyss.ydk` | `main.length === 40`, `extra.length === 15` |
| `nekroz has a Kaleidoscope-capable 40/15 split` | `nekroz.ydk` | `main.length === 40`, `extra.length === 15`; extra contains 3 Heralds and levels 2–12 |
| `all four archetype decks have a full Extra Deck` | four new ids | each `extra.length === 15` |
| `shaddoll has 40 main and 15 extra` | `shaddoll.ydk` | `main.length === 40`, `extra.length === 15` |
| `spellbook has 40 main and 15 extra` | `spellbook.ydk` | `main.length === 40`, `extra.length === 15` |

Extend `tests/unit/deck-parser.test.ts` (or create it if absent — check first):

| Test | Input | Expect |
| ---- | ---- | ---- |
| `validateDeck accepts a code inside the supplied reviewed pool` | 40-card deck of code `1`, `cardData` with `1`, `reviewedPool` `Set {1}` | does not throw |
| `validateDeck rejects a code outside the supplied reviewed pool` | same deck, `reviewedPool` `Set {2}` | throws `/outside the reviewed MVP pool: 1/` |
| `validateDeck rejects card data without a reviewed pool` | invoke implementation signature through a test-only cast with four args | throws `/Reviewed card pool is required/` |
| `validateDeck overload rejects a four-argument call` | compile fixture with `// @ts-expect-error` | typecheck proves paired API |

New file `tests/unit/active-image-manifest.test.ts`:

| Test | Input | Expect |
| ---- | ---- | ---- |
| `manifest covers every code of every bundled deck` | `buildActiveImageManifest(projectRoot, "test-snapshot")` | for every code in `reviewedCardPool(await loadDeckSources())`, the code appears in `files` or in `missing` |
| `manifest has no missing images for the bundled decks` | same | `missing.length === 0` |
| `pure image completeness guard rejects missing images` | `assertNoMissingActiveImages({ missing:[1] })` imported from `scripts/lib/active-image-manifest.ts` | throws exact missing-image build error without importing/running top-level build verifier |

## Impl steps

- [x] 1. Create `src/duel/presets/decks/burning-abyss.ydk` with the contents specified in **Deck data**.
- [x] 2. Create `src/duel/presets/decks/nekroz.ydk` with the contents specified in **Deck data**.
- [x] 3. Create `src/duel/presets/decks/shaddoll.ydk` with the contents specified in **Deck data**.
- [x] 4. Create `src/duel/presets/decks/spellbook.ydk` with the contents specified in **Deck data**.
- [x] 5. Verify each new file: `awk 'FNR==1{if(NR>1)print f,m+0,e+0;f=FILENAME;m=e=s=0}/^#main$/{s=1;next}/^#extra$/{s=2;next}/^!side$/{s=3;next}s==1&&/^[0-9]+$/{m++}s==2&&/^[0-9]+$/{e++}END{print f,m+0,e+0}' src/duel/presets/decks/*.ydk` → `burning-abyss 40 15`, `nekroz 40 15`, `opponent 40 0`, `player 40 0`, `shaddoll 40 15`, `spellbook 40 15`.
- [x] 6. Write `tests/unit/deck-catalog.test.ts` per the test plan. Run `npm run test:unit -- deck-catalog` — must fail on a missing module.
- [x] 7. Create `src/duel/presets/deck-catalog.ts` with the exported surface above. Re-run — green.
- [x] 8. Write `tests/unit/deck-sources-node.test.ts` per the test plan. Run `npm run test:unit -- deck-sources-node` — must fail on missing source-loader modules.
- [x] 9. Create `src/duel/presets/deck-sources-node.ts`: read every `DECK_CATALOG` entry's `fileName` with `readFile(fileURLToPath(new URL(\`./decks/${fileName}\`, import.meta.url)), "utf8")` and return a frozen `Map`.
- [x] 10. Create `src/duel/presets/deck-sources-browser.ts`: one `import x from "./decks/<file>.ydk?raw"` per catalog entry, assembled into a frozen `Map<DeckId, string>` named `DECK_SOURCES`. Re-run step 8's test — green.
- [x] 11. Write `tests/unit/reviewed-card-pool.test.ts` per the test plan. Run `npm run test:unit -- reviewed-card-pool` — must fail on a missing module.
- [x] 12. Create `src/duel/presets/reviewed-card-pool.ts` implementing `reviewedCardPool`. It parses each source with `parseYdk` and unions `main`, `extra` and `side`. Re-run — green.
- [x] 13. Add the three runtime `validateDeck` tests plus the compile-time overload assertion to `tests/unit/deck-parser.test.ts`. Run `npm run test:unit -- deck-parser` — must fail because reviewed-pool behaviour is absent; `npm run typecheck` later proves the overload assertion.
- [x] 14. In `src/duel/presets/deck-parser.ts`: delete `MVP_SUPPORTED_CARD_CODES`; add overloads requiring `cardData` + `reviewedPool` together; throw when implementation receives `cardData` without pool; change unsupported filter to `cardData.get(code) === undefined || !reviewedPool.has(code)`. Update every four-argument caller. Re-run — green.
- [x] 15. Create `src/duel/presets/duel-preset.ts` with `DuelPreset` and `createDuelPreset` as specified. It throws `Unknown deck id: <id>` when a source is missing from the map.
- [x] 16. In `src/worker/create-browser-runtime.ts`: replace two `?raw` imports with `DECK_SOURCES`; build default preset through `createDuelPreset`; compute `const reviewedPool = reviewedCardPool(DECK_SOURCES)` once; pass it with card data to both `validateDeck` calls; pass `[...reviewedPool]` to `loadActiveDuelDependencies` instead of `uniqueDeckCodes(default pair)` so T3 selection needs no later fetch.
- [x] 17. In `src/worker/create-node-runtime.ts`: the same three changes, using `await loadDeckSources()`.
- [x] 18. Write `tests/unit/active-image-manifest.test.ts` per the test plan. Run `npm run test:unit -- active-image-manifest` — must fail because the manifest still enumerates two decks and lacks the pure guard.
- [x] 19. In `scripts/lib/active-image-manifest.ts`: replace two-source array with every catalog entry. Export side-effect-free `assertNoMissingActiveImages(manifest: Pick<ActiveImageManifest,"missing">): void`; exact error lists codes. Unit test imports this lib only—never `scripts/verify-browser-build.ts`, whose top-level code inspects `dist/`. Re-run `npm run test:unit -- active-image-manifest` — must pass.
- [x] 20. In `scripts/lib/active-runtime-files.ts`: retain async `readFile`; `await Promise.all(DECK_CATALOG.map(({ fileName }) => readFile(path.join(..., fileName), "utf8")))`, parse every result, then call `uniqueDeckCodes(...parsedDecks)`. Do not introduce undeclared `readFileSync`.
- [x] 21. In `scripts/verify-browser-build.ts`, replace direct player/opponent expectation with `loadDeckSources()` + `reviewedCardPool(...)`; call `assertNoMissingActiveImages(activeImageManifest)` from lib before coverage checks. Do not export/import verifier itself. Reject missing and extra coverage across all six decks.
- [x] 22. Add all touched scripts to `format`/`format:check` globs if absent. Existing globs already cover `verify-browser-build.ts` and both `scripts/lib/` files; confirm, no expected package change.
- [x] 23. Run pure missing-image guard + browser/Node parity tests, then `npm run build` — expect success/larger `dist/`. Record size. Use in-memory `{missing:[code]}` only; never mutate generated assets or require prebuilt `dist` for unit tests.
- [x] 24. `npm run test:integration` — update any four-argument validator call to pass the reviewed pool; the real-WASM smoke test still starts a duel on the MVP pair.

## Outputs

- Files created: `src/duel/presets/decks/burning-abyss.ydk`, `nekroz.ydk`, `shaddoll.ydk`, `spellbook.ydk`, `src/duel/presets/deck-catalog.ts`, `deck-sources-browser.ts`, `deck-sources-node.ts`, `reviewed-card-pool.ts`, `duel-preset.ts`, `tests/unit/deck-catalog.test.ts`, `tests/unit/deck-sources-node.test.ts`, `tests/unit/reviewed-card-pool.test.ts`, `tests/unit/active-image-manifest.test.ts`.
- Files edited: `src/duel/presets/deck-parser.ts`, `src/worker/create-browser-runtime.ts`, `src/worker/create-node-runtime.ts`, `scripts/lib/active-image-manifest.ts`, `scripts/lib/active-runtime-files.ts`, `scripts/verify-browser-build.ts`, `tests/unit/deck-parser.test.ts`, plus existing integration callers that pass card data.
- Public API change: `MVP_SUPPORTED_CARD_CODES` removed; `validateDeck` requires reviewed pool whenever card data is supplied; deck catalog, source loaders, reviewed pool and `createDuelPreset` are new.
- Migration / config: none. The bundled image payload grows from 22 to 120 codes (~17.7 MiB).

## Validation

- [x] `npm run test:unit` passes, including the four new files
- [x] `npm run test:integration` passes
- [x] `npm run test:legacy` passes
- [x] `npm run typecheck` passes with 0 errors and 0 warnings
- [x] `npm run lint` and `npm run format:check` pass
- [x] `npm run build` succeeds; verifier proves six-deck image coverage and `missing.length === 0`
- [x] `grep -rn "MVP_SUPPORTED_CARD_CODES" src/ tests/ scripts/` returns nothing
- [x] the awk command in step 5 prints the six expected counts
- [x] manual check: `npm run dev`, start a duel, confirm it still plays the MVP pair and nothing in the UI has changed
- [x] app functional — no broken path from this slice
- [x] commit msg draft: `feat(presets): add four archetype decks behind a deck registry`

### Validation evidence

- Local repair gates: unit 57 files / 580 tests, integration 7 files / 20 tests, legacy 21 tests, TypeScript plus Svelte 0 errors / 0 warnings, lint clean, Prettier clean, production build verifier `status: ok` with 243 runtime files, removed-constant grep empty, and all six deck counts exact.
- A22 pinned-Nix Chromium full run: tests 1–17 passed; only the random full-duel walker timed out. This directly observed default-MVP startup and unchanged browser behaviour.
- A23 walker retries: first retry timed out; second retry passed in 3.9 minutes. The mandated retry policy accepts the walker as intermittent.
- Residual risk: random-seed full-duel walker remains timing-sensitive despite passing on the second mandated retry; no deterministic T2 failure was observed.
