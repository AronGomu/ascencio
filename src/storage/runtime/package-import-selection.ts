import type { StorageResult } from "../contracts/package.ts";
import { inspectSqliteHeaderBytes } from "./package-validation.ts";
import { CRC32_INITIAL, finishCrc32, updateCrc32 } from "./crc32.ts";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
const EOCD_SEARCH_BYTES = EOCD_MIN_BYTES + 0xffff;
const MAX_PACKAGE_FILES = 4;
const UTF8_FLAG = 0x0800;
const ENCRYPTION_FLAGS = 0x2041;
const SUPPORTED_METHODS = new Set([0, 8]);

export interface PackageImportSource {
  readonly name: string;
  readonly size: number;
  open(): Promise<ReadableStream<Uint8Array>>;
}

interface ZipEntry {
  readonly name: string;
  readonly encodedName: Uint8Array;
  readonly flags: number;
  readonly method: number;
  readonly crc32: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
}

export class PackageArchiveError extends Error {
  constructor() {
    super("Invalid package archive");
    this.name = "PackageArchiveError";
  }
}

export async function resolvePackageImportSources(
  files: readonly File[],
): Promise<StorageResult<readonly PackageImportSource[]>> {
  if (files.length === 0 || files.length > MAX_PACKAGE_FILES) return invalid();
  try {
    const kinds = await Promise.all(files.map(isZip));
    if (kinds.some(Boolean)) {
      if (files.length !== 1 || !kinds[0]) return invalid();
      return { kind: "ok", value: await zipSources(files[0]!) };
    }
    return {
      kind: "ok",
      value: files.map((file) => ({
        name: file.name,
        size: file.size,
        async open() {
          return file.stream();
        },
      })),
    };
  } catch (error) {
    if (error instanceof PackageArchiveError) return invalid();
    throw error;
  }
}

export async function inspectPackageImportSourceHeader(
  source: PackageImportSource,
): Promise<StorageResult<void>> {
  const stream = await source.open();
  const reader = stream.getReader();
  const prefix = new Uint8Array(100);
  let offset = 0;
  try {
    while (offset < prefix.length) {
      const result = await reader.read();
      if (result.done) break;
      const count = Math.min(result.value.byteLength, prefix.length - offset);
      prefix.set(result.value.subarray(0, count), offset);
      offset += count;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return inspectSqliteHeaderBytes(source.size, prefix.subarray(0, offset));
}

export function isPackageArchiveError(
  error: unknown,
): error is PackageArchiveError {
  return error instanceof PackageArchiveError;
}

async function isZip(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return (
    bytes.length === 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(bytes[2]!) &&
    [0x04, 0x06, 0x08].includes(bytes[3]!)
  );
}

async function zipSources(file: File): Promise<readonly PackageImportSource[]> {
  if (file.size < EOCD_MIN_BYTES) throw new PackageArchiveError();
  const tailOffset = Math.max(0, file.size - EOCD_SEARCH_BYTES);
  const tail = new Uint8Array(await file.slice(tailOffset).arrayBuffer());
  const eocdIndex = findEocd(tail);
  if (eocdIndex < 0) throw new PackageArchiveError();
  const eocd = view(tail, eocdIndex);
  const entriesOnDisk = eocd.getUint16(8, true);
  const entryCount = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  const commentBytes = eocd.getUint16(20, true);
  const eocdOffset = tailOffset + eocdIndex;
  if (
    eocd.getUint16(4, true) !== 0 ||
    eocd.getUint16(6, true) !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount < 1 ||
    entryCount > MAX_PACKAGE_FILES ||
    eocdIndex + EOCD_MIN_BYTES + commentBytes !== tail.length ||
    centralOffset + centralSize !== eocdOffset ||
    centralSize > 1024 * 1024
  )
    throw new PackageArchiveError();
  const central = new Uint8Array(
    await file.slice(centralOffset, centralOffset + centralSize).arrayBuffer(),
  );
  const entries = parseCentralDirectory(central, entryCount, centralOffset);
  return entries.map((entry) => ({
    name: entry.name,
    size: entry.size,
    async open() {
      return await openEntry(file, entry, centralOffset);
    },
  }));
}

function findEocd(bytes: Uint8Array): number {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let index = bytes.length - EOCD_MIN_BYTES; index >= 0; index -= 1)
    if (data.getUint32(index, true) === EOCD_SIGNATURE) return index;
  return -1;
}

function parseCentralDirectory(
  bytes: Uint8Array,
  entryCount: number,
  centralOffset: number,
): readonly ZipEntry[] {
  const data = view(bytes);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let offset = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.length ||
      data.getUint32(offset, true) !== CENTRAL_SIGNATURE
    )
      throw new PackageArchiveError();
    const flags = data.getUint16(offset + 8, true);
    const method = data.getUint16(offset + 10, true);
    const crc32 = data.getUint32(offset + 16, true);
    const compressedSize = data.getUint32(offset + 20, true);
    const size = data.getUint32(offset + 24, true);
    const nameBytes = data.getUint16(offset + 28, true);
    const extraBytes = data.getUint16(offset + 30, true);
    const entryCommentBytes = data.getUint16(offset + 32, true);
    const disk = data.getUint16(offset + 34, true);
    const localOffset = data.getUint32(offset + 42, true);
    const end = offset + 46 + nameBytes + extraBytes + entryCommentBytes;
    if (
      end > bytes.length ||
      (flags & ENCRYPTION_FLAGS) !== 0 ||
      !SUPPORTED_METHODS.has(method) ||
      disk !== 0 ||
      compressedSize === 0xffffffff ||
      size === 0xffffffff ||
      localOffset === 0xffffffff ||
      localOffset >= centralOffset
    )
      throw new PackageArchiveError();
    const encodedName = bytes.subarray(offset + 46, offset + 46 + nameBytes);
    if ((flags & UTF8_FLAG) === 0 && encodedName.some((byte) => byte > 0x7f))
      throw new PackageArchiveError();
    let name: string;
    try {
      name = decoder.decode(encodedName);
    } catch {
      throw new PackageArchiveError();
    }
    if (
      !/^[^/\\]+\.sqlite$/iu.test(name) ||
      names.has(name.toLocaleLowerCase("en-US")) ||
      size < 512
    )
      throw new PackageArchiveError();
    names.add(name.toLocaleLowerCase("en-US"));
    entries.push({
      name,
      encodedName: Uint8Array.from(encodedName),
      flags,
      method,
      crc32,
      compressedSize,
      size,
      localOffset,
    });
    offset = end;
  }
  if (offset !== bytes.length) throw new PackageArchiveError();
  return entries;
}

async function openEntry(
  archive: File,
  entry: ZipEntry,
  centralOffset: number,
): Promise<ReadableStream<Uint8Array>> {
  const headerBytes = new Uint8Array(
    await archive
      .slice(entry.localOffset, entry.localOffset + 30)
      .arrayBuffer(),
  );
  if (headerBytes.length !== 30) throw new PackageArchiveError();
  const header = view(headerBytes);
  if (
    header.getUint32(0, true) !== LOCAL_SIGNATURE ||
    header.getUint16(6, true) !== entry.flags ||
    header.getUint16(8, true) !== entry.method
  )
    throw new PackageArchiveError();
  const nameBytes = header.getUint16(26, true);
  const extraBytes = header.getUint16(28, true);
  const localName = new Uint8Array(
    await archive
      .slice(entry.localOffset + 30, entry.localOffset + 30 + nameBytes)
      .arrayBuffer(),
  );
  const dataOffset = entry.localOffset + 30 + nameBytes + extraBytes;
  const dataEnd = dataOffset + entry.compressedSize;
  if (
    localName.byteLength !== entry.encodedName.byteLength ||
    localName.some((byte, index) => byte !== entry.encodedName[index]) ||
    dataEnd > centralOffset
  )
    throw new PackageArchiveError();
  const compressed = archive.slice(dataOffset, dataEnd).stream();
  let unpacked: ReadableStream<Uint8Array>;
  if (entry.method === 0) unpacked = compressed;
  else {
    try {
      unpacked = compressed.pipeThrough(
        new DecompressionStream("deflate-raw" as CompressionFormat),
      );
    } catch {
      throw new PackageArchiveError();
    }
  }
  return validateEntryStream(unpacked, entry);
}

function validateEntryStream(
  stream: ReadableStream<Uint8Array>,
  entry: ZipEntry,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  let bytes = 0;
  let crc = CRC32_INITIAL;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (!result.done) {
          bytes += result.value.byteLength;
          if (bytes > entry.size) throw new PackageArchiveError();
          crc = updateCrc32(crc, result.value);
          controller.enqueue(result.value);
          return;
        }
        if (bytes !== entry.size || finishCrc32(crc) !== entry.crc32)
          throw new PackageArchiveError();
        controller.close();
      } catch (error) {
        controller.error(
          error instanceof PackageArchiveError
            ? error
            : new PackageArchiveError(),
        );
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

function view(bytes: Uint8Array, offset = 0): DataView {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    bytes.byteLength - offset,
  );
}

function invalid(): StorageResult<never> {
  return { kind: "failed", error: { code: "PACKAGE_INVALID" } };
}
