"""Build the twelve-image clip/outfit/color comparison from its saved manifest."""

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
    if len(cases) != 12 or len({case['id'] for case in cases}) != 12:
        raise ValueError('Expected exactly twelve distinct images')
    sections = []
    for clip in ['17', '19', '20']:
        cards = []
        for case in (item for item in cases if item['clip'] == clip):
            source = OUT / (case['id'] + '.png')
            review = OUT / (case['id'] + '-review.webp')
            if not source.is_file():
                raise FileNotFoundError(source)
            subprocess.run(['magick', str(source), '-resize', '800x1200>', '-quality', '87', str(review)], check=True)
            prompt = escape((OUT / (case['id'] + '-prompt.txt')).read_text())
            label = escape(case['label'])
            cards.append(f'<article><h3>{label}</h3><figure class="outfit-{case["outfit"]}"><img src="{review}" alt="Blaise: {label}"></figure><details><summary>Inspect hair clip</summary><div class="clip-zoom"><img src="{review}" alt="Enlarged hair clip on Blaise: {label}"></div></details><details><summary>Exact prompt</summary><pre>{prompt}</pre></details></article>')
        sections.append(f'<details class="clip-section" id="clip-{clip}" open><summary>Clip {clip} · {escape(manifest["clipNames"][clip])}</summary><div class="matrix">' + ''.join(cards) + '</div></details>')
    html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blaise — twelve clip applications</title><style>
    :root{color-scheme:dark;--foreground:#ece7ed;--muted:#b7abb9;--primary:#f0b8cf;--border:#594a58;--card:#211b23;--radius:12px;--font-sans:system-ui,sans-serif;--font-mono:ui-monospace,monospace}*{box-sizing:border-box}body{margin:0;font:15px/1.6 var(--font-sans);color:var(--foreground)}main{max-width:1400px;margin:auto}h1{font-size:clamp(28px,4vw,40px);font-weight:550;letter-spacing:-.025em;margin:0 0 12px}header p{color:var(--muted);max-width:75ch}.index{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}.index a{color:var(--primary);min-height:44px;padding:8px 12px;border:1px solid var(--border);border-radius:6px;text-underline-offset:4px}.clip-section{border-top:1px solid var(--border);padding:16px 0 24px;scroll-margin-top:12px}.clip-section>summary{font-size:22px;color:var(--primary);cursor:pointer;padding:8px 0 16px}.matrix{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}article{min-width:0}h3{font-size:14px;font-weight:550;margin:8px 0 12px}figure{margin:0}img{display:block;width:100%;height:auto;aspect-ratio:2/3;object-fit:contain;background:var(--card)}.outfit-casual>img{object-fit:cover}.clip-zoom{aspect-ratio:1;overflow:hidden;background:var(--card)}.clip-zoom img{width:400%;max-width:none;height:auto;aspect-ratio:auto;object-fit:fill;transform:translateX(-42%)}article details{margin:8px 0}article summary{cursor:pointer;min-height:44px;font-size:12px;padding:10px 0}pre{font:12px/1.7 var(--font-mono);white-space:pre-wrap;overflow-wrap:anywhere;background:var(--card);padding:12px;border-radius:var(--radius)}summary:focus-visible,a:focus-visible{outline:2px solid var(--primary);outline-offset:4px}footer{font-size:12px;color:var(--muted);border-top:1px solid var(--border);padding:20px 0}::selection{background:var(--primary);color:var(--card)}@media(max-width:900px){.matrix{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}@media print{article details{display:none}.index{display:none}}
    </style></head><body><main><header><h1>Blaise — twelve clip applications</h1><p>''' + escape(manifest['description']) + '''</p><p>Three expressions × two outfits × two colors. The 80 cm proportion reference, Zomb rendering and character identity are preserved.</p></header><nav class="index" aria-label="Clip expressions"><a href="#clip-17">17 · Sleepy</a><a href="#clip-19">19 · Wink</a><a href="#clip-20">20 · Blush</a></nav>''' + ''.join(sections) + '''<footer>Exactly twelve original PNGs and exact generation prompts are saved beside this page. These are comparison variants; they do not replace the selected outfit references automatically.</footer></main></body></html>'''
    (OUT / 'comparison.html').write_text(html)
    def inline(match):
        return 'src="data:image/webp;base64,' + base64.b64encode(Path(match.group(1)).read_bytes()).decode() + '"'
    standalone = re.sub(r'src="(/[^\"]+\.webp)"', inline, html)
    (OUT / 'comparison-standalone.html').write_text(standalone)
    print(f'Built exactly twelve applications; standalone {len(standalone) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
