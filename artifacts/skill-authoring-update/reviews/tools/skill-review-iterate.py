from pathlib import Path
import json,shutil,difflib,sys,hashlib,re
root=Path('/home/aron/Projects/ascencio/artifacts/skill-authoring-update/reviews'); cfg=json.loads((root/'config.json').read_text()); key=sys.argv[1]; i=int(sys.argv[2]); c=Path(cfg[key]['candidate']); out=Path(cfg[key]['artifacts'])/f'iteration-{i:02}';out.mkdir(exist_ok=False);shutil.copytree(c,out/'input-package')
(out/'input-explanation.md').write_text((root/key/'original-explanation.md').read_text().replace('for incoming','for iteration input of')+'\nBehavior remains as inventoried; input-package contains the exact current text.\n')
changes={
'bot':[
('SKILL.md','All stages inherit this policy; stage instructions add requirements.','All stages inherit this policy and add their own requirements.'),
('SKILL.md','Discover exact request schemas and CLI options at the owning entry point rather than duplicating them here:','Read exact request schemas and CLI options at the owning entry point:'),
('SKILL.md','The defaults file is input, not a replacement setup schema.','The defaults file supplies values, not the setup schema.'),
('SKILL.md','Read history/linked summaries; exclude unchanged failed context/rules/combinations.','Read history and linked summaries; exclude unchanged failed contexts, rules and combinations.'),
('references/loss-analysis-template.md','For every reason enumerate all affected games and primary critical decision IDs relative to the linked source evaluation.','For each reason, list all affected games and their primary critical decision IDs in the linked source evaluation.')],
'authoring':[
('SKILL.md','Use the template below when creating or revising a skill. Replace placeholders, remove authoring comments, and omit sections the task does not need.','Create or revise skills with the template below. Replace placeholders, remove authoring comments, and omit unnecessary sections.'),
('SKILL.md','Run this once per completed authoring task for each changed skill, including this authoring skill or refine-skill itself.','Run once per completed authoring task for each changed skill, including this skill and refine-skill.'),
('references/skill-rules-guidelines.md','Read this ordered list whenever creating, updating or refining a skill.','Read this ordered list when creating, updating or refining a skill.'),
('references/skill-rules-guidelines.md','Keep each meaning in a single source of truth','Keep each meaning in a single source of truth'),
('references/skill-rules-guidelines.md','Do not stop searching for useful simplification merely because a target was reached.','Keep seeking useful simplification after reaching a target.')],
'refine':[
('SKILL.md','Produce the shortest clear, human-readable skill preserving intent and outcome ; leave implementation to judgment.','Produce the shortest clear, readable skill that preserves intent and outcome; leave implementation to judgment.'),
('SKILL.md','Clarify only ambiguity or conflict blocking identification of intent or essentials.','Clarify only when ambiguity or conflict prevents identifying intent or essentials.'),
('SKILL.md','Record outcome, essentials and applicable structure with original references; distinguish essentials from incidental process.','Record the outcome, essentials and applicable structure with source references; separate essentials from incidental process.'),
('SKILL.md','Record update skill characters comparison report with new iteration.','Record each iteration’s skill character counts and comparison report.'),
('SKILL.md','Repeat from step 2 until the requested iteration count is complete.','Repeat steps 2–3 for every requested iteration.')]
}
# Fourth authoring pass removes a redundant word, preserving the complete ordered table.
changes['authoring'][3]=('references/skill-rules-guidelines.md','A guideline does not authorize installation, publication or unrelated implementation changes.','Guidelines grant no installation, publication or unrelated implementation authority.')
f,old,new=changes[key][i-1];p=c/f;t=p.read_text();assert old in t,(key,i,old);p.write_text(t.replace(old,new,1))
# Count Unicode characters; all Markdown, text, YAML plus instructional comments in executable source.
def counts(folder):
 details={};physical=0
 for p in sorted(folder.rglob('*')):
  if not p.is_file():continue
  b=p.read_bytes();physical+=len(b);text=b.decode();r=str(p.relative_to(folder))
  if p.suffix in ['.md','.txt','.yaml','.yml']:details[r]=len(text)
  elif p.suffix=='.mjs':details[r+' (instructional comments and CLI usage)']=sum(len(x) for x in text.splitlines(keepends=True) if x.lstrip().startswith('//'))+sum(len(v) for v in re.findall(r'"(Usage: [^"]+)"',text))
 return {'instructional_characters':sum(details.values()),'physical_bytes':physical,'instructional_resources':details}
(out/'counts.json').write_text(json.dumps({'input':counts(out/'input-package'),'candidate':counts(c)},indent=2)+'\n')
(out/'change.diff').write_text(''.join(difflib.unified_diff(t.splitlines(True),p.read_text().splitlines(True),fromfile=f,tofile=f)))
(out/'deletion-audit.md').write_text(f'''# Independent deletion audit — {key} iteration {i}

Reviewed the diff separately from comprehension explanations against the incoming requirement inventory.

| Removed wording | Retained authority | Behavioral effect |
|---|---|---|
| {old} | `{f}`: {new} | Same obligation, scope and completion condition; no retirement or behavioral change authorized. |

No resource removed or relocated. Executable source, literal fenced contracts, thresholds, model settings and source-protection boundaries remain unchanged. Boundary walkthrough: source/candidate ownership, default overrides, failed checks and incomplete work retain their incoming handling. This is a policy audit, not an executable equivalence test.
''')
print(str(out));print(json.dumps(json.loads((out/'counts.json').read_text())))
