<script lang="ts">
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

  $: allChoices = choicesInPromptOrder(spec);
  $: choicesById = new Map(allChoices.map((choice) => [choice.id, choice]));
  $: globalChoices = [...spec.globalChoices.values()];
  $: allocatedTotal = [...session.allocations.values()].reduce(
    (total, amount) => total + amount,
    0,
  );
  $: selectedLabels = session.selectedChoiceIds
    .map((id) => choicesById.get(id)?.label)
    .filter((label): label is string => label !== undefined);

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
  class="selection-dock"
  aria-label="Field selection"
  aria-busy={disabled}
  data-cy="selection-dock"
>
  <div data-cy="selection-dock-title">
    <p class="eyebrow" data-cy="selection-dock-eyebrow">Field decision</p>
    <h3 data-cy="selection-dock-title-heading">{spec.title}</h3>
    {#if selectedLabels.length > 0}
      <p data-cy="selection-dock-selected-summary">
        Selected: {selectedLabels.join(", ")}
      </p>
    {/if}
  </div>

  {#if spec.kind === "counterAllocation"}
    <div class="selection-dock__list" data-cy="selection-dock-allocation-list">
      {#each allChoices as choice (choice.id)}
        <div
          class="selection-dock__row"
          data-cy={`selection-dock-allocation-row-${choice.id}`}
        >
          <span data-cy="selection-dock-allocation-label">{choice.label}</span>
          <div
            role="group"
            aria-label={`Counters on ${choice.label}`}
            data-cy="selection-dock-allocation-controls"
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
              data-cy={`selection-dock-allocation-decrement-${choice.id}`}
              >−</button
            >
            <output data-cy={`selection-dock-allocation-value-${choice.id}`}
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
              data-cy={`selection-dock-allocation-increment-${choice.id}`}
              >+</button
            >
          </div>
        </div>
      {/each}
    </div>
  {:else if spec.kind === "order"}
    <ol class="selection-dock__list" data-cy="selection-dock-order-list">
      {#each session.order as choiceId, index (choiceId)}
        {@const choice = choicesById.get(choiceId)}
        {#if choice}
          <li
            class="selection-dock__row"
            data-cy={`selection-dock-order-row-${choiceId}`}
          >
            <span data-cy="selection-dock-order-label"
              >{index + 1}. {choice.label}</span
            >
            <span data-cy="selection-dock-order-controls">
              <button
                type="button"
                class="secondary compact-button"
                aria-label={`Move ${choice.label} up`}
                disabled={disabled || index === 0}
                onclick={() => move(choice, -1)}
                data-cy={`selection-dock-order-up-${choiceId}`}>↑</button
              >
              <button
                type="button"
                class="secondary compact-button"
                aria-label={`Move ${choice.label} down`}
                disabled={disabled || index === session.order.length - 1}
                onclick={() => move(choice, 1)}
                data-cy={`selection-dock-order-down-${choiceId}`}>↓</button
              >
            </span>
          </li>
        {/if}
      {/each}
    </ol>
  {/if}

  {#if globalChoices.length > 0}
    <div
      class="selection-dock__actions"
      role="group"
      aria-label="Other legal actions"
      data-cy="selection-dock-global-actions"
    >
      {#each globalChoices as choice (choice.id)}
        <button
          type="button"
          class="secondary"
          {disabled}
          onclick={() =>
            dispatch({ type: "chooseChoice", choiceId: choice.id })}
          data-cy={`selection-dock-global-choice-${choice.id}`}
          >{choice.label}</button
        >
      {/each}
    </div>
  {/if}

  {#if spec.kind !== "cardAction" && spec.kind !== "nonField"}
    <div
      class="selection-dock__actions"
      data-cy="selection-dock-confirm-actions"
    >
      <button
        type="button"
        disabled={disabled || !confirmValid}
        aria-describedby={!confirmValid && validationMessage
          ? "field-selection-validation"
          : undefined}
        onclick={() => dispatch({ type: "confirm" })}
        data-cy="selection-dock-confirm-button">{confirmLabel()}</button
      >
      {#if spec.constraints.cancelable}
        <button
          type="button"
          class="secondary"
          {disabled}
          onclick={() => dispatch({ type: "cancel" })}
          data-cy="selection-dock-cancel-button">Cancel</button
        >
      {/if}
    </div>
    {#if !confirmValid && validationMessage}
      <p
        id="field-selection-validation"
        class="validation"
        data-cy="selection-dock-validation-message"
      >
        {validationMessage}
      </p>
    {/if}
  {/if}
</section>
