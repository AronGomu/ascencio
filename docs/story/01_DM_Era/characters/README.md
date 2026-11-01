# Duel Monsters Era character dossiers

All **23 cast members** have one canonical folder. Start from the [links-only cast index](characters.yaml) or a character below. Each `character.yaml` links the 13 focused YAML parts; character-owned artwork, prompts and studies live beneath that character’s `assets/` and are linked directly where relevant.

Current story facts, selected visual references, historical studies and unresolved details remain distinct. Supporting-role names, decks and histories have not been invented to fill templates. The shared staff and bully-group Markdown pages remain group context; old individual Markdown paths redirect to their owning dossiers.

| Character | Definition status |
|---|---|
| [Finn](finn/character.yaml) | mostly defined for Chapter 1 |
| [Sirius](sirius/character.yaml) | provisional name; strongly defined for Chapter 1 |
| [Alexis](alexis/character.yaml) | provisional name; strongly defined for Chapter 1 |
| [Chaz](chaz/character.yaml) | provisional name; Chapter 1 trajectory defined |
| [Zen](zen/character.yaml) | provisional name; narrative function established |
| [Atticus](atticus/character.yaml) | provisional name; Chapter 1 history and outcome defined |
| [Blaise](blaise/character.yaml) | name Blaise retained by the owner; short-haired gothic appearance selected |
| [Examiner](examiner/character.yaml) | needs definition |
| [Dean](dean/character.yaml) | needs definition |
| [Teacher / examiner support](examiner-support/character.yaml) | needs definition |
| [Shopkeeper](shopkeeper/character.yaml) | needs definition |
| [First Darkness agent](darkness-agent/character.yaml) | identity and name undefined |
| [Chaz Goon A](chaz-goon-a/character.yaml) | needs definition |
| [Chaz Goon B](chaz-goon-b/character.yaml) | needs definition |
| [Sirius Arc Bully A](sirius-bully-a/character.yaml) | needs definition |
| [Sirius Arc Bully B](sirius-bully-b/character.yaml) | needs definition |
| [Sirius Arc Bully C](sirius-bully-c/character.yaml) | needs definition |
| [Alexis Arc Bully A](alexis-bully-a/character.yaml) | needs definition |
| [Alexis Arc Bully B](alexis-bully-b/character.yaml) | needs definition |
| [Analytical Student](analytical-student/character.yaml) | needs definition |
| [PE Teacher](pe-teacher/character.yaml) | needs definition |
| [Mathematics / Statistics Teacher](math-teacher/character.yaml) | needs definition |
| [Third Teacher](third-teacher/character.yaml) | needs definition |

## Reading and compiling

Use the [sheet standard](../../00_Global_Scenario/character-sheet-template.md). `character.yaml` is a manifest; each link resolves relative to its character folder. Every YAML part’s local `assets/` links use that same folder as their base.

Compile and validate the complete cast from the repository root (Python 3 with PyYAML):

```sh
python scripts/character_dossiers.py --output generated/story/characters-compiled.yaml
```

Omit `--output` for validation only. The compiler checks part manifests, IDs, relationship targets, local asset links, scenario links and selected-image SHA-256 values. The generated compilation retains each character’s source manifest so relative assets can be resolved without copying the dossier.

Narrative paragraphs from the previous sheets are retained in their owning parts alongside structured fields. `assets/provenance/` holds exact historical inputs; its old links describe the pre-migration locations and are not current references. The gallery reads the same canonical dossiers through its adapter; no separate active character sheets are maintained under the style studies.
