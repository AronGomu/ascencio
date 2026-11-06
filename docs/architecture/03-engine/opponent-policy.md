# Opponent Policy

> Status: accepted

The MVP opponent is deterministic, pure, and specific to its bundled straightforward deck. It is not a general Yu-Gi-Oh! AI.

## Inputs and output

The policy receives typed legal prompts plus permitted visible/projected state. It returns one legal choice and a machine-readable decision reason. It cannot access the human player's hidden information or raw engine response indexes.

## Decision areas

- Phase progression.
- Normal summon, set, and position priorities.
- Spell/trap activation and chain/pass decisions.
- Target, attacker, and battle-target scoring.
- Mandatory prompt fallbacks.

Each decision-table row has a pure unit fixture. Fixed-seed real-WASM scenarios verify coherent turns and that every reachable mandatory opponent prompt receives a response.

## Generalist and random policies (ARO2-2)

`createGeneralistBotModule` implements the version-1 `BotModule` contract used by the Rust bot evaluator. `createGeneralistBotPolicy(dependencies)` wraps that same module for `HeadlessDuelController`'s `opponentPolicy` option. The existing basic runtime default remains available; no selection UI is required.

The evaluator accepts `builtin:generalist`, `builtin:random`, and `builtin:basic`. Both new policies accept an empty configuration, create fresh game-local state, and retain the declared deck during sideboarding. The evaluator retains bundled source, source hashes, configuration, permitted observations, and decision reasons through its existing evidence format.

The baseline ranks engine-offered choices using board-development priorities and printed attack/defense estimates. It favors summons, tries available effects, enters battle, and avoids attacking into a known stronger monster. It has no card-ID, deck-list, or archetype rules. Estimates do not account for every modifier or effect, and the engine remains the sole legality authority. Unknown identities contribute no card lookup. Position prompts currently carry no card metadata, so position ranking uses a conservative public-board fallback rather than the summoned card’s stats. The actor-observation and prompt projection boundaries remove concealed opponent identities before invocation.

To specialize it, supply a `GeneralistStrategy` as the second argument to `createGeneralistBotModule`. This function receives only `BotDecisionInput` and one offered `PromptChoice`, and returns a finite score plus a reason code and explanation. It can close over public card metadata and composition-specific settings. It must not receive raw engine state. The shared module chooses a feasible selection, validates it, and applies a per-turn/phase repetition penalty after two attempts at the same physical-card/action combination. Fresh instances reset these counters. Runtime execution limits remain enforced by the controller/evaluator. The optional third argument, `GeneralistSelectionStrategy`, receives the same permitted input plus candidate selection counts and returns their preferred order, including zero when empty selection/cancellation is supported. Return a complete permutation so the legality layer can skip counts that cannot satisfy contribution totals. The default preserves minimum-first selection. Invalid, duplicate, omitted, or extra counts are rejected. Do not duplicate those boundaries in a strategy.

`legal-selection.ts` handles counts, ordering, counter capacities, tribute totals, and mandatory/alternative sum contributions. The random module shuffles candidates and feasible-count search order, permutes ordering prompts, and samples available counter allocations. It uses no strategy scores or basic-policy preferences. This is randomized legal play, not a claim of uniform sampling over all combinatorial responses. Production uses `Math.random`; injected random streams are test/diagnostic facilities only and do not affect engine shuffle.

Acceptance requires a declared same-deck, starting-player-balanced ARO2-1 evaluation batch with at least 60% wins over **all completed games**, including draws in the denominator, and zero execution/legality failures. A passing batch establishes only that declared setup, not competitive strength or performance across arbitrary decks.

The retained [ARO2-2 acceptance evidence](../../evidence/aro2-2/README.md) records 99/100 wins in 100 balanced same-deck Freeplay games, with no failures or draws, plus the initial failed batch and its resolved cancellation defect.
