// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import FieldStatusPills from "../../src/app/components/duel-field/FieldStatusPills.svelte";
import LifePointsPill from "../../src/app/components/duel-field/LifePointsPill.svelte";

afterEach(() => {
  cleanup();
});

describe("FieldStatusPills", () => {
  it("priority pill reads Choose Action", () => {
    render(FieldStatusPills, { hasPriority: true, phase: "main1" });
    const priorityPill = document.querySelector('[data-cy="prio-pill"]');
    expect(priorityPill?.textContent).toBe("Choose Action");
    expect(priorityPill?.classList.contains("is-priority")).toBe(true);
  });

  it("priority pill reads Waiting Opponent", () => {
    render(FieldStatusPills, { hasPriority: false, phase: "main1" });
    const priorityPill = document.querySelector('[data-cy="prio-pill"]');
    expect(priorityPill?.textContent).toBe("Waiting Opponent");
    expect(priorityPill?.classList.contains("is-priority")).toBe(false);
  });

  it("phase pill reads the phase", () => {
    render(FieldStatusPills, { hasPriority: false, phase: "battle" });
    const phasePill = document.querySelector('[data-cy="phase-pill"]');
    expect(phasePill?.textContent).toBe("Battle");
  });

  it("separator renders between the pills", () => {
    render(FieldStatusPills, { hasPriority: false, phase: "battle" });
    const separator = document.querySelector(
      '[data-cy="field-status-pills-separator"]',
    );
    expect(separator?.textContent).toBe("-");
  });

  it("pill group is a live region", () => {
    render(FieldStatusPills, { hasPriority: false, phase: "battle" });
    const group = document.querySelector('[data-cy="field-status-pills"]');
    expect(group?.getAttribute("aria-live")).toBe("polite");
  });
});

describe("LifePointsPill", () => {
  it("life pill formats thousands", () => {
    render(LifePointsPill, { lifePoints: 8000, player: 0 });
    const pill = document.querySelector('[data-cy="life-pill-p0"]');
    expect(pill?.textContent).toBe("8,000 LP");
  });
});
