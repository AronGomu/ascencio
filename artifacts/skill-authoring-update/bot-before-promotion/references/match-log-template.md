# Read an authoritative game log

New frozen runs persist gameplay only in typed `.log` files. One `game.log` contains one game and separate actor A/B sections. `match.log` indexes the four games in order and carries shared match/fixture/manifest metadata. There are no per-game JSON, actor JSON or retained game XML files. Code reconstructs exact records in memory from these logs for replay, verification, aggregation and resume.

## Typed record format

A file starts with `ASCENCIO_GAME_LOG<TAB>2` or `ASCENCIO_MATCH_LOG<TAB>2`. An optional `FIELDS` record stores the shared field-path dictionary once; subsequent `#N=typed-value` aliases refer to its zero-based entries. Code expands aliases before interpreting records; analyst loss views use expanded paths for readability. Each subsequent line is one logical record: a tag, followed by tab-separated `pointer=typed-value` fields. Examples below use `<TAB>` for readability; real files use literal tabs.

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

`analysis-slices.ts` publishes `ASCENCIO_LOSS_LOG<TAB>2` views only for completed target losses. These contain minimal game metadata, the target’s sideboarding/initial state/events/result and an end marker. They omit opponent-only content and every winning/drawing game. An analyst receives only its slice packet and the view paths in `jobs[].losses[].log`.

1. Read the loss identity and target perspective.
2. Compare offered actions and exact selected IDs at the critical decision.
3. Follow subsequent visible events; separate observations from strategic hypotheses.
4. Cite the match/game, view path and original decision ID in the existing Markdown report.

Preserve `?`/null as unknown information. Do not infer concealed cards or open other game files. Use the lossless source logs for orchestrator-owned replay; no JSON sidecar is needed. Legacy linked JSON/XML adapters are read-only compatibility for retained old runs and are not the output contract for new runs.
