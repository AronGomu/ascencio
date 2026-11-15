import test from "node:test";
import assert from "node:assert/strict";
import { FindingsValidationCache } from "../../scripts/bot-improvement/findings-validation-cache.ts";
const hash = "a".repeat(64),
  other = "b".repeat(64);
test("validation cache reuses only fully verified content and invalidates each binding", async () => {
  const cache = new FindingsValidationCache(2, 4096);
  let calls = 0,
    verified = 0;
  const input = {
    packetSha256: hash,
    sourceHashes: { source: hash },
    report: { finding: "a" },
    vocabularyVersion: "v1",
    validatorIdentity: "code1",
  };
  const verify = async () => {
    verified++;
    return { source: hash };
  };
  const validate = () => {
    calls++;
    return { valid: true };
  };
  assert.equal((await cache.validate(input, verify, validate)).reused, false);
  const hit = await cache.validate(input, verify, validate);
  assert.equal(hit.reused, true);
  hit.value.valid = false;
  assert.equal(
    (await cache.validate(input, verify, validate)).value.valid,
    true,
  );
  assert.equal(calls, 1);
  assert.equal(verified, 3);
  await assert.rejects(
    cache.validate(input, async () => ({ source: other }), validate),
    /integrity mismatch/,
  );
  for (const change of [
    { packetSha256: other },
    { report: { finding: "b" } },
    { vocabularyVersion: "v2" },
    { validatorIdentity: "code2" },
  ])
    assert.equal(
      (await cache.validate({ ...input, ...change }, verify, validate)).reused,
      false,
    );
  assert.equal(cache.size, 2);
  assert.ok(cache.bytes <= 4096);
});
