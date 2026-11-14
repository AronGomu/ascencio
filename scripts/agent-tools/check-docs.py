"""Check supplied local documents; no crawling or application startup."""
import pathlib
import re
import sys
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

class Document(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.errors = []
        self.stack = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            if attrs['id'] in self.ids: self.errors.append('duplicate id: ' + attrs['id'])
            self.ids.add(attrs['id'])
        if 'href' in attrs: self.links.append(attrs['href'])
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}:
            self.stack.append(tag)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if self.stack and self.stack[-1] == tag: self.stack.pop()
    def handle_endtag(self, tag):
        if not self.stack or self.stack[-1] != tag: self.errors.append('unbalanced closing tag: ' + tag)
        else: self.stack.pop()

def check(file):
    p = pathlib.Path(file)
    if not p.exists(): return []  # staged deletion
    text = p.read_text()
    errors = []
    if p.suffix == '.html':
        doc = Document(); doc.feed(text)
        errors += doc.errors
        if doc.stack: errors.append('unclosed tags: ' + ', '.join(doc.stack))
        links = doc.links
        if 'data-theme="dark"' in text:
            # Explicit theme contract: require a background as well as text colors.
            if not re.search(r'background(?:-color)?\s*:', text): errors.append('dark document has no explicit background')
    else:
        links = re.findall(r'(?<!!)\[[^\]]*\]\(([^\s)]+)\)', text)
        doc = None
    for link in links:
        u = urlsplit(link.strip('<>'))
        if u.scheme or u.netloc or link.startswith('/'): continue
        target = p.parent / unquote(u.path) if u.path else p
        if not target.exists(): errors.append('missing link: ' + link); continue
        if u.fragment and target.suffix == '.html':
            other = doc if target == p and doc else Document()
            if other is not doc: other.feed(target.read_text())
            if unquote(u.fragment) not in other.ids: errors.append('missing anchor: ' + link)
    return [str(p) + ': ' + e for e in errors]

if __name__ == '__main__':
    errors = [e for f in sys.argv[1:] for e in check(f)]
    print('\n'.join(errors) if errors else 'Documentation links and HTML structure passed.')
    sys.exit(bool(errors))
