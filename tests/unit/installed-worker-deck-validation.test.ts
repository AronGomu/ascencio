import { describe, expect, it } from "vitest";
import { DuelWorkerRuntime } from "../../src/battle/worker/DuelWorkerRuntime.ts";
import { installedDeckCatalog } from "../../src/decks/catalog/installed-gameplay-cards.ts";
import {
  catalogByCode,
  PROTOTYPE_RULESET,
} from "../../src/decks/validation/index.ts";
import {
  createFakeOcgCoreAdapter,
  FAKE_DEPENDENCIES,
  FAKE_SNAPSHOT_ID,
} from "../fixtures/fake-ocgcore-adapter.ts";
import {
  installedGameplayFixture,
  TEST_CONTENT_REF,
} from "../fixtures/installed-gameplay.ts";
import { duelId } from "../../src/battle/duel/contracts/ids.ts";

const gameplay = installedGameplayFixture();
const good = {
  kind: "cards" as const,
  main: gameplay.decks[0]!.main,
  extra: [],
  side: [],
};
const cases = [
  [
    "extra monster in main",
    90,
    0x41,
    { ...good, main: [90, ...good.main.slice(1)] },
  ],
  ["main monster in extra", 91, 0x11, { ...good, extra: [91] }],
  ["token", 92, 0x4011, { ...good, side: [92] }],
  ["forbidden", 10000000, 0x11, { ...good, side: [10000000] }],
  ["limited", 12580477, 0x2, { ...good, side: [12580477, 12580477] }],
  [
    "semi-limited",
    44095762,
    0x4,
    { ...good, side: [44095762, 44095762, 44095762] },
  ],
] as const;

describe.each(["player", "opponent"] as const)(
  "installed %s full deck validation",
  (seat) => {
    it.each(cases)(
      "rejects %s before createDuel",
      async (_, code, type, bad) => {
        const fixture = installedGameplayFixture({
          cards: [
            ...gameplay.cards,
            {
              ...gameplay.cards[0]!,
              code,
              record: { ...gameplay.cards[0]!.record, code, type },
              text: { ...gameplay.cards[0]!.text, code },
            },
          ],
        });
        const harness = await createFakeOcgCoreAdapter(() => ({ steps: [] }));
        const codes = fixture.cards.map(({ code }) => code);
        const runtime = new DuelWorkerRuntime(async () => ({
          adapter: harness.adapter,
          dependencies: {
            ...FAKE_DEPENDENCIES,
            cards: new Map(
              codes.map((code) => [
                code,
                { ...FAKE_DEPENDENCIES.cards.values().next().value!, code },
              ]),
            ),
            images: new Map(
              codes.map((code) => [code, { code, full: "", cropped: "" }]),
            ),
          },
          snapshotId: FAKE_SNAPSHOT_ID,
          allowedCardCodes: new Set(codes),
          allowPresetDecks: false,
          deckCatalog: catalogByCode(installedDeckCatalog(fixture).cards),
          deckRuleset: PROTOTYPE_RULESET,
          createPreset: () => {
            throw new Error("no presets");
          },
        }));
        await runtime.handle({ type: "initialize", content: TEST_CONTENT_REF });
        const events = await runtime.handle({
          type: "startDuel",
          duelId: duelId("invalid-installed"),
          player: seat === "player" ? bad : good,
          opponent: seat === "opponent" ? bad : good,
        });
        expect(events).toContainEqual(
          expect.objectContaining({
            type: "error",
            error: expect.objectContaining({ code: "invalid_command" }),
          }),
        );
        expect(harness.counters.createDuel).toBe(0);
        runtime.dispose();
      },
    );
  },
);
