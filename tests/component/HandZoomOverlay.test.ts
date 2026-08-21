// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import HandZoomOverlay from "../../src/battle/app/components/duel-field/HandZoomOverlay.svelte";
import {
  cardCode,
  cardInstanceId,
  choiceId,
} from "../../src/battle/duel/contracts/ids.ts";
import type { CardImageLibrary } from "../../src/battle/app/images/card-image-cache.ts";
import type { InteractionChoice } from "../../src/battle/app/prompts/interaction-spec.ts";
import type { BoardCardView } from "../../src/battle/field/board-view-model.ts";

afterEach(() => {
  cleanup();
});

const CARD: BoardCardView = Object.freeze({
  id: "p0-hand-2",
  targetId: "card:p0-hand-2" as const,
  instanceId: cardInstanceId("p0-hand-2"),
  player: 0,
  owner: 0,
  zoneId: "p0:hand" as const,
  sequence: 2,
  position: "faceUpAttack" as const,
  orientation: "upright" as const,
  facing: "self" as const,
  hidden: false,
  label: "Card 2 in Your Hand",
  x: 0,
  y: 0,
  width: 72 / 1280,
  height: 104 / 720,
  counters: [],
  materials: [],
  chainLinks: [],
  image: Object.freeze({ kind: "back" as const }),
});

/* A face-up hand card: the zoom overlay resolves its art through a lease on
   the image library, exactly as every mounted card does. */
const FACE_CARD: BoardCardView = Object.freeze({
  ...CARD,
  id: "p0-hand-3",
  targetId: "card:p0-hand-3" as const,
  instanceId: cardInstanceId("p0-hand-3"),
  sequence: 3,
  label: "Card 3 in Your Hand",
  image: Object.freeze({ kind: "face" as const, code: cardCode(12_345) }),
});

const OTHER_FACE_CARD: BoardCardView = Object.freeze({
  ...FACE_CARD,
  id: "p0-hand-4",
  targetId: "card:p0-hand-4" as const,
  instanceId: cardInstanceId("p0-hand-4"),
  sequence: 4,
  label: "Card 4 in Your Hand",
  image: Object.freeze({ kind: "face" as const, code: cardCode(54_321) }),
});

const CARD_BACK_URL = "/back.webp";
const PLACEHOLDER_URL = "/placeholder.webp";

const SCALE = 1.6;
interface Anchor {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}
const ANCHOR: Anchor = Object.freeze({
  left: 640,
  top: 300,
  width: 60,
  height: 90,
});
const OVERLAY_WIDTH = ANCHOR.width * SCALE;

/* The rotated phone stage: 693 wide along its *own* x axis while the viewport
   jsdom reports is 1024. The two disagreeing is the whole point — a clamp
   reading `innerWidth` would let the overlay sit 33px past the frame's right
   edge, off the board, on every portrait phone. */
const FRAME_WIDTH = 693;

function overlay(): HTMLElement {
  return document.querySelector(
    '[data-cy="hand-zoom-overlay-p0-hand-2"]',
  ) as HTMLElement;
}

const CHOICES: readonly InteractionChoice[] = [
  { id: choiceId("summon"), label: "Summon", action: "summon" },
];

/* Nested under `props`: `anchor` is also a Svelte mount option, so a flat
   object would be read as one and the component would get no props at all. */
function renderOverlay(
  frameWidth: number,
  anchor = ANCHOR,
  choices: readonly InteractionChoice[] = [],
  overrides: {
    readonly card?: BoardCardView;
    readonly imageLibrary?: Pick<CardImageLibrary, "lease"> | null;
  } = {},
) {
  return render(HandZoomOverlay, {
    props: {
      card: overrides.card ?? CARD,
      anchor,
      frameWidth,
      choices,
      imageLibrary: overrides.imageLibrary ?? null,
      cardBackUrl: CARD_BACK_URL,
      placeholderUrl: PLACEHOLDER_URL,
    },
  });
}

function overlayImageSource(cardId: string): string | null {
  return (
    document
      .querySelector(`[data-cy="hand-zoom-overlay-image-${cardId}"]`)
      ?.getAttribute("src") ?? null
  );
}

/* One `release` spy per leased code, so a rerender can be checked against the
   lease the previous card held rather than a shared counter. */
function fakeImageLibrary(): {
  readonly library: Pick<CardImageLibrary, "lease">;
  readonly releaseFor: (code: number) => Mock<() => void>;
} {
  const releases = new Map<number, Mock<() => void>>();
  const lease = vi.fn<(code: number) => { url: string; release: () => void }>(
    (code) => {
      let release = releases.get(code);
      if (release === undefined) {
        release = vi.fn<() => void>();
        releases.set(code, release);
      }
      return { url: `blob:test-${code}`, release };
    },
  );
  return {
    library: { lease },
    releaseFor: (code) => {
      const release = releases.get(code);
      if (release === undefined)
        throw new Error(`Code ${code} was never leased`);
      return release;
    },
  };
}

describe("HandZoomOverlay clamping", () => {
  it("clamps against the frame it was anchored in, not the viewport", () => {
    expect(globalThis.innerWidth).toBeGreaterThan(FRAME_WIDTH);
    renderOverlay(FRAME_WIDTH);

    // Centred on the anchor would be 622; the frame only allows 589.
    expect(overlay().style.left).toBe(`${FRAME_WIDTH - OVERLAY_WIDTH - 8}px`);
    expect(overlay().style.width).toBe(`${OVERLAY_WIDTH}px`);
  });

  it("centres on the anchor when the frame has room", () => {
    renderOverlay(1280);

    const centred = ANCHOR.left + ANCHOR.width / 2 - OVERLAY_WIDTH / 2;
    expect(overlay().style.left).toBe(`${centred}px`);
  });

  it("keeps an 8px gutter on the near edge", () => {
    renderOverlay(FRAME_WIDTH, { ...ANCHOR, left: 0 });

    expect(overlay().style.left).toBe("8px");
  });

  it("grows upward from the anchor's bottom edge, stopping at the top gutter", () => {
    renderOverlay(FRAME_WIDTH);
    const grown = ANCHOR.top + ANCHOR.height - ANCHOR.height * SCALE;
    expect(overlay().style.top).toBe(`${grown}px`);

    cleanup();
    renderOverlay(FRAME_WIDTH, { ...ANCHOR, top: 10 });
    expect(overlay().style.top).toBe("8px");
  });
});

describe("HandZoomOverlay pointer surface", () => {
  it("stops the chips bridge at the anchor card's top edge", () => {
    renderOverlay(FRAME_WIDTH, ANCHOR, CHOICES);

    expect(
      document.querySelector('[data-cy="hand-zoom-overlay-bridge-p0-hand-2"]'),
    ).not.toBeNull();
    /* Measured from the overlay's bottom edge, which sits on the card's: the
       bridge may cover the overlay above the card and nothing below it. */
    expect(overlay().style.getPropertyValue("--hand-zoom-bridge-bottom")).toBe(
      `${ANCHOR.height}px`,
    );
  });

  it("renders no pointer-catching part at all without chips to reach", () => {
    renderOverlay(FRAME_WIDTH);

    expect(
      document.querySelector('[data-cy^="hand-zoom-overlay-bridge-"]'),
    ).toBeNull();
  });
});

describe("HandZoomOverlay art", () => {
  it("renders the leased art for a known card", () => {
    const { library } = fakeImageLibrary();

    renderOverlay(FRAME_WIDTH, ANCHOR, [], {
      card: FACE_CARD,
      imageLibrary: library,
    });

    expect(overlayImageSource(FACE_CARD.id)).toBe("blob:test-12345");
  });

  it("renders the card back for a hidden card", () => {
    const { library } = fakeImageLibrary();

    renderOverlay(FRAME_WIDTH, ANCHOR, [], { imageLibrary: library });

    expect(overlayImageSource(CARD.id)).toBe(CARD_BACK_URL);
    expect(library.lease).not.toHaveBeenCalled();
  });

  it("falls back to the placeholder when no lease exists", () => {
    renderOverlay(FRAME_WIDTH, ANCHOR, [], { card: FACE_CARD });

    expect(overlayImageSource(FACE_CARD.id)).toBe(PLACEHOLDER_URL);
  });

  it("releases the lease when the card changes", async () => {
    const { library, releaseFor } = fakeImageLibrary();
    const rendered = renderOverlay(FRAME_WIDTH, ANCHOR, [], {
      card: FACE_CARD,
      imageLibrary: library,
    });

    await rendered.rerender({ card: OTHER_FACE_CARD });

    expect(releaseFor(12_345)).toHaveBeenCalledTimes(1);
    expect(overlayImageSource(OTHER_FACE_CARD.id)).toBe("blob:test-54321");
  });

  it("releases the lease on destroy", () => {
    const { library, releaseFor } = fakeImageLibrary();
    const rendered = renderOverlay(FRAME_WIDTH, ANCHOR, [], {
      card: FACE_CARD,
      imageLibrary: library,
    });

    rendered.unmount();

    expect(releaseFor(12_345)).toHaveBeenCalledTimes(1);
  });
});
