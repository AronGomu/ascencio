"""Replay exact initial publisher/producer against new negative fixtures; never edit source."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import uuid

root = Path(__file__).resolve().parents[2]
evidence = root / "artifacts/T8-REPAIR-EVIDENCE"
initial = json.loads((evidence / "initial-sha256.json").read_text())
scratch = root / ".tmp" / ("t8-baseline-" + str(uuid.uuid4()))
scratch.mkdir(parents=True)
created = []


def write(name, text):
    target = scratch / name
    target.write_text(text)
    created.append(target)
    return target


def absolute(text, origin, overrides=None):
    overrides = overrides or {}

    def replace(match):
        value = match.group(1)
        if not value.startswith("."):
            return match.group(0)
        resolved = (root / origin).parent.joinpath(value).resolve()
        return '"' + str(overrides.get(resolved, resolved)) + '"'

    return re.sub(r'"([^"\n]+\.ts)"', replace, text)


try:
    paths = {}
    for kind in ["publisher", "producer"]:
        source = Path(f"scripts/lib/asset-delivery/progressive-{kind}.ts")
        original = (evidence / f"initial-progressive-{kind}.ts.txt").read_bytes()
        assert hashlib.sha256(original).hexdigest() == initial[str(source)]
        paths[kind] = write(kind + ".ts", absolute(original.decode(), source))
    cli = Path("scripts/lib/asset-delivery/content-publish-cli.ts")
    cli_copy = write("cli.ts", absolute((root / cli).read_text(), cli, {
        root / "scripts/lib/asset-delivery/progressive-publisher.ts": paths["publisher"],
    }))
    for kind, pattern in [
        ("publisher", "live CLI rechecks .* mutation after manifest upload"),
        ("producer", "verifier rejects self-consistent acyclic equal-sequence predecessor chain"),
    ]:
        source = Path(f"tests/progressive-{kind}.test.ts")
        test = write(kind + ".test.ts", absolute((root / source).read_text(), source, {
            root / f"scripts/lib/asset-delivery/progressive-{kind}.ts": paths[kind],
            root / cli: cli_copy,
        }))
        command = ["node", "--test", "--test-name-pattern=" + pattern, str(test)]
        result = subprocess.run(command, cwd=root, check=False)
        print(f"{kind}: initial-source negative replay exit={result.returncode}; expected=1", flush=True)
        assert result.returncode == 1
finally:
    for target in created:
        target.unlink()
    scratch.rmdir()
