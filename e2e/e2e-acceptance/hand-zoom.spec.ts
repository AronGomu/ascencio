import { expect, test, type Page } from "@playwright/test";

/* Sequence 2 is the only hand card the zoom scenario gives choices to, so it is
   the only one whose overlay carries chips. */
async function openHandZoom(page: Page) {
  await page.goto("?scenario=field-hand-zoom");
  await expect(page.locator('[data-cy="acceptance-scenario"]')).toBeVisible();
  const handBand = page.locator('[data-cy="field-hand-band-p0"]');
  await expect(handBand).toBeVisible();
  const card = handBand.locator(".duel-field-card").nth(2);
  const box = await card.boundingBox();
  if (box === null) throw new Error("Missing hand card geometry");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("div.hand-zoom-overlay")).toBeVisible();
  return { card, box };
}

test("the zoomed hand card overflows the hand band and bottom-anchors its chips on it", async ({
  page,
}) => {
  await page.goto("?scenario=field-hand-zoom");
  await expect(page.locator('[data-cy="acceptance-scenario"]')).toBeVisible();

  const handBand = page.locator('[data-cy="field-hand-band-p0"]');
  await expect(handBand).toBeVisible();

  // 3rd card (sequence 2) is the one with choices; hover it
  const cards = handBand.locator(".duel-field-card");
  const thirdCard = cards.nth(2);
  // Card box read before the hover: the overlay is measured against the card at
  // rest, and reading it afterwards would race the mount.
  const cardBox = await thirdCard.boundingBox();
  expect(cardBox).not.toBeNull();
  // `force` skips the actionability re-check. The hover mounts an overlay over
  // the very card it was opened from, so that re-check can never settle: under
  // load it retried ~350 times and failed the test on a timeout rather than on
  // anything the test is about.
  await thirdCard.hover({ force: true });

  const overlay = page.locator("div.hand-zoom-overlay");
  await expect(overlay).toBeVisible();

  const overlayBox = await overlay.boundingBox();
  expect(overlayBox).not.toBeNull();

  const bandBox = await handBand.boundingBox();
  expect(bandBox).not.toBeNull();

  // Overlay must extend above the hand band top
  expect(overlayBox!.y).toBeLessThan(bandBox!.y);

  // Overlay height must be approximately card height × 1.6 (±10%)
  const expectedHeight = cardBox!.height * 1.6;
  expect(overlayBox!.height).toBeGreaterThan(expectedHeight * 0.9);
  expect(overlayBox!.height).toBeLessThan(expectedHeight * 1.1);

  /* 2026-08-27 item 2: chips are anchored on the zoomed card's bottom edge and
     grow upward, the same anchor a field card gives its own chips. They used
     to hang above the overlay's top edge, then were centred on it; the two
     hosts stay unified so hover and keyboard focus show one thing. */
  const chips = overlay.locator(
    '[data-cy^="hand-zoom-overlay-card-action-chips-"]',
  );
  await expect(chips).toBeVisible();
  const chipsBox = await chips.boundingBox();
  expect(chipsBox).not.toBeNull();
  expect(
    Math.abs(
      chipsBox!.y + chipsBox!.height - (overlayBox!.y + overlayBox!.height),
    ),
  ).toBeLessThanOrEqual(2);
  expect(chipsBox!.y).toBeGreaterThan(overlayBox!.y);
});

/* The overlay covers the card it was opened from. While it took pointer input
   there, a motionless pointer handed the hover back and forth between the two
   and the overlay mounted and unmounted every other frame. The hover assertion
   is that root cause; the mutation count is the symptom it produced. */
test("a motionless pointer leaves the overlay mounted, never strobing", async ({
  page,
}) => {
  const { card } = await openHandZoom(page);
  expect(
    await card.evaluate((element) => element.matches(":hover")),
    "the overlay took the hover away from the card underneath it",
  ).toBe(true);

  const churn = await page.evaluate(async () => {
    const field = document.querySelector('[data-cy="duel-field"]');
    if (field === null) return null;
    const first = document.querySelector("div.hand-zoom-overlay");
    let added = 0;
    let removed = 0;
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes)
          if (node instanceof Element && node.matches("div.hand-zoom-overlay"))
            added += 1;
        for (const node of record.removedNodes)
          if (node instanceof Element && node.matches("div.hand-zoom-overlay"))
            removed += 1;
      }
    });
    observer.observe(field, { childList: true, subtree: true });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    observer.disconnect();
    return {
      added,
      removed,
      same: document.querySelector("div.hand-zoom-overlay") === first,
    };
  });

  expect(churn, "missing duel field").not.toBeNull();
  expect(churn!.added, "overlay remounts under a still pointer").toBe(0);
  expect(churn!.removed, "overlay unmounts under a still pointer").toBe(0);
  expect(churn!.same, "overlay node survives a still pointer").toBe(true);
});

/* The overlay is presentation, with one deliberate exception: the chips it
   anchors on the zoomed card's bottom edge take the pointer, exactly as a field
   card's own chips do. Everything else it draws — the art above all — stays out
   of hit testing, so the card keeps its own press and drag on the part of
   itself the chips do not cover. */
test("the hand card under the overlay still takes the pointer", async ({
  page,
}) => {
  const { box } = await openHandZoom(page);
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  /* Above the bottom-anchored chip stack and still inside the card: this is the
     span a drag has to start from now that the chips grow upward from the
     card's bottom edge and own everything below their own top. Both edges are
     read live, so the probe follows the stack however tall it grows. */
  const chipsTop = await page
    .locator('[data-cy^="hand-zoom-overlay-card-action-chips-"]')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(
    chipsTop,
    "the chip stack covers the card to its top edge, leaving no span to press",
  ).toBeGreaterThan(box.y);
  const aboveChips = { x: centre.x, y: (box.y + chipsTop) / 2 };
  expect(aboveChips.y).toBeLessThan(box.y + box.height);

  const hit = await page.evaluate((point) => {
    const element = document.elementFromPoint(point.x, point.y);
    if (element === null)
      return { inCard: false, inOverlay: false, onChip: false };
    return {
      inCard: element.closest(".duel-field-card") !== null,
      inOverlay: element.closest("div.hand-zoom-overlay") !== null,
      onChip: element.closest(".card-action-chip") !== null,
    };
  }, aboveChips);
  expect(hit.inOverlay, "overlay art still hit-tests over the card").toBe(
    false,
  );
  expect(
    hit.inCard,
    "the card above the chips no longer takes the pointer",
  ).toBe(true);

  const centreHit = await page.evaluate((point) => {
    const element = document.elementFromPoint(point.x, point.y);
    return element !== null && element.closest(".card-action-chip") !== null;
  }, centre);
  expect(
    centreHit,
    "the chips over the card centre no longer take the pointer",
  ).toBe(true);

  await page.mouse.move(aboveChips.x, aboveChips.y);

  await page.evaluate(() => {
    (
      window as unknown as { __pointerDownInCard?: boolean }
    ).__pointerDownInCard = false;
    document.addEventListener(
      "pointerdown",
      (event) => {
        (
          window as unknown as { __pointerDownInCard?: boolean }
        ).__pointerDownInCard =
          event.target instanceof Element &&
          event.target.closest(".duel-field-card") !== null;
      },
      { capture: true, once: true },
    );
  });
  await page.mouse.down();
  await page.mouse.move(aboveChips.x + 40, aboveChips.y - 60, { steps: 6 });
  const pressedCard = await page.evaluate(
    () =>
      (window as unknown as { __pointerDownInCard?: boolean })
        .__pointerDownInCard === true,
  );
  await page.mouse.up();

  expect(pressedCard, "pointerdown landed on the overlay, not the card").toBe(
    true,
  );
});

test("the open overlay leaves every data-cy in the document unique", async ({
  page,
}) => {
  await openHandZoom(page);

  const duplicates = await page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const element of document.querySelectorAll("[data-cy]")) {
      const value = element.getAttribute("data-cy") ?? "";
      seen.set(value, (seen.get(value) ?? 0) + 1);
    }
    return [...seen].filter(([, count]) => count > 1).map(([value]) => value);
  });

  expect(duplicates).toEqual([]);
});
