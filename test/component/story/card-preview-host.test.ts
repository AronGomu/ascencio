// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import type { CardImageLease } from "../../../src/cards/images/index.ts";
import type { CardPreviewView } from "../../../src/shared-svelte-ui/card-preview/index.ts";
import CardPreviewHost from "../../../src/story/components/CardPreviewHost.svelte";

afterEach(cleanup);

function preview(key: string): CardPreviewView {
  return {
    key,
    name: key,
    description: "Card description",
    statsLine: null,
    imageUrl: null,
    imageAlt: key,
    placeholderLabel: "Image unavailable",
  };
}

it("Story Lease race releases stale A, renders B, releases B on unmount", async () => {
  const a = Promise.withResolvers<CardImageLease | null>();
  const b = Promise.withResolvers<CardImageLease | null>();
  const acquire = vi
    .fn()
    .mockReturnValueOnce(a.promise)
    .mockReturnValueOnce(b.promise);
  const view = render(CardPreviewHost, {
    code: 1,
    preview: preview("A"),
    imageSource: { acquire },
    dataCyPrefix: "story-race",
    emptyLabel: "Hover a card",
  });
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());
  await view.rerender({ code: 2, preview: preview("B") });
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledTimes(2));
  expect(acquire.mock.calls[0]![2].aborted).toBe(true);
  const releaseB = vi.fn();
  b.resolve({ url: "blob:b", release: releaseB });
  await vi.waitFor(() =>
    expect(view.getByAltText("B").getAttribute("src")).toBe("blob:b"),
  );
  const releaseA = vi.fn();
  a.resolve({ url: "blob:a", release: releaseA });
  await vi.waitFor(() => expect(releaseA).toHaveBeenCalledOnce());
  expect(view.getByAltText("B").getAttribute("src")).toBe("blob:b");
  expect(releaseB).not.toHaveBeenCalled();
  view.unmount();
  expect(acquire.mock.calls[1]![2].aborted).toBe(true);
  expect(releaseB).toHaveBeenCalledOnce();
});

it("Story unmount aborts pending image acquisition and releases its late lease", async () => {
  const pending = Promise.withResolvers<CardImageLease | null>();
  const acquire = vi.fn().mockReturnValue(pending.promise);
  const view = render(CardPreviewHost, {
    code: 1,
    preview: preview("A"),
    imageSource: { acquire },
    dataCyPrefix: "story-unmount",
    emptyLabel: "Hover a card",
  });
  await vi.waitFor(() => expect(acquire).toHaveBeenCalledOnce());
  view.unmount();
  expect(acquire.mock.calls[0]![2].aborted).toBe(true);
  const release = vi.fn();
  pending.resolve({ url: "blob:late", release });
  await vi.waitFor(() => expect(release).toHaveBeenCalledOnce());
  expect(document.querySelector('[data-cy="story-unmount-image"]')).toBeNull();
});
