# T11: Inline chain response

**Plan:** `./artifacts/PLAN_2026_08_09_duel_field_feedback_round_2.md`
**Depends:** T2, T8
**Commit outcome:** A chain prompt never opens a modal again: the sources you may activate glow orange on the field and in their pile lists, the preview panel asks "Do you respond?" with animated dots, and a click on empty field passes.

## Context (self-contained)

- Goal: ship 17 duel-field feedback items. This slice is item 16.
- This slice: `src/worker/protocol/PromptRegistry.ts` builds a `chain` prompt titled "Choose a chain response" with one `activate` choice per activatable source plus a `pass` choice when `!message.forced`. `src/app/prompts/prompt-surface.ts` routes it to `"dialog"` whenever `spec.fieldCapable` is false, and `src/app/components/PromptDialog.svelte` renders a full-screen backdrop over the field. Even with T8's stack targets making most chains field-capable, a chain whose source cannot be mapped would still fall through to the modal.
- Out of scope here: deleting `PromptDialog.svelte` (other prompt kinds still need it), engine/protocol changes, the zone list dialog itself (T8 owns it).
- Assumptions in force:
  - **A12** an outside click cancels only a cancelable prompt — and, per T5, only a `multiple`/`order`-family one. A chain is `single`-family, so this ticket gives it a *pass*, not a cancel.
- **From Depends (T2):**
  - `src/app/presentation/preview-status.ts` exports
    ```ts
    export interface CardPreviewStatus { readonly text: string; readonly thinking: boolean }
    export function previewStatusFor(prompt: PlayerPrompt | null, responsePending: boolean): CardPreviewStatus | null;
    ```
    Current rules, in order: `responsePending` → `{ "Waiting for the engine", true }`; `prompt === null` → `{ "Opponent is acting", true }`; otherwise `{ prompt.title, false }`.
  - `CardPreviewPanel` accepts `status: CardPreviewStatus | null` and renders `card-preview-status-text` plus `card-preview-status-dots` (three dots, animated, suppressed under `prefers-reduced-motion`).
  - `App.svelte` computes `$: previewStatus = previewStatusFor($duel.prompt, $duel.responsePending);`.
- **From Depends (T8):**
  - `spec.fieldCapable` includes `stackChoices.size > 0`.
  - `spec.stackChoices` haloes graveyard/banished/deck/extra piles, and `ZoneListDialog` shows per-card action chips whose choices are matched through `InteractionChoice.cardAddress`.
  - `DuelField` owns `openStackId` and renders `ZoneListDialog`.
- **Reference facts:** a `chain` prompt has `minimum: 1`, `maximum: 1`, `cancelable: !forced`, and `promptControlFamily("chain") === "single"`, so `validatePromptSelection` rejects an empty response for it. Passing means submitting the `pass` choice's id, never an empty list.

## Requirements

1. `src/app/prompts/prompt-surface.ts` — a chain prompt never reaches the dialog:
   ```ts
   export function promptSurface(
     prompt: PlayerPrompt | null,
     spec: InteractionSpec | null,
     showWorkspace: boolean,
   ): PromptSurface {
     if (prompt === null) return "none";
     if (showWorkspace) return "docked";
     if (prompt.kind === "chain") return "field";
     if (spec !== null && spec.kind !== "inactive" && spec.fieldCapable) return "field";
     return "dialog";
   }
   ```
2. `src/app/presentation/preview-status.ts` — add a chain rule **between** the `prompt === null` rule and the fallback:
   ```ts
   if (prompt.kind === "chain") return { text: "Do you respond?", thinking: true };
   ```
   Nothing else changes; the `responsePending` rule keeps priority so a sent chain response reads "Waiting for the engine".
3. `src/app/components/DuelField.svelte` — an outside click on a chain prompt passes:
   ```ts
   function chainPassChoice(): InteractionChoice | null {
     if (spec === null || spec.promptKind !== "chain") return null;
     for (const choice of spec.globalChoices.values())
       if (choice.action === "pass") return choice;
     return null;
   }
   ```
   `dismissOnOutsideClick` gains, immediately after the `pending` guard and **before** the `cancelable` / `controlFamily` guards T5 added:
   ```ts
   const pass = chainPassChoice();
   if (pass !== null) {
     const origin = event.target;
     if (origin instanceof Element && origin.closest(INTERACTIVE_SELECTOR) !== null) return;
     dispatch({ type: "chooseChoice", choiceId: pass.id });
     return;
   }
   ```
   A **forced** chain has no `pass` choice, so `chainPassChoice()` returns `null` and the outside click stays inert — correct, because a forced chain must be answered.
4. `src/app/components/duel-field/FieldActionBar.svelte` — no structural change is needed (the `pass` choice is a global choice and already renders as `field-action-bar-choice-<id>`), but its label for a chain must read `Pass` rather than the engine title. Confirm `PromptRegistry` already labels it `"Pass"`; if the rendered button reads anything else, fix the *test expectation*, not the registry.
5. `src/app/App.svelte` — the preview status must also reflect priority while a chain is open. Reuse the existing helper: import `hasDuelPriority` from `src/app/prompts/duel-priority.ts` (kept alive by T3 for exactly this) and pass `data-has-priority={hasDuelPriority($duel.prompt, $duel.responsePending)}` onto the preview panel's status wrapper via a new `CardPreviewPanel` prop `hasPriority: boolean` (default `false`), rendered as `data-has-priority="true"` when set and omitted otherwise. This gives the e2e suite a stable hook and replaces what the deleted `prio-pill` used to expose.
6. Every rendered element keeps a unique kebab-case `data-cy`; this ticket adds no new elements.

## Inputs

- `src/app/prompts/prompt-surface.ts` — full file (16 lines).
- `src/app/presentation/preview-status.ts` — created in T2.
- `src/app/components/CardPreviewPanel.svelte` — the status block added in T2.
- `src/app/components/DuelField.svelte` — `dismissOnOutsideClick`, `INTERACTIVE_SELECTOR`, `dispatch`, `export let spec: ActiveInteractionSpec | null`, `export let pending = false`.
- `src/app/prompts/interaction-spec.ts` — `ActiveInteractionSpec.promptKind: PromptKind`, `globalChoices: ReadonlyMap<ChoiceId, InteractionChoice>`, `InteractionChoice.action: ChoiceAction`.
- `src/app/prompts/duel-priority.ts` — `hasDuelPriority(prompt, responsePending)` returns `prompt !== null && !responsePending`.
- `src/app/prompts/prompt-selection.ts` and `src/app/prompts/prompt-control-family.ts` — why an empty chain response is invalid.
- `src/worker/protocol/PromptRegistry.ts` — the `SELECT_CHAIN` case (`addCardActions(bindings, id, message.selects, "activate", "Chain", text); if (!message.forced) addSimpleChoice(bindings, id, "pass", "Pass");`, title `"Choose a chain response"`, `cancelable: !message.forced`). Read only — do not change it.
- `src/app/App.svelte` — `currentPromptSurface`, the `{#if currentPromptSurface === "dialog" && $duel.prompt}` block, `previewStatus`.
- `tests/unit/prompt-registry.test.ts` (do not break it), `tests/unit/preview-status.test.ts`, `tests/component/DuelField.test.ts`, `tests/component/CardPreviewPanel.test.ts`, `tests/component/PromptDialog.test.ts`, `e2e/duel-smoke.spec.ts`.
- **From Depends:** listed in Context above.

## TDD

1. **Red** — add a `promptSurface` chain case (in the file that already covers `promptSurface`; create `tests/unit/prompt-surface.test.ts` if none exists), the chain case in `tests/unit/preview-status.test.ts`, the two `DuelField` pass cases and the `CardPreviewPanel` priority case. Run `npm run test:unit && npm run test:component`; they must fail.
2. **Green** — implement the four changes.
3. **Refactor** — only if needed. Keep green.

## Test plan

| Test | Input | Expect |
| --- | --- | --- |
| `chain prompts never open the dialog` | `promptSurface(chainPrompt, specWithNoFieldTargets, false)` | `"field"` |
| `chain prompts still dock in the workspace` | `promptSurface(chainPrompt, spec, true)` | `"docked"` |
| `other non-field prompts still open the dialog` | `promptSurface(yesNoPrompt, nonFieldSpec, false)` | `"dialog"` |
| `chain status asks the question` | `previewStatusFor(chainPrompt, false)` | `{ text: "Do you respond?", thinking: true }` |
| `a sent chain response reports the wait` | `previewStatusFor(chainPrompt, true)` | `{ text: "Waiting for the engine", thinking: true }` |
| `outside click passes a chain` | render `DuelField` with a chain spec holding a `pass` global choice `c-pass`; click `duel-field-board-surface` | `oninteraction` receives `{ type: "chooseChoice", choiceId: "c-pass", key }` |
| `outside click cannot pass a forced chain` | same spec with no `pass` choice | `oninteraction` not called |
| `outside click on a card target does not pass` | click a card target inside a chain spec | no `chooseChoice` for `c-pass` |
| `preview panel exposes priority` | render `CardPreviewPanel` with `hasPriority={true}` | `card-preview-status` carries `data-has-priority="true"` |
| `preview panel omits priority when waiting` | `hasPriority={false}` | the attribute is absent |
| `a graveyard chain source haloes its pile` (regression, from T8) | chain spec with one graveyard activation | `field-stack-p0:graveyard` has class `is-actionable` and no `prompt-dialog` renders |

## Impl steps

- [x] 1. Add the three `promptSurface` cases (create `tests/unit/prompt-surface.test.ts` if it does not exist).
- [x] 2. Add the two chain cases to `tests/unit/preview-status.test.ts`.
- [x] 3. Add the three outside-click cases and the halo regression case to `tests/component/DuelField.test.ts`.
- [x] 4. Add the two priority cases to `tests/component/CardPreviewPanel.test.ts`.
- [x] 5. Run `npm run test:unit && npm run test:component`; confirm the new cases fail.
- [x] 6. In `src/app/prompts/prompt-surface.ts`, add the `prompt.kind === "chain"` branch before the `fieldCapable` branch.
- [x] 7. In `src/app/presentation/preview-status.ts`, add the chain rule between the `prompt === null` rule and the fallback.
- [x] 8. In `src/app/components/DuelField.svelte`, add `chainPassChoice()` and the pass branch at the top of `dismissOnOutsideClick`.
- [x] 9. In `src/app/components/CardPreviewPanel.svelte`, add `export let hasPriority = false;` and `data-has-priority={hasPriority ? "true" : undefined}` on the status wrapper.
- [x] 10. In `src/app/App.svelte`, import `hasDuelPriority` and pass `hasPriority={hasDuelPriority($duel.prompt, $duel.responsePending)}` to `CardPreviewPanel`.
- [x] 11. Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:component`.
- [x] 12. Run the chromium e2e suite (see Validation). Update any spec that waited for `prompt-dialog` on a chain — that path is gone by design. Do not weaken any assertion that a chain is answerable.

## Outputs

- Edited: `src/app/prompts/prompt-surface.ts`, `src/app/presentation/preview-status.ts`, `src/app/components/DuelField.svelte`, `src/app/components/CardPreviewPanel.svelte`, `src/app/App.svelte`, plus the four test files and `e2e/duel-smoke.spec.ts` where it drove the chain modal.
- Public contract for successors: `promptSurface` returns `"field"` for every chain prompt outside workspace mode; `previewStatusFor` returns `{ text: "Do you respond?", thinking: true }` for a chain awaiting an answer; `CardPreviewPanel` accepts `hasPriority: boolean` and exposes `data-has-priority="true"` on `card-preview-status`.
- No migration, no config change.

## Validation

- [x] `npm run format:check` exits 0
- [x] `npm run lint` exits 0
- [x] `npm run typecheck` exits 0
- [x] `npm run test:unit` exits 0
- [x] `npm run test:component` exits 0
- [x] chromium e2e exits 0:
  ```bash
  cd /home/aron/projects/ascencio
  timeout 590 nix-shell -p playwright-driver.browsers glib gtk3 nss nspr dbus atk cups \
    libdrm expat libx11 libxcomposite libxdamage libxext libxfixes libxrandr mesa \
    alsa-lib at-spi2-atk at-spi2-core cairo pango xorg.xvfb --run '
  export PLAYWRIGHT_BROWSERS_PATH=/home/aron/projects/ascencio/.tmp/pw-browsers
  npx playwright test --project=chromium
  '
  ```
  **This exact command was verified green by the orchestrator on 2026-08-10** (`1 passed` on `-g "production bundle initializes"`). Run it verbatim from the repo root.
  - `PLAYWRIGHT_BROWSERS_PATH=.tmp/pw-browsers` is mandatory. That directory holds symlinks to the nix-patched browsers in `/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` under the revision names playwright 1.61 expects (`chromium-1228 -> chromium-1217`). The mismatched revision numbers are deliberate and fine.
  - Without the override, Playwright picks `~/.cache/ms-playwright`, whose binaries are unpatched and die with `libglib-2.0.so.0: cannot open shared object file`. That error means the override is missing, not that the `-p` list is wrong.
  - `playwright-driver.browsers` and `xorg.xvfb` are both required in the `-p` list even though Xvfb is never launched. Do not simplify the list.
  - If `.tmp/pw-browsers` is gone, recreate it: `S=/nix/store/8ilw3r312xcs1ylxg4g274rhf2frp9z4-playwright-browsers` (rebuild with `nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link` if the path is garbage-collected), then `mkdir -p .tmp/pw-browsers && cd .tmp/pw-browsers && ln -sfn $S/chromium-1217 chromium-1228 && ln -sfn $S/chromium_headless_shell-1217 chromium_headless_shell-1228 && ln -sfn $S/ffmpeg-1011 ffmpeg-1011 && ln -sfn $S/firefox-1511 firefox-1532`.
  - Run it in the **foreground**, blocking. Runs take 1-5 min; `webServer` builds and starts the preview itself, so do not hand-start `npm run preview`.
  - The duel seed is random per run (`crypto.getRandomValues`). A single pass of a duel-walking test proves little; if a duel-walking test is the one you changed, run the suite 3 times before calling it green.
- [ ] manual check: `npm run dev`; trigger a chain — no modal appears, the preview reads "Do you respond?" with pulsing dots, the activatable source glows orange, clicking it activates and clicking empty field passes
- [x] app functional — a forced chain still demands an answer and cannot be dismissed by clicking away
- [x] commit msg draft: `feat(field): answer chains inline instead of in a modal`
</content>
