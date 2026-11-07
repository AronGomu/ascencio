# ARO2-14 reference workload

The immutable `typescript-baseline.jsonl.gz` contains five four-game matches each
for Basic and Generalist, against the fixed `builtin:basic` opponent, using only
`test/fixtures/decks/pre-gx-2005/pre-gx-2005-goat-control.ydk`. Each game alternates
policy seats; engine player 0 starts. Seeds are `[14000 + match*4 + game, 271828,
314159, 161803]`, repeated across the two policy runs. Rules are MR5.

SHA-256: `28b40b97976cd4986e016ff419488715ddf32129971f4fb951486bf56e8658d8`.
Capture completed before any Rust bot code was written. Bot sources and frozen
vendor are unchanged from `2e9489fb33b4d60cd4c9a541154362059c8f4bb7`.

One prerequisite projection correction was necessary: a Sheep Token equipped in
a spell/trap zone can disappear there. The base projector threw on seed 14003,
turn 16, card 73915052, MOVE from controller 1/location 8/sequence 3 to location
0. This is covered by the equipped-token regression in
`test/unit/duel-state-projector.test.ts`. No strategy or engine behavior changed.
Two preliminary captures failed on that error; a subsequent completed run hit
Node's maximum JSON string length while saving. The retained capture repeats
those same seeds using streaming JSON Lines. It is the sole reference artifact;
future iterations must replay it, not replace it or generate new match seeds.

Records are metadata, ready (bundled source and transitive source files), game
(request plus all host messages), and sideboarding (full request and response).
Every `captured_decision` carries the full permitted observation, prompt including
legal choices, configuration, selected IDs, and explicit empty random draws.
Basic and Generalist consume no randomness. Engine seeds, initial orders, deck
contents and digest, complete immutable card definitions, critical snapshot
SHA-256 digests/manifests, engine version and source revision are retained.

Instances reset per game and for sideboarding, matching the existing evaluator;
state persists across decisions within each game. Both pre-side games feed the
sideboard hook. No cross-match learned memory exists. The capture records both
seats, including the fixed opponent, to support complete live replay comparison.

With Node >=26 and installed dependencies, initial acquisition was:

```sh
node scripts/bot-experiment/capture.ts /path/to/generated/readable-content-v1
```

The command refuses to overwrite the saved artifact. Content roots are read-only;
no machine-specific path is needed when replaying the saved decisions. Detailed
capture I/O is not a bot performance measurement.
