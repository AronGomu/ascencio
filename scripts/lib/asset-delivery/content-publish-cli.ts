import { createHash } from "node:crypto";
import { canonicalBytes } from "./canonical-json.ts";
import { parseFrozenInventory } from "./frozen-inventory.ts";
import { S3Client } from "@aws-sdk/client-s3";
import { parseFlags } from "./cli.ts";
import { parseAssetDeliveryConfig } from "./config.ts";
import {
  checkPublicationScope,
  parsePublicationApproval,
} from "./publication-approval.ts";
import { ProgressiveError, progressiveFail } from "./progressive-error.ts";
import { verifyProgressiveRelease } from "./progressive-producer.ts";
import {
  publishProgressiveRelease,
  S3ProgressiveTransport,
  type ProgressiveTransport,
} from "./progressive-publisher.ts";
import { digestSource, readSourceJson, sameDigest } from "./source-files.ts";
import type { AssetDeliveryConfig } from "./config.ts";
import { PUBLISHER_ENV_NAMES } from "./setup.ts";

async function requireLiveApproval(
  root: string,
  run: string,
  inventoryVersion: string,
  environment: Readonly<Record<string, string | undefined>>,
): Promise<AssetDeliveryConfig> {
  try {
    const config = parseAssetDeliveryConfig(
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
    const inventory = parseFrozenInventory(
      await readSourceJson(root, `${run}/progressive/inventory.json`, true),
    );
    if (
      createHash("sha256").update(canonicalBytes(inventory)).digest("hex") !==
      inventoryVersion
    )
      progressiveFail("PUBLISH_APPROVAL_REQUIRED");
    if (!inventory.playerMetadata?.sourceInputs.length)
      progressiveFail("PUBLISH_APPROVAL_REQUIRED");
    const scope = checkPublicationScope(approval, "prod", [
      ...inventory.files.map((file) => ({
        root: file.root,
        path: file.sourcePath,
        sha256: file.sha256,
      })),
      ...inventory.playerMetadata.sourceInputs.map((file) => ({
        root: "metadata" as const,
        path: file.path,
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
      PUBLISHER_ENV_NAMES.some((name) => !(environment[name] ?? "").trim()) ||
      !/^[a-f0-9]{32}$/.test(environment.ASSET_R2_ACCOUNT_ID ?? "")
    )
      progressiveFail("PUBLISH_APPROVAL_REQUIRED");
    return config;
  } catch (error) {
    if (error instanceof ProgressiveError) throw error;
    progressiveFail("PUBLISH_APPROVAL_REQUIRED");
  }
}

function liveTransport(
  config: AssetDeliveryConfig,
  environment: Readonly<Record<string, string | undefined>>,
): { readonly transport: ProgressiveTransport; close(): void } {
  const client = new S3Client({
    endpoint: `https://${environment.ASSET_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: "auto",
    credentials: {
      accessKeyId: environment.ASSET_R2_ACCESS_KEY_ID!,
      secretAccessKey: environment.ASSET_R2_SECRET_ACCESS_KEY!,
    },
    maxAttempts: 1,
    followRegionRedirects: false,
    requestHandler: { connectionTimeout: 10_000, requestTimeout: 15_000 },
  });
  return {
    transport: new S3ProgressiveTransport(
      client,
      config.bucket,
      config.keyPrefix,
    ),
    close: () => client.destroy(),
  };
}

export async function runContentPublish(
  root: string,
  args: readonly string[],
  stdout: (line: string) => void = console.log,
  stderr: (line: string) => void = console.error,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  transportFactory: (
    config: AssetDeliveryConfig,
    environment: Readonly<Record<string, string | undefined>>,
  ) => {
    readonly transport: ProgressiveTransport;
    close(): void;
  } = liveTransport,
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
    let published: "published" | "idempotent" | null = null;
    if (!flags.has("--check")) {
      const config = await requireLiveApproval(
        root,
        run,
        candidate.inventoryVersion,
        environment,
      );
      const live = transportFactory(config, environment);
      try {
        published = (
          await publishProgressiveRelease(root, run, live.transport, candidate)
        ).status;
      } finally {
        live.close();
      }
    }
    stdout(
      JSON.stringify({
        status: "ok",
        operation: "publish",
        mode: flags.has("--check") ? "check" : "live",
        run: candidate.run,
        manifestVersion: candidate.manifestVersion,
        pointerVersion: candidate.pointerVersion,
        validation: "passed",
        publication: published,
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
