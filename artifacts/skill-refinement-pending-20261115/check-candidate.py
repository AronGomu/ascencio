from pathlib import Path
import hashlib,json,re,sys
root=Path(__file__).resolve().parents[2]
src=root/'.agents/skills/ai-bot-self-improvement'
dst=src.with_name(src.name+'-REFINED-pending-20261115')
out=Path(__file__).parent
iteration=sys.argv[1]
def count(base):
 files=[p for p in base.rglob('*') if p.is_file()]
 prose=sum(len(p.read_text()) for p in files if p.suffix in ['.md','.txt','.yaml'])
 comments=sum(len(m.group()) for p in files if p.suffix=='.mjs' for m in re.finditer(r'(?m)^\s*//[^\n]*',p.read_text()))
 return {'instructionCharacters':prose+comments, 'instructionalCodeCommentCharacters':comments, 'physicalBytes':sum(p.stat().st_size for p in files)}
broken=[]
for p in dst.rglob('*.md'):
 for pair in re.findall(r'\]\(([^)]+)\)|^\[[^\]]+\]:\s*(\S+)',p.read_text(),re.M):
  target=next(x for x in pair if x).split('#')[0]
  if target and not re.match(r'\w+://',target) and not (p.parent/target).exists():broken.append([str(p.relative_to(dst)),target])
manifest=json.loads((out/'source-manifest-after-default250.json').read_text())
drift=[f for f,h in manifest.items() if hashlib.sha256((src/f).read_bytes()).hexdigest()!=h]
# Preserve literal code blocks in all Markdown reference files; source/controller executables must be identical.
blocks=lambda p:re.findall(r'```[^\n]*\n.*?```',p.read_text(),re.S)
literal_changes=[str(p.relative_to(src)) for p in src.rglob('*.md') if p.parent.name=='references' and blocks(p)!=blocks(dst/p.relative_to(src))]
script_changes=[str(p.relative_to(src)) for p in (src/'scripts').iterdir() if p.read_bytes()!=(dst/p.relative_to(src)).read_bytes()]
result={'iteration':iteration,'source':count(src),'candidate':count(dst),'brokenReferences':broken,'sourceDrift':drift,'literalChanges':literal_changes,'executableChanges':script_changes,'scope':'All package Markdown, text references and agent YAML; instructional .mjs comments counted; executable-only .mjs/.d.mts source excluded. Physical bytes includes every file. External linked docs remain unchanged and uncounted in both versions.'}
(out/f'iteration-{iteration}-checks.json').write_text(json.dumps(result,indent=2)+'\n')
(out/f'iteration-{iteration}-skill.md').write_text((dst/'SKILL.md').read_text())
print(json.dumps(result,indent=2))
if broken or drift or literal_changes or script_changes:raise SystemExit(1)
