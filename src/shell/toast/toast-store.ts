import { writable, type Readable } from "svelte/store";
import type {
  ToastPublisher,
  ToastRequest,
  ToastTone,
} from "./toast-context.ts";

export interface ToastView {
  readonly id: string;
  readonly message: string;
  readonly tone: ToastTone;
}

export interface ToastStore
  extends Readable<readonly ToastView[]>, ToastPublisher {
  dismiss(id: string): void;
  pause(id: string, reason: "pointer" | "focus"): void;
  resume(id: string, reason: "pointer" | "focus"): void;
  setPageHidden(hidden: boolean): void;
  destroy(): void;
}

interface ActiveToast {
  readonly view: ToastView;
  remainingMs: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | null;
  readonly pauseReasons: Set<"pointer" | "focus">;
}

const DEFAULT_DURATION_MS = 4_000;
const MAX_VISIBLE_TOASTS = 3;

export function createToastStore(
  now: () => number = () => Date.now(),
): ToastStore {
  const views = writable<readonly ToastView[]>(Object.freeze([]));
  const active = new Map<string, ActiveToast>();
  let sequence = 0;
  let pageHidden = false;

  function publish(): void {
    views.set(Object.freeze([...active.values()].map(({ view }) => view)));
  }

  function schedule(toast: ActiveToast): void {
    if (pageHidden || toast.pauseReasons.size > 0 || toast.timer !== null)
      return;
    toast.startedAt = now();
    toast.timer = setTimeout(() => dismiss(toast.view.id), toast.remainingMs);
  }

  function stopTimer(toast: ActiveToast): void {
    if (toast.timer === null) return;
    clearTimeout(toast.timer);
    toast.timer = null;
    toast.remainingMs = Math.max(
      0,
      toast.remainingMs - (now() - toast.startedAt),
    );
  }

  function show(request: ToastRequest): string {
    while (active.size >= MAX_VISIBLE_TOASTS) {
      const oldest = active.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      dismiss(oldest);
    }
    const id = `toast-${++sequence}`;
    const toast: ActiveToast = {
      view: Object.freeze({
        id,
        message: request.message,
        tone: request.tone ?? "info",
      }),
      remainingMs: Math.max(
        0,
        Math.min(
          request.durationMs ?? DEFAULT_DURATION_MS,
          DEFAULT_DURATION_MS,
        ),
      ),
      startedAt: now(),
      timer: null,
      pauseReasons: new Set(),
    };
    active.set(id, toast);
    publish();
    schedule(toast);
    return id;
  }

  function dismiss(id: string): void {
    const toast = active.get(id);
    if (toast === undefined) return;
    stopTimer(toast);
    active.delete(id);
    publish();
  }

  function pause(id: string, reason: "pointer" | "focus"): void {
    const toast = active.get(id);
    if (toast === undefined || toast.pauseReasons.has(reason)) return;
    toast.pauseReasons.add(reason);
    stopTimer(toast);
  }

  function resume(id: string, reason: "pointer" | "focus"): void {
    const toast = active.get(id);
    if (toast === undefined || !toast.pauseReasons.delete(reason)) return;
    schedule(toast);
  }

  function setPageHidden(hidden: boolean): void {
    pageHidden = hidden;
    for (const toast of active.values()) {
      if (hidden) stopTimer(toast);
      else schedule(toast);
    }
  }

  function destroy(): void {
    for (const toast of active.values()) stopTimer(toast);
    active.clear();
    publish();
  }

  return {
    subscribe: views.subscribe,
    show,
    dismiss,
    pause,
    resume,
    setPageHidden,
    destroy,
  };
}
