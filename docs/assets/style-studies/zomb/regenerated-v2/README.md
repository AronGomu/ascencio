# Zomb character gallery · revision 2

This current character-design gallery contains **23 cast designs and one style reference**.
Blaise retains her name and uses the original short-haired gothic appearance selected
by the owner. The owner selected all 23 cast designs as the currently used visual references.
Written story canon continues to own character facts.

[Zomb style](../Zomb-style.md) defines character rendering: simplified retro anime
cel drawing, matte surfaces, restrained shading, CRT scanlines and subtle contour
ghosting. It requires neither stars nor a particular background. The plain gray
backdrop in these revisions is a separate choice for reviewing the characters.

Open [the current gallery](gallery.html) locally on this checkout, or use
[the offline standalone edition](gallery-standalone.html), which embeds its images.
The parent [comparison](../comparison.html) and
[standalone comparison](../comparison-standalone.html) are aliases of these latest
outputs. [Earlier comparison](../comparison-v1.html) and
[earlier standalone comparison](../comparison-standalone-v1.html) preserve v1.

The gallery uses native collapsible character sections, with Blaise initially open.
A searchable desktop sidebar becomes a modal index drawer on mobile. Expand and
collapse controls, appearance briefs, earlier/current comparisons and copyable
exact prompts support review without crowding the artwork.

The [character index](characters.yaml) links the 23 canonical `character.yaml` dossiers and the shared style reference. Each cast member owns their story parts and local `assets/`; this directory retains gallery source, shared style assets and generated gallery HTML. Earlier input metadata survives only as explicitly historical provenance inside each character’s assets.

[Gallery CSS](gallery.css), [gallery behavior](gallery.js), [the builder](build-gallery.py) and the canonical dossier adapter in `scripts/character_dossiers.py` produce the review. Rebuild from the repository root with Python 3, PyYAML and ImageMagick:

```sh
python scripts/character_dossiers.py
python docs/assets/style-studies/zomb/regenerated-v2/build-gallery.py
```

The builder creates current/previous WebP previews, both gallery editions and the
parent comparison aliases. Existing v1 HTML backups are preserved.

Validation for this revision covered static asset references and element IDs,
plus desktop and mobile render screenshots. The scoped review's two findings were
resolved and the reviewer accepted the result for this artifact. This is bounded
review evidence: live browser interaction and exhaustive runtime testing were not
performed.

Blaise’s current bust circumference is **40 cm**, a literal character measurement, superseding the earlier 80 cm choice. The current casual and academic references are Blaise’s local `assets/zomb-v2/blaise-scale-round5/40-casual.png` and `40-winter.png`. The selected hair clip is black Blushing charm, round 3 option 20. Spider pendants are removed; academic clothes use the plain Red winter uniform without spider or web motifs. Casual clothes retain web details.

The [30–120 cm comparison](../../../../story/01_DM_Era/characters/blaise/assets/zomb-v2/blaise-scale-round5/comparison-standalone.html) contains twenty renders, one scrollable row per outfit. The [YAML reference](../../../../story/themes/bust-circumference-reference.yaml) lists every circumference and its two images. Earlier outfit/accessory studies and exact prompts remain historical records.
