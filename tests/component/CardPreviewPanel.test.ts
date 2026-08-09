// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardPreviewPanel from "../../src/app/components/CardPreviewPanel.svelte";
import type { CardPreviewView } from "../../src/app/presentation/card-preview.ts";
import type { CardImageLease } from "../../src/app/images/card-image-cache.ts";
import { cardCode } from "../../src/duel/contracts/ids.ts";

afterEach(() => cleanup());

const FISHERMAN = cardCode(97590747);
const BLUE_EYES = cardCode(89631139);

function preview(
  code = FISHERMAN,
  overrides: Partial<CardPreviewView> = {},
): CardPreviewView {
  return {
    code,
    name: "The Legendary Fisherman",
    description: "This card is unaffected by Spell effects.",
    ...overrides,
  };
}

/** Mirrors `CardImageCache`: one object URL per code, released by reference. */
function leaseLibrary() {
  const releases = new Map<number, ReturnType<typeof vi.fn>>();
  const lease = vi.fn((code: number): CardImageLease => {
    const release = vi.fn();
    releases.set(code, release);
    return { url: `blob:card-${code}`, release };
  });
  return {
    library: { lease },
    lease,
    releaseFor: (code: number) => releases.get(code),
  };
}

describe("CardPreviewPanel", () => {
  it("panel shows the empty state", () => {
    render(CardPreviewPanel, { preview: null });

    expect(screen.getByText("Hover a card to see its details.")).toBeTruthy();
    expect(
      document.querySelector('[data-cy="card-preview-empty"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-cy="card-preview-name"]')).toBeNull();
    expect(document.querySelector('[data-cy="card-preview-art"]')).toBeNull();
  });

  it("panel shows name and text", () => {
    render(CardPreviewPanel, { preview: preview() });

    expect(
      document.querySelector('[data-cy="card-preview-name"]')?.textContent,
    ).toContain("The Legendary Fisherman");
    expect(
      document.querySelector('[data-cy="card-preview-text"]')?.textContent,
    ).toContain("This card is unaffected by Spell effects.");
    expect(document.querySelector('[data-cy="card-preview-empty"]')).toBeNull();
  });

  it("panel leases the image", () => {
    const { library, lease } = leaseLibrary();
    render(CardPreviewPanel, { preview: preview(), imageLibrary: library });

    expect(lease).toHaveBeenCalledTimes(1);
    expect(lease).toHaveBeenCalledWith(FISHERMAN);
    expect(
      document
        .querySelector('[data-cy="card-preview-image"]')
        ?.getAttribute("src"),
    ).toBe(`blob:card-${FISHERMAN}`);
  });

  it("panel releases the lease on change", async () => {
    const { library, lease, releaseFor } = leaseLibrary();
    const rendered = render(CardPreviewPanel, {
      preview: preview(),
      imageLibrary: library,
    });

    await rendered.rerender({
      preview: preview(BLUE_EYES, { name: "Blue-Eyes White Dragon" }),
    });

    expect(lease).toHaveBeenCalledTimes(2);
    expect(releaseFor(FISHERMAN)).toHaveBeenCalledTimes(1);
    expect(releaseFor(BLUE_EYES)).not.toHaveBeenCalled();
    expect(
      document
        .querySelector('[data-cy="card-preview-image"]')
        ?.getAttribute("src"),
    ).toBe(`blob:card-${BLUE_EYES}`);
  });

  it("panel releases the lease on destroy", () => {
    const { library, releaseFor } = leaseLibrary();
    render(CardPreviewPanel, { preview: preview(), imageLibrary: library });

    cleanup();

    expect(releaseFor(FISHERMAN)).toHaveBeenCalledTimes(1);
  });

  it("panel is inert", () => {
    const { library } = leaseLibrary();
    render(CardPreviewPanel, { preview: preview(), imageLibrary: library });

    const panel = document.querySelector('[data-cy="card-preview-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll("button")).toHaveLength(0);
    expect(panel?.querySelectorAll("a")).toHaveLength(0);
    expect(panel?.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(panel?.hasAttribute("tabindex")).toBe(false);
  });
});
