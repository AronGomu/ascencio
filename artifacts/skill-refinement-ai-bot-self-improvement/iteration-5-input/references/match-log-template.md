# Read an authoritative game log

Read before log review. `game.log` stores one game with actor A/B sections; `match.log` indexes four games and shared fixture/manifest metadata. Code reconstructs exact gameplay in memory; agents receive only target-loss projections.

## Typed record format

Headers are `ASCENCIO_GAME_LOG<TAB>2` or `ASCENCIO_MATCH_LOG<TAB>2`. Optional `FIELDS` defines a zero-based field-path dictionary; `#N=typed-value` aliases expand before interpretation. Loss views use expanded paths. Each line is a tag and tab-separated `pointer=typed-value` fields. Examples display `<TAB>`; files use literal tabs.

```text
EVENT<TAB>=o<TAB>/kind=s:"decision"<TAB>/sequence=n:42<TAB>/decision_id=s:"0-decision-42"<TAB>/selected_choice_ids=o<TAB>/selected_choice_ids/choice_id=a<TAB>/selected_choice_ids/choice_id/0=s:"exact-choice-instance-7"
```

- `o` and `a`: object and array containers, including empty ones.
- `s:"..."`: escaped string; JSON scalar escaping preserves tabs/newlines/quotes without making the record a JSON document.
- `n:42`, `b:0`, `b:1`, `z`: number, false, true and null.
- Pointers use `/` segments; `~0`, `~1`, `~2` escape `~`, `/`, `=` in property names. Exact choice IDs, constraints, event ordering and all fields survive round trips.

## Game record order

```text
ASCENCIO_GAME_LOG<TAB>2
GAME<TAB>...identity, number, starting actor, stage, status, outcome, evidence hash...
ACTOR<TAB>=s:"a"
RECORD<TAB>...actor game identity and configuration hash...
SIDEBOARD<TAB>...status, exchanges, applies_now, carried_forward, applied_before_game...
INITIAL<TAB>...actor-visible initial state and deck configuration...
EVENT<TAB>...complete event or decision, exact prompt choices and selected IDs...
EVENT<TAB>...
RESULT<TAB>...actor result...
END_ACTOR<TAB>=s:"a"
ACTOR<TAB>=s:"b"
...same actor record sequence...
END_ACTOR<TAB>=s:"b"
END_GAME<TAB>=s:"match-0001-game-1"
```

Pre-side games mark sideboarding not applicable with empty exchanges. Game 3 records the transaction applied before play; game 4 marks that configuration carried forward. Exchanges list source/destination sections, card codes, quantities and reasons. Actors are stable identities, not starting seats. Each actor’s events contain only that actor’s legitimate observations; full game logs contain both perspectives for programmatic replay and must not be supplied directly to loss analysts.

## Analyst views

`analysis-slices.ts` publishes `ASCENCIO_LOSS_LOG<TAB>2`: minimal identity, target sideboarding/initial state/events/result and end marker. Analysts receive only packet `jobs[].losses[].log` allowlists for completed target losses, never full two-actor logs or accepted winning gameplay.

1. Read the loss identity and target perspective.
2. Compare offered actions and exact selected IDs at the critical decision.
3. Follow subsequent visible events; separate observations from strategic hypotheses.
4. Cite the match/game, view path and original decision ID in the existing Markdown report.

Preserve `?`/null as unknown; use only visible information and allowlisted views. Orchestrator replay uses the lossless source logs without JSON sidecars.
