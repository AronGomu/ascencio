import { describe, expect, it } from "vitest";
import { choiceId, promptId } from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
} from "../../src/duel/contracts/player-prompt.ts";
import { trivialPromptResponse } from "../../src/app/prompts/auto-response.ts";

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
