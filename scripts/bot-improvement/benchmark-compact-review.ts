/** Offline representation benchmark; reads explicit copied loss logs, runs no games. */
import { readFile, writeFile } from "node:fs/promises";
import { compactLossReview } from "./compact-loss-review.ts";
import { readableLossPages } from "./loss-review.ts";
import { digest } from "./session-fixtures.ts";
const [out, ...files] = process.argv.slice(2);
if (!out || !files.length)
  throw Error(
    "Usage: benchmark-compact-review.ts OUTPUT.json COPIED_LOSS_LOG...",
  );
const measurements = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  const start = performance.now();
  const old = readableLossPages(text);
  const legacyMs = performance.now() - start;
  const next = performance.now();
  const compact = compactLossReview(text);
  const compactMs = performance.now() - next;
  measurements.push({
    file,
    sourceSha256: digest(text),
    inputBytes: Buffer.byteLength(text),
    legacyBytes: Buffer.byteLength(old.map((p) => p.text).join("")),
    compactBytes: compact.bytes,
    legacyPages: old.length,
    compactPages: compact.pages.length,
    legacyMs,
    compactMs,
    rows: compact.rows,
  });
}
await writeFile(
  out,
  JSON.stringify(
    {
      scope:
        "offline copied loss logs; zero games, replays or analyst reviews; bytes are not measured model tokens",
      measurements,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(measurements));
