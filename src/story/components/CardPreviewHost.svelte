<script lang="ts">
  import { onDestroy } from "svelte";
  import { cardCode } from "../../cards/index.ts";
  import type {
    CardImageLease,
    CardImageSource,
  } from "../../cards/images/index.ts";
  import {
    CardPreviewPanel,
    type CardPreviewView,
  } from "../../shared-svelte-ui/card-preview/index.ts";

  export let code: number | null;
  export let preview: CardPreviewView | null;
  export let imageSource: CardImageSource | null;
  export let dataCyPrefix: string;
  export let emptyLabel: string;

  let activeSource: CardImageSource | null = null;
  let activeKey: string | null = null;
  let activeAbort: AbortController | null = null;
  let activeLease: CardImageLease | null = null;
  let imageUrl: string | null = null;

  $: synchronize(imageSource, preview?.key ?? null, code);
  $: resolvedPreview = preview === null ? null : { ...preview, imageUrl };

  onDestroy(release);

  function release(): void {
    activeAbort?.abort();
    activeAbort = null;
    activeLease?.release();
    activeLease = null;
    imageUrl = null;
  }

  function synchronize(
    source: CardImageSource | null,
    key: string | null,
    nextCode: number | null,
  ): void {
    if (source === activeSource && key === activeKey) return;
    release();
    activeSource = source;
    activeKey = key;
    if (source === null || key === null || nextCode === null) return;
    const controller = new AbortController();
    activeAbort = controller;
    void source.acquire(cardCode(nextCode), "full", controller.signal).then(
      (lease) => {
        if (
          controller.signal.aborted ||
          activeAbort !== controller ||
          activeSource !== source ||
          activeKey !== key
        ) {
          lease?.release();
          return;
        }
        activeLease = lease;
        imageUrl = lease?.url ?? null;
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          console.error({
            event: "story.card-preview.image.failed",
            err: error,
          });
      },
    );
  }
</script>

<CardPreviewPanel preview={resolvedPreview} {dataCyPrefix} {emptyLabel} />
