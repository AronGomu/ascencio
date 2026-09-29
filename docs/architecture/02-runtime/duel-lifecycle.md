# Duel Lifecycle

> Status: accepted and implemented

## Flow

1. F1. Shell acquires active package session/generation; Free Play requires `duel-core` + `card-library` + `freeplay`, Story duel additionally uses chapter package.
2. F2. SQLite adapters load validated deck/opponent/limits, engine config/bytes, card records/text/strings, required Lua, and presentation media source into semantic Battle ports.
3. F3. Main thread sends `initialize`; Duel Worker validates immutable runtime input and preloads synchronous indexes/maps.
4. F4. Main thread sends `startDuel` with validated card lists/ruleset/opponent input. Worker creates duel, adds cards, configures LP/draw/Master Rule, and starts processing.
5. F5. Worker processes messages, projects state, emits events, and pauses only for human input.
6. F6. Human choices return by prompt/choice ID; opponent prompts use Worker policy.
7. F7. Session ends on `MSG_WIN`, surrender, bounded timeout, unsupported message, or engine error.
8. F8. Worker emits structured result/diagnostic, destroys duel handle, then Shell closes media/input leases, flushes user writes, and releases package session.

Package import/removal, backup restore, and app-update approval are blocked during active session. No SQLite query occurs from synchronous OCG callbacks.

## Randomness and replay

- R1. Every production duel receives fresh non-zero seed. Application-owned `EVENT_STARTUP` script asks real core to shuffle both decks before normal opening draws; repeated production tests require varied hands.
- R2. Deterministic seed/order/response and compatibility-startup-script injection exists only on internal programmed-session config. No public Worker command can select it.
- R3. Every run records seed, package/runtime revisions, and ordered responses in bounded diagnostics. Diagnostics remain operational data, not `user-data.sqlite` backup content.

## Lifetime rules

- L1. One live duel per Duel Worker; one package generation lease per mode session.
- L2. `dispose` is idempotent and cleans partial initialization too.
- L3. Restart disposes current session before replacement.
- L4. If graceful disposal exceeds timeout, terminate and replace Duel Worker; SQLite Worker/package session remains separately owned by Shell lifecycle.
- L5. Processing has iteration/time guards and reports last message/prompt on failure.
