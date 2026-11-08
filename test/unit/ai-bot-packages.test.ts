import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildAiBot } from "../../scripts/build-ai-bots.ts";
import {
  packagePath,
  readAiBotPackage,
} from "../../scripts/lib/ai-bots/package.ts";
import { FAKE_DEPENDENCIES } from "../fixtures/fake-ocgcore-adapter.ts";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type { BotModule } from "../../src/battle/worker/bot/bot-contract.ts";

const names = ["basic", "generalist", "random", "goat-control"] as const;
describe("self-contained TypeScript bot packages", () => {
  it.each(names)(
    "builds and runs %s from its manifest without source imports",
    async (name) => {
      const folder = path.resolve("assets/ai-bots", name);
      const pack = await readAiBotPackage(folder);
      const evaluation = JSON.parse(
        await readFile(path.join(folder, "evaluation.json"), "utf8"),
      );
      expect(pack.manifest.id).toBe(`ascencio.${name}`);
      expect(pack.manifest.recommendedDecks).toContain(evaluation.deck);
      expect(pack.settings).toEqual({});
      const { output, sources } = await buildAiBot(folder);
      const packages = path.resolve("assets/ai-bots") + path.sep;
      expect(
        sources
          .filter((file) => file.startsWith(packages))
          .every((file) => file.startsWith(folder + path.sep)),
      ).toBe(true);
      const source = await readFile(output, "utf8");
      expect(source).not.toMatch(/from\s+["']|\bimport\s*\(/);
      const module = (await import(
        /* @vite-ignore */ pathToFileURL(output).href
      )) as { createBotModule: (d: typeof FAKE_DEPENDENCIES) => BotModule };
      const bot = module
        .createBotModule(FAKE_DEPENDENCIES)
        .create(pack.settings);
      const decision = bot.decide({
        prompt: {
          id: promptId("package-test"),
          player: 1,
          kind: "yesNo",
          title: "Choose",
          minimum: 1,
          maximum: 1,
          cancelable: false,
          ordered: false,
          choices: [{ id: choiceId("no"), action: "no", label: "No" }],
        },
        observation: {
          revision: 1,
          turn: 1,
          turnPlayer: 1,
          phase: "main1",
          chainSize: 0,
          players: [] as never,
        },
      });
      expect(decision.choiceIds).toEqual([choiceId("no")]);
    },
  );

  it.each([
    "../escape.ts",
    "/escape.ts",
    "C:/escape.ts",
    "ai/../escape.ts",
    "ai\\escape.ts",
  ])("rejects escaping manifest path %s", (file) => {
    expect(() => packagePath("/package", file)).toThrow("within its folder");
  });
});
