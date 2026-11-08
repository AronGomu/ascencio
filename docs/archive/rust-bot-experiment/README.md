# Retired Rust reference bot

`reference/` preserves the Rust experiment's source and manifest. It is not a current AI bot package. Historical build and transport commands in `scripts/bot-experiment/` use this location; they may require rebuilding the archived WASM/native outputs with the original toolchain. Retained measurement files record their original paths as provenance.

Current editable TypeScript packages live under `assets/ai-bots/`; see that directory's README and ADR-106. Generated Cargo targets and distribution outputs are not part of the archived source contract.
