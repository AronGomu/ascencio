import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const releaseScript = fileURLToPath(
  new URL("./readable-content-release.ts", import.meta.url),
);
const verified = spawnSync(process.execPath, [releaseScript, "verify-staged"], {
  cwd: root,
  encoding: "utf8",
});
if (verified.error) throw verified.error;
if (verified.status === 0) {
  process.stdout.write(verified.stdout);
} else {
  console.log("Preparing the fixed browser development content…");
  const prepared = spawnSync(process.execPath, [releaseScript, "prepare"], {
    cwd: root,
    stdio: "inherit",
  });
  if (prepared.error) throw prepared.error;
  process.exitCode = prepared.status ?? 1;
}
