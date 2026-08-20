<script lang="ts">
  import { onMount } from "svelte";
  import type { ChoiceId } from "../../duel/contracts/ids.ts";
  import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
  import PromptControls from "../prompts/PromptControls.svelte";

  export let prompt: PlayerPrompt;
  export let disabled = false;
  export let onsubmit: (choiceIds: readonly ChoiceId[]) => unknown;

  let panel: HTMLDivElement | undefined;

  onMount(() => {
    panel
      ?.querySelector<HTMLElement>("button, input, select")
      ?.focus({ preventScroll: true });
  });
</script>

<div class="dialog-backdrop" data-cy="prompt-dialog-backdrop">
  <div
    class="dialog-panel prompt-dialog-panel"
    role="dialog"
    aria-modal="true"
    aria-label={prompt.title}
    data-cy="prompt-dialog"
    bind:this={panel}
  >
    <PromptControls
      {prompt}
      {disabled}
      onsubmit={(choiceIds) => {
        onsubmit(choiceIds);
      }}
    />
  </div>
</div>
