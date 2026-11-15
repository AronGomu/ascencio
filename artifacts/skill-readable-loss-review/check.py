from pathlib import Path
import sys,json,hashlib,re
s=Path('.agents/skills/ai-bot-self-improvement');d=s.with_name(s.name+'-REFINED-readable-loss-20261115');r=Path('artifacts/skill-readable-loss-review')
m=json.loads((r/'source-manifest.json').read_text());assert all(hashlib.sha256((s/p).read_bytes()).hexdigest()==h for p,h in m.items())
for p in (s/'scripts').iterdir():assert p.read_bytes()==(d/'scripts'/p.name).read_bytes()
for p in s.rglob('*.md'):
 src=re.findall(r'```[^\n]*\n.*?```',p.read_text(),re.S);dst=re.findall(r'```[^\n]*\n.*?```',(d/p.relative_to(s)).read_text(),re.S)
 assert all(x in dst or ('loss-review.ts SESSION PACKET_PATH' in x and p.name=='performance-upgrades.md') for x in src),p
for p in d.rglob('*.md'):
 for dest in re.findall(r'\]\(([^)]+)\)',p.read_text())+re.findall(r'^\[[^]]+\]: (\S+)',p.read_text(),re.M):
  dest=dest.split('#')[0]
  if dest and '://' not in dest:assert (p.parent/dest).exists(),(p,dest)
j=json.loads((r/'counts.json').read_text());files=[p for p in d.rglob('*') if p.is_file()];ins=[p for p in files if p.suffix in ('.md','.txt','.yaml')];comments=sum(len(x)+1 for x in (d/'scripts/workflow-controller.mjs').read_text().splitlines() if x.strip().startswith('//'))
j['iteration'+sys.argv[1]]={'instructionCharacters':sum(len(p.read_text()) for p in ins)+comments,'instructionFiles':len(ins),'physicalBytes':sum(p.stat().st_size for p in files),'allFiles':len(files),'scope':j['source']['scope']};(r/'counts.json').write_text(json.dumps(j,indent=2)+'\n');print('PASS: source hashes, executable copies, fenced blocks, references. Counts:',j['iteration'+sys.argv[1]])
