import type { ChoiceId } from "../../duel/contracts/ids.ts";

export class ImmutableChoiceIdSet implements ReadonlySet<ChoiceId> {
  readonly #values: Set<ChoiceId>;

  constructor(values: Iterable<ChoiceId>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: ChoiceId): boolean {
    return this.#values.has(value);
  }

  entries(): SetIterator<[ChoiceId, ChoiceId]> {
    return this.#values.entries();
  }

  keys(): SetIterator<ChoiceId> {
    return this.#values.keys();
  }

  values(): SetIterator<ChoiceId> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (
      value: ChoiceId,
      value2: ChoiceId,
      set: ReadonlySet<ChoiceId>,
    ) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values)
      callbackfn.call(thisArg, value, value, this);
  }

  union<U>(other: ReadonlySetLike<U>): Set<ChoiceId | U> {
    return this.#values.union(other);
  }

  intersection<U>(other: ReadonlySetLike<U>): Set<ChoiceId & U> {
    return this.#values.intersection(other);
  }

  difference<U>(other: ReadonlySetLike<U>): Set<ChoiceId> {
    return this.#values.difference(other);
  }

  symmetricDifference<U>(other: ReadonlySetLike<U>): Set<ChoiceId | U> {
    return this.#values.symmetricDifference(other);
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    return this.#values.isSubsetOf(other);
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    return this.#values.isSupersetOf(other);
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    return this.#values.isDisjointFrom(other);
  }

  [Symbol.iterator](): SetIterator<ChoiceId> {
    return this.values();
  }
}
