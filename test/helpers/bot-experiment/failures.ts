import { createWasmTransport } from "../../../src/battle/worker/bot-runtime/wasm-transport.ts";
/** Minimal import-free modules exercise actual traps and preempted infinite loops. */
function fixture(loop: boolean) {
  const section = (id: number, data: number[]) => [id, data.length, ...data];
  const name = (s: string) => [s.length, ...new TextEncoder().encode(s)];
  const body = (data: number[]) => [data.length, ...data];
  return Uint8Array.from([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    ...section(
      1,
      [
        4, 0x60, 1, 0x7f, 1, 0x7f, 0x60, 2, 0x7f, 0x7f, 0, 0x60, 0, 0, 0x60, 0,
        1, 0x7f,
      ],
    ),
    ...section(3, [6, 0, 1, 1, 2, 3, 3]),
    ...section(5, [1, 1, 1, 2]),
    ...section(7, [
      7,
      ...name("memory"),
      2,
      0,
      ...[
        "allocate",
        "deallocate",
        "prepare",
        "execute",
        "serialize",
        "output_len",
      ].flatMap((s, i) => [...name(s), 0, i]),
    ]),
    ...section(10, [
      6,
      ...body([0, 0x41, 0x80, 0x08, 0x0b]),
      ...body([0, 0x0b]),
      ...body([0, 0x0b]),
      ...body(loop ? [0, 3, 0x40, 0x0c, 0, 0x0b, 0x0b] : [0, 0, 0x0b]),
      ...body([0, 0x41, 0, 0x0b]),
      ...body([0, 0x41, 0, 0x0b]),
    ]),
  ]);
}
export async function failures() {
  const results = [];
  for (const loop of [false, true]) {
    const transport = await createWasmTransport(fixture(loop));
    const start = performance.now();
    let message: string;
    try {
      await transport.request({ op: "decide" });
      throw new Error("Fault unexpectedly succeeded");
    } catch (error) {
      message = String(error);
    } finally {
      transport.close();
    }
    const elapsedMs = performance.now() - start;
    if (loop && !message.includes("timed out")) throw new Error(message);
    if (!loop && !/unreachable|trap/i.test(message)) throw new Error(message);
    results.push({ kind: loop ? "infinite-loop" : "trap", elapsedMs, message });
  }
  self.postMessage({
    type: "complete",
    mode: "failures",
    results,
    environment: navigator.userAgent,
  });
}
