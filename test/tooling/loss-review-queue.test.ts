import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  reviewLossQueue,
  type LossReviewAction,
} from "../../scripts/bot-improvement/loss-review-queue.ts";
import { encodeLogRecord } from "../../scripts/bot-improvement/game-log.ts";
import { digest } from "../../scripts/bot-improvement/session-fixtures.ts";

async function fixture() {
  const session = await mkdtemp(path.join(tmpdir(), "loss-review-queue-"));
  await writeFile(
    path.join(session, "config.json"),
    JSON.stringify({ limits: { stop: { maxWallMs: 86400000 } } }),
  );
  await mkdir(path.join(session, "source"));
  const losses = [];
  for (const game of [1, 2]) {
    const text =
      "ASCENCIO_LOSS_LOG\t2\n" +
      [
        [
          "GAME",
          { game_id: `match-0001-game-${game}`, outcome: "loss", starter: "a" },
        ],
        ["INITIAL", { own_opening_hand: { card: [] }, public_state: {} }],
        [
          "EVENT",
          {
            kind: "decision",
            sequence: 1,
            decision_id: "d1",
            actor: "a",
            turn: 1,
            phase: "main1",
            prompt: {
              kind: "action",
              minimum: 1,
              maximum: 1,
              cancelable: false,
              ordered: false,
              choices: {
                choice: [
                  { id: "a", label: "Attack" },
                  { id: "b", label: "Pass" },
                ],
              },
            },
            selected_choice_ids: { choice_id: ["b"] },
          },
        ],
        ["RESULT", { outcome: "loss" }],
        ["END_GAME", `match-0001-game-${game}`],
      ]
        .map(([tag, value]) => encodeLogRecord(tag as string, value))
        .join("");
    const relative = `source/game-${game}.log`;
    await writeFile(path.join(session, relative), text);
    losses.push({
      game,
      log: { path: relative, sha256: digest(text) },
      decisions: ["d1"],
    });
  }
  const packet = {
    executionIdentity: "execution",
    jobs: [
      {
        id: "job-1",
        packetSha256: "a".repeat(64),
        match: "match-0001",
        losses,
      },
    ],
  };
  const bytes = JSON.stringify(packet);
  await writeFile(path.join(session, "packet.json"), bytes);
  const request = {
    queue: "readable-review/test",
    action: "prepare" as const,
    packet: { path: "packet.json", sha256: digest(bytes) },
    workers: 1,
    runtimeSlots: 2,
  };
  return {
    session,
    request,
    run: (action: Omit<LossReviewAction, "queue">) =>
      reviewLossQueue(session, {
        queue: request.queue,
        ...action,
      } as LossReviewAction),
  };
}
function completed(
  claim: NonNullable<Awaited<ReturnType<typeof reviewLossQueue>>["claim"]>,
) {
  return {
    action: "complete" as const,
    queue: "readable-review/test",
    id: claim.id,
    token: claim.claim!.token,
    reviewSha256: claim.review.sha256,
    finding: {
      game: claim.game,
      decision: "d1",
      classification: "avoidable" as const,
      reason: "Missed attack",
      solution: "Attack",
    },
    reasons: [
      {
        game: claim.game,
        id: "missed-attack",
        decision: "d1",
        offered: ["a", "b"],
        chosen: ["b"],
        reason: "Missed attack",
        solution: "Attack",
      },
    ],
  };
}

test("one claim per loss, bounded concurrency, exact findings and complete match aggregation", async () => {
  const { session, request } = await fixture();
  try {
    assert.equal((await reviewLossQueue(session, request)).losses, 2);
    const a = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "analyst-a",
      })
    ).claim!;
    assert.equal(
      (
        await reviewLossQueue(session, {
          queue: request.queue,
          action: "claim",
          owner: "analyst-a",
        })
      ).claim!.claim!.token,
      a.claim!.token,
    );
    assert.equal(
      (
        await reviewLossQueue(session, {
          queue: request.queue,
          action: "claim",
          owner: "analyst-b",
        })
      ).claim,
      null,
    );
    await assert.rejects(
      reviewLossQueue(session, { ...completed(a), token: "stale" }),
      /Stale/,
    );
    await assert.rejects(
      reviewLossQueue(session, { ...completed(a), reviewSha256: "wrong" }),
      /hash mismatch/,
    );
    await assert.rejects(
      reviewLossQueue(session, {
        ...completed(a),
        finding: { ...completed(a).finding, decision: "foreign" },
      }),
      /foreign decision/,
    );
    await assert.rejects(
      reviewLossQueue(session, {
        ...completed(a),
        reasons: [{ ...completed(a).reasons[0]!, chosen: ["a"] }],
      }),
      /choices differ/,
    );
    const first = await reviewLossQueue(session, completed(a));
    assert.equal(first.reviewedLosses, 1);
    assert.equal(first.reports.length, 0);
    assert.equal(first.complete, false);
    assert.equal(
      (await reviewLossQueue(session, completed(a))).reviewedLosses,
      1,
    );
    await assert.rejects(
      reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "analyst-a",
      }),
      /distinct analyst/,
    );
    const b = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "analyst-b",
      })
    ).claim!;
    const result = await reviewLossQueue(session, completed(b));
    assert.equal(result.complete, true);
    assert.equal(result.reports.length, 1);
    assert.deepEqual(
      result.reports[0]!.findings.map((x) => x.game),
      [1, 2],
    );
    assert.equal(
      (
        await reviewLossQueue(session, {
          queue: request.queue,
          action: "audit",
        })
      ).reviewedLosses,
      2,
    );
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});

test("source and rendered file corruption block claims/completion", async () => {
  const { session, request } = await fixture();
  try {
    await reviewLossQueue(session, request);
    const a = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "a",
      })
    ).claim!;
    const rendered = await readFile(path.join(session, a.review.path));
    await writeFile(path.join(session, a.review.path), "changed");
    await assert.rejects(
      reviewLossQueue(session, completed(a)),
      /Evidence mismatch/,
    );
    await writeFile(path.join(session, a.review.path), rendered);
    await writeFile(path.join(session, a.source.path), "changed source");
    await assert.rejects(
      reviewLossQueue(session, completed(a)),
      /Evidence mismatch/,
    );
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});

test("release requires termination, preserves distinct ownership, and rejects stale completion", async () => {
  const { session, request } = await fixture();
  try {
    await reviewLossQueue(session, request);
    const a = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "a",
      })
    ).claim!;
    const release = {
      queue: request.queue,
      action: "release" as const,
      id: a.id,
      token: a.claim!.token,
      terminated: true as const,
    };
    await assert.rejects(
      reviewLossQueue(session, {
        ...release,
        terminated: false,
      } as unknown as LossReviewAction),
      /terminated/,
    );
    await reviewLossQueue(session, release);
    const b = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "b",
      })
    ).claim!;
    assert.equal(a.id, b.id);
    assert.notEqual(a.claim!.token, b.claim!.token);
    await assert.rejects(reviewLossQueue(session, completed(a)), /Stale/);
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});

test("symlinks, unsafe paths, runtime oversubscription and owner-stop fence admission", async () => {
  const { session, request } = await fixture();
  const outside = await mkdtemp(path.join(tmpdir(), "loss-review-outside-"));
  try {
    await assert.rejects(
      reviewLossQueue(session, { ...request, workers: 3, runtimeSlots: 2 }),
      /capacity/,
    );
    await assert.rejects(
      reviewLossQueue(session, { ...request, queue: "../escape" }),
      /Unsafe/,
    );
    await symlink(outside, path.join(session, "linked"));
    await assert.rejects(
      reviewLossQueue(session, { ...request, queue: "linked/queue" }),
      /Symlink/,
    );
    await reviewLossQueue(session, request);
    await assert.rejects(
      reviewLossQueue(session, { ...request, workers: 2 }),
      /immutable/,
    );
    await writeFile(path.join(session, "OWNER_STOP"), "stop");
    await assert.rejects(
      reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "a",
      }),
      /OWNER_STOP/,
    );
    assert.equal(
      (
        await reviewLossQueue(session, {
          queue: request.queue,
          action: "status",
        })
      ).reviewedLosses,
      0,
    );
  } finally {
    await rm(session, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("concurrent claims respect capacity and choice sidecar remains hash-bound", async () => {
  const { session, request } = await fixture();
  try {
    await reviewLossQueue(session, request);
    const responses = await Promise.all(
      ["a", "b"].map((owner) =>
        reviewLossQueue(session, {
          queue: request.queue,
          action: "claim",
          owner,
        }),
      ),
    );
    const claims = responses.flatMap((r) => (r.claim ? [r.claim] : []));
    assert.equal(claims.length, 1);
    const claim = claims[0]!;
    const choices = JSON.parse(
      await readFile(path.join(session, claim.choices.path), "utf8"),
    );
    assert.deepEqual(choices.d1.options, { O1: "a", O2: "b" });
    await writeFile(path.join(session, claim.choices.path), "{}");
    await assert.rejects(
      reviewLossQueue(session, completed(claim)),
      /Evidence mismatch/,
    );
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});

test("v4 uses the single readable file and wall exhaustion blocks admission", async () => {
  const { session, request } = await fixture();
  try {
    const packet = JSON.parse(
      await readFile(path.join(session, "packet.json"), "utf8"),
    );
    const content = "# Named card review\nOne loss, one page.\n";
    await writeFile(path.join(session, "published.md"), content);
    packet.jobs[0].losses[0].review = {
      version: 4,
      pages: [
        {
          path: "published.md",
          sha256: digest(content),
          offset: 0,
          bytes: Buffer.byteLength(content),
          pageSha256: digest(content),
        },
      ],
    };
    const bytes = JSON.stringify(packet);
    await writeFile(path.join(session, "packet.json"), bytes);
    await reviewLossQueue(session, {
      ...request,
      packet: { path: "packet.json", sha256: digest(bytes) },
    });
    const claimed = (
      await reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "a",
      })
    ).claim!;
    assert.equal(
      await readFile(path.join(session, claimed.review.path), "utf8"),
      content,
    );
    await writeFile(
      path.join(session, "control.json"),
      JSON.stringify({ startedAt: Date.now() - 100, limits: { maxWallMs: 1 } }),
    );
    await assert.rejects(
      reviewLossQueue(session, {
        queue: request.queue,
        action: "claim",
        owner: "b",
      }),
      /wall budget/,
    );
    await reviewLossQueue(session, {
      queue: request.queue,
      action: "release",
      id: claimed.id,
      token: claimed.claim!.token,
      terminated: true,
    });
  } finally {
    await rm(session, { recursive: true, force: true });
  }
});
