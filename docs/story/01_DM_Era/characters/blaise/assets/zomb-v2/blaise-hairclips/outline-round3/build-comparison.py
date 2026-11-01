"""Compile twenty refinements of the preferred outline spider without changing the selected character design."""

from pathlib import Path
from html import escape
import base64
import json
import re
import subprocess

OUT = Path(__file__).resolve().parent


def main():
    options = json.loads((OUT / 'options.json').read_text())
    cards = []
    for option in options:
        identity = option['id']
        source = OUT / (identity + '.png')
        target = OUT / (identity + '-review.webp')
        if not source.is_file():
            raise FileNotFoundError(source)
        subprocess.run(['magick', str(source), '-resize', '640x640>', '-quality', '88', str(target)], check=True)
        prompt = escape((OUT / (identity + '-prompt.txt')).read_text())
        cards.append(f'<article id="option-{identity}"><h2>{identity} · {escape(option["name"])}</h2><figure><img src="{target}" alt="Option {identity}: {escape(option["name"])} cute spider hair clip"><figcaption>{escape(option["design"])}</figcaption></figure><details><summary>Exact prompt</summary><pre>{prompt}</pre></details></article>')
    html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blaise — twenty outline-spider variations</title><style>
    :root{color-scheme:dark;--foreground:#ece7ed;--muted:#b7abb9;--primary:#f0b8cf;--border:#594a58;--card:#211b23;--radius:12px;--font-sans:system-ui,sans-serif;--font-mono:ui-monospace,monospace}*{box-sizing:border-box}body{margin:0;font:15px/1.6 var(--font-sans);color:var(--foreground)}main{max-width:1400px;margin:auto}h1{font-size:clamp(28px,4vw,40px);letter-spacing:-.025em;font-weight:550;margin:0 0 10px}header p{color:var(--muted);max-width:70ch;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:24px 16px}article{min-width:0;border-top:1px solid var(--border);padding-top:12px}h2{font-size:16px;color:var(--primary);font-weight:550;line-height:1.4;margin:0 0 10px}figure{margin:0}img{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:var(--card)}figcaption{font-size:12px;color:var(--muted);margin-top:10px}details{margin-top:10px}summary{min-height:44px;cursor:pointer;padding:10px 0;font-size:12px}summary:focus-visible{outline:2px solid var(--primary);outline-offset:4px}pre{font:12px/1.65 var(--font-mono);white-space:pre-wrap;overflow-wrap:anywhere;background:var(--card);padding:12px;border-radius:var(--radius)}footer{font-size:12px;color:var(--muted);margin-top:28px;padding:20px 0;border-top:1px solid var(--border)}::selection{background:var(--primary);color:var(--card)}@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px}}@media print{details{display:none}.grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
    </style></head><body><main><header><h1>Blaise’s outline-spider variations</h1><p>Twenty refinements of your preferred outline version (round 2, option 04). Compare body shapes 01–08, bow treatments 09–14 and expressions 15–20. Choose by number within this third round; no final variation has been applied to the outfits.</p></header><div class="grid">''' + ''.join(cards) + '''</div><footer>Generated with the built-in image tool. Each original PNG and exact prompt is saved beside this page. No option has replaced the selected clip yet.</footer></main></body></html>'''
    (OUT / 'comparison.html').write_text(html)
    def inline(match):
        return 'src="data:image/webp;base64,' + base64.b64encode(Path(match.group(1)).read_bytes()).decode() + '"'
    portable = re.sub(r'src="(/[^\"]+\.webp)"', inline, html)
    (OUT / 'comparison-standalone.html').write_text(portable)
    print(f'Saved twenty labeled options; standalone {len(portable) / 1048576:.2f} MiB')


if __name__ == '__main__':
    main()
