import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DOMAIN_BUDGET_BYTES,
  measureDomainChunks,
  staticHtmlScriptClosure,
} from "../../scripts/lib/domain-chunk-closure.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const outputRoot = path.join(projectRoot, "dist");
/* The built tree is the product of `npm run build`, which `check:headless` does
   not run. The two cases that read it are skipped rather than failed when it is
   absent; `build:verify` gates the same numbers on every real build. The
   acceptance harness builds a second entry document over the same `dist/`, and
   its chunk split is not the shipped one, so that tree is skipped too. */
const builtTreeExists =
  existsSync(path.join(outputRoot, "index.html")) &&
  !existsSync(path.join(outputRoot, "acceptance.html"));

describe("measureDomainChunks", () => {
  let fixtureRoot: string;

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "domain-chunk-"));
    await mkdir(path.join(fixtureRoot, "assets"));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  async function writeChunk(name: string, source: string): Promise<string> {
    const file = path.join(fixtureRoot, "assets", name);
    await writeFile(file, source, "utf8");
    return file;
  }

  async function writeDomainFixture(
    battleSource: string,
  ): Promise<readonly string[]> {
    return [
      await writeChunk("shared-AAAAAAAA.js", "export const shared=1;"),
      await writeChunk("battle-BBBBBBBB.js", battleSource),
      await writeChunk("deck-editor-CCCCCCCC.js", "export const decks=1;"),
      await writeChunk("story-DDDDDDDD.js", "export const story=1;"),
    ];
  }

  it("counts a domain chunk plus the dependencies only it pulls in", async () => {
    const files = await writeDomainFixture(
      'import"./shared-AAAAAAAA.js";export const battle=1;',
    );
    const [shared, battle] = files;

    const reports = await measureDomainChunks(fixtureRoot, files, new Set());
    const report = reports.find(({ domain }) => domain === "battle");

    expect(report?.entryChunk).toBe("battle-BBBBBBBB.js");
    expect(report?.bytes).toBe(
      (await stat(battle!)).size + (await stat(shared!)).size,
    );
  });

  it("excludes chunks the shell closure already paid for", async () => {
    const files = await writeDomainFixture(
      'import"./shared-AAAAAAAA.js";export const battle=1;',
    );
    const [shared, battle] = files;

    const reports = await measureDomainChunks(
      fixtureRoot,
      files,
      new Set([shared!]),
    );

    expect(reports.find(({ domain }) => domain === "battle")?.bytes).toBe(
      (await stat(battle!)).size,
    );
  });

  it("reports every domain chunk it is asked for", async () => {
    const files = await writeDomainFixture("export const battle=1;");

    const reports = await measureDomainChunks(fixtureRoot, files, new Set());

    expect(reports.map(({ domain }) => domain)).toStrictEqual([
      "battle",
      "deck-editor",
      "story",
    ]);
  });

  it("fails naming the domain when its chunk is missing entirely", async () => {
    const files = [
      await writeChunk("battle-BBBBBBBB.js", "export const battle=1;"),
      await writeChunk("deck-editor-CCCCCCCC.js", "export const decks=1;"),
    ];

    await expect(
      measureDomainChunks(fixtureRoot, files, new Set()),
    ).rejects.toThrow(/story domain chunk/);
  });
});

describe("staticHtmlScriptClosure", () => {
  let fixtureRoot: string;

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "shell-closure-"));
    await mkdir(path.join(fixtureRoot, "assets"));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it("follows static imports and stops at dynamic ones", async () => {
    const assets = path.join(fixtureRoot, "assets");
    await writeFile(
      path.join(fixtureRoot, "index.html"),
      '<script type="module" src="/assets/app-AAAAAAAA.js"></script>',
      "utf8",
    );
    await writeFile(
      path.join(assets, "app-AAAAAAAA.js"),
      'import"./shared-BBBBBBBB.js";import("./battle-CCCCCCCC.js");',
      "utf8",
    );
    await writeFile(
      path.join(assets, "shared-BBBBBBBB.js"),
      "export const shared=1;",
      "utf8",
    );
    await writeFile(
      path.join(assets, "battle-CCCCCCCC.js"),
      "export const battle=1;",
      "utf8",
    );
    const files = (await readdir(assets)).map((name) =>
      path.join(assets, name),
    );

    const closure = await staticHtmlScriptClosure(
      fixtureRoot,
      "index.html",
      files,
    );

    expect(closure.map((file) => path.basename(file)).sort()).toStrictEqual([
      "app-AAAAAAAA.js",
      "shared-BBBBBBBB.js",
    ]);
  });

  it("fails when the entry document loads no module script", async () => {
    await writeFile(path.join(fixtureRoot, "index.html"), "<html></html>");

    await expect(
      staticHtmlScriptClosure(fixtureRoot, "index.html", []),
    ).rejects.toThrow(/no module entry script/);
  });
});

describe.skipIf(!builtTreeExists)("the built tree", () => {
  async function builtRoutableFiles(): Promise<readonly string[]> {
    const assets = path.join(outputRoot, "assets");
    return (await readdir(assets))
      .filter(
        (name) =>
          name.endsWith(".js") && !name.startsWith("duel.worker-browser-"),
      )
      .map((name) => path.join(assets, name));
  }

  it("keeps the domain chunks out of the shell closure", async () => {
    const files = await builtRoutableFiles();
    const shellClosure = new Set(
      await staticHtmlScriptClosure(outputRoot, "index.html", files),
    );

    const domainChunks = files.filter((file) =>
      /^(?:battle|deck-editor|story)-/.test(path.basename(file)),
    );

    expect(domainChunks).toHaveLength(3);
    expect(domainChunks.filter((file) => shellClosure.has(file))).toStrictEqual(
      [],
    );
  });

  it("satisfies every domain budget with at least 10% headroom", async () => {
    const files = await builtRoutableFiles();
    const shellClosure = new Set(
      await staticHtmlScriptClosure(outputRoot, "index.html", files),
    );

    const reports = await measureDomainChunks(outputRoot, files, shellClosure);

    for (const { domain, bytes } of reports) {
      const budget = DOMAIN_BUDGET_BYTES[domain];
      expect(
        (budget - bytes) / budget,
        `${domain} closure is ${bytes} of ${budget} bytes`,
      ).toBeGreaterThanOrEqual(0.1);
    }
  });
});
