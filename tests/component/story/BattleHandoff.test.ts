// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BattleHandoffScreen from "../../../src/story/screens/BattleHandoffScreen.svelte";
import PreBattleScreen from "../../../src/story/screens/PreBattleScreen.svelte";

afterEach(() => cleanup());

describe("battle handoff", () => {
  it("shows briefing details, checkpoint, conditional return, and starts once", async () => {
    const onstart = vi.fn();
    const rendered = render(PreBattleScreen, { allowReturn: false, onstart });
    for (const text of [
      /Rin's Echo/i,
      /Signal Deck/i,
      /Relay Deck/i,
      /Single duel/i,
      /Decode the challenge/i,
      /progress is saved before the duel starts/i,
    ])
      expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Return to Map" })).toBeNull();
    const start = screen.getByRole("button", { name: "Start Duel" });
    await userEvent.setup().click(start);
    await userEvent.setup().click(start);
    expect(onstart).toHaveBeenCalledOnce();
    await rendered.rerender({ allowReturn: true });
    expect(screen.getByRole("button", { name: "Return to Map" })).toBeTruthy();
  });

  /* The screen reports a handoff; it never produces an outcome of its own.
     The mock outcome buttons it used to carry are gone with this slice. */
  it("announces the encounter it is handing over to, with no outcome controls", () => {
    render(BattleHandoffScreen, { label: "Rin's Echo" });
    expect(screen.getByRole("heading", { name: "Rin's Echo" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(
      /preparing the duel/i,
    );
    expect(screen.queryByRole("alert")).toBeNull();
    for (const name of [/Simulate/i, /Try again/, /Return to map/])
      expect(screen.queryByRole("button", { name })).toBeNull();
  });

  it("offers a retry and a way back when the checkpoint could not be written", async () => {
    const onretry = vi.fn();
    const onreturn = vi.fn();
    render(BattleHandoffScreen, {
      label: "Rin's Echo",
      error: "Storage is full",
      onretry,
      onreturn,
    });

    expect(screen.getByRole("alert").textContent).toMatch(/Storage is full/);
    expect(screen.queryByRole("status")).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("button", { name: "Return to map" }));
    expect(onretry).toHaveBeenCalledOnce();
    expect(onreturn).toHaveBeenCalledOnce();
  });
});
