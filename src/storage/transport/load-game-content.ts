import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { PackageStack, QueryMap } from "../contracts/storage-client.ts";
import { parseCriticalSnapshot } from "../snapshot/parse-critical-snapshot.ts";
import { orderPackages } from "../schema/package-manifest.ts";
import type { PreparedContentDescriptor } from "./content-descriptor.ts";
import type { GameContentReader } from "./game-content-reader.ts";

/** Hash and parse the same startup buffers, before any game session is admitted. */
export async function loadGameContent(
  reader: GameContentReader,
  descriptor: PreparedContentDescriptor,
  signal: AbortSignal,
) {
  const [metadata, engine] = await Promise.all([
    reader.read("metadata.json", signal, descriptor.metadataBytes),
    reader.read("engine.wasm", signal, descriptor.engineBytes),
  ]);
  signal.throwIfAborted();
  for (const [bytes, size, expected] of [
    [metadata, descriptor.metadataBytes, descriptor.metadataSha256],
    [engine, descriptor.engineBytes, descriptor.engineSha256],
  ] as const) {
    if (bytes.byteLength !== size || bytesToHex(sha256(bytes)) !== expected)
      throw new Error("BASE_HASH_MISMATCH: startup transfer");
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(metadata),
  );
  if (!Array.isArray(value) || value.length !== descriptor.packages.length)
    throw new Error("BASE_ENVELOPE_INVALID");
  const snapshots = value.map(parseCriticalSnapshot);
  const graph = orderPackages(
    snapshots.map((snapshot) => snapshot.manifest),
    [],
  );
  if (graph.kind === "failed") throw new Error(graph.error.code);
  const stack: PackageStack = Object.freeze({
    generation: descriptor.generation,
    packages: Object.freeze(
      snapshots.map((snapshot) => {
        const receipt = descriptor.packages.find(
          (pack) => pack.packageId === snapshot.manifest.packageId,
        );
        if (!receipt || receipt.version !== snapshot.manifest.version)
          throw new Error("BASE_ENVELOPE_INVALID");
        return Object.freeze({
          ...snapshot.manifest,
          fileKey: `snapshot:${receipt.packageId}`,
          bytes: receipt.bytes,
          sha256: receipt.sha256,
        });
      }),
    ),
  });
  const executable = new Map<string, NonNullable<QueryMap["asset"]>>([
    [
      "duel-core:engine/ocgcore.sync.wasm",
      { mime: "application/wasm", bytes: engine },
    ],
    [
      "duel-core:engine/vendor-manifest.json",
      {
        mime: "application/json",
        bytes: new TextEncoder().encode(descriptor.vendorManifest),
      },
    ],
  ]);
  const identities = descriptor.packages
    .map((pack) => `${pack.packageId}:${pack.version}:${pack.sha256}`)
    .sort();
  const composition = {
    identity: bytesToHex(
      sha256(new TextEncoder().encode(JSON.stringify(identities))),
    ),
    requiredMods: [],
  };
  return { snapshots, stack, executable, composition };
}
