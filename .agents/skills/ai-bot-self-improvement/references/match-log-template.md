# Read a compact match log

Read one actor’s file at a time. Examples below illustrate syntax, not measured results.

```text
LOG v1 | match=match-000001 actor=a bot=<artifact-hash>
CARD 69162969 Set Lightning Vortex

GAME match-000001-game-1 | first=a stage=pre_side status=completed
INITIAL own_configuration.main.card.0.card_code=69162969 own_configuration.main.card.0.copies=1
T1 a main1 D0-decision-22 CHOOSE setSpellTrap:69162969 | OFFERED setSpellTrap:69162969,endPhase:? | reason=develop_board
T1 ? main1 E99 move | <changed-fields> <event-details>
RESULT <result-fields>

GAME match-000001-game-2 | first=b stage=pre_side status=completed
...
GAME match-000001-game-3 | first=a stage=post_side status=completed
...
GAME match-000001-game-4 | first=b stage=post_side status=completed
...
SIDEBOARD <sideboarding-fields>
```

## Fields

- `LOG`: format version, match ID, actor perspective and bot artifact hash. Actor A/B is a stable identity, not necessarily the starting player.
- `CARD code label`: visible card-code dictionary. Labels may include an action prefix such as “Set”; resolve codes here rather than repeating names.
- `GAME`: game ID, starting actor, pre/post-sideboarding stage and completion status.
- `INITIAL`: initial actor-visible data. Dotted paths identify nested fields; numeric segments identify array positions. `card_code` identifies a card; `copies` gives its count.
- `Tn actor phase`: turn, acting player and phase. `?` means absent or unspecified; it does not identify a hidden card.
- `D<id>`: original decision ID. Preserve it when citing evidence.
- `CHOOSE action:card[:value]`: selected action(s), comma-separated for multiple selections.
- `OFFERED`: available action descriptions, not hypothetical actions or scores.
- `reason`: the strategy’s recorded reason code, not proof that its choice was good.
- `E<number>`: event sequence within its source timeline. Following fields describe observed changes and event details.
- `RESULT`: recorded game outcome. Check completion before counting it; missing fields are not losses.
- `SIDEBOARD`: recorded sideboarding outcome and changes.

## Reading procedure

1. Check perspective, bot identity, game completion and result.
2. Locate relevant `CHOOSE` lines; resolve card codes and compare offered actions.
3. Follow subsequent events to assess consequences. Keep observations separate from strategic hypotheses.
4. Cite log path, game ID and decision ID. Compare candidate/baseline only with matching paired schedules.

## Limits

Each `a.log` or `b.log` contains one game from one perspective. Its parent match links the four games; the evaluation and iteration reference their owned records. The log contains only its source perspective. Never infer concealed opponent cards from `?`. Initial data and some events have no explicit actor. Scores and timing are omitted. Repeated descriptions such as `select:?` can represent distinct choices; consult the linked actor machine record (`a.json` or `b.json`) for exact choice IDs, constraints, positions or detailed explanations. The compact log is a review projection; the linked machine records preserve exact choices for validation and resume. Seeds and pairing identity belong to the evaluation’s `pairing.json`.
