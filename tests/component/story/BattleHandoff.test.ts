// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import BattleHandoffScreen from "../../../src/story/screens/BattleHandoffScreen.svelte";
import PreBattleScreen from "../../../src/story/screens/PreBattleScreen.svelte";

afterEach(() => cleanup());

/* The briefing refuses to start without a deck it can field, so every render of
   it here carries one. Which decks are offered and which are refused is
   `tests/component/story/pre-battle-deck-picker.test.ts`. */
const SIGNAL_DECK = {
  id: "signal",
  name: "Signal Deck",
  legal: true,
  issue: null,
  bundled: false,
} as const;

describe("battle handoff", () => {
  it("shows the encounter, checkpoint, conditional return, and starts once", async () => {
    const onstart = vi.fn();
    const rendered = render(PreBattleScreen, {
      allowReturn: false,
      decks: [SIGNAL_DECK],
      defaultDeckId: SIGNAL_DECK.id,
      onstart,
    });

    /* Who the encounter stages names the screen and its opponent seat alike,
       so both copies are asked for. */
    expect(screen.getAllByText(/Rin's Echo/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Relay Deck/i)).toBeTruthy();
    /* The opponent's line, their deck card's meta and the lock caption under it
       all say who fixed this seat. */
    expect(screen.getAllByText(/Set by the story/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/progress is saved before the duel starts/i),
    ).toBeTruthy();

    /* Two of them when there is a way back at all — the footer's button and
       the header's icon, one per width — and none when there is not. */
    expect(screen.queryAllByRole("button", { name: "Back" })).toHaveLength(0);
    const start = screen.getByRole("button", { name: "Start Duel" });
    await userEvent.setup().click(start);
    await userEvent.setup().click(start);
    expect(onstart).toHaveBeenCalledOnce();
    await rendered.rerender({ allowReturn: true });
    expect(
      screen.getAllByRole("button", { name: "Back" }).length,
    ).toBeGreaterThan(0);
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
