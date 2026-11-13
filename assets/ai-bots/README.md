# AI bot packages

Independent TypeScript packages for [Basic](basic/), [Generalist](generalist/), [Random](random/) and [GOAT Control](goat-control/), using a shared [execution SDK](../../src/battle/worker/bot/strategy-bot.ts). See [build commands](../../docs/development-commands.md#ai-bot-package-builds), [evaluation rules](../../docs/architecture/06-quality/parallel-bot-session.md) and [ADR-106](../../docs/ADR/106_ADR_typescript_ai_bot_strategies.md).

```text
<bot>/
├── README.md                 # Package guidance for humans and coding agents
├── bot.json                  # Identity and resource paths for build/evaluation tools
├── settings.json             # Scalar configuration read by evaluation setup
├── evaluation.json           # Evaluation module, deck, content, rules and profile
├── ai/
│   ├── tsconfig.json          # TypeScript project settings
│   ├── index.ts               # Executable bot factory and policy composition
│   ├── tactics/selection.ts   # Basic's action selection and loop handling
│   └── evaluation/scoring.ts  # Generalist/GOAT Control's independent scoring
├── decks/default.ydk          # Recommended deck read by the evaluator
└── dist/ai.mjs                # Generated executable bundle; do not edit
```
