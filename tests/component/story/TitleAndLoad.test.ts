// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoadScreen from "../../../src/story/screens/LoadScreen.svelte";

afterEach(() => {
  cleanup();
  globalThis.location.hash = "";
});

const summaries = {
  manualSummary: "Chapter 1 · Old Arena",
  autosaveSummary: "Chapter 1 · City map",
};

describe("load slots", () => {
  it("shows supplied slot summaries plus reviewer corrupt state", () => {
    render(LoadScreen, { ...summaries, showCorrupt: true });
    expect(screen.getByText("Manual slot 1")).toBeTruthy();
    expect(screen.getByText("Autosave")).toBeTruthy();
    expect(screen.getByText("Empty slot")).toBeTruthy();
    expect(screen.getAllByText(/Chapter 1 · Old Arena/)).toHaveLength(2);
    expect(screen.queryByText(/00:18:42|Yesterday/)).toBeNull();
    expect(screen.getByText(/incompatible or corrupt/i)).toBeTruthy();
  });

  it("defaults unread slots to disabled controls", async () => {
    const onload = vi.fn();
    render(LoadScreen, { onload });
    const user = userEvent.setup();
    for (const name of ["Load manual slot 1", "Load autosave"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveProperty("disabled", true);
      await user.click(button);
    }
    expect(onload).not.toHaveBeenCalled();
  });

  it("loads occupied slots, confirms delete, and invokes Back", async () => {
    const onload = vi.fn();
    const ondelete = vi.fn(() => true);
    const onback = vi.fn();
    render(LoadScreen, { ...summaries, onload, ondelete, onback });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Load manual slot 1" }),
    );
    expect(onload).toHaveBeenCalledWith("manual");
    await user.click(screen.getByRole("button", { name: "Load autosave" }));
    expect(onload).toHaveBeenCalledWith("autosave");
    await user.click(
      screen.getByRole("button", { name: "Delete manual slot 1" }),
    );
    expect(
      screen.getByRole("alertdialog", { name: "Delete save?" }),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel delete" }));
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("Delete manual"),
    );
    await user.click(
      screen.getByRole("button", { name: "Delete manual slot 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete save" }));
    expect(ondelete).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", { name: "Manual slot 1 · Empty" }),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Load manual slot 1",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onback).toHaveBeenCalledOnce();
  });
});
