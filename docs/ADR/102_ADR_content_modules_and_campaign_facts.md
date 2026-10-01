# ADR-102: Content modules and campaign facts

> Status: accepted
> Date: 2026-10-01
> Scope: card/chapter composition, prerequisites, progression and save continuity

Use a manifest-driven module registry, dependency graph and versioned campaign facts. Retain existing validated package lifecycle and atomic generation activation rather than introduce another installer. SQLite remains the content transport; user persistence uses JSON/localStorage under ADR-101.

Installed dependencies describe required content files. Story prerequisites describe completed chapters and namespaced facts stored in the campaign save. A later chapter can therefore use earlier outcomes while the earlier chapter's package is absent. Module lifecycle never reads or edits saves. Removing needed card content remains forbidden by declared dependencies and cross-module reference validation.

Card packs compose one validated catalog with collision checks, cached metadata, an in-memory prefix index and media ownership routing. Chapter modules declare API version, progress prerequisites, completion rules and choice scene ID. Unsupported contracts fail before activation.

Saves preserve stable document/scene IDs, completed chapters, unknown namespaced facts, economy and save-owned decks. Continue may transition to a later eligible installed chapter after completion. Version-6 saves without these optional fields remain readable; missing scenes or modules fail explicitly without altering stored progress.

Authoring format and current vocabulary limits are documented in [content-modules.md](../assets/content-modules.md). New gameplay/presentation types still require an application extension; content packages do not execute arbitrary application code.
