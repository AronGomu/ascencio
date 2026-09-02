# ADR-066: Real card back is an optional runtime asset with SVG fallback

> Status: accepted; planned
> Decided: 2026-09-02
> Owners: battle assets / image pipeline
> Relates: ADR referenced by the asset pipeline docs for card art (`docs/assets/asset-import-pipeline.md`); same licensing posture

## Context

Every hidden card and pile stack renders a generated SVG data-URL back (teal default in `DuelField.svelte`, purple/gold in `card-image-cache.ts`). Owner feedback round 2026-09-02: "Replace the card back placeholder by actual YGO card back. Fetch asset online if needed."

The real Yu-Gi-Oh! card back is Konami-copyrighted artwork. The existing card-art pipeline already answers the same problem for card faces: art is fetched by script into gitignored `generated/card-images/`, served through the `runtime/` middleware allowlist (`scripts/lib/vite-runtime-assets.ts`), and carries `redistributionApproved: false` — the repo never redistributes the artwork, each checkout fetches its own copy. The product is offline-first: a build where the fetch never ran must still render every hidden card.

## Decision

1. The card back is fetched once by `scripts/download-card-back.ts` into gitignored `generated/card-images/card-back.jpg`. It is never committed.
2. It is served at `runtime/images/card-back.jpg` via the existing runtime-asset allowlist, dev and production build alike; a missing file never fails the build.
3. At image-library creation the app probes the URL once (`HEAD`); success swaps `cardBackUrl` to the real asset, failure keeps the generated SVG. The probe failure is silent by design — offline is a normal state, not an error.
4. The SVG data-URL constants stay in code permanently as the fallback tier. They are not dead code.

## Consequences

- A fresh checkout that skips the fetch script ships the SVG back. Screenshots and e2e snapshots differ between fetched and unfetched environments; tests that assert back-image content must branch on availability or pin the SVG path.
- One extra `HEAD` request per session.
- The repo stays clean of Konami artwork; the cost is that "actual YGO card back" is an environment property, not a repo guarantee.

## Alternatives rejected

- **Commit the image to `public/`.** Simplest and always-on, but puts copyrighted artwork in the repository history forever — the exact thing the card-art pipeline's `redistributionApproved: false` posture exists to avoid.
- **Draw a high-fidelity look-alike SVG.** A near-copy of the trademarked spiral is the same legal exposure with worse pixels.
- **Fetch lazily from the network at runtime (no local asset).** Leaves the duel dependent on a third-party CDN mid-game and violates the offline-first baseline.
