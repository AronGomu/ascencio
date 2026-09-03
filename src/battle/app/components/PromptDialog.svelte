<script lang="ts">
  import { onMount } from "svelte";
  import type { ChoiceId } from "../../duel/contracts/ids.ts";
  import type { PlayerPrompt } from "../../duel/contracts/player-prompt.ts";
  import PromptControls from "../prompts/PromptControls.svelte";
  import type { PromptMessageSegment } from "../presentation/prompt-context-message.ts";

  export let prompt: PlayerPrompt;
  export let disabled = false;
  export let onsubmit: (choiceIds: readonly ChoiceId[]) => unknown;
  export let contextMessage: readonly PromptMessageSegment[] = [];

  let panel: HTMLDivElement | undefined;

  onMount(() => {
    panel
      ?.querySelector('[data-cy="prompt-controls-heading"]')
      ?.classList.add("ui-dialog-title");
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
      {contextMessage}
      onsubmit={(choiceIds) => {
        onsubmit(choiceIds);
      }}
    />
  </div>
</div>
