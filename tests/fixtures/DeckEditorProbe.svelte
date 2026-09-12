<script lang="ts">
  import type { InstalledGameplay } from "../../src/content/index.ts";
  import type { DeckEditorDomainProps } from "../../src/shell/domain-loaders.ts";

  export let gameplay: InstalledGameplay;
  export let reader: DeckEditorDomainProps["reader"];
  export let context: DeckEditorDomainProps["context"];
  export let deckId: DeckEditorDomainProps["deckId"];
  export let onnavigate: DeckEditorDomainProps["onnavigate"];
  export let oncollection: DeckEditorDomainProps["oncollection"];
  export let onexit: DeckEditorDomainProps["onexit"];
  export let returnLabel: string;
  export let onreturn: () => void;
</script>

<button
  type="button"
  data-cy="deck-editor-probe-return"
  data-context={context.kind}
  data-deck-id={deckId ?? ""}
  data-host-actions={String([onnavigate, oncollection, onexit].length)}
  onclick={onreturn}
>
  Return to {returnLabel}
</button>
