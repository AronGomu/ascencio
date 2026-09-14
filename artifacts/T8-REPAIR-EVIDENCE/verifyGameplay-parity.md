# T8 legacy verifier branch → owner → negative proof

State: checked mapping; independent review pending.

Source: immutable `5a3ba36:src/content/install/verify-gameplay.ts`, entire lines 1–178. Every failure-producing condition appears below. Loop filters/positive control branches listed separately; not invented failure cases. Wire parser internals retain their own tests; this inventory targets each branch in old verifier, not every transitive parser branch.

## Test keys

K1. **Structural** = `tests/unit/verify-gameplay-parity.test.ts`, prefix `structural negative parity: `; exact suffix below. Expected old public Content category retained (`CONTENT_INCOMPATIBLE`, explicit size/schema failures `CONTENT_INVALID_MANIFEST`, read corruption `CONTENT_INTEGRITY_FAILED`).

K2. **Semantic** = `tests/unit/semantic-release-preparation.test.ts`, prefix `owned negative parity: ` unless full name quoted. Required preparation failures become `APP_REQUIRED_INPUT_FAILED`; producer composition maps semantic failure to `CONTENT_SEMANTIC_INVALID`.

K3. Ownership: Content = local wire/parser/manifest closure; Cards = `validateCardConsistency` / `createCards`; Decks = `validatePublishedDecks` using `PROTOTYPE_RULESET`; Story = `validateStoryRelease` / `validateStoryContinuity`; Battle = `parseBattleRuntimeInput` / `validateBattleRuntime`. Shell adapters map wire membership into consumer input; do not create deck quantity rules.

## Exhaustive branch matrix

| ID | Old line / failed condition | Current owner / fn | Named negative proof |
|---|---|---|---|
| P1 | 23 no runtime entry | Content `verifyGameplay`; progressive Content required closure | Structural `missing runtime` |
| P2 | 32 gameplay descriptor absent | Content `verifyGameplay` | Structural `missing gameplay descriptor` |
| P3 | 32 gameplay descriptor >4 MiB | Content `verifyGameplay` / `parseChapterGameplay`; Shell pre-read descriptor guard | Structural `oversized gameplay descriptor`; Semantic full name `required JSON descriptor rejects padded oversized gameplay bytes before reads` |
| P4 | 34–44 failed read/JSON/parser unwrap | Content reader / parser | Structural `required read failure preserves exact Content category`; `malformed gameplay JSON` |
| P5 | 47 chapterId differs from entry | Content wire binding; Shell `readProgressiveReleaseData` | Structural `chapter identity mismatch` |
| P6 | 48–51 manifest card roster differs | Content wire binding; producer `validateProgressiveSemantics` | Structural `manifest card roster mismatch` |
| P7 | 52–55 manifest opponent roster differs | Content wire binding; producer `validateProgressiveSemantics` | Structural `manifest opponent roster mismatch` |
| P8 | 56 manifest story identity differs | Content wire binding; producer `validateProgressiveSemantics` | Structural `manifest story identity mismatch` |
| P9 | 67 same deck ID conflicts across chapters | Story `validateStoryRelease` | Semantic full name `rejects conflicting duplicate chapter definitions`; `Story owner directly rejects duplicate deck without Content parser` |
| P10 | 67 same opponent ID conflicts | Story `validateStoryRelease` | Semantic `duplicate opponent across chapters`; `Story owner directly rejects duplicate opponent without Content parser` |
| P11 | 81–88 runtime JSON/read unwrap | Content required reader / JSON; Battle runtime decoding | Structural `required read failure preserves exact Content category`; parser regressions |
| P12 | 89 runtime card rows not array | Battle parser; legacy Content structural compatibility remains | Structural `runtime rows not array` |
| P13 | 89 runtime text rows not array | Battle parser; legacy Content structural compatibility remains | Structural `runtime text not array` |
| P14 | 93 falsy runtime row | Battle parser; legacy Content structure | Structural `null runtime row`; `runtime text null row` |
| P15 | 94 primitive runtime row | Battle parser; legacy Content structure | Structural `primitive runtime row`; `runtime text primitive row` |
| P16 | 95 runtime row lacks code | Battle parser; legacy Content structure | Structural `runtime row missing code`; `runtime text missing code` |
| P17 | 96 runtime code not numeric | Battle parser; legacy Content structure | Structural `runtime code not number`; `runtime text nonnumeric code` |
| P18 | 97 duplicate runtime code | Battle parser; legacy Content structure | Structural `duplicate runtime code`; `runtime text duplicate code` |
| P19 | 111 missing closure dependency | Content `manifestClosure` | Structural `missing closure dependency` |
| P20 | 111 dependency identity differs | Content `manifestClosure` | Structural `closure identity mismatch` |
| P21 | 117 conflicting card definitions in closure | Cards consistency; Shell rejects conflicting wire refs before mapping | Semantic full name `conflicting duplicate chapter card definition rejects before readiness` |
| P22 | 124 missing referenced file/pack | Content membership; Shell `validateMediaRef` | Semantic `full image missing descriptor`; `cropped image missing descriptor`; `set image missing descriptor`; `map image missing descriptor`; `media pack outside selected closure` |
| P23 | 124 wrong referenced MIME | Content membership; Shell `validateMediaRef` | Semantic `image wrong MIME`; full name `required JSON descriptor rejects wrong story MIME before reads` |
| P24 | 128 chapter card outside runtime roster | Cards `validateCardConsistency`; Battle supported pool | Structural `runtime roster omits chapter card`; Semantic `chapter card missing from runtime support` |
| P25 | 129 full image invalid | Content/Shell optional reference mapping | Semantic `full image missing descriptor` |
| P26 | 130 cropped image invalid | Content/Shell optional reference mapping | Semantic `cropped image missing descriptor` |
| P27 | 138 runtime record projection differs/absent | Cards `validateCardConsistency` | Semantic `chapter/runtime record mismatch`; `chapter card missing from runtime support` |
| P28 | 139 runtime text differs/absent | Cards `validateCardConsistency` | Semantic full name `rejects chapter/runtime text mismatch through Cards`; Battle text inventory regression |
| P29 | 144 set image invalid | Content/Shell optional reference mapping | Semantic `set image missing descriptor` |
| P30 | 145 set card outside chapter closure | Story `validateStoryRelease` | Semantic `set references unavailable card`; `Story owner directly rejects set card ref without Content parser` |
| P31 | 148 story document reference invalid | Content wire schema; Shell story descriptor mapping | Semantic `story descriptor mismatch` |
| P32 | 149–154 failed story read/JSON/parser | Content required reader/parser; Story document parser | Structural `malformed story JSON`; read-category test |
| P33 | 152 story bytes >4 MiB | Content reader/parser cap; Shell pre-read descriptor guard | Structural `oversized story bytes`; Semantic full name `required JSON descriptor rejects padded oversized story bytes before reads` |
| P34 | 155 story semantic identity differs | Story document identity; Content literal wire guard | Semantic `story content identity mismatch`. Both old schemas permit only `prototype-prologue-v1`; post-parse unequal branch unreachable for parser-valid values. Negative proves parser closes it rather than claiming impossible branch execution. |
| P35 | 156 map image invalid | Content/Shell optional mapping | Semantic `map image missing descriptor` |
| P36 | 166 deck card outside allowed pool | Decks `validatePublishedDecks` | Semantic `unknown deck card` |
| P37 | 167 token in deck | Decks `validatePublishedDecks` | Semantic full name `preserves Decks-owned rejection: unsupported token` |
| P38 | 173 copy/quantity exceeds ruleset | Decks `validatePublishedDecks` | Semantic full name `preserves Decks-owned rejection: copy limit` |
| P39 | 174 Extra-type card in Main | Decks `validatePublishedDecks` | Semantic full name `preserves Decks-owned rejection: wrong main/extra zone` |
| P40 | 174 normal card in Extra | Decks `validatePublishedDecks` | Semantic `normal card in Extra` |

## Positive/control branch coverage

C1. Old 28 skips runtime as gameplay, 80 skips unrelated runtime file kinds, 114 missing gameplay on runtime, 144 null set media, 147 absent story: `valid structural baseline`, focused preparation fixture, existing `installed-gameplay.test.ts`. These controls reject nothing.

C2. Identical duplicates accepted, lexical defaults preserved: `deduplicates identical chapter definitions and keeps lexical-first defaults`.

C3. No lost default/reference semantics from transitive parsers: direct Story tests `starter default`, `opponent default`, `opponent deck ref`, `set card ref`, duplicate deck/opponent; each bypasses Content parser, asserts `STORY_RELEASE_INVALID`.

C4. Runtime support/ABI additions: `tests/unit/battle-runtime-input.test.ts` covers ABI mismatch, missing indexed card/global scripts, strings, supported card references. Frozen-byte readiness now separately invokes asynchronous Battle-owned `validateFrozenBattleExecutable`; synchronous `validateReleaseData` does **not** hash executable bytes. Preparation plus producer/publisher wrong-WASM/wrong-manifest fixtures prove cryptographic gate before readiness/transport.

C5. Content legacy structural verifier remains compatibility code pending T9. No removed legacy checks other than Decks-owned semantics previously relocated in initial T8. This matrix does not claim Content legacy structural compatibility has been retired.
