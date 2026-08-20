// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import HandZoomOverlay from "../../src/battle/app/components/duel-field/HandZoomOverlay.svelte";
import {
  cardInstanceId,
  choiceId,
} from "../../src/battle/duel/contracts/ids.ts";
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
) {
  return render(HandZoomOverlay, {
    props: {
      card: CARD,
      anchor,
      frameWidth,
      choices,
      imageUrl: "/back.webp",
    },
  });
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
