import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __portraitTapTarget: string | null;
  }
}

/* T15: below the 1024px breakpoint a *portrait* viewport plays the duel on a
   stage turned a quarter turn clockwise, so the 16:9 board runs down the long
   axis of the phone instead of being squeezed across its short one. Landscape
   under the breakpoint, and every desktop size, keep the upright stage — those
   are pinned by `duel-smoke.spec.ts` and the acceptance matrix, so this file
   only ever asserts that they did *not* rotate.

   The rows that matter most are the pointer ones. A CSS `transform` is not
   enough on its own to call a rotated stage playable: what has to be true is
   that the pixel the player touches resolves to the element drawn under it. */

const PHONE = { width: 390, height: 844 } as const;
const PHONE_LANDSCAPE = { width: 844, height: 390 } as const;

async function startPresetDuel(page: Page): Promise<void> {
  const start = page.locator('[data-cy="deck-picker-start-button"]');
  await expect(start).toBeEnabled({ timeout: 120_000 });
  await start.click();
}

/** The element the browser resolves at a viewport point, described by the
    nearest identity the field contract exposes. This is the hit test the
    player performs with a finger. */
async function identityAtPoint(
  page: Page,
  x: number,
  y: number,
): Promise<{
  zoneId: string | null;
  dataCy: string | null;
  boxHoldsPoint: boolean;
}> {
  return await page.evaluate(
    ([pointX, pointY]) => {
      const element = document.elementFromPoint(pointX, pointY);
      const rect = element?.getBoundingClientRect() ?? null;
      return {
        zoneId:
          element?.closest("[data-zone-id]")?.getAttribute("data-zone-id") ??
          null,
        dataCy: element?.closest("[data-cy]")?.getAttribute("data-cy") ?? null,
        /* `getBoundingClientRect` is rotation-aware, so this is the literal
           claim under test: whatever the browser targeted is drawn under the
           point, not at its pre-rotation position. */
        boxHoldsPoint:
          rect !== null &&
          pointX >= rect.left - 0.5 &&
          pointX <= rect.right + 0.5 &&
          pointY >= rect.top - 0.5 &&
          pointY <= rect.bottom + 0.5,
      };
    },
    [x, y] as const,
  );
}

test("a portrait phone turns the duel stage a quarter turn and never scrolls the page", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("./#/duel");

  const stage = page.locator('[data-cy="app-stage"]');
  await expect(stage).toHaveAttribute("data-stage-rotated", "true");
  await expect(stage).toHaveAttribute("data-stage-mode", "mobile-portrait");

  const region = page.locator('[data-cy="shell-region-duel"]');
  const box = await region.boundingBox();
  if (box === null) throw new Error("Duel region has no bounding box");

  // On screen the board is taller than it is wide, and it is the 16:9 box
  // turned on its side rather than a stretched one.
  expect(box.height).toBeGreaterThan(box.width);
  expect(box.height / box.width).toBeCloseTo(16 / 9, 1);
  expect(box.width).toBeLessThanOrEqual(PHONE.width + 1);
  expect(box.height).toBeLessThanOrEqual(PHONE.height + 1);
  // Centred, so neither end of the board is cropped by the viewport.
  expect(box.x + box.width / 2).toBeCloseTo(PHONE.width / 2, 0);
  expect(box.y + box.height / 2).toBeCloseTo(PHONE.height / 2, 0);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.innerHeight + 1);
});

test("a tap on the rotated board lands on the element drawn under it", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("./#/duel");
  await startPresetDuel(page);
  await expect(page.locator("[data-prompt-kind]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator('[data-cy="app-stage"]')).toHaveAttribute(
    "data-stage-rotated",
    "true",
  );

  // The one-time notice is a real overlay with a real button, so the sweep
  // below measures the board rather than the notice sitting on top of it.
  await page.locator('[data-cy="duel-rotation-dismiss"]').click();
  await expect(page.locator('[data-cy="duel-rotation-notice"]')).toHaveCount(0);

  /* Every zone the board draws: the point the player would aim at is the
     centre of the box the browser reports, and `elementFromPoint` there must
     come back with that same zone — or with a control the board paints on top
     of it, such as a deck/graveyard stack, which names the same zone. A
     rotation applied after hit testing would answer with a zone from the
     pre-rotation position instead — usually a different one, and never all of
     them. */
  const zoneIds = await page
    .locator('[data-cy="duel-field"] [data-zone-id]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-zone-id") ?? ""),
    );
  expect(zoneIds.length).toBeGreaterThan(10);

  let checkedZones = 0;
  let matchedZones = 0;
  let pressPoint: { zoneId: string; x: number; y: number } | null = null;
  for (const zoneId of zoneIds) {
    const zone = page.locator(`[data-zone-id="${zoneId}"]`);
    const zoneBox = await zone.boundingBox();
    if (zoneBox === null) continue;
    const x = zoneBox.x + zoneBox.width / 2;
    const y = zoneBox.y + zoneBox.height / 2;
    if (x < 0 || y < 0 || x > PHONE.width || y > PHONE.height) continue;
    const hit = await identityAtPoint(page, x, y);
    const where = `zone ${zoneId} at (${x}, ${y}) resolved to ${hit.dataCy ?? "nothing"}`;
    expect(hit.boxHoldsPoint, where).toBe(true);
    /* A few zones sit under a control the board paints across them (the
       end-turn button, a phase chip). Those are allowed to answer for the
       point — they do in landscape too. Answering with a *different* zone is
       the signature of hit testing that ignored the rotation, and is never
       allowed. */
    expect(
      hit.zoneId === null || hit.zoneId === zoneId,
      `${where}: a tap must never land on another zone`,
    ).toBe(true);
    if (hit.zoneId === zoneId || (hit.dataCy?.endsWith(zoneId) ?? false))
      matchedZones += 1;
    if (hit.zoneId === zoneId && pressPoint === null)
      pressPoint = { zoneId, x, y };
    checkedZones += 1;
  }
  expect(
    checkedZones,
    "the rotated board must place zones inside the viewport for this to prove anything",
  ).toBeGreaterThan(10);
  expect(
    matchedZones,
    "most zone centres must resolve to their own zone, not to an overlay",
  ).toBeGreaterThan(10);

  /* Geometry is only half of it: a real pointer press at one of those points
     must be *delivered* to the same zone. Recorded from the event's own target
     rather than from focus, because activating a control can legitimately move
     focus somewhere else. A zone is the target because, unlike a card, nothing
     is revealed over it by the hover that a mouse press necessarily performs
     first. */
  if (pressPoint === null)
    throw new Error("No zone resolved to itself, so nothing can be pressed");
  await page.evaluate(() => {
    window.__portraitTapTarget = null;
    document.addEventListener(
      "pointerdown",
      (event) => {
        window.__portraitTapTarget =
          (event.target as Element | null)
            ?.closest("[data-zone-id]")
            ?.getAttribute("data-zone-id") ?? null;
      },
      { once: true, capture: true },
    );
  });
  await page.mouse.click(pressPoint.x, pressPoint.y);
  expect(
    await page.evaluate(() => window.__portraitTapTarget),
    "a real press at a zone's visual centre must be delivered to that zone",
  ).toBe(pressPoint.zoneId);
});

test("the rotation notice explains the turn once and stays dismissed", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("./#/duel");

  const notice = page.locator('[data-cy="duel-rotation-notice"]');
  await expect(notice).toBeVisible();

  // It must not block play: only its own button answers the pointer.
  const noticeBox = await notice.boundingBox();
  if (noticeBox === null)
    throw new Error("Rotation notice has no bounding box");
  const hit = await identityAtPoint(
    page,
    noticeBox.x + 4,
    noticeBox.y + noticeBox.height / 2,
  );
  expect(hit.dataCy).not.toBe("duel-rotation-notice");

  await page.locator('[data-cy="duel-rotation-dismiss"]').click();
  await expect(notice).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-cy="app-stage"]')).toHaveAttribute(
    "data-stage-rotated",
    "true",
  );
  await expect(notice).toHaveCount(0);
});

test("reduced motion animates neither the stage nor the turn", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(PHONE);
  await page.goto("./#/duel");
  await expect(page.locator('[data-cy="app-stage"]')).toHaveAttribute(
    "data-stage-rotated",
    "true",
  );

  const motion = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (element === null) return null;
      const style = getComputedStyle(element);
      return {
        transitionDuration: style.transitionDuration,
        animationName: style.animationName,
      };
    };
    return {
      stage: read('[data-cy="app-stage"]'),
      region: read('[data-cy="shell-region-duel"]'),
      notice: read('[data-cy="duel-rotation-notice"]'),
    };
  });
  /* Under its reduced-motion emulation Chromium reports a 1e-05s floor rather
     than a flat 0s, so this asks for "nothing a player could perceive" rather
     than for an exact string. */
  expect(
    Number.parseFloat(motion.stage?.transitionDuration ?? "1"),
  ).toBeLessThan(0.01);
  expect(
    Number.parseFloat(motion.region?.transitionDuration ?? "1"),
  ).toBeLessThan(0.01);
  expect(motion.notice?.animationName).toBe("none");
});

test("a landscape phone below the breakpoint keeps the upright stage", async ({
  page,
}) => {
  await page.setViewportSize(PHONE_LANDSCAPE);
  await page.goto("./#/duel");

  const stage = page.locator('[data-cy="app-stage"]');
  await expect(stage).toHaveAttribute("data-stage-mode", "mobile-landscape");
  expect(await stage.getAttribute("data-stage-rotated")).toBeNull();

  const transform = await page
    .locator('[data-cy="shell-region-duel"]')
    .evaluate((element) => getComputedStyle(element).transform);
  expect(transform).toBe("none");

  const box = await page.locator('[data-cy="shell-region-duel"]').boundingBox();
  if (box === null) throw new Error("Duel region has no bounding box");
  expect(box.width).toBeGreaterThan(box.height);

  await expect(page.locator('[data-cy="duel-rotation-notice"]')).toHaveCount(0);
});
