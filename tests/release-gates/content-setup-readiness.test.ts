import { describe, expect, it } from "vitest";
import { inspectContentSetup } from "../../scripts/lib/content-setup-files.ts";

describe("checked-out content release readiness", () => {
  it("accepts the repository's approved scope and verified media", async () => {
    const report = await inspectContentSetup(process.cwd(), {});
    expect(report).toMatchObject({ codeReady: true, publishReady: false });
    expect(
      report.blockers.some(({ code }) => code === "OWNER_MAPPING_REQUIRED"),
    ).toBe(false);
    expect(
      report.blockers.some(({ detail }) =>
        detail.includes("empty selected sets"),
      ),
    ).toBe(false);
    for (const obsolete of [
      "5 undated sets",
      "509 orphan cards",
      "1 unassigned in-scope",
      "six ordered",
      "Era-date evidence",
    ])
      expect(
        report.blockers.some(({ detail }) => detail.includes(obsolete)),
      ).toBe(false);
  });
});
