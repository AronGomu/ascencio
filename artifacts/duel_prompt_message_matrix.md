# Duel prompt message matrix

The context line rendered above the choices in the duel **Decision** window, replacing the bare `Choose a chain response`. Implemented by `src/battle/app/presentation/prompt-context-message.ts`; every row below is a case in `tests/unit/prompt-context-message.test.ts`.

Companion document: `chain_prompt_state_matrix.md` enumerates the engine states. This one maps those states onto sentences.

## Segment model

A message is an ordered list of typed segments, never a pre-formatted string, so the dialog can style parts of it without parsing:

```ts
type PromptMessageSegment =
  | { kind: "text";  value: string }   // plain
  | { kind: "actor"; value: string }   // bold  — <strong>
  | { kind: "card";  value: string }   // italic — <em>
  | { kind: "zone";  value: string };  // plain, styled muted
```

`actor` is `You` or `Opponent`; the battle domain carries no duelist names (`src/battle/battle-contracts.ts:14` carries decks only), so the seat label is the name until one exists. `seatActor()` is the single place a real name would land.

## Verb agreement

| Seat | actor | auxiliary |
|---|---|---|
| 0 | `You` | `have` |
| 1 | `Opponent` | `has` |

Every row below is written with seat 1; seat 0 swaps both cells.

## 1 — Chain is open (`snapshot.chain.length ≥ 1`)

The last link is the subject. `label` and `description` come from the projector (`PublicChainLink`), already visibility-filtered.

| # | Condition | Message |
|---|---|---|
| 1.1 | last link visible, no targets | **Opponent** has activated *Mystical Space Typhoon*. |
| 1.2 | last link visible, 1 target | **Opponent** has activated *Mystical Space Typhoon*, targeting *Blue-Eyes White Dragon* in the Monster Zone. |
| 1.3 | last link visible, 2 targets | … targeting *Card A* in the Monster Zone and *Card B* in the Graveyard. |
| 1.4 | last link visible, ≥3 targets | … targeting *Card A* in the Monster Zone, *Card B* in the Graveyard and 2 more. |
| 1.5 | target identity hidden | … targeting a face-down card in the Spell/Trap Zone. |
| 1.6 | last link source hidden (`sourceIdentityVisible === false`) | **Opponent** has activated a face-down card. |
| 1.7 | chain depth ≥ 2 | any row above, suffixed ` Chain link 2.` |

Zone wording comes from `PublicLocation`:

| `PublicLocation` | zone label |
|---|---|
| `monster` | Monster Zone |
| `spellTrap` | Spell/Trap Zone |
| `field` | Field Zone |
| `graveyard` | Graveyard |
| `banished` | Banished |
| `hand` | Hand |
| `deck` | Deck |
| `extra` | Extra Deck |

## 2 — Chain is empty: the last action event is the subject

Read from the batch's presentation events, newest first, stopping at `turnStarted` — the same scan `lastActionActor` performs (`src/battle/app/prompts/auto-response.ts:52-74`).

| # | Event | Message |
|---|---|---|
| 2.1 | `summon` | **Opponent** has summoned *Card*. |
| 2.2 | `specialSummon` | **Opponent** has Special Summoned *Card*. |
| 2.3 | `flipSummon` | **Opponent** has Flip Summoned *Card*. |
| 2.4 | `set`, own seat | **You** have set *Card*. |
| 2.5 | `set`, opponent seat (code withheld by the projector) | **Opponent** has set a card. |
| 2.6 | `attack`, `direct: false` | **Opponent** has declared an attack. |
| 2.7 | `attack`, `direct: true` | **Opponent** has declared a direct attack. |
| 2.8 | `cardDrawn`, count 1 | **Opponent** has drawn a card. |
| 2.9 | `cardDrawn`, count > 1 | **Opponent** has drawn 3 cards. |
| 2.10 | `damage` | **Opponent** has taken 800 damage. |
| 2.11 | `recover` | **Opponent** has recovered 500 LP. |
| 2.12 | `positionChanged`, code known | *Card* changed to face-up defence. |
| 2.13 | `positionChanged`, code withheld | A card changed position. |
| 2.14 | `cardMoved`, code known | *Card* moved from the Hand to the Graveyard. |
| 2.15 | no qualifying event since `turnStarted` | no context line — the title stands alone |

Events deliberately **not** subjects: `duelStarted`, `turnStarted`, `phaseChanged`, `cardsShuffled`, `lifePointsChanged`, `chainChanged`, `hint`. They describe bookkeeping, not an action a player would respond to.

## 3 — Fallbacks and guards

| # | Condition | Behaviour |
|---|---|---|
| 3.1 | prompt kind ≠ `chain` | no context line (assumption A3) |
| 3.2 | snapshot is `null` | no context line |
| 3.3 | card code has no text entry | `Card <code>` in the `card` segment, matching `cardPreviewForCode` (`app/presentation/card-preview.ts:72`) |
| 3.4 | `forced` chain window | prefix `You must respond. ` before the row's message |

## 4 — Rendering

`PromptContextMessage.svelte` maps segment kind → element:

| kind | element | style |
|---|---|---|
| `text` | text node | inherited |
| `actor` | `<strong data-cy="prompt-context-actor">` | `font-weight: 650` |
| `card` | `<em data-cy="prompt-context-card">` | italic, `color: var(--duel-accent)` |
| `zone` | `<span data-cy="prompt-context-zone">` | muted |

The component renders in both prompt surfaces: the field **Decision** window (`FieldActionBar.svelte`) and the dialog/docked surface (`PromptControls.svelte`). `prompt.title` is untouched, so the rail status and the existing e2e assertion on `Choose a chain response` still hold.

## 5 — Data this needed that did not exist

`MSG_BECOME_TARGET` (type `83`) was classified as an event but never projected, so rows 1.2–1.5 had no data. The projector now resolves each targeted address against its own public state and appends `PublicChainTarget[]` to the open chain link, withholding the code when `isCardIdentityVisible` says the local seat cannot see it. With no open link the message is dropped rather than guessed (assumption A4).
