<script lang="ts">
  import OverlayShell from "./OverlayShell.svelte";
  export let mode: "idle" | "saving" | "success" | "overwrite" | "failure" =
    "idle";
  export let onsave: () => void = () => undefined;
  export let onretry: () => void = () => undefined;
  export let oncontinue: () => void = () => undefined;
  export let onclose: () => void = () => undefined;
  export let restoreFocusTo: HTMLElement | null = null;
</script>

<OverlayShell
  title="Save and load"
  labelId="save-load-title"
  {onclose}
  {restoreFocusTo}
>
  <p data-cy="story-save-load-note">
    Prototype-local state only. Auto and Skip are reader settings and are not
    part of a save.
  </p>
  {#if mode === "saving"}<p
      role="status"
      aria-busy="true"
      data-cy="story-save-load-saving"
    >
      Saving prototype state…
    </p>
  {:else if mode === "success"}<p
      role="status"
      data-cy="story-save-load-success"
    >
      Save complete. Manual slot 1 updated.
    </p>
  {:else if mode === "overwrite"}<div
      role="alert"
      data-cy="story-save-load-overwrite"
    >
      <h3 data-cy="story-save-load-overwrite-heading">
        Overwrite manual slot?
      </h3>
      <p data-cy="story-save-load-overwrite-message">
        Replace its mock progress with current state.
      </p>
      <button
        type="button"
        data-cy="story-save-load-overwrite-confirm"
        onclick={onsave}>Confirm overwrite</button
      >
    </div>
  {:else if mode === "failure"}<div
      role="alert"
      data-cy="story-save-load-failure"
    >
      <h3 data-cy="story-save-load-failure-heading">Storage unavailable</h3>
      <p data-cy="story-save-load-failure-message">
        Current in-memory story remains playable.
      </p>
      <button type="button" data-cy="story-save-load-retry" onclick={onretry}
        >Retry save</button
      ><button
        type="button"
        class="secondary"
        data-cy="story-save-load-continue"
        onclick={oncontinue}>Continue Without Saving</button
      >
    </div>
  {:else}<button type="button" data-cy="story-save-load-save" onclick={onsave}
      >Save to manual slot 1</button
    >{/if}
</OverlayShell>
