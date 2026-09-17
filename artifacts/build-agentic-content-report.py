#!/usr/bin/env python3
"""Build sanitized, offline agent telemetry report. Raw transcripts never embedded."""
import collections
import datetime
import hashlib
import html
import json
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
SESSION_NAME = '2026-09-14T10-41-52-334Z_01a09f82-4ece-7559-94be-67f220bc30bb'
BASE = pathlib.Path.home() / '.pi/agent/sessions/--home-aron-projects-ascencio--'
SESSION = BASE / SESSION_NAME
OUT = ROOT / 'artifacts'
NAME = 'AGENTIC-REPORT-content-module-rearchitecture'
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
statuses = {}
for p in pathlib.Path('/tmp/pi-subagents-uid-1000/async-subagent-runs').glob('*/status.json'):
    try:
        d = json.loads(p.read_text())
    except (ValueError, OSError):
        continue
    for s in d.get('steps', []):
        f = s.get('sessionFile')
        if f and SESSION_NAME in f:
            statuses[str(pathlib.Path(f).resolve())] = {
                'run': d.get('runId'), 'agent': s.get('agent'),
                'status': s.get('status', d.get('state')),
                'requestedModel': s.get('model'), 'requestedThinking': s.get('thinking'),
            }
rows = []
files = sorted(SESSION.rglob('session.jsonl'))
parent = BASE / (SESSION_NAME + '.jsonl')
if parent.exists():
    files.insert(0, parent)
for path in files:
    role = 'parent' if path == parent else statuses.get(str(path.resolve()), {}).get('agent', 'child')
    models, efforts, calls = collections.Counter(), collections.Counter(), collections.Counter()
    tokens = collections.Counter()
    cost = 0.0
    cost_messages = usage_messages = zero_cost_messages = 0
    first = last = None
    prompt = ''
    current_model = 'unknown'
    thinking = 'unknown'
    seen = set()
    segments = {}
    for line in path.open():
        try:
            d = json.loads(line)
        except ValueError:
            continue
        stamp = d.get('timestamp')
        if stamp:
            first = first or stamp
            last = stamp
        if d.get('type') == 'model_change':
            current_model = d.get('provider', '') + '/' + d.get('modelId', 'unknown')
        if d.get('type') == 'thinking_level_change':
            thinking = d.get('thinkingLevel', 'unknown')
        m = d.get('message', {})
        content = m.get('content', [])
        if not prompt and m.get('role') == 'user':
            prompt = '\n'.join(x.get('text', '') for x in content if isinstance(x, dict)) if isinstance(content, list) else str(content)
        if m.get('role') != 'assistant':
            continue
        identity = d.get('id')
        if identity and identity in seen:
            continue
        seen.add(identity)
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get('type') == 'toolCall':
                    calls[item.get('name', 'unknown')] += 1
        u = m.get('usage')
        if not isinstance(u, dict):
            continue
        model = m.get('provider', current_model.split('/')[0]) + '/' + m.get('model', current_model.split('/')[-1])
        models[model] += 1
        efforts[thinking] += 1
        usage_messages += 1
        key = (model, thinking)
        seg = segments.setdefault(key, {'model': model, 'thinking': thinking, 'messages': 0, 'tokens': 0, 'costUsd': 0.0})
        seg['messages'] += 1
        for k in ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning', 'totalTokens']:
            tokens[k] += u.get(k, 0) or 0
        seg['tokens'] += u.get('totalTokens', 0) or 0
        value = u.get('cost', {}).get('total') if isinstance(u.get('cost'), dict) else None
        if isinstance(value, (int, float)):
            cost_messages += 1
            cost += value
            seg['costUsd'] += value
            zero_cost_messages += int(value == 0)
    meta = statuses.get(str(path.resolve()), {})
    # Summarize tasks without publishing prompts, private paths, or tool responses.
    match = re.search(r'\bT(?:11|10|[1-9])(?:[–-](?:T)?(?:11|10|[1-9]))?\b', prompt)
    ticket = match.group(0) if match else 'Baseline / orchestration'
    if role == 'parent':
        task = 'Orchestration, approvals, integration, commits, report and PR preparation'
    else:
        lower = prompt.lower()
        action = 'Independent review' if 'review' in role else ('Reconnaissance' if role == 'scout' else 'Implementation')
        if 'retry' in lower or 'repair' in lower:
            action += ' / repair'
        subjects = []
        for word, label in [('reconcil', 'history reconciliation'), ('publisher', 'publisher integrity'), ('storage', 'storage'), ('generation', 'save generations'), ('battle', 'Battle runtime/images'), ('semantic', 'semantic ports'), ('activation', 'atomic activation'), ('core', 'CORE consent'), ('browser', 'browser acceptance')]:
            if word in lower:
                subjects.append(label)
        task = ticket + ': ' + action + ' — ' + ', '.join(subjects[:4])
    rows.append({'session': 'parent' if role == 'parent' else str(path.relative_to(SESSION)),
                 'agent': role, 'task': task, 'ticket': ticket, 'start': first, 'end': last,
                 'status': meta.get('status', 'active snapshot' if role == 'parent' else 'status unavailable'),
                 'run': meta.get('run'), 'models': dict(models), 'thinking': dict(efforts),
                 'requestedModel': meta.get('requestedModel'), 'requestedThinking': meta.get('requestedThinking'),
                 'usageMessages': usage_messages, 'costMessages': cost_messages,
                 'zeroCostMessages': zero_cost_messages, 'tokens': dict(tokens),
                 'costUsd': round(cost, 8), 'toolCalls': sum(calls.values()),
                 'segments': list(segments.values()), 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest()})
rows.sort(key=lambda r: r['start'] or '')
model_totals = {}
for row in rows:
    for s in row['segments']:
        key = s['model'] + ' / ' + s['thinking']
        agg = model_totals.setdefault(key, {'modelThinking': key, 'messages': 0, 'tokens': 0, 'costUsd': 0.0, 'sessions': 0})
        for k in ['messages', 'tokens', 'costUsd']:
            agg[k] += s[k]
        agg['sessions'] += 1
payload = {'schemaVersion': 1, 'generatedAt': now,
           'sourceRootId': SESSION_NAME, 'scope': 'Available parent session plus its 38-or-more child transcript files; no transcript text exported.',
           'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
           'costMeaning': 'Recorded usage.cost.total USD estimates, not provider invoices or confirmed charges. Zero fields remain recorded zero, not proof of free usage. Interrupted/unlogged usage and later report/PR work may be absent.',
           'tokenMeaning': 'Sum of per-response totalTokens, including repeated context and provider-reported cache usage. Reasoning is shown separately and not added again. Not unique text volume.',
           'sessions': rows, 'modelTotals': list(model_totals.values()),
           'totals': {'sessions': len(rows), 'children': len(rows) - int(parent.exists()),
                      'usageMessages': sum(r['usageMessages'] for r in rows),
                      'costMessages': sum(r['costMessages'] for r in rows),
                      'zeroCostMessages': sum(r['zeroCostMessages'] for r in rows),
                      'tokens': sum(r['tokens'].get('totalTokens', 0) for r in rows),
                      'costUsd': sum(r['costUsd'] for r in rows),
                      'toolCalls': sum(r['toolCalls'] for r in rows),
                      'tokenBreakdown': {k: sum(r['tokens'].get(k, 0) for r in rows) for k in ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning']}}}
json_path = OUT / (NAME + '.json')
json_path.write_text(json.dumps(payload, indent=2) + '\n')
encoded = json.dumps(payload).replace('<', '\\u003c')
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI execution report · Content rearchitecture</title>
<style>
:root{color-scheme:dark;--bg:#10151d;--panel:#19212d;--fg:#e9eef7;--muted:#abb9cc;--line:#344154;--accent:#7dd3c7}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}main{max-width:1300px;margin:auto;padding:36px 24px}h1{font-size:clamp(28px,4vw,48px);line-height:1.12}h2{margin-top:40px}p{max-width:95ch;color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.card{padding:18px;background:var(--panel);border:1px solid var(--line);border-radius:10px}.big{display:block;font-size:25px;color:var(--accent);font-weight:700;overflow-wrap:anywhere}.card{min-width:0}.controls label{max-width:100%}.controls input{max-width:100%}.small{font-size:13px;color:var(--muted)}.notice{border-left:3px solid var(--accent);padding:12px 18px;background:var(--panel)}input,button,select{font:inherit;color:var(--fg);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:9px}button{cursor:pointer}button:hover,button:focus-visible{border-color:var(--accent)}.controls{display:flex;gap:12px;flex-wrap:wrap}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px}th{color:var(--accent)}th button{border:0;padding:0;text-align:left}td.task{min-width:270px}code{font-size:13px;overflow-wrap:anywhere}.bar{height:9px;background:var(--accent);border-radius:3px;margin-top:8px}.timeline{display:grid;gap:10px}.event{display:grid;grid-template-columns:180px 1fr;gap:18px;border-left:2px solid var(--line);padding:8px 16px}.badge{color:var(--accent)}@media(max-width:850px){.cards{grid-template-columns:repeat(2,1fr)}.event{grid-template-columns:1fr}main{padding:24px 15px}}@media print{body{background:white;color:black}.controls{display:none}.scroll{overflow:visible}p,.small{color:#333}th,td{font-size:10px}.card{background:white}}
</style></head><body><main>
<div class="small">FORGEJO REVIEW · OFFLINE REPORT · TELEMETRY SNAPSHOT</div><h1>Content rearchitecture<br>AI execution report</h1>
<p>Accepted implementation: T1–T11. Final browser gate: <strong>139/139 E2E + 41/41 acceptance, zero skips</strong>. Independent production and acceptance reviews clean. This report explains which agents/models did the work, their reasoning settings, recorded usage, retries, and limits.</p>
<div id="cards" class="cards"></div>
<p class="notice"><strong>Cost ≠ invoice.</strong> Values below are recorded harness USD estimates, not confirmed provider charges. Missing telemetry is not estimated. Parent session is still active at snapshot time; report generation, PR publication, missing early sessions, and interrupted unlogged work can make totals incomplete.</p>
<h2>Model / thinking allocation</h2><p>Observed model IDs come from assistant usage records. Thinking comes from session change events; requested route shown in run details. Cached/context tokens can recur across responses. No claims about comparative model quality from uncontrolled task timings.</p>
<div class="scroll"><table><thead><tr><th>Model / thinking</th><th>Sessions</th><th>Responses</th><th>Tokens</th><th>Recorded USD</th></tr></thead><tbody id="models"></tbody></table></div>
<h2>Tasks and agent runs</h2><div class="controls"><label>Filter <input id="filter" placeholder="T11, Astra, review, failed…"></label><label>Scope <select id="scope"><option value="all">All sessions</option><option value="children">Children only</option><option value="parent">Parent only</option></select></label><button id="export">Export sanitized JSON</button></div><p class="small">Click column headings to sort. Status reflects available runtime metadata, not independent product acceptance; runner failures can leave valid partial work. Task summaries are derived from launch prompts, not full private transcripts.</p>
<div class="scroll"><table><thead><tr><th><button data-sort="start">Start UTC ↕</button></th><th><button data-sort="agent">Agent ↕</button></th><th>Task</th><th>Observed model / thinking</th><th><button data-sort="status">Status ↕</button></th><th><button data-sort="tokens">Tokens ↕</button></th><th><button data-sort="costUsd">USD ↕</button></th></tr></thead><tbody id="runs"></tbody></table></div>
<h2>Timeline</h2><div id="timeline" class="timeline"></div>
<h2>Outcomes and residual limits</h2><p><strong>O1.</strong> Preserved both Git histories; PR groups append-only commits, not a squash/rebase. Source gates pass: 220 legacy, 2,732 unit, 54 integration, 1,269 component, 139 E2E, 41 acceptance, 11 native CORE.</p><p><strong>O2.</strong> T11 exposed real image-lifetime, stale-hover, printing-identity, manifest-parse, and browser-warning defects. Repairs received independent review; targeted reviewer tests: 287 passed.</p><p><strong>O3.</strong> Process limits: original T10 test-first chronology missed; retrospective RED is not TDD. Two long-running repair runners disappeared. Failed/interrupted attempts remain in telemetry, not erased.</p><p><strong>O4.</strong> Residuals: abort-ignoring image providers may stall optional art at the physical concurrency cap; recovery focus handoff and menu/hover overlap remain documented; graph refresh deferred after quota failure. No publication rights, deployment, or device certification implied.</p><p><strong>O5.</strong> Scope assumption: bulky raw browser traces, runtime logs, PIDs, private transcripts, and unrelated untracked files remain local. Selected reports and sanitized telemetry accompany source changes. Original Forgejo mirror remains unchanged; writable review fork supports the PR.</p>
<h2>Provenance</h2><p id="provenance" class="small"></p><p class="small">Rebuild: <code>python3 artifacts/build-agentic-content-report.py</code>. Inputs: local parent/child JSONL sessions plus available subagent status metadata. Each exported row contains source SHA-256 and relative session ID for audit without transcript disclosure. Snapshot totals are lower-bound recorded coverage, not total invoiced spend.</p>
</main><script id="data" type="application/json">__DATA__</script><script>
const d=JSON.parse(document.getElementById('data').textContent),t=d.totals;
const fmt=n=>Number(n).toLocaleString('en-US'),usd=n=>'$'+Number(n).toFixed(2),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=[['Agent sessions',fmt(t.children)+' + parent'],['Models / effort',d.modelTotals.length+' routes'],['Recorded tokens',fmt(t.tokens)],['Recorded USD',usd(t.costUsd)],['Responses / tools',fmt(t.usageMessages)+' / '+fmt(t.toolCalls)]];
document.getElementById('cards').innerHTML=cards.map(([a,b])=>`<div class="card"><span class="small">${a}</span><span class="big">${b}</span></div>`).join('');
const max=Math.max(...d.modelTotals.map(x=>x.costUsd),1);
document.getElementById('models').innerHTML=d.modelTotals.sort((a,b)=>b.costUsd-a.costUsd).map(x=>`<tr><td>${esc(x.modelThinking)}<div class="bar" style="width:${Math.max(1,x.costUsd/max*100)}%"></div></td><td>${x.sessions}</td><td>${fmt(x.messages)}</td><td>${fmt(x.tokens)}</td><td>${usd(x.costUsd)}</td></tr>`).join('');
let sort='start',direction=1;
function render(){const q=document.getElementById('filter').value.toLowerCase(),scope=document.getElementById('scope').value;let rows=d.sessions.filter(r=>(scope==='all'||(scope==='parent'?r.agent==='parent':r.agent!=='parent'))&&JSON.stringify(r).toLowerCase().includes(q));const val=r=>sort==='tokens'?(r.tokens.totalTokens||0):r[sort]??'';rows.sort((a,b)=>typeof val(a)==='number'?(val(a)-val(b))*direction:String(val(a)).localeCompare(String(val(b)))*direction);document.getElementById('runs').innerHTML=rows.map(r=>`<tr><td>${esc((r.start||'').replace('T',' ').slice(0,19))}<br><span class="small">${esc(r.session)}</span></td><td>${esc(r.agent)}</td><td class="task">${esc(r.task)}</td><td>${r.segments.map(s=>esc(s.model+' / '+s.thinking)).join('<br>')}<details><summary>Requested route</summary>${esc(r.requestedModel||'not retained')}<br>${esc(r.requestedThinking||'not retained')}</details></td><td>${esc(r.status)}</td><td>${fmt(r.tokens.totalTokens||0)}</td><td>${usd(r.costUsd)}</td></tr>`).join('');}
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{direction=sort===b.dataset.sort?-direction:1;sort=b.dataset.sort;render()});document.getElementById('filter').oninput=render;document.getElementById('scope').onchange=render;render();
document.getElementById('timeline').innerHTML=d.sessions.filter(r=>r.agent!=='parent').map(r=>`<div class="event"><span class="small">${esc((r.start||'').slice(0,16).replace('T',' '))}</span><div>${esc(r.task)} <span class="badge">${esc(r.status)}</span></div></div>`).join('');
document.getElementById('provenance').textContent=`Generated ${d.generatedAt}; HEAD ${d.head}. Usage cost fields: ${t.costMessages}/${t.usageMessages} responses; recorded zero-cost responses: ${t.zeroCostMessages}. Token breakdown: input ${fmt(t.tokenBreakdown.input)}, output ${fmt(t.tokenBreakdown.output)}, cache read ${fmt(t.tokenBreakdown.cacheRead)}, cache write ${fmt(t.tokenBreakdown.cacheWrite)}, reasoning ${fmt(t.tokenBreakdown.reasoning)} (not added twice). Scope: ${d.sourceRootId}.`;
document.getElementById('export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='agentic-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
</script></body></html>'''
(OUT / (NAME + '.html')).write_text(page.replace('__DATA__', encoded))
print(json.dumps(payload['totals'], indent=2))
print('HTML:', str(OUT / (NAME + '.html')))
