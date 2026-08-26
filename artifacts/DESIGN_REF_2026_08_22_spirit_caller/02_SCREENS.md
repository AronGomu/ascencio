# Screen anatomy

Observed directly from Konami's official screenshots on the Nintendo JP software page — twelve images at native DS resolution (256×192), six top/bottom pairs, each with an official Japanese caption. Upscaled 4× nearest-neighbour and read pixel by pixel; colours sampled with ImageMagick from the source GIFs.

This is the strongest evidence in the whole reference. Everything in this file is **observed**, not inferred. Where something is not visible in the six pairs, it is marked `NOT OBSERVED` rather than guessed.

Source images (not vendored into this repo — Konami screenshots, cited by URL):
`https://www.nintendo.co.jp/ds/software/ayxj/ss{01..06}{a,b}.gif` · captions at `ss{01..06}.html` · page `https://www.nintendo.co.jp/ds/software/ayxj/index.html`

Suffix `a` = top screen (no touch), `b` = bottom screen (touch).

---

## 1. Duel — bottom screen (the playing field)

`ss01b`, `ss02b`. Official caption for `ss01`: 「デュエルフィールド上にモンスターを召喚！操作方法が新しくなって、さらに使いやすく、快適操作を実現！」 — *"Summon a monster onto the duel field! The controls are new, easier to use, comfortable operation achieved."*

The whole field fits in 256×192 with no scrolling and no panning. Layout, top to bottom:

| Band | Height (approx.) | Contents |
|---|---|---|
| Card info banner | ~14 px, full width | the focused card's name + attribute + level + ATK/DEF |
| Opponent hand | ~22 px | face-down card backs, one per card held, centred |
| Opponent spell/trap row | ~28 px | 5 zones, **green** outlines |
| Opponent monster row | ~28 px | 5 zones, **cyan** outlines |
| Player monster row | ~28 px | 5 zones, **cyan** outlines |
| Player spell/trap row | ~28 px | 5 zones, **green** outlines |
| Player hand | ~26 px | face-up cards, art visible, frame colour visible |

Flanking that grid, in the left and right margins, are the piles — deck, extra deck, graveyard, banished, field zone — drawn as single tiles with a glyph or a card back, each carrying a **white numeral in its bottom-right corner** for the count (observed: `26`, `29`, `34`, `35` for decks; `1`, `8` for extra decks; `10` on a pile mid-field).

### The phase rail

A **vertical column of icon tiles down the left edge**, one per phase, connected by small white downward arrows:

`DP` → `SP` → `M1` → `BP` → `M2` → `EP`

Each tile is ~24×24 px and carries **both a two-letter code and a tiny illustration** — a hand drawing a card for DP, a standing figure for SP, crossed swords/figures for BP. The active phase is lit: in `ss02b` `M1` is filled bright blue (`#4970E2`) with a cream face (`#F5DDD4`) and a light border; inactive tiles are desaturated grey-green.

Below the rail sit two more tiles, and they change with context — in `ss02b` a **red curved back-arrow labelled `B`** and a **magnifying glass** tile; in `ss01b` a crossed-out tile labelled `B` and a tile labelled `A`. These are touch targets that also name the physical button that does the same thing. The magnifier is the card-detail control the contemporary review described as sitting at the bottom-left.

### The card info banner

Full-width strip at the very top, near-black (`#020A0F`) with a subtle steel gradient, white text (`#E4E4E7`). Reading left to right in `ss01b`:

`E・HERO ワイルドジャギー` — a small sword glyph — attribute icon in a coloured disc (`地` EARTH on black; `光` LIGHT on yellow in `ss02b`) — level numeral — then **ATK over DEF, right-aligned, stacked on two lines**, each prefixed by a tiny icon (red star for ATK, blue shield for DEF): `2600` / `2300`.

Long names are truncated — `ss02b` shows `...RO シャイニング・フレア・ウ...` mid-marquee — so the banner scrolls rather than wraps.

### Zone rendering

The single most striking visual decision: **zone outlines are pure primary RGB at full saturation**, drawn over a muted textured mat.

- Monster zones: `#00FFFF` cyan (sampled `#00FBFB` after GIF quantisation)
- Spell/trap zones: `#00FF00` green (sampled `#00FB00`)

Each zone is an empty rounded rectangle, ~34×30 px, with a 1–2 px stroke and a translucent tinted fill that lets the mat texture through. Nothing else on the field is that saturated, so the grid reads instantly even at 256 px wide.

The mat itself changes between duels — `ss01b` is a brown desert/dirt texture (`#93682E`, `#6C4A1F`), `ss02b` a green field (`#4E775E`). Both are photographic-looking noise textures, dark and low-contrast, functioning purely as a backdrop for the saturated strokes.

Pile tiles are dark and glyph-marked rather than outlined: graveyard is a teal tile (`#2C6168`) with a **spiral** glyph; the field zone a green tile with a **compass-rose** glyph; banished piles are flat maroon squares (`#674543`) at the outer left and right edges, unglyphed.

### Card rendering on the field

Cards on the field are ~30×26 px — too small for text, so they are **art plus frame colour only**. The frame colour does all the type-signalling: orange (effect), purple (fusion), tan (normal), green (spell), magenta (trap). Face-down cards use an ornate orange-red card back.

Selection is a **thick pale-pink/white outline** drawn outside the card, plus a lighter inner ring — in `ss01b` one opponent monster carries a pink halo, in `ss02b` a player monster carries a white one.

The hand renders the same way but slightly larger, in a row that sits flush at the bottom edge.

### `NOT OBSERVED`

**Life Points are not visible anywhere on either duel bottom screen.** Both `ss01a`/`ss02a` show the top screen mid-animation, so if the LP counters live there permanently, these six pairs do not prove it. Do not assert an LP position from this evidence. The same applies to: the turn counter, the chain display, the context popup that opens above a tapped card (described in a review, not visible here), and the full card-text detail panel.

---

## 2. Duel — top screen

Two completely different presentations were observed, and neither carries any interface chrome at all.

### 2a. Battle comparison — `ss01a`

Two **full card faces side by side**, large, on a dark navy vignette (`#14224E`-family) that fades to near-black at the edges. Under each card, in big white blocky outlined caps: `ATK 2400` and `ATK 2600`.

The detail worth stealing: **the monster art breaks out of the card frame.** Both monsters' limbs and weapons are drawn overlapping and extending past the card border, so the cards read as windows the creatures are climbing out of rather than as flat images. A white-and-cyan starburst impact effect with radiating streaks is drawn over the losing card.

Card frames are legible at this size: name plate, level-star row, art window, effect box — orange for the effect monster, purple for the fusion.

### 2b. Summon animation — `ss02a`

A **3D low-poly monster fills the frame**, shot from a low camera angle looking up, standing in a 3D stadium interior — pale blue-grey tiled walls, a dark ceiling, and rows of **2D pixel-sprite spectators** in the stands.

No HUD, no text, no border. The screen is given over entirely to the summon. This is what the "3D view on the top screen" in contemporary reviews refers to.

---

## 3. Story and dialogue — top screen

`ss04a` (Chancellor Sheppard), `ss05a` (spirit acquisition), `ss06a` (Judai). The most directly reusable screen in the set.

**Composition:** a **cel-shaded character bust-up**, chest-up and roughly centred, composited over a **pre-rendered 3D environment background** (an academy interior with grey machinery and a blue skylight dome; a card shop with posters; a night rockface with a stone well). The portrait is drawn with hard black keylines and flat two-to-three-tone cel shading — anime cel, not painted.

**The text box** occupies the lower ~30% of the screen, full width, and has a specific silhouette worth describing precisely:

- **Outer frame:** a bevelled steel/silver band, 3–4 px at native, rendered as a three-tone gradient — highlight `#98A1A6`, mid `#73868F`, shade `#606870` — with a hard near-black keyline `#161210` outside it. Corners are chamfered rather than rounded, and the **top-left corner is cut at a diagonal** where the name plate attaches.
- **Interior fill:** deep navy `#151F50` with **horizontal scanline striping** (alternating darker rows, sampled `#000082`), and a lighter blue glossy band `#19425D` along the top inner edge.
- **Name plate:** a smaller tab sitting *above and overlapping* the main box, left-aligned, same steel frame, same navy fill. The speaker's name is set in **magenta `#FB61D3`** with a light keyline.
- **Body text:** white `#FBFBFB`, **two lines**, large — roughly 16 px cap height at native, i.e. the text is enormous relative to the 192 px screen. Generous line spacing.
- **Keyword highlighting:** proper nouns inside the body text are set in the same magenta as the name plate. In `ss04a` the chancellor's name appears mid-sentence in magenta while the rest of the line is white. This is a real typographic convention, not decoration — it ties the speaker colour to the entity being named.
- **Advance indicator:** bottom-right inside the box, a small pictorial icon (a hand touching a device) rather than the conventional blinking triangle.

**System messages use the same box without the name plate** — `ss05a` reads 「精霊を手に入れた！」 *("Obtained a spirit!")* as a single white line with no speaker tab.

---

## 4. Map / overworld — bottom screen

`ss04b`, `ss05b`. Official caption for `ss04`: 「デュエルアカデミアに入学したキミに、どんな運命が待っているのだろうか！？」 — *"What fate awaits you, now that you have enrolled at Duel Academia?"*

Not an illustrated map and not a photo — a **stylised isometric diorama in flat saturated colour with black outlines**, closer to a board game than to a JRPG overworld.

**Terrain** is drawn as flat colour fields with cartoon-blob canopies for tree masses:

| Element | Sampled hex |
|---|---|
| Grass (two tones) | `#019530` / `#19C92F` |
| Sand / beach | `#FBC300` |
| Water | `#0069B2` with `#30499A` horizontal stripe banding |
| Out-of-bounds ground | `#616169` flat grey |
| Walkable boundary | pure red `#FB0000`, 2 px, drawn as a hard polygon edge |

The red boundary line is doing real work: it separates the traversable zone from the flat grey nothing beyond it, with no gradient or fade. Blunt, and completely legible.

**Buildings** are chunky low-poly-looking beige/tan blocks with towers and coloured domes — white, blue and red, echoing the dorm colours. The building under the cursor is outlined in **bright yellow**.

**The player avatar is not a character sprite.** It is a small **golden cone/pawn token** (`#FBD652` highlight, `#E2AB44` body, `#AF8732` shade) with a cast shadow — a board-game piece, abstracted, standing on the path.

**The cursor is a targeting reticle**: a pink ring (`#FB699A`) with four red crosshair ticks at the compass points, drawn around whatever is selected.

**Chrome** is four rounded-square icon buttons pinned to the corners, each with a 2 px coloured border and a pictorial glyph, ~28×28 px:

- bottom-left: a running figure in yellow plus signal bars — travel/speed; shown greyed in one shot and lit white-on-gold in the other, so it is a state toggle
- top-right: a grey mountain glyph — map view/scale
- bottom-right, three in a row: a handheld device (PDA), a red-roofed building, a duel-disk glyph

No text labels anywhere on the map screen. Every affordance is a glyph.

---

## 5. Hub room — bottom screen

`ss06b`. A **pre-rendered 3D interior** in warm pink and lavender light: a triple bunk bed in pale wood, a desk with a CRT monitor and tower, an open closet, wall posters, a bookshelf, cards scattered on the desk, a rug, a duel disk on the floor. Fixed camera, fixed perspective, no character in frame.

The scene is **letterboxed with black margins** at the bottom and right, and the UI lives in that black margin rather than on top of the art — in this shot a single **pink-and-white envelope icon** at bottom-right, signalling unread mail.

The design point: the room *is* the menu. Each prop is a touch target and one verb, and the only chrome is a notification badge in dead space.

---

## 6. Menus — bottom screen

`ss03b`, the character-edit screen. Caption: 「主人公はキミ自身！キャラクターエディット機能付きで、容姿も自由自在！」 — *"The protagonist is you! With the character-edit feature, your appearance is yours to choose."*

This is the clearest look at the game's menu chrome, and it is a three-colour system:

| Element | Treatment | Sampled hex |
|---|---|---|
| Background | navy, with **horizontal scanline striping** — the same striping motif as the dialogue box and the map's water | `#081763` with `#080838` stripe |
| Data panels (one per editable field) | deep crimson fill, thin pale-blue keyline, slightly rounded corners | `#920118` face, `#690008` shade |
| Panel label | small white text in the **top-left corner of the panel**, above and left of the value | white |
| Panel value | larger white text, centred, letterspaced | white |
| Buttons | pale ice-blue vertical gradient, rounded rect, navy glyph/text | `#B1C7EF` → `#99B0DE`, text `#022A83` |
| Focus state | bright cyan ring drawn **outside** the button | `#83E6FB` |
| Arrows | solid navy chevrons, no text | `#022A83` |

Layout: three stacked rows, each a wide crimson panel on the left with its control cluster on the right, then a full-width `OK` button at the bottom. Row 1's control is a single wide `入力する` ("enter") button; rows 2 and 3 are paired left/right arrows.

Everything is large. The touch targets are roughly 40×36 px on a 256×192 screen — about a seventh of the screen width each. There is no dense list anywhere in this screen.

### `NOT OBSERVED`

The deck editor, the card shop, the PDA mail interface, the save/load screen and the title screen do not appear in the official gallery. Their layouts are unknown from primary evidence.

---

## 7. Cross-screen conventions

Six patterns hold across every screen observed:

1. **Horizontal scanline striping** is the house texture. It appears in the menu background, in the dialogue-box interior, and in the map's water. It is how a flat colour field is made to read as a surface rather than as emptiness.
2. **Steel bevel + black keyline** frames anything that floats over content — the dialogue box, the name plate. Three-tone gradient, chamfered corners, hard outline.
3. **Magenta is the speaker/entity colour.** It names who is talking and highlights proper nouns inside body text. It appears nowhere else.
4. **Pure saturated primaries mark interactive geometry** — cyan and green zone outlines, red map boundary, yellow selection outline, pink reticle — always over muted, textured, low-contrast backdrops. The contrast ratio between "the world" and "the affordances" is enormous and deliberate.
5. **Counts are white numerals in the bottom-right of the thing being counted**, with no label.
6. **Glyph plus letter code**, not words. `DP`/`SP`/`M1`/`BP`/`M2`/`EP` each pair a two-letter code with a tiny illustration; corner buttons are glyph-only; the card banner uses icons for attribute, level, ATK and DEF. Almost no UI text anywhere outside dialogue and menu values.
