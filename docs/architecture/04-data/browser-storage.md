# Browser Storage

> Status: accepted

## IndexedDB (`idb`)

Store snapshot metadata, active/previous snapshot pointers, preferences, and bounded debug-run metadata. Stage immutable composite activation IDs and switch pointers only after mandatory runtime/image receipts match. Pointer updates use both expected ID and generation, with a database migration preserving legacy runtime-ID records.

## Cache Storage

Store card images and verified runtime artifacts in snapshot/revision-aware namespaces. Bytes enter a cache only after manifest, length, digest, image-dimension, and decode checks as applicable. Cache state is an optimization and cannot determine whether a snapshot is active.

## Local UI preferences

Tiny browser UI prefs use `localStorage`, not IndexedDB. Current accepted successor is [`ADR-020`](../../ADR/020_ADR_browser_persisted_ui_state_v2.md): key `ygo.ui.v2`, deck pair, 2 field-window positions, zone-outline/count flags. Reads/writes are best-effort + never duel authority. Old v1 state resets to complete v2 defaults.

## Reliability rules

- Startup validates schema and revision compatibility.
- Interrupted staging leaves the previous snapshot active.
- Keep one previous known-good snapshot for rollback; a failed current load may reopen the active/previous runtime entirely from its verified cache.
- Coordinate activation/cleanup with a cross-tab Web Lock and compare both pointer ID and generation so stale tabs cannot reactivate old revisions.
- Handle upgrades, abandoned staging, quota errors, interrupted writes, and cleanup explicitly.
- After successful activation, retain cache namespaces only for the active and fallback snapshots.
- Do not perform storage access from synchronous core callbacks.
- Diagnostics expose active/fallback snapshot IDs without leaking unnecessary hidden duel information.
