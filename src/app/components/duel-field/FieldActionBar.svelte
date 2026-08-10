<script lang="ts">
  import { onMount } from "svelte";
  import type { PlayerPrompt } from "../../../duel/contracts/player-prompt.ts";
  import type {
    InteractionSession,
    InteractionSessionAction,
    UnkeyedInteractionSessionAction,
  } from "../../prompts/interaction-session.ts";
  import type {
    ActiveInteractionSpec,
    InteractionChoice,
  } from "../../prompts/interaction-spec.ts";

  export let prompt: PlayerPrompt;
  export let spec: ActiveInteractionSpec;
  export let session: InteractionSession;
  export let disabled = false;
  export let confirmValid = false;
  export let validationMessage = "";
  export let oninteraction: (action: InteractionSessionAction) => unknown;
  /* Read-only outward binding: `DuelField` reserves a gutter this tall below
     the board so the bar never overlaps a field target. Measured here rather
     than through `bind:clientHeight` so the component still mounts where
     `ResizeObserver` is missing. */
  export let clientHeight = 0;

  const LIST_DATA_CY = "field-action-bar-list";

  let barElement: HTMLElement;
  let sizeObserver: ResizeObserver | null = null;

  $: allChoices = choicesInPromptOrder(spec);
  $: choicesById = new Map(allChoices.map((choice) => [choice.id, choice]));
  $: globalChoices = [...spec.globalChoices.values()].filter(
    (choice) => choice.action !== "endPhase",
  );
  $: allocatedTotal = [...session.allocations.values()].reduce(
    (total, amount) => total + amount,
    0,
  );

  onMount(() => {
    clientHeight = barElement.clientHeight;
    if (typeof ResizeObserver === "undefined") return;
    sizeObserver = new ResizeObserver(() => {
      clientHeight = barElement.clientHeight;
    });
    sizeObserver.observe(barElement);
    return () => {
      sizeObserver?.disconnect();
      sizeObserver = null;
    };
  });

  function dispatch(action: UnkeyedInteractionSessionAction): void {
    oninteraction({ ...action, key: spec.key } as InteractionSessionAction);
  }

  function move(choice: InteractionChoice, offset: -1 | 1): void {
    const index = session.order.indexOf(choice.id);
    dispatch({
      type: "moveChoice",
      choiceId: choice.id,
      toIndex: index + offset,
    });
  }

  function confirmLabel(): string {
    switch (spec.kind) {
      case "counterAllocation":
        return "Confirm allocation";
      case "order":
        return "Confirm order";
      case "placeSelection":
        return "Confirm placement";
      case "cardSelection":
        return "Confirm selection";
      case "cardAction":
      case "nonField":
        return "Confirm";
    }
  }

  function choicesInPromptOrder(
    value: ActiveInteractionSpec,
  ): readonly InteractionChoice[] {
    const byId = new Map(prompt.choices.map((choice) => [choice.id, choice]));
    const mapped = new Map(
      [
        ...value.cardChoices.values(),
        ...value.zoneChoices.values(),
        value.globalChoices.values(),
      ]
        .flatMap((choices) => [...choices])
        .map((choice) => [choice.id, choice]),
    );
    return prompt.choices.flatMap((choice) => {
      const sanitized = mapped.get(choice.id);
      return byId.has(choice.id) && sanitized !== undefined ? [sanitized] : [];
    });
  }
</script>

<section
  class="field-action-bar"
  aria-label="Field decision"
  aria-busy={disabled}
  bind:this={barElement}
  data-cy="field-action-bar"
>
  <p data-cy="field-action-bar-title">{spec.title}</p>
  {#if session.selectedChoiceIds.length > 0}
    <p data-cy="field-action-bar-summary">
      {session.selectedChoiceIds.length} selected
    </p>
  {/if}

  {#if spec.kind === "counterAllocation"}
    <div data-cy={LIST_DATA_CY}>
      {#each allChoices as choice (choice.id)}
        <div data-cy={`field-action-bar-row-${choice.id}`}>
          <span data-cy={`field-action-bar-label-${choice.id}`}
            >{choice.label}</span
          >
          <div
            role="group"
            aria-label={`Counters on ${choice.label}`}
            data-cy={`field-action-bar-controls-${choice.id}`}
          >
            <button
              type="button"
              class="secondary compact-button"
              aria-label={`Remove one counter from ${choice.label}`}
              disabled={disabled ||
                (session.allocations.get(choice.id) ?? 0) === 0}
              onclick={() =>
                dispatch({
                  type: "adjustAllocation",
                  choiceId: choice.id,
                  delta: -1,
                })}
              data-cy={`field-action-bar-decrement-${choice.id}`}>−</button
            >
            <output data-cy={`field-action-bar-allocation-${choice.id}`}
              >{session.allocations.get(choice.id) ?? 0}</output
            >
            <button
              type="button"
              class="secondary compact-button"
              aria-label={`Add one counter to ${choice.label}`}
              disabled={disabled ||
                allocatedTotal >= spec.constraints.maximum ||
                (session.allocations.get(choice.id) ?? 0) >=
                  (choice.allocationMaximum ?? 0)}
              onclick={() =>
                dispatch({
                  type: "adjustAllocation",
                  choiceId: choice.id,
                  delta: 1,
                })}
              data-cy={`field-action-bar-increment-${choice.id}`}>+</button
            >
          </div>
        </div>
      {/each}
    </div>
  {:else if spec.kind === "order"}
    <ol data-cy={LIST_DATA_CY}>
      {#each session.order as choiceId, index (choiceId)}
        {@const choice = choicesById.get(choiceId)}
        {#if choice}
          <li data-cy={`field-action-bar-row-${choiceId}`}>
            <span data-cy={`field-action-bar-label-${choiceId}`}
              >{index + 1}. {choice.label}</span
            >
            <span data-cy={`field-action-bar-order-controls-${choiceId}`}>
              <button
                type="button"
                class="secondary compact-button"
                aria-label={`Move ${choice.label} up`}
                disabled={disabled || index === 0}
                onclick={() => move(choice, -1)}
                data-cy={`field-action-bar-up-${choiceId}`}>↑</button
              >
              <button
                type="button"
                class="secondary compact-button"
                aria-label={`Move ${choice.label} down`}
                disabled={disabled || index === session.order.length - 1}
                onclick={() => move(choice, 1)}
                data-cy={`field-action-bar-down-${choiceId}`}>↓</button
              >
            </span>
          </li>
        {/if}
      {/each}
    </ol>
  {/if}

  {#if globalChoices.length > 0}
    <div
      role="group"
      aria-label="Other legal actions"
      data-cy="field-action-bar-global-choices"
    >
      {#each globalChoices as choice (choice.id)}
        <button
          type="button"
          class="secondary compact-button"
          {disabled}
          onclick={() =>
            dispatch({ type: "chooseChoice", choiceId: choice.id })}
          data-cy={`field-action-bar-choice-${choice.id}`}
          >{choice.label}</button
        >
      {/each}
    </div>
  {/if}

  {#if spec.kind !== "cardAction" && spec.kind !== "nonField" && !(spec.kind === "placeSelection" && spec.constraints.maximum === 1)}
    <button
      type="button"
      disabled={disabled || !confirmValid}
      aria-describedby={!confirmValid && validationMessage
        ? "field-action-bar-validation"
        : undefined}
      onclick={() => dispatch({ type: "confirm" })}
      data-cy="field-action-bar-confirm">{confirmLabel()}</button
    >
    {#if spec.constraints.cancelable}
      <button
        type="button"
        class="secondary"
        {disabled}
        onclick={() => dispatch({ type: "cancel" })}
        data-cy="field-action-bar-cancel">Cancel</button
      >
    {/if}
    {#if !confirmValid && validationMessage}
      <p
        id="field-action-bar-validation"
        class="validation"
        data-cy="field-action-bar-validation"
      >
        {validationMessage}
      </p>
    {/if}
  {/if}
</section>
