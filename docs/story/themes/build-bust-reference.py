"""Compile the generic bust circumference sheet as a portable scrollable row."""
from pathlib import Path
import base64
import subprocess

OUT = Path(__file__).resolve().parent

def main():
    image = OUT / 'generic-bust-reference-30-120.png'
    review = image.with_suffix('.webp')
    subprocess.run(['magick', str(image), '-quality', '88', str(review)], check=True)
    encoded = base64.b64encode(review.read_bytes()).decode()
    html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Generic character — bust circumference reference</title><style>
    :root{color-scheme:dark;--foreground:#ede8ed;--muted:#bcb1bf;--primary:#edb7d0;--border:#5d505f;--font-sans:system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;color:var(--foreground);font:15px/1.6 var(--font-sans)}h1{font-size:26px;line-height:1.25;font-weight:550;margin:0 0 12px}p{max-width:80ch;margin:0 0 16px;color:var(--muted)}.row{max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-color:var(--primary) transparent;padding-bottom:16px}.row:focus-visible{outline:2px solid var(--primary);outline-offset:3px}.row img{display:block;width:3200px;max-width:none;height:auto}a{color:var(--primary)}footer{border-top:1px solid var(--border);padding-top:16px;margin-top:20px;font-size:13px}
    </style></head><body><main><h1>Generic character · bust circumference</h1><p>30–120 cm, in 10 cm steps. Same adult model, clothing, pose and framing across ten references. Circumference is measured around the fullest part of the bust; labels record the project’s author-specified values.</p><p>Scroll sideways or swipe. Keyboard: focus the row and use the arrow keys.</p><div class="row" tabindex="0" role="region" aria-label="Ten bust circumference references, from 30 to 120 centimetres, in one horizontal row"><img src="data:image/webp;base64,'''+encoded+'''" alt="Ten fully clothed adult character references labeled 30, 40, 50, 60, 70, 80, 90, 100, 110 and 120 cm, arranged left to right."></div><footer>Generic reference for character sheets. Blaise’s recorded selection: 40 cm. The previous 80–120 cm sheet remains preserved separately.</footer></main></body></html>'''
    (OUT / 'bust-circumference-reference.html').write_text(html)
    print('Built one scrollable row with the ten-size generic sheet; images embedded for offline viewing.')

if __name__ == '__main__':
    main()
