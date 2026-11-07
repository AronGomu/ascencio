import type { Page } from "@playwright/test";

export interface NativeWorkerCapture {
  readonly commands: unknown[];
  readonly events: unknown[];
  workers: number;
  terminations: number;
  readonly created: Array<{ name: string; script: string }>;
}

declare global {
  interface Window {
    __nativeWorkerCapture: NativeWorkerCapture;
  }
}

export async function installNativeWorkerCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const capture: NativeWorkerCapture = {
      commands: [],
      events: [],
      workers: 0,
      terminations: 0,
      created: [],
    };
    Object.defineProperty(window, "__nativeWorkerCapture", { value: capture });
    const NativeWorker = window.Worker;
    const workers = new WeakSet<Worker>();
    const postMessage = NativeWorker.prototype.postMessage;
    const terminate = NativeWorker.prototype.terminate;
    class CapturedWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        capture.created.push({
          name: options?.name ?? "",
          script: String(url),
        });
        if (options?.name !== "ygo-duel-engine") return;
        workers.add(this);
        capture.workers += 1;
        this.addEventListener("message", (event) =>
          capture.events.push(structuredClone(event.data)),
        );
      }

      postMessage(
        message: unknown,
        options?: StructuredSerializeOptions | Transferable[],
      ): void {
        if (workers.has(this)) capture.commands.push(structuredClone(message));
        Reflect.apply(
          postMessage,
          this,
          options === undefined ? [message] : [message, options],
        );
      }

      terminate(): void {
        if (workers.delete(this)) capture.terminations += 1;
        Reflect.apply(terminate, this, []);
      }
    }
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: CapturedWorker,
    });
  });
}
