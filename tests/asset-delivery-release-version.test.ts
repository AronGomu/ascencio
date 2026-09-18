import assert from "node:assert/strict";
import test from "node:test";
import { AssetDeliveryError } from "../scripts/lib/asset-delivery/failure.ts";
import { parseChannel } from "../scripts/lib/asset-delivery/identity.ts";

const invalidConfig = (error: unknown) =>
  error instanceof AssetDeliveryError &&
  error.code === "ASSET_CONFIG_INVALID" &&
  error.message === "ASSET_CONFIG_INVALID";

test("release channels reject leading zeros in numeric prerelease identifiers", () => {
  for (const version of ["1.0.0-01", "1.0.0-alpha.01"])
    assert.throws(
      () => parseChannel({ kind: "release", version }),
      invalidConfig,
    );

  for (const version of ["1.0.0-0", "1.0.0-alpha.01x", "1.0.0+01"])
    assert.deepEqual(parseChannel({ kind: "release", version }), {
      kind: "release",
      version,
    });
});
