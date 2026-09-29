import { describe, expect, it } from "vitest";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
} from "../../src/battle/worker/engine/engine-constants.ts";
import { buildEnginePrompt } from "../../src/battle/worker/protocol/PromptRegistry.ts";

const CARD_CODE = 97590747;

const dependencies: ActiveDuelDependencies = {
  cards: new Map(),
  texts: new Map([
    [
      CARD_CODE,
      {
        code: CARD_CODE,
        name: "La Jinn",
        description: "A mystical genie.",
        strings: [],
      },
    ],
  ]),
  scripts: new Map(),
  strings: {
    system: {
      "200": 'Use the effect of "%ls" from [%ls]?',
      "1005": "Banished",
    },
    victory: {},
    counter: {},
    setname: {},
  },
  images: new Map(),
  counts: { cards: 0, texts: 1, scripts: 0, globals: 0, images: 0 },
};

describe("PromptRegistry visibility", () => {
  it("does not expose a hidden opponent effect card through prompt text", () => {
    const binding = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_EFFECT_YES_NO,
        player: 0,
        code: CARD_CODE,
        controller: 1,
        location: EngineLocation.BANISHED,
        sequence: 0,
        position: EnginePosition.FACE_DOWN_DEFENSE,
        description: 200n,
      },
      1,
      dependencies,
    );

    expect(binding?.prompt.contextCard).not.toHaveProperty("code");
    expect(binding?.prompt).not.toHaveProperty("message");
    expect(JSON.stringify(binding?.prompt)).not.toContain("La Jinn");
    expect(JSON.stringify(binding?.prompt)).not.toContain(String(CARD_CODE));
  });
});
