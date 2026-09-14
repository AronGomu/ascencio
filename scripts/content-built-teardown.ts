import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default async function teardownContentBuilt(): Promise<void> {
  const scratch = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.tmp/t6-installed-built-subpath",
  );
  try {
    const marker = await readFile(
      path.join(scratch, "PRIVATE_DEPLOYMENT_ONLY.txt"),
      "utf8",
    );
    if (
      marker !==
      "This CORE artifact has no public-distribution approval. Keep it private.\n"
    )
      throw new Error(`Refusing to remove unowned scratch path: ${scratch}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await rm(scratch, { recursive: true, force: false });
}
