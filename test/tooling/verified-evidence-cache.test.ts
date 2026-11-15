import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  VerifiedEvidenceCache,
  evidenceParseCache,
} from "../../scripts/bot-improvement/verified-evidence-cache.ts";
import { readEvidenceJson } from "../../scripts/bot-improvement/analysis-evidence.ts";
import { publishContentEvidence } from "../../scripts/bot-improvement/content-addressed-evidence.ts";
import { digest } from "../../scripts/bot-improvement/session-fixtures.ts";
import { writeOutput } from "../../scripts/bot-improvement/output-storage.ts";
test("cache checks current hashes, versions parser identities, isolates mutations and enforces retained byte/entry caps", () => {
  const cache = new VerifiedEvidenceCache(500, 2);
  let parses = 0;
  const parse = () => {
    parses++;
    return { nested: { value: 1 } };
  };
  const value = cache.decode("same", "parser/v1", parse, digest("same"));
  value.nested.value = 999;
  assert.equal(cache.decode("same", "parser/v1", parse).nested.value, 1);
  assert.equal(parses, 1);
  assert.throws(
    () => cache.decode("changed", "parser/v1", parse, digest("same")),
    /hash mismatch/,
  );
  cache.decode("same", "parser/v2", parse);
  assert.equal(parses, 2);
  cache.decode("next", "parser/v1", parse);
  assert.ok(cache.stats().entries <= 2);
  assert.ok(cache.stats().retainedBytes <= 500);
  cache.decode("oversized", "parser/v1", () => ({ text: "x".repeat(10000) }));
  assert.ok(cache.stats().retainedBytes <= 500);
});
test("verified JSON rechecks file bytes on warm reads and immutable content publication deduplicates exact bytes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "verified-cache-"));
  try {
    await mkdir(path.join(dir, "scope"));
    const content = '{"value":1}';
    const ref = { path: "source.json", sha256: digest(content) };
    await writeFile(path.join(dir, ref.path), content);
    evidenceParseCache.clear();
    assert.deepEqual(await readEvidenceJson(dir, ref), { value: 1 });
    assert.deepEqual(await readEvidenceJson(dir, ref), { value: 1 });
    assert.ok(evidenceParseCache.stats().hits >= 1);
    await writeFile(path.join(dir, ref.path), '{"value":2}');
    await assert.rejects(readEvidenceJson(dir, ref), /Evidence mismatch/);
    const one = await publishContentEvidence(
        dir,
        "scope",
        "exact bytes",
        writeOutput,
      ),
      two = await publishContentEvidence(
        dir,
        "scope",
        "exact bytes",
        writeOutput,
      );
    assert.deepEqual(one, two);
    assert.equal((await readdir(path.join(dir, "scope/objects"))).length, 1);
    assert.equal(
      await readFile(path.join(dir, one.path), "utf8"),
      "exact bytes",
    );
    await writeFile(path.join(dir, one.path), "changed");
    await assert.rejects(
      publishContentEvidence(dir, "scope", "exact bytes", writeOutput),
      /Evidence mismatch/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
