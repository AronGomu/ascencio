# Upstream provenance

- Project: [AgentSystemLabs/core](https://github.com/AgentSystemLabs/core)
- Commit: [`1174de2c92a343179a5af16eb8d168d0d3666cb0`](https://github.com/AgentSystemLabs/core/commit/1174de2c92a343179a5af16eb8d168d0d3666cb0)
- Plugin: `agentsystem-core`
- Version: `0.55.0`
- Author metadata: `webdevcody`
- Retrieved: 2026-07-31
- Archive SHA-256: `aab9164ea8b82b5376b9223ac32f6a40810908f44c43335990477d576e0b5c4c`
- License: MIT; see [`LICENSE`](LICENSE).

## Project-local adaptation

`SKILL.md` adds Pi compatibility rules for unavailable Claude-specific tools (`AskUserQuestion`, `Agent`, `Task`, plan-mode tools, plugin-root resolution). Bundled playbooks, refs, reviewer prompts otherwise match upstream commit. Upstream plugin-level `findings-contract.md` is copied into skill root because reviewer links resolve there after standalone project install.

Install scope intentionally contains published `ship` skill only. Repository contributor skills `diagram` plus `recall` are not part of published AgentSystem core plugin/install payload.
