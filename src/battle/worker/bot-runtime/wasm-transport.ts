import {
  BOT_DEADLINE_MS,
  BOT_SETUP_DEADLINE_MS,
  type BotTransport,
  type BotTransportMetrics,
} from "./transport.ts";
export async function createWasmTransport(
  bytes: Uint8Array,
  observe?: (metrics: BotTransportMetrics) => void,
): Promise<BotTransport> {
  const worker = new Worker(new URL("./bot.worker.ts", import.meta.url), {
    type: "module",
    name: "isolated-bot",
  });
  let sequence = 0,
    closed = false;
  const pending = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  function close() {
    if (closed) return;
    closed = true;
    worker.terminate();
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Bot stopped"));
    }
    pending.clear();
  }
  worker.onmessage = (
    event: MessageEvent<{
      id: number;
      value: unknown;
      error?: string;
      metrics?: BotTransportMetrics;
    }>,
  ) => {
    const p = pending.get(event.data.id);
    if (!p) return;
    pending.delete(event.data.id);
    clearTimeout(p.timer);
    if (event.data.error) p.reject(new Error(event.data.error));
    else {
      if (event.data.metrics) observe?.(event.data.metrics);
      p.resolve(event.data.value);
    }
  };
  worker.onerror = () => close();
  worker.onmessageerror = () => close();
  function send(message: object, deadline: number) {
    if (closed) return Promise.reject(new Error("Bot stopped"));
    return new Promise<unknown>((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error("Bot execution timed out"));
        close();
      }, deadline);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ id, ...message });
    });
  }
  try {
    await send({ bytes: bytes.slice() }, BOT_SETUP_DEADLINE_MS);
  } catch (error) {
    close();
    throw error;
  }
  return {
    request: (value) => send({ request: value }, BOT_DEADLINE_MS),
    close,
  };
}
