import { expect, it } from "vitest";
import { startupDiagnostics } from "../../../src/shell/startup/startup-diagnostics.ts";
it("retains compiler diagnostics and source notes rather than hiding them behind a generic startup error", () => {
  const diagnostic = {
    code: "MOD_CONFLICT",
    severity: "error",
    phase: "mod-composition",
    message: "Two overrides conflict",
    source: { file: "cards/a.json", pointer: "/name", modId: "one" },
    notes: [
      {
        message: "Other override",
        source: { file: "cards/b.json", modId: "two" },
      },
    ],
    causes: [],
    remediation: "Declare a dependency-backed resolution.",
  };
  expect(startupDiagnostics({ diagnostics: [diagnostic] })).toEqual([
    diagnostic,
  ]);
  expect(
    startupDiagnostics(new Error("BASE_HASH_MISMATCH: library"))[0]?.code,
  ).toBe("BASE_HASH_MISMATCH");
  expect(
    startupDiagnostics(new DOMException("Cancelled", "AbortError"))[0]?.code,
  ).toBe("OPERATION_CANCELLED");
});
it("reports corrupt critical bytes and user JSON positions with repair details", () => {
  const [hash] = startupDiagnostics(
    `BASE_HASH_MISMATCH: card-library/critical.json: expected ${"a".repeat(64)} received ${"b".repeat(64)}`,
  );
  expect(hash?.source?.file).toBe("card-library/critical.json");
  expect(hash?.expected).toBe("a".repeat(64));
  const [user] = startupDiagnostics(
    "USER_DATA_INVALID: user-data.json: expected value at line 3 column 7",
  );
  expect(user?.source).toEqual({ file: "user-data.json", line: 3, column: 7 });
  const many = startupDiagnostics({
    diagnostics: Array.from({ length: 130 }, () => hash),
  });
  expect(many.at(-1)?.message).toContain("2 further diagnostics suppressed");
});

it("offers explicit mod recovery for an unavailable selected root", () => {
  const [diagnostic] = startupDiagnostics(
    "MOD_ROOT_UNAVAILABLE: selected directory disappeared",
  );
  expect(diagnostic?.phase).toBe("mod-composition");
  expect(diagnostic?.remediation).toContain("disable mods");
});
