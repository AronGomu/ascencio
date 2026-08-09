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
    // The always-mounted, disabled End turn corner button is the sole
    // exception: it has no active prompt/spec to drive it here.
    const buttons = within(field).queryAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.getAttribute("data-cy")).toBe("field-end-turn-button");
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

    expect(
      screen.getByRole("group", { name: "Your Deck, 35 cards" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", {
        name: "Your GY, 1 card, top card Blue-Eyes White Dragon",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Opponent Deck, 31 cards" }),
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

  it("focuses a command menu then returns focus on Escape", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    card.focus();
    await user.keyboard("{Enter}");
    const firstAction = screen.getByRole("menuitem", {
      name: "Activate effect",
    });
    await waitFor(() => expect(document.activeElement).toBe(firstAction));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(card);
  });

  it("returns field focus before a command menu action removes its focused node", async () => {
    const user = userEvent.setup();
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    const harness = renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });
    card.focus();
    await user.keyboard("{Enter}");
    const action = screen.getByRole("menuitem", { name: "Activate effect" });
    await waitFor(() => expect(document.activeElement).toBe(action));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(card);
    expect(harness.commands).toEqual([["activate"]]);
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

  it("opens command menus on click, never pointerdown, and cancels moved pointers", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate effect", { action: "activate" }),
    ]);
    renderInteractive(value);
    const card = screen.getByRole("button", {
      name: /Open actions for The Legendary Fisherman/,
    });

    await fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    expect(screen.queryByRole("menu", { name: /actions/i })).toBeNull();
    await fireEvent.pointerMove(card, { clientX: 40, clientY: 40 });
    await fireEvent.pointerUp(card, { clientX: 40, clientY: 40 });
    await fireEvent.click(card);
    expect(screen.queryByRole("menu", { name: /actions/i })).toBeNull();

    await fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
    await fireEvent.pointerUp(card, { clientX: 10, clientY: 10 });
    await fireEvent.click(card);
    const menu = screen.getByRole("menu", {
      name: /The Legendary Fisherman.* actions/,
    });
    expect(
      within(menu).getByRole("menuitem", { name: "Activate effect" }),
    ).toBeTruthy();
    expect(
      within(menu).getByRole("menuitem", { name: /Inspect/ }),
    ).toBeTruthy();
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
      [
        "selectPlace",
        promptChoice("place", "Your Main Monster 1", {
          place: { player: 0, location: "monster", sequence: 0 },
        }),
        {},
      ],
      [
        "selectDisabledField",
        promptChoice("disabled", "Your Main Monster 1", {
          place: { player: 0, location: "monster", sequence: 0 },
        }),
        {},
      ],
    ] as const) {
      cleanup();
      const value = fieldPrompt(kind, [choice], overrides);
      const harness = renderInteractive(value);
      const target =
        kind === "selectPlace" || kind === "selectDisabledField"
          ? screen.getByRole("button", { name: /Select Your Main Monster 1/ })
          : screen.getByRole("button", {
              name: /Select The Legendary Fisherman/,
            });
      await user.click(target);
      expect(harness.commands).toEqual([]);
      expect(
        (screen.getByRole("button", { name: /Confirm/ }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      if (kind !== "selectPlace" && kind !== "selectDisabledField")
        expect(
          screen.getByRole("button", {
            name: /Inspect The Legendary Fisherman/,
          }),
        ).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /Confirm/ }));
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
      await user.click(screen.getByRole("menuitem", { name: label }));
      expect(harness.commands).toEqual([[choiceId(label.toLowerCase())]]);
    }
  });

  it("updates anchored menu geometry on resize and scroll", async () => {
    const value = fieldPrompt("idleCommand", [
      mountedChoice("activate", "Activate", { action: "activate" }),
    ]);
    renderInteractive(value);
    const card = screen.getByRole("button", { name: /Open actions/ });
    const rect = vi.spyOn(card, "getBoundingClientRect");
    rect.mockReturnValue({
      x: 20,
      y: 30,
      left: 20,
      top: 30,
      right: 70,
      bottom: 100,
      width: 50,
      height: 70,
      toJSON: () => ({}),
    });
    await userEvent.setup().click(card);
    const menu = screen.getByRole("menu", { name: /actions/i });
    expect(menu.getAttribute("style")).toContain("100px");
    rect.mockReturnValue({
      x: 80,
      y: 90,
      left: 80,
      top: 90,
      right: 130,
      bottom: 160,
      width: 50,
      height: 70,
      toJSON: () => ({}),
    });
    window.dispatchEvent(new Event("resize"));
    await waitFor(() => expect(menu.getAttribute("style")).toContain("160px"));
    window.dispatchEvent(new Event("scroll"));
    expect(rect).toHaveBeenCalledTimes(3);
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
      oninspect: vi.fn(),
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
});
