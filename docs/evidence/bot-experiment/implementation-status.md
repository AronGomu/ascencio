# ARO2-14 implementation and acceptance handoff

Application integration, isolated transports, package pinning, selection and
failure recovery are implemented. Recorded parity and supported runtime smoke
pass. Two concrete environment limitations prevent claiming full acceptance:
full application startup lacks the pinned 1.1.3 content, and Electron refuses
browser-wide memory measurement. See [attempted commands and errors](environment-blockers.md).
The parent owns exact-head reviews and integration; no reviewer, PR, merge, remote
CI, ticket closure or external message was dispatched by this implementation.

| Criterion | Implementation evidence / status | Owner and required remaining input |
| --- | --- | --- |
| C1 retained TS baseline | Pass: immutable 40-game artifact and README provenance; no regeneration | Implementation; complete saved inputs/seeds/source/deck/content identities retained |
| C2 action parity | Pass: native-parity.json and wasm-parity.json, 22,158 decisions and 20 sideboards each; replay state/reset and divergence command retained | Implementation; scenario-bounded, not exhaustive strategy coverage |
| C3 live flows | Pass: native-live.json, wasm-live.json, browser-wasm-smoke.json, tauri-native-smoke.json, tauri-wasm-smoke.json, packaged-harness-*-smoke.json; each has 40 completed games, 20 real sideboard responses, zero crashes/illegal/unexpected fallbacks | Implementation; independent from parity and timing |
| C4 supported environments | Implemented: shared Rust crate, TS unchanged, browser development package server, native dev/release staging, evaluator; optimized frontend build passes; packaged bot harness passes | Environment owner: supply content matching unchanged assets/critical-release.json for full application startup acceptance |
| C5 boundary and transport | Pass: asynchronous serialized controller, nested isolated WASM Worker, Worker→main→Tauri→bounded native child, permitted observations only; engine/vendor unchanged | Implementation; targeted lifecycle and native timeout tests retained |
| C6 packages/version lifetime | Pass: assets/ai-bots, native app-data discovery/override, safe relative manifest paths, pinned bytes/digest/version through restore, next-duel reload; fixed browser index | Implementation; loader/version tests and package documentation |
| C7 recovery | Pass: validated Basic fallback, failure counts, dev warning/detailed trace, silent production; actual browser trap and two-second infinite-loop termination, native stalled-process kill, invalid-decision/disposal/sideboard tests | Implementation; no fallback counted as parity or smoke success |
| C8 selection/dependencies | Pass: Freeplay independent selector; per-deck requiredAi; resident Story metadata check reports missing AI on startup menu without opening a duel; start/resume recheck blocks affected duel | Implementation; component, snapshot, handoff tests and isolated browser presentation evidence |
| C9 measurements | Actual release transport compute/round-trip/cold-instance/warm timing, Random control, native process memory, WASM linear memory and separate complete-flow throughput retained | Environment owner: comparable browser-wide heap/process measurement remains blocked by SecurityError; cold samples include normal OS/compiler caches, not forced disk-cold conditions |
| C10 reproducibility/delivery | Commands, package/environment limitations, results and measured recommendation documented; targeted local validation performed | Parent: exact-head three-reviewer rounds and integration gate. Two unrelated Story media assertions reproduce against the base AppShell; see blocker evidence |

All criterion inputs are the acceptance inventory revision 2, referenced by the
implementation evidence record in the parent's shared ledger. That record names
the exact final commit and validation references. The absence of a repository
merge gate is a parent integration responsibility, not something this experiment
changes. The baseline TypeScript policies, BasicOpponentPolicy and frozen vendor
remain byte-identical to the fetched base.
