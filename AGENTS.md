# Project navigation

Read [the project guide](docs/project-guide.md) for operating rules and local-only validation.

| Task | Entry point |
| --- | --- |
| Locate source ownership or files | [Repository map](docs/repository-map.md) |
| Architecture and domain boundaries | [Architecture router](docs/architecture/architecture.md), [ADR-022](docs/ADR/022_ADR_three_ui_modular_monolith_and_worktree_boundaries.md) |
| Select and run checks | [Test skill](.agents/skills/ascencio-tests/SKILL.md) |
| Bot improvement | [Improvement skill](.agents/skills/ai-bot-self-improvement/SKILL.md), [parallel sessions](docs/architecture/06-quality/parallel-bot-session.md) |
| Runner performance | [Implementation plan](docs/architecture/06-quality/typescript-runner-performance-implementation-plan.md) |
| Agent inspection and iteration | [Agent tools](docs/developer-guide/agent-tools.md) |
| Repository cleanup | [Cleanup workflow](docs/repository-cleanup.md) |
| Content and assets | [Startup content](docs/assets/startup-memory-content.md) |
| Commands and setup | [Commands](docs/development-commands.md), [desktop setup](docs/desktop-setup.md) |

When files are added, removed, moved, or change responsibility, review and update the repository map in the same change. Directory entries cover descendants; content-only edits need no artificial map change.
