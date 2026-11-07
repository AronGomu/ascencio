/** Validate memory declarations before compiling untrusted package bytes. */
export function validateWasmLimits(bytes: Uint8Array): void {
  if (
    bytes.length > 4 * 1024 * 1024 ||
    bytes.length < 8 ||
    bytes.slice(0, 8).join() !== "0,97,115,109,1,0,0,0"
  )
    throw new Error("Invalid or oversized bot WASM");
  let i = 8,
    memories = 0;
  function uleb() {
    let value = 0,
      shift = 0;
    for (let n = 0; n < 5; n++) {
      const b = bytes[i++];
      if (b === undefined) throw new Error("Truncated WASM");
      value += (b & 127) * 2 ** shift;
      if (!(b & 128)) return value;
      shift += 7;
    }
    throw new Error("Invalid WASM integer");
  }
  while (i < bytes.length) {
    const id = bytes[i++];
    const length = uleb();
    const end = i + length;
    if (end > bytes.length) throw new Error("Truncated WASM section");
    if (id === 2 && uleb() !== 0)
      throw new Error("Bot WASM may not import capabilities");
    if (id === 4) {
      const tables = uleb();
      if (tables > 1)
        throw new Error("Bot supports at most one bounded function table");
      if (tables === 1) {
        const element = bytes[i++],
          flags = uleb(),
          minimum = uleb(),
          maximum = uleb();
        if (
          element !== 0x70 ||
          flags !== 1 ||
          minimum > maximum ||
          maximum > 65536
        )
          throw new Error("Bot table must be bounded to 65536 functions");
      }
    }
    if (id === 5) {
      memories = uleb();
      if (memories !== 1) throw new Error("Bot requires one bounded memory");
      const flags = uleb(),
        minimum = uleb(),
        maximum = uleb();
      if (flags !== 1 || minimum > maximum || maximum > 8192)
        throw new Error("Bot memory must be bounded to 512 MiB");
    }
    i = end;
  }
  if (memories !== 1) throw new Error("Bot memory missing");
}
