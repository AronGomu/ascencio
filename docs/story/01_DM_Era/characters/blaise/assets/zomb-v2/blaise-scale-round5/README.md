# Blaise — bust circumference reference

Twenty renders cover literal bust circumferences **30–120 cm in 10 cm steps**, each in casual clothing and the winter Red academic uniform. Blaise’s selected circumference is **40 cm**. Its casual and academic images are the current references.

- Hair clip: round 3, option 20, black fill, ivory eyes, pink cheeks and pink bow.
- No spider pendant. A plain choker is allowed.
- Academic clothing: plain Red uniform with academy crest; no spider or web motifs. The selected hair clip remains.
- Casual clothing retains web details.

The [YAML reference](../../../../../../themes/bust-circumference-reference.yaml) defines the measurement and lists both images for each value. [Design decisions](../blaise-design-decisions.json) and the generation [manifest](manifest.json) record the selection. Each original PNG retains its exact generation prompt; earlier prompt wording is historical provenance.

Open the [comparison](comparison.html) or [offline standalone edition](comparison-standalone.html). Each outfit has one horizontally scrollable row of ten cards, ordered 30–120 cm, with 40 cm marked selected.

Rebuild with Python 3 and ImageMagick:

```sh
python docs/story/01_DM_Era/characters/blaise/assets/zomb-v2/blaise-scale-round5/build-comparison.py
```
