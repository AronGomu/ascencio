// Frozen identities from vendor/ocgcore-wasm/0.1.2; no downloaded manifest is a trust root.
const FROZEN_VENDOR_SHA256 =
  "d9ba49ebec98f3568ba236ec2fcc04c2d6d3bbf6eee2d052938849ca1bde87e8";
const FROZEN_WASM_SHA256 =
  "7415337a6f88653b38e10faa3a087c0a5ab64dd27a7d7cf8a1e6872747c5c265";

/** Async byte gate, separate from synchronous structural/semantic validation. */
export async function validateFrozenBattleExecutable(
  vendorManifest: Uint8Array,
  wasm: Uint8Array,
): Promise<void> {
  const digest = async (bytes: Uint8Array): Promise<string> =>
    Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice())),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
  const [vendorHash, wasmHash] = await Promise.all([
    digest(vendorManifest),
    digest(wasm),
  ]);
  if (vendorHash !== FROZEN_VENDOR_SHA256 || wasmHash !== FROZEN_WASM_SHA256)
    throw new Error("BATTLE_RUNTIME_INVALID");
}
