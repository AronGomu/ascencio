// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelField from "../../src/app/components/DuelField.svelte";
import DuelFieldErrorBoundary from "../../src/app/components/duel-field/DuelFieldErrorBoundary.svelte";
import FieldBoard from "../../src/app/components/duel-field/FieldBoard.svelte";
import CardTray from "../../src/app/components/duel-field/CardTray.svelte";
import {
  cardInstanceId,
  choiceId,
  promptId,
} from "../../src/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/duel/contracts/player-prompt.ts";
import { mapSnapshotToBoard } from "../../src/field/board-view-model.ts";
import { zoneListsForBoard } from "../../src/field/zone-list.ts";
import {
  createInteractionSession,
  reduceInteractionSession,
  type InteractionSession,
  type InteractionSessionAction,
} from "../../src/app/prompts/interaction-session.ts";
import {
  createInitialDuelViewState,
  reduceDuelViewState,
} from "../../src/app/stores/duel-store.ts";
import {
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
  STACK_ART_STATE,
} from "../fixtures/board-view-model.ts";
import {
  DUEL_FIELD_PUBLIC_STATE_MATRIX,
  DUEL_FIELD_PUBLIC_STATES,
} from "../fixtures/duel-field-public-events.ts";
import {
  PUBLIC_STATE_CARD_TEXTS,
  SIXTY_PUBLIC_CARDS,
} from "../fixtures/board-public-states.ts";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(Element.prototype, "animate");
});

function board(state: keyof typeof BOARD_VIEW_MODEL_FIXTURES) {
  const result = mapSnapshotToBoard(
    BOARD_VIEW_MODEL_FIXTURES[state],
    BOARD_CARD_TEXTS,
  );
  if (!result.ok)
    throw new Error(`Fixture mapping failed: ${result.error.type}`);
  return result.value;
}

const CONTEXT = { workerGeneration: 1, sessionGeneration: 2 } as const;

function promptChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return { id: choiceId(id), label, action: "select", ...overrides };
}

function fieldPrompt(
  kind: PromptKind,
  choices: readonly PromptChoice[],
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-field-component`),
    kind,
    player: 0,
    title: `Test ${kind}`,
    choices,
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

function mountedChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return promptChoice(id, label, {
    card: {
      instanceId: cardInstanceId(`prompt-${id}`),
      controller: 0,
      location: "monster",
      sequence: 0,
      position: "faceUpAttack",
    },
    ...overrides,
  } as Partial<PromptChoice>);
}

function activeSpec(value: PlayerPrompt): ActiveInteractionSpec {
  const snapshot = BOARD_VIEW_MODEL_FIXTURES["ST-05"];
  const valueBoard = board("ST-05");
  const spec = mapPromptToInteractionSpec(value, snapshot, valueBoard, CONTEXT);
  if (spec.kind === "inactive") throw new Error("Expected active field spec");
  return spec;
}

function renderInteractive(value: PlayerPrompt) {
  const valueBoard = board("ST-05");
  const spec = activeSpec(value);
  let session: InteractionSession = createInteractionSession(spec);
  const commands: string[][] = [];
  const dispatch = vi.fn(async (action: InteractionSessionAction) => {
    const reduction = reduceInteractionSession(session, spec, action);
    const changed = reduction.session !== session;
    session = reduction.session;
    if (reduction.command !== null)
      commands.push([...reduction.command.choiceIds]);
    await rendered.rerender({ session });
    return reduction.command !== null || changed;
  });
  const rendered = render(DuelField, {
    board: valueBoard,
    prompt: value,
    spec,
    session,
    pending: false,
    oninteraction: dispatch,
  });
  return { rendered, spec, dispatch, commands, getSession: () => session };
}

describe("DuelField", () => {
  it("DF-16 validates ST-01 public fixture through parse/store/component seam", () => {
    const value = DUEL_FIELD_PUBLIC_STATES["ST-01"];
    const view = reduceDuelViewState(createInitialDuelViewState(CONTEXT), {
      context: CONTEXT,
      event: value.event,
    });
    expect(view.snapshot).toBe(value.event.state);
    render(DuelField, { board: value.board });

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelectorAll("[data-zone-id]")).toHaveLength(34);
    expect(value.artifactPath).toBe("test-results/df-16-ST-01.json");
    expect(document.body.textContent).not.toContain("Dark Magician");
    expect(document.body.innerHTML).not.toContain("46986414");
  });

  it("duel field no longer renders the status pills", () => {
    const value = DUEL_FIELD_PUBLIC_STATES["ST-01"];
    render(DuelField, { board: value.board });

    expect(document.querySelector('[data-cy="field-status-pills"]')).toBeNull();
    expect(document.querySelector('[data-cy="prio-pill"]')).toBeNull();
    expect(document.querySelector('[data-cy="phase-pill"]')).toBeNull();
    expect(
      document.querySelector('[data-cy="field-phase-strip"]'),
    ).not.toBeNull();
  });

  it.each(DUEL_FIELD_PUBLIC_STATE_MATRIX)(
    "DF-16 validates %s semantic/layout acceptance assertions",
    ({ id, board: value, assertions }) => {
      render(DuelField, { board: value });
      const field = screen.getByRole("region", { name: "Duel field" });
      expect(field.querySelectorAll("[data-zone-id]")).toHaveLength(34);
      expect(value.nav.size).toBeGreaterThan(0);
      expect(assertions.length).toBeGreaterThan(0);

      switch (id) {
        case "ST-01":
        case "ST-12":
          expect(
            within(field).getAllByRole("article", {
              name: "Hidden opponent hand card",
            }).length,
          ).toBeGreaterThan(0);
          expect(document.body.textContent).not.toContain("Dark Magician");
          break;
        case "ST-03":
          expect(
            within(field).getAllByRole("group", {
              name: /^Shared Extra Monster Zone/,
            }),
          ).toHaveLength(2);
          break;
        case "ST-04":
        case "ST-11":
          expect(
            within(field)
              .getByRole("article", { name: /face-up defense/ })
              .getAttribute("data-orientation"),
          ).toBe("sideways");
          break;
        case "ST-07":
        case "ST-13":
          expect(
            value.cards.some((card) =>
              card.counters.some(
                (counter) =>
                  counter.name === "Spell Counter" && counter.count === 3,
              ),
            ),
          ).toBe(true);
          expect(document.body.textContent).not.toContain("Dark Magician");
          break;
        case "ST-08":
        case "ST-09":
        case "ST-14":
          expect(
            within(field).getAllByRole("group", { name: /Your Extra Deck/ })
              .length,
          ).toBeGreaterThan(0);
          break;
        default:
          expect(
            within(field).getByRole("group", { name: "Standard duel board" }),
          ).toBeTruthy();
      }
    },
  );

  it("has no stray heading or field/duel-state live regions, and still renders the board", () => {
    const value = board("ST-01");
    const { container } = render(DuelField, { board: value });

    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector('[aria-label="Field updates"]')).toBeNull();
    expect(
      container.querySelector('[aria-label="Duel state updates"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="duel-field-board"]'),
    ).not.toBeNull();
  });

  it("renders one named semantic board with 34 stable physical zones and two shared EMZs", () => {
    const value = board("ST-01");
    render(DuelField, { board: value });

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelectorAll("[data-zone-id]")).toHaveLength(34);

    for (const zone of value.zones) {
      const node = within(field).getByRole("group", { name: zone.label });
      expect(node.getAttribute("data-zone-id")).toBe(zone.id);
    }

    const sharedZones = within(field).getAllByRole("group", {
      name: /^Shared Extra Monster Zone/,
    });
    expect(sharedZones).toHaveLength(2);
    expect(
      new Set(sharedZones.map((zone) => zone.getAttribute("data-zone-id"))),
    ).toEqual(
      new Set(["shared:extraMonster:left", "shared:extraMonster:right"]),
    );
    // The always-mounted, disabled End turn corner button has no active
    // prompt/spec to drive it here; the two non-empty deck stacks (T8) are
    // clickable regardless of any prompt.
    const buttons = within(field).queryAllByRole("button");
    expect(
      buttons.map((button) => button.getAttribute("data-cy")).sort(),
    ).toEqual(
      [
        "field-end-turn-button",
        "field-stack-p0:deck",
        "field-stack-p1:deck",
      ].sort(),
    );
  });

  it("keeps visible and hidden card nodes keyed without exposing opponent identity", async () => {
    const value = board("ST-01");
    const rendered = render(DuelField, {
      board: value,
      imageUrls: new Map([[97590747, "/cards/97590747.jpg"]]),
      cardBackUrl: "/cards/back.webp",
      placeholderUrl: "/cards/placeholder.webp",
    });

    const visible = screen.getByRole("article", {
      name: /The Legendary Fisherman in Your Hand/,
    });
    const hidden = screen.getAllByRole("article", {
      name: "Hidden opponent hand card",
    })[0];
    if (hidden === undefined) throw new Error("Missing hidden opponent card");
    expect(visible.getAttribute("data-card-id")).toBe("st01-own-hand");
    expect(hidden.getAttribute("data-hidden")).toBe("true");
    expect(document.body.textContent).not.toContain("Dark Magician");
    expect(document.body.innerHTML).not.toContain("46986414");
    expect(hidden.querySelector("img")?.getAttribute("alt")).toBe("");

    await rendered.rerender({ board: value });
    expect(
      screen.getByRole("article", {
        name: /The Legendary Fisherman in Your Hand/,
      }),
    ).toBe(visible);
    expect(
      screen.getAllByRole("article", {
        name: "Hidden opponent hand card",
      })[0],
    ).toBe(hidden);
  });

  it("renders stack counts through named passive controls", () => {
    render(DuelField, { board: board("ST-08") });

    /* Every stack rendered here has cards in it, so each is a clickable
       button (T8) rather than a passive group. */
    expect(
      screen.getByRole("button", { name: "Your Deck, 35 cards" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Your GY, 1 card, top card Blue-Eyes White Dragon",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Opponent Deck, 31 cards" }),
    ).toBeTruthy();
  });

  it("exposes defense and opponent orientation as readable state and DOM data", () => {
    render(DuelField, { board: board("ST-04") });

    const defense = screen.getByRole("article", {
      name: /Axe Raider in Your Main Monster 2, face-up defense/,
    });
    expect(defense.getAttribute("data-orientation")).toBe("sideways");
    expect(defense.classList.contains("is-sideways")).toBe(true);

    const opponent = board("ST-03").cards.find(
      (card) => card.facing === "opponent",
    );
    if (opponent === undefined)
      throw new Error("Missing opponent fixture card");
    cleanup();
    render(DuelField, { board: board("ST-03") });
    const opponentCard = screen.getByRole("article", {
      name: `Opponent controlled, ${opponent.label}`,
    });
    expect(opponentCard.getAttribute("data-facing")).toBe("opponent");
    expect(opponentCard.classList.contains("is-opponent")).toBe(true);
    expect(opponentCard.getAttribute("aria-label")).toContain("Opponent");
  });

  it("uses one roving field tab stop and spatial Arrow/Home/End focus", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    renderInteractive(value);

    const targets = [
      ...document.querySelectorAll<HTMLElement>("[data-field-target]"),
    ];
    expect(targets.filter((target) => target.tabIndex === 0)).toHaveLength(1);
    const card = screen.getByRole("button", {
      name: /Legal.*Select The Legendary Fisherman/,
    });
    expect(card.tabIndex).toBe(0);
    card.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement?.getAttribute("data-field-target")).toBe(
      "zone:p0:mainMonster:1",
    );
    await user.keyboard("{End}");
    expect(document.activeElement?.getAttribute("data-field-target")).toBe(
      "stack:p0:banished",
    );
    await user.keyboard("{Home}");
    expect(document.activeElement?.getAttribute("data-field-target")).toBe(
      "zone:p0:field",
    );
    expect(
      document.activeElement?.classList.contains("is-navigation-active"),
    ).toBe(true);
  });

  it("makes native Enter and Space activation equal click and exposes legal/selected state", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    const harness = renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Legal.*Select The Legendary Fisherman.*face-up attack/,
    });
    card.focus();
    await user.keyboard("{Enter}");
    expect(card.getAttribute("aria-pressed")).toBe("true");
    expect(harness.commands).toEqual([]);
    await user.keyboard(" ");
    expect(card.getAttribute("aria-pressed")).toBe("false");
    expect(harness.commands).toEqual([]);
  });

  it("pins the chips on Enter, walks them, and returns focus on Escape", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      mountedChoice("set", "Set The Legendary Fisherman", {
        action: "setMonster",
      }),
    ]);
    renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    card.focus();
    await user.keyboard("{Enter}");
    const firstChip = screen.getByRole("button", { name: "Activate effect" });
    const secondChip = screen.getByRole("button", {
      name: "Set The Legendary Fisherman",
    });
    await waitFor(() => expect(document.activeElement).toBe(firstChip));
    // The engine labels every set identically, so the chips carry the action
    // word while the full label stays on `title` / the accessible name.
    expect(firstChip.textContent?.trim()).toBe("Activate");
    expect(secondChip.textContent?.trim()).toBe("Set");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(secondChip);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.activeElement).toBe(card));
    // The chips element is hidden by CSS, never unmounted, so it is still in
    // the DOM here — count assertions would prove nothing either way.
    expect(
      document.querySelector('[data-cy^="card-action-chips-"]'),
    ).not.toBeNull();
  });

  it("survives unpinning after the pinned card target has already unmounted", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    const spec = activeSpec(value);
    const idle = createInteractionSession(spec);
    const rendered = render(DuelField, {
      board: board("ST-05"),
      prompt: value,
      spec,
      session: idle,
      pending: false,
    });
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    const targetId = card.getAttribute("data-field-target");
    if (targetId === null) throw new Error("Missing field target");
    await rendered.rerender({
      session: { ...idle, menuTarget: targetId } as InteractionSession,
    });

    // A pending response drops the card out of its actionable state, which
    // unmounts the target button and leaves `bind:this` holding null. The
    // unpin that arrives with the next prompt must not trip over that.
    await rendered.rerender({ pending: true });
    expect(
      document.querySelector('[data-cy^="card-action-chips-"]'),
    ).toBeNull();
    await rendered.rerender({ pending: true, session: idle });
    expect(screen.getByRole("region", { name: "Duel field" })).toBeTruthy();
  });

  it("dispatches exactly one chooseChoice from a chip and never reopens the menu", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      mountedChoice("set", "Set The Legendary Fisherman", {
        action: "setMonster",
      }),
    ]);
    const harness = renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    card.focus();
    await user.keyboard("{Enter}");
    const chip = screen.getByRole("button", { name: "Activate effect" });
    await waitFor(() => expect(document.activeElement).toBe(chip));
    harness.dispatch.mockClear();
    await user.keyboard("{Enter}");
    expect(harness.commands).toEqual([["activate"]]);
    expect(harness.dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      "chooseChoice",
    ]);
  });

  it("moves field focus to a new prompt target without stealing outside focus", async () => {
    const firstPrompt = fieldPrompt("selectCard", [
      mountedChoice("first", "First target"),
    ]);
    const firstSpec = activeSpec(firstPrompt);
    const rendered = render(DuelField, {
      board: board("ST-05"),
      prompt: firstPrompt,
      spec: firstSpec,
      session: createInteractionSession(firstSpec),
    });
    const firstTarget = screen.getByRole("button", {
      name: /Select The Legendary Fisherman/,
    });
    firstTarget.focus();

    const nextPrompt = fieldPrompt("selectPlace", [
      promptChoice("next", "Your Main Monster 5", {
        place: { player: 0, location: "monster", sequence: 4 },
      }),
    ]);
    const nextSpec = activeSpec(nextPrompt);
    await rendered.rerender({
      prompt: nextPrompt,
      spec: nextSpec,
      session: createInteractionSession(nextSpec),
    });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /Select Your Main Monster 5/ }),
      ),
    );

    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    await rendered.rerender({
      prompt: firstPrompt,
      spec: firstSpec,
      session: createInteractionSession(firstSpec),
    });
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it("exposes public controller, zone, position, counters, and materials", () => {
    render(DuelField, { board: board("ST-07") });
    const rich = screen.getByRole("article", {
      name: /The Legendary Fisherman in Your Main Monster 2, face-up attack, 3 Spell Counters, 2 materials/,
    });
    expect(rich.getAttribute("data-facing")).toBe("self");
    expect(document.body.innerHTML).not.toContain("46986414");
  });

  it("enters a card tray with Enter and returns focus with Escape", async () => {
    const user = userEvent.setup();
    render(CardTray, {
      label: "Your GY",
      player: 0,
      zone: "graveyard",
      count: 60,
      cards: SIXTY_PUBLIC_CARDS,
      cardTexts: PUBLIC_STATE_CARD_TEXTS,
    });
    const open = screen.getByRole("button", {
      name: "Open Your GY tray, 60 cards",
    });
    open.focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getAllByRole("button", { name: /^Inspect / })[0],
      ),
    );
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(open);
  });

  it("pins the chips on click, never pointerdown, and a moved pointer does not pin them", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      mountedChoice("set", "Set The Legendary Fisherman", {
        action: "setMonster",
      }),
    ]);
    const harness = renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    const article = card.closest(".duel-field-card");
    if (article === null) throw new Error("Missing card article");
    const targetId = card.getAttribute("data-field-target");
    expect(
      article.querySelector(
        `[data-cy="card-action-chips-${article.getAttribute("data-card-id")}"]`,
      ),
    ).not.toBeNull();

    await fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    expect(article.classList.contains("is-pinned")).toBe(false);
    await fireEvent.pointerMove(card, { clientX: 40, clientY: 40 });
    await fireEvent.pointerUp(card, { clientX: 40, clientY: 40 });
    await fireEvent.click(card);
    expect(article.classList.contains("is-pinned")).toBe(false);
    expect(harness.dispatch).not.toHaveBeenCalled();

    await fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    await fireEvent.pointerUp(card, { clientX: 10, clientY: 10 });
    await fireEvent.click(card);
    expect(harness.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "openMenu",
      target: targetId,
    });
    await waitFor(() =>
      expect(article.classList.contains("is-pinned")).toBe(true),
    );
    expect(
      within(article as HTMLElement).getByRole("button", {
        name: "Activate effect",
      }).textContent,
    ).toBe("Activate");
  });

  it("gives every actionable card chips markup, non-actionable cards none, and no menu anywhere", () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    // ST-06 holds two monsters; only the one the prompt names is actionable.
    const valueBoard = board("ST-06");
    const spec = mapPromptToInteractionSpec(
      value,
      BOARD_VIEW_MODEL_FIXTURES["ST-06"],
      valueBoard,
      CONTEXT,
    );
    if (spec.kind === "inactive") throw new Error("Expected active field spec");
    const { container } = render(DuelField, {
      board: valueBoard,
      prompt: value,
      spec,
      session: createInteractionSession(spec),
    });

    expect(container.querySelector('[role="menu"]')).toBeNull();
    const actionable = container.querySelector(
      ".duel-field-card.is-actionable",
    );
    if (actionable === null) throw new Error("Missing actionable card");
    expect(
      actionable.querySelector('[data-cy^="card-action-chips-"]'),
    ).not.toBeNull();

    const passive = [
      ...container.querySelectorAll(".duel-field-card:not(.is-actionable)"),
    ];
    expect(passive.length).toBeGreaterThan(0);
    for (const card of passive)
      expect(card.querySelector('[data-cy^="card-action-chips-"]')).toBeNull();
  });

  it("offers no Inspect button anywhere on the field", () => {
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    const { rendered } = renderInteractive(value);
    expect(screen.queryAllByRole("button", { name: /^Inspect / })).toEqual([]);
    expect(
      rendered.container.querySelector(".duel-field-card__inspect"),
    ).toBeNull();
    expect(rendered.container.querySelector('[role="menu"]')).toBeNull();
  });

  it("toggles multi, sum, unselect, and place drafts without submitting before explicit Confirm", async () => {
    const user = userEvent.setup();
    for (const [kind, choice, overrides] of [
      [
        "selectCard",
        mountedChoice("multi", "Select monster"),
        { minimum: 1, maximum: 2 },
      ],
      [
        "selectTribute",
        mountedChoice("tribute", "Tribute monster"),
        { minimum: 1, maximum: 1 },
      ],
      [
        "selectSum",
        mountedChoice("sum", "Tribute monster", {
          card: {
            instanceId: cardInstanceId("prompt-sum"),
            controller: 0,
            location: "monster",
            sequence: 0,
            position: "faceUpAttack",
            contribution: 2,
          },
        }),
        { requiredTotal: 2, sumMode: "exact" },
      ],
      ["selectUnselectCard", mountedChoice("toggle", "Toggle monster"), {}],
    ] as const) {
      cleanup();
      const value = fieldPrompt(kind, [choice], overrides);
      const harness = renderInteractive(value);
      const target = screen.getByRole("button", {
        name: /Select The Legendary Fisherman/,
      });
      await user.click(target);
      expect(harness.commands).toEqual([]);
      expect(
        (screen.getByRole("button", { name: /Confirm/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      // Inspection moved off the card entirely; the HUD trays own it now.
      expect(screen.queryAllByRole("button", { name: /^Inspect / })).toEqual(
        [],
      );
      await user.click(screen.getByRole("button", { name: /Confirm/ }));
      expect(harness.commands).toEqual([[choice.id]]);
    }
  });

  it("zone click submits a single placement", async () => {
    const user = userEvent.setup();
    for (const kind of ["selectPlace", "selectDisabledField"] as const) {
      cleanup();
      const choice = promptChoice("place", "Your Main Monster 1", {
        place: { player: 0, location: "monster", sequence: 0 },
      });
      const value = fieldPrompt(kind, [choice]);
      const harness = renderInteractive(value);
      expect(screen.queryByRole("button", { name: /Confirm/ })).toBeNull();
      await user.click(
        screen.getByRole("button", { name: /Select Your Main Monster 1/ }),
      );
      expect(harness.commands).toEqual([[choice.id]]);
    }
  });

  it("requires valid explicit counter allocation and order confirmation; supports cancel, finish, and pass", async () => {
    const user = userEvent.setup();
    const counter = fieldPrompt(
      "selectCounter",
      [mountedChoice("counter", "Spell Counter", { allocationMaximum: 2 })],
      { minimum: 2, maximum: 2 },
    );
    let harness = renderInteractive(counter);
    const confirmAllocation = screen.getByRole("button", {
      name: "Confirm allocation",
    });
    expect((confirmAllocation as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /Add one counter/ }));
    expect((confirmAllocation as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /Add one counter/ }));
    expect((confirmAllocation as HTMLButtonElement).disabled).toBe(false);
    expect(harness.commands).toEqual([]);
    await user.click(confirmAllocation);
    expect(harness.commands).toEqual([
      [choiceId("counter"), choiceId("counter")],
    ]);

    cleanup();
    const order = fieldPrompt(
      "sortCard",
      [mountedChoice("first", "First"), mountedChoice("second", "Second")],
      { minimum: 2, maximum: 2, ordered: true, cancelable: true },
    );
    harness = renderInteractive(order);
    await user.click(screen.getByRole("button", { name: "Move First down" }));
    expect(harness.commands).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Confirm order" }));
    expect(harness.commands).toEqual([[choiceId("second"), choiceId("first")]]);

    for (const [label, action] of [
      ["Cancel", "cancel"],
      ["Finish", "finish"],
      ["Pass", "pass"],
    ] as const) {
      cleanup();
      const command = fieldPrompt("chain", [
        mountedChoice(label.toLowerCase(), label, { action }),
      ]);
      harness = renderInteractive(command);
      await user.click(screen.getByRole("button", { name: /Open actions/ }));
      expect(harness.commands).toEqual([[choiceId(label.toLowerCase())]]);
    }
  });

  it("single-choice card fires the action directly", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    const harness = renderInteractive(value);
    await user.click(
      screen.getByRole("button", {
        name: /Open actions for The Legendary Fisherman/,
      }),
    );
    expect(harness.dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      "chooseChoice",
    ]);
    expect(harness.commands).toEqual([[choiceId("activate")]]);
  });

  it("multi-choice card still opens the menu", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
      mountedChoice("set", "Set The Legendary Fisherman", {
        action: "setMonster",
      }),
    ]);
    const harness = renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    const targetId = card.getAttribute("data-field-target");
    await user.click(card);
    expect(harness.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "openMenu",
      target: targetId,
    });
  });

  it("outside click cancels a cancelable prompt", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt(
      "selectPlace",
      [
        promptChoice("place", "Your Main Monster 1", {
          place: { player: 0, location: "monster", sequence: 0 },
        }),
      ],
      { cancelable: true },
    );
    const harness = renderInteractive(value);
    const surface = document.querySelector<HTMLElement>(
      '[data-cy="duel-field-board-surface"]',
    );
    if (surface === null) throw new Error("Missing board surface");
    await user.click(surface);
    expect(harness.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "cancel",
    });
  });

  it("outside click is inert when not cancelable", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt(
      "selectPlace",
      [
        promptChoice("place", "Your Main Monster 1", {
          place: { player: 0, location: "monster", sequence: 0 },
        }),
      ],
      { cancelable: false },
    );
    const harness = renderInteractive(value);
    const surface = document.querySelector<HTMLElement>(
      '[data-cy="duel-field-board-surface"]',
    );
    if (surface === null) throw new Error("Missing board surface");
    await user.click(surface);
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it("outside click is inert for a single-choice prompt", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt(
      "chain",
      [mountedChoice("pass", "Pass", { action: "pass" })],
      { cancelable: true },
    );
    const harness = renderInteractive(value);
    const surface = document.querySelector<HTMLElement>(
      '[data-cy="duel-field-board-surface"]',
    );
    if (surface === null) throw new Error("Missing board surface");
    await user.click(surface);
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it("outside click ignores clicks on targets", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt(
      "selectPlace",
      [
        promptChoice("place", "Your Main Monster 1", {
          place: { player: 0, location: "monster", sequence: 0 },
        }),
      ],
      { cancelable: true },
    );
    const harness = renderInteractive(value);
    await user.click(
      screen.getByRole("button", { name: /Select Your Main Monster 1/ }),
    );
    expect(
      harness.dispatch.mock.calls.some(([action]) => action.type === "cancel"),
    ).toBe(false);
  });

  it("contains render failure locally and remounts without exposing error detail", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate", { action: "activate" }),
    ]);
    const spec = activeSpec(value);
    render(DuelFieldErrorBoundary, {
      board: board("ST-05"),
      imageUrls: new Map(),
      cardBackUrl: "",
      placeholderUrl: "",
      prompt: value,
      spec,
      session: createInteractionSession(spec),
      pending: false,
      injectFailure: true,
      oninteraction: vi.fn(),
    });

    expect(
      screen.getByRole("heading", {
        name: "Interactive field could not render",
      }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      "Injected duel field component failure",
    );
    await user.click(screen.getByRole("button", { name: "Retry duel field" }));
    expect(screen.getByRole("region", { name: "Duel field" })).toBeTruthy();
  });

  it("shows final feedback classes and an aria-hidden pointer-transparent SVG line", async () => {
    const current = board("ST-05");
    const moved = current.cards[0];
    if (moved === undefined || moved.instanceId === undefined)
      throw new Error("Missing movement fixture card");
    const previous = {
      ...current,
      cards: [
        {
          ...moved,
          zoneId: "p0:hand" as const,
        },
      ],
    };
    const rendered = render(DuelField, {
      board: previous,
      feedbackGeneration: "1:1",
      presentationEvents: [],
    });

    await rendered.rerender({
      presentationEvents: [
        {
          sequence: 1,
          event: {
            type: "cardMoved",
            instanceId: moved.instanceId,
            from: "hand",
            to: "monster",
          },
        },
      ],
    });
    expect(screen.queryByRole("status")).toBeNull();

    await rendered.rerender({ board: current });

    expect(screen.getByRole("status").textContent).toContain("Card moved");
    expect(
      document.querySelector(`[data-card-id="${moved.id}"]`)?.classList,
    ).toContain("is-feedback-target");
    const line = document.querySelector("svg.field-lines");
    expect(line?.getAttribute("aria-hidden")).toBe("true");
    expect(line?.getAttribute("focusable")).toBe("false");
    expect(line?.querySelector("line")).not.toBeNull();
  });

  it("cancels feedback on a new runtime generation", async () => {
    const value = board("ST-05");
    const card = value.cards[0];
    if (card === undefined || card.code === undefined)
      throw new Error("Missing summon fixture card");
    const presentationEvents = [
      {
        sequence: 1,
        event: { type: "summon" as const, player: 0 as const, card: card.code },
      },
    ];
    const rendered = render(DuelField, {
      board: board("ST-01"),
      feedbackGeneration: "1:1",
      presentationEvents: [],
    });
    await rendered.rerender({ presentationEvents });
    await rendered.rerender({ board: value });
    expect(screen.getByRole("status").textContent).toBe("Normal Summon");

    await rendered.rerender({
      feedbackGeneration: "2:0",
      presentationEvents,
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector(".is-feedback-target")).toBeNull();
    expect(document.querySelector("svg.field-lines")).toBeNull();
  });

  it("uses no movement in reduced motion while final highlight, text, and input remain", async () => {
    const animate = vi.fn(() => ({
      cancel: vi.fn(),
      finished: new Promise<void>(() => undefined),
    }));
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select card"),
    ]);
    const valueBoard = board("ST-05");
    const card = valueBoard.cards[0];
    if (card === undefined || card.code === undefined)
      throw new Error("Missing feedback fixture card");
    const spec = activeSpec(value);
    const oninteraction = vi.fn(() => true);
    const rendered = render(DuelField, {
      board: valueBoard,
      prompt: value,
      spec,
      session: createInteractionSession(spec),
      pending: false,
      feedbackGeneration: "1:1",
      reducedMotion: true,
      presentationEvents: [],
      oninteraction,
    });
    await rendered.rerender({
      presentationEvents: [
        {
          sequence: 1,
          event: { type: "summon", player: 0, card: card.code },
        },
      ],
    });
    await rendered.rerender({ board: { ...valueBoard } });

    expect(animate).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("Normal Summon");
    expect(document.querySelector(".is-feedback-target")).not.toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Select The Legendary/ }));
    expect(oninteraction).toHaveBeenCalledOnce();
  });

  it("renders placeholder and back art immediately without image readiness state", () => {
    render(DuelField, {
      board: board("ST-04"),
      cardBackUrl: "/cards/back.webp",
      placeholderUrl: "/cards/placeholder.webp",
    });

    const visible = screen.getByRole("article", {
      name: /The Legendary Fisherman in Your Main Monster 1/,
    });
    const hidden = screen.getByRole("article", {
      name: /Hidden card in Your Main Monster 3/,
    });
    expect(within(visible).getByRole("img").getAttribute("src")).toBe(
      "/cards/placeholder.webp",
    );
    expect(hidden.querySelector("img")?.getAttribute("src")).toBe(
      "/cards/back.webp",
    );
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });

  it("renders the field action bar inside the field and never a selection dock", () => {
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    renderInteractive(value);

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelector('[data-cy="field-action-bar"]')).not.toBeNull();
    expect(field.querySelector(".selection-dock")).toBeNull();
  });

  it("flags the field so it reserves a gutter while the action bar renders", () => {
    const value = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    renderInteractive(value);

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.getAttribute("data-field-action-bar")).toBe("true");
    expect(field.style.getPropertyValue("--field-action-bar-height")).toMatch(
      /^\d+px$/,
    );
  });

  it("reserves no gutter when a card action spec renders no action bar", () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    const harness = renderInteractive(value);

    expect(harness.spec.kind).toBe("cardAction");
    expect(harness.spec.globalChoices.size).toBe(0);
    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelector('[data-cy="field-action-bar"]')).toBeNull();
    expect(field.hasAttribute("data-field-action-bar")).toBe(false);
    expect(field.style.getPropertyValue("--field-action-bar-height")).toBe("");
  });

  it("hides the endPhase choice from the action bar", () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate", { action: "activate" }),
      promptChoice("battle", "Enter Battle Phase", { action: "battlePhase" }),
      promptChoice("end", "End turn", { action: "endPhase" }),
    ]);
    renderInteractive(value);

    const field = screen.getByRole("region", { name: "Duel field" });
    const barChoices = field.querySelectorAll(
      '[data-cy^="field-action-bar-choice-"]',
    );
    expect(barChoices).toHaveLength(1);
    expect(barChoices[0]?.getAttribute("data-cy")).toBe(
      "field-action-bar-choice-battle",
    );
  });

  it("mounts the corner End turn button inside the field", () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate", { action: "activate" }),
    ]);
    renderInteractive(value);

    expect(
      document.querySelector(
        '[data-cy="duel-field"] [data-cy="field-end-turn-button"]',
      ),
    ).not.toBeNull();
  });

  it("leases mounted visible art only and releases it on unmount", () => {
    const release = vi.fn();
    const lease = vi.fn<(code: number) => { url: string; release: () => void }>(
      () => ({ url: "blob:mounted-card", release }),
    );
    const rendered = render(DuelField, {
      board: board("ST-04"),
      imageLibrary: { lease },
      cardBackUrl: "/cards/back.webp",
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(lease).toHaveBeenCalledTimes(2);
    expect(lease).toHaveBeenCalledWith(97590747);
    expect(lease.mock.calls.every(([code]) => code > 0)).toBe(true);
    expect(
      screen
        .getByRole("img", { name: /The Legendary Fisherman/ })
        .getAttribute("src"),
    ).toBe("blob:mounted-card");
    rendered.unmount();
    expect(release).toHaveBeenCalledTimes(2);
  });

  it("drag halos every candidate zone and nothing else", async () => {
    const harness = renderDraggableHand();

    const target = await startHandDrag();

    expect(
      target.closest(".duel-field-card")?.getAttribute("data-dragging"),
    ).toBe("true");
    expect(candidateZoneIds()).toEqual([
      "p0:mainMonster:0",
      "p0:mainMonster:1",
      "p0:mainMonster:2",
      "p0:mainMonster:3",
      "p0:mainMonster:4",
    ]);
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(harness.onplacementintent).not.toHaveBeenCalled();
  });

  it("omits an occupied zone from the halo", async () => {
    renderDraggableHand({ occupiedZoneId: "p0:mainMonster:2" });

    await startHandDrag();

    expect(candidateZoneIds()).not.toContain("p0:mainMonster:2");
    expect(candidateZoneIds()).toHaveLength(4);
  });

  it("does not drag a card that is not in the hand", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("summon", "Summon monster", { action: "summon" }),
    ]);
    renderInteractive(value);
    const target = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });

    await fireEvent.pointerDown(target, { clientX: 10, clientY: 10 });
    await fireEvent.pointerMove(target, { clientX: 30, clientY: 30 });

    expect(candidateZoneIds()).toEqual([]);
    expect(
      target.closest(".duel-field-card")?.getAttribute("data-dragging"),
    ).toBeNull();
  });

  it("drops on a candidate zone with one intent and one dispatch", async () => {
    const harness = renderDraggableHand();
    await startHandDrag();

    await dropAt(harness, zoneElement("p0:mainMonster:3"));

    expect(harness.onplacementintent.mock.calls).toEqual([
      ["p0:mainMonster:3"],
    ]);
    expect(harness.dispatch).toHaveBeenCalledTimes(1);
    expect(harness.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "chooseChoice",
      choiceId: "summon",
    });
    expect(candidateZoneIds()).toEqual([]);
  });

  it("resolves a hit on the zone's own label to the enclosing zone", async () => {
    const harness = renderDraggableHand();
    await startHandDrag();
    const label = zoneElement("p0:mainMonster:1").querySelector(
      '[data-cy="zone-control-label-p0:mainMonster:1"]',
    );
    if (label === null) throw new Error("Missing zone label");

    await dropAt(harness, label);

    expect(harness.onplacementintent.mock.calls).toEqual([
      ["p0:mainMonster:1"],
    ]);
    expect(harness.dispatch).toHaveBeenCalledTimes(1);
  });

  it("never mistakes an action chip that outranks the zones for a drop target", async () => {
    const harness = renderDraggableHand();
    await startHandDrag();
    // Chips sit above the zones in z-order and stay visible while their card
    // is pinned, so a hit test can land on one mid-drag. A chip belongs to no
    // zone, so the gesture must fall through as a miss rather than guess.
    const chip = document.querySelector('[data-cy^="card-action-chip-"]');
    if (chip === null) throw new Error("Missing action chip");
    expect(chip.closest("[data-zone-id]")).toBeNull();

    await dropAt(harness, chip);

    expect(harness.onplacementintent).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(candidateZoneIds()).toEqual([]);
  });

  it("cancels a drop outside any zone", async () => {
    const harness = renderDraggableHand();
    await startHandDrag();

    await dropAt(harness, null);

    expect(harness.onplacementintent).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(candidateZoneIds()).toEqual([]);
  });

  it("cancels a drop on a zone that is not a candidate", async () => {
    const harness = renderDraggableHand({ occupiedZoneId: "p0:mainMonster:2" });
    await startHandDrag();

    await dropAt(harness, zoneElement("p0:mainMonster:2"));

    expect(harness.onplacementintent).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();

    await startHandDrag();
    await dropAt(harness, zoneElement("p0:field"));

    expect(harness.onplacementintent).not.toHaveBeenCalled();
    expect(harness.dispatch).not.toHaveBeenCalled();
  });

  it("cancels a drag whose pointer was taken away", async () => {
    const harness = renderDraggableHand();
    const target = await startHandDrag();
    expect(candidateZoneIds()).toHaveLength(5);

    await fireEvent.pointerCancel(target);

    expect(candidateZoneIds()).toEqual([]);
    expect(harness.dispatch).not.toHaveBeenCalled();
    expect(
      target.closest(".duel-field-card")?.getAttribute("data-dragging"),
    ).toBeNull();
  });

  it("hover reports a visible card", async () => {
    const harness = renderDraggableHand();
    const card = harness.board.cards.find(({ id }) => id === HAND_CARD_ID);
    if (card === undefined) throw new Error("Missing hand fixture card");

    await fireEvent.pointerEnter(handCardArticle());

    expect(harness.onpreview).toHaveBeenCalledTimes(1);
    expect(harness.onpreview).toHaveBeenCalledWith(card);
  });

  it("press reports a visible card", async () => {
    const harness = renderDraggableHand();

    await fireEvent.pointerDown(handDragTarget(), { clientX: 10, clientY: 10 });

    expect(harness.onpreview).toHaveBeenCalledTimes(1);
    expect(harness.onpreview.mock.calls[0]?.[0]).toMatchObject({
      id: HAND_CARD_ID,
    });
    // The same `pointerdown` still opens the drag gesture: previewing must not
    // consume the event or disturb the 8px click-suppression origin.
    await fireEvent.pointerMove(handDragTarget(), { clientX: 30, clientY: 30 });
    expect(candidateZoneIds()).toHaveLength(5);
  });

  it("focus reports a visible card", async () => {
    const harness = renderDraggableHand();

    await fireEvent.focusIn(handDragTarget());

    expect(harness.onpreview).toHaveBeenCalledTimes(1);
    expect(harness.onpreview.mock.calls[0]?.[0]).toMatchObject({
      id: HAND_CARD_ID,
    });
  });

  it("hovering a face-down field card previews the hidden card", async () => {
    const harness = renderDraggableHand();
    const hidden = screen.getAllByRole("article", {
      name: "Hidden opponent hand card",
    })[0];
    if (hidden === undefined) throw new Error("Missing hidden opponent card");

    await fireEvent.pointerEnter(hidden);

    expect(harness.onpreview).toHaveBeenCalledTimes(1);
    const previewed = harness.onpreview.mock.calls[0]?.[0];
    expect(previewed).toMatchObject({
      id: hidden.getAttribute("data-card-id"),
    });
    expect(previewed?.code).toBeUndefined();
  });

  it("hovering a stack previews it", async () => {
    const value = DUEL_FIELD_PUBLIC_STATES["ST-01"];
    const onstackpreview = vi.fn();
    render(DuelField, { board: value.board, onstackpreview });

    const stack = document.querySelector<HTMLElement>(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    if (stack === null) throw new Error("Missing graveyard stack");
    await fireEvent.pointerEnter(stack);

    expect(onstackpreview).toHaveBeenCalledTimes(1);
    expect(onstackpreview.mock.calls[0]?.[0]).toMatchObject({
      id: "p0:graveyard",
    });
  });

  it("hidden cards report the hidden preview too", async () => {
    const harness = renderDraggableHand();
    const hidden = screen.getAllByRole("article", {
      name: "Hidden opponent hand card",
    })[0];
    if (hidden === undefined) throw new Error("Missing hidden opponent card");

    await fireEvent.pointerEnter(hidden);
    await fireEvent.focusIn(hidden);

    expect(harness.onpreview).toHaveBeenCalledTimes(2);
    for (const call of harness.onpreview.mock.calls) {
      expect(call[0]).toMatchObject({
        id: hidden.getAttribute("data-card-id"),
      });
      expect(call[0]?.code).toBeUndefined();
    }
  });

  it("pointer leave keeps the panel", async () => {
    const harness = renderDraggableHand();
    const article = handCardArticle();
    await fireEvent.pointerEnter(article);

    await fireEvent.pointerLeave(article);
    await fireEvent.pointerOut(article);

    // There is no clear path at all: leaving fires nothing, and every call the
    // field ever makes carries a card, never a null that would blank the panel.
    expect(harness.onpreview).toHaveBeenCalledTimes(1);
    expect(
      harness.onpreview.mock.calls.every(([value]) => value !== null),
    ).toBe(true);
  });

  it("duel field no longer renders life pills", () => {
    const value = DUEL_FIELD_PUBLIC_STATES["ST-01"];
    render(DuelField, { board: value.board });
    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelector('[data-cy="life-pill-p0"]')).toBeNull();
    expect(field.querySelector('[data-cy="life-pill-p1"]')).toBeNull();
  });

  it("actionable stack renders the halo", () => {
    const value = fieldPrompt("chain", [
      mountedChoice("graveyard-activate", "Activate", {
        card: {
          instanceId: cardInstanceId("prompt-graveyard-activate"),
          controller: 0,
          location: "graveyard",
          sequence: 0,
          position: "faceUpAttack",
        },
      } as Partial<PromptChoice>),
      promptChoice("pass-choice", "Pass", { action: "pass" }),
    ]);
    const spec = activeSpec(value);
    const session = createInteractionSession(spec);
    render(DuelField, {
      board: board("ST-05"),
      prompt: value,
      spec,
      session,
      pending: false,
    });

    const stack = document.querySelector(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    expect(stack).not.toBeNull();
    expect(stack?.classList.contains("is-actionable")).toBe(true);
    expect(stack?.getAttribute("data-actionable")).toBe("true");
  });

  it("stack stays non-interactive", () => {
    const value = fieldPrompt("chain", [
      mountedChoice("graveyard-activate", "Activate", {
        card: {
          instanceId: cardInstanceId("prompt-graveyard-activate"),
          controller: 0,
          location: "graveyard",
          sequence: 0,
          position: "faceUpAttack",
        },
      } as Partial<PromptChoice>),
      promptChoice("pass-choice", "Pass", { action: "pass" }),
    ]);
    const spec = activeSpec(value);
    const session = createInteractionSession(spec);
    const oninteraction = vi.fn();
    render(DuelField, {
      board: board("ST-05"),
      prompt: value,
      spec,
      session,
      pending: false,
      oninteraction,
    });

    const stack = document.querySelector(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    expect(stack).not.toBeNull();
    expect(stack?.tagName).toBe("DIV");
    expect(stack?.getAttribute("role")).toBe("group");
    expect(stack?.hasAttribute("onclick")).toBe(false);

    (stack as HTMLElement).click();

    expect(oninteraction).not.toHaveBeenCalled();
  });

  it("graveyard shows its last public card", () => {
    const lease = vi.fn((code: number) => ({
      url: `blob:${code}`,
      release: vi.fn(),
    }));
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    render(DuelField, {
      board: stackBoard.value,
      imageLibrary: { lease },
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(
      document
        .querySelector('[data-cy="stack-control-image-p0:graveyard"]')
        ?.getAttribute("src"),
    ).toBe("blob:89631139");
    expect(
      document.querySelector('[data-cy="stack-control-name-p0:graveyard"]')
        ?.textContent,
    ).toBe("GY");
    expect(
      document.querySelector('[data-cy="stack-control-count-p0:graveyard"]')
        ?.textContent,
    ).toBe("4");
  });

  it("banished shows its last public card", () => {
    const lease = vi.fn((code: number) => ({
      url: `blob:${code}`,
      release: vi.fn(),
    }));
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    render(DuelField, {
      board: stackBoard.value,
      imageLibrary: { lease },
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(
      document.querySelector('[data-cy="stack-control-image-p0:banished"]'),
    ).not.toBeNull();
  });

  it("an empty pile shows no art", () => {
    const lease = vi.fn((code: number) => ({
      url: `blob:${code}`,
      release: vi.fn(),
    }));
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    render(DuelField, {
      board: stackBoard.value,
      imageLibrary: { lease },
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(
      document.querySelector('[data-cy="stack-control-art-p1:graveyard"]'),
    ).toBeNull();
  });

  it("the deck never shows art", () => {
    const lease = vi.fn((code: number) => ({
      url: `blob:${code}`,
      release: vi.fn(),
    }));
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    render(DuelField, {
      board: stackBoard.value,
      imageLibrary: { lease },
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(
      document.querySelector('[data-cy="stack-control-art-p0:deck"]'),
    ).toBeNull();
  });

  it("the lease is released on destroy", () => {
    const release = vi.fn();
    const lease = vi.fn((code: number) => ({
      url: `blob:${code}`,
      release,
    }));
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    const rendered = render(DuelField, {
      board: stackBoard.value,
      imageLibrary: { lease },
      placeholderUrl: "/cards/placeholder.webp",
    });

    expect(
      document.querySelector('[data-cy="stack-control-art-p0:graveyard"]'),
    ).not.toBeNull();
    rendered.unmount();

    expect(release).toHaveBeenCalledTimes(2);
  });

  it("clicking a pile opens its list", async () => {
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    const zoneLists = zoneListsForBoard(
      stackBoard.value,
      STACK_ART_STATE,
      BOARD_CARD_TEXTS,
    );
    render(DuelField, { board: stackBoard.value, zoneLists });

    expect(document.querySelector('[data-cy="zone-list-dialog"]')).toBeNull();
    const stack = document.querySelector<HTMLElement>(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    if (stack === null) throw new Error("Missing graveyard stack");
    await fireEvent.click(stack);

    expect(
      document.querySelector('[data-cy="zone-list-dialog"]'),
    ).not.toBeNull();
  });

  it("clicking the same pile closes it", async () => {
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    const zoneLists = zoneListsForBoard(
      stackBoard.value,
      STACK_ART_STATE,
      BOARD_CARD_TEXTS,
    );
    render(DuelField, { board: stackBoard.value, zoneLists });
    const stack = document.querySelector<HTMLElement>(
      '[data-cy="field-stack-p0:graveyard"]',
    );
    if (stack === null) throw new Error("Missing graveyard stack");
    await fireEvent.click(stack);
    await fireEvent.click(stack);

    expect(document.querySelector('[data-cy="zone-list-dialog"]')).toBeNull();
  });

  it("an empty pile is not clickable", () => {
    const stackBoard = mapSnapshotToBoard(STACK_ART_STATE, BOARD_CARD_TEXTS);
    if (!stackBoard.ok) throw new Error("Fixture mapping failed");
    render(DuelField, { board: stackBoard.value });

    const stack = document.querySelector('[data-cy="field-stack-p1:banished"]');
    expect(stack?.tagName).toBe("DIV");
  });

  it("a new prompt closes an open list", async () => {
    const valueBoard = board("ST-05");
    const firstPrompt = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    const firstSpec = activeSpec(firstPrompt);
    const zoneLists = zoneListsForBoard(
      valueBoard,
      BOARD_VIEW_MODEL_FIXTURES["ST-05"],
      BOARD_CARD_TEXTS,
    );
    const rendered = render(DuelField, {
      board: valueBoard,
      prompt: firstPrompt,
      spec: firstSpec,
      session: createInteractionSession(firstSpec),
      pending: false,
      zoneLists,
    });
    const stack = document.querySelector<HTMLElement>(
      '[data-cy="field-stack-p0:deck"]',
    );
    if (stack === null) throw new Error("Missing deck stack");
    await fireEvent.click(stack);

    expect(
      document.querySelector('[data-cy="zone-list-dialog"]'),
    ).not.toBeNull();

    const nextPrompt = fieldPrompt("selectCard", [
      mountedChoice("select", "Select monster"),
    ]);
    const nextSpec = activeSpec(nextPrompt);
    await rendered.rerender({
      board: valueBoard,
      prompt: nextPrompt,
      spec: nextSpec,
      session: createInteractionSession(nextSpec),
      pending: false,
      zoneLists,
    });

    expect(document.querySelector('[data-cy="zone-list-dialog"]')).toBeNull();
  });
});

describe("FieldBoard", () => {
  /* Svelte writes `null` into a `bind:this` ref as the element unmounts, and
     the queued focus move resumes after that write. The rejection would be
     unhandled — `focusActiveTarget` is `void`-called — so the only observable
     is the process-level report. */
  it("survives unmounting while a queued focus move is in flight", async () => {
    const rejections: unknown[] = [];
    const record = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", record);
    try {
      const rendered = render(FieldBoard, {
        board: board("ST-05"),
        imageUrls: new Map<number, string>(),
        cardBackUrl: "card-back.png",
        placeholderUrl: "placeholder.png",
      });
      const zone = document.querySelector<HTMLElement>("[data-field-target]");
      expect(zone).not.toBeNull();

      /* Deliberately not awaited: the focus move must still be suspended on
         `tick()` when the component goes away. */
      void fireEvent.keyDown(zone as HTMLElement, { key: "ArrowRight" });
      rendered.unmount();
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      process.off("unhandledRejection", record);
    }

    expect(
      rejections.map((reason) =>
        reason instanceof Error ? reason.message : String(reason),
      ),
    ).toEqual([]);
  });
});

const HAND_CARD_ID = "st01-own-hand";

function handChoice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return promptChoice(id, label, {
    card: {
      instanceId: cardInstanceId(HAND_CARD_ID),
      controller: 0,
      location: "hand",
      sequence: 0,
    },
    ...overrides,
  } as Partial<PromptChoice>);
}

/** ST-01 gives player 0 one visible hand card and an otherwise empty field. */
function renderDraggableHand(
  options: { readonly occupiedZoneId?: string } = {},
) {
  const base = board("ST-01");
  const occupant = base.cards[0];
  if (occupant === undefined) throw new Error("Missing hand fixture card");
  const valueBoard =
    options.occupiedZoneId === undefined
      ? base
      : {
          ...base,
          cards: [
            ...base.cards,
            {
              ...occupant,
              id: "drag-occupant",
              targetId: "card:drag-occupant" as const,
              zoneId: options.occupiedZoneId as typeof occupant.zoneId,
            },
          ],
        };
  const value = fieldPrompt("idleCommand", [
    handChoice("summon", "Summon The Legendary Fisherman", {
      action: "summon",
    }),
    handChoice("setmonster", "Set The Legendary Fisherman", {
      action: "setMonster",
    }),
  ]);
  const spec = mapPromptToInteractionSpec(
    value,
    BOARD_VIEW_MODEL_FIXTURES["ST-01"],
    valueBoard,
    CONTEXT,
  );
  if (spec.kind === "inactive") throw new Error("Expected active field spec");
  const dispatch = vi.fn();
  const onplacementintent = vi.fn();
  const onpreview = vi.fn();
  let hit: Element | null = null;
  const rendered = render(DuelField, {
    board: valueBoard,
    prompt: value,
    spec,
    session: createInteractionSession(spec),
    pending: false,
    oninteraction: dispatch,
    onplacementintent,
    onpreview,
    hitTest: () => hit,
  });
  return {
    rendered,
    board: valueBoard,
    dispatch,
    onplacementintent,
    onpreview,
    setHit: (element: Element | null) => {
      hit = element;
    },
  };
}

function handCardArticle(): HTMLElement {
  const article = document.querySelector<HTMLElement>(
    `[data-cy="field-card-${HAND_CARD_ID}"]`,
  );
  if (article === null) throw new Error("Missing hand card article");
  return article;
}

function handDragTarget(): HTMLElement {
  const target = document.querySelector<HTMLElement>(
    `[data-cy="field-card-target-${HAND_CARD_ID}"]`,
  );
  if (target === null) throw new Error("Missing hand card drag target");
  return target;
}

/** 20px past the origin clears `CardControl`'s 8px click-suppression gate. */
async function startHandDrag(): Promise<HTMLElement> {
  const target = handDragTarget();
  await fireEvent.pointerDown(target, { clientX: 10, clientY: 10 });
  await fireEvent.pointerMove(target, { clientX: 30, clientY: 30 });
  return target;
}

async function dropAt(
  harness: ReturnType<typeof renderDraggableHand>,
  element: Element | null,
): Promise<void> {
  harness.setHit(element);
  await fireEvent.pointerUp(handDragTarget(), { clientX: 30, clientY: 30 });
}

function zoneElement(zoneId: string): HTMLElement {
  const zone = document.querySelector<HTMLElement>(
    `[data-zone-id="${zoneId}"]`,
  );
  if (zone === null) throw new Error(`Missing zone ${zoneId}`);
  return zone;
}

function candidateZoneIds(): readonly string[] {
  return [...document.querySelectorAll('[data-drop-candidate="true"]')].map(
    (zone) => zone.getAttribute("data-zone-id") ?? "",
  );
}
