from pathlib import Path
import json,hashlib,shutil
root=Path('/home/aron/Projects/ascencio/artifacts/skill-authoring-update')
hashes=json.loads((root/'authored-source-hashes.json').read_text())
configs={}
for key,src in zip(['bot','authoring','refine'],hashes):
 s=Path(src); c=s.with_name(s.name+'-REFINED-AUTHORING-REVIEW'); n=2
 while c.exists():
  c=s.with_name(s.name+f'-REFINED-AUTHORING-REVIEW-{n}'); n+=1
 shutil.copytree(s,c)
 out=root/'reviews'/key;out.mkdir(parents=True,exist_ok=True)
 shutil.copytree(s,out/'original-package')
 actual={str(p.relative_to(s)):hashlib.sha256(p.read_bytes()).hexdigest() for p in s.rglob('*') if p.is_file()}
 (out/'initial-source-verification.json').write_text(json.dumps({'expected':hashes[src],'actual':actual,'matches':actual==hashes[src]},indent=2)+'\n')
 configs[key]={'source':str(s),'candidate':str(c),'artifacts':str(out)}
(root/'reviews'/'config.json').write_text(json.dumps(configs,indent=2)+'\n')
print(json.dumps(configs,indent=2))
