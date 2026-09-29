# Security and Trust Boundaries

> Status: accepted

- S1. Load only pinned project Lua/scripts plus validated immutable package data. User-selected SQLite is untrusted data, never executable SQL/JS authority.
- S2. Package parser rejects unexpected schema objects, paths, rows, identities, hashes, dependencies, and oversized payloads. Runtime queries are fixed and parameterized; package DBs open read-only with `trusted_schema=OFF`.
- S3. Keep OCG engine and SQLite storage in separate dedicated Workers. UI receives typed clone-safe data; no DB handle, raw SQL, raw OCG protocol, or arbitrary filesystem operation crosses UI boundary.
- S4. Never trust DOM/presentation state for legality or engine responses. Conceal hidden identities from plain UI, accessibility, image requests, screenshots, routine logs, and diagnostics.
- S5. Treat backups and diagnostics as sensitive local artifacts. Backup restore is validated, revision-checked, confirmed replacement; package lifecycle never mutates user data.

## Supported operational boundary

- B1. Producer/source tooling assumes trusted config and one cooperative writer on stable local Linux/Node filesystem. Hash/receipt checks prevent accidental clobber; they do not defeat malicious same-user mutation, hostile plugins, or filesystem time-of-check/time-of-use attacks.
- B2. Browser target is trusted app code in current desktop Chromium/Vite deployment. One lifetime Web Lock excludes second-tab SQLite ownership; this is coordination, not adversarial origin isolation.
- B3. Package hashes prove corruption/identity, not publisher authenticity. Signatures remain out of scope; keep distribution private until source/rights/link approval.
- B4. Future plugins, arbitrary SQL/extensions, untrusted producer code, other platforms/filesystems, multi-tab storage, signed/public distribution, or competitive multiplayer require new threat model and acceptance evidence.
- B5. Client-side authority is acceptable only for offline single-player; future competitive multiplayer requires server-authoritative engine.
