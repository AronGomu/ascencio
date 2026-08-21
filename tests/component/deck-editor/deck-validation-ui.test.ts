// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ValidationIssues from "../../../src/deck-editor/components/ValidationIssues.svelte";
import { stateFixture } from "../../fixtures/deck-editor.ts";

afterEach(() => cleanup());

describe("deck validation UI", () => {
  it("shows actionable issues only when validation has warnings/errors", () => {
    const validation = stateFixture().current!.deck.validation;
    const onfocusissue = vi.fn();
    render(ValidationIssues, { validation, onfocusissue });
    expect(screen.getByRole("heading", { name: "Deck checks" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Main Deck needs 40 more/ }),
    ).toBeTruthy();
  });

  /* The panel is generic over the issue code, so a new one needs no case of its
     own — which is exactly the claim worth pinning, because `not-owned` is the
     first code whose cause sits outside the deck the player is looking at. It
     has to read as an error and stay clickable back to the card. */
  it("an ownership issue reads like any other error", () => {
    const onfocusissue = vi.fn();
    render(ValidationIssues, {
      validation: {
        status: "errors",
        issues: [
          {
            id: "not-owned:deck-89631139",
            severity: "error",
            code: "not-owned",
            message:
              "This deck uses 2 copy/copies of Blue-Eyes White Dragon; you own 1.",
            cardCode: 89631139,
          },
        ],
        rulesetRevision: "r1",
      },
      onfocusissue,
    });
    const button = screen.getByRole("button", {
      name: /Blue-Eyes White Dragon/,
    });
    expect(button.closest("li")?.classList.contains("error")).toBe(true);
    button.click();
    expect(onfocusissue).toHaveBeenCalledWith(89631139, null);
  });

  it("renders no expanded panel for an issue-free summary", () => {
    render(ValidationIssues, {
      validation: { status: "valid", issues: [], rulesetRevision: "r1" },
      onfocusissue: vi.fn(),
    });
    expect(screen.queryByRole("heading", { name: "Deck checks" })).toBeNull();
  });
});
