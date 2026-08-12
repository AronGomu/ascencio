// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardPreviewPanel from "../../src/app/components/CardPreviewPanel.svelte";
import {
  HIDDEN_CARD_PREVIEW,
  type CardPreviewView,
} from "../../src/app/presentation/card-preview.ts";
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

  it("panel renders the status under the card text", () => {
    render(CardPreviewPanel, {
      preview: preview(),
      status: { text: "Choose", thinking: false },
    });

    expect(
      document.querySelector('[data-cy="card-preview-status-text"]')
        ?.textContent,
    ).toBe("Choose");
    expect(
      document.querySelector('[data-cy="card-preview-status-dots"]'),
    ).toBeNull();
  });

  it("panel renders thinking dots", () => {
    render(CardPreviewPanel, {
      preview: preview(),
      status: { text: "Do you respond?", thinking: true },
    });

    expect(
      document.querySelector('[data-cy="card-preview-status-dot-1"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="card-preview-status-dot-2"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="card-preview-status-dot-3"]'),
    ).not.toBeNull();
  });

  it("panel exposes priority", () => {
    render(CardPreviewPanel, {
      status: { text: "Do you respond?", thinking: true },
      hasPriority: true,
    });

    expect(
      document
        .querySelector('[data-cy="card-preview-status"]')
        ?.getAttribute("data-has-priority"),
    ).toBe("true");
  });

  it("panel omits priority when waiting", () => {
    render(CardPreviewPanel, {
      status: { text: "Waiting for the engine", thinking: true },
      hasPriority: false,
    });

    expect(
      document
        .querySelector('[data-cy="card-preview-status"]')
        ?.hasAttribute("data-has-priority"),
    ).toBe(false);
  });

  it("panel renders the status with no card previewed", () => {
    render(CardPreviewPanel, {
      preview: null,
      status: { text: "Opponent is acting", thinking: true },
    });

    expect(
      document.querySelector('[data-cy="card-preview-empty"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-cy="card-preview-status-text"]')
        ?.textContent,
    ).toBe("Opponent is acting");
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

  it("keeps art, copy and status as direct panel descendants for compact CSS targeting", () => {
    render(CardPreviewPanel, {
      preview: preview(),
      status: { text: "Choose", thinking: false },
    });

    const panel = document.querySelector('[data-cy="card-preview-panel"]');
    expect(
      panel?.querySelector(':scope > [data-cy="card-preview-art"]'),
    ).not.toBeNull();
    expect(
      panel?.querySelector(':scope > [data-cy="card-preview-copy"]'),
    ).not.toBeNull();
    expect(
      panel?.querySelector(':scope > [data-cy="card-preview-status"]'),
    ).not.toBeNull();
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
