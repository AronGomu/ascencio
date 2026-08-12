import { describe, expect, it } from "vitest";
import { handPage, HAND_PAGE_SIZE } from "../../src/field/hand-pagination.ts";

describe("handPage", () => {
  it("returns one empty page", () => {
    const result = handPage([], 8);
    expect(result.page).toBe(0);
    expect(result.pageCount).toBe(1);
    expect(result.items).toEqual([]);
    expect(result.canPrevious).toBe(false);
    expect(result.canNext).toBe(false);
  });

  it("returns all ten items on one page", () => {
    const items = Array.from({ length: 10 }, (_, index) => index);
    const result = handPage(items, 0);
    expect(result.items).toHaveLength(10);
    expect(result.canPrevious).toBe(false);
    expect(result.canNext).toBe(false);
  });

  it("splits eleven items without duplication", () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    const first = handPage(items, 0);
    const second = handPage(items, 1);
    expect(first.items).toEqual(items.slice(0, 10));
    expect(second.items).toEqual(items.slice(10));
    expect([...first.items, ...second.items]).toEqual(items);
  });

  it("clamps a stale page after hand shrink", () => {
    const large = Array.from({ length: 21 }, (_, index) => index);
    handPage(large, 2);
    const small = Array.from({ length: 9 }, (_, index) => index);
    const result = handPage(small, 2);
    expect(result.page).toBe(0);
    expect(result.items).toHaveLength(9);
  });

  it("does not mutate input", () => {
    const items = Object.freeze([1, 2, 3]);
    expect(() => handPage(items, 0)).not.toThrow();
    expect(items).toEqual([1, 2, 3]);
  });

  it("exposes the page size constant", () => {
    expect(HAND_PAGE_SIZE).toBe(10);
  });
});
