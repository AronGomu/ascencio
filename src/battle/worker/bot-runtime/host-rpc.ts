import type { BotHostCall } from "../../duel/contracts/bot-host.ts";
let sequence = 0;
const pending = new Map<
  number,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
export function receiveBotHostResult(value: unknown): boolean {
  if (
    !value ||
    typeof value !== "object" ||
    (value as { type?: string }).type !== "botHostResult"
  )
    return false;
  const r = value as { id: number; value?: unknown; error?: string };
  const p = pending.get(r.id);
  if (p) {
    pending.delete(r.id);
    clearTimeout(p.timer);
    if (r.error) p.reject(new Error(r.error));
    else p.resolve(r.value);
  }
  return true;
}
export function botHostRpc(call: BotHostCall): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Bot host timed out"));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    globalThis.postMessage({ type: "botHostCall", id, ...call });
  });
}
