export type ToastTone = "info" | "success" | "warning" | "error";

export interface ToastRequest {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly durationMs?: number;
}

export interface ToastPublisher {
  show(request: ToastRequest): string;
}

export const TOAST_CONTEXT_KEY = "shell:toast";
