/** One immutable object per exact content hash, written through the caller's quota-aware writer. */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { analysisPath, readEvidence } from "./analysis-evidence.ts";
import { digest } from "./session-fixtures.ts";
export async function publishContentEvidence(
  session: string,
  scope: string,
  bytes: string | Uint8Array,
  write: (
    file: string,
    bytes: string | Uint8Array,
    exclusive: boolean,
  ) => Promise<unknown>,
) {
  const parent = await analysisPath(session, scope);
  const directory = path.join(parent, "objects");
  try {
    await mkdir(directory);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  await analysisPath(session, `${scope}/objects`);
  const buffer =
    typeof bytes === "string" ? Buffer.from(bytes) : Buffer.from(bytes);
  const ref = {
    path: `${scope}/objects/${digest(buffer)}.log`,
    sha256: digest(buffer),
  };
  try {
    await write(path.join(session, ref.path), bytes, true);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  await readEvidence(session, ref);
  return ref;
}
