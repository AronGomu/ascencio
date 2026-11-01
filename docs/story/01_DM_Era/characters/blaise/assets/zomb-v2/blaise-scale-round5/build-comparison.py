"""Compile the outfit scale comparison in one scrollable row per outfit."""

from pathlib import Path
from html import escape
import base64
import json
import re
import subprocess

OUT = Path(__file__).resolve().parent


def main():
    manifest = json.loads((OUT / 'manifest.json').read_text())
    cases = manifest['images']
    expected = {(size, outfit) for size in manifest['sizes'] for outfit in ['casual', 'winter']}
    if len(cases) != len(expected) or {(c['bustCircumferenceCm'], c['outfit']) for c in cases} != expected:
        raise ValueError('Expected one unique render per size and outfit')
    sections = []
    for outfit, title in [('casual', 'Casual spider-gothic'), ('winter', 'Plain academic winter uniform')]:
        cards = []
        for case in sorted((c for c in cases if c['outfit'] == outfit), key=lambda c: c['bustCircumferenceCm']):
            source = OUT / (case['id'] + '.png')
            if not source.is_file():
                raise FileNotFoundError(source)
            review = OUT / (case['id'] + '-review.webp')
            subprocess.run(['magick', str(source), '-resize', '900x1350>', '-quality', '88', str(review)], check=True)
            size = case['bustCircumferenceCm']
            size_label = f'{size} cm'
            prompt = escape((OUT / (case['id'] + '-prompt.txt')).read_text())
            selected_level = manifest['selectedBustCircumferenceCm']
            selected = ' · currently selected circumference' if size == selected_level else ' · comparison'
            cards.append(f'<article><h3>{size_label}</h3><p class="status">{escape(selected.strip(" ·"))}</p><figure class="{outfit}"><img src="{review}" alt="Adult Blaise in {title}, bust circumference {size} cm"></figure><details><summary>Exact prompt</summary><pre>{prompt}</pre></details></article>')
        sections.append(f'<details class="outfit-section" id="{outfit}" open><summary>{title}</summary><p class="scroll-hint">Scroll sideways or swipe to compare all ten circumferences. Keyboard: focus the row and use the arrow keys.</p><div class="scale-scroll" tabindex="0" role="region" aria-label="{title}: horizontally scrollable size comparison"><div class="scale-grid">' + ''.join(cards) + '</div></div></details>')
    html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blaise — 30–120 cm outfit comparison</title><style>
    :root{color-scheme:dark;--foreground:#ece7ed;--muted:#b7abb9;--primary:#f0b8cf;--border:#594a58;--card:#211b23;--radius:12px;--font-sans:system-ui,sans-serif;--font-mono:ui-monospace,monospace}*{box-sizing:border-box}body{margin:0;font:15px/1.6 var(--font-sans);color:var(--foreground)}main{max-width:1500px;margin:auto}h1{font-size:clamp(28px,4vw,40px);font-weight:550;letter-spacing:-.025em;margin:0 0 12px}header p{max-width:80ch;color:var(--muted)}.index{display:flex;gap:12px;flex-wrap:wrap;margin:22px 0}.index a{color:var(--primary);min-height:44px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;text-underline-offset:4px}.outfit-section{padding:18px 0 28px;border-top:1px solid var(--border);scroll-margin-top:12px}.outfit-section>summary{cursor:pointer;font-size:22px;color:var(--primary);padding:8px 0 18px}.scroll-hint{color:var(--muted);font-size:12px;margin:0 0 14px}.scale-scroll{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scrollbar-width:auto;scrollbar-color:var(--primary) var(--card);padding-bottom:14px}.scale-scroll:focus-visible{outline:2px solid var(--primary);outline-offset:4px}.scale-grid{display:grid;grid-auto-flow:column;grid-auto-columns:clamp(220px,28vw,300px);gap:16px;width:max-content}.scale-grid>article{scroll-snap-align:start}article{min-width:0}h3{font-size:18px;font-weight:550;margin:0 0 4px}.status{font-size:11px;color:var(--muted);margin:0 0 12px;min-height:20px}figure{margin:0}img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain;background:var(--card)}figure.casual img{object-fit:cover}article details{margin:8px 0}article summary{cursor:pointer;font-size:12px;min-height:44px;padding:10px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 var(--font-mono);background:var(--card);padding:12px;border-radius:var(--radius)}summary:focus-visible,a:focus-visible{outline:2px solid var(--primary);outline-offset:4px}footer{font-size:12px;color:var(--muted);border-top:1px solid var(--border);padding:22px 0}::selection{background:var(--primary);color:var(--card)}@media print{article details{display:none}.index{display:none}.scale-scroll{overflow:visible}.scale-grid{grid-auto-flow:row;grid-template-columns:repeat(10,minmax(0,1fr));grid-auto-columns:auto;width:auto}}
    </style></head><body><main><header><h1>Blaise — 30–120 cm outfit comparison</h1><p>Literal bust circumference references from 30 to 120 cm in 10 cm steps, each shown in casual and academic clothing. The selected hair clip is the black blushing spider (round 3, option 20). No spider pendant on either outfit. Academic clothing has no spider or web motifs; the hair clip stays.</p><p>Blaise’s selected bust circumference is 40 cm. Other circumferences remain comparison references. Values are author-specified character measurements; original generation prompts remain available as historical records.</p></header><nav class="index" aria-label="Outfits"><a href="#casual">Casual · all ten circumferences</a><a href="#winter">Academic · all ten circumferences</a></nav>''' + ''.join(sections) + '''<footer>Twenty original renders and exact generation prompts are saved beside this comparison. Black-blush hair clip, pendant removal and plain academic clothing are recorded design decisions. Earlier images remain historical references.</footer></main></body></html>'''
    (OUT / 'comparison.html').write_text(html)
    def inline(match):
        return 'src="data:image/webp;base64,' + base64.b64encode(Path(match.group(1)).read_bytes()).decode() + '"'
    standalone = re.sub(r'src="(/[^\"]+\.webp)"', inline, html)
    (OUT / 'comparison-standalone.html').write_text(standalone)
    print(f'Built {len(cases)} outfit/scale renders in two scrollable rows; standalone {len(standalone) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
