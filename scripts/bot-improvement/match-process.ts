import { spawn, type ChildProcess } from "node:child_process";
const activeProcesses = new Set<ChildProcess>();
let interrupted = false;
export function interruptActiveProcess() {
  interrupted = true;
  for (const child of activeProcesses) child.kill("SIGINT");
}
export function runProcess(command: string, args: string[]) {
  if (interrupted) return Promise.resolve(130);
  return new Promise<number>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ARO2_NODE: process.execPath },
    });
    activeProcesses.add(child);
    const interrupt = interruptActiveProcess;
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", interrupt);
    child.on("error", reject);
    child.on("close", (code) => {
      activeProcesses.delete(child);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      resolve(code ?? 2);
    });
  });
}
export const matchOptions = {
  session: { type: "string" },
  out: { type: "string" },
  workers: { type: "string", default: "auto" },
  candidate: { type: "string" },
  self: { type: "string" },
  limits: { type: "string" },
  "max-games": { type: "string" },
  "max-wall-ms": { type: "string" },
  resume: { type: "boolean" },
  matches: { type: "string" },
  iteration: { type: "string" },
  role: { type: "string" },
} as const;
