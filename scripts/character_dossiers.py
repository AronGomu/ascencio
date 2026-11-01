"""Resolve, validate and compile the documentation-only modular character dossiers.

Requires PyYAML. No runtime story content or save data is changed.
"""
from argparse import ArgumentParser
from pathlib import Path
import hashlib
import yaml

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = ROOT / 'docs/story/01_DM_Era/characters/characters.yaml'


def read_yaml(path):
    return yaml.safe_load(path.read_text())


def load_dossier(path):
    """Resolve part links relative to the main character.yaml, keeping one owning part per fact."""
    path = path.resolve()
    manifest = read_yaml(path)
    if not isinstance(manifest, dict) or manifest.get('schemaVersion') != 1:
        raise ValueError(f'Unsupported character manifest: {path}')
    parts = manifest['parts']
    if len(parts.values()) != len(set(parts.values())):
        raise ValueError(f'Duplicate part file in {path}')
    dossier = {}
    for name, link in parts.items():
        target = (path.parent / link).resolve()
        if not target.is_relative_to(path.parent):
            raise ValueError(f'Part escapes character folder: {target}')
        value = read_yaml(target)
        if not isinstance(value, dict):
            raise ValueError(f'Character part must be a mapping: {target}')
        dossier[name] = value
    for name in ['identity', 'appearance', 'fashion', 'backstory', 'personality',
                 'motivations', 'relationships', 'open-questions']:
        if name not in dossier:
            raise ValueError(f'Missing core part {name}: {path}')
    if dossier['identity']['id'] != path.parent.name:
        raise ValueError(f'Character ID differs from folder name: {path}')
    return dossier


def index_paths(index):
    links = read_yaml(index)
    if not isinstance(links, list) or not all(isinstance(link, str) for link in links):
        raise ValueError(f'Expected a links-only index: {index}')
    paths = [(index.parent / link).resolve() for link in links]
    if len(paths) != len(set(paths)):
        raise ValueError(f'Duplicate character in index: {index}')
    return paths


def validate_assets(value, folder):
    """Check every local asset link, including links within narrative text."""
    import re
    if isinstance(value, dict):
        for child in value.values():
            validate_assets(child, folder)
    elif isinstance(value, list):
        for child in value:
            validate_assets(child, folder)
    elif isinstance(value, str):
        candidates = [value] if value.startswith('assets/') and '\n' not in value and ' ' not in value else []
        candidates += re.findall(r'\]\((assets/[^)]+)\)', value)
        for candidate in candidates:
            target = (folder / candidate.split('#')[0]).resolve()
            if not target.is_relative_to(folder / 'assets') or not target.exists():
                raise ValueError(f'Missing or escaped asset: {folder}: {candidate}')


def compile_cast(index):
    paths = index_paths(index)
    characters = [load_dossier(path) for path in paths]
    ids = [c['identity']['id'] for c in characters]
    if len(ids) != len(set(ids)):
        raise ValueError('Character IDs must be unique')
    for path, character in zip(paths, characters):
        validate_assets(character, path.parent)
        for relation in character['relationships']['connections']:
            if relation['characterId'] not in ids:
                raise ValueError(f'Unknown relationship target: {relation}')
        design = character['appearance']['currentDesign']
        image = path.parent / design['image']
        if hashlib.sha256(image.read_bytes()).hexdigest() != design['sha256']:
            raise ValueError(f'Selected image hash mismatch: {image}')
        for reference in character.get('story-arc', {}).get('scenarioReferences', []):
            if not (path.parent / reference['path']).is_file():
                raise ValueError(f'Missing arc reference: {reference}')
    return {'schemaVersion': 1, 'assetPathBase': 'Paths within each character resolve relative to its source character.yaml.',
            'characters': [{'source': str(path.relative_to(ROOT)), **value} for path, value in zip(paths, characters)]}


def gallery_character(path):
    """Adapt a canonical dossier to the existing design-gallery presentation."""
    if path.name != 'character.yaml':
        return read_yaml(path)  # Shared style reference is not a cast member.
    dossier = load_dossier(path)
    identity, appearance, fashion = (dossier[key] for key in ['identity', 'appearance', 'fashion'])
    folder = path.parent
    absolute = lambda link: str((folder / link).resolve())
    design = appearance['currentDesign']
    character = {'id': identity['id'], 'name': identity['name'], 'group': identity['group'],
                 'designStatus': 'current', 'proposal': False,
                 'role': identity['role'] if identity['role'] != 'TBD' else identity['definitionStatus'],
                 'subject': appearance['designBrief'], 'image': absolute(design['image']),
                 'promptFile': absolute(design['prompt']),
                 'previous': absolute(appearance['previousDesign']['image']),
                 'bustCircumferenceCm': appearance['measurements'].get('bustCircumferenceCm')}
    if identity['id'] == 'blaise':
        character['selectedHairClip'] = next(item for item in fashion['accessories'] if item['id'] == 'spider-hair-clip')
        character['wardrobeLabel'] = 'Current outfit references'
        character['wardrobe'] = [{**outfit, 'name': outfit.get('name', outfit['id']),
                                  'image': absolute(outfit['image']), 'promptFile': absolute(outfit['prompt'])}
                                 for outfit in fashion['outfits']]
        study = fashion['comparisonStudy']
        character['scaleComparisonStudy'] = {'comparison': absolute(study['path']),
                                            'sizes': study['bustCircumferencesCm'],
                                            'originalImageCount': study['imageCount']}
    return character


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--index', type=Path, default=DEFAULT_INDEX)
    parser.add_argument('--output', type=Path, help='Optional generated compiled YAML destination')
    args = parser.parse_args()
    compiled = compile_cast(args.index.resolve())
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(yaml.safe_dump(compiled, sort_keys=False, allow_unicode=True, width=110))
    print(f'Validated {len(compiled["characters"])} character dossiers, local assets, relationships, scenario links and current-image hashes.')


if __name__ == '__main__':
    main()
