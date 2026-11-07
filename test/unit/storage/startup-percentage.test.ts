import { expect, it } from "vitest";
import { startupPercentage } from "../../../src/shell/startup/startup-percentage.ts";

it("advances across conditional phases without giving each phase its own 100%", () => {
  const checkpoints = [
    { phase: "startup", completed: 1, total: 1 },
    { phase: "verification", completed: 4, total: 4 },
    { phase: "engine-preparation", completed: 2, total: 2 },
    { phase: "user-state", completed: 1, total: 1 },
    { phase: "domain-projections", completed: 1, total: 1 },
    { phase: "gameplay-preparation", completed: 9, total: 9 },
  ].map(startupPercentage);
  expect(checkpoints).toEqual([...checkpoints].sort((a, b) => a - b));
  expect(checkpoints[0]).toBeGreaterThan(0);
  expect(checkpoints.at(-1)).toBe(99);
  expect(checkpoints.every((percentage) => percentage < 100)).toBe(true);
});

it("bounds invalid and overreported checkpoints while reserving 100% for admission", () => {
  expect(startupPercentage({ phase: "unknown", completed: 1, total: 1 })).toBe(
    0,
  );
  for (const completed of [-1, NaN, Infinity]) {
    expect(startupPercentage({ phase: "startup", completed, total: 1 })).toBe(
      0,
    );
  }
  expect(startupPercentage({ phase: "startup", completed: 1, total: 0 })).toBe(
    0,
  );
  expect(
    startupPercentage({
      phase: "gameplay-preparation",
      completed: 99,
      total: 1,
    }),
  ).toBe(99);
});
