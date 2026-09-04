// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import IllustratedMapScreen from "../../../src/story/screens/IllustratedMapScreen.svelte";
import type { StoryLocationState } from "../../../src/story/model/story-state.ts";

afterEach(() => cleanup());

const states: readonly StoryLocationState[] = [
  { id: "old-arena", access: "available", completed: false },
  { id: "archive", access: "locked", completed: true },
  { id: "hidden-gate", access: "hidden", completed: false },
  { id: "card-shop", access: "available", completed: false },
];

function hotspot(name: RegExp): HTMLButtonElement {
  return within(screen.getByLabelText("Map hotspots")).getByRole("button", {
    name,
  });
}

async function touchTap(target: HTMLElement): Promise<void> {
  await fireEvent.pointerDown(target, { pointerType: "touch" });
  await fireEvent.pointerUp(target, { pointerType: "touch" });
  await fireEvent.click(target);
}

describe("IllustratedMapScreen", () => {
  it("distills the map to one hotspot per visible location", () => {
    const { container } = render(IllustratedMapScreen, {
      locations: states,
    });

    expect(
      screen.getByRole("img", { name: /Illustrated city map/ }),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText("Map hotspots")).getAllByRole("button"),
    ).toHaveLength(3);
    expect(container.querySelector('[data-cy="story-map-sidebar"]')).toBeNull();
    expect(
      container.querySelector('[data-cy="story-map-location-list"]'),
    ).toBeNull();
    expect(container.querySelector('[data-cy="story-map-eyebrow"]')).toBeNull();
    expect(
      container.querySelector('[data-cy="story-map-choice-acknowledgment"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-location-id="hidden-gate"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-cy="story-map-popover-hidden-gate"]'),
    ).toBeNull();
  });

  it("links every popover field to its hotspot and exposes locked/completed state", async () => {
    const { container } = render(IllustratedMapScreen, { locations: states });
    const archive = hotspot(/Archive.*story.*locked.*completed/i);

    await fireEvent.focus(archive);

    const popover = container.querySelector(
      '[data-cy="story-map-popover-archive"]',
    ) as HTMLElement | null;
    expect(popover).not.toBeNull();
    expect(popover!.getAttribute("role")).toBe("tooltip");
    expect(archive.getAttribute("aria-describedby")).toBe(popover!.id);
    expect(
      container.querySelector('[data-cy="story-map-popover-name-archive"]')
        ?.textContent,
    ).toBe("Archive");
    expect(
      container.querySelector('[data-cy="story-map-popover-meta-archive"]')
        ?.textContent,
    ).toBe("story · locked · completed");
    expect(
      container.querySelector('[data-cy="story-map-popover-summary-archive"]')
        ?.textContent,
    ).toBe("Signal records from the first city tournament.");
    expect(
      container.querySelector(
        '[data-cy="story-map-popover-locked-reason-archive"]',
      )?.textContent,
    ).toBe("Locked: Requires decoded arena signal.");
  });

  it("closes only when the current pointer or focus owner leaves", async () => {
    render(IllustratedMapScreen, { locations: states });
    const arena = hotspot(/Old Arena/);

    await fireEvent.pointerEnter(arena, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    await fireEvent.focus(arena);
    await fireEvent.pointerLeave(arena, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    await fireEvent.blur(arena);
    expect(screen.queryByRole("tooltip")).toBeNull();

    await fireEvent.focus(arena);
    await fireEvent.pointerEnter(arena, { pointerType: "mouse" });
    await fireEvent.blur(arena);
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    await fireEvent.pointerLeave(arena, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("clears stale touch ownership after pointer cancellation", async () => {
    render(IllustratedMapScreen, { locations: states });
    const arena = hotspot(/Old Arena/);

    await fireEvent.pointerDown(arena, { pointerType: "touch" });
    arena.focus();
    await fireEvent.focus(arena);
    expect(screen.queryByRole("tooltip")).toBeNull();

    await fireEvent.pointerCancel(arena, { pointerType: "touch" });
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    await fireEvent.pointerLeave(arena, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    await fireEvent.blur(arena);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps tap selection until outside or Escape and activates on the second same tap", async () => {
    const onselect = vi.fn();
    render(IllustratedMapScreen, { locations: states, onselect });
    const arena = hotspot(/Old Arena/);
    const shop = hotspot(/Card Shop/);

    await touchTap(arena);
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    expect(onselect).not.toHaveBeenCalled();

    await touchTap(shop);
    expect(screen.getByRole("tooltip").textContent).toContain("Card Shop");
    expect(onselect).not.toHaveBeenCalled();

    await fireEvent.click(document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();

    await touchTap(arena);
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();

    await touchTap(arena);
    await touchTap(arena);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect).toHaveBeenCalledWith("old-arena");
  });

  it("never activates a locked hotspot under repeated pointer, keyboard, or touch input", async () => {
    const onselect = vi.fn();
    render(IllustratedMapScreen, { locations: states, onselect });
    const archive = hotspot(/Archive/);

    await fireEvent.pointerEnter(archive, { pointerType: "mouse" });
    await fireEvent.click(archive);
    await fireEvent.click(archive);
    archive.focus();
    await userEvent.setup().keyboard("{Enter}{Enter}");
    await touchTap(archive);
    await touchTap(archive);

    expect(onselect).not.toHaveBeenCalled();
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Locked: Requires decoded arena signal.",
    );
    expect(archive.getAttribute("aria-disabled")).toBe("true");
  });

  it("uses focus as keyboard inspection before Enter activation", async () => {
    const onselect = vi.fn();
    render(IllustratedMapScreen, { locations: states, onselect });
    const arena = hotspot(/Old Arena/);

    arena.focus();
    await fireEvent.focus(arena);
    expect(screen.getByRole("tooltip").textContent).toContain("Old Arena");
    expect(onselect).not.toHaveBeenCalled();
    await userEvent.setup().keyboard("{Enter}");
    expect(onselect).toHaveBeenCalledOnce();
    expect(onselect).toHaveBeenCalledWith("old-arena");
  });

  it("keeps completion separate from access and returns by pointer or keyboard", async () => {
    const onreturn = vi.fn();
    const availableCompleted: readonly StoryLocationState[] = [
      { id: "old-arena", access: "available", completed: true },
    ];
    render(IllustratedMapScreen, {
      locations: availableCompleted,
      returnLabel: "Dialog",
      onreturn,
    });
    expect(
      screen.getByRole("button", { name: /available.*completed/i }),
    ).toBeTruthy();
    const button = screen.getByRole("button", { name: "Return to Dialog" });
    expect(button.getAttribute("data-cy")).toBe("story-map-return");
    expect(button.classList.contains("story-danger")).toBe(true);

    const user = userEvent.setup();
    await user.click(button);
    expect(onreturn).toHaveBeenCalledTimes(1);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onreturn).toHaveBeenCalledTimes(3);
  });
});
