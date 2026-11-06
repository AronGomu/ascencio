import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { agentSandbox } from "../scripts/bot-campaign/sandbox.ts";
test(
  "nested coding-agent sandbox permits PTY shell tools while protecting source and authentication",
  { skip: process.platform !== "linux" },
  () => {
    const root = mkdtempSync(resolve("generated/campaign-sandbox-"));
    const workspace = join(root, "proposal"),
      runtime = join(root, "runtime"),
      originalHome = join(root, "home");
    for (const p of [workspace, runtime, originalHome]) mkdirSync(p);
    const auth = join(originalHome, "auth.json");
    writeFileSync(auth, "test-credential-placeholder");
    const protectedPath = join(root, "protected");
    writeFileSync(protectedPath, "unchanged");
    const python = `import pty,subprocess,pathlib
pty.openpty()
r=subprocess.run(['/usr/bin/bash','-c','printf shell-ok'],capture_output=True,text=True,check=True)
assert r.stdout=='shell-ok'
pathlib.Path(${JSON.stringify(join(workspace, "result"))}).write_text('written')
for p in [${JSON.stringify(protectedPath)},${JSON.stringify(auth)}]:
 try: pathlib.Path(p).write_text('bad'); raise AssertionError('unexpected write')
 except OSError: pass
print('PTY and isolation verified')`;
    const inner = agentSandbox({
      workspace,
      runtime,
      originalHome,
      authentication: auth,
      binaryDirectory: "/usr/bin",
      executable: "/usr/bin/python3",
      args: ["-c", python],
    });
    const result = spawnSync(
      "bwrap",
      [
        "--die-with-parent",
        "--unshare-pid",
        "--ro-bind",
        "/",
        "/",
        "--dev",
        "/dev",
        "--proc",
        "/proc",
        "--tmpfs",
        "/tmp",
        "--bind",
        workspace,
        workspace,
        "--bind",
        runtime,
        runtime,
        "--",
        "bwrap",
        ...inner,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PTY and isolation verified/);
    assert.equal(readFileSync(auth, "utf8"), "test-credential-placeholder");
    assert.equal(readFileSync(protectedPath, "utf8"), "unchanged");
    assert.equal(readFileSync(join(workspace, "result"), "utf8"), "written");
  },
);
