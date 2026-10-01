import * as fs from "node:fs/promises";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { exportPackages } from "../../../scripts/lib/sqlite-content/export-packages.ts";

vi.mock("node:fs/promises", async (original) => ({
  ...(await original<typeof fs>()),
}));

const roots: string[] = [];
async function fixture() {
  await fs.mkdir(".tmp", { recursive: true });
  const root = await fs.mkdtemp(path.resolve(".tmp/package-preflight-"));
  roots.push(root);
  await fs.cp(
    "tests/fixtures/sqlite",
    path.join(root, "tests/fixtures/sqlite"),
    {
      recursive: true,
    },
  );
  const spec = JSON.parse(
    await fs.readFile(
      path.join(root, "tests/fixtures/sqlite/packages.json"),
      "utf8",
    ),
  );
  const source = (id: string) =>
    path.join(root, "tests/fixtures/sqlite/sources", id);
  return { root, spec, source };
}
async function json(file: string, value: unknown) {
  await fs.writeFile(file, JSON.stringify(value));
}
async function noOutput(root: string) {
  await expect(fs.readdir(path.join(root, "generated"))).rejects.toMatchObject({
    code: "ENOENT",
  });
}
afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true });
});

it.each([
  ["case", "sets/cover.jpg", "sets/COVER.jpg"],
  ["Unicode", "sets/caf\u00e9.jpg", "sets/cafe\u0301.jpg"],
])(
  "rejects canonical %s asset collisions before any output",
  async (_, first, second) => {
    const { root, spec, source } = await fixture();
    await json(
      path.join(source("card-library"), "assets.json"),
      [first, second].map((assetPath) => ({
        path: assetPath,
        source: "media/cards/full/1.jpg",
        mime: "image/jpeg",
        optional: true,
      })),
    );
    const result = await exportPackages(root, spec);
    await noOutput(root);
    expect(result).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId: "card-library",
        path: "assets.json",
      },
    });
  },
);

it.each([
  ["card-library", "CARDS/full/1.jpg"],
  ["card-library", "cards//full/1.jpg"],
  ["card-library", "cards/./full/1.jpg"],
  ["card-library", "cards/full/../full/1.jpg"],
  ["card-library", "cards\\full\\1.jpg"],
  ["card-library", "/cards/full/1.jpg"],
  ["card-library", "sets/bad\0.jpg"],
  ["card-library", "https:sets/cover.jpg"],
  ["card-library", "media/cover.jpg"],
  ["chapter-01", "sets/cover.jpg"],
  ["freeplay", "media/cover.jpg"],
  ["duel-core", "media/cover.jpg"],
])(
  "rejects malformed or unowned raw asset path %s/%s before output",
  async (packageId, assetPath) => {
    const { root, spec, source } = await fixture();
    await json(path.join(source(packageId), "assets.json"), [
      {
        path: assetPath,
        source: "absent.jpg",
        mime: "image/jpeg",
        optional: true,
      },
    ]);
    const result = await exportPackages(root, spec);
    await noOutput(root);
    expect(result).toEqual({
      kind: "failed",
      error: {
        code: "PACKAGE_SOURCE_INCOMPLETE",
        packageId,
        path: "assets.json",
      },
    });
  },
);

it.each([
  ["card-library", "sets.json", "imageAssetPath", "sets/undeclared.jpg"],
  ["chapter-01", "config.json", "mapAssetPath", "media/undeclared.svg"],
])(
  "requires declared media refs for %s/%s",
  async (packageId, file, field, assetPath) => {
    const { root, spec, source } = await fixture();
    const target = path.join(source(packageId), file);
    const value = JSON.parse(await fs.readFile(target, "utf8"));
    (Array.isArray(value) ? value[0] : value)[field] = assetPath;
    await json(target, value);
    const result = await exportPackages(root, spec);
    await noOutput(root);
    expect(result).toEqual({
      kind: "failed",
      error: { code: "PACKAGE_SOURCE_INCOMPLETE", packageId, path: file },
    });
  },
);

it.each([
  [
    "card-library",
    "sets.json",
    "imageAssetPath",
    "sets/absent.jpg",
    "image/jpeg",
  ],
  [
    "chapter-01",
    "config.json",
    "mapAssetPath",
    "media/absent.svg",
    "image/svg+xml",
  ],
])(
  "permits declared optional absent media for %s/%s with receipt warning",
  async (packageId, file, field, assetPath, mime) => {
    const { root, spec, source } = await fixture();
    const target = path.join(source(packageId), file);
    const value = JSON.parse(await fs.readFile(target, "utf8"));
    (Array.isArray(value) ? value[0] : value)[field] = assetPath;
    await json(target, value);
    await json(path.join(source(packageId), "assets.json"), [
      {
        path: assetPath,
        source: "absent",
        mime,
        optional: true,
      },
    ]);
    const result = await exportPackages(root, spec);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok")
      expect(
        result.value.find((receipt) => receipt.packageId === packageId)
          ?.missingOptionalMedia,
      ).toEqual([assetPath]);
  },
);

async function optionalFixture(file: string) {
  const value = await fixture();
  if (file === "assets.json")
    return {
      ...value,
      packageId: "card-library",
      target: path.join(value.source("card-library"), file),
    };
  const policy = path.join(
    value.root,
    "content/commerce/chapters/chapter-01.json",
  );
  await fs.mkdir(path.dirname(policy), { recursive: true });
  await json(policy, { shopId: "shop", allowedCardCodes: [1] });
  const destination = path.join(value.root, "assets/content/chapter-01");
  await fs.cp(value.source("chapter-01"), destination, { recursive: true });
  value.spec.packages.find(
    (entry: { manifest: { packageId: string } }) =>
      entry.manifest.packageId === "chapter-01",
  ).sourceRoot = "assets/content/chapter-01";
  return {
    ...value,
    packageId: "chapter-01",
    target: path.join(destination, file),
  };
}

it.each(["assets.json", "limits.json"])(
  "maps malformed optional %s to typed source failure",
  async (file) => {
    const { root, spec, packageId, target } = await optionalFixture(file);
    await fs.writeFile(target, "{");
    const result = await exportPackages(root, spec);
    await noOutput(root);
    expect(result).toEqual({
      kind: "failed",
      error: { code: "PACKAGE_SOURCE_INCOMPLETE", packageId, path: file },
    });
  },
);

it.each([
  ["assets.json", "EACCES"],
  ["assets.json", "EIO"],
  ["limits.json", "EACCES"],
  ["limits.json", "EIO"],
])("propagates optional %s I/O fault %s unchanged", async (file, code) => {
  const { root, spec, target } = await optionalFixture(file);
  const actual = fs.readFile;
  const failure = Object.assign(
    new Error("fixture optional JSON read failure"),
    { code },
  );
  vi.spyOn(fs, "readFile").mockImplementation(
    (...args: Parameters<typeof actual>) => {
      if (String(args[0]) === target) return Promise.reject(failure);
      return actual(...args);
    },
  );
  await expect(exportPackages(root, spec)).rejects.toBe(failure);
  await noOutput(root);
});

it("retains absent optional assets.json fallback", async () => {
  const { root, spec, source } = await fixture();
  await fs.rm(path.join(source("card-library"), "assets.json"));
  expect((await exportPackages(root, spec)).kind).toBe("ok");
});
