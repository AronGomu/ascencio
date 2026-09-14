"""Check untouched initial source/evidence against pre-repair SHA-256 inventory."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
evidence = root / "artifacts/T8-REPAIR-EVIDENCE"
initial = json.loads((evidence / "initial-sha256.json").read_text())
allowed = set((evidence / "changed-paths.txt").read_text().splitlines())
changed = []
preserved = 0
for relative, expected in initial.items():
    file = root / relative
    if file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest() == expected:
        preserved += 1
    else:
        changed.append(relative)
        assert relative in allowed, "Unexpected initial-source mutation: " + relative
protected = [path for path in initial if path.startswith(("vendor/", "artifacts/T8-EVIDENCE/", "artifacts/REVIEW-T8-")) or path in ["package.json", "package-lock.json", "artifacts/IMPLEMENTATION-REPORT-T8.md"] or Path(path).name.startswith("feedback")]
assert not set(protected).intersection(changed)
subprocess.run(["git", "diff", "--exit-code", "--", ".pi/skills"], cwd=root, check=True)
subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=root, check=True)
print(json.dumps({"state": "passed", "initialRegularFiles": len(initial), "unchangedInitialFiles": preserved, "intentionalChangedOrMovedInitialFiles": len(changed), "protectedFilesUnchanged": len(protected), "directorySymlink": ".pi/skills unchanged vs index (excluded from regular-file snapshot)", "noStagedFiles": True}, indent=2))
