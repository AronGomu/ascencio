import { it, expect, vi, afterEach } from "vitest";
import { loadBot } from "../../src/battle/worker/bot-runtime/loaded-bot.ts";
import { botHostRpc } from "../../src/battle/worker/bot-runtime/host-rpc.ts";
import { createWasmTransport } from "../../src/battle/worker/bot-runtime/wasm-transport.ts";
import { FAKE_DEPENDENCIES } from "../fixtures/fake-ocgcore-adapter.ts";
vi.mock("../../src/battle/worker/bot-runtime/host-rpc.ts", () => ({
  botHostRpc: vi.fn(),
}));
vi.mock("../../src/battle/worker/bot-runtime/wasm-transport.ts", () => ({
  createWasmTransport: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());
it("pins executable bytes/version per duel and reuses them on restore", async () => {
  const selection = {
    runtime: "wasm",
    packageId: "test.ai",
    policy: "basic",
  } as const;
  const pin = (version: string, byte: number) => ({
    manifest: { packageVersion: version },
    digest: version,
    bytes: new Uint8Array([byte]),
  });
  vi.mocked(botHostRpc)
    .mockResolvedValueOnce(pin("1", 1))
    .mockResolvedValueOnce(pin("2", 2));
  vi.mocked(createWasmTransport).mockImplementation(async () => ({
    request: async () => ({ contractVersion: 1 }),
    close() {},
  }));
  const first = await loadBot(selection, FAKE_DEPENDENCIES, false);
  const restored = await first.recreate!();
  const second = await loadBot(selection, FAKE_DEPENDENCIES, false);
  expect(botHostRpc).toHaveBeenCalledTimes(2);
  expect(first.version).toBe("1:1");
  expect(restored.version).toBe("1:1");
  expect(second.version).toBe("2:2");
  expect(
    vi.mocked(createWasmTransport).mock.calls.map((c) => [...c[0]]),
  ).toEqual([[1], [1], [2]]);
  first.dispose();
  restored.dispose();
  second.dispose();
});
it("reports missing required packages before a duel can load", async () => {
  vi.mocked(botHostRpc).mockRejectedValue(
    new Error("Install test.ai in ai-bots and retry"),
  );
  await expect(
    loadBot(
      { runtime: "wasm", packageId: "test.ai", policy: "basic" },
      FAKE_DEPENDENCIES,
      false,
    ),
  ).rejects.toThrow(/Install/);
  expect(createWasmTransport).not.toHaveBeenCalled();
});
