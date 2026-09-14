import { readonly, writable, type Readable } from "svelte/store";
import {
  resolveServiceWorkerState,
  type ServiceWorkerState,
} from "./shell-cache-policy.ts";

const state = writable<ServiceWorkerState>({ kind: "checking" });
export const serviceWorkerState: Readable<ServiceWorkerState> = readonly(state);
let registrationPromise: Promise<ServiceWorkerRegistration | null> | null =
  null;

function baseUrl(): URL {
  return new URL(import.meta.env.BASE_URL, globalThis.location.origin);
}

async function openRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return null;
  const base = baseUrl();
  const existing = await navigator.serviceWorker.getRegistration(base.href);
  return (
    existing ??
    navigator.serviceWorker.register(new URL("service-worker.js", base).href, {
      scope: base.pathname,
      type: "module",
      updateViaCache: "none",
    })
  );
}

export async function requestServiceWorkerUpdate(): Promise<void> {
  const registration = await (registrationPromise ??= openRegistration());
  if (registration === null) throw new Error("CORE_UPDATE_UNAVAILABLE");
  await registration.update();
}

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
    const registration = await (registrationPromise ??= openRegistration());
    if (registration === null) {
      state.set({ kind: "unsupported" });
      return;
    }
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
