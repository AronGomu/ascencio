// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import DuelResultDialog from "../../src/battle/app/components/DuelResultDialog.svelte";
import type { DuelResult } from "../../src/battle/duel/contracts/duel-result.ts";

const COMPLETED_RESULT: DuelResult = {
  type: "completed",
  winner: 0,
  loser: 1,
  reason: 1,
};

function renderDialog(
  result: DuelResult = COMPLETED_RESULT,
  overrides: { completed?: boolean; diagnosticPending?: boolean } = {},
) {
  return render(DuelResultDialog, {
    result,
    completed: overrides.completed ?? true,
    diagnosticPending: overrides.diagnosticPending ?? false,
    onrestart: vi.fn(),
    onchangedecks: vi.fn(),
    ondownloaddiagnostics: vi.fn(),
  });
}

function element(dataCy: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-cy="${dataCy}"]`);
  if (found === null) throw new Error(`Missing ${dataCy}`);
  return found;
}

afterEach(() => cleanup());

describe("DuelResultDialog", () => {
  it("announces a win", () => {
    renderDialog();

    expect(element("app-result-heading").textContent).toBe("You won");
    expect(element("app-result-finish-reason").textContent).toContain("1");
  });

  it("announces a loss", () => {
    renderDialog({ ...COMPLETED_RESULT, winner: 1, loser: 0 });

    expect(element("app-result-heading").textContent).toBe("Opponent won");
  });

  it("announces a surrender", () => {
    renderDialog({ type: "surrendered", winner: 1, loser: 0 });

    expect(element("app-result-heading").textContent).toBe("Duel surrendered");
  });

  it("renders inside a modal dialog", () => {
    renderDialog();

    expect(element("duel-result-dialog").getAttribute("role")).toBe("dialog");
    expect(element("duel-result-dialog").getAttribute("aria-modal")).toBe(
      "true",
    );
    expect(element("duel-result-dialog-backdrop")).toBeDefined();
  });

  it("focuses the heading on mount", () => {
    renderDialog();

    expect(document.activeElement).toBe(element("app-result-heading"));
  });

  it("restart and diagnostics fire their callbacks", async () => {
    const user = userEvent.setup();
    const onrestart = vi.fn();
    const onchangedecks = vi.fn();
    const ondownloaddiagnostics = vi.fn();
    render(DuelResultDialog, {
      result: COMPLETED_RESULT,
      completed: true,
      diagnosticPending: false,
      onrestart,
      onchangedecks,
      ondownloaddiagnostics,
    });

    await user.click(element("app-restart-duel-button"));
    await user.click(element("duel-result-change-decks-button"));
    await user.click(element("app-result-download-diagnostics-button"));

    expect(onrestart).toHaveBeenCalledTimes(1);
    expect(onchangedecks).toHaveBeenCalledTimes(1);
    expect(ondownloaddiagnostics).toHaveBeenCalledTimes(1);
  });

  it("disables restart until the duel is completed", () => {
    renderDialog(COMPLETED_RESULT, { completed: false });

    const restart = element("app-restart-duel-button") as HTMLButtonElement;
    expect(restart.disabled).toBe(true);
    expect(restart.textContent).toBe("Starting another duel…");
  });

  it("disables diagnostics while pending", () => {
    renderDialog(COMPLETED_RESULT, { diagnosticPending: true });

    const diagnostics = element(
      "app-result-download-diagnostics-button",
    ) as HTMLButtonElement;
    expect(diagnostics.disabled).toBe(true);
    expect(diagnostics.textContent).toBe("Preparing diagnostics…");
  });

  it("backdrop click does not dismiss", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(element("duel-result-dialog-backdrop"));

    expect(element("duel-result-dialog")).toBeDefined();
  });
});
