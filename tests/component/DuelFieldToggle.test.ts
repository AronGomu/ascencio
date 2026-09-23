// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import DuelField from "../../src/battle/app/components/DuelField.svelte";
import {
  createInteractionSession,
  reduceInteractionSession,
  type InteractionSessionAction,
} from "../../src/battle/app/prompts/interaction-session.ts";
import { mapPromptToInteractionSpec } from "../../src/battle/app/prompts/interaction-spec.ts";
import { validatePromptSelection } from "../../src/battle/app/prompts/prompt-selection.ts";
import { cardInstanceId } from "../../src/battle/duel/contracts/ids.ts";
import { mapSnapshotToBoard } from "../../src/battle/field/board-view-model.ts";
import { offFieldTargetEntries } from "../../src/battle/field/off-field-target-list.ts";
import { buildEnginePrompt } from "../../src/battle/worker/protocol/PromptRegistry.ts";
import {
  EngineLocation,
  EngineMessageType,
  EnginePosition,
  EngineResponseType,
} from "../../src/battle/worker/engine/engine-constants.ts";
import type { OcgLocation } from "../../vendor/ocgcore-wasm/0.1.2/dist/index.js";
import type { EngineResponse } from "../../src/battle/worker/engine/OcgCoreAdapter.ts";
import { BOARD_VIEW_MODEL_FIXTURES } from "../fixtures/board-view-model.ts";

afterEach(cleanup);

function renderToggle(
  location: "monster" | "graveyard" | "overlay",
  selectedCount: number,
  maximum = 3,
) {
  const source = BOARD_VIEW_MODEL_FIXTURES["ST-08"];
  const cards = [0, 1, 2].map((sequence) => ({
    ...source.players[0].monsters[0]!,
    instanceId: cardInstanceId(`toggle-${sequence}`),
    location: location === "overlay" ? ("monster" as const) : location,
    sequence,
  }));
  const state = {
    ...source,
    players: [
      {
        ...source.players[0],
        monsters: location !== "graveyard" ? cards : [],
        graveyard: location === "graveyard" ? cards : [],
      },
      source.players[1],
    ] as const,
  };
  const addresses = cards.map((card) => ({
    code: card.code!,
    controller: 0 as const,
    location:
      location === "overlay"
        ? ((EngineLocation.MONSTER | EngineLocation.OVERLAY) as OcgLocation)
        : location === "monster"
          ? EngineLocation.MONSTER
          : EngineLocation.GRAVEYARD,
    sequence: card.sequence,
    position: EnginePosition.FACE_UP_ATTACK,
  }));
  const binding = buildEnginePrompt(
    {
      type: EngineMessageType.SELECT_UNSELECT_CARD,
      player: 0,
      min: 1,
      max: maximum,
      can_finish: true,
      can_cancel: true,
      select_cards: addresses.slice(selectedCount),
      unselect_cards: addresses.slice(0, selectedCount),
    },
    1,
    {
      cards: new Map(),
      texts: new Map(),
      scripts: new Map(),
      images: new Map(),
      strings: { system: {}, victory: {}, counter: {}, setname: {} },
      counts: { cards: 0, texts: 0, scripts: 0, globals: 0, images: 0 },
    },
  );
  const mapped = mapSnapshotToBoard(state);
  if (!mapped.ok || binding === null) throw new Error("Invalid toggle fixture");
  const spec = mapPromptToInteractionSpec(binding.prompt, state, mapped.value, {
    workerGeneration: 1,
    sessionGeneration: 1,
  });
  if (spec.kind === "inactive") throw new Error("Missing toggle spec");
  let session = createInteractionSession(spec);
  const responses: EngineResponse[] = [];
  const oninteraction = async (action: InteractionSessionAction) => {
    const reduced = reduceInteractionSession(session, spec, action);
    session = reduced.session;
    if (reduced.command !== null) {
      expect(
        validatePromptSelection(binding.prompt, reduced.command.choiceIds)
          .valid,
      ).toBe(true);
      responses.push(binding.resolve(reduced.command.choiceIds));
    }
    await rendered.rerender({ session });
    return reduced.command !== null;
  };
  const rendered = render(DuelField, {
    board: mapped.value,
    prompt: binding.prompt,
    spec,
    session,
    oninteraction,
    offFieldTargets: offFieldTargetEntries(spec, state, new Map()),
  });
  return { binding, responses, rendered };
}

function element(selector: string): HTMLElement {
  const value = document.querySelector<HTMLElement>(selector);
  if (value === null) throw new Error(`Missing ${selector}`);
  return value;
}

describe("SELECT_UNSELECT_CARD field response binding", () => {
  it.each([0, 2])(
    "submits the clicked mounted card with %i cards already selected",
    async (selectedCount) => {
      const { binding, responses } = renderToggle("monster", selectedCount);
      const clicked = binding.prompt.choices.find(
        (choice) => choice.card?.sequence === 0,
      )!;
      await userEvent
        .setup()
        .click(element('[data-field-target="card:toggle-0"]'));
      expect(responses).toEqual([
        {
          type: EngineResponseType.SELECT_UNSELECT_CARD,
          index: binding.prompt.choices.indexOf(clicked),
        },
      ]);
      expect(
        document.querySelector('[data-cy="field-action-bar-confirm"]'),
      ).toBeNull();
    },
  );

  it.each([0, 2])(
    "submits a listed toggle, even at the selection cap (%i selected)",
    async (selectedCount) => {
      const { binding, responses } = renderToggle(
        "graveyard",
        selectedCount,
        2,
      );
      const clicked = binding.prompt.choices.find(
        (choice) => choice.card?.sequence === 2,
      )!;
      await userEvent
        .setup()
        .click(
          element(
            `[data-cy^="zone-list-entry-target-choice-"][data-cy$="-${clicked.id}"]`,
          ),
        );
      expect(responses).toEqual([
        {
          type: EngineResponseType.SELECT_UNSELECT_CARD,
          index: binding.prompt.choices.indexOf(clicked),
        },
      ]);
      expect(
        document.querySelector('[data-cy="zone-list-dialog-confirm-button"]'),
      ).toBeNull();
      expect(
        document.querySelector(
          '[data-cy="zone-list-dialog-target-cancel-button"]',
        ),
      ).toBeNull();
    },
  );

  it.each([0, 2])(
    "submits a material click, not the aggregate (%i selected)",
    async (selectedCount) => {
      const { binding, responses } = renderToggle("overlay", selectedCount);
      const clicked = binding.prompt.choices.find(
        (choice) => choice.card?.sequence === 0,
      )!;
      await userEvent
        .setup()
        .click(element(`[data-cy="material-select-tile-${clicked.id}"]`));
      expect(responses).toEqual([
        {
          type: EngineResponseType.SELECT_UNSELECT_CARD,
          index: binding.prompt.choices.indexOf(clicked),
        },
      ]);
      expect(
        document.querySelector('[data-cy="material-select-confirm"]'),
      ).toBeNull();
    },
  );

  it.each(["finish", "cancel"] as const)(
    "preserves material dialog %s IDs",
    async (action) => {
      const { responses } = renderToggle("overlay", 2);
      await userEvent
        .setup()
        .click(element(`[data-cy="material-select-${action}"]`));
      expect(responses).toEqual([
        { type: EngineResponseType.SELECT_UNSELECT_CARD, index: null },
      ]);
    },
  );

  it.each(["finish", "cancel"] as const)(
    "preserves explicit %s response IDs",
    async (action) => {
      const { binding, responses } = renderToggle("monster", 2);
      const choice = binding.prompt.choices.find(
        (choice) => choice.action === action,
      )!;
      await userEvent
        .setup()
        .click(element(`[data-cy="field-action-bar-choice-${choice.id}"]`));
      expect(responses).toEqual([
        { type: EngineResponseType.SELECT_UNSELECT_CARD, index: null },
      ]);
    },
  );
});
