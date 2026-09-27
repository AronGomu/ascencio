import assert from "node:assert/strict";
import test, { mock } from "node:test";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { readSource } from "../scripts/lib/asset-delivery/source-files.ts";
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  await fs.mkdir(".tmp", { recursive: true });
  const root = await fs.mkdtemp(path.resolve(".tmp/source-race-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "assets/battle"), { recursive: true });
  await fs.writeFile(
    path.join(root, "assets/battle/original.blend"),
    "source bytes",
  );
  return root;
}

test("R6 lint rejects dynamic Node and scripts imports in content", async () => {
  const { ESLint } = await import("eslint");
  const lint = new ESLint();
  for (const source of [
    'import("node:fs")',
    'import("fs")',
    'import("fs/promises")',
    'import("../../scripts/content-catalog.ts")',
    'import("../../scripts/lib/asset-delivery/bundle.ts")',
    'import("@aws-sdk/client-s3")',
    "import(`node:fs`)",
  ]) {
    const [result] = await lint.lintText(source, {
      filePath: "src/content/probe.ts",
    });
    assert(
      result!.messages.some(
        (message) => message.ruleId === "no-restricted-syntax",
      ),
      source,
    );
  }
  const [retired] = await lint.lintText('import("./index.ts")', {
    filePath: "src/content/probe.ts",
  });
  assert(
    retired!.messages.some(
      (message) => message.ruleId === "focused-domains/imports",
    ),
  );
});

test("R8 source-open races use stable codes, unexpected I/O retains identity", async (t) => {
  for (const code of ["ENOENT", "ELOOP", "EIO"] as const)
    await t.test(code, async () => {
      const root = await fixture(t);
      const source = "assets/battle/original.blend";
      const failure = Object.assign(
        new Error("injected source-open I/O fault"),
        { code },
      );
      const original = fs.open;
      let observed = false;
      const fault = mock.method(
        fs,
        "open",
        async (...args: Parameters<typeof fs.open>) => {
          if (args[0] === path.join(root, source)) {
            observed = true;
            if (code === "EIO") throw failure;
            await fs.unlink(path.join(root, source));
            if (code === "ELOOP")
              await fs.symlink("original.blend", path.join(root, source));
          }
          return original(...args);
        },
      );
      syncBuiltinESMExports();
      try {
        await assert.rejects(
          readSource(root, source),
          code === "EIO"
            ? (error: unknown) => error === failure
            : {
                message:
                  code === "ENOENT"
                    ? "ASSET_SOURCE_CHANGED"
                    : "ASSET_PATH_UNSAFE",
              },
        );
      } finally {
        fault.mock.restore();
        syncBuiltinESMExports();
      }
      assert(observed);
    });
});
