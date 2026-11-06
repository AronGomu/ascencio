import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  previousSession,
  saveSession,
} from "../scripts/bot-campaign/session.ts";
test("persistent sessions recover only after loss, corruption or explicit context exhaustion, preserving handoff evidence", async () => {
  const root = await mkdtemp(resolve("generated/campaign-session-"));
  await mkdir(join(root, "runtime/sessions"), { recursive: true });
  const session = {
    session_id: "provider-session",
    model: "test-model",
    effort: "low",
    logical_agent_id: "deck-a",
  };
  await saveSession(root, session);
  await writeFile(
    join(root, "runtime/sessions/provider-session.jsonl"),
    "history",
  );
  assert.deepEqual(await previousSession(root, "test-model", "low"), session);
  await assert.rejects(
    previousSession(root, "different-model", "low"),
    /settings changed/,
  );
  await saveSession(root, {
    ...session,
    replace_reason: "context window exceeded",
  });
  assert.equal(await previousSession(root, "test-model", "low"), undefined);
  assert.ok((await readdir(root)).some((f) => f.startsWith("lost-session-")));
  await writeFile(join(root, "session.json"), "{truncated");
  assert.equal(await previousSession(root, "test-model", "low"), undefined);
  assert.ok(
    (await readdir(root)).some((f) => f.startsWith("corrupted-session-")),
  );
  await saveSession(root, { ...session, session_id: "missing" });
  assert.equal(await previousSession(root, "test-model", "low"), undefined);
});
