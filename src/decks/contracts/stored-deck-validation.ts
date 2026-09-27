import type {
  DeckAutosaveRecord,
  DeckCardLists,
  DeckHistory,
  DeckRecord,
  StoredDeck,
} from "../deck-contracts.ts";

const ISSUE_CODES = new Set([
  "main-under-minimum",
  "main-over-maximum",
  "extra-over-maximum",
  "side-over-maximum",
  "copy-limit",
  "forbidden",
  "wrong-zone",
  "missing-card",
  "not-owned",
  "unsupported-card",
  "empty-extra",
  "empty-side",
  "ruleset-changed",
  "import-review",
]);

export function isStoredDeck(value: unknown): value is StoredDeck {
  return (
    exact(value, ["deck", "history"]) &&
    isDeckRecord(value.deck) &&
    isDeckHistory(value.history)
  );
}

export function isDeckAutosaveRecord(
  value: unknown,
): value is DeckAutosaveRecord {
  if (!record(value)) return false;
  const keys = Object.keys(value).sort().join("\n");
  const required = [
    "id",
    "deckId",
    "deckName",
    "createdAt",
    "main",
    "extra",
    "side",
  ];
  const withIllustration = [...required, "illustrationCardCode"];
  if (
    keys !== required.sort().join("\n") &&
    keys !== withIllustration.sort().join("\n")
  )
    return false;
  return (
    nonempty(value.id) &&
    nonempty(value.deckId) &&
    typeof value.deckName === "string" &&
    nonempty(value.createdAt) &&
    cardLists(value) &&
    (value.illustrationCardCode === undefined ||
      value.illustrationCardCode === null ||
      positive(value.illustrationCardCode))
  );
}

function isDeckRecord(value: unknown): value is DeckRecord {
  if (
    !exact(value, [
      "schemaVersion",
      "id",
      "revision",
      "name",
      "createdAt",
      "updatedAt",
      "validation",
      "importedNeedsReview",
      "illustrationCardCode",
      "main",
      "extra",
      "side",
    ])
  )
    return false;
  return (
    value.schemaVersion === 1 &&
    nonempty(value.id) &&
    positive(value.revision) &&
    typeof value.name === "string" &&
    nonempty(value.createdAt) &&
    nonempty(value.updatedAt) &&
    cardLists(value) &&
    validation(value.validation) &&
    typeof value.importedNeedsReview === "boolean" &&
    (value.illustrationCardCode === null ||
      positive(value.illustrationCardCode))
  );
}

function isDeckHistory(value: unknown): value is DeckHistory {
  if (!exact(value, ["undo", "redo", "nextSequence"])) return false;
  return (
    dense(value.undo) &&
    dense(value.redo) &&
    value.undo.every(update) &&
    value.redo.every(update) &&
    count(value.nextSequence)
  );
}

function update(value: unknown): boolean {
  if (
    !exact(value, [
      "id",
      "deckId",
      "sequence",
      "createdAt",
      "before",
      "after",
      "beforeImportedNeedsReview",
      "afterImportedNeedsReview",
      "beforeIllustrationCardCode",
      "afterIllustrationCardCode",
      "reason",
    ])
  )
    return false;
  return (
    nonempty(value.id) &&
    nonempty(value.deckId) &&
    count(value.sequence) &&
    nonempty(value.createdAt) &&
    cardLists(value.before) &&
    cardLists(value.after) &&
    typeof value.beforeImportedNeedsReview === "boolean" &&
    typeof value.afterImportedNeedsReview === "boolean" &&
    nullableCardCode(value.beforeIllustrationCardCode) &&
    nullableCardCode(value.afterIllustrationCardCode) &&
    [
      "add",
      "remove",
      "move",
      "import",
      "restore",
      "sort",
      "illustration",
    ].includes(String(value.reason))
  );
}

function validation(value: unknown): boolean {
  if (!exact(value, ["status", "issues", "rulesetRevision"])) return false;
  return (
    ["valid", "warnings", "errors"].includes(String(value.status)) &&
    dense(value.issues) &&
    value.issues.every((issue) => {
      if (!record(issue)) return false;
      const required = ["id", "severity", "code", "message"];
      const allowed = new Set([...required, "zone", "cardCode"]);
      if (
        required.some((key) => !Object.hasOwn(issue, key)) ||
        Object.keys(issue).some((key) => !allowed.has(key))
      )
        return false;
      return (
        nonempty(issue.id) &&
        ["warning", "error"].includes(String(issue.severity)) &&
        typeof issue.code === "string" &&
        ISSUE_CODES.has(issue.code) &&
        typeof issue.message === "string" &&
        (issue.zone === undefined ||
          ["main", "extra", "side"].includes(String(issue.zone))) &&
        (issue.cardCode === undefined || positive(issue.cardCode))
      );
    }) &&
    typeof value.rulesetRevision === "string"
  );
}

function cardLists(value: unknown): value is DeckCardLists {
  return (
    record(value) &&
    [value.main, value.extra, value.side].every(
      (cards) => dense(cards) && cards.every(positive),
    )
  );
}
function nullableCardCode(value: unknown): boolean {
  return value === null || positive(value);
}
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number {
  return count(value) && value > 0;
}
function nonempty(value: unknown): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= 65_536
  );
}
function dense(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(value, index)) return false;
  return true;
}
function record(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function exact<K extends string>(
  value: unknown,
  keys: readonly K[],
): value is Record<K, unknown> {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
