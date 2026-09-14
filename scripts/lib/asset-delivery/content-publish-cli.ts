import { parseFlags } from "./cli.ts";
import { parseAssetDeliveryConfig } from "./config.ts";
import {
  checkPublicationScope,
  parsePublicationApproval,
} from "./publication-approval.ts";
import { ProgressiveError, progressiveFail } from "./progressive-error.ts";
import { verifyProgressiveRelease } from "./progressive-producer.ts";
import { digestSource, readSourceJson, sameDigest } from "./source-files.ts";
import type { FrozenInventory } from "./frozen-inventory.ts";
import { PUBLISHER_ENV_NAMES } from "./setup.ts";

async function requireLiveApproval(
  root: string,
  run: string,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<void> {
  try {
    parseAssetDeliveryConfig(
      await readSourceJson(root, "asset-delivery.config.json"),
    );
    const approval = parsePublicationApproval(
      await readSourceJson(root, "content/asset-publication-approval.json"),
    );
    for (const rule of approval.rules) {
      const actual = await digestSource(root, rule.evidence.path, true);
      if (!sameDigest(actual, rule.evidence))
        progressiveFail("PUBLISH_APPROVAL_REQUIRED");
    }
    const inventory = (await readSourceJson(
      root,
      `${run}/progressive/inventory.json`,
      true,
    )) as FrozenInventory;
    const scope = checkPublicationScope(approval, "prod", [
      ...inventory.files.map((file) => ({
        root: file.root,
        path: file.sourcePath,
        sha256: file.sha256,
      })),
      ...inventory.vendorFiles.map((file) => ({
        root: "vendor" as const,
        path: file.path.replace(/^vendor\//, ""),
        sha256: file.sha256,
      })),
    ]);
    if (
      scope.status === "failed" ||
      PUBLISHER_ENV_NAMES.some((name) => !(environment[name] ?? "").trim())
    )
      progressiveFail("PUBLISH_APPROVAL_REQUIRED");
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("PUBLISH_APPROVAL_REQUIRED");
  }
}

export async function runContentPublish(
  root: string,
  args: readonly string[],
  stdout: (line: string) => void = console.log,
  stderr: (line: string) => void = console.error,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<number> {
  try {
    const flags = parseFlags(args, ["--help", "--check"], ["--run"]);
    if (flags.has("--help")) {
      stdout("content:publish --run PATH [--check]");
      return 0;
    }
    const run = flags.get("--run");
    if (typeof run !== "string") progressiveFail("CONTENT_INVALID_MANIFEST");
    const candidate = await verifyProgressiveRelease(root, run, true);
    if (!flags.has("--check")) {
      await requireLiveApproval(root, run, environment);
      progressiveFail("PUBLISH_SEMANTIC_VALIDATION_REQUIRED");
    }
    stdout(
      JSON.stringify({
        status: "ok",
        operation: "publish",
        mode: "check",
        run: candidate.run,
        manifestVersion: candidate.manifestVersion,
        pointerVersion: candidate.pointerVersion,
        liveBlocked: "PUBLISH_SEMANTIC_VALIDATION_REQUIRED",
      }),
    );
    return 0;
  } catch (error) {
    const code =
      error instanceof ProgressiveError
        ? error.code
        : "CONTENT_INVALID_MANIFEST";
    stderr(code);
    return 1;
  }
}
