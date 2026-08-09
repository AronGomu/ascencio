<script lang="ts">
  import { endPhaseChoice } from "../../prompts/interaction-spec.ts";
  import type { InteractionSessionAction } from "../../prompts/interaction-session.ts";
  import type { ActiveInteractionSpec } from "../../prompts/interaction-spec.ts";

  export let spec: ActiveInteractionSpec | null = null;
  export let disabled = false;
  export let oninteraction: (action: InteractionSessionAction) => unknown;

  $: choice = endPhaseChoice(spec);

  function handleClick(): void {
    if (disabled || choice === null || spec === null) return;
    oninteraction({
      type: "chooseChoice",
      choiceId: choice.id,
      key: spec.key,
    });
  }
</script>

<button
  type="button"
  class="warning field-end-turn"
  data-cy="field-end-turn-button"
  disabled={disabled || choice === null || spec === null}
  onclick={handleClick}>{choice?.label ?? "End turn"}</button
>
