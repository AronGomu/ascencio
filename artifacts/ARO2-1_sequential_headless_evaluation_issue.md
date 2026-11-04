Work on Linear issue ARO2-1:

Suggested branch name: neverismine/aro2-1-aro2-1-sequential-headless-mirror-match-evaluation-and-bot

<issue identifier="ARO2-1">
<title>ARO2-1 — Sequential headless mirror-match evaluation and bot improvement reports</title>
<description>
Status: proposed implementation specification, incorporating owner review.

Project: Ascencio / aron. Type: Feature. Related issue: <issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> — Build Baseline General AI Bot.

## Goal

Build a CLI that evaluates two AI bot instances against each other using one fixed input deck. Run batches of 1,000–10,000 matches sequentially, with four games per match, and save XML evidence that an AI agent can use to improve play and sideboarding decisions and compare bot revisions.

All system results are exclusively for AI-agent consumption. Do not generate human-facing documents, summaries, dashboards, rendered reports, or alternate presentation formats. Optimize outputs for reliable parsing, compact evidence, stable references, and automated comparison. Bot explanations remain required evidence for the reviewing agent.

The same bot module, configuration contract, permitted observations, decision validation, and sideboarding implementation must work in the actual duel simulator. The CLI must not maintain a separate simulation-only bot.

This ticket defines the runner and its reporting contract. <issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> supplies the general bot. Agree on their shared contract first; runner work can use the existing basic policy while the general bot is developed.

## Scope and fixed constraints

* Accept one deck containing Main, Extra, and Side Decks. Both players receive independent copies of that exact deck.
* Accept two bot references and configurations. They may be identical for self-play or different revisions for comparison.
* Keep the input deck fixed throughout a run. Sideboarding may redistribute its cards legally; it cannot introduce cards or optimize the input deck list.
* Execute only one game at a time. No parallel match scheduling or Worker pool.
* Reuse loaded, verified content and engine setup where safe; destroy per-game engine handles and reset per-game bot state.
* Keep engine execution in a dedicated Worker, separate from the CLI supervisor. Sequential execution still needs an external watchdog that can terminate a blocked Worker.
* Use the existing frozen Project Ignis core as sole authority for legal actions, effects, and results. Do not modify the frozen vendor engine, loader resolution, or manifest.
* Use pinned local content without media loading, UI animation, ordinary player saves, or content installation during a batch.
* Use production shuffle/random behavior except for an explicitly supplied starting-order fixture. Do not add fixed engine/bot seed schedules as a requirement.
* Save the actual starting orders and an evidence hash for each game after completion or failure. A hash is an evidence identifier, not a promise of deterministic re-execution.
* Preserve the repository's single-trunk development model; the Linear suggested branch name does not override it.

## Match lifecycle

One evaluation match always schedules these four games:

| Game | Deck configuration | Starting player |
| -- | -- | -- |
| 1 | Original, pre-side | A |
| 2 | Original, pre-side | B |
| 3 | Post-side | A |
| 4 | Post-side | B |

After games 1 and 2, both bots independently choose their sideboard exchanges using only their own observations from those games. Neither receives the other's private cards, report, or sideboarding choices. Validate both submissions before applying either. Freeze each player's resulting configuration for games 3 and 4; do not sideboard again between them.

Reset game-local memory between games. Supply the two pre-side observation histories explicitly to the sideboarding hook. Reset all match-local memory before the next match. A runtime may retain only state explicitly allowed by this contract, not accidental module globals from earlier games or matches.

Validate input deck sizes, copy restrictions, card availability, and the selected rules/banlist before starting. Sideboarding must preserve the complete input card multiset and original Main/Extra/Side sizes, respect card placement restrictions, and satisfy the same legality checks.

This is a four-game evaluation format, not conventional best-of-three tournament progression. Always schedule all four games regardless of wins. Score a completed match by game wins: more wins wins the match, equal wins ties it. Record game draws separately; an incomplete match has no competitive match result.

If a pre-side game fails, mark the match incomplete and skip its remaining games because sideboarding lacks its required observation history. If a post-side game fails, retain completed evidence and skip the remaining game. Continue with the next match after cleanup. Never turn infrastructure failures into losses or draws.

## Bot decision contract

Every decision uses the same contract in CLI and player-facing runtime:

* Input: actor-relative permitted observation, typed legal prompt, legal choice identifiers, selection constraints, and permitted bot configuration/state.
* Output: selected choice identifiers, a stable reason code, and a short explanation written by the bot at decision time. Optional scores/factors may explain its ranking.
* Validate the complete response: allowed identifiers, multiplicity, ordering, minimum/maximum, allocations, and prompt-specific requirements. Membership alone is insufficient.
* Handle every supported mandatory prompt. Unsupported prompts and invalid responses are explicit failures, not silent fallback wins or losses.
* The bot cannot read raw engine internals or the other player's concealed information. Legal observations include public history and legitimately revealed information.
* Explanations may use concise templates and computed factors. No external language-model request is needed for logging each choice.

The sideboarding hook follows the same principles: permitted pre-side history in; legal exchanges with reasons out. <issue id="27dd9651-d611-4fd7-9174-81b019616548" label="ARO2-2" href="https://linear.app/arongomu/issue/ARO2-2/build-baseline-general-ai-bot" /> must implement both play and sideboarding hooks, and the actual game must use those same hooks.

## CLI interface

Proposed interface; command naming may follow existing repository tooling:

```text
npm run bot:evaluate -- --config evaluation.xml
npm run bot:compare -- --baseline <saved-run-directory> --candidate <saved-run-directory> --out <comparison-directory>
```

Progress and diagnostics go to stderr; stdout prints the final output-directory path. Exit 0 means the requested batch finished without execution/report failures. Exit 1 means configuration, startup, or persistence failed. Exit 2 means the batch finished with one or more failed games, sideboarding failures, or incomplete matches. A bot losing normally is not a CLI failure.

Persist completed game evidence incrementally so an interruption does not erase earlier games. Mark interrupted runs explicitly. Resume only from a match boundary: preserve an interrupted match as incomplete and start the next unstarted match, without repeating or double-counting completed games. Keep a live progress record separate from immutable finalized evidence.

## Output layout

All generated files and the evaluation configuration use UTF-8 XML, schema version 1, explicit units, and string card codes. Existing external deck, banlist, content, and bot inputs retain their native formats. All results are AI-only, including evaluation reports, comparison reports, and bug tickets; there is no human-document output mode. This issue specification remains Markdown and is not a generated system result. Agent analysis reports reference the structured metric records rather than maintaining independent numeric truth.

```text
<run-id>/
  manifest.xml
  progress.xml
  summary.xml
  report.xml
  matches/
    match-000001/
      match.xml
      player-a.xml
      player-b.xml
  bugs/                         # created only when a bug occurs
    bug-000001.xml
    bug-000001.diagnostics.xml
<comparison-id>/
  comparison.xml
  report.xml
```

There are exactly two player-perspective reports per match, each containing all scheduled games and sideboarding from its own perspective. An omitted game is represented as skipped with a reason. Do not create privileged diagnostic files for successful games. Privileged evidence is never fed into the bot's decision or sideboarding hooks.

## File templates

XML contract:

* Use the named document roots shown below with a required `schema_version="1"` attribute. Validate documents against versioned XSD schemas supplied by the implementation.
* Disable DTDs, external entities, external schema resolution, and XInclude. Never fetch resources while parsing reports.
* Use `xsi:nil="true"` for null values; empty collection elements mean zero entries. Empty object elements in these templates are abbreviated structures to populate, not null values.
* Collection elements contain the named children shown below; scalar lists use the documented child name. Main/Extra/Side deck multisets contain `card` records, while starting-order lists contain ordered card-code values. Preserve timeline and choice order.
* Card codes, identifiers, hashes, paths, and timestamps are strings. Rates and timings are numbers, counts are integers, and flags use `true` or `false`; encode these types explicitly in the XSD.
* Escape text and attribute values with an XML serializer. Explanations and placeholder values must never be interpolated as raw markup.
* Valid run statuses are `running`, `completed`, `interrupted`, and `failed`; match statuses are `completed` and `incomplete`; game statuses are `completed`, `failed`, and `skipped`. Outcome enums and required fields must match the status. Perspective outcomes are `win`, `loss`, `draw`, `failed`, and `skipped`.
* Provide named schemas for evaluation, manifest, progress, match, player-report, summary, evaluation-report, comparison, comparison-report, bug-ticket, and diagnostics. Narrative explanations are XML text elements, not embedded Markdown documents.

Examples below define field meanings and structure. Values and paths are illustrative, not existing commands, measurements, or card data. Empty lists are populated when relevant. Use `xsi:nil="true"` for unavailable or inapplicable values, never an invented zero. Validate required fields and discriminated status variants in the implementation.

### 1. Input: `evaluation.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<evaluation xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" schema_version="1">
  <deck>
    <path>./decks/mirror.ydk</path>
  </deck>
  <bots>
    <a>
      <module>./bots/baseline.ts</module>
      <config />
    </a>
    <b>
      <module>./bots/candidate.ts</module>
      <config />
    </b>
  </bots>
  <batch>
    <matches>1000</matches>
    <execution>sequential</execution>
  </batch>
  <rules>
    <profile>mr5</profile>
    <banlist>./content/banlist.yaml</banlist>
  </rules>
  <content>
    <snapshot>./content/verified-snapshot</snapshot>
  </content>
  <starting_orders>
    <mode>normal</mode>
    <fixture_path xsi:nil="true" />
  </starting_orders>
  <limits>
    <game_wall_time_ms>10000</game_wall_time_ms>
    <decision_wall_time_ms>1000</decision_wall_time_ms>
    <sideboarding_wall_time_ms>1000</sideboarding_wall_time_ms>
    <max_turns_per_game>200</max_turns_per_game>
    <max_decisions_per_game>100000</max_decisions_per_game>
  </limits>
  <output>
    <directory>./generated/bot-evaluation</directory>
  </output>
</evaluation>
```

The limit values above are example watchdog settings, not an agreed performance target. Starting-order mode is `normal` or `fixture`. A fixture, when supplied, defines validated initial Main/Extra orders per match, game, and player, including orders valid for the post-side configuration. Reject an incompatible fixture rather than silently changing its order. Fixed orders are diagnostic/evaluation inputs only and do not change ordinary game startup.

### 2. Run identity: `manifest.xml`

Write once after input validation; do not mutate it when resuming. Snapshot the normalized input, deck, and bot configuration so external file changes cannot silently alter an existing run.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest schema_version="1">
  <run_id>run-20261104-001</run_id>
  <created_at>2026-11-04T12:00:00Z</created_at>
  <application_revision>&lt;git-sha&gt;</application_revision>
  <runtime>
    <node>&lt;version&gt;</node>
    <os>&lt;platform-and-version&gt;</os>
    <cpu>&lt;model&gt;</cpu>
    <memory_bytes>&lt;integer&gt;</memory_bytes>
  </runtime>
  <engine>
    <version>ocgcore-wasm-0.1.2</version>
    <sha256>&lt;hex&gt;</sha256>
  </engine>
  <content>
    <snapshot_id>&lt;id&gt;</snapshot_id>
    <sha256>&lt;hex&gt;</sha256>
  </content>
  <rules>
    <profile>mr5</profile>
    <banlist_sha256>&lt;hex&gt;</banlist_sha256>
  </rules>
  <deck>
    <sha256>&lt;hex&gt;</sha256>
    <main>
      <card>
        <card_code>10000001</card_code>
        <copies>3</copies>
      </card>
    </main>
    <extra />
    <side />
  </deck>
  <bots>
    <a>
      <module>&lt;reference&gt;</module>
      <artifact_sha256>&lt;hex&gt;</artifact_sha256>
      <config />
      <config_sha256>&lt;hex&gt;</config_sha256>
    </a>
    <b>
      <module>&lt;reference&gt;</module>
      <artifact_sha256>&lt;hex&gt;</artifact_sha256>
      <config />
      <config_sha256>&lt;hex&gt;</config_sha256>
    </b>
  </bots>
  <configuration />
</manifest>
```

Hash the resolved executable bot artifact and its dependencies, not only its entry file. Card lists shown here are abbreviated; a real manifest contains the full validated deck.

### 3. Recoverable state: `progress.xml`

Update atomically. A finalized game referenced here must already have its evidence persisted. On resume verify existing evidence and manifest identity before scheduling anything new.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<progress schema_version="1">
  <run_id>run-20261104-001</run_id>
  <status>running</status>
  <updated_at>2026-11-04T12:00:03Z</updated_at>
  <last_finalized_match>0</last_finalized_match>
  <active_match>1</active_match>
  <active_game>2</active_game>
  <next_unstarted_match>2</next_unstarted_match>
  <completed_game_ids>
    <game_id>match-000001-game-1</game_id>
  </completed_game_ids>
  <incomplete_match_ids />
  <bug_ids />
</progress>
```

### 4. Match record: `matches/<match-id>/match.xml`

Contains neutral lifecycle/results metadata and hashes, not private hands, deck orders, or privileged engine state. Private starting conditions live in the corresponding perspective reports.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<match xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" schema_version="1">
  <run_id>run-20261104-001</run_id>
  <match_id>match-000001</match_id>
  <status>completed</status>
  <games>
    <game>
      <game_id>match-000001-game-1</game_id>
      <number>1</number>
      <stage>pre_side</stage>
      <starter>a</starter>
      <status>completed</status>
      <winner>a</winner>
      <draw>false</draw>
      <evidence_sha256>&lt;hex&gt;</evidence_sha256>
      <bug_id xsi:nil="true" />
    </game>
    <game>
      <game_id>match-000001-game-2</game_id>
      <number>2</number>
      <stage>pre_side</stage>
      <starter>b</starter>
      <status>completed</status>
      <winner>b</winner>
      <draw>false</draw>
      <evidence_sha256>&lt;hex&gt;</evidence_sha256>
      <bug_id xsi:nil="true" />
    </game>
    <game>
      <game_id>match-000001-game-3</game_id>
      <number>3</number>
      <stage>post_side</stage>
      <starter>a</starter>
      <status>completed</status>
      <winner>a</winner>
      <draw>false</draw>
      <evidence_sha256>&lt;hex&gt;</evidence_sha256>
      <bug_id xsi:nil="true" />
    </game>
    <game>
      <game_id>match-000001-game-4</game_id>
      <number>4</number>
      <stage>post_side</stage>
      <starter>b</starter>
      <status>completed</status>
      <winner>a</winner>
      <draw>false</draw>
      <evidence_sha256>&lt;hex&gt;</evidence_sha256>
      <bug_id xsi:nil="true" />
    </game>
  </games>
  <sideboarding>
    <status>completed</status>
    <a_configuration_sha256>&lt;hex&gt;</a_configuration_sha256>
    <b_configuration_sha256>&lt;hex&gt;</b_configuration_sha256>
    <bug_id xsi:nil="true" />
  </sideboarding>
  <result>
    <a_wins>3</a_wins>
    <b_wins>1</b_wins>
    <draws>0</draws>
    <outcome>a</outcome>
  </result>
  <perspective_reports>
    <a>player-a.xml</a>
    <b>player-b.xml</b>
  </perspective_reports>
</match>
```

Game status is `completed`, `failed`, or `skipped`. Failed/skipped games have null winner/draw; failed games carry a failure category and bug reference, skipped games a reason. Failed games still receive a hash of their captured partial evidence. Skipped games have no evidence hash. Sideboarding failures create a bug ticket even though they occur between games.

### 5. Perspective report: `player-a.xml` / `player-b.xml`

Use the same schema for both players. Each report starts from its own knowledge, then records chronological changes. Never repeat the full contents of every zone after each action. Stable game-local card instance identifiers distinguish copies and survive legal movement; do not expose concealed opponent instances in ways the real game would not permit.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<player-report xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" schema_version="1">
  <run_id>run-20261104-001</run_id>
  <match_id>match-000001</match_id>
  <perspective>a</perspective>
  <bot_artifact_sha256>&lt;hex&gt;</bot_artifact_sha256>
  <games>
    <game>
      <game_id>match-000001-game-1</game_id>
      <stage>pre_side</stage>
      <starting_player>a</starting_player>
      <status>completed</status>
      <initial>
        <rules_profile>mr5</rules_profile>
        <own_configuration>
          <main />
          <extra />
          <side />
        </own_configuration>
        <own_starting_order>
          <main>
            <card>10000001</card>
            <card>10000002</card>
          </main>
          <extra />
        </own_starting_order>
        <own_opening_hand>
          <card>
            <instance_id>a-card-1</instance_id>
            <card_code>10000001</card_code>
          </card>
        </own_opening_hand>
        <public_state>
          <life_points>
            <a>8000</a>
            <b>8000</b>
          </life_points>
          <turn>1</turn>
          <phase>draw</phase>
          <opponent_hand_count>5</opponent_hand_count>
          <opponent_deck_count>35</opponent_deck_count>
        </public_state>
      </initial>
      <timeline>
        <entry>
          <sequence>1</sequence>
          <kind>decision</kind>
          <decision_id>a-decision-1</decision_id>
          <actor>a</actor>
          <turn>1</turn>
          <phase>main1</phase>
          <prompt>
            <id>prompt-1</id>
            <kind>idleCommand</kind>
            <minimum>1</minimum>
            <maximum>1</maximum>
            <ordered>false</ordered>
            <cancelable>false</cancelable>
            <constraints />
            <choices>
              <choice>
                <id>choice-1</id>
                <action>summon</action>
                <card_instance_id>a-card-1</card_instance_id>
                <card_code>10000001</card_code>
              </choice>
              <choice>
                <id>choice-2</id>
                <action>endPhase</action>
              </choice>
            </choices>
          </prompt>
          <selected_choice_ids>
            <choice_id>choice-1</choice_id>
          </selected_choice_ids>
          <reason>
            <code>establish_board</code>
            <explanation>Summon the available attacker to establish pressure.</explanation>
            <factors />
          </reason>
          <duration_ms>0.4</duration_ms>
        </entry>
        <entry>
          <sequence>2</sequence>
          <kind>event</kind>
          <actor>a</actor>
          <event>summon_succeeded</event>
          <caused_by_decision_id>a-decision-1</caused_by_decision_id>
          <turn>1</turn>
          <phase>main1</phase>
          <changes>
            <change>
              <type>card_moved</type>
              <instance_id>a-card-1</instance_id>
              <card_code>10000001</card_code>
              <from>
                <player>a</player>
                <zone>hand</zone>
              </from>
              <to>
                <player>a</player>
                <zone>monster</zone>
                <slot>0</slot>
              </to>
              <position>face_up_attack</position>
            </change>
          </changes>
        </entry>
      </timeline>
      <result>
        <outcome>win</outcome>
        <engine_reason>&lt;typed-reason&gt;</engine_reason>
        <turns>8</turns>
        <duration_ms>1200</duration_ms>
        <evidence_sha256>&lt;hex&gt;</evidence_sha256>
        <bug_id xsi:nil="true" />
      </result>
    </game>
  </games>
  <sideboarding>
    <status>completed</status>
    <observed_game_ids>
      <game_id>match-000001-game-1</game_id>
      <game_id>match-000001-game-2</game_id>
    </observed_game_ids>
    <legal_constraints>
      <preserve_section_sizes>true</preserve_section_sizes>
      <preserve_total_multiset>true</preserve_total_multiset>
    </legal_constraints>
    <exchanges>
      <exchange>
        <from_section>side</from_section>
        <to_section>main</to_section>
        <card_code>10000003</card_code>
        <copies>1</copies>
        <reason_code>answer_observed_threat</reason_code>
        <explanation>Add interaction for the publicly observed threat.</explanation>
      </exchange>
      <exchange>
        <from_section>main</from_section>
        <to_section>side</to_section>
        <card_code>10000004</card_code>
        <copies>1</copies>
        <reason_code>replace_less_relevant_option</reason_code>
        <explanation>Remove the less relevant option for this observed matchup.</explanation>
      </exchange>
    </exchanges>
    <resulting_configuration>
      <main />
      <extra />
      <side />
    </resulting_configuration>
    <resulting_configuration_sha256>&lt;hex&gt;</resulting_configuration_sha256>
    <duration_ms>0.6</duration_ms>
    <bug_id xsi:nil="true" />
  </sideboarding>
</player-report>
```

Populate `games` with all four games. For skipped games record only identity, stage, starter, status, and skip reason. Preserve an ordered partial timeline for failed games.

Required event coverage includes draws/searches/reveals as observed, movements, summons, sets, position changes, effect activation/resolution/negation, chains, targets, materials, costs, attacks, damage, LP changes, turn/phase changes, and terminal results. These are evidence, not a requirement to publish chance-driven access statistics. Record only identities visible to this perspective. Opponent decisions appear as observed actions; their private prompts, options, and explanations belong only in their own report.

Initial state is captured at the first decision boundary; the own starting order is captured before opening draws. Events that explain reaching that boundary must be represented consistently without applying opening draws twice when reconstructing the timeline.

Define the game evidence hash as SHA-256 over a versioned canonical encoding of the game identity, resolved configuration identities, and both captured game-perspective records, excluding hash fields, timestamps, performance timings, and paths. It is not a hash of XML formatting. For failures include the captured failure category and partial records. The supervisor can compute the hash without revealing either perspective to the other bot. Identical starting orders alone do not guarantee identical hashes or outcomes.

### 6. Aggregate statistics: `summary.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<summary schema_version="1">
  <run_id>run-20261104-001</run_id>
  <status>completed</status>
  <counts>
    <matches_requested>1000</matches_requested>
    <matches_completed>1000</matches_completed>
    <matches_incomplete>0</matches_incomplete>
    <games_scheduled>4000</games_scheduled>
    <games_completed>4000</games_completed>
    <games_failed>0</games_failed>
    <games_skipped>0</games_skipped>
  </counts>
  <results>
    <a>
      <game_wins>2100</game_wins>
      <game_losses>1900</game_losses>
      <game_draws>0</game_draws>
      <game_win_rate>
        <value>0.525</value>
        <numerator>2100</numerator>
        <denominator>4000</denominator>
      </game_win_rate>
      <match_wins>400</match_wins>
      <match_losses>300</match_losses>
      <match_ties>300</match_ties>
      <match_win_rate>
        <value>0.4</value>
        <numerator>400</numerator>
        <denominator>1000</denominator>
      </match_win_rate>
    </a>
    <b />
    <match_score_distribution />
    <by_stage>
      <pre_side />
      <post_side />
    </by_stage>
  </results>
  <card_decisions>
    <card_decision>
      <player>a</player>
      <card_code>10000001</card_code>
      <action>summon</action>
      <event_count>90</event_count>
      <player_games_with_action>70</player_games_with_action>
      <wins_in_those_games>40</wins_in_those_games>
      <conditional_win_rate>
        <value>0.5714285714</value>
        <numerator>40</numerator>
        <denominator>70</denominator>
      </conditional_win_rate>
      <legal_opportunities>120</legal_opportunities>
      <opportunities_declined>30</opportunities_declined>
    </card_decision>
  </card_decisions>
  <effects />
  <combat />
  <resources />
  <sideboarding />
  <decision_behavior />
  <performance>
    <startup_ms>850</startup_ms>
    <completed_games_per_second>0.8</completed_games_per_second>
    <game_duration_ms>
      <p50>1200</p50>
      <p95>1900</p95>
      <p99>2400</p99>
      <maximum>3100</maximum>
    </game_duration_ms>
    <decision_duration_ms>
      <p50>0.4</p50>
      <p95>1.2</p95>
      <p99>2.1</p99>
      <maximum>4.0</maximum>
    </decision_duration_ms>
    <engine_time_ms>0</engine_time_ms>
    <bot_time_ms>0</bot_time_ms>
    <report_write_time_ms>0</report_write_time_ms>
    <peak_resident_memory_bytes>0</peak_resident_memory_bytes>
  </performance>
  <reliability>
    <failures_by_category />
    <bugs />
  </reliability>
</summary>
```

The numeric examples are illustrative and do not represent benchmark results. Empty metric collections stand for populated, typed records in the implementation; every derived rate needs its numerator and denominator and every metric needs a documented aggregation rule.

Metric rules:

* Include actual game draws in game win-rate denominators. Include match ties in match win-rate denominators. Report wins/losses/draws or ties separately.
* Exclude failed/skipped games from competitive game rates and incomplete matches from match rates; show their counts prominently. Completed games from incomplete matches remain valid game observations, clearly counted as such.
* Count a player-game once per card/action condition for conditional win rates, even if the action happened repeatedly. Keep event counts separately.
* Separate summons, sets, activation attempts, successful resolutions, and material usage. Do not collapse them into an undefined `played` field.
* Record legal opportunities and declined choices per decision prompt, including repeated prompt occurrences; they do not estimate unique strategic opportunities. A declined action is not automatically a mistake.
* Publish uncertainty for headline rates and baseline deltas using match-level clustering; four games in one match are related. Report method and sample size. Use null when samples cannot support an estimate.
* Do not publish starting-player win-rate breakdowns, opening-hand quality metrics, opening/draw/search frequencies, or other statistics whose only use is changing the fixed deck or describing chance. Keep relevant observations in the event evidence.
* Card/action win rates and pre/post-side differences are associations, not causal estimates of decision quality. Do not automatically rank a card or exchange as good solely from these rates.
* Any heuristic quality score must be explicitly named, versioned, and explained; raw event counts must remain available.

### 7. Agent evaluation report: `report.xml`

This is an AI-consumable analysis index, not a human summary. Use structured sections for observations, hypotheses, and evidence references. Reference metric paths in `summary.xml`; if including numeric values, derive them from that file rather than calculating a second independent result. Avoid prose that merely repeats metric records or event timelines.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<evaluation-report schema_version="1">
  <run_id>run-20261104-001</run_id>
  <manifest_path>manifest.xml</manifest_path>
  <summary_path>summary.xml</summary_path>
  <configuration_description>Fixed-deck mirror evaluation with four games per match and sequential execution.</configuration_description>
  <results>
    <metric_references>
      <metric_reference>results.a.game_win_rate</metric_reference>
      <metric_reference>results.by_stage</metric_reference>
      <metric_reference>counts.matches_incomplete</metric_reference>
    </metric_references>
    <observations />
  </results>
  <decision_investigations>
    <investigation>
      <observation>Describe an observed decision pattern with its sample size referenced from the summary.</observation>
      <hypothesis>Describe a possible bot improvement without claiming causation.</hypothesis>
      <evidence>
        <reference path="matches/match-000001/player-a.xml" game_id="match-000001-game-1" decision_id="a-decision-1" />
      </evidence>
      <suggested_next_step>Inspect alternative legal choices in the cited decision.</suggested_next_step>
    </investigation>
  </decision_investigations>
  <sideboarding>
    <metric_reference>sideboarding</metric_reference>
    <observations />
    <evidence />
  </sideboarding>
  <performance_and_reliability>
    <metric_reference>performance</metric_reference>
    <metric_reference>reliability</metric_reference>
    <bug_references />
  </performance_and_reliability>
  <comparison_references />
  <limitations />
</evaluation-report>
```

### 8. Saved revision comparison: `comparison.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<comparison xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" schema_version="1">
  <comparison_id>comparison-001</comparison_id>
  <baseline_run>../run-baseline</baseline_run>
  <candidate_run>../run-candidate</candidate_run>
  <baseline_manifest_sha256>&lt;hex&gt;</baseline_manifest_sha256>
  <candidate_manifest_sha256>&lt;hex&gt;</candidate_manifest_sha256>
  <comparison_mode>unpaired</comparison_mode>
  <comparability>
    <same_input_deck>true</same_input_deck>
    <same_rules_and_banlist>true</same_rules_and_banlist>
    <same_engine_and_content>true</same_engine_and_content>
    <same_opponent_artifact_and_config>true</same_opponent_artifact_and_config>
    <same_starting_order_cases>false</same_starting_order_cases>
    <changed_bot>b</changed_bot>
    <notes />
  </comparability>
  <metrics>
    <metric>
      <name>b.game_win_rate</name>
      <baseline>
        <value>0.48</value>
        <numerator>1920</numerator>
        <denominator>4000</denominator>
      </baseline>
      <candidate>
        <value>0.51</value>
        <numerator>2040</numerator>
        <denominator>4000</denominator>
      </candidate>
      <delta_percentage_points>3.0</delta_percentage_points>
      <uncertainty>
        <method>match_cluster_bootstrap</method>
        <confidence_level>0.95</confidence_level>
        <interval_percentage_points xsi:nil="true" />
      </uncertainty>
    </metric>
  </metrics>
  <decision_changes />
  <sideboarding_changes />
  <new_bug_ids />
  <recurring_failure_signatures />
  <previously_observed_bugs_not_seen />
  <limitations>
    <limitation>Starting orders alone do not control later random outcomes.</limitation>
  </limitations>
</comparison>
```

The comparison's `report.xml` is also XML. Cite evidence; do not invent causal explanations. Resolve every relative path from the containing file.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<comparison-report schema_version="1">
  <comparison_id>comparison-001</comparison_id>
  <comparison_path>comparison.xml</comparison_path>
  <compared_runs>
    <baseline manifest_path="../run-baseline/manifest.xml" />
    <candidate manifest_path="../run-candidate/manifest.xml" />
  </compared_runs>
  <comparability>
    <assessment>Describe which inputs stayed fixed and any confounding changes.</assessment>
    <limitations />
  </comparability>
  <result_changes>
    <metric_references />
    <observations />
  </result_changes>
  <decision_changes />
  <sideboarding_changes />
  <performance_changes />
  <reliability_changes>
    <new_bug_references />
    <recurring_failure_references />
  </reliability_changes>
  <recommendations>
    <recommendation>
      <hypothesis>Describe a proposed bot improvement grounded in the comparison.</hypothesis>
      <evidence />
      <next_step>State the concrete investigation or evaluation to perform.</next_step>
    </recommendation>
  </recommendations>
</comparison-report>
```

Populate change sections with observations, metric references into `comparison.xml`, and exact decision/evidence references. Recommendations remain hypotheses until evaluated.

Compare a changed bot against a fixed reference opponent to assess that revision. Flag comparisons where both bots, content, rules, or input deck changed as confounded. Matching starting orders is allowed where fixtures are valid; do not describe it as identical random execution. Self-play of one revision against itself is useful for behavior/reliability analysis but its symmetric win rate alone cannot demonstrate strength improvement.

### 9. Bug ticket: `bugs/<bug-id>.xml`

Generate only on a failure, including crashes, stuck execution, invalid choices, unsupported prompts, sideboarding errors, or exhausted safety limits. A limit breach is a failure signal, not proof of a specific defect or fix.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bug-ticket schema_version="1">
  <bug_id>bug-000001</bug_id>
  <title>Failure category and short symptom</title>
  <status>needs_diagnosis</status>
  <failure_signature>&lt;stable-grouping-hash&gt;</failure_signature>
  <occurrence_count>1</occurrence_count>
  <expected_behavior>The bot responds legally and execution progresses or ends with an authoritative game result.</expected_behavior>
  <observed_behavior>Concrete failure, error, timeout or limit, and last confirmed progress.</observed_behavior>
  <affected_executions>
    <execution>
      <occurrence_id>occurrence-000001</occurrence_id>
      <run_id>run-20261104-001</run_id>
      <match_id>match-000001</match_id>
      <game_id>match-000001-game-3</game_id>
      <phase>game</phase>
      <player>b</player>
      <partial_evidence_sha256>&lt;hex&gt;</partial_evidence_sha256>
    </execution>
  </affected_executions>
  <environment>
    <manifest_path>../manifest.xml</manifest_path>
    <identity_notes>App and bot revisions, configurations, deck/content/engine/rules identities, runtime and hardware are recorded in the manifest.</identity_notes>
  </environment>
  <reproduction>
    <reproducibility>best_effort</reproducibility>
    <starting_conditions_reference />
    <last_action />
    <pending_prompt_reference />
    <attempted_response_reference />
    <observed_random_events_reference />
    <command_or_configuration />
    <missing_evidence />
  </reproduction>
  <attachments>
    <reference path="../matches/match-000001/player-a.xml" classification="player_a_perspective" />
    <reference path="../matches/match-000001/player-b.xml" classification="player_b_perspective" />
    <reference path="bug-000001.diagnostics.xml" classification="privileged_debug_only" />
  </attachments>
  <diagnosis>
    <known_facts />
    <hypotheses />
    <next_investigation_step>State a concrete next step; do not assert an unverified root cause.</next_investigation_step>
  </diagnosis>
  <acceptance_criteria>
    <criterion>Cover the captured case with an appropriate regression scenario.</criterion>
    <criterion>Correct the diagnosed defect and pass selected validation.</criterion>
    <criterion>Run the affected scenario and confirm execution progresses without the same failure.</criterion>
  </acceptance_criteria>
</bug-ticket>
```

Group repeated failures into a ticket by stable failure signature and append every occurrence. Preserve per-occurrence evidence in its diagnostic file. Creating these local artifacts does not automatically publish Linear issues; external synchronization is outside this ticket.

### 10. Restricted bug evidence: `bugs/<bug-id>.diagnostics.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<diagnostics xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" schema_version="1">
  <bug_id>bug-000001</bug_id>
  <classification>privileged_debug_only</classification>
  <failure_signature>&lt;hex&gt;</failure_signature>
  <occurrences>
    <occurrence>
      <occurrence_id>occurrence-000001</occurrence_id>
      <run_id>run-20261104-001</run_id>
      <match_id>match-000001</match_id>
      <game_id>match-000001-game-3</game_id>
      <phase>game</phase>
      <player>b</player>
      <evidence_sha256>&lt;partial-evidence-hex&gt;</evidence_sha256>
      <failure>
        <category>timeout</category>
        <message>No decision completed within the configured limit.</message>
        <stack xsi:nil="true" />
        <limit_ms>1000</limit_ms>
        <last_progress_sequence>42</last_progress_sequence>
      </failure>
      <identity>
        <manifest>../manifest.xml</manifest>
        <bot_artifact_sha256>&lt;hex&gt;</bot_artifact_sha256>
      </identity>
      <last_checkpoint>
        <captured_at>2026-11-04T12:00:03Z</captured_at>
        <pending_prompt />
        <attempted_response xsi:nil="true" />
        <recent_engine_events />
        <private_engine_state xsi:nil="true" />
        <bot_debug_state xsi:nil="true" />
      </last_checkpoint>
      <unavailable_evidence>
        <reason>Worker was unresponsive; state at termination could not be queried.</reason>
      </unavailable_evidence>
    </occurrence>
  </occurrences>
</diagnostics>
```

Only write this file after encountering a bug. Keep bounded diagnostic buffers/checkpoints in memory during execution, separate from bot-visible inputs. On failure flush available evidence; the supervisor must retain enough recent evidence to create a ticket even when the Worker cannot respond. Never pretend unavailable state was captured. Diagnostics exclude credentials and unrelated machine/user data.

## Performance requirements

Games should complete in seconds, including normal mandatory full decision/event logging. Measure cold startup separately from warm games, and attribute engine, bot, and serialization/write time. Stream persistence and use bounded buffers instead of retaining the whole batch in memory. Avoid repeated card metadata/full-zone dumps and repeated content loading.

Before implementation acceptance, establish a documented numeric warm-game latency target on named hardware using the fixed mirror deck and both pre/post-side configurations. The owner has not yet specified that threshold; the example watchdog settings are not the performance target. Include p50/p95/p99/max game latency, completed games/second, decision latency, and peak memory in the delivered benchmark.

## Acceptance criteria

 1. The CLI accepts one validated deck, two bot configurations, a match count, limits, starting-order mode, and output destination.
 2. Each completed match executes exactly two pre-side and two post-side games, with each player starting once per stage. Execution is sequential.
 3. Both bots sideboard independently from their permitted pre-side observations; legal exchanges are validated and frozen for both post-side games.
 4. The exact bot artifacts and play/sideboarding contracts are usable in the actual duel simulator. Contract tests verify equivalent decisions for equivalent permitted inputs, with controlled bot randomness only where necessary for the test.
 5. Both player-perspective XML reports contain initial conditions, all observed actions, and every own choice with its legal alternatives and bot-provided reason, without repeated full-zone snapshots or concealed opponent information.
 6. Every completed or failed game has saved evidence and a canonical evidence hash. Failed games preserve partial evidence; skipped games are explicit.
 7. The XML summary and XML evaluation report contain the retained decision-focused statistics, explicit denominators, and clear failure accounting. Removed chance/deck-construction and starting-player statistics are absent.
 8. Saved baseline comparisons check configuration compatibility, quantify result/behavior/reliability changes, and link to decision evidence. They do not claim improvement from symmetric self-play win rate alone.
 9. Every crash, hang, invalid decision, unsupported prompt, sideboarding failure, or safety-limit breach produces a detailed local XML bug ticket and a separate restricted XML diagnostic file. Successful execution creates no privileged diagnostic files.
10. A watchdog can terminate a stuck engine/bot Worker, preserve available evidence, mark the match incomplete, and allow the next match to run. Failures never become competitive losses or draws.
11. A 10,000-match sequential soak run accounts for all 40,000 scheduled games as completed, failed, or skipped, demonstrates bounded memory and handle cleanup, and reports performance against the agreed numeric target.
12. Interrupted execution preserves finalized evidence; resuming at the next unstarted match neither overwrites completed records nor double-counts results. Interrupted match evidence remains marked incomplete.
13. Validate real-core execution, visibility boundaries for both actors, legal sideboarding, schema/report accounting, failure recovery, and equivalent bot integration using the repository's targeted-test workflow. Do not run the full suite unless explicitly requested.
14. Every persisted system result is XML for AI-agent consumption. No human-facing documents, rendered reports, dashboards, or alternate result formats are generated. Explanations, bug tickets, and analysis indexes remain structured XML evidence.

## Not included

Human-facing result documents or presentation layers, parallel execution, multiple input decks or deck optimization, conventional best-of-three tournament rules, automatic bot source rewriting/promotion, external issue publication, deterministic seed scheduling, and a promise of deterministic replay from a hash alone.
</description>
<team name="aron"/>
<label>Feature</label>
<project name="Ascencio"/>
<issue-relations><blocked-by><issue-ref identifier="ARO2-2" title="Build Baseline General AI Bot"/></blocked-by></issue-relations>
</issue>