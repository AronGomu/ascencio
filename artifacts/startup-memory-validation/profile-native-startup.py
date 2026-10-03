import json, os, pathlib, platform, signal, subprocess, time
repo=pathlib.Path.cwd(); base=repo/'.tmp/native-performance'; base.mkdir(exist_ok=True)
data=base/'startup-native-data'; config=base/'startup-native-config'
env=dict(os.environ, XDG_DATA_HOME=str(data), XDG_CONFIG_HOME=str(config), ASCENCIO_IO_TRACE='1', ASCENCIO_NATIVE_ACCEPTANCE='1')
logs=data/'com.ascencio.storyduel/logs'; results=[]
def family(pid):
    info={}
    for path in pathlib.Path('/proc').glob('[0-9]*/stat'):
        try:
            fields=path.read_text().rsplit(')',1)[1].split(); info[int(path.parent.name)]=int(fields[1])
        except (OSError,ValueError,IndexError): pass
    ids={pid}
    while True:
        added={child for child,parent in info.items() if parent in ids}-ids
        if not added: break
        ids|=added
    return ids

def memory(pid):
    rss=pss=0
    for child in family(pid):
        try:
            for line in pathlib.Path(f'/proc/{child}/smaps_rollup').read_text().splitlines():
                if line.startswith('Rss:'): rss+=int(line.split()[1])*1024
                if line.startswith('Pss:'): pss+=int(line.split()[1])*1024
        except OSError: pass
    return {'rssBytes':rss,'pssBytes':pss}

for index in range(4):
    prior=set(logs.glob('*acceptance.json')) if logs.exists() else set()
    output=open(base/f'run-{index}.log','w'); started=time.monotonic()
    proc=subprocess.Popen([str(repo/'src-tauri/target/release/ascencio')],env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
    peak={'rssBytes':0,'pssBytes':0}; ready=None; readyMem=None; samples=0; reportPath=None; exitCode=None
    while time.monotonic()-started<180:
        sample=memory(proc.pid); samples+=1
        for key in peak: peak[key]=max(peak[key],sample[key])
        paths=set(logs.glob('*acceptance.json')) if logs.exists() else set()
        new=paths-prior
        if new:
            reportPath=max(new,key=lambda p:p.stat().st_mtime)
            if proc.poll() is not None: exitCode=proc.returncode; break
        if ready is None and logs.exists():
            for path in logs.glob('*io-ready.json'):
                if path.stat().st_mtime>=time.time()-(time.monotonic()-started)-1:
                    ready=time.monotonic()-started; readyMem=sample; break
        if proc.poll() is not None: exitCode=proc.returncode; break
        time.sleep(.25)
    if proc.poll() is None:
        os.killpg(proc.pid,signal.SIGTERM); proc.wait(timeout=10); exitCode=proc.returncode
    output.close()
    report=json.loads(reportPath.read_text()) if reportPath else {'status':'missing'}
    record={'run':index,'condition':'fresh app-data, unflushed OS cache' if index==0 else 'warm app-data and OS cache','readyWallMs':None if ready is None else ready*1000,'memoryAtReady':readyMem,'peakProcessFamilyMemory':peak,'samples':samples,'exitCode':exitCode,'report':report}
    results.append(record)
    (base/'results.json').write_text(json.dumps(results,indent=2))
    print(json.dumps({k:v for k,v in record.items() if k!='report'}),flush=True)
    print('acceptance:',report.get('status'),report.get('error'),flush=True)
    if report.get('status')!='passed': break
summary={'hardware':{'machine':platform.machine(),'kernel':platform.release(),'cpu':next((line.split(':',1)[1].strip() for line in pathlib.Path('/proc/cpuinfo').read_text().splitlines() if line.startswith('model name')),None)},'build':'optimized release with opt-in isolated native-acceptance instrumentation','conditions':'No filesystem cache flush; process-family RSS double-counts shared pages, PSS apportions them. Sampled at 250 ms, excluding external system processes. No pre-change native measurement exists.','runs':results}
(repo/'artifacts/STARTUP_MEMORY_NATIVE_PERFORMANCE.json').write_text(json.dumps(summary,indent=2))
