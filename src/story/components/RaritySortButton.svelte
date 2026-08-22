<script lang="ts">
  /** The tri-state rarity grouping control, for every story list that offers
      it. T34 built it into the set card list; the booster results list is the
      second reader, and a second copy of a three-state cycle is how "rarest
      first" comes to mean two things on two screens.

      The `data-cy` is handed in rather than fixed, because each screen names
      its own controls and two of them can be mounted in one document during a
      route change — the same reason `StoryCardTile` takes its selector from
      the caller. */
  import type { RarityGrouping } from "../collection/group-by-rarity.ts";

  export let grouping: RarityGrouping = "off";
  export let dataCy: string;
  export let onchange: (next: RarityGrouping) => void = () => undefined;

  const NEXT_GROUPING: Readonly<Record<RarityGrouping, RarityGrouping>> = {
    off: "common-first",
    "common-first": "rarest-first",
    "rarest-first": "off",
  };

  /* The label is the state: a button whose name never changed would leave a
     screen reader announcing "sort by rarity, pressed" for both directions. */
  const GROUPING_LABELS: Readonly<Record<RarityGrouping, string>> = {
    off: "Sort by rarity",
    "common-first": "Rarity: common first",
    "rarest-first": "Rarity: rarest first",
  };
</script>

<button
  type="button"
  class="secondary rarity-sort"
  data-cy={dataCy}
  data-state={grouping}
  aria-pressed={grouping !== "off"}
  onclick={() => onchange(NEXT_GROUPING[grouping])}
  >{GROUPING_LABELS[grouping]}</button
>

<style>
  .rarity-sort {
    flex: none;
    font-size: 0.8rem;
  }
</style>
