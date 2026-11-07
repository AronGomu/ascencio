// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import FullControlToggle from "../../src/battle/app/components/duel-field/FullControlToggle.svelte";

afterEach(() => {
  cleanup();
});

function checkbox(): HTMLInputElement {
  return document.querySelector(
    '[data-cy="full-control-checkbox"]',
  ) as HTMLInputElement;
}

function toggle(): HTMLElement {
  return document.querySelector(
    '[data-cy="full-control-toggle"]',
  ) as HTMLElement;
}

function holdHint(): HTMLElement {
  return document.querySelector(
    '[data-cy="full-control-hold-hint"]',
  ) as HTMLElement;
}

describe("FullControlToggle", () => {
  /* The name is a tooltip now, not a caption: it stays in the document so the
     stylesheet can reveal it on hover and on focus, and the box keeps the
     accessible name whether or not the tip is showing. */
  it("names the control through a tooltip and the box's own label", () => {
    render(FullControlToggle, { value: false, onchange: vi.fn() });

    const label = document.querySelector('[data-cy="full-control-label"]');
    expect(label?.textContent).toBe("Full Control");
    expect(label?.getAttribute("role")).toBe("tooltip");
    expect(checkbox().getAttribute("aria-label")).toBe("Full Control");
  });

  it("reports checkbox changes", async () => {
    const onchange = vi.fn();
    render(FullControlToggle, { value: false, onchange });

    await fireEvent.click(checkbox());
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it("reflects the stored setting", async () => {
    const onchange = vi.fn();
    const rendered = render(FullControlToggle, { value: false, onchange });
    expect(checkbox().checked).toBe(false);

    await rendered.rerender({ value: true, onchange });
    expect(checkbox().checked).toBe(true);
  });

  /* The bug this pins: the box used to render the *effective* state, so a held
     Ctrl drew a tick the setting had not written. Clicking that tick emitted
     `false` — a no-op against a state Ctrl was holding up — and left the player
     unable to turn the persistent setting on while the key was down. */
  it("keeps the box on the stored setting while Ctrl holds the state up", async () => {
    const onchange = vi.fn();
    render(FullControlToggle, { value: false, held: true, onchange });

    expect(checkbox().checked).toBe(false);
    expect(toggle().dataset.effective).toBe("true");
    expect(toggle().classList.contains("is-held")).toBe(true);
    expect(holdHint().textContent).toBe("held by Ctrl");

    await fireEvent.click(checkbox());
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it("announces no hold and reports the effective state as the setting alone", async () => {
    const rendered = render(FullControlToggle, {
      value: true,
      held: false,
      onchange: vi.fn(),
    });

    expect(holdHint().getAttribute("role")).toBe("status");
    expect(holdHint().textContent).toBe("");
    expect(toggle().dataset.effective).toBe("true");
    expect(toggle().classList.contains("is-held")).toBe(false);

    await rendered.rerender({ value: false, held: false, onchange: vi.fn() });
    expect(toggle().dataset.effective).toBe("false");
  });
});
