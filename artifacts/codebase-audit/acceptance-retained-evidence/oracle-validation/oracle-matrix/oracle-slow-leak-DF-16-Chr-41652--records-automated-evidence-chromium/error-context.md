# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: oracle-slow-leak.spec.ts >> DF-16 Chromium pinned parity/perf/resource gate records automated evidence
- Location: e2e/oracle-slow-leak.spec.ts:4971:1

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.click: Test timeout of 180000ms exceeded.
Call log:
  - waiting for locator('[data-cy="duel-right-rail-options"]')
    - locator resolved to <button type="button" aria-label="Options" data-cy="duel-right-rail-options" class="secondary duel-right-rail__options">⚙</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e6]:
    - paragraph [ref=e7]
    - generic [ref=e8]:
      - complementary "Card preview" [ref=e9]:
        - img "La Jinn the Mystical Genie of the Lamp" [ref=e11]
        - generic [ref=e12]:
          - heading "La Jinn the Mystical Genie of the Lamp" [level=2] [ref=e13]
          - paragraph [ref=e14]: DARK · Fiend · Level 4 · ATK 1800 / DEF 1000
          - region "Card effect text" [ref=e16]: A genie of the lamp that is at the beck and call of its master.
      - generic [ref=e17]:
        - group "Duel phases" [ref=e18]:
          - group "Your phases" [ref=e19]:
            - generic "Draw phase": Draw
            - generic "Standby phase": Standby
            - generic "Main 1 phase, current": Main 1
            - generic "Battle phase": Battle
            - generic "Main 2 phase": Main 2
          - group "Opponent phases" [ref=e20]:
            - generic "Draw phase": Draw
            - generic "Standby phase": Standby
            - generic "Main 1 phase": Main 1
            - generic "Battle phase": Battle
            - generic "Main 2 phase": Main 2
            - generic "End phase": End
        - region "Duel field" [ref=e22]:
          - group "Standard duel board" [ref=e25]:
            - generic [ref=e26]: Use Arrow keys to move between field controls. Home and End move to row edges. Enter or Space activates a legal control.
            - generic:
              - generic:
                - group "Your Monster Zone 1" [active] [ref=e27]:
                  - generic [ref=e28]: Monster Zone 1
                - group "Your Spell and Trap Zone 1" [ref=e29]:
                  - generic [ref=e30]: Spell/Trap Zone 1
                - group "Your Monster Zone 2" [ref=e31]:
                  - generic [ref=e32]: Monster Zone 2
                - group "Your Spell and Trap Zone 2" [ref=e33]:
                  - generic [ref=e34]: Spell/Trap Zone 2
                - group "Your Monster Zone 3" [ref=e35]:
                  - generic [ref=e36]: Monster Zone 3
                - group "Your Spell and Trap Zone 3" [ref=e37]:
                  - generic [ref=e38]: Spell/Trap Zone 3
                - group "Your Monster Zone 4" [ref=e39]:
                  - generic [ref=e40]: Monster Zone 4
                - group "Your Spell and Trap Zone 4" [ref=e41]:
                  - generic [ref=e42]: Spell/Trap Zone 4
                - group "Your Monster Zone 5" [ref=e43]:
                  - generic [ref=e44]: Monster Zone 5
                - group "Your Spell and Trap Zone 5" [ref=e45]:
                  - generic [ref=e46]: Spell/Trap Zone 5
                - group "Your Field Zone" [ref=e47]:
                  - generic [ref=e48]: Field Zone
                - group "Your Deck" [ref=e49]:
                  - generic [ref=e50]: Deck
                - group "Your Extra Deck" [ref=e51]:
                  - generic [ref=e52]: Extra Deck
                - group "Your Graveyard" [ref=e53]:
                  - generic [ref=e54]: GY
                - group "Your Banished" [ref=e55]:
                  - generic [ref=e56]: Banished
                - group "Opponent Monster Zone 1" [ref=e57]:
                  - generic [ref=e58]: Monster Zone 1
                - group "Opponent Spell and Trap Zone 1" [ref=e59]:
                  - generic [ref=e60]: Spell/Trap Zone 1
                - group "Opponent Monster Zone 2" [ref=e61]:
                  - generic [ref=e62]: Monster Zone 2
                - group "Opponent Spell and Trap Zone 2" [ref=e63]:
                  - generic [ref=e64]: Spell/Trap Zone 2
                - group "Opponent Monster Zone 3" [ref=e65]:
                  - generic [ref=e66]: Monster Zone 3
                - group "Opponent Spell and Trap Zone 3" [ref=e67]:
                  - generic [ref=e68]: Spell/Trap Zone 3
                - group "Opponent Monster Zone 4" [ref=e69]:
                  - generic [ref=e70]: Monster Zone 4
                - group "Opponent Spell and Trap Zone 4" [ref=e71]:
                  - generic [ref=e72]: Spell/Trap Zone 4
                - group "Opponent Monster Zone 5" [ref=e73]:
                  - generic [ref=e74]: Monster Zone 5
                - group "Opponent Spell and Trap Zone 5" [ref=e75]:
                  - generic [ref=e76]: Spell/Trap Zone 5
                - group "Opponent Field Zone" [ref=e77]:
                  - generic [ref=e78]: Field Zone
                - group "Opponent Deck" [ref=e79]:
                  - generic [ref=e80]: Deck
                - group "Opponent Extra Deck" [ref=e81]:
                  - generic [ref=e82]: Extra Deck
                - group "Opponent Graveyard" [ref=e83]:
                  - generic [ref=e84]: GY
                - group "Opponent Banished" [ref=e85]:
                  - generic [ref=e86]: Banished
                - group "Your Hand" [ref=e87]:
                  - generic [ref=e88]:
                    - article "Fissure in Your Hand" [ref=e89]:
                      - img "Fissure in Your Hand" [ref=e91]
                      - generic [ref=e92]: Fissure in Your Hand
                      - button "Legal action, Open actions for Fissure in Your Hand" [ref=e93] [cursor=pointer]
                    - article "La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e94]:
                      - img "La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e96]
                      - generic [ref=e97]: La Jinn the Mystical Genie of the Lamp in Your Hand
                      - button "Legal action, Open actions for La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e98] [cursor=pointer]
                    - article "Dark Magician in Your Hand" [ref=e99]:
                      - img "Dark Magician in Your Hand" [ref=e101]
                      - generic [ref=e102]: Dark Magician in Your Hand
                    - article "Giant Soldier of Stone in Your Hand" [ref=e103]:
                      - img "Giant Soldier of Stone in Your Hand" [ref=e105]
                      - generic [ref=e106]: Giant Soldier of Stone in Your Hand
                      - button "Legal action, Open actions for Giant Soldier of Stone in Your Hand" [ref=e107] [cursor=pointer]
                    - article "7 Colored Fish in Your Hand" [ref=e108]:
                      - img "7 Colored Fish in Your Hand" [ref=e110]
                      - generic [ref=e111]: 7 Colored Fish in Your Hand
                      - button "Legal action, Open actions for 7 Colored Fish in Your Hand" [ref=e112] [cursor=pointer]
                - group "Opponent Hand" [ref=e113]:
                  - generic [ref=e114]:
                    - article "Hidden opponent hand card" [ref=e115]:
                      - img [ref=e117]
                    - article "Hidden opponent hand card" [ref=e118]:
                      - img [ref=e120]
                    - article "Hidden opponent hand card" [ref=e121]:
                      - img [ref=e123]
                    - article "Hidden opponent hand card" [ref=e124]:
                      - img [ref=e126]
                    - article "Hidden opponent hand card" [ref=e127]:
                      - img [ref=e129]
                - button "Your Deck, 35 cards" [ref=e130] [cursor=pointer]:
                  - img [ref=e132]
                  - generic [ref=e133]: deck
                  - strong [ref=e134]: "35"
                - group "Your Extra Deck, 0 cards" [ref=e135]:
                  - generic [ref=e136]: extra
                  - strong [ref=e137]: "0"
                - group "Your Graveyard, 0 cards" [ref=e138]:
                  - generic [ref=e139]: GY
                  - strong [ref=e140]: "0"
                - group "Your Banished, 0 cards" [ref=e141]:
                  - generic [ref=e142]: banished
                  - strong [ref=e143]: "0"
                - button "Opponent Deck, 35 cards" [ref=e144] [cursor=pointer]:
                  - img [ref=e146]
                  - generic [ref=e147]: deck
                  - strong [ref=e148]: "35"
                - group "Opponent Extra Deck, 0 cards" [ref=e149]:
                  - generic [ref=e150]: extra
                  - strong [ref=e151]: "0"
                - group "Opponent Graveyard, 0 cards" [ref=e152]:
                  - generic [ref=e153]: GY
                  - strong [ref=e154]: "0"
                - group "Opponent Banished, 0 cards" [ref=e155]:
                  - generic [ref=e156]: banished
                  - strong [ref=e157]: "0"
          - button "End turn" [ref=e158] [cursor=pointer]
          - generic [ref=e159]:
            - checkbox "Full Control" [ref=e160]
            - status
      - complementary "Duel status" [ref=e161]:
        - generic [ref=e163]:
          - strong [ref=e164]: Turn 36 · Main 1
          - button "Options" [ref=e165] [cursor=pointer]: ⚙
        - generic [ref=e166]:
          - img [ref=e167]
          - paragraph [ref=e168]: LP 8000
        - generic [ref=e169]:
          - heading "Choose a Main Phase action" [level=2] [ref=e170]
          - paragraph [ref=e171]: Choose in the active prompt.
        - generic [ref=e172]:
          - paragraph [ref=e173]: LP 8000
          - img [ref=e174]
    - region "Duel HUD" [ref=e175]:
      - generic [ref=e176]:
        - generic [ref=e177]:
          - paragraph [ref=e178]: Turn 36
          - heading "Your turn" [level=2] [ref=e179]
        - paragraph [ref=e180]: main 1
      - generic [ref=e181]:
        - article "Your state" [ref=e182]:
          - generic [ref=e183]:
            - heading "You" [level=3] [ref=e184]
            - strong [ref=e185]: 8,000 LP
          - generic [ref=e186]:
            - generic [ref=e187]:
              - term [ref=e188]: Deck
              - definition [ref=e189]: "35"
            - generic [ref=e190]:
              - term [ref=e191]: Extra
              - definition [ref=e192]: "0"
            - generic [ref=e193]:
              - term [ref=e194]: Hand
              - definition [ref=e195]: "5"
          - generic [ref=e196]:
            - region "Your Deck, 35 cards" [ref=e197]:
              - generic [ref=e198]:
                - strong [ref=e199]: Your Deck
                - generic [ref=e200]: "35"
              - generic [ref=e201]: Count only
            - region "Your Extra Deck, 0 cards" [ref=e202]:
              - generic [ref=e203]:
                - strong [ref=e204]: Your Extra Deck
                - generic [ref=e205]: "0"
              - generic [ref=e206]: Count only
            - region "Your GY, 0 cards" [ref=e207]:
              - generic [ref=e208]:
                - strong [ref=e209]: Your GY
                - generic [ref=e210]: "0"
              - generic [ref=e211]: Count only
            - region "Your Banished, 0 cards" [ref=e212]:
              - generic [ref=e213]:
                - strong [ref=e214]: Your Banished
                - generic [ref=e215]: "0"
              - generic [ref=e216]: Count only
        - article "Opponent state" [ref=e217]:
          - generic [ref=e218]:
            - heading "Opponent" [level=3] [ref=e219]
            - strong [ref=e220]: 8,000 LP
          - generic [ref=e221]:
            - generic [ref=e222]:
              - term [ref=e223]: Deck
              - definition [ref=e224]: "35"
            - generic [ref=e225]:
              - term [ref=e226]: Extra
              - definition [ref=e227]: "0"
            - generic [ref=e228]:
              - term [ref=e229]: Hand
              - definition [ref=e230]: "5"
          - generic [ref=e231]:
            - region "Opponent Deck, 35 cards" [ref=e232]:
              - generic [ref=e233]:
                - strong [ref=e234]: Opponent Deck
                - generic [ref=e235]: "35"
              - generic [ref=e236]: Count only
            - region "Opponent Extra Deck, 0 cards" [ref=e237]:
              - generic [ref=e238]:
                - strong [ref=e239]: Opponent Extra Deck
                - generic [ref=e240]: "0"
              - generic [ref=e241]: Count only
            - region "Opponent GY, 0 cards" [ref=e242]:
              - generic [ref=e243]:
                - strong [ref=e244]: Opponent GY
                - generic [ref=e245]: "0"
              - generic [ref=e246]: Count only
            - region "Opponent Banished, 0 cards" [ref=e247]:
              - generic [ref=e248]:
                - strong [ref=e249]: Opponent Banished
                - generic [ref=e250]: "0"
              - generic [ref=e251]: Count only
      - region "Public and owned card state" [ref=e252]:
        - heading "Public and owned card state" [level=3] [ref=e253]
        - list [ref=e254]:
          - listitem [ref=e255]:
            - button "Inspect Fissure" [ref=e256] [cursor=pointer]: Fissure
            - text: face down attack
          - listitem [ref=e257]:
            - button "Inspect La Jinn the Mystical Genie of the Lamp" [ref=e258] [cursor=pointer]: La Jinn the Mystical Genie of the Lamp
            - text: face down attack
          - listitem [ref=e259]:
            - button "Inspect Dark Magician" [ref=e260] [cursor=pointer]: Dark Magician
            - text: face down attack
          - listitem [ref=e261]:
            - button "Inspect Giant Soldier of Stone" [ref=e262] [cursor=pointer]: Giant Soldier of Stone
            - text: face down attack
          - listitem [ref=e263]:
            - button "Inspect 7 Colored Fish" [ref=e264] [cursor=pointer]: 7 Colored Fish
            - text: face down attack
      - region "Active chain" [ref=e265]:
        - generic [ref=e266]:
          - heading "Active chain" [level=3] [ref=e267]
          - generic [ref=e268]: "0"
        - paragraph [ref=e269]: No chain is resolving.
  - region "Notifications"
```

# Test source

```ts
  6434 |     ({ name }) => name === "JSHeapUsedSize",
  6435 |   )?.value;
  6436 |   const capture = await page.evaluate(() => {
  6437 |     const activeUrls = [...window.__duelCapture.imageUrls.active].sort();
  6438 |     const mountedUrls = [
  6439 |       ...new Set(
  6440 |         [...document.querySelectorAll<HTMLImageElement>("img")]
  6441 |           .map((image) => image.currentSrc || image.src)
  6442 |           .filter((src) => src.startsWith("blob:")),
  6443 |       ),
  6444 |     ].sort();
  6445 |     return {
  6446 |       objectUrls: {
  6447 |         active: activeUrls.length,
  6448 |         created: window.__duelCapture.imageUrls.created.length,
  6449 |         revoked: window.__duelCapture.imageUrls.revoked.length,
  6450 |         activeUrls,
  6451 |         mountedUrls,
  6452 |         activeMatchesMounted:
  6453 |           activeUrls.length === mountedUrls.length &&
  6454 |           activeUrls.every((url, index) => url === mountedUrls[index]),
  6455 |       },
  6456 |       listeners: {
  6457 |         active:
  6458 |           window.__duelCapture.listeners.added -
  6459 |           window.__duelCapture.listeners.removed,
  6460 |         added: window.__duelCapture.listeners.added,
  6461 |         removed: window.__duelCapture.listeners.removed,
  6462 |       },
  6463 |     };
  6464 |   });
  6465 |   return {
  6466 |     heapUsedBytes: heapUsed ?? null,
  6467 |     objectUrls: capture.objectUrls,
  6468 |     listeners: capture.listeners,
  6469 |   };
  6470 | }
  6471 | 
  6472 | function publicResourceSnapshot(
  6473 |   snapshot: Awaited<ReturnType<typeof browserResourceSnapshot>>,
  6474 | ): {
  6475 |   readonly heapUsedBytes: number | null;
  6476 |   readonly objectUrls: {
  6477 |     readonly active: number;
  6478 |     readonly created: number;
  6479 |     readonly revoked: number;
  6480 |     readonly mounted: number;
  6481 |     readonly activeMatchesMounted: boolean;
  6482 |   };
  6483 |   readonly listeners: {
  6484 |     readonly active: number;
  6485 |     readonly added: number;
  6486 |     readonly removed: number;
  6487 |   };
  6488 | } {
  6489 |   return {
  6490 |     heapUsedBytes: snapshot.heapUsedBytes,
  6491 |     objectUrls: {
  6492 |       active: snapshot.objectUrls.active,
  6493 |       created: snapshot.objectUrls.created,
  6494 |       revoked: snapshot.objectUrls.revoked,
  6495 |       mounted: snapshot.objectUrls.mountedUrls.length,
  6496 |       activeMatchesMounted: snapshot.objectUrls.activeMatchesMounted,
  6497 |     },
  6498 |     listeners: snapshot.listeners,
  6499 |   };
  6500 | }
  6501 | 
  6502 | async function openSettingsDialog(page: Page): Promise<void> {
  6503 |   await page.locator('[data-cy="duel-right-rail-options"]').click();
  6504 |   await page.locator('[data-cy="menu-dialog-settings-button"]').click();
  6505 | }
  6506 | 
  6507 | async function enableDuelHud(page: Page): Promise<void> {
  6508 |   await openSettingsDialog(page);
  6509 |   await page.locator('[data-cy="settings-show-duel-hud-checkbox"]').check();
  6510 |   await page.locator('[data-cy="settings-dialog-close-button"]').click();
  6511 | }
  6512 | 
  6513 | async function disableAutoResolveTrivialPrompts(page: Page): Promise<void> {
  6514 |   await openSettingsDialog(page);
  6515 |   await page.locator('[data-cy="settings-auto-resolve-checkbox"]').uncheck();
  6516 |   await page.locator('[data-cy="settings-dialog-close-button"]').click();
  6517 | }
  6518 | 
  6519 | async function disableAutoPlaceCards(page: Page): Promise<void> {
  6520 |   await openSettingsDialog(page);
  6521 |   await page
  6522 |     .locator('[data-cy="settings-auto-place-cards-checkbox"]')
  6523 |     .uncheck();
  6524 |   await page.locator('[data-cy="settings-dialog-close-button"]').click();
  6525 | }
  6526 | 
  6527 | async function enableWorkspace(page: Page): Promise<void> {
  6528 |   await openSettingsDialog(page);
  6529 |   await page.locator('[data-cy="settings-show-workspace-checkbox"]').check();
  6530 |   await page.locator('[data-cy="settings-dialog-close-button"]').click();
  6531 | }
  6532 | 
  6533 | async function surrenderThroughMenu(page: Page): Promise<void> {
> 6534 |   await page.locator('[data-cy="duel-right-rail-options"]').click();
       |                                                             ^ Error: locator.click: Test timeout of 180000ms exceeded.
  6535 |   await page.locator('[data-cy="menu-dialog-surrender-button"]').click();
  6536 |   await page
  6537 |     .locator('[data-cy="menu-dialog-surrender-confirm-button"]')
  6538 |     .click();
  6539 | }
  6540 | 
  6541 | async function runTrayCycle(page: Page, cycles: number): Promise<void> {
  6542 |   for (let cycle = 0; cycle < cycles; cycle += 1) {
  6543 |     const trayButton = page
  6544 |       .getByRole("button", { name: /Open Your (Extra Deck|GY|Banished) tray/ })
  6545 |       .first();
  6546 |     if ((await trayButton.count()) === 0) return;
  6547 |     await trayButton.click();
  6548 |     const tray = page.getByRole("region", {
  6549 |       name: /Your (Extra Deck|GY|Banished) tray/,
  6550 |     });
  6551 |     await expect(tray).toBeVisible();
  6552 |     await tray.getByRole("button", { name: /^Close / }).click();
  6553 |     await expect(tray).toHaveCount(0);
  6554 |   }
  6555 | }
  6556 | 
  6557 | async function runRestartCycle(page: Page): Promise<void> {
  6558 |   await surrenderThroughMenu(page);
  6559 |   await expect(
  6560 |     page.getByRole("heading", { name: "Duel surrendered" }),
  6561 |   ).toBeVisible();
  6562 |   await page.getByRole("button", { name: "Start another duel" }).click();
  6563 |   await expect(page.locator("[data-prompt-kind]")).toBeVisible({
  6564 |     timeout: 120_000,
  6565 |   });
  6566 | }
  6567 | 
  6568 | async function mountedImageLeaseState(page: Page): Promise<{
  6569 |   readonly activeCount: number;
  6570 |   readonly activeMatchesMounted: boolean;
  6571 |   readonly activeUrls: readonly string[];
  6572 |   readonly mountedUrls: readonly string[];
  6573 | }> {
  6574 |   return page.evaluate(() => {
  6575 |     const activeUrls = [...window.__duelCapture.imageUrls.active].sort();
  6576 |     const mountedUrls = [
  6577 |       ...new Set(
  6578 |         [...document.querySelectorAll<HTMLImageElement>("img")]
  6579 |           .map((image) => image.currentSrc || image.src)
  6580 |           .filter((url) => url.startsWith("blob:")),
  6581 |       ),
  6582 |     ].sort();
  6583 |     return {
  6584 |       activeCount: activeUrls.length,
  6585 |       activeMatchesMounted:
  6586 |         activeUrls.length === mountedUrls.length &&
  6587 |         activeUrls.every((url, index) => url === mountedUrls[index]),
  6588 |       activeUrls,
  6589 |       mountedUrls,
  6590 |     };
  6591 |   });
  6592 | }
  6593 | 
  6594 | async function readCapture(page: Page): Promise<BrowserCapture> {
  6595 |   return page.evaluate(
  6596 |     () =>
  6597 |       (
  6598 |         window as unknown as Window & {
  6599 |           readonly __duelCapture: BrowserCapture;
  6600 |         }
  6601 |       ).__duelCapture,
  6602 |   );
  6603 | }
  6604 | 
  6605 | /* The capture holds every engine message of the duel so far, and a full duel
  6606 |    is hundreds of prompts long: by prompt 190 the whole log was 2.6 MB and one
  6607 |    `readCapture` cost ~0.8 s. A walker that polls it on every step therefore
  6608 |    costs time quadratic in its own length — measured at 4.9 s per step near
  6609 |    the end of a 191-prompt duel against 0.2 s at the start, which is what put
  6610 |    the walk past its ten-minute budget. These two answer the single question
  6611 |    each poll actually asks, inside the page, so a poll ships a string or a
  6612 |    number instead of the transcript. The questions are unchanged. */
  6613 | async function readLatestPromptId(page: Page): Promise<string | undefined> {
  6614 |   return page.evaluate(() => {
  6615 |     const events = window.__duelCapture.events;
  6616 |     for (let index = events.length - 1; index >= 0; index -= 1) {
  6617 |       const event = events[index] as { readonly type?: unknown } & Readonly<
  6618 |         Record<string, unknown>
  6619 |       >;
  6620 |       if (event.type === "prompt")
  6621 |         return (event as unknown as CapturedPromptEvent).prompt.id;
  6622 |     }
  6623 |     return undefined;
  6624 |   });
  6625 | }
  6626 | 
  6627 | async function countResponsesTo(page: Page, promptId: string): Promise<number> {
  6628 |   return page.evaluate(
  6629 |     (id) =>
  6630 |       window.__duelCapture.commands.filter(
  6631 |         (command) => command.type === "respond" && command.promptId === id,
  6632 |       ).length,
  6633 |     promptId,
  6634 |   );
```