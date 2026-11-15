import test from "node:test";
import assert from "node:assert/strict";
import {
  compactLossReview,
  reconstructCompactReview,
} from "../../scripts/bot-improvement/compact-loss-review.ts";
import {
  encodeLogRecord,
  decodeLog,
} from "../../scripts/bot-improvement/game-log.ts";
test("compact review exactly reconstructs defaults, removals, arrays, Unicode and forced choices within byte bounds", () => {
  const rows = Array.from({ length: 100 }, (_, sequence) => ({
    kind: "decision",
    sequence,
    decision_id: `long-prefix/decision/${sequence}`,
    prompt: {
      choices: {
        choice: [
          {
            id: "long-choice-id",
            label: "é🐐".repeat(sequence === 2 ? 2000 : 1),
          },
        ],
      },
      optional: null,
    },
    selected_choice_ids: { choice_id: ["long-choice-id"] },
    ...(sequence % 2 ? { removed: { removed: true } } : {}),
  }));
  const text =
    "ASCENCIO_LOSS_LOG\t2\n" +
    rows.map((v) => encodeLogRecord("EVENT", v)).join("");
  const compact = compactLossReview(text, 1024);
  assert.deepEqual(
    reconstructCompactReview(compact.pages.map((p) => p.text).join("")),
    decodeLog(text, "ASCENCIO_LOSS_LOG\t2"),
  );
  assert.ok(compact.pages.every((p) => Buffer.byteLength(p.text) <= 1024));
  assert.equal(compact.index.length, 100);
  assert.throws(() => compactLossReview(text, 100));
});

test("restart blocks reconstruct independently and retain nested removals, card navigation and token bounds", () => {
  const values = Array.from({ length: 70 }, (_, sequence) => ({
    kind: "decision",
    sequence,
    decision_id: `decision-${sequence}`,
    prompt: {
      instance_id: "card-1",
      choices: [
        { id: "choice-A", default: null },
        { id: "choice-B", default: null },
      ],
      nested: {
        same: { deep: [null, false, {}, []] },
        ...(sequence % 2 ? { obsolete: "yes" } : {}),
      },
    },
    selected_choice_ids: ["choice-A"],
  }));
  const text =
    "ASCENCIO_LOSS_LOG\t2\n" +
    values.map((v) => encodeLogRecord("EVENT", v)).join("");
  const compact = compactLossReview(text, {
    maxBytes: 12000,
    maxTokens: 2048,
    checkpointRows: 16,
  });
  assert.equal(compact.version, 3);
  assert.equal(compact.blocks.length, 5);
  const decoded = decodeLog(text, "ASCENCIO_LOSS_LOG\t2");
  for (const block of compact.blocks) {
    const segment = compact.pages
      .slice(block.firstPage, block.firstPage + block.pages)
      .map((p) => p.text)
      .join("");
    assert.deepEqual(
      reconstructCompactReview(segment),
      decoded.slice(block.firstRow, block.firstRow + block.rows),
    );
  }
  assert.ok(
    compact.pages.every(
      (p) => p.tokenUpperBound <= 2048 && Buffer.byteLength(p.text) <= 2048,
    ),
  );
  assert.equal(compact.cardIndex["card-1"]?.length, 70);
  assert.equal(
    compact.pages.reduce((n, p) => n + p.events, 0),
    70,
  );
  assert.equal(compact.pages.flatMap((p) => p.decisions).length, 70);
  assert.match(compact.pages.map((p) => p.text).join(""), /"template"/);
});

test("legacy v2 streams remain decodable and missing bases are rejected", () => {
  assert.deepEqual(
    reconstructCompactReview(
      '["review",2,"hash"]\n["define",0,"kind"]\n["define",1,"decision"]\n["row","EVENT","decision",["o",[0,["s",1]]],[]]\n',
    ),
    [{ tag: "EVENT", value: { kind: "decision" } }],
  );
  assert.throws(
    () =>
      reconstructCompactReview(
        '["review",3,"hash"]\n["delta","EVENT","decision",["="]]\n',
      ),
    /Missing patch base/,
  );
});

test("restart navigation and hash verification do not accept missing or modified context", async () => {
  const { reviewRestartPage } =
    await import("../../scripts/bot-improvement/loss-review.ts");
  const { reconstructReviewBlock } =
    await import("../../scripts/bot-improvement/compact-loss-review.ts");
  const text =
    "ASCENCIO_LOSS_LOG\t2\n" +
    encodeLogRecord("EVENT", {
      kind: "decision",
      sequence: 1,
      prompt: { label: "x".repeat(10000) },
    });
  const review = compactLossReview(text, 1024);
  const block = review.blocks[0]!;
  assert.equal(reviewRestartPage(review.blocks, 2).page, 1);
  assert.deepEqual(
    reconstructReviewBlock(review.pages, block),
    decodeLog(text, "ASCENCIO_LOSS_LOG\t2"),
  );
  assert.throws(
    () => reconstructReviewBlock([{ text: "changed" }], block),
    /hash mismatch/,
  );
  assert.throws(() => reviewRestartPage(review.blocks, 0), /Invalid/);
  assert.throws(() => reviewRestartPage(review.blocks, 10000), /Unknown/);
});
