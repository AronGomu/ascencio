// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardTray from "../../src/app/components/duel-field/CardTray.svelte";
import DuelHud from "../../src/app/components/duel-field/DuelHud.svelte";
import DuelLog from "../../src/app/components/duel-field/DuelLog.svelte";
import type { DuelLogEntry } from "../../src/app/stores/duel-store.ts";
import {
  PUBLIC_STATE_CARD_TEXTS,
  RICH_PUBLIC_DUEL_STATE,
  SIXTY_PUBLIC_CARDS,
} from "../fixtures/board-public-states.ts";

afterEach(() => cleanup());

describe("DuelHud", () => {
  it("renders truthful LP, turn, phase, chain provenance/status, counters, and materials", () => {
    render(DuelHud, {
      snapshot: RICH_PUBLIC_DUEL_STATE,
      cardTexts: PUBLIC_STATE_CARD_TEXTS,
    });

    const hud = screen.getByRole("region", { name: "Duel HUD" });
    expect(within(hud).getByText("Turn 4")).toBeTruthy();
    expect(within(hud).getByText("Opponent's turn")).toBeTruthy();
    expect(within(hud).getByText("battle step")).toBeTruthy();
    expect(within(hud).getByText("6,200 LP")).toBeTruthy();
    expect(within(hud).getByText("3,400 LP")).toBeTruthy();

    const chain = within(hud).getByRole("region", { name: "Active chain" });
    expect(within(chain).getByText(/Link 1 · You/)).toBeTruthy();
    expect(within(chain).getByText(/solving · normal/)).toBeTruthy();
    expect(within(chain).getByText(/Link 2 · Opponent/)).toBeTruthy();
    expect(within(chain).getByText(/pending · negated/)).toBeTruthy();
    expect(within(chain).getByText("Card effect")).toBeTruthy();

    expect(within(hud).getByText("3 Spell Counters")).toBeTruthy();
    expect(within(hud).getByText("2 materials")).toBeTruthy();
    expect(within(hud).getAllByText("Axe Raider").length).toBeGreaterThan(0);
    expect(within(hud).getByText("Hidden material")).toBeTruthy();
  });

  it("opens public inspector data without exposing hidden labels or requesting hidden images", async () => {
    const user = userEvent.setup();
    const resolveCardImage = vi.fn((card: { code?: number }) =>
      card.code === undefined ? undefined : `/cards/${card.code}.jpg`,
    );
    const inspected: (typeof RICH_PUBLIC_DUEL_STATE.players)[0]["monsters"][number][] =
      [];
    render(DuelHud, {
      snapshot: RICH_PUBLIC_DUEL_STATE,
      cardTexts: PUBLIC_STATE_CARD_TEXTS,
      resolveCardImage,
      oninspect: (card: (typeof inspected)[number]) => inspected.push(card),
    });

    expect(document.body.textContent).not.toContain("Dark Magician");
    expect(document.body.innerHTML).not.toContain("46986414");
    expect(resolveCardImage).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Open Your GY tray, 1 card" }),
    );
    expect(
      screen.getByRole("button", { name: "Inspect Blue-Eyes White Dragon" }),
    ).toBeTruthy();
    expect(resolveCardImage).toHaveBeenCalledTimes(1);
    await user.click(
      screen.getByRole("button", { name: "Inspect Blue-Eyes White Dragon" }),
    );
    expect(inspected).toHaveLength(1);

    await user.click(
      screen.getByRole("button", {
        name: "Open Opponent Extra Deck tray, 2 cards",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Inspect Blue-Eyes White Dragon" }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("Dark Magician");
    expect(
      resolveCardImage.mock.calls.some(([card]) => card.code === 46986414),
    ).toBe(false);
  });

  it("keeps deck count-only and mounts bounded tray pages on demand with focus return", async () => {
    const user = userEvent.setup();
    const resolveCardImage = vi.fn(() => "/cards/public.jpg");
    render(CardTray, {
      label: "Your GY",
      player: 0,
      zone: "graveyard",
      count: 60,
      cards: SIXTY_PUBLIC_CARDS,
      cardTexts: PUBLIC_STATE_CARD_TEXTS,
      resolveCardImage,
    });

    const open = screen.getByRole("button", {
      name: "Open Your GY tray, 60 cards",
    });
    expect(screen.queryAllByRole("button", { name: /^Inspect / })).toHaveLength(
      0,
    );
    expect(resolveCardImage).not.toHaveBeenCalled();

    await user.click(open);
    const firstPage = screen.getAllByRole("button", { name: /^Inspect / });
    expect(firstPage).toHaveLength(24);
    expect(document.activeElement).toBe(firstPage[0]);
    expect(resolveCardImage).toHaveBeenCalledTimes(24);
    expect(screen.getByText("1–24 of 60")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("button", { name: /^Inspect / })).toHaveLength(
      24,
    );
    expect(screen.getByText("25–48 of 60")).toBeTruthy();
    expect(resolveCardImage).toHaveBeenCalledTimes(48);

    await user.click(
      screen.getByRole("button", { name: "Close Your GY tray" }),
    );
    expect(screen.queryAllByRole("button", { name: /^Inspect / })).toHaveLength(
      0,
    );
    expect(document.activeElement).toBe(open);

    cleanup();
    render(CardTray, {
      label: "Opponent Deck",
      player: 1,
      zone: "deck",
      count: 60,
      cards: SIXTY_PUBLIC_CARDS,
      cardTexts: PUBLIC_STATE_CARD_TEXTS,
      resolveCardImage,
    });
    expect(screen.getByText("Count only")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Open Opponent Deck/ }),
    ).toBeNull();
  });
});

describe("DuelLog", () => {
  it("renders more than 100 semantic rows plus explicit truncation marker", () => {
    const entries: DuelLogEntry[] = [
      {
        kind: "truncated",
        logSequence: 0,
        omittedCount: 12,
        text: "12 earlier duel log entries were omitted.",
      },
      ...Array.from({ length: 125 }, (_, index): DuelLogEntry => ({
        kind: "activity",
        logSequence: index + 1,
        sourceType: "phaseChanged",
        text: `Public event ${index + 1}`,
      })),
    ];
    render(DuelLog, { entries });

    expect(screen.getByText("126/2,000")).toBeTruthy();
    expect(
      screen.getByText("12 earlier duel log entries were omitted."),
    ).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(126);
    expect(screen.getAllByText("Public event 125")).toHaveLength(2);
  });
});
