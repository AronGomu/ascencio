import { describe, expect, it } from "vitest";
import type { ActiveDuelDependencies } from "../../src/battle/worker/assets/active-duel-dependencies.ts";
import {
  PromptRegistry,
  buildEnginePrompt,
  type EnginePromptBinding,
} from "../../src/battle/worker/protocol/PromptRegistry.ts";
import {
  EngineBattleAction,
  EngineIdleAction,
  EngineLocation,
  EngineMessageType,
  EnginePosition,
  EngineResponseType,
} from "../../src/battle/worker/engine/engine-constants.ts";
import type {
  EngineCardData,
  EngineMessage,
} from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
/* The vendored definitions are the authority ADR-046 pins these encodings
   against, and their named masks type-check where a hand-written `a | b` does
   not: the message types admit only the combinations the engine declares. */
import {
  OcgAttribute,
  OcgOpCode,
  OcgPosition,
  OcgRace,
  OcgType,
} from "../../vendor/ocgcore-wasm/0.1.2/dist/index.js";

const dependencies: ActiveDuelDependencies = {
  cards: new Map(),
  texts: new Map([
    [
      97590747,
      {
        code: 97590747,
        name: "La Jinn",
        description: "A mystical genie.",
        strings: ["Activate La Jinn's effect"],
      },
    ],
  ]),
  scripts: new Map(),
  strings: { system: {}, victory: {}, counter: {}, setname: {} },
  images: new Map(),
  counts: { cards: 0, texts: 1, scripts: 0, globals: 0, images: 0 },
};

/* The same duel, with the pinned strings the substitution above reads. Held
   apart so every other case keeps proving the empty-snapshot path. */
const systemStringDependencies: ActiveDuelDependencies = {
  ...dependencies,
  strings: {
    ...dependencies.strings,
    system: {
      "200": 'Use the effect of "%ls" from [%ls]?',
      "1004": "Graveyard",
    },
  },
};

/* No announced value equals its own position, so an encoder that answered
   with the value rather than the index answers 8 here — which no three-option
   list can index. A fixture like [0, 1, 2] would pass under either encoding. */
const announcedNumbers: EngineMessage = {
  type: EngineMessageType.ANNOUNCE_NUMBER,
  player: 0,
  options: [4n, 6n, 8n],
};

const idleMessage: EngineMessage = {
  type: EngineMessageType.SELECT_IDLE_COMMAND,
  player: 0,
  summons: [
    {
      code: 97590747,
      controller: 0,
      location: EngineLocation.HAND,
      sequence: 2,
    },
  ],
  special_summons: [],
  pos_changes: [],
  monster_sets: [],
  spell_sets: [],
  activates: [],
  to_bp: false,
  to_ep: true,
  shuffle: false,
};

describe("PromptRegistry", () => {
  it("maps opaque choices back to Worker-private idle response indexes", () => {
    const binding = buildEnginePrompt(idleMessage, 1, dependencies);
    expect(binding).not.toBeNull();
    const summon = binding?.prompt.choices.find(
      (choice) => choice.action === "summon",
    );
    expect(summon?.label).toContain("La Jinn");
    expect(summon?.card).toMatchObject({
      name: "La Jinn",
      description: "A mystical genie.",
    });
    expect(binding?.prompt).not.toHaveProperty("index");
    expect(binding?.resolve(summon === undefined ? [] : [summon.id])).toEqual({
      type: EngineResponseType.SELECT_IDLE_COMMAND,
      action: EngineIdleAction.SUMMON,
      index: 0,
    });
  });

  it("idle command no longer offers shuffle", () => {
    const binding = buildEnginePrompt(
      { ...idleMessage, shuffle: true },
      1,
      dependencies,
    );
    expect(binding).not.toBeNull();
    expect(
      binding?.prompt.choices.some((choice) => choice.action === "shuffle"),
    ).toBe(false);
  });

  it("rejects stale, duplicate, and unknown choices", () => {
    const registry = new PromptRegistry(dependencies);
    const prompt = registry.publish(idleMessage);
    expect(prompt).not.toBeNull();
    const selected = prompt?.choices[0];
    if (prompt === null || selected === undefined)
      throw new Error("Fixture prompt is empty");
    registry.respond(prompt.id, [selected.id]);
    expect(() => registry.respond(prompt.id, [selected.id])).toThrow(
      /No prompt/,
    );
  });

  it("validates exact and at-least sum modes with packed contributions", () => {
    const exact = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_SUM,
        player: 0,
        select_max: 0,
        amount: 3,
        min: 1,
        max: 1,
        selects_must: [],
        selects: [
          {
            code: 97590747,
            controller: 0,
            location: EngineLocation.HAND,
            sequence: 0,
            position: EnginePosition.FACE_DOWN_DEFENSE,
            amount: (3 << 16) | 2,
          },
        ],
      },
      2,
      dependencies,
    );
    const exactChoice = exact?.prompt.choices[0];
    if (exactChoice === undefined)
      throw new Error("Exact sum choice is missing");
    expect(exactChoice.card).toMatchObject({
      contribution: 2,
      alternativeContribution: 3,
    });
    expect(exact?.resolve([exactChoice.id])).toEqual({
      type: EngineResponseType.SELECT_SUM,
      indicies: [0],
    });

    const atLeast = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_SUM,
        player: 0,
        select_max: 1,
        amount: 5,
        min: 0,
        max: 0,
        selects_must: [],
        selects: [0, 1].map((sequence) => ({
          code: 97590747,
          controller: 0 as const,
          location: EngineLocation.HAND,
          sequence,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          amount: 3,
        })),
      },
      3,
      dependencies,
    );
    const atLeastChoices = atLeast?.prompt.choices ?? [];
    expect(atLeast?.prompt).toMatchObject({
      minimum: 0,
      maximum: 2,
      sumMode: "atLeast",
      requiredTotal: 5,
    });
    expect(() => atLeast?.resolve([atLeastChoices[0]!.id])).toThrow(
      /minimum total 5/,
    );
    expect(atLeast?.resolve(atLeastChoices.map((choice) => choice.id))).toEqual(
      { type: EngineResponseType.SELECT_SUM, indicies: [0, 1] },
    );

    const mandatoryOnly = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_SUM,
        player: 0,
        select_max: 1,
        amount: 5,
        min: 0,
        max: 0,
        selects_must: [2, 3].map((amount, sequence) => ({
          code: 97590747,
          controller: 0 as const,
          location: EngineLocation.HAND,
          sequence,
          position: EnginePosition.FACE_DOWN_DEFENSE,
          amount,
        })),
        selects: [
          {
            code: 97590747,
            controller: 0,
            location: EngineLocation.HAND,
            sequence: 2,
            position: EnginePosition.FACE_DOWN_DEFENSE,
            amount: 1,
          },
        ],
      },
      4,
      dependencies,
    );
    expect(mandatoryOnly?.prompt.minimum).toBe(0);
    expect(mandatoryOnly?.resolve([])).toEqual({
      type: EngineResponseType.SELECT_SUM,
      indicies: [],
    });
  });

  it("rejects duplicate cards in a sort order", () => {
    const binding = buildEnginePrompt(
      {
        type: EngineMessageType.SORT_CARD,
        player: 0,
        cards: [0, 1].map((sequence) => ({
          code: 97590747,
          controller: 0 as const,
          location: EngineLocation.DECK,
          sequence,
        })),
      },
      4,
      dependencies,
    );
    const choice = binding?.prompt.choices[0];
    if (choice === undefined) throw new Error("Sort choice is missing");
    expect(() => binding?.resolve([choice.id, choice.id])).toThrow(
      /Duplicate choice IDs/,
    );
  });

  it("handles zero, one, and multiple chain candidates", () => {
    const activeCard = (sequence: number) => ({
      code: 97590747,
      controller: 0 as const,
      location: EngineLocation.MONSTER,
      sequence,
      position: EnginePosition.FACE_UP_ATTACK,
      description: 0n,
      client_mode: 0 as const,
    });
    for (const count of [0, 1, 2]) {
      const binding = buildEnginePrompt(
        {
          type: EngineMessageType.SELECT_CHAIN,
          player: 0,
          spe_count: 0,
          forced: false,
          hint_timing: 1,
          hint_timing_other: 1,
          selects: Array.from({ length: count }, (_, index) =>
            activeCard(index),
          ),
        },
        10 + count,
        dependencies,
      );
      expect(binding?.prompt.choices).toHaveLength(count + 1);
      expect(binding?.prompt.choices.at(-1)?.action).toBe("pass");
    }
  });

  /* The core substitutes `options[value]` for the answer it reads back and
     replies MSG_RETRY when `value` is not an index into that list, so a
     response carrying the announced number itself announces the wrong one
     whenever it lands in range and stops the duel whenever it does not. */
  it("answers an announced number with its index rather than its value", () => {
    const binding = buildEnginePrompt(announcedNumbers, 21, dependencies);
    const eight = binding?.prompt.choices.at(-1);
    if (eight === undefined) throw new Error("Announced numbers are missing");
    expect(eight.label).toBe("8");
    expect(binding?.resolve([eight.id])).toEqual({
      type: EngineResponseType.ANNOUNCE_NUMBER,
      value: 2,
    });
  });

  it("labels announced-number choices with the announced value", () => {
    const binding = buildEnginePrompt(announcedNumbers, 21, dependencies);
    expect(binding?.prompt.choices.map((choice) => choice.label)).toEqual([
      "4",
      "6",
      "8",
    ]);
  });

  it("rejects an announced number carrying more than one choice", () => {
    const binding = buildEnginePrompt(announcedNumbers, 21, dependencies);
    const [four, six] = binding?.prompt.choices ?? [];
    if (four === undefined || six === undefined)
      throw new Error("Announced numbers are missing");
    expect(() => binding?.resolve([four.id, six.id])).toThrow(
      /Select exactly one choice/,
    );
  });

  it("emits a diagnostic when localized option text is missing", () => {
    const diagnostics: unknown[] = [];
    const option = 123n << 20n;
    const binding = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_OPTION,
        player: 0,
        options: [option],
      },
      13,
      dependencies,
      "",
      (diagnostic) => diagnostics.push(diagnostic),
    );
    expect(binding?.prompt.choices[0]?.label).toBe(`Option ${option}`);
    expect(diagnostics).toEqual([
      { type: "missing_text", reference: `option:${option}` },
    ]);
  });

  /* Project Ignis ships system string 200 as a printf template. Left unfilled
     the player reads `%ls` where the card's name belongs, which is the whole
     point of the substitution. */
  it("fills the card name and location into a system-string effect description", () => {
    const effect = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_EFFECT_YES_NO,
        player: 0,
        code: 97590747,
        controller: 0,
        location: EngineLocation.GRAVEYARD,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        description: 200n,
      },
      7,
      systemStringDependencies,
    );
    expect(effect?.prompt.message).toBe(
      'Use the effect of "La Jinn" from [Graveyard]?',
    );
  });

  it("adds effect-card details and explicit counter capacities to public prompts", () => {
    const effect = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_EFFECT_YES_NO,
        player: 0,
        code: 97590747,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 0,
        position: EnginePosition.FACE_UP_ATTACK,
        description: (97590747n << 20n) | 0n,
      },
      5,
      dependencies,
    );
    expect(effect?.prompt).toMatchObject({
      message: "Activate La Jinn's effect",
      contextCard: {
        code: 97590747,
        name: "La Jinn",
        description: "A mystical genie.",
      },
    });

    const counters = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_COUNTER,
        player: 0,
        counter_type: 1,
        count: 2,
        cards: [
          {
            code: 97590747,
            controller: 0,
            location: EngineLocation.MONSTER,
            sequence: 0,
            count: 2,
          },
        ],
      },
      6,
      dependencies,
    );
    expect(counters?.prompt.choices[0]).toMatchObject({
      allocationMaximum: 2,
    });
  });

  it("redacts opponent hidden identities from public prompt cards and labels", () => {
    const binding = buildEnginePrompt(
      {
        type: EngineMessageType.SELECT_CARD,
        player: 0,
        can_cancel: false,
        min: 1,
        max: 1,
        selects: [
          {
            code: 97590747,
            controller: 1,
            location: EngineLocation.BANISHED,
            sequence: 0,
            position: EnginePosition.FACE_DOWN_DEFENSE,
          },
        ],
      },
      7,
      dependencies,
    );
    expect(binding?.prompt.choices[0]).toMatchObject({
      label: "Hidden card",
      card: { controller: 1, location: "banished" },
    });
    expect(binding?.prompt.choices[0]?.card).not.toHaveProperty("code");
    expect(JSON.stringify(binding?.prompt)).not.toContain("97590747");
  });

  it("validates multi-card minimum and maximum bounds before encoding", () => {
    const message: EngineMessage = {
      type: EngineMessageType.SELECT_CARD,
      player: 0,
      can_cancel: false,
      min: 1,
      max: 1,
      selects: [
        {
          code: 97590747,
          controller: 0,
          location: EngineLocation.MONSTER,
          sequence: 0,
          position: EnginePosition.FACE_UP_ATTACK,
        },
      ],
    };
    const binding = buildEnginePrompt(message, 2, dependencies);
    expect(() => binding?.resolve([])).toThrow(/between 1 and 1/);
    const choice = binding?.prompt.choices[0];
    if (choice === undefined) throw new Error("Fixture choice is missing");
    expect(binding?.resolve([choice.id])).toEqual({
      type: EngineResponseType.SELECT_CARD,
      indicies: [0],
    });
  });

  /* ADR-046: one pinning test per prompt kind that answers the engine. Every
     fixture below gives its values positions they do not equal, because a
     fixture where value and position coincide passes under either encoding and
     proves nothing. `ANNOUNCE_NUMBER` is pinned by the announced-number tests
     above, which also record the disagreement they were written to catch. */
  describe("response encoding", () => {
    it("select-idle-command answers with the index into that action's own list", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_IDLE_COMMAND,
        player: 0,
        summons: [handCard(1)],
        special_summons: [],
        pos_changes: [],
        monster_sets: [],
        spell_sets: [],
        activates: [activatableCard(3), activatableCard(5)],
        to_bp: false,
        to_ep: true,
        shuffle: false,
      });
      expect(binding.prompt.choices.map((choice) => choice.action)).toEqual([
        "summon",
        "activate",
        "activate",
        "endPhase",
      ]);
      /* Third choice overall, second activatable card: the engine wants 1. */
      expect(binding.resolve(choiceIds(binding, 2))).toEqual({
        type: EngineResponseType.SELECT_IDLE_COMMAND,
        action: EngineIdleAction.ACTIVATE,
        index: 1,
      });
      expect(binding.resolve(choiceIds(binding, 3))).toEqual({
        type: EngineResponseType.SELECT_IDLE_COMMAND,
        action: EngineIdleAction.END_PHASE,
        index: null,
      });
    });

    it("select-battle-command answers with the index into that action's own list", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_BATTLE_COMMAND,
        player: 0,
        chains: [activatableCard(4)],
        attacks: [attackCard(3), attackCard(5)],
        to_m2: true,
        to_ep: true,
      });
      expect(binding.prompt.choices.map((choice) => choice.action)).toEqual([
        "activate",
        "attack",
        "attack",
        "mainPhase2",
        "endPhase",
      ]);
      expect(binding.resolve(choiceIds(binding, 2))).toEqual({
        type: EngineResponseType.SELECT_BATTLE_COMMAND,
        action: EngineBattleAction.ATTACK,
        index: 1,
      });
      expect(binding.resolve(choiceIds(binding, 3))).toEqual({
        type: EngineResponseType.SELECT_BATTLE_COMMAND,
        action: EngineBattleAction.MAIN_PHASE_2,
        index: null,
      });
    });

    it("select-effect-yes-no answers with a boolean rather than a choice index", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_EFFECT_YES_NO,
        player: 0,
        code: CARD_CODE,
        controller: 0,
        location: EngineLocation.MONSTER,
        sequence: 2,
        position: EnginePosition.FACE_UP_ATTACK,
        description: 0n,
      });
      expect(binding.resolve(choiceIds(binding, 0))).toEqual({
        type: EngineResponseType.SELECT_EFFECT_YES_NO,
        yes: true,
      });
      expect(binding.resolve(choiceIds(binding, 1))).toEqual({
        type: EngineResponseType.SELECT_EFFECT_YES_NO,
        yes: false,
      });
    });

    it("select-yes-no answers with a boolean rather than a choice index", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_YES_NO,
        player: 0,
        description: 0n,
      });
      expect(binding.resolve(choiceIds(binding, 0))).toEqual({
        type: EngineResponseType.SELECT_YES_NO,
        yes: true,
      });
      expect(binding.resolve(choiceIds(binding, 1))).toEqual({
        type: EngineResponseType.SELECT_YES_NO,
        yes: false,
      });
    });

    it("select-option answers with the option index", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_OPTION,
        player: 0,
        options: [900n, 901n, 902n],
      });
      expect(binding.resolve(choiceIds(binding, 2))).toEqual({
        type: EngineResponseType.SELECT_OPTION,
        index: 2,
      });
    });

    it("select-card answers with engine card indexes", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_CARD,
        player: 0,
        can_cancel: false,
        min: 2,
        max: 2,
        selects: [2, 4, 6, 8].map(fieldCard),
      });
      /* Second and fourth card, whose field sequences are 4 and 8. */
      expect(binding.resolve(choiceIds(binding, 1, 3))).toEqual({
        type: EngineResponseType.SELECT_CARD,
        indicies: [1, 3],
      });
    });

    it("select-chain answers with the chain index or null", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_CHAIN,
        player: 0,
        spe_count: 0,
        forced: false,
        hint_timing: 1,
        hint_timing_other: 1,
        selects: [activatableFieldCard(3), activatableFieldCard(6)],
      });
      expect(binding.resolve(choiceIds(binding, 1))).toEqual({
        type: EngineResponseType.SELECT_CHAIN,
        index: 1,
      });
      expect(binding.prompt.choices[2]?.action).toBe("pass");
      expect(binding.resolve(choiceIds(binding, 2))).toEqual({
        type: EngineResponseType.SELECT_CHAIN,
        index: null,
      });
    });

    it("select-place answers with the engine place address", () => {
      /* A set bit marks a zone as taken, so clearing bit 3 offers exactly one
         place: the selecting player's fourth monster zone. */
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_PLACE,
        player: 0,
        count: 1,
        field_mask: (0xffffffff & ~(1 << 3)) >>> 0,
      });
      expect(binding.prompt.choices).toHaveLength(1);
      expect(binding.resolve(choiceIds(binding, 0))).toEqual({
        type: EngineResponseType.SELECT_PLACE,
        places: [{ player: 0, location: EngineLocation.MONSTER, sequence: 3 }],
      });
    });

    it("select-disabled-field answers with the engine place address", () => {
      /* Bit 26 is the opponent's third spell/trap zone. */
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_DISABLED_FIELD,
        player: 0,
        count: 1,
        field_mask: (0xffffffff & ~(1 << 26)) >>> 0,
      });
      expect(binding.prompt.choices).toHaveLength(1);
      expect(binding.resolve(choiceIds(binding, 0))).toEqual({
        type: EngineResponseType.SELECT_DISABLED_FIELD,
        places: [
          { player: 1, location: EngineLocation.SPELL_TRAP, sequence: 2 },
        ],
      });
    });

    it("select-position answers with the position bit", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_POSITION,
        player: 0,
        code: CARD_CODE,
        positions: OcgPosition.DEFENSE,
      });
      /* Second offered position: the bit is 8, its ordinal would be 1. */
      expect(binding.resolve(choiceIds(binding, 1))).toEqual({
        type: EngineResponseType.SELECT_POSITION,
        position: EnginePosition.FACE_DOWN_DEFENSE,
      });
    });

    it("select-tribute answers with engine card indexes", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_TRIBUTE,
        player: 0,
        can_cancel: false,
        min: 2,
        max: 2,
        selects: [1, 3, 5].map(tributeCard),
      });
      expect(binding.resolve(choiceIds(binding, 0, 2))).toEqual({
        type: EngineResponseType.SELECT_TRIBUTE,
        indicies: [0, 2],
      });
    });

    it("sort-chain answers with engine card indexes or null", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SORT_CHAIN,
        player: 0,
        cards: [1, 3, 5].map(handCard),
      });
      expect(binding.resolve(choiceIds(binding, 2, 0, 1))).toEqual({
        type: EngineResponseType.SORT_CARD,
        order: [2, 0, 1],
      });
      expect(binding.resolve([])).toEqual({
        type: EngineResponseType.SORT_CARD,
        order: null,
      });
    });

    it("sort-card answers with engine card indexes or null", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SORT_CARD,
        player: 0,
        cards: [2, 4, 6].map(handCard),
      });
      expect(binding.resolve(choiceIds(binding, 1, 2, 0))).toEqual({
        type: EngineResponseType.SORT_CARD,
        order: [1, 2, 0],
      });
      expect(binding.resolve([])).toEqual({
        type: EngineResponseType.SORT_CARD,
        order: null,
      });
    });

    it("select-counter answers with per-card counts", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_COUNTER,
        player: 0,
        counter_type: 1,
        count: 3,
        cards: [counterCard(1, 2), counterCard(4, 3)],
      });
      /* Counts, one slot per message card, in the message's order — not the
         indexes of the cards the player picked. */
      expect(binding.resolve(choiceIds(binding, 1, 1, 1))).toEqual({
        type: EngineResponseType.SELECT_COUNTER,
        counters: [0, 3],
      });
      expect(binding.resolve(choiceIds(binding, 0, 1, 1))).toEqual({
        type: EngineResponseType.SELECT_COUNTER,
        counters: [1, 2],
      });
    });

    it("select-sum answers with selected indexes", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_SUM,
        player: 0,
        select_max: 0,
        amount: 7,
        min: 1,
        max: 3,
        selects_must: [],
        selects: [sumCard(1, 2), sumCard(2, 3), sumCard(3, 4)],
      });
      /* Contributions 3 and 4 make the required 7; the answer carries their
         positions, not the amounts they contributed. */
      expect(binding.resolve(choiceIds(binding, 1, 2))).toEqual({
        type: EngineResponseType.SELECT_SUM,
        indicies: [1, 2],
      });
    });

    it("select-unselect-card answers with the concatenated index or null", () => {
      const binding = buildPrompt({
        type: EngineMessageType.SELECT_UNSELECT_CARD,
        player: 0,
        can_finish: true,
        can_cancel: true,
        min: 1,
        max: 2,
        select_cards: [1, 2].map(fieldCard),
        unselect_cards: [3, 4].map(fieldCard),
      });
      /* Second unselectable card: `select_cards.length + 1`. */
      expect(binding.resolve(choiceIds(binding, 3))).toEqual({
        type: EngineResponseType.SELECT_UNSELECT_CARD,
        index: 3,
      });
      expect(binding.prompt.choices[4]?.action).toBe("finish");
      expect(binding.resolve(choiceIds(binding, 4))).toEqual({
        type: EngineResponseType.SELECT_UNSELECT_CARD,
        index: null,
      });
      expect(binding.prompt.choices[5]?.action).toBe("cancel");
      expect(binding.resolve(choiceIds(binding, 5))).toEqual({
        type: EngineResponseType.SELECT_UNSELECT_CARD,
        index: null,
      });
    });

    it("announce-race answers with a bitmask", () => {
      const binding = buildPrompt({
        type: EngineMessageType.ANNOUNCE_RACE,
        player: 0,
        count: 2,
        available: (OcgRace.WARRIOR |
          OcgRace.MACHINE |
          OcgRace.DRAGON) as OcgRace,
      });
      /* Race bits, which the writer ORs into one u64 — not their ordinals. */
      expect(binding.resolve(choiceIds(binding, 1, 2))).toEqual({
        type: EngineResponseType.ANNOUNCE_RACE,
        races: [OcgRace.MACHINE, OcgRace.DRAGON],
      });
    });

    it("announce-attribute answers with a bitmask", () => {
      const binding = buildPrompt({
        type: EngineMessageType.ANNOUNCE_ATTRIBUTE,
        player: 0,
        count: 2,
        available: (OcgAttribute.WATER |
          OcgAttribute.LIGHT |
          OcgAttribute.DARK) as OcgAttribute,
      });
      /* Attribute bits, which the writer ORs into one u32. */
      expect(binding.resolve(choiceIds(binding, 1, 2))).toEqual({
        type: EngineResponseType.ANNOUNCE_ATTRIBUTE,
        attributes: [OcgAttribute.LIGHT, OcgAttribute.DARK],
      });
    });

    it("announce-card answers with the card code", () => {
      const binding = buildPrompt(
        {
          type: EngineMessageType.ANNOUNCE_CARD,
          player: 0,
          /* Announce any monster, so both candidates match and the answer has
             to distinguish the second card's code from its index. */
          opcodes: [BigInt(OcgType.MONSTER), OcgOpCode.ISTYPE],
        },
        announceCardDependencies,
      );
      expect(binding.prompt.choices).toHaveLength(2);
      expect(binding.resolve(choiceIds(binding, 1))).toEqual({
        type: EngineResponseType.ANNOUNCE_CARD,
        card: 87654321,
      });
    });

    it("rock-paper-scissors answers 1, 2 or 3", () => {
      const binding = buildPrompt({
        type: EngineMessageType.ROCK_PAPER_SCISSORS,
        player: 0,
      });
      expect(binding.prompt.choices.map((choice) => choice.label)).toEqual([
        "Scissors",
        "Rock",
        "Paper",
      ]);
      /* Raw hand values, each one more than the choice's own position. */
      expect(
        [0, 1, 2].map((position) =>
          binding.resolve(choiceIds(binding, position)),
        ),
      ).toEqual([
        { type: EngineResponseType.ROCK_PAPER_SCISSORS, value: 1 },
        { type: EngineResponseType.ROCK_PAPER_SCISSORS, value: 2 },
        { type: EngineResponseType.ROCK_PAPER_SCISSORS, value: 3 },
      ]);
    });
  });
});

const CARD_CODE = 97590747;

const announceCardDependencies: ActiveDuelDependencies = {
  ...dependencies,
  cards: new Map([
    [12345678, monsterCardData(12345678)],
    [87654321, monsterCardData(87654321)],
  ]),
};

function buildPrompt(
  message: EngineMessage,
  deps: ActiveDuelDependencies = dependencies,
): EnginePromptBinding {
  const binding = buildEnginePrompt(message, 1, deps);
  if (binding === null)
    throw new Error(`Message ${message.type} publishes no prompt`);
  return binding;
}

function choiceIds(binding: EnginePromptBinding, ...positions: number[]) {
  return positions.map((position) => {
    const choice = binding.prompt.choices[position];
    if (choice === undefined)
      throw new Error(`Prompt has no choice at position ${position}`);
    return choice.id;
  });
}

function handCard(sequence: number) {
  return {
    code: CARD_CODE,
    controller: 0 as const,
    location: EngineLocation.HAND,
    sequence,
  };
}

function fieldCard(sequence: number) {
  return {
    code: CARD_CODE,
    controller: 0 as const,
    location: EngineLocation.MONSTER,
    sequence,
    position: EnginePosition.FACE_UP_ATTACK,
  };
}

function activatableCard(sequence: number) {
  return { ...handCard(sequence), description: 0n, client_mode: 0 as const };
}

function activatableFieldCard(sequence: number) {
  return { ...fieldCard(sequence), description: 0n, client_mode: 0 as const };
}

function attackCard(sequence: number) {
  return { ...handCard(sequence), can_direct: false };
}

function tributeCard(sequence: number) {
  return { ...handCard(sequence), release_param: 1 };
}

function counterCard(sequence: number, count: number) {
  return { ...handCard(sequence), count };
}

function sumCard(sequence: number, amount: number) {
  return { ...fieldCard(sequence), amount };
}

function monsterCardData(code: number): EngineCardData {
  return {
    code,
    alias: 0,
    setcodes: [],
    type: OcgType.MONSTER,
    level: 4,
    attribute: OcgAttribute.EARTH,
    race: OcgRace.WARRIOR,
    attack: 1800,
    defense: 1000,
    lscale: 0,
    rscale: 0,
    link_marker: 0,
  };
}
