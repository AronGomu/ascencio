# Card Images

> Status: implemented SQLite media lifecycle; distribution review required

Available full/cropped/set media resides in immutable `card-library` package BLOBs. Chapter-specific media resides in chapter package. Image status is diagnostic only and never determines legal input.

## Coverage and delivery

- C1. Producer reports missing optional media; it never invents bytes or hides source gaps.
- C2. Browser app does not hotlink providers or fetch package media from configured download links.
- C3. SQLite Worker queries requested media only, verifies present bytes, and emits typed missing/corrupt/unreadable warnings.
- C4. DOM consumers acquire bounded in-memory Blob URL leases; unleased URLs revoke on eviction/mode close.
- C5. Missing optional media renders deterministic placeholder. Corrupt present media fails package verification.

## Rendering and privacy

Render face-up images where applicable. Hidden cards use card back without identity-specific query or URL creation. Presentation, accessibility, screenshots, and routine diagnostics must not expose concealed opponent identity.

## Build boundary

Card/set/chapter images remain outside JavaScript bundle, `generated/build/app/`, and shell precache. `scripts/verify-browser-build.ts` rejects media leakage. Source archives remain outside Git unless explicitly tracked app/source policy says otherwise.

Technical availability is not permission to redistribute; see [`../07-governance/licensing-and-distribution.md`](../07-governance/licensing-and-distribution.md) and [`../../assets/manual-sqlite-setup.md`](../../assets/manual-sqlite-setup.md).
