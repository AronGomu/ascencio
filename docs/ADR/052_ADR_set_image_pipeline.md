# ADR-052: Set image pipeline

Status: accepted · 2026-08-20 · Commit: `9d8b8a7` — T31, T32
Relates: ADR-039 (editor card art via static runtime URLs)

## Context

Shop set tiles were text: name and year on a panel. Feedback wants the real set images.

The project already has two asset disciplines:

- **Verified snapshot** (duel card art): hash-verified downloads, Cache Storage, object-URL leases, decode validation, activation as one snapshot. Engine-adjacent, adversarial, expensive.
- **Static runtime URLs** (ADR-039, editor art): derive `{BASE_URL}runtime/images/{code}.jpg`, let the browser cache it, treat a broken image as a broken `<img>`.

Set images are decoration on a shop screen. But a build should still be reproducible, and an unpinned download would make it not.

Upstream is not a new dependency: `db.ygoprodeck.com` already supplies this project's card data and card art. `cardsets.php` returns `{ set_name, set_code, tcg_date, set_image? }`, where `set_image` is `images.ygoprodeck.com/images/sets/{CODE}.jpg` — verified reachable (`LOB` → 200, ~72 KB). Some sets have no `set_image` at all (for example `STAX`).

## Decision

**Verified at build, plain at runtime.**

- `npm run assets:sets` downloads each shop set's image into `generated/set-images/` and writes a sha256 manifest of `{ setId, sha256, bytes, sourceUrl }` plus a `missing` list.
- `npm run assets:sets:verify` re-hashes every file and fails on any mismatch, missing file or manifest disagreement. It joins `assets:verify`, so `check:headless` covers it, and it runs offline.
- At runtime the images are plain static URLs, `{BASE_URL}runtime/sets/{setId}.jpg`, served through the same Vite runtime-assets mechanism as card art.
- A set with no upstream image renders a **typographic tile**: set code and year on a flat panel. Missing art is never an error and never removes buyable content.
- Files live in `generated/` (git-ignored). They are acquired, not committed.

## Consequences

- Reproducible builds keep their guarantee: the bytes are pinned by hash.
- A missing or broken set tile is a broken tile, not a duel-blocking snapshot failure. Decoration never gains the power to stop the engine.
- Contributors run one more acquisition command; verification tells them when they have not.
- ~50 images at tens of kilobytes each: single-digit megabytes, outside git.
- The typographic fallback is a permanent code path, not a stopgap — upstream coverage will always be partial.
