# GOAT Control bot

[bot.ts](bot.ts) exports a functional TypeScript generalist baseline paired with the GOAT Control deck by [evaluation.json](evaluation.json). It has no GOAT-specific scoring yet. In Freeplay, select Generalist and the desired deck independently.

- Shared policy: [generalist bot](../../../src/battle/worker/bot/generalist-bot.ts)
- Strategy scoring: [generalist strategy](../../../src/battle/worker/bot/generalist-strategy.ts)
- Deck fixture: [GOAT Control](../../../test/fixtures/decks/pre-gx-2005/pre-gx-2005-goat-control.ydk)

Implement specialized strategies through the shared TypeScript strategy seam. Rust strategy implementation is retired by [ADR-106](../../../docs/ADR/106_ADR_typescript_ai_bot_strategies.md).
