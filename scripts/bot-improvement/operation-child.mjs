import process from "node:process";
import console from "node:console";
import { setTimeout } from "node:timers";
/** Owned group guardian: execute only after the supervisor durably records us. */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { readdir, readFile } from "node:fs/promises";
// Keep the authenticated group leader alive through TERM so escalation can
// still verify its birth identity if a descendant ignores graceful shutdown.
process.on("SIGTERM", () => {});
process.on("SIGINT", () => {});
const input = createInterface({ input: process.stdin });
const line = await new Promise((resolve, reject) => {
  input.once("line", resolve);
  input.once("close", () => reject(Error("Supervisor ended before admission")));
});
input.close();
const { command, args, cwd } = JSON.parse(line);
const child = spawn(command, args, {
  cwd,
  stdio: ["ignore", "inherit", "inherit"],
});
child.once("error", (e) => {
  console.error(String(e));
  process.exitCode = 1;
});
child.once("exit", async (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
  if (process.platform === "linux") {
    for (;;) {
      const names = await readdir("/proc");
      let descendants = false;
      for (const name of names) {
        if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
        try {
          const stat = await readFile(`/proc/${name}/stat`, "utf8");
          const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
          if (Number(fields[2]) === process.pid && fields[0] !== "Z") {
            descendants = true;
            break;
          }
        } catch (error) {
          if (error.code !== "ENOENT" && error.code !== "ESRCH") throw error;
        }
      }
      if (!descendants) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
});
// Stay alive as group leader until the command settles. Termination is sent to
// this entire owned group by the supervisor, never to a user process group.
