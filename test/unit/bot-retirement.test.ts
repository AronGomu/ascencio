import { describe, expect, it } from "vitest";
import {
  assertBotAvailable,
  listBotPackages,
  pinBotPackage,
} from "../../src/battle/app/bots/package-host.ts";
import type { BotSelection } from "../../src/battle/duel/contracts/bot-selection.ts";

describe("TypeScript strategy availability after Rust retirement", () => {
  it("keeps all built-in policies available without package discovery", async () => {
    expect(await listBotPackages()).toEqual([]);
    for (const policy of ["basic", "generalist", "random"] as const) {
      await expect(
        assertBotAvailable({
          runtime: "typescript",
          packageId: "builtin",
          policy,
        }),
      ).resolves.toBeUndefined();
    }
  });

  it.each(["wasm", "native"] as const)(
    "refuses retired %s requirements before starting a duel",
    async (runtime) => {
      const selection: BotSelection = {
        runtime,
        packageId: "ascencio.reference",
        policy: "generalist",
      };
      await expect(assertBotAvailable(selection)).rejects.toMatchObject({
        name: "BotDependencyError",
        message: expect.stringContaining("retired"),
      });
      await expect(pinBotPackage(selection)).rejects.toThrow("retired");
    },
  );
});
