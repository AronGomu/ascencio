from pathlib import Path
import json,shutil,sys
root=Path('/home/aron/Projects/ascencio/artifacts/skill-authoring-update/reviews');cfg=json.loads((root/'config.json').read_text());key=sys.argv[1];i=int(sys.argv[2]);out=Path(cfg[key]['artifacts'])/f'iteration-{i:02}';c=Path(cfg[key]['candidate'])
for name in 'abc':assert (out/f'reviewer-{name}.md').exists()
shutil.copytree(c,out/'reviewed-package')
text=(root/key/'original-explanation.md').read_text().replace('for incoming','for iteration input of')
if not (out/'input-explanation.md').exists(): (out/'input-explanation.md').write_text(text+'\nInput is snapshotted in `input-package/`; same behavioral baseline applies. See `change.diff` for this iteration’s presentation edit.\n')
print(str(out))
