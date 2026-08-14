import { describe, expect, it, vi } from "vitest";
import { ImmutableChoiceIdSet } from "../../src/app/presentation/immutable-choice-id-set.ts";
import type { ChoiceId } from "../../src/duel/contracts/ids.ts";

const id = (value: string) => value as ChoiceId;

describe("ImmutableChoiceIdSet", () => {
  it("copies input and implements ReadonlySet iteration", () => {
    const input = new Set([id("a"), id("b")]);
    const values = new ImmutableChoiceIdSet(input);
    input.add(id("c"));

    expect(values.size).toBe(2);
    expect(values.has(id("a"))).toBe(true);
    expect([...values]).toEqual([id("a"), id("b")]);
    expect([...values.keys()]).toEqual([id("a"), id("b")]);
    expect([...values.values()]).toEqual([id("a"), id("b")]);
    expect([...values.entries()]).toEqual([
      [id("a"), id("a")],
      [id("b"), id("b")],
    ]);
  });

  it("passes itself and thisArg through forEach without mutable methods", () => {
    const values = new ImmutableChoiceIdSet([id("a")]);
    const thisArg = {};
    const callback = vi.fn(function (this: unknown, value, value2, set) {
      expect(this).toBe(thisArg);
      expect([value, value2, set]).toEqual([id("a"), id("a"), values]);
    });

    values.forEach(callback, thisArg);

    expect(callback).toHaveBeenCalledOnce();
    expect(Object.isFrozen(values)).toBe(true);
    expect("add" in values).toBe(false);
    expect("delete" in values).toBe(false);
    expect("clear" in values).toBe(false);
  });
});
