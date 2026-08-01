<script lang="ts">
  import { onMount } from "svelte";
  import { isCardIdentityVisible } from "../../../duel/card-visibility.ts";
  import type { PublicCard } from "../../../duel/contracts/public-duel-state.ts";

  interface CardText {
    readonly name: string;
    readonly description?: string;
  }

  export let card: PublicCard;
  export let cardTexts: ReadonlyMap<number, CardText> = new Map();
  export let resolveCardImage: (card: PublicCard) => string | undefined = () =>
    undefined;
  export let onclose: () => void = () => undefined;

  let heading: HTMLHeadingElement | undefined;
  $: identityVisible =
    card.code !== undefined &&
    isCardIdentityVisible(0, card.controller, card.location, card.position);
  $: text =
    identityVisible && card.code !== undefined
      ? cardTexts.get(card.code)
      : undefined;
  $: name = text?.name ?? "Public card";
  $: description = text?.description;
  $: imageUrl = identityVisible ? resolveCardImage(card) : undefined;

  onMount(() => heading?.focus());

  function words(value: string): string {
    return value.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLocaleLowerCase();
  }

  function counterLabel(nameValue: string, count: number): string {
    return `${count} ${nameValue}${count === 1 || nameValue.endsWith("s") ? "" : "s"}`;
  }

  function materialName(index: number): string {
    const material = card.overlayMaterials[index];
    if (
      material === undefined ||
      !material.identityVisible ||
      material.code === undefined
    )
      return "Hidden material";
    return cardTexts.get(material.code)?.name ?? `Card ${material.code}`;
  }
</script>

{#if identityVisible}
  <aside
    id="card-inspector"
    class="card-inspector"
    aria-labelledby="card-inspector-heading"
  >
    <div class="card-inspector__copy">
      <p class="eyebrow">Public card details</p>
      <h2 id="card-inspector-heading" tabindex="-1" bind:this={heading}>
        {name}
      </h2>
      <p>{words(card.location)} · {words(card.position)}</p>
      {#if description}<p>{description}</p>{/if}
      {#if card.counters.length > 0}
        <ul class="state-badges" aria-label="Counters">
          {#each card.counters as counter (`${counter.type}:${counter.name}`)}
            <li>
              <span aria-hidden="true">◆</span>
              {counterLabel(counter.name, counter.count)}
            </li>
          {/each}
        </ul>
      {/if}
      {#if card.overlayMaterials.length > 0}
        <ol class="material-list" aria-label="Materials">
          {#each card.overlayMaterials as material, index (material.instanceId)}
            <li>Material {index + 1}: {materialName(index)}</li>
          {/each}
        </ol>
      {/if}
    </div>
    {#if imageUrl}<img src={imageUrl} alt={name} decoding="async" />{/if}
    <button type="button" class="secondary" onclick={onclose}
      >Close card details</button
    >
  </aside>
{/if}
