<script lang="ts">
  import { onMount } from "svelte";
  import type { StoryMedia, StoryMediaLease } from "../ports/story-release.ts";
  import type { StoryEventChain } from "../ports/story-event-chain.ts";
  export let event: NonNullable<StoryEventChain["nodes"][number]["media"]>;
  export let media: StoryMedia | null;
  export let chapterId: string;
  export let oncomplete: () => void;
  let url = "";
  let unavailable = false;
  let playback: HTMLMediaElement | undefined;
  let completed = false;
  let alive = true;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let stopMedia: () => void = () => {};
  function finish() {
    if (completed || !alive) return;
    completed = true;
    playback?.pause();
    if (deadline !== undefined) clearTimeout(deadline);
    if (event.kind === "video") {
      stopMedia();
      oncomplete();
    }
  }
  function failed() {
    unavailable = true;
    finish();
  }
  async function play() {
    if (!alive || (event.kind === "video" && completed)) return;
    try {
      await playback?.play();
    } catch {
      failed();
    }
  }
  onMount(() => {
    const controller = new AbortController();
    let lease: StoryMediaLease | null = null;
    let unsubscribe: (() => void) | undefined;
    let stopped = false;
    stopMedia = () => {
      if (stopped) return;
      stopped = true;
      controller.abort();
      if (deadline !== undefined) clearTimeout(deadline);
      unsubscribe?.();
      unsubscribe = undefined;
      playback?.pause();
      if (playback) {
        playback.removeAttribute("src");
        playback.load();
      }
      lease?.release();
      lease = null;
      url = "";
    };
    // The deadline includes filesystem access and decode, not just playback.
    deadline = setTimeout(failed, event.timeoutMs);
    void (async () => {
      try {
        const acquired =
          (await media?.acquireEvent?.(
            chapterId,
            event.logicalId,
            controller.signal,
          )) ?? null;
        if (!alive || controller.signal.aborted) {
          acquired?.release();
          return;
        }
        lease = acquired;
        url = lease?.url ?? "";
        const subscription = lease?.subscribe?.((next) => {
          if (alive && (event.kind !== "video" || !completed)) {
            url = next;
            unavailable = !next;
            if (!next) finish();
          }
        });
        if (controller.signal.aborted) subscription?.();
        else unsubscribe = subscription;
        if (!url) failed();
      } catch {
        if (alive) failed();
      }
    })();
    return () => {
      alive = false;
      stopMedia();
    };
  });
</script>

<div data-cy="story-event-media" class="event-media">
  {#if unavailable || !url}
    <p data-cy="story-event-media-placeholder" role="status">
      {event.kind === "audio" ? "Audio unavailable" : "Media unavailable"}
    </p>
  {:else if event.kind === "image"}
    <img
      data-cy="story-event-image"
      src={url}
      alt=""
      onerror={failed}
      onload={() => {
        if (deadline !== undefined) clearTimeout(deadline);
      }}
    />
  {:else if event.kind === "video"}
    <video
      data-cy="story-event-video"
      bind:this={playback}
      src={url}
      playsinline
      muted
      controls
      oncanplay={() => void play()}
      onended={finish}
      onerror={failed}
      aria-label="Silent story video"
    ></video>
  {:else}
    <audio
      data-cy="story-event-audio"
      bind:this={playback}
      src={url}
      oncanplay={() => void play()}
      onended={finish}
      onerror={failed}
    ></audio>
  {/if}
  {#if event.kind === "video"}<button
      data-cy="story-event-video-skip"
      type="button"
      onclick={finish}>Skip video</button
    >{/if}
</div>

<style>
  .event-media {
    display: grid;
    gap: 0.5rem;
    justify-items: center;
  }
  img,
  video {
    max-width: 100%;
    max-height: min(45cqh, 24rem);
  }
  button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    color: var(--text);
    background: var(--panel);
    border: 1px solid var(--border);
    font: inherit;
  }
</style>
