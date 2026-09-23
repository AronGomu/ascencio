// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import CardPreviewPanel from "../../src/shared-svelte-ui/card-preview/CardPreviewPanel.svelte";
import type { CardPreviewView } from "../../src/shared-svelte-ui/card-preview/index.ts";

afterEach(() => cleanup());

function preview(key: string, name: string): CardPreviewView {
  return {
    key,
    name,
    description: `${name} effect text`,
    statsLine: null,
    imageUrl: null,
    imageAlt: name,
    placeholderLabel: "Image unavailable",
  };
}

describe("CardPreviewPanel card changes", () => {
  it("starts each card's effect text at the top", async () => {
    const rendered = render(CardPreviewPanel, {
      preview: preview("first", "First card"),
      dataCyPrefix: "test-preview",
      emptyLabel: "Hover a card to see its details.",
    });
    const text = rendered.container.querySelector<HTMLElement>(
      '[data-cy="test-preview-text"]',
    )!;
    text.scrollTop = 200;

    await rendered.rerender({
      preview: preview("second", "Second card"),
      dataCyPrefix: "test-preview",
      emptyLabel: "Hover a card to see its details.",
    });

    expect(text.scrollTop).toBe(0);
  });
});
