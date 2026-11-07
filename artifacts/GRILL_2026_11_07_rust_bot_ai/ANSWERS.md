# Grill: Rust bot AI migration

Target spec level: 2 — acceptance criteria.

## Established context

- Goal: easily create, add and remove self-contained bots in development and release builds.
- User requested Rust migration and the source folder name ai/.
- Ticket: ARO2-14. Its proposed details require confirmation through this interview.

## Assumptions

- This interview concerns ARO2-14 and does not implement the migration.
- WASM is the proposed distribution format; alternative requirements can be entered in round 1.

## Design tree

- Delivery scope
- Author experience
- Package installation
- Runtime failure behavior
- Migration parity
- Environment coverage
- Updates and missing references
- State lifecycle
