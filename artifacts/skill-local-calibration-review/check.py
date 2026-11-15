from pathlib import Path
import re,json,hashlib
root=Path('/home/aron/Projects/ascencio'); s=root/'.agents/skills/ai-bot-self-improvement'; d=s.with_name(s.name+'-REFINED-local-calibration-20261115'); a=root/'artifacts/skill-local-calibration-review'
h=json.loads((a/'source-hashes.json').read_text())
assert h=={str(p.relative_to(s)):hashlib.sha256(p.read_bytes()).hexdigest() for p in s.rglob('*') if p.is_file()},'source changed'
for p in s.rglob('*'):
 if p.is_file() and p.name!='SKILL.md': assert p.read_bytes()==(d/p.relative_to(s)).read_bytes(),p
blocks=lambda p:re.findall(r'```[^\n]*\n.*?```',p.read_text(),re.S)
assert blocks(s/'SKILL.md')==blocks(d/'SKILL.md'),'literal blocks changed'
for p in d.rglob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)|^\[[^]]+\]:\s+(\S+)',p.read_text(),re.M):
  x=next(v for v in target if v).split('#')[0]
  if x and not re.match(r'\w+://',x): assert (p.parent/x).exists(),(p,x)
def count(p):
 files=[x for x in p.rglob('*') if x.is_file()]
 instructional=sum(len(x.read_text()) for x in files if x.suffix in ['.md','.txt','.yaml'])
 instructional+=sum(len(line) for x in files if x.suffix=='.mjs' for line in x.read_text().splitlines(keepends=True) if line.lstrip().startswith('//'))
 return {'instruction_characters':instructional,'physical_bytes':sum(x.stat().st_size for x in files)}
print(json.dumps({'source':count(s),'candidate':count(d),'checks':'PASS'}))
