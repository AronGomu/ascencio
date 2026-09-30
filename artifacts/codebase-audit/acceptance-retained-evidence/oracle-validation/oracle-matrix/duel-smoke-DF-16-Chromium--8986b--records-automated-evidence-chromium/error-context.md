# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: duel-smoke.spec.ts >> DF-16 Chromium pinned parity/perf/resource gate records automated evidence
- Location: e2e/duel-smoke.spec.ts:4965:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 50
Received:   127.5
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - main [ref=e6]:
    - paragraph [ref=e7]
    - generic [ref=e8]:
      - complementary "Card preview" [ref=e9]:
        - paragraph [ref=e10]: Hover a card to see its details.
      - generic [ref=e11]:
        - group "Duel phases" [ref=e12]:
          - group "Your phases" [ref=e13]:
            - generic "Draw phase": Draw
            - generic "Standby phase": Standby
            - generic "Main 1 phase, current": Main 1
            - generic "Battle phase": Battle
            - generic "Main 2 phase": Main 2
          - group "Opponent phases" [ref=e14]:
            - generic "Draw phase": Draw
            - generic "Standby phase": Standby
            - generic "Main 1 phase": Main 1
            - generic "Battle phase": Battle
            - generic "Main 2 phase": Main 2
            - generic "End phase": End
        - region "Duel field" [ref=e16]:
          - group "Standard duel board" [ref=e19]:
            - generic [ref=e20]: Use Arrow keys to move between field controls. Home and End move to row edges. Enter or Space activates a legal control.
            - generic:
              - generic:
                - group "Your Monster Zone 1" [ref=e21]:
                  - generic [ref=e22]: Monster Zone 1
                - group "Your Spell and Trap Zone 1" [ref=e23]:
                  - generic [ref=e24]: Spell/Trap Zone 1
                - group "Your Monster Zone 2" [ref=e25]:
                  - generic [ref=e26]: Monster Zone 2
                - group "Your Spell and Trap Zone 2" [ref=e27]:
                  - generic [ref=e28]: Spell/Trap Zone 2
                - group "Your Monster Zone 3" [ref=e29]:
                  - generic [ref=e30]: Monster Zone 3
                - group "Your Spell and Trap Zone 3" [ref=e31]:
                  - generic [ref=e32]: Spell/Trap Zone 3
                - group "Your Monster Zone 4" [ref=e33]:
                  - generic [ref=e34]: Monster Zone 4
                - group "Your Spell and Trap Zone 4" [ref=e35]:
                  - generic [ref=e36]: Spell/Trap Zone 4
                - group "Your Monster Zone 5" [ref=e37]:
                  - generic [ref=e38]: Monster Zone 5
                - group "Your Spell and Trap Zone 5" [ref=e39]:
                  - generic [ref=e40]: Spell/Trap Zone 5
                - group "Your Field Zone" [ref=e41]:
                  - generic [ref=e42]: Field Zone
                - group "Your Deck" [ref=e43]:
                  - generic [ref=e44]: Deck
                - group "Your Extra Deck" [ref=e45]:
                  - generic [ref=e46]: Extra Deck
                - group "Your Graveyard" [ref=e47]:
                  - generic [ref=e48]: GY
                - group "Your Banished" [ref=e49]:
                  - generic [ref=e50]: Banished
                - group "Opponent Monster Zone 1" [ref=e51]:
                  - generic [ref=e52]: Monster Zone 1
                - group "Opponent Spell and Trap Zone 1" [ref=e53]:
                  - generic [ref=e54]: Spell/Trap Zone 1
                - group "Opponent Monster Zone 2" [ref=e55]:
                  - generic [ref=e56]: Monster Zone 2
                - group "Opponent Spell and Trap Zone 2" [ref=e57]:
                  - generic [ref=e58]: Spell/Trap Zone 2
                - group "Opponent Monster Zone 3" [ref=e59]:
                  - generic [ref=e60]: Monster Zone 3
                - group "Opponent Spell and Trap Zone 3" [ref=e61]:
                  - generic [ref=e62]: Spell/Trap Zone 3
                - group "Opponent Monster Zone 4" [ref=e63]:
                  - generic [ref=e64]: Monster Zone 4
                - group "Opponent Spell and Trap Zone 4" [ref=e65]:
                  - generic [ref=e66]: Spell/Trap Zone 4
                - group "Opponent Monster Zone 5" [ref=e67]:
                  - generic [ref=e68]: Monster Zone 5
                - group "Opponent Spell and Trap Zone 5" [ref=e69]:
                  - generic [ref=e70]: Spell/Trap Zone 5
                - group "Opponent Field Zone" [ref=e71]:
                  - generic [ref=e72]: Field Zone
                - group "Opponent Deck" [ref=e73]:
                  - generic [ref=e74]: Deck
                - group "Opponent Extra Deck" [ref=e75]:
                  - generic [ref=e76]: Extra Deck
                - group "Opponent Graveyard" [ref=e77]:
                  - generic [ref=e78]: GY
                - group "Opponent Banished" [ref=e79]:
                  - generic [ref=e80]: Banished
                - group "Your Hand" [ref=e81]:
                  - generic [ref=e82]:
                    - article "Reinforcements in Your Hand" [ref=e83]:
                      - img "Reinforcements in Your Hand" [ref=e85]
                      - generic [ref=e86]: Reinforcements in Your Hand
                      - button "Legal action, Open actions for Reinforcements in Your Hand" [ref=e87] [cursor=pointer]
                    - article "Neo the Magic Swordsman in Your Hand" [ref=e88]:
                      - img "Neo the Magic Swordsman in Your Hand" [ref=e90]
                      - generic [ref=e91]: Neo the Magic Swordsman in Your Hand
                      - button "Legal action, Open actions for Neo the Magic Swordsman in Your Hand" [ref=e92] [cursor=pointer]
                    - article "Trap Hole in Your Hand" [ref=e93]:
                      - img "Trap Hole in Your Hand" [ref=e95]
                      - generic [ref=e96]: Trap Hole in Your Hand
                      - button "Legal action, Open actions for Trap Hole in Your Hand" [ref=e97] [cursor=pointer]
                    - article "Mystical Space Typhoon in Your Hand" [ref=e98]:
                      - img "Mystical Space Typhoon in Your Hand" [ref=e100]
                      - generic [ref=e101]: Mystical Space Typhoon in Your Hand
                      - button "Legal action, Open actions for Mystical Space Typhoon in Your Hand" [ref=e102] [cursor=pointer]
                    - article "Battle Ox in Your Hand" [ref=e103]:
                      - img "Battle Ox in Your Hand" [ref=e105]
                      - generic [ref=e106]: Battle Ox in Your Hand
                      - button "Legal action, Open actions for Battle Ox in Your Hand" [ref=e107] [cursor=pointer]
                - group "Opponent Hand" [ref=e108]:
                  - generic [ref=e109]:
                    - article "Hidden opponent hand card" [ref=e110]:
                      - img [ref=e112]
                    - article "Hidden opponent hand card" [ref=e113]:
                      - img [ref=e115]
                    - article "Hidden opponent hand card" [ref=e116]:
                      - img [ref=e118]
                    - article "Hidden opponent hand card" [ref=e119]:
                      - img [ref=e121]
                    - article "Hidden opponent hand card" [ref=e122]:
                      - img [ref=e124]
                - button "Your Deck, 35 cards" [ref=e125] [cursor=pointer]:
                  - img [ref=e127]
                  - generic [ref=e128]: deck
                  - strong [ref=e129]: "35"
                - group "Your Extra Deck, 0 cards" [ref=e130]:
                  - generic [ref=e131]: extra
                  - strong [ref=e132]: "0"
                - group "Your Graveyard, 0 cards" [ref=e133]:
                  - generic [ref=e134]: GY
                  - strong [ref=e135]: "0"
                - group "Your Banished, 0 cards" [ref=e136]:
                  - generic [ref=e137]: banished
                  - strong [ref=e138]: "0"
                - button "Opponent Deck, 35 cards" [ref=e139] [cursor=pointer]:
                  - img [ref=e141]
                  - generic [ref=e142]: deck
                  - strong [ref=e143]: "35"
                - group "Opponent Extra Deck, 0 cards" [ref=e144]:
                  - generic [ref=e145]: extra
                  - strong [ref=e146]: "0"
                - group "Opponent Graveyard, 0 cards" [ref=e147]:
                  - generic [ref=e148]: GY
                  - strong [ref=e149]: "0"
                - group "Opponent Banished, 0 cards" [ref=e150]:
                  - generic [ref=e151]: banished
                  - strong [ref=e152]: "0"
          - button "End turn" [ref=e153] [cursor=pointer]
          - generic [ref=e154]:
            - checkbox "Full Control" [ref=e155]
            - status
      - complementary "Duel status" [ref=e156]:
        - generic [ref=e158]:
          - strong [ref=e159]: Turn 1 · Main 1
          - button "Options" [ref=e160] [cursor=pointer]: ⚙
        - generic [ref=e161]:
          - img [ref=e162]
          - paragraph [ref=e163]: LP 8000
        - generic [ref=e164]:
          - heading "Choose a Main Phase action" [level=2] [ref=e165]
          - paragraph [ref=e166]: Choose in the active prompt.
        - generic [ref=e167]:
          - paragraph [ref=e168]: LP 8000
          - img [ref=e169]
    - region "Duel HUD" [ref=e170]:
      - generic [ref=e171]:
        - generic [ref=e172]:
          - paragraph [ref=e173]: Turn 1
          - heading "Your turn" [level=2] [ref=e174]
        - paragraph [ref=e175]: main 1
      - generic [ref=e176]:
        - article "Your state" [ref=e177]:
          - generic [ref=e178]:
            - heading "You" [level=3] [ref=e179]
            - strong [ref=e180]: 8,000 LP
          - generic [ref=e181]:
            - generic [ref=e182]:
              - term [ref=e183]: Deck
              - definition [ref=e184]: "35"
            - generic [ref=e185]:
              - term [ref=e186]: Extra
              - definition [ref=e187]: "0"
            - generic [ref=e188]:
              - term [ref=e189]: Hand
              - definition [ref=e190]: "5"
          - generic [ref=e191]:
            - region "Your Deck, 35 cards" [ref=e192]:
              - generic [ref=e193]:
                - strong [ref=e194]: Your Deck
                - generic [ref=e195]: "35"
              - generic [ref=e196]: Count only
            - region "Your Extra Deck, 0 cards" [ref=e197]:
              - generic [ref=e198]:
                - strong [ref=e199]: Your Extra Deck
                - generic [ref=e200]: "0"
              - generic [ref=e201]: Count only
            - region "Your GY, 0 cards" [ref=e202]:
              - generic [ref=e203]:
                - strong [ref=e204]: Your GY
                - generic [ref=e205]: "0"
              - generic [ref=e206]: Count only
            - region "Your Banished, 0 cards" [ref=e207]:
              - generic [ref=e208]:
                - strong [ref=e209]: Your Banished
                - generic [ref=e210]: "0"
              - generic [ref=e211]: Count only
        - article "Opponent state" [ref=e212]:
          - generic [ref=e213]:
            - heading "Opponent" [level=3] [ref=e214]
            - strong [ref=e215]: 8,000 LP
          - generic [ref=e216]:
            - generic [ref=e217]:
              - term [ref=e218]: Deck
              - definition [ref=e219]: "35"
            - generic [ref=e220]:
              - term [ref=e221]: Extra
              - definition [ref=e222]: "0"
            - generic [ref=e223]:
              - term [ref=e224]: Hand
              - definition [ref=e225]: "5"
          - generic [ref=e226]:
            - region "Opponent Deck, 35 cards" [ref=e227]:
              - generic [ref=e228]:
                - strong [ref=e229]: Opponent Deck
                - generic [ref=e230]: "35"
              - generic [ref=e231]: Count only
            - region "Opponent Extra Deck, 0 cards" [ref=e232]:
              - generic [ref=e233]:
                - strong [ref=e234]: Opponent Extra Deck
                - generic [ref=e235]: "0"
              - generic [ref=e236]: Count only
            - region "Opponent GY, 0 cards" [ref=e237]:
              - generic [ref=e238]:
                - strong [ref=e239]: Opponent GY
                - generic [ref=e240]: "0"
              - generic [ref=e241]: Count only
            - region "Opponent Banished, 0 cards" [ref=e242]:
              - generic [ref=e243]:
                - strong [ref=e244]: Opponent Banished
                - generic [ref=e245]: "0"
              - generic [ref=e246]: Count only
      - region "Public and owned card state" [ref=e247]:
        - heading "Public and owned card state" [level=3] [ref=e248]
        - list [ref=e249]:
          - listitem [ref=e250]:
            - button "Inspect Reinforcements" [ref=e251] [cursor=pointer]: Reinforcements
            - text: face down attack
          - listitem [ref=e252]:
            - button "Inspect Neo the Magic Swordsman" [ref=e253] [cursor=pointer]: Neo the Magic Swordsman
            - text: face down attack
          - listitem [ref=e254]:
            - button "Inspect Trap Hole" [ref=e255] [cursor=pointer]: Trap Hole
            - text: face down attack
          - listitem [ref=e256]:
            - button "Inspect Mystical Space Typhoon" [ref=e257] [cursor=pointer]: Mystical Space Typhoon
            - text: face down attack
          - listitem [ref=e258]:
            - button "Inspect Battle Ox" [ref=e259] [cursor=pointer]: Battle Ox
            - text: face down attack
      - region "Active chain" [ref=e260]:
        - generic [ref=e261]:
          - heading "Active chain" [level=3] [ref=e262]
          - generic [ref=e263]: "0"
        - paragraph [ref=e264]: No chain is resolving.
  - region "Notifications"
```

# Test source

```ts
  5017 |   await runRestartCycle(page);
  5018 |   await runTrayCycle(page, 3);
  5019 |   const resourceAfter = await browserResourceSnapshot(page, cdp);
  5020 | 
  5021 |   const updatePaint = summarizeSamples(updatePaintSamples);
  5022 |   const actionLatency = summarizeSamples(actionLatencySamples);
  5023 |   const objectUrlGrowth =
  5024 |     resourceAfter.objectUrls.active - resourceBefore.objectUrls.active;
  5025 |   const obsoleteObjectUrlOverlap = resourceBefore.objectUrls.activeUrls.filter(
  5026 |     (url) => resourceAfter.objectUrls.activeUrls.includes(url),
  5027 |   );
  5028 |   const objectUrlLeak =
  5029 |     !resourceBefore.objectUrls.activeMatchesMounted ||
  5030 |     !resourceAfter.objectUrls.activeMatchesMounted ||
  5031 |     obsoleteObjectUrlOverlap.length > 0;
  5032 |   const listenerGrowth =
  5033 |     resourceAfter.listeners.active - resourceBefore.listeners.active;
  5034 |   const droppedFrames = updatePaintSamples.filter(
  5035 |     (sample) => sample > 50,
  5036 |   ).length;
  5037 |   const removalGate =
  5038 |     updatePaint.p95 < 50 &&
  5039 |     actionLatency.p95 < 100 &&
  5040 |     normalLongTasks.length === 0 &&
  5041 |     !objectUrlLeak &&
  5042 |     listenerGrowth <= 0;
  5043 | 
  5044 |   const evidence = {
  5045 |     acceptance: removalGate ? "pass" : "fail",
  5046 |     browser: {
  5047 |       name: browser.browserType().name(),
  5048 |       version: browser.version(),
  5049 |     },
  5050 |     profile: {
  5051 |       os: "linux-headless",
  5052 |       viewport: "1280x720",
  5053 |       deviceScaleFactor: 1,
  5054 |       cpuThrottlingRate: 4,
  5055 |       networkThrottleAfterFixtureLoad: "none",
  5056 |       warmUpRuns: 5,
  5057 |       measuredRuns: 30,
  5058 |       percentileMethod: "nearest-rank",
  5059 |       markBoundaries: {
  5060 |         updateToPaint:
  5061 |           "Worker message ingress → validated public state/store → unique revision's visible turn marker → two requestAnimationFrame callbacks",
  5062 |         inputFeedback:
  5063 |           "alternating field-target focus → activeElement confirmed → two requestAnimationFrame callbacks",
  5064 |       },
  5065 |     },
  5066 |     thresholds: {
  5067 |       updateToPaintP95Ms: 50,
  5068 |       inputFeedbackP95Ms: 100,
  5069 |       normalLongTaskMs: 50,
  5070 |     },
  5071 |     workloads: {
  5072 |       normalPrompt: {
  5073 |         fixture:
  5074 |           "live public state clones with distinct revision/turn pairs; original prompt replayed through Worker message boundary",
  5075 |         acceptedUpdates,
  5076 |         focusFeedback,
  5077 |         workloadStartedAt,
  5078 |         workloadEndedAt,
  5079 |         updateToPaintMs: updatePaint,
  5080 |         inputFeedbackMs: actionLatency,
  5081 |         longTasks: normalLongTasks,
  5082 |       },
  5083 |       pathological: { reducedMotionAndZoomCoveredByChromiumSuite: true },
  5084 |       sixtyCardTray: {
  5085 |         trayCycles: 6,
  5086 |         objectUrlGrowth,
  5087 |         activeMatchesMountedBefore:
  5088 |           resourceBefore.objectUrls.activeMatchesMounted,
  5089 |         activeMatchesMountedAfter:
  5090 |           resourceAfter.objectUrls.activeMatchesMounted,
  5091 |         obsoleteObjectUrlOverlap: obsoleteObjectUrlOverlap.length,
  5092 |       },
  5093 |       burst: { restartCycles: 1, listenerGrowth, droppedFrames },
  5094 |     },
  5095 |     resources: {
  5096 |       before: publicResourceSnapshot(resourceBefore),
  5097 |       after: publicResourceSnapshot(resourceAfter),
  5098 |     },
  5099 |     privacy: {
  5100 |       hiddenOpponentHandInWorkerEvents: false,
  5101 |       restrictedCardArtInMetrics: false,
  5102 |     },
  5103 |   };
  5104 | 
  5105 |   await mkdir("test-results", { recursive: true });
  5106 |   await writeFile(
  5107 |     "test-results/df-16-results.json",
  5108 |     JSON.stringify(evidence, null, 2),
  5109 |   );
  5110 |   const artifactPath = testInfo.outputPath("df-16-results.json");
  5111 |   await writeFile(artifactPath, JSON.stringify(evidence, null, 2));
  5112 |   await testInfo.attach("df-16-results", {
  5113 |     path: artifactPath,
  5114 |     contentType: "application/json",
  5115 |   });
  5116 | 
> 5117 |   expect(updatePaint.p95).toBeLessThan(50);
       |                           ^ Error: expect(received).toBeLessThan(expected)
  5118 |   expect(actionLatency.p95).toBeLessThan(100);
  5119 |   expect(normalLongTasks).toHaveLength(0);
  5120 |   expect(objectUrlLeak).toBe(false);
  5121 |   expect(listenerGrowth).toBeLessThanOrEqual(0);
  5122 |   expect(removalGate).toBe(true);
  5123 | });
  5124 | 
  5125 | test("spatial field navigation has one visible 44px keyboard entry without a trap", async ({
  5126 |   page,
  5127 | }, testInfo) => {
  5128 |   await openDuel(page);
  5129 |   await startPresetDuel(page);
  5130 |   await expect(page.locator("[data-prompt-kind]")).toBeVisible({
  5131 |     timeout: 120_000,
  5132 |   });
  5133 |   const field = page.getByRole("region", { name: "Duel field" });
  5134 |   const board = field.getByRole("group", { name: "Standard duel board" });
  5135 |   const targets = board.locator("[data-field-target]");
  5136 |   await expect(targets).not.toHaveCount(0);
  5137 |   await expect(field.locator("[data-field-target][tabindex='0']")).toHaveCount(
  5138 |     1,
  5139 |   );
  5140 |   await expect(field.locator("[role=application], [role=grid]")).toHaveCount(0);
  5141 | 
  5142 |   const entry = field.locator("[data-field-target][tabindex='0']");
  5143 |   await keyboardFocus(page, entry);
  5144 |   expect(
  5145 |     await entry.evaluate((element) => ({
  5146 |       focusVisible: element.matches(":focus-visible"),
  5147 |       outline: getComputedStyle(element).outlineStyle,
  5148 |     })),
  5149 |   ).toEqual({ focusVisible: true, outline: "solid" });
  5150 | 
  5151 |   const boxes = await targets.evaluateAll((elements) =>
  5152 |     elements.map((element) => {
  5153 |       const box = element.getBoundingClientRect();
  5154 |       return {
  5155 |         target: (element as HTMLElement).dataset.fieldTarget,
  5156 |         width: box.width,
  5157 |         height: box.height,
  5158 |       };
  5159 |     }),
  5160 |   );
  5161 |   expect(
  5162 |     boxes.every(({ width, height }) => width >= 44 && height >= 44),
  5163 |     `undersized field targets: ${JSON.stringify(
  5164 |       boxes.filter(({ width, height }) => width < 44 || height < 44),
  5165 |     )}`,
  5166 |   ).toBe(true);
  5167 | 
  5168 |   expect(
  5169 |     await entry.evaluate(
  5170 |       (element) =>
  5171 |         element
  5172 |           .closest(".duel-field-card")
  5173 |           ?.getAttribute("data-card-zone-id") === "p0:hand",
  5174 |     ),
  5175 |   ).toBe(true);
  5176 |   await page.evaluate(() => {
  5177 |     document.documentElement.style.zoom = "200%";
  5178 |   });
  5179 |   await entry.scrollIntoViewIfNeeded();
  5180 |   expect(
  5181 |     await entry.evaluate((element) => ({
  5182 |       focusVisible: element.matches(":focus-visible"),
  5183 |       outline: getComputedStyle(element).outlineStyle,
  5184 |     })),
  5185 |   ).toEqual({ focusVisible: true, outline: "solid" });
  5186 |   await page.evaluate(() => {
  5187 |     document.documentElement.style.zoom = "";
  5188 |   });
  5189 | 
  5190 |   const before = await entry.getAttribute("data-field-target");
  5191 |   for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
  5192 |     await page.keyboard.press(key);
  5193 |     const active = field.locator(":focus");
  5194 |     await expect(active).toHaveAttribute("data-field-target", /.+/);
  5195 |     if ((await active.getAttribute("data-field-target")) !== before) break;
  5196 |   }
  5197 |   await page.keyboard.press("Tab");
  5198 |   await expect(board.locator("[data-field-target]:focus")).toHaveCount(0);
  5199 |   for (let index = 0; index < 3; index += 1) {
  5200 |     if ((await board.locator(":focus").count()) === 0) break;
  5201 |     await page.keyboard.press("Tab");
  5202 |   }
  5203 |   await expect(board.locator(":focus")).toHaveCount(0);
  5204 |   await page.keyboard.press("Shift+Tab");
  5205 |   await expect(board.locator(":focus")).toHaveCount(1);
  5206 | 
  5207 |   const evidencePath = testInfo.outputPath("df-14-keyboard-field.json");
  5208 |   await writeFile(
  5209 |     evidencePath,
  5210 |     JSON.stringify(
  5211 |       {
  5212 |         oneTabStop: true,
  5213 |         focusVisible: true,
  5214 |         zoom200FocusVisible: true,
  5215 |         overlappingHandFocusVisible: true,
  5216 |         boxes,
  5217 |       },
```