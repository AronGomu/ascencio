<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type {
    ChapterFileRef,
    ContentFailure,
    ContentInstaller,
    ContentResult,
    InstalledAssetLease,
    InstalledContentSet,
    ManifestRef,
  } from "../../src/content/index.ts";

  export let acquire: () => Promise<ContentResult<InstalledAssetLease>>;
  export let manifest: ManifestRef;
  export let file: ChapterFileRef;
  export let invalidate: ContentInstaller["invalidate"];
  export let onfailure: (failure: ContentFailure) => void = () => undefined;
  export let oninvalidated: (state: InstalledContentSet) => void = () =>
    undefined;
  export let oninvalidationfailure: (failure: ContentFailure) => void = () =>
    undefined;

  let lease: InstalledAssetLease | null = null;
  let url: string | null = null;
  let destroyed = false;
  let invalidating = false;

  async function invalidateFailure(failure: ContentFailure): Promise<void> {
    if (invalidating) return;
    invalidating = true;
    const scoped: ContentFailure = {
      ...failure,
      packId: file.packId,
      path: file.path,
    };
    onfailure(scoped);
    try {
      const result = await invalidate(manifest, scoped);
      if (result.kind === "failed") oninvalidationfailure(result);
      else oninvalidated(result.value);
    } catch {
      oninvalidationfailure({
        kind: "failed",
        code: "CONTENT_STORAGE_UNAVAILABLE",
        packId: file.packId,
        path: file.path,
      });
    }
  }

  onMount(() => {
    void acquire().then((result) => {
      if (result.kind === "failed") {
        void invalidateFailure(result);
        return;
      }
      if (destroyed) {
        result.value.release();
        return;
      }
      lease = result.value;
      url = lease.url;
    });
  });

  onDestroy(() => {
    destroyed = true;
    lease?.release();
  });

  function imageFailed(): void {
    const failure: ContentFailure = {
      kind: "failed",
      code: "CONTENT_INTEGRITY_FAILED",
      packId: file.packId,
      path: file.path,
    };
    lease?.release();
    lease = null;
    url = null;
    void invalidateFailure(failure);
  }
</script>

{#if url !== null}
  <img
    data-cy="installed-card-media"
    src={url}
    alt="Installed card"
    onerror={imageFailed}
  />
{/if}
