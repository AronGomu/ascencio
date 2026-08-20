import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import type { DuelPresentationEvent } from "../../src/battle/duel/contracts/duel-presentation-event.ts";
import type {
  PlayerIndex,
  PublicChainLink,
  PublicDuelState,
} from "../../src/battle/duel/contracts/public-duel-state.ts";
import {
  lastActionActor,
  ownEffectChainPassResponse,
  trivialPromptResponse,
} from "../../src/battle/app/prompts/auto-response.ts";
import { BOARD_VIEW_MODEL_FIXTURES } from "../fixtures/board-view-model.ts";

function choice(
  id: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return {
    id: choiceId(id),
    label: id,
    action: "select",
    ...overrides,
  };
}

function prompt(
  overrides: Partial<PlayerPrompt> & Pick<PlayerPrompt, "kind">,
): PlayerPrompt {
  return {
    id: promptId("prompt-1"),
    player: 0,
    title: "Choose",
    choices: [],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  } as PlayerPrompt;
}

const CARD = {
  instanceId: "card-1" as never,
  controller: 0 as const,
  location: "spellTrap" as const,
  sequence: 0,
};

describe("trivialPromptResponse", () => {
  it("passes a chain with nothing to activate", () => {
    const p = prompt({
      kind: "chain",
      choices: [choice("p", { action: "pass" })],
      minimum: 0,
      maximum: 1,
    });
    expect(trivialPromptResponse(p)).toEqual([choiceId("p")]);
  });

  it("keeps a chain with a real option", () => {
    const p = prompt({
      kind: "chain",
      choices: [
        choice("a", { action: "activate", card: CARD }),
        choice("p", { action: "pass" }),
      ],
    });
    expect(trivialPromptResponse(p)).toBeNull();
  });

  it("answers a forced single-option chain", () => {
    const p = prompt({
      kind: "chain",
      choices: [choice("a", { action: "activate", card: CARD })],
    });
    expect(trivialPromptResponse(p)).toEqual([choiceId("a")]);
  });

  it("answers a single option prompt", () => {
    const p = prompt({
      kind: "option",
      choices: [choice("o1")],
    });
    expect(trivialPromptResponse(p)).toEqual([choiceId("o1")]);
  });

  it("keeps a two-option prompt", () => {
    const p = prompt({
      kind: "option",
      choices: [choice("o1"), choice("o2")],
    });
    expect(trivialPromptResponse(p)).toBeNull();
  });

  it("answers a single-position prompt", () => {
    const p = prompt({
      kind: "selectPosition",
      choices: [choice("z1")],
    });
    expect(trivialPromptResponse(p)).toEqual([choiceId("z1")]);
  });

  it("keeps a two-position prompt", () => {
    const p = prompt({
      kind: "selectPosition",
      choices: [choice("z1"), choice("z2")],
    });
    expect(trivialPromptResponse(p)).toBeNull();
  });

  it("never answers on behalf of the opponent", () => {
    const p = prompt({
      kind: "option",
      choices: [choice("o1")],
      player: 1,
    });
    expect(trivialPromptResponse(p)).toBeNull();
  });

  it("never answers a multi-select prompt", () => {
    const p = prompt({
      kind: "option",
      choices: [choice("o1")],
      minimum: 2,
      maximum: 2,
    });
    expect(trivialPromptResponse(p)).toBeNull();
  });
});

describe("lastActionActor", () => {
  it("attributes to the player of the latest action event", () => {
    const events: readonly DuelPresentationEvent[] = [
      { type: "turnStarted", player: 1, turn: 2 },
      { type: "summon", player: 1 },
      { type: "attack", player: 0, direct: false },
    ];
    expect(lastActionActor(events, 1)).toBe(0);
  });

  it("falls back to the turn player after a fresh turn", () => {
    const events: readonly DuelPresentationEvent[] = [
      { type: "attack", player: 0, direct: false },
      { type: "turnStarted", player: 1, turn: 2 },
      { type: "phaseChanged", phase: "main1" },
    ];
    expect(lastActionActor(events, 1)).toBe(1);
  });

  it("falls back to the turn player with no events", () => {
    expect(lastActionActor([], 1)).toBe(1);
  });
});

function chainLink(controller: PlayerIndex): PublicChainLink {
  return {
    index: 0,
    controller,
    sourceIdentityVisible: true,
    label: "Effect",
    phase: "pending",
    outcome: "normal",
  };
}

function snapshotWithChain(chain: readonly PublicChainLink[]): PublicDuelState {
  return { ...BOARD_VIEW_MODEL_FIXTURES["ST-05"], chain };
}

function chainPrompt(choices: readonly PromptChoice[]): PlayerPrompt {
  return prompt({ kind: "chain", choices, minimum: 0, maximum: 1 });
}

const CHAIN_CHOICES: readonly PromptChoice[] = [
  choice("a", { action: "activate", card: CARD }),
  choice("p", { action: "pass" }),
];

describe("ownEffectChainPassResponse", () => {
  it("passes a chain window responding to the player's own effect", () => {
    const response = ownEffectChainPassResponse(
      chainPrompt(CHAIN_CHOICES),
      snapshotWithChain([chainLink(0)]),
      1,
    );
    expect(response).toEqual([choiceId("p")]);
  });

  it("keeps prompting when the opponent owns the last chain link", () => {
    const response = ownEffectChainPassResponse(
      chainPrompt(CHAIN_CHOICES),
      snapshotWithChain([chainLink(1)]),
      0,
    );
    expect(response).toBeNull();
  });

  it("passes an empty-chain window after the player's own action", () => {
    const response = ownEffectChainPassResponse(
      chainPrompt(CHAIN_CHOICES),
      snapshotWithChain([]),
      0,
    );
    expect(response).toEqual([choiceId("p")]);
  });

  it("keeps prompting an empty-chain window after an opponent action", () => {
    const response = ownEffectChainPassResponse(
      chainPrompt(CHAIN_CHOICES),
      snapshotWithChain([]),
      1,
    );
    expect(response).toBeNull();
  });

  it("keeps prompting without a pass choice", () => {
    const response = ownEffectChainPassResponse(
      chainPrompt([choice("a", { action: "activate", card: CARD })]),
      snapshotWithChain([chainLink(0)]),
      0,
    );
    expect(response).toBeNull();
  });

  it("never answers another prompt kind or the opponent's chain", () => {
    expect(
      ownEffectChainPassResponse(
        prompt({ kind: "option", choices: [...CHAIN_CHOICES] }),
        snapshotWithChain([chainLink(0)]),
        0,
      ),
    ).toBeNull();
    expect(
      ownEffectChainPassResponse(
        prompt({ kind: "chain", choices: [...CHAIN_CHOICES], player: 1 }),
        snapshotWithChain([chainLink(0)]),
        0,
      ),
    ).toBeNull();
  });

  it("falls back to the last action actor without a snapshot", () => {
    expect(
      ownEffectChainPassResponse(chainPrompt(CHAIN_CHOICES), null, 0),
    ).toEqual([choiceId("p")]);
    expect(
      ownEffectChainPassResponse(chainPrompt(CHAIN_CHOICES), null, 1),
    ).toBeNull();
  });
});
