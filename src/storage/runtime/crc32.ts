const TABLE = createTable();

export const CRC32_INITIAL = 0xffffffff;

export function updateCrc32(state: number, bytes: Uint8Array): number {
  let next = state >>> 0;
  for (const byte of bytes)
    next = (TABLE[(next ^ byte) & 0xff]! ^ (next >>> 8)) >>> 0;
  return next;
}

export function finishCrc32(state: number): number {
  return ~state >>> 0;
}

function createTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[value] = crc >>> 0;
  }
  return table;
}
