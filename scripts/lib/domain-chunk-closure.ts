import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface DomainChunkReport {
  readonly domain: "battle" | "deck-editor" | "story";
  readonly entryChunk: string;
  readonly bytes: number;
}

/* Vite names a lazy chunk after the module the dynamic import resolves to, so
   `import("../battle/index.ts")` in `src/shell/domain-loaders.ts` emits
   `battle-<hash>.js`. The hash changes with every content edit, so a budget can
   only ever match the prefix. A domain whose prefix is absent is a build the
   budgets cannot describe, so `measureDomainChunks` throws instead of reporting
   zero bytes — a silent zero would read as "well under budget". */
const DOMAIN_CHUNK_PREFIXES: ReadonlyArray<
  readonly [DomainChunkReport["domain"], string]
> = [
  ["battle", "battle-"],
  ["deck-editor", "deck-editor-"],
  ["story", "story-"],
];

/* T21 2026-08-15: budgets are `ceil(measured / 25_000) * 25_000 * 1.15`, from
   the measurement recorded next to each entry. They guard drift with visible
   headroom rather than tracking the measurement, so ordinary churn does not
   move them; a domain crossing its ceiling is a chunk-composition change worth
   a look. `verify-browser-build.ts` gates them and
   `tests/unit/domain-chunk-closure.test.ts` asserts the built tree keeps at
   least 10% headroom, so both read this one table. */
export const DOMAIN_BUDGET_BYTES: Readonly<
  Record<DomainChunkReport["domain"], number>
> = {
  // measured 405,950 bytes → ceil(405950/25_000) = 17 → 425,000 * 1.15
  battle: 488_750,
  /* T22 2026-08-16: raised from 143,750. The deck editor's catalog is no longer
     a 27-card fixture but the build's own packaged card set — 120 cards of masks
     plus their names and effect text, ~58 kB in a chunk the editor and the duel
     share. That payload is the feature: a deck a player builds is only offerable
     at `#/duel` because the editor could only offer cards this build can draw.
     Measured 150,849 bytes → ceil(150849/25_000) = 7 → 175,000 * 1.15, leaving
     25.0% headroom. The same change took battle from 405,950 to 365,853 by
     ending the three-way duplication of the card-text manifest inside its
     closure, so its ceiling is untouched and now has more room than before. */
  "deck-editor": 201_250,
  // measured 60,195 bytes → ceil(60195/25_000) = 3 → 75,000 * 1.15
  story: 86_250,
};

/** Bytes each domain's lazy chunk adds on top of the shell it loads into. */
export async function measureDomainChunks(
  _outputRoot: string,
  javaScriptFiles: readonly string[],
  shellClosure: ReadonlySet<string>,
): Promise<readonly DomainChunkReport[]> {
  const byName = new Map(
    javaScriptFiles.map((file) => [path.basename(file), file] as const),
  );
  const reports: DomainChunkReport[] = [];
  for (const [domain, prefix] of DOMAIN_CHUNK_PREFIXES) {
    const entryFile = javaScriptFiles.find((file) =>
      path.basename(file).startsWith(prefix),
    );
    if (entryFile === undefined)
      throw new Error(
        `Browser build did not emit the ${domain} domain chunk (expected ${prefix}*.js)`,
      );
    const closure = await moduleClosure([entryFile], byName, shellClosure);
    const sizes = await Promise.all(
      closure.map(async (file) => (await stat(file)).size),
    );
    reports.push({
      domain,
      entryChunk: path.basename(entryFile),
      bytes: sizes.reduce((total, bytes) => total + bytes, 0),
    });
  }
  return reports;
}

/** The chunks an entry document pulls in before any route is visited. */
export async function staticHtmlScriptClosure(
  outputRoot: string,
  htmlName: string,
  javaScriptFiles: readonly string[],
): Promise<string[]> {
  const html = await readFile(path.join(outputRoot, htmlName), "utf8");
  const byName = new Map(
    javaScriptFiles.map((file) => [path.basename(file), file] as const),
  );
  const entries = [
    ...html.matchAll(/<script[^>]+src=["'][^"']*\/([^/"']+\.js)["']/g),
  ]
    .map((match) => byName.get(match[1]!))
    .filter((file): file is string => file !== undefined);
  const closure = await moduleClosure(entries, byName, new Set());
  if (closure.length === 0)
    throw new Error(`Browser build ${htmlName} has no module entry script`);
  return closure;
}

/* Static `import`/`export … from` specifiers only: a `import("./x.js")` call is
   a further lazy chunk and belongs to whichever route pays for it, not to the
   closure being measured. That is exactly what keeps the domain chunks out of
   the shell closure. */
async function moduleClosure(
  entryFiles: readonly string[],
  byName: ReadonlyMap<string, string>,
  excluded: ReadonlySet<string>,
): Promise<string[]> {
  const closure = new Set<string>();
  const pending = [...entryFiles];
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (closure.has(file) || excluded.has(file)) continue;
    closure.add(file);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g,
    )) {
      const dependency = byName.get(match[1]!);
      if (dependency !== undefined && !closure.has(dependency))
        pending.push(dependency);
    }
  }
  return [...closure];
}
