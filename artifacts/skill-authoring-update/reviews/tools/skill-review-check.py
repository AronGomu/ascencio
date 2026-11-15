from pathlib import Path
import json,re,hashlib,sys,subprocess
root=Path('/home/aron/Projects/ascencio/artifacts/skill-authoring-update/reviews');cfg=json.loads((root/'config.json').read_text());key=sys.argv[1];i=int(sys.argv[2]);c=Path(cfg[key]['candidate']);out=Path(cfg[key]['artifacts'])/f'iteration-{i:02}';old=out/'input-package'
checks={}; missing=[]
for p in c.rglob('*.md'):
 for dest in re.findall(r'\]\(([^)]+)\)|^\[[^\]]+\]:\s*(\S+)',p.read_text(),re.M):
  d=next(x for x in dest if x);d=d.split('#')[0]
  if not d or '://' in d or '{{' in d:continue
  if not (p.parent/d).exists():missing.append([str(p.relative_to(c)),d])
checks['missing_local_references']=missing
checks['literal_fenced_blocks_identical']=all(re.findall(r'^```.*?^```',p.read_text(),re.M|re.S)==re.findall(r'^```.*?^```',(old/p.relative_to(c)).read_text(),re.M|re.S) for p in c.rglob('*.md'))
checks['executables_identical']=all(p.read_bytes()==(old/p.relative_to(c)).read_bytes() for p in c.rglob('*.mjs'))
checks['model_defaults_present']='gpt-6.1-sol' in (c/'SKILL.md').read_text() and 'low' in (c/'SKILL.md').read_text()
if key=='authoring':
 rows=[line for line in (c/'references/skill-rules-guidelines.md').read_text().splitlines() if re.match(r'\| \d+ \|',line)]
 checks['ordered_rule_count']=len(rows);checks['strictness_descending']=all(a>=b for a,b in zip([int(re.search(r'\| \d+ \| (\d+)%',x)[1]) for x in rows],[int(re.search(r'\| \d+ \| (\d+)%',x)[1]) for x in rows][1:]))
if key=='bot':
 stages=['prepare','evaluate','decide','analyze','replay','assemble','deliver','suspended'];results=[]
 for stage in stages:
  p=subprocess.run(['node',str(c/'scripts/workflow-controller.mjs'),'task',stage],capture_output=True,text=True);results.append({'stage':stage,'exit':p.returncode,'current_task':f'## Current task: {stage.capitalize()}' in p.stdout})
 checks['candidate_dispatcher_stages']=results
checks['review_context']='automatic-authoring-review'
(out/'checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks))
