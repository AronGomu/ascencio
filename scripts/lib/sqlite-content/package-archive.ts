import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { ExportReceipt } from "../../../src/storage/contracts/package-build.ts";
import {
  CRC32_INITIAL,
  finishCrc32,
  updateCrc32,
} from "../../../src/storage/runtime/crc32.ts";
import { assertNoSymlinkParents, hashFile } from "./asset-restructure.ts";

const ARCHIVE_RELATIVE = "generated/content-packages/content-packages.zip";
const UTF8_DATA_DESCRIPTOR_FLAGS = 0x0808;
const STORED_METHOD = 0;
const DOS_DATE_1980_01_01 = 0x0021;
const MAX_ZIP32_VALUE = 0xffffffff;

interface ArchivedEntry {
  readonly name: Uint8Array;
  readonly crc32: number;
  readonly size: number;
  readonly localOffset: number;
}

export interface PackageArchiveReceipt {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export async function writePackageArchive(
  root: string,
  packages: readonly ExportReceipt[],
): Promise<PackageArchiveReceipt> {
  if (packages.length < 1 || packages.length > 64)
    throw new Error("package archive requires one to sixty-four packages");
  const output = path.resolve(root, ARCHIVE_RELATIVE);
  await assertNoSymlinkParents(root, ARCHIVE_RELATIVE);
  await mkdir(path.dirname(output), { recursive: true });
  const temp = `${output}.${randomUUID()}.tmp`;
  const handle = await open(temp, "wx");
  let offset = 0;
  const entries: ArchivedEntry[] = [];
  try {
    for (const receipt of packages) {
      if (receipt.bytes > MAX_ZIP32_VALUE)
        throw new Error("package exceeds ZIP32 entry limit");
      const name = new TextEncoder().encode(path.basename(receipt.path));
      if (name.byteLength === 0 || name.byteLength > 0xffff)
        throw new Error("invalid package archive name");
      const localOffset = offset;
      const header = localHeader(name.byteLength);
      await writeAll(handle, header);
      await writeAll(handle, name);
      offset += header.byteLength + name.byteLength;
      let crc = CRC32_INITIAL;
      let size = 0;
      for await (const value of createReadStream(
        path.resolve(root, receipt.path),
      )) {
        const chunk = value as Uint8Array;
        crc = updateCrc32(crc, chunk);
        size += chunk.byteLength;
        await writeAll(handle, chunk);
        offset += chunk.byteLength;
      }
      if (size !== receipt.bytes)
        throw new Error("package changed during archive");
      const crc32 = finishCrc32(crc);
      const descriptor = dataDescriptor(crc32, size);
      await writeAll(handle, descriptor);
      offset += descriptor.byteLength;
      entries.push({ name, crc32, size, localOffset });
    }
    const centralOffset = offset;
    for (const entry of entries) {
      const header = centralHeader(entry);
      await writeAll(handle, header);
      await writeAll(handle, entry.name);
      offset += header.byteLength + entry.name.byteLength;
    }
    const centralSize = offset - centralOffset;
    if (offset > MAX_ZIP32_VALUE || centralSize > MAX_ZIP32_VALUE)
      throw new Error("package archive exceeds ZIP32 limit");
    await writeAll(
      handle,
      endRecord(entries.length, centralSize, centralOffset),
    );
  } catch (error) {
    await handle.close();
    await rm(temp, { force: true });
    throw error;
  }
  await handle.close();
  try {
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
  const info = await stat(output);
  return Object.freeze({
    path: ARCHIVE_RELATIVE,
    bytes: info.size,
    sha256: await hashFile(output),
  });
}

function localHeader(nameBytes: number): Uint8Array {
  const bytes = new Uint8Array(30);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, 0x04034b50, true);
  data.setUint16(4, 20, true);
  data.setUint16(6, UTF8_DATA_DESCRIPTOR_FLAGS, true);
  data.setUint16(8, STORED_METHOD, true);
  data.setUint16(12, DOS_DATE_1980_01_01, true);
  data.setUint16(26, nameBytes, true);
  return bytes;
}

function dataDescriptor(crc32: number, size: number): Uint8Array {
  const bytes = new Uint8Array(16);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, 0x08074b50, true);
  data.setUint32(4, crc32, true);
  data.setUint32(8, size, true);
  data.setUint32(12, size, true);
  return bytes;
}

function centralHeader(entry: ArchivedEntry): Uint8Array {
  const bytes = new Uint8Array(46);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, 0x02014b50, true);
  data.setUint16(4, 0x0314, true);
  data.setUint16(6, 20, true);
  data.setUint16(8, UTF8_DATA_DESCRIPTOR_FLAGS, true);
  data.setUint16(10, STORED_METHOD, true);
  data.setUint16(14, DOS_DATE_1980_01_01, true);
  data.setUint32(16, entry.crc32, true);
  data.setUint32(20, entry.size, true);
  data.setUint32(24, entry.size, true);
  data.setUint16(28, entry.name.byteLength, true);
  data.setUint32(42, entry.localOffset, true);
  return bytes;
}

function endRecord(
  entries: number,
  centralSize: number,
  centralOffset: number,
): Uint8Array {
  const bytes = new Uint8Array(22);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, 0x06054b50, true);
  data.setUint16(8, entries, true);
  data.setUint16(10, entries, true);
  data.setUint32(12, centralSize, true);
  data.setUint32(16, centralOffset, true);
  return bytes;
}

async function writeAll(
  handle: Awaited<ReturnType<typeof open>>,
  bytes: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const result = await handle.write(
      bytes,
      offset,
      bytes.byteLength - offset,
      null,
    );
    if (result.bytesWritten <= 0)
      throw new Error("package archive write failed");
    offset += result.bytesWritten;
  }
}
