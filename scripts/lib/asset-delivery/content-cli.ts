import { createHash } from "node:crypto";
import { acquireAssetDeliveryLock } from "./local-lock.ts";
import { assetCli, parseFlags } from "./cli.ts";
import { loadSelection } from "./profile-set.ts";
import { EMPTY_RETAINED_METADATA, scanAssetProfiles } from "./scan-assets.ts";
import { parsePreparedPlayerMetadata } from "./prepared-player-metadata.ts";
import { readSourceJson, sourceStat } from "./source-files.ts";
import { canonicalBytes } from "./canonical-json.ts";
import { verifyBundle } from "./verify-bundle.ts";
import { object, version } from "./schema.ts";
import { assertSafePath } from "./path-guards.ts";
import { objectRefIn } from "./object-ref.ts";
import { objectRef } from "./bundle-objects.ts";
import { fail } from "./failure.ts";
import {
  packProgressiveRelease,
  verifyProgressiveRelease,
} from "./progressive-producer.ts";
import { ProgressiveError, progressiveFail } from "./progressive-error.ts";

function positive(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value))
    progressiveFail("CONTENT_INVALID_MANIFEST");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed))
    progressiveFail("CONTENT_INVALID_MANIFEST");
  return parsed;
}

async function pack(
  root: string,
  args: readonly string[],
): Promise<Record<string, unknown>> {
  const flags = parseFlags(
    args,
    ["--help"],
    [
      "--release-sequence",
      "--core-min",
      "--core-max-exclusive",
      "--previous-run",
    ],
  );
  if (flags.has("--help"))
    return {
      help: "content:pack --release-sequence N --core-min N --core-max-exclusive N [--previous-run PATH]",
    };
  const releaseSequence = positive(flags.get("--release-sequence"));
  const coreMin = positive(flags.get("--core-min"));
  const coreMaxExclusive = positive(flags.get("--core-max-exclusive"));
  const release = await acquireAssetDeliveryLock(root);
  try {
    const metadata = parsePreparedPlayerMetadata(
      await readSourceJson(
        root,
        "generated/asset-delivery/prepared-player.json",
        true,
      ),
    );
    const { inventory } = await scanAssetProfiles(
      root,
      await loadSelection(root),
      EMPTY_RETAINED_METADATA,
      metadata,
    );
    const previousRun = flags.get("--previous-run") as string | undefined;
    const candidate = await packProgressiveRelease(root, inventory, {
      releaseSequence,
      coreMin,
      coreMaxExclusive,
      ...(previousRun === undefined ? {} : { previousRun }),
    });
    return {
      run: candidate.run,
      manifestVersion: candidate.manifestVersion,
      pointerVersion: candidate.pointerVersion,
    };
  } finally {
    await release();
  }
}

async function verify(
  root: string,
  args: readonly string[],
): Promise<Record<string, unknown>> {
  const flags = parseFlags(args, ["--help", "--check-sources"], ["--run"]);
  if (flags.has("--help"))
    return { help: "content:verify --run PATH [--check-sources]" };
  const run = flags.get("--run");
  if (typeof run !== "string") progressiveFail("CONTENT_INVALID_MANIFEST");
  const candidate = await verifyProgressiveRelease(
    root,
    run,
    flags.has("--check-sources"),
  );
  return {
    run: candidate.run,
    manifestVersion: candidate.manifestVersion,
    pointerVersion: candidate.pointerVersion,
  };
}

async function legacyVerify(
  root: string,
  args: readonly string[],
  stdout: (line: string) => void,
  stderr: (line: string) => void,
): Promise<number> {
  return assetCli(
    "check",
    async (progress) => {
      const flags = parseFlags(args, ["--help"], ["--run"]);
      if (flags.has("--help")) {
        progress(
          "help: content:verify [--run generated/asset-delivery/runs/<uuid>]",
        );
        return;
      }
      const explicit = flags.get("--run") as string | undefined;
      const pointer =
        explicit === undefined
          ? object(
              await readSourceJson(
                root,
                "generated/asset-delivery/current.json",
              ),
              {
                schemaVersion: version,
                run: assertSafePath,
                snapshot: objectRefIn("snapshots"),
              },
            )
          : null;
      const current = explicit ?? pointer!.run;
      const snapshot = await verifyBundle(root, current);
      const bytes = canonicalBytes(snapshot);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (
        pointer &&
        !Buffer.from(canonicalBytes(pointer.snapshot)).equals(
          Buffer.from(
            canonicalBytes(
              objectRef("snapshots", { bytes: bytes.length, sha256 }),
            ),
          ),
        )
      )
        fail("ASSET_INTEGRITY_FAILED");
      progress("verified", current);
      return sha256;
    },
    stdout,
    stderr,
  );
}

export async function runContent(
  root: string,
  operation: "pack" | "verify",
  args: readonly string[],
  stdout: (line: string) => void = console.log,
  stderr: (line: string) => void = console.error,
): Promise<number> {
  try {
    if (
      operation === "verify" &&
      !args.includes("--help") &&
      !args.includes("--check-sources")
    ) {
      const runIndex = args.indexOf("--run");
      const run = runIndex < 0 ? undefined : args[runIndex + 1];
      if (run === undefined || !(await sourceStat(root, `${run}/progressive`)))
        return legacyVerify(root, args, stdout, stderr);
    }
    const result =
      operation === "pack" ? await pack(root, args) : await verify(root, args);
    if ("help" in result) stdout(String(result.help));
    else stdout(JSON.stringify({ status: "ok", operation, ...result }));
    return 0;
  } catch (error) {
    const code =
      error instanceof ProgressiveError
        ? error.code
        : error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ASSET_SOURCE_CHANGED"
          ? "CONTENT_SOURCE_STALE"
          : "CONTENT_INVALID_MANIFEST";
    stderr(code);
    return 1;
  }
}
