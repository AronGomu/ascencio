# Identity: logo, colour, type, art direction

Two kinds of evidence are mixed here and they are labelled every time:

- **Measured** — sampled with ImageMagick from Konami's official screenshots and box art. These are real values from the shipped product.
- **Estimated** — read by eye from low-resolution art. Konami published no colour specification for anything.

---

## 1. Logo lockup

Observed on the JP box art (`https://www.nintendo.co.jp/ds/software/ayxj/package.jpg`).

The lockup is **four stacked elements in the lower-left quadrant**, not one wordmark:

1. `遊戯王` — the parent kanji logo, gold with a hard black outline and a bevel, small.
2. `デュエルモンスターズ` — silver/white katakana, smaller still, sitting under it.
3. `GX` — a large angular gold-bronze block, set *behind* and *below* the katakana line so it reads as a stamp rather than as a word.
4. `SPIRIT SUMMONER` — the subtitle, and the visually dominant element: a **heavy condensed sans-serif in caps**, filled with a chrome gradient running blue → violet → silver, a white keyline, and a hard drop shadow. Beneath it, `スピリット サモナー` in orange-gold katakana with a white keyline.

The correction worth noting: the *card* typography is serif (see §3), but the *game subtitle* is not — it is a chunky chrome sans. The two type registers coexist on the same package.

Composition around it: a warm orange-to-yellow radial burst background, three characters in dynamic poses filling the right and top, a mascot spirit at the top centre, a white duel disk breaking the top-right corner, and the publisher mark in a red rounded box at the top-left.

**Do not reproduce any of this.** The parent kanji logo, the eye motif that belongs to the wider brand, and the GX block are licensed marks. What is transferable is the *structure*: a small licensed parent mark, a big subtitle in a contrasting register, a warm burst behind a character cluster.

---

## 2. Colour

### 2.1 Measured — in-game UI

Sampled from the official screenshots. These are the actual shipped values.

| Role | Hex | Where |
|---|---|---|
| Dialogue box interior | `#151F50` | narrative text box fill |
| Dialogue box stripe | `#000082` | scanline banding inside the fill |
| Dialogue box gloss | `#19425D` | lighter band along the top inner edge |
| Frame bevel — highlight | `#98A1A6` | steel border, lit edge |
| Frame bevel — mid | `#73868F` | steel border, body |
| Frame bevel — shade | `#606870` | steel border, shadow edge |
| Frame keyline | `#161210` | hard outline outside the bevel |
| Speaker name / keyword | `#FB61D3` | name plate text, proper nouns in body text |
| Body text | `#FBFBFB` | dialogue |
| Menu background | `#081763` | character-edit screen |
| Menu background stripe | `#080838` | scanline banding |
| Data panel face | `#920118` | menu field panels |
| Data panel shade | `#690008` | panel inner shadow |
| Button gradient | `#B1C7EF` → `#99B0DE` | pale ice-blue control |
| Button label | `#022A83` | navy on pale button |
| Focus ring | `#83E6FB` | cyan, drawn outside the control |
| Monster zone stroke | `#00FFFF` | duel field |
| Spell/trap zone stroke | `#00FF00` | duel field |
| Duel mat — earth | `#93682E` / `#6C4A1F` | textured backdrop |
| Duel mat — field | `#4E775E` | textured backdrop |
| Graveyard tile | `#2C6168` | teal, spiral glyph |
| Banished tile | `#674543` | maroon, no glyph |
| Card banner | `#020A0F` | near-black strip, white text `#E4E4E7` |
| Active phase tile | `#4970E2` + `#F5DDD4` | lit blue with cream face |
| Map grass | `#019530` / `#19C92F` | two tones |
| Map sand | `#FBC300` | beach |
| Map water | `#0069B2` + `#30499A` | with horizontal stripe banding |
| Map out-of-bounds | `#616169` | flat grey |
| Map boundary | `#FB0000` | pure red, 2 px hard edge |
| Map cursor reticle | `#FB699A` | pink ring, red crosshair ticks |
| Player token | `#FBD652` / `#E2AB44` / `#AF8732` | gold pawn, three tones |

Two structural observations from that table:

**Interactive geometry is pure saturated primary; the world is muted and textured.** Cyan `#00FFFF`, green `#00FF00`, red `#FB0000`, the pink reticle and the gold selection outline are the only fully-saturated things on screen, and they sit on brown dirt, dull green, grey stone and photographic noise. The gap between "world" and "affordance" is enormous and entirely deliberate — it is how a 256 px-wide field stays readable.

**Magenta is reserved.** `#FB61D3` names the speaker and highlights proper nouns inside body text, and appears nowhere else in any screen observed. One colour, one meaning.

### 2.2 Estimated — the franchise palette

No official values exist. These are read from box art and official art.

| Name | Hex (estimated) | Role |
|---|---|---|
| Gold highlight → shadow | `#F7E27A` → `#D4A017` → `#8A5C10` | parent wordmark gradient |
| Institutional steel blue | `#1B3A6B` | the school's corporate chrome |
| Rank red (lowest tier) | `#B4242C` | jacket, duel disk, dorm |
| Rank yellow (middle tier) | `#E2B428` | jacket, duel disk, dorm |
| Rank blue (highest tier) | `#2A4C9B` | jacket, duel disk, dorm |

The idea behind them is better than the values: the three rank colours are **semantic** — each names a legendary card the school's founder associated with a rival — and the institution's own logo shares the founder's corporate scheme. So cool steel reads as *the institution* and the saturated triad reads as *student identity* standing against it. That split is worth taking; the hues are not.

Card-frame colours are canonically named and never numbered: Normal light yellow, Effect orange, Ritual light blue, Fusion violet, Synchro white, Xyz black, Link deep blue, Spell green, Trap purple, Token grey. On the field these frame colours are doing the entire job of type identification, because at ~30 px a card is art plus a coloured border and nothing else.

One rule from the printed card is a genuine contrast policy worth copying verbatim: card-name text is black by default and white on dark frames, but only at rarities with no name foil; the highest rarity overrides to gold regardless of frame.

---

## 3. Typography

| Slot | Face | Licence |
|---|---|---|
| Parent wordmark | Matrix II Bold (Emigre, Zuzana Licko) | commercial |
| Card name, ATK/DEF | Matrix Small Caps Regular | commercial |
| Effect text | Matrix Regular | commercial |
| Flavour / type line / legal | ITC Stone Serif (Italic, SC Bold, Regular) | commercial |
| JP UI text | FOT-Rodin — Fontworks is credited in the game's own staff roll | commercial |
| JP card base text | DF LeiSho Semi-Bold, clerical script | commercial |

The serif card face is specifically the era's signature; the later Rush Duel layout went fully sans-serif.

**OFL substitutes:** display/title → Bevan or Alfa Slab One · card name and numerals → Cormorant SC or EB Garamond SC · body serif → Vollkorn · flavour and legal → Source Serif 4 · UI Latin → Chivo · JP → Noto Sans JP or M PLUS 1p.

Do not ship extracted fonts. The `Yu-Gi-Oh! Matrix Small Caps` and `Yu-Gi-Oh! StoneSerif LT` files circulating on cardmaker forums are renamed retail fonts.

**In-game text is enormous.** Measured from the screenshots: dialogue body text is roughly 16 px cap height on a 192 px-tall screen — about 8% of screen height per line, two lines per box. Menu values are similar. Nothing in the interface is set small except the count numerals on piles.

---

## 4. Art direction

### 4.1 Three registers, deliberately unmixed

| Register | Used for | Look |
|---|---|---|
| Cel-shaded 2D sprite | characters, portraits, spirits in dialogue | hard black keylines, flat 2–3 tone shading, anime cel |
| Pre-rendered 3D | environments, the hub room, prop close-ups | soft CG lighting, no outlines |
| Real-time low-poly 3D | monsters during summon animations | untextured-looking, flat-shaded, low triangle count |

Portrait sheets are large: a single character's bust-up sheet is 640×202 px, i.e. roughly three expressions side by side at ~200 px tall — the full height of the screen. Contemporary Japanese players singled the third register out as the weak one: 「モンスターカードのポリゴンがダサい」, *"the monster cards' polygons are lame"*.

### 4.2 Time of day is a colour grade, not new art

The strongest single finding in the ripped background set. Every environment exists as **three variants of the same render**, laid out as row triplets in the atlas: day, sunset, night. Measured mean values for one scene:

| Variant | Mean RGB | Character |
|---|---|---|
| Day | ~`(169,160,144)` | neutral, slightly warm, full brightness |
| Sunset | ~`(188,113,104)` | strong warm multiply — red held, green and blue cut ~35% |
| Night | ~`(51,42,107)` | heavy darkening to ~30% with a blue-violet cast, blue channel dominant |

So a day/night cycle over dozens of locations cost three colour passes over one render each, not three paintings. In a browser this is one CSS filter or one blended overlay per scene, which makes it one of the cheapest atmosphere mechanisms available.

The same atlas shows that **props are backgrounds too** — an open closet, a desk with a monitor, a rug with a duel disk on it, magazines on a desk each occupy a full 256×192 cell. The hub room's "tap a prop" interaction is literally a cut to another background.

### 4.3 Development leftovers, for calibration

The ripped `Error Handlers` sheet is a grid of ~25 placeholder portraits: a red stick figure with a smiley face, a speech balloon reading 「このバストアップを見たら御報告を」 (*"if you see this bust-up, please report it"*), each labelled `エラー ID=NN`. It confirms the portrait system is a numbered slot table with around fifty ids, and it is a reminder that a shipped game had a visible placeholder for every missing asset — worth imitating as practice, not as art.

---

## 5. Audio identity

ROM-extracted sequence names give the structure precisely:

- Four duel music tiers (`SEQ_DU1`…`SEQ_DU4`), 3–4 minute loops
- **A dynamic pair: `SEQ_DU_YURI` (有利, favourable) and `SEQ_DU_FURI` (不利, unfavourable)** — the score changes with who is winning
- Map (`SEQ_MA*`), event (`SEQ_EV01`–`EV10`), menu (`SEQ_MENU1/2/3`), plus `OP1` and `SEQ_ENDING`
- Stingers of 4–10 s: `JG_SHOKAN` (summon) · `JG_KAMISYOKAN` (top-tier summon, longer) · `JG_EXODIA` (the alternate win condition gets its own fanfare) · `JG_WIN` / `JG_LOSE` / `JG_DRAW` / `JG_GAMEOVER1`

Four hooks carry the drama: a summon stinger, an escalated stinger for the top-tier summon, a unique one for the alternate win, and the favourable/unfavourable music swap. The last is the only place audio reads game state, and it costs two loops and a threshold.

Known mistake to avoid: the *final* story duel plays the ordinary battle theme. Four tiers existed and the finale was not wired to them.

---

## 6. Motion

Thinly sourced, and the sources disagree in an informative way.

- Creature/summon animation was improved over the predecessor and is where the budget went — IGN.
- Card *use* has almost no animation: *"nous n'avons pas encore droit à des animations dignes de ce nom lors de l'utilisation des cartes"* — jeuxvideo.com.
- Observed directly: the battle comparison screen draws a **white-and-cyan starburst with radiating streaks** over the losing card, and monster art **breaks out past the card frame** so the creatures read as emerging from the cards.

So the motion budget was spent entirely on summons and battles, and not at all on spell/trap activation. Both reviews independently called the interface overloaded — IGN's phrase for the whole handheld line is a *"hacked together" look* — so the density is a warning, not a model.

---

## 7. Brand voice

Two registers, both sourced verbatim.

**Konami NA, 2007 press release** — plain, feature-led, school-framed: *"immerses players in the Duel Academy, an elite school for gifted young duelists, as they start a new school year with the low ranking Slifer Red dormitory… many duelists fear that the school itself has become haunted… Duel Spirits, helpful apparitions that impart wisdom"*. It leans on the TV tie-in rather than on the card game.

**Nintendo JP** — exclamatory, second person, invitational: 「学園生活とデュエルを楽しもう！」 (*"let's enjoy school life and duels!"*), 「世界を舞台にデュエルしようぜ!」 (*"let's duel on the world stage!"*). The screenshot captions keep the same register — 「主人公はキミ自身！」 (*"the protagonist is you!"*), 「キミにもきっと、カードの精霊の声が聞こえる…！」 (*"surely you too can hear the voice of the card spirits…!"*).

The formula underneath both: **bright school life with a horror seam**. Konami's own copy sells the haunting; a reviewer independently reached for *"Harry Potter meets Manga"*. The darkness enters through the institution rather than from outside it.

Ascencio's voice is already established and is not this one — the prologue is terse and rain-lit: *"Rain turned the last train into a ribbon of silver."* What transfers is the structure of the formula, an ordinary world with one seam of dread running through its institutions, not the school setting or the exclamation marks.
