/** Linux full native app process-tree RSS. Run while the harness is active. */
import { readFile, readdir, writeFile } from "node:fs/promises";
const [pidArg, destination] = process.argv.slice(2);
const root = Number(pidArg);
if (!root || !destination)
  throw new Error("Usage: process-memory.ts <app-pid> <output.json>");
const rows = [];
for (const name of await readdir("/proc")) {
  if (!/^\d+$/.test(name)) continue;
  try {
    const status = await readFile(`/proc/${name}/status`, "utf8");
    rows.push({
      pid: Number(name),
      ppid: Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]),
      name: /^Name:\s+(.+)/m.exec(status)?.[1],
      rssBytes: Number(/^VmRSS:\s+(\d+)/m.exec(status)?.[1] ?? 0) * 1024,
    });
  } catch {
    /* Process exited. */
  }
}
const descendants = new Set([root]);
for (let pass = 0; pass < rows.length; pass++) {
  let added = false;
  for (const row of rows)
    if (descendants.has(row.ppid) && !descendants.has(row.pid)) {
      descendants.add(row.pid);
      added = true;
    }
  if (!added) break;
}
const processes = rows.filter((r) => descendants.has(r.pid));
await writeFile(
  destination,
  JSON.stringify(
    {
      method:
        "Linux /proc VmRSS snapshot; sum includes shared pages more than once; whole app plus webview and bot processes, not isolated bot allocation",
      processes,
      totalRssBytes: processes.reduce((n, r) => n + r.rssBytes, 0),
    },
    null,
    2,
  ),
);
