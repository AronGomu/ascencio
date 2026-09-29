import { createHash } from "node:crypto";

export const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
