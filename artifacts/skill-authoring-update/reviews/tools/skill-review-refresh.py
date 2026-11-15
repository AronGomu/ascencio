from pathlib import Path
import json,difflib,sys,re
root=Path('/home/aron/Projects/ascencio/artifacts/skill-authoring-update/reviews');cfg=json.loads((root/'config.json').read_text());key=sys.argv[1];i=int(sys.argv[2]);out=Path(cfg[key]['artifacts'])/f'iteration-{i:02}';c=Path(cfg[key]['candidate'])
def count(folder):
 d={};physical=0
 for p in sorted(folder.rglob('*')):
  if not p.is_file():continue
  b=p.read_bytes();physical+=len(b);s=b.decode();r=str(p.relative_to(folder))
  if p.suffix in ['.md','.txt','.yaml','.yml']:d[r]=len(s)
  elif p.suffix=='.mjs':d[r+' (instructional comments and CLI usage)']=sum(len(x) for x in s.splitlines(True) if x.lstrip().startswith('//'))+sum(len(v) for v in re.findall(r'"(Usage: [^"]+)"',s))
 return {'instructional_characters':sum(d.values()),'physical_bytes':physical,'instructional_resources':d}
(out/'counts.json').write_text(json.dumps({'input':count(out/'input-package'),'candidate':count(c)},indent=2)+'\n')
diff=''
for p in sorted(c.rglob('*')):
 if p.is_file():
  r=p.relative_to(c);a=(out/'input-package'/r).read_text();b=p.read_text();diff+=''.join(difflib.unified_diff(a.splitlines(True),b.splitlines(True),fromfile=str(r),tofile=str(r)))
(out/'change.diff').write_text(diff)
print(json.dumps(json.loads((out/'counts.json').read_text())))
