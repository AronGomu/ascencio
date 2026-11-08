import { it, expect } from "vitest";
import { loadBot } from "../../src/battle/worker/bot-runtime/loaded-bot.ts";
import { FAKE_DEPENDENCIES } from "../fixtures/fake-ocgcore-adapter.ts";

it.each(["basic", "generalist", "random"] as const)(
  "loads and recreates the TypeScript %s policy without packages",
  async (policy) => {
    const bot = await loadBot(
      { runtime: "typescript", packageId: "builtin", policy },
      FAKE_DEPENDENCIES,
      false,
      undefined,
      42,
    );
    const restored = await bot.recreate!();
    expect(bot.version).toBe(`builtin:${policy}`);
    expect(restored.version).toBe(bot.version);
    expect(bot.fallbackCount).toBe(0);
    bot.dispose();
    restored.dispose();
  },
);
it.each(["wasm", "native"] as const)(
  "rejects direct %s Worker selections",
  async (runtime) => {
    await expect(
      loadBot(
        { runtime, packageId: "ascencio.reference", policy: "generalist" },
        FAKE_DEPENDENCIES,
      ),
    ).rejects.toThrow("Rust AI packages are retired");
  },
);
