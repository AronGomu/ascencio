import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = JSON.parse(readFileSync(new URL("./scoped-code-paths.json", import.meta.url), "utf8"));
for (const args of [["eslint", ...files], ["prettier", "--check", ...files]]) {
  const result = spawnSync("npx", args, { stdio: "inherit" });
  console.log(JSON.stringify({ command: ["npx", ...args], exit: result.status }));
  if (result.status !== 0) process.exit(result.status ?? 1);
}
