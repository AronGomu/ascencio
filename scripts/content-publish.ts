import path from "node:path";
import { fileURLToPath } from "node:url";
import { runContentPublish } from "./lib/asset-delivery/content-publish-cli.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.exitCode = await runContentPublish(root, process.argv.slice(2));
