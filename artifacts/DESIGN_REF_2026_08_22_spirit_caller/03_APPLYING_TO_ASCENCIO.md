# Applying it to Ascencio

Ascencio is not a school on an island and should not become one. What is portable is the **presentation grammar** — how a 256×192 screen made a card game readable, how it separated world from affordance, and how it got atmosphere for almost nothing.

Ascencio's existing surfaces, for reference: `src/styles/tokens.css` (dark token set, `--bg #08101f`, `--accent #73daca`, six rarity halos), `src/story/styles.css` (scoped `.story-app`, 44 px minimum button height, Inter), `src/story/screens/NarrativeScreen.svelte`, `IllustratedMapScreen.svelte`, `PreBattleScreen.svelte`, `src/story/shop/`, and the semantic DOM duel field under `src/battle/field/`.

Ids `T1`–`T10` for citation.

---

## T1 — Separate the world from the affordances by saturation, not by brightness

**What Spirit Caller did.** The duel mat is brown dirt or dull green photographic noise. The zone outlines are `#00FFFF` and `#00FF00` — literal full-saturation primaries. The map is flat mid-tone greens and greys; the boundary is `#FB0000` and the cursor is a hot pink ring. Nothing muted is interactive and nothing interactive is muted.

**Ascencio.** The token set is currently a single cool family — navy surfaces, teal accent, pale text — so everything sits in a narrow saturation band and interactive elements are distinguished mostly by *brightness* and border colour. On a duel field with 12+ zones plus piles plus a hand, brightness alone will not carry it.

The transferable rule: pick one saturation tier that means "you can act on this" and refuse to use it for decoration. Ascencio already half-does this with the rarity halos and with `--danger` for cancelling actions; the duel field is where it needs stating explicitly.

## T2 — Zone type by stroke colour, card type by frame colour

**What Spirit Caller did.** Monster zones cyan, spell/trap zones green, always, on both sides of the field. Cards themselves are art plus a coloured frame — orange effect, purple fusion, tan normal, green spell, magenta trap — with no text at all at field size. The player reads *what kind of thing is where* without reading a single word.

**Ascencio.** The DOM field can do this with `outline-color` per zone kind and a frame class per card type, and both are cheap CSS. Worth deciding deliberately rather than inheriting whatever the card art brings, because at small sizes the frame *is* the type label.

## T3 — Counts as bare numerals in the corner of the thing counted

**What Spirit Caller did.** Deck `35`, extra deck `1`, graveyard piles — a white numeral in the bottom-right of the pile tile, no label, no background chip.

**Ascencio.** Same pattern, and it is one span per pile. It also solves the problem of labelling piles that the player already recognises by position.

## T4 — Code plus glyph, never words

**What Spirit Caller did.** The phase rail is six tiles reading `DP` `SP` `M1` `BP` `M2` `EP`, each with a tiny illustration, connected by arrows, with the active one lit. Corner buttons on the map are glyph-only. The card banner uses icons for attribute, level, ATK and DEF. Outside dialogue and menu values there is almost no prose in the interface.

**Ascencio.** A duel needs a phase affordance whatever the visual language, and a vertical rail of six short codes with a lit current state is a compact, proven answer that survives a narrow viewport. Note this cuts against accessibility if done naively — the code needs an accessible name even when the visible label is two letters, which the `data-cy` convention and normal `aria-label` practice already accommodate.

## T5 — The dialogue box: a real spec worth copying

Measured from the shipped game, and it is a better-specified narrative box than most:

- Full-width, lower ~30% of the screen
- Steel bevel frame: highlight `#98A1A6`, mid `#73868F`, shade `#606870`, hard keyline `#161210` outside it, chamfered corners
- Interior deep navy `#151F50` with horizontal scanline banding and a lighter gloss band at the top inner edge
- **Name plate as a separate tab overlapping the box's top-left**, not a line inside the box
- Speaker name in magenta `#FB61D3`
- Body text white, **two lines**, ~16 px cap height on a 192 px screen — enormous relative to the viewport
- **Proper nouns inside body text set in the same magenta as the speaker name**
- System messages reuse the box with the name tab omitted
- Advance indicator is a pictorial icon bottom-right, not a blinking triangle

**Ascencio.** `NarrativeScreen.svelte` already renders speaker, kind (`dialogue` / `narration` / `thought`) and text. Three things here are directly actionable: the **name tab as a separate overlapping element** rather than a heading inside the box; the **one reserved colour for speaker identity, reused for proper nouns in the prose**; and **omitting the tab for narration**, which Ascencio's `speaker: null` beats already model. The scanline texture and steel bevel are period costume — take them only if the art direction wants that register.

## T6 — Time of day as a colour grade over one render

**What Spirit Caller did.** Every environment ships as three variants of the same pre-rendered image — day, sunset, night — laid out as triplets in the background atlas. Measured: sunset is a warm multiply holding red and cutting green/blue by roughly a third; night darkens to about 30% with a blue-violet cast.

**Ascencio.** This is the highest atmosphere-per-byte idea in the entire reference and it costs one CSS filter or one blended overlay per scene. `StoryBeat` already carries a `background` field (`station` / `concourse` / `arena`); a second axis of grade over the same asset multiplies the scene count without touching the asset pipeline. It also gives the prologue's rain-lit register somewhere to go.

Rough starting values, derived from the measured means:

```css
/* over the same background image */
.grade-day    { filter: none; }
.grade-sunset { filter: sepia(.35) saturate(1.3) hue-rotate(-18deg) brightness(1.02); }
.grade-night  { filter: brightness(.42) saturate(.75) hue-rotate(200deg) contrast(1.1); }
```

Tune against the art; the numbers are a starting point, not a spec.

## T7 — Props are backgrounds, not menu items

**What Spirit Caller did.** The hub room is a pre-rendered interior; tapping the closet, the desk, the bed or the computer cuts to a full-screen render of that prop. The ripped atlas confirms it — an open closet, a monitor on a desk, a rug with a duel disk on it, magazines, each occupying its own full 256×192 cell. The only chrome is a notification badge in the letterbox margin.

**Ascencio.** Relevant if a between-runs home surface ever appears. The point is not the room; it is that a menu can be a place, at the cost of one image per verb and zero new interaction patterns.

## T8 — The map: flat colour, hard edges, a token and a reticle

**What Spirit Caller did.** A stylised isometric diorama in flat saturated colour with black outlines — grass `#019530`, sand `#FBC300`, water `#0069B2` with horizontal stripe banding, out-of-bounds flat grey `#616169`, and a **pure red 2 px polygon edge** separating walkable from not. The building under the cursor is outlined bright yellow. The player is a **gold cone token with a shadow**, not a character sprite. The cursor is a pink ring with red crosshair ticks.

Reviewers disliked the *interaction* — dragging a stylus around to find opponents was called "a fairly stupid idea" by one and "nothing special" by another — while saying nothing against the drawing. Take the drawing, not the sweep.

**Ascencio.** `IllustratedMapScreen.svelte` renders a small closed set of nodes. Three portable pieces: a **token rather than an avatar** (abstraction survives art changes), a **hard boundary line** instead of a fade for the edge of the reachable world, and a **single reserved highlight colour** for the node under focus.

## T9 — Menu chrome: three colours, big targets, no lists

**What Spirit Caller did.** Striped navy background `#081763`, crimson data panels `#920118` with the label in the panel's top-left corner and the value centred, pale ice-blue gradient buttons `#B1C7EF → #99B0DE` with navy glyphs, and a cyan focus ring `#83E6FB` drawn *outside* the control. Touch targets are ~40×36 px on a 256-wide screen — roughly a seventh of the screen width each.

**Ascencio.** The scale is already right: `.story-app button` sets a 44 px minimum height, and `feedback-vn.md` asks for large centred choice buttons and red for cancelling actions. Two details are still worth stealing: **label inside the panel, value centred** as the standard field row, and **focus ring outside the control** so it never eats the button's own border.

## T10 — Audio hooks, when audio arrives

Four cheap hooks: a summon stinger, an escalated stinger reserved for the top-tier summon, a unique one for the alternate win condition, and a favourable/unfavourable music swap driven by game state. Ascencio's audio is absent and its controls are disabled placeholders, so this is a greenfield note. The mistake to avoid is already documented: the shipped game's *final* duel plays the ordinary battle theme despite four tiers existing.

---

## What not to take

- **The density.** Both surviving reviews call the interface overloaded; one calls the whole handheld line *"hacked together"*. Spirit Caller fits everything on 256×192 by cramming. Ascencio has a browser viewport and no such excuse.
- **The stylus-sweep search.** Independently disliked by two outlets.
- **Any licensed asset**: the parent wordmark, the eye motif, the GX block, dorm names and colours as *names*, card frames, and the commercially licensed fonts. Substitutes are listed in `01_IDENTITY.md`.

Konami screenshots were read for this reference but deliberately **not vendored into the repo** — they are cited by URL. `src/story/assets/PROVENANCE.md` records that all placeholder art is authored in-repo, and that discipline should hold for anything this reference inspires.
