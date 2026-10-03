const MAX_PIXELS = 16_777_216;
const MAX_DIMENSION = 16_384;
function bounded(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION &&
    width * height <= MAX_PIXELS
  );
}
/** Refuse large raster allocations before passing optional bytes to a browser decoder. */
export function boundedMediaImage(bytes: Uint8Array, mime: string): boolean {
  if (!mime.startsWith("image/")) return true;
  if (mime === "image/svg+xml") return bytes.byteLength <= 1024 * 1024;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const signature = (offset: number, text: string) =>
    offset + text.length <= bytes.length &&
    [...text].every(
      (char, index) => bytes[offset + index] === char.charCodeAt(0),
    );
  if (bytes.length >= 24 && signature(1, "PNG") && signature(12, "IHDR"))
    return bounded(view.getUint32(16), view.getUint32(20));
  if (bytes.length >= 10 && (signature(0, "GIF87a") || signature(0, "GIF89a")))
    return bounded(view.getUint16(6, true), view.getUint16(8, true));
  if (bytes.length >= 30 && signature(0, "RIFF") && signature(8, "WEBP")) {
    if (signature(12, "VP8X"))
      return bounded(
        1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
        1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16),
      );
    if (
      signature(12, "VP8 ") &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    )
      return bounded(
        view.getUint16(26, true) & 0x3fff,
        view.getUint16(28, true) & 0x3fff,
      );
    if (signature(12, "VP8L") && bytes[20] === 0x2f) {
      const dimensions = view.getUint32(21, true);
      return bounded(
        (dimensions & 0x3fff) + 1,
        ((dimensions >>> 14) & 0x3fff) + 1,
      );
    }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    for (
      let count = 0;
      count < 4096 && offset < Math.min(bytes.length - 8, 131072);
      count++
    ) {
      if (bytes[offset++] !== 0xff) return false;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) return false;
      if (
        marker === 0x01 ||
        (marker !== undefined && marker >= 0xd0 && marker <= 0xd7)
      )
        continue;
      if (offset + 7 > bytes.length) return false;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return false;
      if (
        marker !== undefined &&
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      )
        return (
          length >= 7 &&
          bounded(view.getUint16(offset + 5), view.getUint16(offset + 3))
        );
      offset += length;
    }
  }
  return false;
}
