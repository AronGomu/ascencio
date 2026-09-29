import assert from "node:assert/strict";
import test from "node:test";
import { AssetDeliveryError } from "../scripts/lib/asset-delivery/failure.ts";
import { releaseVersion } from "../scripts/lib/asset-delivery/schema.ts";

const invalidConfig = (error: unknown) =>
  error instanceof AssetDeliveryError &&
  error.code === "ASSET_CONFIG_INVALID" &&
  error.message === "ASSET_CONFIG_INVALID";

test("source inventory versions reject leading zeros in numeric prerelease identifiers", () => {
  for (const version of ["1.0.0-01", "1.0.0-alpha.01"])
    assert.throws(() => releaseVersion(version), invalidConfig);

  for (const version of ["1.0.0-0", "1.0.0-alpha.01x", "1.0.0+01"])
    assert.equal(releaseVersion(version), version);
});
