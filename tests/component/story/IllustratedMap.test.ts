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
];

describe("IllustratedMapScreen", () => {
  it("renders map/objective/equivalent authored-order hotspot and list surfaces", () => {
    render(IllustratedMapScreen, {
      locations: states,
      objective: "Meet Rin",
      choiceAcknowledgment: "Rin remembers your trust.",
    });
    expect(
      screen.getByRole("img", { name: /Illustrated city map/ }),
    ).toBeTruthy();
    expect(screen.getByText("Meet Rin")).toBeTruthy();
    expect(screen.getByText(/remembers your trust/)).toBeTruthy();
    const hotspots = screen
      .getByLabelText("Map hotspots")
      .querySelectorAll("[data-location-id]");
    const list = screen
      .getByLabelText("Location list")
      .querySelectorAll("[data-location-id]");
    expect(
      [...hotspots].map((node) => node.getAttribute("data-location-id")),
    ).toEqual(["old-arena", "archive"]);
    expect(
      [...list].map((node) => node.getAttribute("data-location-id")),
    ).toEqual(["old-arena", "archive"]);
    expect(screen.queryByText("Hidden Gate")).toBeNull();
  });

  it("synchronizes hotspot/list detail and blocks locked activation with reason", async () => {
    const onselect = vi.fn();
    render(IllustratedMapScreen, { locations: states, onselect });
    const hotspot = within(screen.getByLabelText("Map hotspots")).getByRole(
      "button",
      { name: /Old Arena.*battle.*available/i },
    );
    await fireEvent.focus(hotspot);
    expect(
      screen.getByRole("region", { name: "Location detail" }).textContent,
    ).toContain("Old Arena");
    await userEvent.setup().click(hotspot);
    expect(onselect).toHaveBeenCalledWith("old-arena");
    const locked = within(screen.getByLabelText("Location list")).getByRole(
      "button",
      { name: /Archive.*locked.*completed/i },
    );
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    await userEvent.setup().click(locked);
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Requires decoded arena signal/)).toBeTruthy();
  });

  it("map offers the card shop hotspot", async () => {
    const onselect = vi.fn();
    const withShop: readonly StoryLocationState[] = [
      { id: "old-arena", access: "available", completed: false },
      { id: "archive", access: "locked", completed: false },
      { id: "hidden-gate", access: "hidden", completed: false },
      { id: "card-shop", access: "available", completed: false },
    ];
    render(IllustratedMapScreen, { locations: withShop, onselect });
    const hotspot = within(screen.getByLabelText("Map hotspots")).getByRole(
      "button",
      { name: /Card Shop.*shop.*available/i },
    );
    expect(hotspot).toBeTruthy();
    await userEvent.setup().click(hotspot);
    expect(onselect).toHaveBeenCalledWith("card-shop");
    expect(
      within(screen.getByLabelText("Location list")).getByRole("button", {
        name: /Card Shop.*shop.*available/i,
      }),
    ).toBeTruthy();
  });

  it("keeps completion separate from access and conditionally renders Back", () => {
    const availableCompleted: readonly StoryLocationState[] = [
      { id: "old-arena", access: "available", completed: true },
    ];
    const rendered = render(IllustratedMapScreen, {
      locations: availableCompleted,
      allowBack: false,
    });
    const location = screen.getAllByRole("button", {
      name: /available.*completed/i,
    });
    expect(location).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    rendered.rerender({ allowBack: true });
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
