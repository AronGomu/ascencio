# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zz-oracle-restored.spec.ts >> DF-16 Chromium pinned parity/perf/resource gate records automated evidence
- Location: e2e/zz-oracle-restored.spec.ts:4967:1

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 50
Received:   122.89999999850988
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
                    - article "La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e83]:
                      - img "La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e85]
                      - generic [ref=e86]: La Jinn the Mystical Genie of the Lamp in Your Hand
                      - button "Legal action, Open actions for La Jinn the Mystical Genie of the Lamp in Your Hand" [ref=e87] [cursor=pointer]
                    - article "Battle Ox in Your Hand" [ref=e88]:
                      - img "Battle Ox in Your Hand" [ref=e90]
                      - generic [ref=e91]: Battle Ox in Your Hand
                      - button "Legal action, Open actions for Battle Ox in Your Hand" [ref=e92] [cursor=pointer]
                    - article "Reinforcements in Your Hand" [ref=e93]:
                      - img "Reinforcements in Your Hand" [ref=e95]
                      - generic [ref=e96]: Reinforcements in Your Hand
                      - button "Legal action, Open actions for Reinforcements in Your Hand" [ref=e97] [cursor=pointer]
                    - article "Raigeki in Your Hand" [ref=e98]:
                      - img "Raigeki in Your Hand" [ref=e100]
                      - generic [ref=e101]: Raigeki in Your Hand
                      - button "Legal action, Open actions for Raigeki in Your Hand" [ref=e102] [cursor=pointer]
                    - article "Trap Hole in Your Hand" [ref=e103]:
                      - img "Trap Hole in Your Hand" [ref=e105]
                      - generic [ref=e106]: Trap Hole in Your Hand
                      - button "Legal action, Open actions for Trap Hole in Your Hand" [ref=e107] [cursor=pointer]
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
            - button "Inspect La Jinn the Mystical Genie of the Lamp" [ref=e251] [cursor=pointer]: La Jinn the Mystical Genie of the Lamp
            - text: face down attack
          - listitem [ref=e252]:
            - button "Inspect Battle Ox" [ref=e253] [cursor=pointer]: Battle Ox
            - text: face down attack
          - listitem [ref=e254]:
            - button "Inspect Reinforcements" [ref=e255] [cursor=pointer]: Reinforcements
            - text: face down attack
          - listitem [ref=e256]:
            - button "Inspect Raigeki" [ref=e257] [cursor=pointer]: Raigeki
            - text: face down attack
          - listitem [ref=e258]:
            - button "Inspect Trap Hole" [ref=e259] [cursor=pointer]: Trap Hole
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
  5019 |   await runRestartCycle(page);
  5020 |   await runTrayCycle(page, 3);
  5021 |   const resourceAfter = await browserResourceSnapshot(page, cdp);
  5022 | 
  5023 |   const updatePaint = summarizeSamples(updatePaintSamples);
  5024 |   const actionLatency = summarizeSamples(actionLatencySamples);
  5025 |   const objectUrlGrowth =
  5026 |     resourceAfter.objectUrls.active - resourceBefore.objectUrls.active;
  5027 |   const obsoleteObjectUrlOverlap = resourceBefore.objectUrls.activeUrls.filter(
  5028 |     (url) => resourceAfter.objectUrls.activeUrls.includes(url),
  5029 |   );
  5030 |   const objectUrlLeak =
  5031 |     !resourceBefore.objectUrls.activeMatchesMounted ||
  5032 |     !resourceAfter.objectUrls.activeMatchesMounted ||
  5033 |     obsoleteObjectUrlOverlap.length > 0;
  5034 |   const listenerGrowth =
  5035 |     resourceAfter.listeners.active - resourceBefore.listeners.active;
  5036 |   const droppedFrames = updatePaintSamples.filter(
  5037 |     (sample) => sample > 50,
  5038 |   ).length;
  5039 |   const removalGate =
  5040 |     updatePaint.p95 < 50 &&
  5041 |     actionLatency.p95 < 100 &&
  5042 |     normalLongTasks.length === 0 &&
  5043 |     !objectUrlLeak &&
  5044 |     listenerGrowth <= 0;
  5045 | 
  5046 |   const evidence = {
  5047 |     acceptance: removalGate ? "pass" : "fail",
  5048 |     browser: {
  5049 |       name: browser.browserType().name(),
  5050 |       version: browser.version(),
  5051 |     },
  5052 |     profile: {
  5053 |       os: "linux-headless",
  5054 |       viewport: "1280x720",
  5055 |       deviceScaleFactor: 1,
  5056 |       cpuThrottlingRate: 4,
  5057 |       networkThrottleAfterFixtureLoad: "none",
  5058 |       warmUpRuns: 5,
  5059 |       measuredRuns: 30,
  5060 |       percentileMethod: "nearest-rank",
  5061 |       markBoundaries: {
  5062 |         updateToPaint:
  5063 |           "Worker message ingress → validated public state/store → unique revision's visible turn marker → two requestAnimationFrame callbacks",
  5064 |         inputFeedback:
  5065 |           "alternating field-target focus → activeElement confirmed → two requestAnimationFrame callbacks",
  5066 |       },
  5067 |     },
  5068 |     thresholds: {
  5069 |       updateToPaintP95Ms: 50,
  5070 |       inputFeedbackP95Ms: 100,
  5071 |       normalLongTaskMs: 50,
  5072 |     },
  5073 |     workloads: {
  5074 |       normalPrompt: {
  5075 |         fixture:
  5076 |           "live public state clones with distinct revision/turn pairs; original prompt replayed through Worker message boundary",
  5077 |         acceptedUpdates,
  5078 |         focusFeedback,
  5079 |         workloadStartedAt,
  5080 |         workloadEndedAt,
  5081 |         updateToPaintMs: updatePaint,
  5082 |         inputFeedbackMs: actionLatency,
  5083 |         longTasks: normalLongTasks,
  5084 |       },
  5085 |       pathological: { reducedMotionAndZoomCoveredByChromiumSuite: true },
  5086 |       sixtyCardTray: {
  5087 |         trayCycles: 6,
  5088 |         objectUrlGrowth,
  5089 |         activeMatchesMountedBefore:
  5090 |           resourceBefore.objectUrls.activeMatchesMounted,
  5091 |         activeMatchesMountedAfter:
  5092 |           resourceAfter.objectUrls.activeMatchesMounted,
  5093 |         obsoleteObjectUrlOverlap: obsoleteObjectUrlOverlap.length,
  5094 |       },
  5095 |       burst: { restartCycles: 1, listenerGrowth, droppedFrames },
  5096 |     },
  5097 |     resources: {
  5098 |       before: publicResourceSnapshot(resourceBefore),
  5099 |       after: publicResourceSnapshot(resourceAfter),
  5100 |     },
  5101 |     privacy: {
  5102 |       hiddenOpponentHandInWorkerEvents: false,
  5103 |       restrictedCardArtInMetrics: false,
  5104 |     },
  5105 |   };
  5106 | 
  5107 |   await mkdir("test-results", { recursive: true });
  5108 |   await writeFile(
  5109 |     "test-results/df-16-results.json",
  5110 |     JSON.stringify(evidence, null, 2),
  5111 |   );
  5112 |   const artifactPath = testInfo.outputPath("df-16-results.json");
  5113 |   await writeFile(artifactPath, JSON.stringify(evidence, null, 2));
  5114 |   await testInfo.attach("df-16-results", {
  5115 |     path: artifactPath,
  5116 |     contentType: "application/json",
  5117 |   });
  5118 | 
> 5119 |   expect(updatePaint.p95).toBeLessThan(50);
       |                           ^ Error: expect(received).toBeLessThan(expected)
  5120 |   expect(actionLatency.p95).toBeLessThan(100);
  5121 |   expect(normalLongTasks).toHaveLength(0);
  5122 |   expect(objectUrlLeak).toBe(false);
  5123 |   expect(listenerGrowth).toBeLessThanOrEqual(0);
  5124 |   expect(removalGate).toBe(true);
  5125 | });
  5126 | 
  5127 | test("spatial field navigation has one visible 44px keyboard entry without a trap", async ({
  5128 |   page,
  5129 | }, testInfo) => {
  5130 |   await openDuel(page);
  5131 |   await startPresetDuel(page);
  5132 |   await expect(page.locator("[data-prompt-kind]")).toBeVisible({
  5133 |     timeout: 120_000,
  5134 |   });
  5135 |   const field = page.getByRole("region", { name: "Duel field" });
  5136 |   const board = field.getByRole("group", { name: "Standard duel board" });
  5137 |   const targets = board.locator("[data-field-target]");
  5138 |   await expect(targets).not.toHaveCount(0);
  5139 |   await expect(field.locator("[data-field-target][tabindex='0']")).toHaveCount(
  5140 |     1,
  5141 |   );
  5142 |   await expect(field.locator("[role=application], [role=grid]")).toHaveCount(0);
  5143 | 
  5144 |   const entry = field.locator("[data-field-target][tabindex='0']");
  5145 |   await keyboardFocus(page, entry);
  5146 |   expect(
  5147 |     await entry.evaluate((element) => ({
  5148 |       focusVisible: element.matches(":focus-visible"),
  5149 |       outline: getComputedStyle(element).outlineStyle,
  5150 |     })),
  5151 |   ).toEqual({ focusVisible: true, outline: "solid" });
  5152 | 
  5153 |   const boxes = await targets.evaluateAll((elements) =>
  5154 |     elements.map((element) => {
  5155 |       const box = element.getBoundingClientRect();
  5156 |       return {
  5157 |         target: (element as HTMLElement).dataset.fieldTarget,
  5158 |         width: box.width,
  5159 |         height: box.height,
  5160 |       };
  5161 |     }),
  5162 |   );
  5163 |   expect(
  5164 |     boxes.every(({ width, height }) => width >= 44 && height >= 44),
  5165 |     `undersized field targets: ${JSON.stringify(
  5166 |       boxes.filter(({ width, height }) => width < 44 || height < 44),
  5167 |     )}`,
  5168 |   ).toBe(true);
  5169 | 
  5170 |   expect(
  5171 |     await entry.evaluate(
  5172 |       (element) =>
  5173 |         element
  5174 |           .closest(".duel-field-card")
  5175 |           ?.getAttribute("data-card-zone-id") === "p0:hand",
  5176 |     ),
  5177 |   ).toBe(true);
  5178 |   await page.evaluate(() => {
  5179 |     document.documentElement.style.zoom = "200%";
  5180 |   });
  5181 |   await entry.scrollIntoViewIfNeeded();
  5182 |   expect(
  5183 |     await entry.evaluate((element) => ({
  5184 |       focusVisible: element.matches(":focus-visible"),
  5185 |       outline: getComputedStyle(element).outlineStyle,
  5186 |     })),
  5187 |   ).toEqual({ focusVisible: true, outline: "solid" });
  5188 |   await page.evaluate(() => {
  5189 |     document.documentElement.style.zoom = "";
  5190 |   });
  5191 | 
  5192 |   const before = await entry.getAttribute("data-field-target");
  5193 |   for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
  5194 |     await page.keyboard.press(key);
  5195 |     const active = field.locator(":focus");
  5196 |     await expect(active).toHaveAttribute("data-field-target", /.+/);
  5197 |     if ((await active.getAttribute("data-field-target")) !== before) break;
  5198 |   }
  5199 |   await page.keyboard.press("Tab");
  5200 |   await expect(board.locator("[data-field-target]:focus")).toHaveCount(0);
  5201 |   for (let index = 0; index < 3; index += 1) {
  5202 |     if ((await board.locator(":focus").count()) === 0) break;
  5203 |     await page.keyboard.press("Tab");
  5204 |   }
  5205 |   await expect(board.locator(":focus")).toHaveCount(0);
  5206 |   await page.keyboard.press("Shift+Tab");
  5207 |   await expect(board.locator(":focus")).toHaveCount(1);
  5208 | 
  5209 |   const evidencePath = testInfo.outputPath("df-14-keyboard-field.json");
  5210 |   await writeFile(
  5211 |     evidencePath,
  5212 |     JSON.stringify(
  5213 |       {
  5214 |         oneTabStop: true,
  5215 |         focusVisible: true,
  5216 |         zoom200FocusVisible: true,
  5217 |         overlappingHandFocusVisible: true,
  5218 |         boxes,
  5219 |       },
```