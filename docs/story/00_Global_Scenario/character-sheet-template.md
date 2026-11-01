# Character sheet template

> Reference method for every era character. Modular YAML template; character facts remain undecided until explicitly established.

Copy [`character-template/`](character-template) into the character’s era directory as `<character-id>/`. Start from [`character.yaml`](character-template/character.yaml), the entry point linking every part. The YAML template replaces the previous single-document template for new sheets; the 23 Chapter 1 cast members now use this structure. Their old individual Markdown files redirect to canonical dossiers.

## Main file and ownership

`character.yaml` contains only the schema version and relative links under `parts`. It brings the complete character dossier together without duplicating facts or assets. The dossier compiler resolves each part relative to this main file. Plain YAML does not automatically include files; consumers must resolve these links explicitly. The gallery reads the same dossiers. Run `python scripts/character_dossiers.py --output generated/story/characters-compiled.yaml` to validate and compile the cast (Python 3 with PyYAML).

One character has one owning dossier in the era where they appear. Later eras reference that dossier and put era-specific developments in `story-arc.yaml`; do not copy the entire character. The cast index links each character’s `character.yaml`.

## Proposed files

| File | Owns | Use |
|---|---|---|
| `character.yaml` | Main entry point and links to all included parts | Every character |
| `identity.yaml` | Stable ID, name, aliases, era, age, role, rank, first appearance | Core |
| `appearance.yaml` | Body, literal measurements with units, hair, eyes, face, distinguishing features, visual invariants | Core |
| `fashion.yaml` | Outfit definitions, seasonal uniforms, accessories, required/excluded elements | Core |
| `backstory.yaml` | Origin, family history, past events, academy history, timeline | Core |
| `personality.yaml` | Temperament, values, fears, habits, contradictions and behavior | Core |
| `motivations.yaml` | Visible desire, deeper need, weaknesses, public/private intent, goals | Core |
| `relationships.yaml` | Connections to stable character IDs, dynamics, conflicts and their evolution | Core |
| `open-questions.yaml` | Unresolved facts, options and owner questions | Core |
| `story-arc.yaml` | Starting state, pressure, revelations and end state per era/chapter | When developed |
| `duel.yaml` | Deck identity, strategy, duel behavior, stakes, reactions and spirit relationship | Duelists |
| `voice.yaml` | Speech style, vocabulary, mannerisms, approved dialogue links and audio direction | Speaking characters |
| `abilities.yaml` | Practical skills, supernatural abilities and their limitations | When relevant |
| `decisions.yaml` | Dated selections, rationale, provenance and superseded decisions | When decisions need tracking |

The complete template includes all proposed parts so authors can inspect the structure. Remove unused optional files and their links when creating a dossier. Do not create empty files for every conceivable concern. Split an additional part only when it has an independent responsibility.

## Record conventions

- Use `appearance.yaml` (standard English spelling).
- Unknown numeric values use `null`; unknown prose uses `TBD`. An empty list means no entries have been recorded.
- Measurements are literal; keys name their units, such as `bustCircumferenceCm`. Link the shared 30–120 cm reference rather than duplicating it.
- Outfit entries use stable IDs such as `casual`, `academic-summer` and `academic-winter`. Clothing rules belong in `fashion.yaml`; physical features belong in `appearance.yaml`.
- Store all character-owned assets directly under `<character-id>/assets/`: illustrations, outfit references, expressions, sprites, portraits, audio and exact generation prompts. Link them where mentioned in the owning YAML part, using paths relative to the character folder such as `assets/academic-winter.png`. There is no separate asset inventory.
- Keep image, prompt, selection status and optional generation provenance/checksum together beside the relevant feature or outfit. Mark earlier references as studies or archived in that same part. Exact generation prompts remain immutable historical records. Shared references remain linked to their shared location.
- Relationships reference the other character’s stable ID. Arc developments identify their era/chapter and link the owning scenario instead of duplicating arc beats or approved dialogue.
- `decisions.yaml` records history and links the affected part. The current value lives only in its owning part.
- Character facts, selected visual designs, proposals and archived studies retain explicit status. Moving content into YAML does not approve undecided details.

## Example entry structures

```yaml
# fashion.yaml
outfits:
  - id: academic-winter
    status: current
    description: TBD
    accessories: []
    excludedElements: []
    image: assets/academic-winter.png
    prompt: assets/academic-winter-prompt.txt

# appearance.yaml
portrait: assets/portrait.png

# voice.yaml
voiceSample: assets/voice-sample.ogg

# relationships.yaml
connections:
  - characterId: TBD
    dynamic: TBD
    conflict: TBD
    evolution: TBD

# story-arc.yaml
developments:
  - era: TBD
    chapter: TBD
    startingState: TBD
    pressurePoint: TBD
    revelation: TBD
    endState: TBD
    scenario: TBD

# decisions.yaml
entries:
  - id: TBD
    date: null
    status: proposed
    affectedPart: appearance.yaml
    decision: TBD
    source: TBD

# open-questions.yaml
questions:
  - id: TBD
    part: identity.yaml
    question: TBD
    status: open
```
