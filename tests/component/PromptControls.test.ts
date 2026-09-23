// @vitest-environment jsdom

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cardCode,
  cardInstanceId,
  choiceId,
  promptId,
  type ChoiceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type {
  PlayerPrompt,
  PromptChoice,
  PromptKind,
} from "../../src/battle/duel/contracts/player-prompt.ts";
import PromptControls from "../../src/battle/app/prompts/PromptControls.svelte";
import { parseDuelWorkerEvent } from "../../src/battle/duel/contracts/duel-worker-event.ts";

afterEach(() => cleanup());

function choice(
  id: string,
  label: string,
  overrides: Partial<PromptChoice> = {},
): PromptChoice {
  return {
    id: choiceId(id),
    label,
    action: "select",
    ...overrides,
  };
}

function prompt(
  kind: PromptKind,
  overrides: Partial<PlayerPrompt> = {},
): PlayerPrompt {
  return {
    id: promptId(`${kind}-component-prompt`),
    kind,
    player: 0,
    title: `Test ${kind}`,
    choices: [choice("first", "First"), choice("second", "Second")],
    minimum: 1,
    maximum: 1,
    cancelable: false,
    ordered: false,
    ...overrides,
  };
}

function announcement(count: number): PlayerPrompt {
  return prompt("announceCard", {
    choices: Array.from({ length: count }, (_, index) =>
      choice(`card-${index}`, `Card ${index}`, { value: 10_000_000 + index }),
    ),
  });
}

function pageButton(name: string): HTMLButtonElement {
  return within(
    screen.getByRole("navigation", { name: "Card announcement pages" }),
  ).getByRole("button", { name }) as HTMLButtonElement;
}

function button(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("PromptControls", () => {
  it.each(["selectCard", "sortCard"] as const)(
    "keeps %s descendant selectors unique by choice identity",
    async (kind) => {
      const { container } = render(PromptControls, {
        prompt: prompt(kind, {
          minimum: 2,
          maximum: 2,
          ordered: kind === "sortCard",
          choices: ["one", "two"].map((id, sequence) =>
            choice(id, sequence === 0 ? "One" : "Two", {
              card: {
                instanceId: cardInstanceId(id),
                controller: 0,
                location: "monster",
                sequence,
                contribution: 1,
              },
            }),
          ),
        }),
        onsubmit: vi.fn(),
      });
      const selectors = () =>
        [...container.querySelectorAll("[data-cy]")].map((node) =>
          node.getAttribute("data-cy"),
        );
      const initial = selectors();
      expect(new Set(initial).size).toBe(initial.length);
      if (kind === "sortCard") {
        await userEvent.setup().click(button("Move One down"));
        expect(
          container.querySelector(
            '[data-cy="prompt-controls-order-choice-index-one"]',
          )?.textContent,
        ).toBe("2.");
        expect(selectors().sort()).toEqual(initial.sort());
      } else {
        expect(initial).toContain("prompt-controls-multiple-choice-text-one");
        expect(initial).toContain(
          "prompt-controls-multiple-choice-contribution-one",
        );
      }
    },
  );
  it("keeps announcements at the 256-choice threshold unpaged", () => {
    const { container } = render(PromptControls, {
      prompt: announcement(256),
      onsubmit: vi.fn(),
    });
    expect(
      container.querySelectorAll(
        '[data-cy="prompt-controls-single-grid"] button',
      ),
    ).toHaveLength(256);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it.each([257, 50_000])(
    "pages %i announcement candidates without dropping the final choice",
    async (count) => {
      const event = parseDuelWorkerEvent({
        type: "prompt",
        prompt: announcement(count),
      });
      if (event.type !== "prompt") throw new Error("Expected prompt event");
      const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
      const { container } = render(PromptControls, {
        prompt: event.prompt,
        onsubmit,
      });
      const renderedChoices = () =>
        container.querySelectorAll(
          '[data-cy="prompt-controls-single-grid"] button',
        );
      const user = userEvent.setup();

      expect(renderedChoices()).toHaveLength(256);
      expect(pageButton("Previous page").disabled).toBe(true);
      await user.click(pageButton("Last page"));
      expect(renderedChoices()).toHaveLength(count % 256);
      expect(pageButton("Next page").disabled).toBe(true);
      await user.click(button(`Card ${count - 1}`));
      expect(onsubmit).toHaveBeenCalledExactlyOnceWith([
        choiceId(`card-${count - 1}`),
      ]);
      expect(pageButton("Previous page").disabled).toBe(true);
      expect(pageButton("First page").disabled).toBe(true);
    },
  );

  it("disables announcement paging while pending and resets it for a new prompt", async () => {
    const user = userEvent.setup();
    const rendered = render(PromptControls, {
      prompt: announcement(257),
      disabled: true,
      onsubmit: vi.fn(),
    });
    expect(pageButton("Next page").disabled).toBe(true);
    expect(pageButton("Last page").disabled).toBe(true);
    await rendered.rerender({ disabled: false });
    await user.click(pageButton("Next page"));
    expect(button("Card 256")).toBeTruthy();
    await user.click(pageButton("Previous page"));
    expect(screen.getByText("Card 0", { exact: true })).toBeTruthy();
    await user.click(pageButton("Last page"));
    await user.click(pageButton("First page"));
    expect(screen.getByText("Card 0", { exact: true })).toBeTruthy();
    await user.click(pageButton("Last page"));
    await rendered.rerender({
      prompt: { ...announcement(300), id: promptId("next-announcement") },
    });
    await waitFor(() =>
      expect(screen.getByText("Card 0", { exact: true })).toBeTruthy(),
    );
    expect(pageButton("Previous page").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Card 299" })).toBeNull();
  });

  it("clears a submitted announcement page and its old choice IDs for the next prompt", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    const { container, rerender } = render(PromptControls, {
      prompt: announcement(512),
      onsubmit,
    });
    pageButton("Last page").focus();
    await user.keyboard("{Enter}");
    expect(
      container.querySelectorAll(
        '[data-cy="prompt-controls-single-grid"] button',
      ),
    ).toHaveLength(256);
    await user.click(button("Card 511"));
    expect(onsubmit).toHaveBeenCalledExactlyOnceWith([choiceId("card-511")]);

    const next = announcement(257);
    await rerender({
      prompt: {
        ...next,
        id: promptId("fresh-announcement"),
        choices: next.choices.map((choice) => ({
          ...choice,
          id: choiceId(`fresh-${choice.id}`),
        })),
      },
    });
    await waitFor(() => expect(button("Card 0").disabled).toBe(false));
    expect(pageButton("Previous page").disabled).toBe(true);
    expect(pageButton("Next page").disabled).toBe(false);
    expect(
      container.querySelector('[data-cy="prompt-controls-choice-card-511"]'),
    ).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 2 }),
    );
    expect(onsubmit).toHaveBeenCalledTimes(1);
    await user.click(pageButton("Next page"));
    button("Card 256").focus();
    await user.keyboard("{Enter}");
    expect(onsubmit).toHaveBeenLastCalledWith([choiceId("fresh-card-256")]);
    expect(onsubmit).toHaveBeenCalledTimes(2);
  });

  it("submits a single keyboard choice once and disables every active control", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("yesNo", {
        choices: [
          choice("yes", "Yes", { action: "yes" }),
          choice("no", "No", { action: "no" }),
        ],
      }),
      onsubmit,
    });

    const yes = button("Yes");
    yes.focus();
    await user.keyboard("{Enter}{Enter}");

    expect(onsubmit).toHaveBeenCalledTimes(1);
    expect(onsubmit).toHaveBeenCalledWith([choiceId("yes")]);
    expect(yes.disabled).toBe(true);
    expect(button("No").disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Response sent");
  });

  it("accepts field-selection intent through the Svelte control layer", async () => {
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => boolean>(
      () => true,
    );
    const value = prompt("selectCard", {
      choices: [
        choice("card", "Select card", {
          card: {
            instanceId: cardInstanceId("field-card"),
            code: cardCode(97590747),
            controller: 0,
            location: "monster",
            sequence: 0,
            position: "faceUpAttack",
          },
        }),
      ],
    });
    const rendered = render(PromptControls, {
      prompt: value,
      disabled: false,
      onsubmit,
      choiceIntent: null,
    });

    await rendered.rerender({
      choiceIntent: { id: choiceId("card"), nonce: 1 },
    });
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    await waitFor(() => expect(checkbox.checked).toBe(true));
    await userEvent.setup().click(button("Confirm selection"));
    expect(onsubmit).toHaveBeenCalledWith(["card"]);
  });

  it("keeps legal input enabled for a card choice", async () => {
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => boolean>(
      () => true,
    );
    const value = prompt("selectCard", {
      choices: [
        choice("card", "Select card", {
          card: {
            instanceId: cardInstanceId("slow-image-card"),
            code: cardCode(97590747),
            controller: 0,
            location: "monster",
            sequence: 0,
            position: "faceUpAttack",
          },
        }),
      ],
    });
    render(PromptControls, {
      prompt: value,
      disabled: false,
      onsubmit,
    });

    expect(screen.getByRole("checkbox")).not.toHaveProperty("disabled", true);
    await userEvent.setup().click(screen.getByRole("checkbox"));
    await userEvent.setup().click(button("Confirm selection"));
    expect(onsubmit).toHaveBeenCalledOnce();
  });

  it("re-enables the same prompt after a recoverable response rejection", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => boolean>(
      () => true,
    );
    const value = prompt("yesNo", {
      choices: [
        choice("yes", "Yes", { action: "yes" }),
        choice("no", "No", { action: "no" }),
      ],
    });
    const rendered = render(PromptControls, {
      prompt: value,
      disabled: false,
      onsubmit,
    });

    await user.click(button("Yes"));
    expect(button("No").disabled).toBe(true);
    await rendered.rerender({ disabled: true });
    await rendered.rerender({ disabled: false });
    await waitFor(() => expect(button("No").disabled).toBe(false));
    await user.click(button("No"));
    expect(onsubmit).toHaveBeenCalledTimes(2);
  });

  it("enforces multi-card bounds and supports explicit cancellation", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("selectCard", {
        choices: [
          choice("one", "Card one"),
          choice("two", "Card two"),
          choice("three", "Card three"),
        ],
        minimum: 2,
        maximum: 3,
        cancelable: true,
      }),
      onsubmit,
    });

    const confirm = button("Confirm selection");
    expect(confirm.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Card one" }));
    expect(confirm.disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Card two" }));
    expect(confirm.disabled).toBe(false);
    await user.click(confirm);
    expect(onsubmit).toHaveBeenCalledWith([choiceId("one"), choiceId("two")]);
  });

  it("shows exact-sum and mandatory constraints and permits an alternative contribution", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("selectSum", {
        choices: [
          choice("sum-card", "Sum card", {
            card: {
              instanceId: cardInstanceId("sum-card-instance"),
              code: cardCode(97590747),
              name: "La Jinn",
              description: "A mystical genie.",
              controller: 0,
              location: "hand",
              sequence: 0,
              contribution: 2,
              alternativeContribution: 3,
            },
          }),
        ],
        minimum: 1,
        maximum: 1,
        requiredTotal: 4,
        sumMode: "exact",
        mandatoryContributions: [{ contribution: 1 }],
      }),
      onsubmit,
    });

    expect(screen.getByText(/total exactly 4/i)).toBeTruthy();
    expect(screen.getByText(/Mandatory contributions: 1/i)).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /Sum card/i }));
    expect(button("Confirm selection").disabled).toBe(false);
    await user.click(button("Confirm selection"));
    expect(onsubmit).toHaveBeenCalledWith([choiceId("sum-card")]);
  });

  it("renders iterative select/unselect state without auto-answering", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("selectUnselectCard", {
        choices: [
          choice("toggle", "La Jinn", {
            selected: true,
            card: {
              instanceId: cardInstanceId("toggle-card"),
              controller: 0,
              location: "monster",
              sequence: 0,
            },
          }),
          choice("finish", "Finish", { action: "finish" }),
        ],
      }),
      onsubmit,
    });

    expect(onsubmit).not.toHaveBeenCalled();
    expect(button(/La Jinn/).getAttribute("aria-pressed")).toBe("true");
    await user.click(button("Finish"));
    expect(onsubmit).toHaveBeenCalledWith([choiceId("finish")]);
  });

  it("allows keyboard-accessible reordering and submits every item exactly once", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("sortCard", {
        choices: [choice("one", "One"), choice("two", "Two")],
        minimum: 2,
        maximum: 2,
        ordered: true,
        cancelable: true,
      }),
      onsubmit,
    });

    const moveDown = button("Move One down");
    moveDown.focus();
    await user.keyboard("{Enter}");
    await user.click(button("Confirm order"));
    expect(onsubmit).toHaveBeenCalledWith([choiceId("two"), choiceId("one")]);
  });

  it("bounds counter allocation by each explicit capacity", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    render(PromptControls, {
      prompt: prompt("selectCounter", {
        choices: [
          choice("one", "First card", { allocationMaximum: 2 }),
          choice("two", "Second card", { allocationMaximum: 1 }),
        ],
        minimum: 3,
        maximum: 3,
      }),
      onsubmit,
    });

    await user.click(button("Add one counter to First card"));
    await user.click(button("Add one counter to First card"));
    expect(button("Add one counter to First card").disabled).toBe(true);
    await user.click(button("Add one counter to Second card"));
    expect(button("Confirm allocation").disabled).toBe(false);
    await user.click(button("Confirm allocation"));
    expect(onsubmit).toHaveBeenCalledWith([
      choiceId("one"),
      choiceId("one"),
      choiceId("two"),
    ]);
  });

  it("renders choice buttons for an effectYesNo prompt with contextCard", () => {
    render(PromptControls, {
      prompt: prompt("effectYesNo", {
        contextCard: {
          instanceId: cardInstanceId("effect-card"),
          code: cardCode(97590747),
          name: "La Jinn",
          description: "A mystical genie with great power.",
          controller: 0,
          location: "monster",
          sequence: 0,
        },
        choices: [
          choice("yes", "Yes", { action: "yes" }),
          choice("no", "No", { action: "no" }),
        ],
      }),
      onsubmit: vi.fn(),
    });

    expect(button("Yes")).toBeTruthy();
    expect(button("No")).toBeTruthy();
    expect(screen.queryByText(/Inspect/)).toBeNull();
  });

  it("renders no inspect expander for any prompt surface", () => {
    const card = {
      instanceId: cardInstanceId("inspect-test-card"),
      code: cardCode(97590747),
      name: "La Jinn",
      description: "A mystical genie.",
      controller: 0 as const,
      location: "monster" as const,
      sequence: 0,
    };
    render(PromptControls, {
      prompt: prompt("effectYesNo", {
        contextCard: card,
        choices: [
          choice("yes", "Yes", { action: "yes", card }),
          choice("no", "No", { action: "no" }),
        ],
      }),
      onsubmit: vi.fn(),
    });

    expect(screen.queryByText(/Inspect/)).toBeNull();
    expect(document.querySelector("details.card-detail")).toBeNull();
  });

  it("restores focus to the heading when a new prompt replaces the old one", async () => {
    const onsubmit = vi.fn<(choiceIds: readonly ChoiceId[]) => void>();
    const rendered = render(PromptControls, {
      prompt: prompt("option", { title: "First prompt" }),
      onsubmit,
    });
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("First prompt"),
    );

    await rendered.rerender({
      prompt: prompt("announceNumber", {
        id: promptId("replacement-prompt"),
        title: "Replacement prompt",
      }),
    });
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain(
        "Replacement prompt",
      ),
    );
  });
});
