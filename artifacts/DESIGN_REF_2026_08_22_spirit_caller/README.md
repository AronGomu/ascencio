# Spirit Caller — brand and UI aesthetics reference

Compiled 2026-08-22. Scope: **branding and visual/UI aesthetics only** — duel screen, menus, map, dialogue, chrome, colour, type, motion, audio identity. Gameplay systems, economy and narrative structure are deliberately out of scope and were removed from this set.

Subject: *Yu-Gi-Oh! GX Spirit Caller* (Nintendo DS, Konami; JP `遊戯王デュエルモンスターズGX SPIRIT SUMMONER` 2006-11-30, NA 2007-01-02).

## Contents

| File | Contents |
|---|---|
| `01_IDENTITY.md` | Logo lockup, measured + estimated palettes, typography with OFL substitutes, art-direction registers, audio identity, motion |
| `02_SCREENS.md` | Screen-by-screen anatomy observed from official screenshots: duel field, battle/summon top screen, dialogue, map, hub room, menus |
| `03_APPLYING_TO_ASCENCIO.md` | `T1`–`T10` — what to port into Ascencio's tokens, narrative screen, map, duel field and menus, and what to refuse |

Raw research and the rendered report live in `.tmp/` (ephemeral):

- `.tmp/RESEARCH_spirit_caller_visual_identity.md` — logo, colour, type, audio, brand voice, with sources and gaps
- `.tmp/RESEARCH_spirit_caller_ui_screens.md` — UI-specific source hunt, asset-rip inventory, screenshot URLs, and an explicit list of what no source covers
- `.tmp/RESEARCH_REPORT_spirit_caller.html` — rendered report

## Evidence quality

Better than the first pass, because the primary source turned out to exist.

**Measured, from the shipped product.** Konami's official screenshots survive on the Nintendo JP software page — twelve images at native 256×192, six top/bottom pairs, each with an official Japanese caption. They were downloaded, upscaled 4× nearest-neighbour, read pixel by pixel, and sampled with ImageMagick. Every hex in `01_IDENTITY.md` §2.1 and every layout claim in `02_SCREENS.md` comes from those images. Ripped asset sheets (character bust-ups, the background atlas, the character-maker atlas) supplied the art-direction findings, including that time of day is a colour grade of one render rather than separate art.

**Secondary, marked as such.** Interface *character* — density, animation quality, the stylus search — comes from the IGN and jeuxvideo.com reviews. Typography attribution comes from wiki transcription of embedded fonts. Audio structure comes from ROM-extracted sequence names.

**Still unknown, and flagged in place rather than guessed.** The title screen, deck editor, shop, PDA and save/load screens appear in no surviving official material. Life Point placement is *not* determinable from the six pairs. No manual scan, press kit or Konami minisite for this title exists in any archive searched — Konami published no screenshots at all, and the duel HUD has never been ripped. `02_SCREENS.md` marks these `NOT OBSERVED`.

Estimated values — the franchise gold, the institutional steel, the three rank colours — are labelled estimated wherever they appear. Konami published no colour specification for them.

## IP boundary

Spirit Caller is a live Konami / Shueisha / TV Tokyo / NAS property. This reference describes structural patterns and measured values; it is not a source of shippable assets.

Do not ship: the parent wordmark construction, the eye motif, the `GX` block, the subtitle treatment, dorm names, card frames, or any commercially licensed or `Yu-Gi-Oh!`-prefixed font file. OFL substitutes for every type slot are listed in `01_IDENTITY.md` §3.

Konami's screenshots were read for this work and **not vendored into the repo** — they are cited by URL at `https://www.nintendo.co.jp/ds/software/ayxj/ss{01..06}{a,b}.gif`. `src/story/assets/PROVENANCE.md` records that all placeholder art in this project is authored in-repo; that discipline holds for anything this reference inspires.

Ascencio's fiction is already its own — a rain-lit city, dead duel frequencies under an arena, Rin and Kael. Nothing here asks that to change.
