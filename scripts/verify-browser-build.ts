import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadDeckSources } from "../src/battle/duel/presets/deck-sources-node.ts";
import { reviewedCardPool } from "../src/battle/duel/presets/reviewed-card-pool.ts";
import { parseRuntimeSnapshotManifest } from "../src/battle/worker/assets/runtime-manifest.ts";
import {
  deriveRuntimeSnapshotId,
  runtimeAssetContentSha256,
  verifyRuntimeSnapshotFiles,
} from "../src/battle/worker/assets/runtime-snapshot-node.ts";
import { assertNoMissingActiveImages } from "./lib/active-image-manifest.ts";
import { resolveActiveRuntimeFiles } from "./lib/active-runtime-files.ts";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const outputRoot = path.join(projectRoot, "dist");
const runtimeRoot = path.join(outputRoot, "runtime");
const assetRoot = path.join(runtimeRoot, "assets/current");
await stat(path.join(outputRoot, "index.html"));
await verifySingleHtmlEntry();
await verifyNoRemovedPhaserResidue();
await verifyNoAcceptanceHarnessResidue();

const runtimeManifestBytes = await readFile(
  path.join(runtimeRoot, "current/manifest.json"),
);
const sourceRuntimeManifestBytes = await readFile(
  path.join(projectRoot, "generated/runtime/current/manifest.json"),
);
if (!runtimeManifestBytes.equals(sourceRuntimeManifestBytes)) {
  throw new Error(
    "Browser build runtime manifest differs from the verified source",
  );
}
const runtimeManifestSha256 = sha256(runtimeManifestBytes);
const manifest = parseRuntimeSnapshotManifest(
  JSON.parse(runtimeManifestBytes.toString("utf8")) as unknown,
);
const activeRuntimePaths = await resolveActiveRuntimeFiles(projectRoot);
const activeRuntimePathSet = new Set(activeRuntimePaths);
const activeRuntimeFiles = manifest.assets.files.filter((file) =>
  activeRuntimePathSet.has(file.path),
);
if (activeRuntimeFiles.length !== activeRuntimePaths.length)
  throw new Error("Active runtime closure contains undeclared files");
await verifyRuntimeSnapshotFiles(
  {
    ...manifest,
    assets: { ...manifest.assets, files: activeRuntimeFiles },
  },
  assetRoot,
);
const packagedAssetPaths = (await findFiles(assetRoot)).map((file) =>
  path.relative(assetRoot, file).replaceAll("\\", "/"),
);
const expectedAssetPaths = ["manifest.json", ...activeRuntimePaths].sort();
if (packagedAssetPaths.sort().join("\n") !== expectedAssetPaths.join("\n")) {
  throw new Error(
    "Browser build contains missing or unmanifested runtime files",
  );
}

const packagedAssetManifest = await assertSameFile(
  path.join(assetRoot, "manifest.json"),
  path.join(projectRoot, "generated/assets/current/manifest.json"),
  "asset manifest",
);
const packagedVendorManifest = await assertSameFile(
  path.join(runtimeRoot, "engine/vendor-manifest.json"),
  path.join(projectRoot, "vendor/ocgcore-wasm/0.1.2/vendor-manifest.json"),
  "vendor manifest",
);
const packagedWasm = await assertSameFile(
  path.join(runtimeRoot, "engine/ocgcore.sync.wasm"),
  path.join(projectRoot, "vendor/ocgcore-wasm/0.1.2/lib/ocgcore.sync.wasm"),
  "synchronous WASM",
);
if (sha256(packagedAssetManifest) !== manifest.assets.manifestSha256)
  throw new Error("Packaged asset manifest does not match the runtime root");
if (sha256(packagedVendorManifest) !== manifest.engine.manifestSha256)
  throw new Error("Packaged vendor manifest does not match the runtime root");
const derivedSnapshotId = deriveRuntimeSnapshotId(
  runtimeAssetContentSha256(
    JSON.parse(packagedAssetManifest.toString("utf8")) as Parameters<
      typeof runtimeAssetContentSha256
    >[0],
  ),
  sha256(packagedVendorManifest),
);
if (derivedSnapshotId !== manifest.snapshotId)
  throw new Error("Packaged runtime snapshot ID is not content-derived");
const vendorManifest = JSON.parse(packagedVendorManifest.toString("utf8")) as {
  readonly files?: readonly {
    readonly path?: string;
    readonly bytes?: number;
    readonly sha256?: string;
  }[];
};
const wasmRecord = vendorManifest.files?.find(
  (file) => file.path === "lib/ocgcore.sync.wasm",
);
if (
  wasmRecord?.bytes !== packagedWasm.byteLength ||
  wasmRecord.sha256 !== sha256(packagedWasm)
)
  throw new Error("Packaged synchronous WASM violates the vendor manifest");

await verifyActiveImages();
const activeImageManifestBytes = await readFile(
  path.join(runtimeRoot, "images/active-manifest.json"),
);
const activationSnapshotId = sha256(
  JSON.stringify({
    runtimeSnapshotId: manifest.snapshotId,
    activeImageManifestSha256: sha256(activeImageManifestBytes),
  }),
);
const privateDeploymentMarker = await readFile(
  path.join(outputRoot, "PRIVATE_DEPLOYMENT_ONLY.txt"),
  "utf8",
);
if (!privateDeploymentMarker.includes("Keep it private"))
  throw new Error("Unapproved image build lacks its private-deployment marker");
await verifyThirdPartyLicenses();

const javaScriptFiles = await findFiles(path.join(outputRoot, "assets"), ".js");
const jspiChunks = javaScriptFiles.filter((file) =>
  path.basename(file).startsWith("ocgcore.jspi-"),
);
const synchronousEngineChunks = javaScriptFiles.filter((file) =>
  path.basename(file).startsWith("ocgcore.sync-"),
);
if (jspiChunks.length > 0 || synchronousEngineChunks.length !== 1) {
  throw new Error(
    `Browser build emitted an unexpected engine chunk set: ${[...jspiChunks, ...synchronousEngineChunks].map((file) => path.basename(file)).join(", ")}`,
  );
}
if ((await stat(synchronousEngineChunks[0]!)).size > 100_000)
  throw new Error("Browser build emitted the embedded-WASM fallback chunk");
const workerFile = javaScriptFiles.find((file) =>
  path.basename(file).startsWith("duel.worker-browser-"),
);
if (workerFile === undefined) {
  throw new Error("Browser build did not emit the dedicated duel Worker");
}
await verifySizeBudgets(javaScriptFiles, workerFile);
const workerSource = await readFile(workerFile, "utf8");
if (!workerSource.includes(runtimeManifestSha256)) {
  throw new Error("Browser Worker does not embed the packaged manifest digest");
}
const forbidden = [
  "node:fs",
  "node:fs/promises",
  "node:path",
  "node:url",
  "node:crypto",
  "node:module",
  "node:worker_threads",
  "create-node-runtime",
  "duel.worker-node",
  "mvp-preset-node",
  "node_modules/ocgcore-wasm",
  "ocgcore.jspi",
  "jspi not supported",
  'Suspending"in WebAssembly',
];
let activationIdentityEmbedded = false;
for (const file of javaScriptFiles) {
  const source = await readFile(file, "utf8");
  if (source.includes(activationSnapshotId)) activationIdentityEmbedded = true;
  const match = forbidden.find((value) => source.includes(value));
  if (match !== undefined) {
    throw new Error(
      `Browser bundle ${path.relative(outputRoot, file)} contains forbidden Node/engine resolution marker: ${match}`,
    );
  }
}
if (!activationIdentityEmbedded)
  throw new Error("Browser build does not embed the composite activation ID");

console.log(
  JSON.stringify(
    {
      status: "ok",
      snapshotId: manifest.snapshotId,
      runtimeFiles: activeRuntimePaths.length,
      worker: path.basename(workerFile),
    },
    null,
    2,
  ),
);

/* The visual novel used to ship as a second entry document, gated here by a
   `prototype.html` stat plus its own isolation scan and byte budget. It is now
   a lazily-imported domain of the single app, so the guarantee inverts: the
   build must emit exactly one HTML document. Its runtime isolation from the
   duel Worker/WASM is no longer statically derivable from an entry closure and
   is proven at runtime by `e2e/story.spec.ts` instead. */
async function verifySingleHtmlEntry(): Promise<void> {
  const documents = (await findFiles(outputRoot))
    .map((file) => path.relative(outputRoot, file).replaceAll("\\", "/"))
    .filter((file) => file.endsWith(".html"));
  if (documents.join("\n") !== "index.html")
    throw new Error(
      `Browser build must ship exactly one entry document: ${documents.join(", ")}`,
    );
}

async function verifyNoRemovedPhaserResidue(): Promise<void> {
  const packageJson = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  ) as {
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly devDependencies?: Readonly<Record<string, string>>;
  };
  if (
    packageJson.dependencies?.phaser !== undefined ||
    packageJson.devDependencies?.phaser !== undefined
  ) {
    throw new Error("Browser build must not depend on Phaser");
  }
  const lock = JSON.parse(
    await readFile(path.join(projectRoot, "package-lock.json"), "utf8"),
  ) as {
    readonly packages?: Readonly<Record<string, unknown>>;
    readonly dependencies?: Readonly<Record<string, unknown>>;
  };
  if (
    lock.packages?.["node_modules/phaser"] !== undefined ||
    lock.dependencies?.phaser !== undefined
  ) {
    throw new Error("Browser build lockfile retains Phaser");
  }
  const forbiddenPackageMarkers = ["node_modules/phaser", "phaser-MIT"];
  const forbiddenBundleMarkers = [
    "phaser",
    "Phaser",
    "DuelScene",
    "create-phaser-presentation-bridge",
    "duel-field-canvas",
    "data-loaded-face-images",
    "data-card-back-ready",
    "data-failed-textures",
    "data-hidden-cards",
    "data-visible-card-images",
  ];
  for (const file of await findFiles(outputRoot)) {
    const relative = path.relative(outputRoot, file).replaceAll("\\", "/");
    const packageMarker = forbiddenPackageMarkers.find((marker) =>
      relative.includes(marker),
    );
    if (packageMarker !== undefined) {
      throw new Error(`Browser build retains Phaser artifact: ${relative}`);
    }
    if (!/\.(?:html|js|json|txt|css)$/.test(relative)) continue;
    const source = await readFile(file, "utf8");
    const bundleMarker = forbiddenBundleMarkers.find((marker) =>
      source.includes(marker),
    );
    if (bundleMarker !== undefined) {
      throw new Error(
        `Browser build ${relative} contains removed Phaser marker: ${bundleMarker}`,
      );
    }
  }
}

async function verifyNoAcceptanceHarnessResidue(): Promise<void> {
  const forbiddenFiles = new Set(["acceptance.html"]);
  const forbiddenMarkers = [
    ".acceptance-card-list-field",
    "acceptance-card-list-scenario",
    "card-list-browse-six",
    "field-emz",
  ];
  for (const file of await findFiles(outputRoot)) {
    const relative = path.relative(outputRoot, file).replaceAll("\\", "/");
    if (forbiddenFiles.has(relative))
      throw new Error(
        `Browser build contains acceptance-only file: ${relative}`,
      );
    if (!/\.(?:html|js|css)$/.test(relative)) continue;
    const source = await readFile(file, "utf8");
    const marker = forbiddenMarkers.find((value) => source.includes(value));
    if (marker !== undefined)
      throw new Error(
        `Browser build ${relative} contains acceptance-only marker: ${marker}`,
      );
  }
}

async function verifyThirdPartyLicenses(): Promise<void> {
  const expectedPackages = {
    svelte: { version: "5.56.4", license: "MIT" },
    idb: { version: "8.0.3", license: "ISC" },
  } as const;
  const lock = JSON.parse(
    await readFile(path.join(projectRoot, "package-lock.json"), "utf8"),
  ) as {
    readonly packages?: Readonly<
      Record<
        string,
        {
          readonly version?: string;
          readonly license?: string;
          readonly integrity?: string;
        }
      >
    >;
  };
  for (const [name, expected] of Object.entries(expectedPackages)) {
    const locked = lock.packages?.[`node_modules/${name}`];
    const installed = JSON.parse(
      await readFile(
        path.join(projectRoot, "node_modules", name, "package.json"),
        "utf8",
      ),
    ) as { readonly version?: string; readonly license?: string };
    if (
      locked?.version !== expected.version ||
      locked.license !== expected.license ||
      typeof locked.integrity !== "string" ||
      !locked.integrity.startsWith("sha512-") ||
      installed.version !== expected.version ||
      installed.license !== expected.license
    )
      throw new Error(`Runtime package identity is unreviewed: ${name}`);
  }
  const licenses = [
    ["licenses/svelte-MIT.txt", "node_modules/svelte/LICENSE.md"],
    ["licenses/idb-ISC.txt", "node_modules/idb/LICENSE"],
    ["licenses/ocgcore-wasm-MIT.txt", "vendor/ocgcore-wasm/0.1.2/LICENSE"],
  ] as const;
  await Promise.all(
    licenses.map(([packaged, source]) =>
      assertSameFile(
        path.join(outputRoot, ...packaged.split("/")),
        path.join(projectRoot, ...source.split("/")),
        packaged,
      ),
    ),
  );
}

async function verifySizeBudgets(
  javaScriptFiles: readonly string[],
  workerFile: string,
): Promise<void> {
  const sizes = new Map<string, number>();
  await Promise.all(
    javaScriptFiles.map(async (file) => {
      sizes.set(file, (await stat(file)).size);
    }),
  );
  const appInitialFiles = await staticHtmlScriptClosure(
    "index.html",
    javaScriptFiles,
  );
  const initialScriptBytes = appInitialFiles.reduce(
    (total, file) => total + (sizes.get(file) ?? 0),
    0,
  );
  const runtimeBytes = await totalFileBytes(
    path.join(runtimeRoot, "assets/current"),
  );
  const imageBytes = await totalFileBytes(path.join(runtimeRoot, "images"));
  const coldStartBytes =
    initialScriptBytes +
    (sizes.get(workerFile) ?? 0) +
    runtimeBytes +
    imageBytes;
  const budgets = [
    ["aggregate cold-start transfer", coldStartBytes, 41_000_000],
    /* Raised 2026-08-10 for T16 (off-field target list): the aggregate target
       window measured 382,753 bytes of initial JavaScript, over the previous
       375,000 line that had 47 bytes of headroom left. The budget guards
       against unnoticed drift, so it keeps a visible ceiling above the
       measured size rather than tracking it. */
    ["initial JavaScript", initialScriptBytes, 400_000],
    ["Duel Worker JavaScript", sizes.get(workerFile) ?? 0, 200_000],
    ["active runtime closure", runtimeBytes, 22_000_000],
    ["active card images", imageBytes, 19_000_000],
  ] as const;
  const exceeded = budgets.find(([, actual, maximum]) => actual > maximum);
  if (exceeded !== undefined)
    throw new Error(
      `${exceeded[0]} exceeds its production budget: ${exceeded[1]} > ${exceeded[2]} bytes`,
    );
}

async function staticHtmlScriptClosure(
  htmlName: string,
  javaScriptFiles: readonly string[],
): Promise<string[]> {
  const html = await readFile(path.join(outputRoot, htmlName), "utf8");
  const byName = new Map(
    javaScriptFiles.map((file) => [path.basename(file), file] as const),
  );
  const pending = [
    ...html.matchAll(/<script[^>]+src=["'][^"']*\/([^/"']+\.js)["']/g),
  ]
    .map((match) => byName.get(match[1]!))
    .filter((file): file is string => file !== undefined);
  const closure = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (closure.has(file)) continue;
    closure.add(file);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s*|import\s*)["']\.\/([^"']+\.js)["']/g,
    )) {
      const dependency = byName.get(match[1]!);
      if (dependency !== undefined && !closure.has(dependency))
        pending.push(dependency);
    }
  }
  if (closure.size === 0)
    throw new Error(`Browser build ${htmlName} has no module entry script`);
  return [...closure];
}

async function totalFileBytes(root: string): Promise<number> {
  const files = await findFiles(root);
  const sizes = await Promise.all(
    files.map(async (file) => (await stat(file)).size),
  );
  return sizes.reduce((total, bytes) => total + bytes, 0);
}

async function verifyActiveImages(): Promise<void> {
  const imageRoot = path.join(runtimeRoot, "images");
  const manifestBytes = await readFile(
    path.join(imageRoot, "active-manifest.json"),
  );
  const imageManifest = JSON.parse(manifestBytes.toString("utf8")) as {
    readonly schemaVersion?: number;
    readonly snapshotId?: string;
    readonly provider?: string;
    readonly redistributionApproved?: boolean;
    readonly files?: readonly {
      readonly code?: number;
      readonly path?: string;
      readonly bytes?: number;
      readonly sha256?: string;
    }[];
    readonly missing?: readonly number[];
  };
  if (
    imageManifest.schemaVersion !== 1 ||
    imageManifest.snapshotId !== manifest.snapshotId ||
    imageManifest.provider !== "bundled-archive" ||
    imageManifest.redistributionApproved !== false ||
    !Array.isArray(imageManifest.files) ||
    !Array.isArray(imageManifest.missing)
  )
    throw new Error("Packaged active-image manifest is invalid");
  const packaged = (await findFiles(imageRoot)).map((file) =>
    path.relative(imageRoot, file).replaceAll("\\", "/"),
  );
  const declared = [
    "active-manifest.json",
    ...imageManifest.files.map((file) => file.path),
  ].sort();
  if (packaged.sort().join("\n") !== declared.join("\n"))
    throw new Error("Packaged active images differ from their manifest");
  const declaredCodes = new Set<number>();
  for (const record of imageManifest.files) {
    if (
      !Number.isSafeInteger(record.code) ||
      record.path !== `${record.code}.jpg` ||
      !Number.isSafeInteger(record.bytes) ||
      typeof record.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(record.sha256)
    )
      throw new Error("Packaged active-image record is invalid");
    const bytes = await readFile(path.join(imageRoot, record.path));
    if (
      bytes.byteLength !== record.bytes ||
      sha256(bytes) !== record.sha256 ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff ||
      bytes.at(-1) !== 0xd9
    )
      throw new Error(
        `Packaged card image failed verification: ${record.path}`,
      );
    if (declaredCodes.has(record.code))
      throw new Error(`Duplicate packaged card image: ${record.code}`);
    declaredCodes.add(record.code);
  }
  imageManifest.missing.forEach((code) => {
    if (!Number.isSafeInteger(code) || declaredCodes.has(code))
      throw new Error(`Invalid missing active-image code: ${code}`);
    declaredCodes.add(code);
  });
  assertNoMissingActiveImages({ missing: imageManifest.missing });
  const expectedCodes = reviewedCardPool(await loadDeckSources());
  if (
    [...expectedCodes].some((code) => !declaredCodes.has(code)) ||
    [...declaredCodes].some((code) => !expectedCodes.has(code))
  )
    throw new Error("Packaged active-image coverage differs from preset decks");
}

async function assertSameFile(
  builtPath: string,
  sourcePath: string,
  label: string,
): Promise<Buffer> {
  const [built, source] = await Promise.all([
    readFile(builtPath),
    readFile(sourcePath),
  ]);
  if (
    built.byteLength !== source.byteLength ||
    sha256(built) !== sha256(source)
  ) {
    throw new Error(`Browser build ${label} differs from the verified source`);
  }
  return built;
}

async function findFiles(root: string, extension?: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory())
      files.push(...(await findFiles(absolutePath, extension)));
    else if (
      entry.isFile() &&
      (extension === undefined || entry.name.endsWith(extension))
    )
      files.push(absolutePath);
  }
  return files;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}
