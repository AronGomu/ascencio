<script lang="ts">
  import type { ToastStore } from "./toast-store.ts";

  export let store: ToastStore;

  function focusLeft(event: FocusEvent, toast: HTMLElement): boolean {
    const next = event.relatedTarget;
    return !(next instanceof Node && toast.contains(next));
  }
</script>

<section
  class="toast-region"
  aria-label="Notifications"
  data-cy="shell-toast-region"
>
  {#each $store as toast (toast.id)}
    <article
      class="toast"
      class:info={toast.tone === "info"}
      class:success={toast.tone === "success"}
      class:warning={toast.tone === "warning"}
      class:error={toast.tone === "error"}
      role={toast.tone === "error" ? "alert" : "status"}
      onpointerenter={() => store.pause(toast.id, "pointer")}
      onpointerleave={() => store.resume(toast.id, "pointer")}
      onfocusin={() => store.pause(toast.id, "focus")}
      onfocusout={(event) => {
        if (focusLeft(event, event.currentTarget))
          store.resume(toast.id, "focus");
      }}
      data-cy={`shell-toast-${toast.id}`}
    >
      <p data-cy={`shell-toast-message-${toast.id}`}>{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onclick={() => store.dismiss(toast.id)}
        data-cy={`shell-toast-dismiss-${toast.id}`}
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          data-cy={`shell-toast-dismiss-icon-${toast.id}`}
        >
          <path
            d="M5 5 L15 15 M15 5 L5 15"
            data-cy={`shell-toast-dismiss-path-${toast.id}`}
          />
        </svg>
      </button>
    </article>
  {/each}
</section>

<style>
  .toast-region {
    position: absolute;
    z-index: 170;
    top: var(--space-3);
    right: var(--space-3);
    display: grid;
    width: min(24rem, calc(100% - var(--space-6)));
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--space-2);
    padding: var(--space-3);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--surface-raised);
    box-shadow: 0 0.5rem 1.5rem var(--shadow);
    pointer-events: auto;
    animation: toast-enter var(--motion-fast) ease-out;
  }

  .toast.success {
    border-color: var(--success);
  }

  .toast.warning {
    border-color: var(--warning);
  }

  .toast.error {
    border-color: var(--danger);
  }

  p {
    margin: 0;
    line-height: 1.4;
  }

  button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--muted);
    background: transparent;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    color: var(--text);
    background: var(--surface-chain);
  }

  svg {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateY(-0.5rem);
    }
  }

  @media (max-width: 40rem) {
    .toast-region {
      right: var(--space-2);
      left: var(--space-2);
      width: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast {
      animation: none;
    }
  }
</style>
