---
name: make-glossary-aron
description: Create and continously update GLOSSARY.md tracking shared vocabulary between user and agents.
disable-model-invocation: true
---

# make-glossary-aron

Maintain `GLOSSARY.md` to give user single words to name parts of codebase to update.

Goal : Simplify communication between User & Agents.

## Inputs

1. (Optionnal) path/to/project. If not given, default to current project.

## Const

Path `GLOSSARY.md` = `{project_root}/docs/GLOSSARY.md`

## Setup

### Generate glossary

Search GLOSSARY.md in project.
If not found -> create it.
If found but not correct path -> move to correct location
Else -> Skip pre-flight

### Scan project

Read glossary.
If project already scanned -> skip.
Else -> Spawn `code-investigator` agent. Task : analyse codebase, identify patterns that can be identified with single word and add them.

### Link to CONTEXT.md

1. Identify default init context file used.
2. If `make-glossary` skill not mentionned -> Add line : "Read and activate {absolute/path/to/glossary/skill}".

## Process

If activated :

### Active Interaction

Whenever discover opportunity to add word to glossary -> Propose user addition to glossary

### Autonomous

Whenever discover opportunity to add word to glossary -> Add to glossary. Do not ask user.

## Glossary Format

```md
# Glossary

[ ] Activated
[ ] Project scanned

## Frontend

| word     | short description          | ref in code                                                    |
| -------- | -------------------------- | -------------------------------------------------------------- |
| {word 1} | {Description in few words} | {references of variables and/or data structures from codebase} |
| {word 2} | {...}                      | {...}                                                          |
| {word 3} | {...}                      | {...}                                                          |
| ...      |

## Backend

| word     | short description          | ref in code                                                    |
| -------- | -------------------------- | -------------------------------------------------------------- |
| {word 1} | {Description in few words} | {references of variables and/or data structures from codebase} |
| {word 2} | {...}                      | {...}                                                          |
| {word 3} | {...}                      | {...}                                                          |
| ...      |

## Other

| word     | short description          | ref in code                                                    |
| -------- | -------------------------- | -------------------------------------------------------------- |
| {word 1} | {Description in few words} | {references of variables and/or data structures from codebase} |
| {word 2} | {...}                      | {...}                                                          |
| {word 3} | {...}                      | {...}                                                          |
| ...      |
```

## Exemples

### Exemple 1 — Web app (React + Express)

```md
# Glossary

[ ] Activated
[x] Project scanned

## Frontend

| word  | short description                                    | ref in code                                          |
| ----- | ---------------------------------------------------- | ---------------------------------------------------- |
| shell | app frame: sidebar + topbar + outlet, always mounted | `src/layouts/AppShell.tsx`                           |
| card  | product tile shown in listing grid                   | `src/components/ProductCard.tsx`, `ProductCardProps` |
| store | global zustand state (user, cart, theme)             | `src/store/index.ts`, `useAppStore`                  |
| gate  | route wrapper redirecting anon users to /login       | `src/routes/AuthGate.tsx`                            |

## Backend

| word    | short description                               | ref in code                                  |
| ------- | ----------------------------------------------- | -------------------------------------------- |
| gateway | express entry point, mounts all routers         | `server/app.ts`, `createApp()`               |
| guard   | auth middleware verifying JWT, fills `req.user` | `server/middleware/auth.ts`, `requireAuth`   |
| repo    | DB access layer, one file per table             | `server/repositories/*.ts`, `UserRepository` |
| job     | background worker consuming the redis queue     | `server/jobs/worker.ts`, `enqueue()`         |

## Other

| word     | short description                                    | ref in code                |
| -------- | ---------------------------------------------------- | -------------------------- |
| contract | shared request/response types between front and back | `packages/shared/types.ts` |
| seed     | script filling dev DB with fake data                 | `scripts/seed.ts`          |
```

User says "fix the card" -> agent knows `ProductCard.tsx`.
User says "add rate limit in the gateway" -> agent knows `server/app.ts`.

### Exemple 2 — Nix config repo

```md
# Glossary

[] Activated
[x] Project scanned

## Other

| word    | short description                           | ref in code                                |
| ------- | ------------------------------------------- | ------------------------------------------ |
| flake   | root entry, defines hosts + inputs          | `flake.nix`, `outputs.nixosConfigurations` |
| host    | one machine definition                      | `hosts/<name>/default.nix`                 |
| disk    | declarative partitioning of a host          | `hosts/<name>/disko.nix`                   |
| home    | user-level config (dotfiles, shell, editor) | `home/aron.nix`, `home-manager.users.aron` |
| dots    | raw dotfiles copied into home               | `dotfiles/`                                |
| rebuild | apply config to running system              | `nixos-rebuild switch --flake .#<host>`    |
```

### Rules for good words

- 1 word, lowercase, no space.
- Word must be unique in glossary. No synonym duplicates.
- Description <= 10 words.
- No vague ref. `ref in code` must point at real file/symbol.
- Prefer word user already says in chat over invented word.

## Commands

`/make-glossary on` -> check `GLOSSARY.md` activated checkbox. Activate skill.
`/make-glossary off` -> uncheck `GLOSSARY.md` activated checkbox. Deactivate skill.
