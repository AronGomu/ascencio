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

describe("FullControlToggle", () => {
  it("renders the Full Control label", () => {
    render(FullControlToggle, { effective: false, onchange: vi.fn() });

    const label = document.querySelector('[data-cy="full-control-label"]');
    expect(label?.textContent).toBe("Full Control");
  });

  it("reports checkbox changes", async () => {
    const onchange = vi.fn();
    render(FullControlToggle, { effective: false, onchange });

    await fireEvent.click(checkbox());
    expect(onchange).toHaveBeenCalledWith(true);
  });

  it("reflects the effective value", async () => {
    const onchange = vi.fn();
    const rendered = render(FullControlToggle, { effective: false, onchange });
    expect(checkbox().checked).toBe(false);

    await rendered.rerender({ effective: true, onchange });
    expect(checkbox().checked).toBe(true);
  });
});
