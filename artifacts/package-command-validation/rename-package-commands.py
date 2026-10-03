from pathlib import Path
import json,re,subprocess
mapping={
'assets:profiles:sync':'legacy:assets:inventory','assets:promote':'legacy:assets:profile-promote','assets:migrate':'legacy:assets:copy-migrate','assets:restructure':'legacy:assets:copy-to-package-roots',
'assets:mvp':'assets:bootstrap','assets:engine':'assets:engine:acquire','assets:engine:verify':'assets:engine:verify-acquired','assets:sync':'assets:upstream:sync','assets:verify':'assets:verify-all',
'assets:images':'assets:cards:download-full','assets:images:cropped':'assets:cards:download-cropped','assets:images:cropped:active':'assets:cards:download-cropped-reviewed-pool','assets:images:verify':'assets:cards:verify-full','assets:card-back':'assets:card-back:download','assets:sets':'assets:sets:download-images','assets:sets:verify':'assets:sets:verify-images','assets:lock':'assets:images:pin',
'snapshot:generate':'content:source-manifest:generate','snapshot:verify':'content:source-manifest:verify','generate:shop-sets':'content:shop-sets:fetch-and-generate',
'dev':'frontend:dev','build':'frontend:build','build:app':'frontend:bundle','build:verify':'frontend:verify','build:reproducible':'frontend:verify-reproducible','preview':'frontend:preview',
'test:legacy':'test:tooling','test:unit':'test:unit-and-performance','test:e2e':'test:browser:native-bridge','test:acceptance':'test:browser:visual-acceptance','check:browser':'check:frontend-and-browser',
'content:parity':'content:verify:sqlite-json-parity','mods:package':'mods:bundle','mods:audit-runtime':'mods:audit:wasm-imports','content:export':'legacy:content:export-sqlite','content:verify':'legacy:content:verify-sqlite',
'native:manifest':'content:release:pin','native:prepare':'content:stage:native','native:verify-staged':'content:stage:verify-native','native:clean-content':'content:stage:cleanup','native:dev':'native:desktop:dev','native:start':'native:build-and-start:linux','native:build':'native:desktop:build',
}
aliases={'build:native':'frontend:bundle','test:native:webview':'test:browser:native-bridge','assets:sync:offline':'assets:upstream:sync -- --offline'}
all_map={**mapping,**aliases}
pattern=re.compile(r'(?<![\w:-])('+ '|'.join(re.escape(k) for k in sorted(all_map,key=len,reverse=True) if ':' in k)+r')(?![\w:-])')
def replace(text):
    text=re.sub(r'npm run content:readable -- (convert|compile)\b', lambda m: 'npm run '+('content:convert:sqlite-to-json' if m[1]=='convert' else 'content:compile:json')+' --',text)
    text=text.replace('npm run content:readable -- --help','npm run content:compile:json -- --help')
    text=pattern.sub(lambda m:all_map[m[1]],text)
    text=re.sub(r'(npm run )(dev|build|preview)(?![\w:-])',lambda m:m[1]+mapping[m[2]],text)
    text=re.sub(r'content:readable(?![\w:-])','content:compile:json',text)
    return text
pkg=Path('package.json'); data=json.loads(pkg.read_text()); new={}
for name,cmd in data['scripts'].items():
    if name in aliases:continue
    if name=='content:readable':
        new['content:convert:sqlite-to-json']=cmd+' convert'
        new['content:compile:json']=cmd+' compile'
    else:new[mapping.get(name,name)]=replace(cmd)
data['scripts']=new
pkg.write_text(json.dumps(data,indent=2)+'\n')
paths=subprocess.check_output(['rg','--files','--hidden','scripts','src','tests','e2e','docs','.github/workflows'],text=True).splitlines()
paths+=['AGENTS.md','README.md','PRODUCT.md','playwright.native.config.ts','playwright.acceptance.config.ts','src-tauri/tauri.conf.json','artifacts/manual_test_checklist.md']
changed=['package.json']
for name in sorted(set(paths)):
    p=Path(name)
    if p.suffix not in {'.ts','.js','.svelte','.json','.md','.html','.yml','.yaml','.sh','.cmd'}:continue
    if 'feedback' in p.name or 'docs/archive/' in name:continue
    if name.startswith('docs/') and any(x in name for x in ['IMPLEMENTATION_PLAN','IMPLEMENTATION_HANDOFF','SESSION_HANDOFF','card-game-vn-handoff/']):continue
    if name.startswith('docs/ADR/') and not p.name.startswith(('101_','102_','103_','104_')):continue
    if name.startswith('scripts/') and p.suffix=='.json':continue
    old=p.read_text(); updated=replace(old)
    if updated!=old:p.write_text(updated);changed.append(name)
Path('.tmp/command-rename-map.json').write_text(json.dumps({'renamed':mapping,'removedAliases':aliases,'changed':changed},indent=2)+'\n')
print(f'{len(new)} commands; {len(changed)} files updated; historical acceptance records and owner feedback preserved.')
