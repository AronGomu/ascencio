import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global styles", () => {
  it("declares a global .visually-hidden clip utility", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toContain(".visually-hidden");
    expect(css).toContain("clip: rect(0 0 0 0)");
  });

  it("keeps acceptance-only field sizing out of the production stylesheet", () => {
    const productionCss = readFileSync("src/styles/app.css", "utf8");
    const acceptanceCss = readFileSync("src/styles/acceptance.css", "utf8");
    const acceptanceEntry = readFileSync("src/acceptance-main.ts", "utf8");
    expect(productionCss).not.toContain(".acceptance-card-list-field");
    expect(acceptanceCss).toContain(".acceptance-card-list-field");
    expect(acceptanceEntry).toContain('import "./styles/acceptance.css"');
  });

  it("duel field does not contain overscroll", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = duelFieldBlock(css);
    expect(block).not.toContain("overscroll-behavior: contain");
    expect(block).not.toContain("overflow: auto");
  });

  it("duel field is not height-capped on small screens", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).not.toContain("max-height: calc(100svh - 1rem)");
  });

  it("uses one full-height three-column shell", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const shell = ruleBlock(css, ".duel-shell {");
    expect(shell).toContain("height: 100svh");
    expect(shell).toContain(
      "grid-template-columns: var(--preview-w) auto minmax(var(--rail-min), 1fr)",
    );
    expect(shell).toContain("grid-template-rows: minmax(0, 1fr)");
    expect(shell).toContain("overflow: hidden");
    expect(css).toContain("--preview-w: 22rem");
    expect(css).toContain("--rail-min: 15rem");
  });

  it("bounds preview art by viewport height so effect text keeps scroll space", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const art = ruleBlock(css, ".card-preview-panel__art img {");
    expect(art).toContain("max-height: min(22rem, 60svh)");
    expect(art).toContain("object-fit: contain");
  });

  it("board is explicit geometry without width-only stretch", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(css, ".duel-field-board {");
    expect(block).toContain("width: 100%");
    expect(block).toContain("height: 100%");
    expect(block).not.toContain("aspect-ratio");
  });

  it("board uses explicit geometry while interaction controls keep 44px floors", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(ruleBlock(css, ".duel-field-board {")).toContain("height: 100%");
    expect(ruleBlock(css, ".duel-field-card__target {")).toContain(
      "min-width: max(100%, 2.75rem)",
    );
    expect(ruleBlock(css, ".duel-field-scroll-region {")).toContain(
      "overflow: hidden",
    );
  });

  it("the duel field root never scrolls, so windows cannot be panned away", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = duelFieldBlock(css);
    expect(block).toContain("overflow: hidden");
    expect(block).toContain("position: relative");
  });

  it("declares concentric px zone slots six pixels wider than cards", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const slot = ruleBlock(css, ".duel-field-zone__slot {");
    expect(slot).toContain("+ 6px");
    expect(slot).toContain("translate(-50%, -50%)");
  });

  it("the actionable halo is green, not orange", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(
      css,
      ".duel-field-zone.is-actionable,\n.duel-field-card.is-actionable .duel-field-card__art {",
    );
    expect(block).toContain("var(--success)");
    expect(block).not.toContain("var(--warning)");
  });

  it("actionable stack and list halos are green too", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const stack = ruleBlock(css, ".duel-field-stack.is-actionable {");
    expect(stack).toContain("var(--success)");
    expect(stack).not.toContain("var(--warning)");
    const list = ruleBlock(css, ".zone-list-entry.is-actionable img {");
    expect(list).toContain("var(--success)");
    expect(list).not.toContain("var(--warning)");
  });

  it("selected halos are orange, overriding legal green", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const field = ruleBlock(
      css,
      ".duel-field-zone.is-selected,\n.duel-field-card.is-selected .duel-field-card__art {",
    );
    expect(field).toContain("var(--warning)");
    expect(field).not.toContain("var(--success)");
    const list = ruleBlock(css, ".zone-list-entry.is-selected img {");
    expect(list).toContain("var(--warning)");
    expect(list).not.toContain("var(--success)");
  });

  it("unavailable target halos stay red through hover and focus", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const unavailable = ruleBlock(
      css,
      ".zone-list-entry.is-unavailable:not(.is-selected) img,",
    );
    expect(unavailable).toContain(":hover img");
    expect(unavailable).toContain(":focus-within img");
    expect(unavailable).toContain("border-color: #ff455d");
    expect(unavailable).toContain("rgb(255 69 93 / 0.78)");
    expect(unavailable).not.toContain("var(--warning)");
  });

  it("drop candidate is green with a translucent fill, distinct from plain legal", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(css, ".duel-field-zone.is-drop-candidate {");
    expect(block).toContain("border-color: var(--success)");
    expect(block).toMatch(/background: rgb\(126 226 168 \/ 0\.\d+\)/);
    expect(block).toContain("box-shadow");
  });

  it("keyboard focus is a neutral outline, independent of legal/selected colours", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(
      css,
      ".duel-field-zone.is-navigation-active:focus-visible,",
    );
    expect(block).toContain("outline: 3px solid var(--ink)");
    expect(block).toContain("outline-offset: 2px");
    expect(block).not.toContain("var(--success)");
    expect(block).not.toContain("var(--warning)");
  });

  it("feedback target and default field line are teal; attack stays danger", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const target = ruleBlock(
      css,
      ".duel-field-card.is-feedback-target .duel-field-card__art,",
    );
    expect(target).toContain("var(--accent)");
    expect(target).not.toContain("var(--warning)");
    const line = ruleBlock(css, ".field-lines line {");
    expect(line).toContain("stroke: var(--accent)");
    const attackLine = ruleBlock(css, ".field-lines.is-attack line {");
    expect(attackLine).toContain("var(--danger)");
  });

  it("the action/phase badge at the opponent hand position (item 26) is gone from the stylesheet", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).not.toContain(".duel-field-feedback");
  });

  it("card entries hover-scale 1.35 and list interaction states scale 1.6", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const card = ruleBlock(
      css,
      ".duel-field-card {\n  z-index: var(--duel-field-layer-card);",
    );
    expect(card).toContain("transition: transform 120ms ease-out");
    const list = ruleBlock(css, ".zone-list-entry {");
    expect(list).toContain("transition: transform 120ms ease-out");
    const fieldHover = ruleBlock(
      css,
      ".duel-field-card:not(.is-hand-item):not(.is-pinned):is(:hover, :focus-within) {",
    );
    expect(fieldHover).toContain("scale(1.35)");
    const handHover = ruleBlock(
      css,
      ".duel-field-card.is-hand-item:not(.is-pinned):is(:hover, :focus-within) {",
    );
    expect(handHover).toContain("scale(1.35)");
    const listSelector =
      ".zone-list-entry:is(:hover, :focus-within, .is-selected, .is-menu-open) {";
    const listZoom = ruleBlock(
      css,
      listSelector,
      css.indexOf(listSelector) + listSelector.length,
    );
    expect(listZoom).toContain("scale(1.6)");
    expect(ruleBlock(css, ".zone-list-entry.is-hover-suppressed {")).toContain(
      "transform: none",
    );
  });

  it("hand item transform-origin is bottom for player, top for opponent; field origin is centre", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const card = ruleBlock(
      css,
      ".duel-field-card {\n  z-index: var(--duel-field-layer-card);",
    );
    expect(card).toContain("transform-origin: center");
    const handItem = ruleBlock(css, ".duel-field-card.is-hand-item {");
    expect(handItem).toContain("transform-origin: center bottom");
    const opponentHand = ruleBlock(
      css,
      ".duel-field-card.is-hand-item.is-opponent {",
    );
    expect(opponentHand).toContain("transform-origin: center top");
  });

  it("reduced motion disables card/list zoom transform and transition", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const blocks = [
      ...css.matchAll(
        /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/g,
      ),
    ].map((match) => match[0]);
    const zoomBlock = blocks.find((block) =>
      block.includes(".duel-field-card,"),
    );
    expect(zoomBlock).toBeDefined();
    expect(zoomBlock).toContain("transition: none");
    expect(zoomBlock).toContain("transform: none");
  });

  /* T16: a target answer button is the only control on a list entry in target
     mode, so it carries the field-wide 44px minimum itself. */
  it("off-field target buttons keep the 44px minimum and a single choice fills its tile", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const button = ruleBlock(css, ".zone-list-entry__target {");
    expect(button).toContain("min-width: 2.75rem");
    expect(button).toContain("min-height: 2.75rem");
    const single = ruleBlock(css, ".zone-list-entry__targets.is-single {");
    expect(single).toContain("inset: 0");
  });

  it("hovered/focused/pinned card parent rises above normal card/stack/zone siblings", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const block = ruleBlock(
      css,
      ".duel-field-card:is(:hover, :focus-within),\n.duel-field-card.is-pinned {",
    );
    expect(block).toContain("var(--duel-field-layer-card-raised)");
    expect(css).toContain("--duel-field-layer-card-raised: 35");
    expect(css).toContain("--duel-field-layer-card: 30");
  });

  /* jsdom loads no stylesheet, so no component test can observe `display`, and
     the e2e only ever reaches the chips through the pinned path. Without this
     row both reveal triggers could be deleted with the suite still green. */
  it("chips are hidden until hover, focus or a pin reveals them", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(ruleBlock(css, "\n.card-action-chips {")).toContain("display: none");
    const handChips = ruleBlock(
      css,
      ".duel-field-card.is-hand-item .card-action-chips {",
    );
    expect(handChips).toContain("top: calc(var(--field-height) * 0.26)");
    expect(handChips).toContain("bottom: auto");
    const reveal = ruleBlock(
      css,
      ".duel-field-card.is-actionable:hover .card-action-chips,\n.duel-field-card.is-actionable:focus-within .card-action-chips,\n.duel-field-card.is-pinned .card-action-chips {",
    );
    expect(reveal).toContain("display: flex");
  });

  // T8: both hands render through HandBand, which paints no border,
  // background or ZoneControl at all — there is no dashed hand-zone
  // treatment left to make transparent for the opponent specifically.
  it("hand band paints no border or background", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).not.toContain('.duel-field-zone[data-zone-kind="hand"]');
    expect(css).not.toContain('.duel-field-zone[data-zone-id="p1:hand"]');
    const block = ruleBlock(css, ".duel-field-hand-band {");
    expect(block).not.toContain("border");
    expect(block).not.toContain("background");
  });

  it("drag ghost is fixed, pointer-transparent and layered above field windows", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    expect(css).toContain("--duel-field-layer-drag-ghost: 150");
    const block = ruleBlock(css, ".drag-ghost {");
    expect(block).toContain("position: fixed");
    expect(block).toContain("pointer-events: none");
    expect(block).toContain("z-index: var(--duel-field-layer-drag-ghost)");
    expect(block).toContain("scale(var(--drag-ghost-lift-scale, 1.08))");
    expect(block).toContain("box-shadow");
  });

  it("reduced motion strips the drag ghost's lift transform", () => {
    const css = readFileSync("src/styles/app.css", "utf8");
    const reducedMotionBlockStart = css.indexOf(
      "@media (prefers-reduced-motion: reduce) {\n  .drag-ghost {",
    );
    expect(reducedMotionBlockStart).toBeGreaterThan(-1);
    const block = ruleBlock(css, ".drag-ghost {", reducedMotionBlockStart);
    expect(block).toContain(
      "transform: translate3d(var(--drag-ghost-x), var(--drag-ghost-y), 0)",
    );
    expect(block).not.toContain("scale(");
  });
});

function ruleBlock(css: string, selectorStart: string, fromIndex = 0): string {
  const start = css.indexOf(selectorStart, fromIndex);
  if (start === -1) throw new Error(`Selector not found: ${selectorStart}`);
  const end = css.indexOf("}", start);
  return css.slice(start, end + 1);
}

function duelFieldBlock(css: string): string {
  return ruleBlock(css, ".duel-field {");
}
