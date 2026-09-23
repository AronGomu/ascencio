import { readdir } from "node:fs/promises";
import path from "node:path";
import type { ObjectRef } from "./asset-delivery/object-ref.ts";
import { digestSource, sameDigest } from "./asset-delivery/source-files.ts";

export async function verifyPackagedContent(
  outputRoot: string,
  objects: readonly ObjectRef[],
): Promise<void> {
  const selected = objects.filter((ref) =>
    /^content\/(indexes|catalogs|manifests|parts)\//.test(ref.key),
  );
  const expected = selected.map((ref) => ref.key).sort();
  const packaged = (
    await readdir(path.join(outputRoot, "content"), {
      recursive: true,
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(outputRoot, path.join(entry.parentPath, entry.name))
        .replaceAll("\\", "/"),
    )
    .sort();
  if (packaged.join("\n") !== expected.join("\n"))
    throw new Error("CORE build content objects differ from selected run");
  for (const ref of selected) {
    if (!sameDigest(await digestSource(outputRoot, ref.key), ref))
      throw new Error(
        `CORE build content object differs from selected run: ${ref.key}`,
      );
  }
}
