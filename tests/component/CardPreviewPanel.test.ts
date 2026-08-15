// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardPreviewPanel from "../../src/battle/app/components/CardPreviewPanel.svelte";
import {
  HIDDEN_CARD_PREVIEW,
  type CardPreviewView,
} from "../../src/battle/app/presentation/card-preview.ts";
import type { CardImageLease } from "../../src/battle/app/images/card-image-cache.ts";
import { cardCode } from "../../src/battle/duel/contracts/ids.ts";

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

  it("renders bounded body around art name and effect text", () => {
    render(CardPreviewPanel, { preview: preview() });

    const panel = document.querySelector('[data-cy="card-preview-panel"]');
    const art = document.querySelector('[data-cy="card-preview-art"]');
    const body = document.querySelector('[data-cy="card-preview-body"]');
    const name = document.querySelector('[data-cy="card-preview-name"]');
    const region = document.querySelector(
      '[data-cy="card-preview-text-region"]',
    );
    const text = document.querySelector('[data-cy="card-preview-text"]');
    expect(panel?.children).toEqual(expect.objectContaining({ length: 2 }));
    expect(panel?.children[0]).toBe(art);
    expect(panel?.children[1]).toBe(body);
    expect(body?.children[0]).toBe(name);
    expect(body?.children[1]).toBe(region);
    expect(region?.children[0]).toBe(text);
    expect(name?.textContent).toContain("The Legendary Fisherman");
    expect(text?.textContent).toContain(
      "This card is unaffected by Spell effects.",
    );
    expect(text?.getAttribute("tabindex")).toBe("0");
    expect(text?.getAttribute("aria-label")).toBe("Card effect text");
    expect(
      region?.querySelector('[data-cy="card-preview-text-scrollbar"]'),
    ).not.toBeNull();
    expect(
      region?.querySelector('[data-cy="card-preview-text-scrollbar-thumb"]'),
    ).not.toBeNull();
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

  it("panel does not lease an image for the hidden preview", () => {
    const { library, lease } = leaseLibrary();
    render(CardPreviewPanel, {
      preview: HIDDEN_CARD_PREVIEW,
      imageLibrary: library,
      placeholderUrl: "/placeholder.webp",
    });

    expect(lease).not.toHaveBeenCalled();
    expect(
      document
        .querySelector('[data-cy="card-preview-image"]')
        ?.getAttribute("src"),
    ).toBe("/placeholder.webp");
  });

  it("keeps only the real text scroller keyboard focusable", () => {
    const { library } = leaseLibrary();
    render(CardPreviewPanel, { preview: preview(), imageLibrary: library });

    const panel = document.querySelector('[data-cy="card-preview-panel"]');
    const text = document.querySelector('[data-cy="card-preview-text"]');
    expect(panel).not.toBeNull();
    expect(panel?.querySelectorAll("button")).toHaveLength(0);
    expect(panel?.querySelectorAll("a")).toHaveLength(0);
    expect(panel?.querySelectorAll("[tabindex]")).toHaveLength(1);
    expect(panel?.querySelector("[tabindex]")).toBe(text);
    expect(panel?.hasAttribute("tabindex")).toBe(false);
    expect(
      document
        .querySelector('[data-cy="card-preview-text-scrollbar"]')
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
