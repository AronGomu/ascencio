// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoadScreen from "../../../src/story/screens/LoadScreen.svelte";

afterEach(() => {
  cleanup();
  globalThis.location.hash = "";
});

describe("mock load", () => {
  it("shows complete slot summaries plus reviewer corrupt state", () => {
    render(LoadScreen, { showCorrupt: true });
    expect(screen.getByText("Manual slot 1")).toBeTruthy();
    expect(screen.getByText("Autosave")).toBeTruthy();
    expect(screen.getByText("Empty slot")).toBeTruthy();
    expect(screen.getByText(/Chapter 1 · Old Arena/)).toBeTruthy();
    expect(screen.getByText(/00:18:42/)).toBeTruthy();
    expect(screen.getByText(/Yesterday/)).toBeTruthy();
    expect(screen.getAllByText(/preview/i)).toHaveLength(2);
    expect(screen.getByText(/incompatible or corrupt/i)).toBeTruthy();
  });

  it("loads occupied slots, confirms delete, and invokes Back", async () => {
    const onload = vi.fn();
    const ondelete = vi.fn(() => true);
    const onback = vi.fn();
    render(LoadScreen, { onload, ondelete, onback });
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
