# TypeScript reference bots

Basic, Generalist and Random use the canonical implementations in `src/battle/worker/bot/`. The adjacent TypeScript entrypoints export their module factories for evaluation. `evaluation.json` selects `builtin:generalist`; set its module to `builtin:basic` or `builtin:random` to evaluate those policies.

The `ai/`, `dist/`, and `bot.json` files are retained Rust experiment artifacts only. Application, evaluation setup and candidate validation do not execute or compile them. See [ADR-106](../../../docs/ADR/106_ADR_typescript_ai_bot_strategies.md).
