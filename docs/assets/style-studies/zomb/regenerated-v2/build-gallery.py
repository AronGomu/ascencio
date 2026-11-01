"""Build the current Zomb gallery and its portable single-file edition."""

from concurrent.futures import ThreadPoolExecutor
from html import escape
from pathlib import Path
import base64
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / "scripts"))
from character_dossiers import gallery_character, index_paths

OUT = Path(__file__).resolve().parent
BASE = OUT.parent


def compress(source, target):
    if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
        subprocess.run(['magick', str(source), '-resize', '900x1350>', '-quality', '86', str(target)], check=True)
    return target


def prepare(character):
    identity = character['id']
    image = OUT / character.get('image', identity + '.png')
    previous = BASE / character['previous']
    if not image.is_file() or not previous.is_file():
        raise FileNotFoundError(f'Missing design for {identity}')
    return character, compress(image, image.with_name(image.stem + '-review.webp')), compress(previous, previous.with_name(previous.stem + '-review.webp'))


def render_character(character, image, previous):
    identity = character['id']
    name = escape(character['name'])
    proposal = (character.get('proposal') or identity == 'zen') and character.get('designStatus') != 'current'
    status = 'Style reference' if identity == 'style-reference' else 'Current design' if character.get('designStatus') == 'current' else 'Design proposal' if proposal else 'Character design'
    role = character.get('role', 'Violet Academy main cast. Character identity follows the current story sheet.')
    if identity == 'blaise':
        role = "Blaise is Finn’s childhood friend. She retains her name and uses the owner-selected short-haired gothic appearance."
        if character.get('selectedHairClip'):
            role += " Selected accessory: black blushing spider clip, with pink cheeks and bow. No spider pendant. Academic clothing has no spider/web motifs."
            if character.get('bustCircumferenceCm'):
                role += f" Selected bust circumference: {character['bustCircumferenceCm']} cm."
    prompt = escape((OUT / character.get('promptFile', identity + '-prompt.txt')).read_text())
    query = escape((character['name'] + ' ' + role + ' ' + character['subject']).lower(), quote=True)
    extra = '<p class="proposal">Appearance is a visual proposal; the written story role is unchanged.</p>' if proposal and identity != 'style-reference' else ''
    wardrobe = ''
    clip_studies = ''
    if character.get('hairClipOptions'):
        choices = []
        for option in character['hairClipOptions']:
            review = OUT / option['review']
            choices.append(f'<figure><img src="{review}" alt="Cute spider hair clip option {option["id"]}: {escape(option["name"])}" loading="lazy"><figcaption>{option["id"]} · {escape(option["name"])}</figcaption></figure>')
        label = escape(character.get('hairClipStudyLabel', 'Cute spider hair clips'))
        clip_studies = f'<details class="extras" open><summary>{label} · {len(choices)} options</summary><p class="history-note">Choose by number. These options have not replaced the current clip on any outfit.</p><div class="clip-grid">' + ''.join(choices) + '</div></details>'
    if character.get('wardrobe'):
        figures = []
        for outfit in character['wardrobe']:
            source = OUT / outfit['image']
            review = compress(source, source.with_name(source.stem + '-review.webp'))
            outfit_prompt = escape((OUT / outfit['promptFile']).read_text())
            key = 'wardrobe-' + outfit['id']
            figures.append(f'<div><figure><img src="{review}" alt="Blaise wearing {escape(outfit["name"])}" loading="lazy"><figcaption>{escape(outfit["name"])}</figcaption></figure><details class="extras"><summary>Outfit prompt</summary><button type="button" data-copy="{key}">Copy prompt</button><span class="copy-status" role="status" aria-live="polite"></span><pre class="prompt" id="{key}">{outfit_prompt}</pre></details></div>')
        label = escape(character.get('wardrobeLabel', 'Spider-gothic wardrobe'))
        wardrobe = f'<details class="extras" open><summary>{label} · {len(figures)} outfits</summary><div class="wardrobe-grid" style="--wardrobe-columns:{len(figures)}">' + ''.join(figures) + '</div></details>'
        if character.get('scaleComparisonStudy'):
            study = character['scaleComparisonStudy']
            comparison = OUT / study['comparison']
            sizes = study['sizes']
            wardrobe += f'<p class="history-note"><a href="{comparison}">Open all {study["originalImageCount"]} casual/academic scale comparisons ({min(sizes)}–{max(sizes)} cm)</a></p>'
    return f'''<details class="character" id="{identity}" data-search="{query}" {'open' if identity == 'blaise' else ''}>
<summary class="summary"><svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg><h2>{name}</h2><span class="tag">{status}</span></summary>
<div class="content">{clip_studies}{wardrobe}<div class="design"><figure><img src="{image}" alt="{name}, regenerated Zomb character design without background stars" loading="lazy"><figcaption>Current revision · Zomb character rendering · plain review backdrop</figcaption></figure>
<div class="notes"><h3>{name}</h3><p>{escape(role)}</p>{extra}<details class="extras"><summary>Appearance brief</summary><p>{escape(character['subject'])}</p></details><p class="proposal">The neutral backdrop is a presentation choice. Zomb defines the character rendering only.</p></div></div>
<details class="extras"><summary>Compare with earlier version</summary><p class="history-note">Earlier imagery is retained as a historical reference; stars are not part of the current style.</p><div class="history-grid"><figure><img src="{previous}" alt="{name} earlier reference" loading="lazy"><figcaption>Earlier reference</figcaption></figure><figure><img src="{image}" alt="{name} current star-free revision" loading="lazy"><figcaption>Current revision</figcaption></figure></div></details>
<details class="extras"><summary>Generation prompt</summary><button type="button" data-copy="prompt-{identity}">Copy prompt</button><span class="copy-status" role="status" aria-live="polite"></span><pre class="prompt" id="prompt-{identity}">{prompt}</pre></details></div></details>'''


def main():
    characters = [gallery_character(path) for path in index_paths(OUT / 'characters.yaml')]
    # Blaise leads; the source iteration is an optional reference after the cast.
    characters.sort(key=lambda c: (0 if c['id'] == 'blaise' else 3 if c['group'] == 'reference' else 1 if c['group'] == 'main' else 2))
    with ThreadPoolExecutor(max_workers=4) as pool:
        prepared = list(pool.map(prepare, characters))
    sections = '\n'.join(render_character(*item) for item in prepared)
    nav = ''
    for group, label in [('main', 'Main characters'), ('supporting', 'Supporting cast'), ('reference', 'Style reference')]:
        rows = ''.join(f'<li><a href="#{c["id"]}" data-target="{c["id"]}">{escape(c["name"])}</a></li>' for c in characters if c['group'] == group)
        nav += f'<div class="index-group"><h3>{label}</h3><ul>{rows}</ul></div>'
    css = (OUT / 'gallery.css').read_text()
    js = (OUT / 'gallery.js').read_text()
    style = escape((BASE / 'Zomb-style.md').read_text())
    html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zomb — character design index</title><style>{css}</style></head><body><div class="layout">
<button class="backdrop" id="index-backdrop" aria-label="Close character index" type="button" hidden></button>
<aside class="sidebar" id="character-index" aria-label="Character index"><button class="close-index" id="index-close" type="button">Close</button><h2>Character index</h2><label for="index-search">Find a character</label><input id="index-search" type="search" placeholder="Name or role" autocomplete="off"><p class="count" id="result-count" role="status" aria-live="polite">24 designs</p><nav aria-label="Characters">{nav}</nav></aside>
<main class="main"><h1>Zomb character designs</h1><p class="intro">The full cast, regenerated without the stars. Open a character section or jump directly from the index.</p><div class="toolbar"><button class="mobile-index" id="index-toggle" type="button" aria-controls="character-index" aria-expanded="false">Character index</button><button id="expand-all" type="button">Expand all</button><button id="collapse-all" type="button">Collapse all</button></div>
<p class="scope">23 owner-selected current cast designs + the original style reference. Blaise retains her name and uses the short-haired gothic appearance.</p><details class="extras"><summary>About Zomb style</summary><div class="style-text">{style}</div></details><p class="empty" id="no-results" hidden>No matching character. Try another name or role in the index.</p>{sections}<footer>Regenerated with the built-in image tool. Original PNGs and exact prompts are saved in each character’s assets folder. Earlier studies remain available in each comparison section. All content is available offline in the standalone edition.</footer></main></div><script>{js}</script></body></html>'''
    (OUT / 'gallery.html').write_text(html)
    def inline(match):
        path = Path(match.group(1))
        return 'src="data:image/webp;base64,' + base64.b64encode(path.read_bytes()).decode() + '"'
    standalone = re.sub(r'src="(/[^\"]+\.webp)"', inline, html)
    (OUT / 'gallery-standalone.html').write_text(standalone)
    for filename, content in [('comparison.html', html), ('comparison-standalone.html', standalone)]:
        target = BASE / filename
        backup = BASE / filename.replace('.html', '-v1.html')
        if target.exists() and not backup.exists(): backup.write_bytes(target.read_bytes())
        target.write_text(content)
    print(f'Built {len(characters)} collapsible sections; standalone {len(standalone) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
