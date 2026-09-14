# ADR-094: User-controlled media, updates, asset cleanup

> Status: accepted; planned
> Decided: 2026-09-13
> Owners: shell lifecycle / content / PWA
> Amends: ADR-086 D4–D5; ADR-078 D1–D4; ADR-079 D2; ADR-088 D3–D5; ADR-039 §§1–3
> Baseline: `010401956d0cd59d8e6dda91bd367040f5de669e` — inspected integration source, not implementation evidence for this decision.

## Context

Images/audio/video can be absent while gameplay metadata remains valid. Existing Story map/image acquisition failures currently lock domains. A waiting service worker alone is not consent: it may activate when all old clients close. Product needs independent explicit CORE/content approval and offline play regardless of update checks.

## Decision

D1. Required runtime/gameplay/story metadata gates play. Images/audio/video are optional, explicitly downloaded after required data. Missing/corrupt media returns null and prominent persistent warning/placeholders. No implicit network acquisition, no live upstream fallback, no deck-invalid result for missing art.

D2. Content update approval stages required files and activates only at Main Menu under exclusive lifecycle lock. Optional-media download never changes active content/save generation. Installed release is read before any remote update check; network/catalog failure leaves installed play available.

D3. CORE updates require explicit candidate approval and compatibility with installed content. Updated service-worker install checks approved candidate; first install is exempt. No skipWaiting, no live clients.claim, no forced reload. Approved waiting CORE activates after all game clients close; UI instructs safe close/reopen from Main Menu. Approval never grants content download.

D4. Explicit Delete unused assets removes downloaded file identities outside active manifest only. Delete all assets removes downloaded Content bytes/metadata, clears playable Content selection, preserves Story generations/saves, Decks, settings, CORE shell caches. No silent local asset deletion, no save deletion to unblock cleanup.

D5. Cleanup uses Main Menu/exclusive lifecycle coordination; active domain tabs or download jobs block. Partial deletion failure remains visible and retryable. Missing required bytes keep gameplay gated until explicit install/repair; asset removal cannot erase saved progression. Deliberate user save/admin deletion remains separate confirmation.

## Consequences

C1. Offline play and player-controlled bandwidth/storage are explicit; media no longer dictates legality.

C2. Players must initiate media batches and close tabs for CORE activation. Suspended tabs can block updates indefinitely. Delete all assets deliberately removes offline gameplay until reinstall, while retaining save bytes.

## Alternatives rejected

A1. Forced combined CORE/content upgrade: violates separate consent.

A2. On-demand network media fetch: hidden acquisition.

A3. Treat waiting worker as consent: browser can activate it on later cold start.

A4. Automatic cache eviction/prune by app: violates explicit cleanup; browser-origin eviction remains outside app control.
