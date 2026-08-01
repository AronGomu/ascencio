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
  mapPromptToInteractionSpec,
  type ActiveInteractionSpec,
} from "../../src/app/prompts/interaction-spec.ts";
import {
  BOARD_CARD_TEXTS,
  BOARD_VIEW_MODEL_FIXTURES,
} from "../fixtures/board-view-model.ts";

afterEach(() => cleanup());

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
  it("renders one named semantic board with 34 stable physical zones and two shared EMZs", () => {
    const value = board("ST-01");
    render(DuelField, { board: value });

    const field = screen.getByRole("region", { name: "Duel field" });
    expect(field.querySelector("canvas")).toBeNull();
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
    expect(within(field).queryAllByRole("button")).toHaveLength(0);
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
});
