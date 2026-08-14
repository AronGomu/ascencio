/** Wraps a sink so exactly one value ever reaches it. A duel can report a
    result, a fatal error and an unmount in any order, and a host that already
    acted on the first must not be told a second, different story. */
export function settleOnce<T>(sink: (value: T) => void): (value: T) => void {
  let settled = false;
  return (value: T): void => {
    if (settled) return;
    settled = true;
    sink(value);
  };
}
