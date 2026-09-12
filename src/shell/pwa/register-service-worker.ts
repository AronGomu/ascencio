import { readonly, writable, type Readable } from "svelte/store";
import {
  resolveServiceWorkerState,
  type ServiceWorkerState,
} from "./shell-cache-policy.ts";

const state = writable<ServiceWorkerState>({ kind: "checking" });
export const serviceWorkerState: Readable<ServiceWorkerState> = readonly(state);

export async function registerServiceWorker(): Promise<void> {
  if (import.meta.env.DEV) {
    state.set({ kind: "unsupported" });
    return;
  }
  if (!("serviceWorker" in navigator)) {
    state.set({ kind: "unsupported" });
    return;
  }

  try {
    const baseUrl = new URL(
      import.meta.env.BASE_URL,
      globalThis.location.origin,
    );
    const registration = await navigator.serviceWorker.register(
      new URL("service-worker.js", baseUrl).href,
      {
        scope: baseUrl.pathname,
        type: "module",
        updateViaCache: "none",
      },
    );
    let installFailed = false;

    const sync = (): void => {
      state.set(
        resolveServiceWorkerState({
          supported: true,
          controlled: navigator.serviceWorker.controller !== null,
          active: registration.active?.state === "activated",
          installing: registration.installing !== null,
          waiting: registration.waiting !== null,
          failed: installFailed,
        }),
      );
    };
    const observe = (worker: ServiceWorker | null): void => {
      worker?.addEventListener("statechange", () => {
        if (worker.state === "redundant") installFailed = true;
        sync();
      });
    };

    observe(registration.installing);
    observe(registration.waiting);
    registration.addEventListener("updatefound", () => {
      installFailed = false;
      observe(registration.installing);
      sync();
    });
    navigator.serviceWorker.addEventListener("controllerchange", sync);
    sync();
  } catch {
    state.set({ kind: "failed" });
  }
}
