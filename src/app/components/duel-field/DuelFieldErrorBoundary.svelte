<script lang="ts">
  import type { PlayerPrompt } from "../../../duel/contracts/player-prompt.ts";
  import type {
    BoardCardView,
    BoardViewModel,
  } from "../../../field/board-view-model.ts";
  import type {
    InteractionSession,
    InteractionSessionAction,
  } from "../../prompts/interaction-session.ts";
  import type { ActiveInteractionSpec } from "../../prompts/interaction-spec.ts";
  import DuelField from "../DuelField.svelte";

  export let board: BoardViewModel;
  export let imageUrls: ReadonlyMap<number, string>;
  export let cardBackUrl: string;
  export let placeholderUrl: string;
  export let prompt: PlayerPrompt | null;
  export let spec: ActiveInteractionSpec | null;
  export let session: InteractionSession;
  export let pending: boolean;
  export let injectFailure = false;
  export let oninteraction: (action: InteractionSessionAction) => unknown;
  export let oninspect: (card: BoardCardView) => void;

  let shouldFail: boolean = injectFailure;

  function retry(reset: () => void): void {
    shouldFail = false;
    reset();
  }

  function sanitizedFailureMessage(error: unknown): string {
    void error;
    return "Prompt controls remain available. No private engine detail was shown.";
  }
</script>

{#snippet failed(error: unknown, reset: () => void)}
  <section
    class="field-error"
    role="alert"
    aria-labelledby="field-error-heading"
  >
    <div>
      <p class="eyebrow">Duel field unavailable</p>
      <h2 id="field-error-heading">Interactive field could not render</h2>
      <p>{sanitizedFailureMessage(error)}</p>
    </div>
    <button type="button" class="secondary" onclick={() => retry(reset)}
      >Retry duel field</button
    >
  </section>
{/snippet}

<svelte:boundary {failed}>
  <DuelField
    {board}
    {imageUrls}
    {cardBackUrl}
    {placeholderUrl}
    {prompt}
    {spec}
    {session}
    {pending}
    injectFailure={shouldFail}
    {oninteraction}
    {oninspect}
  />
</svelte:boundary>
