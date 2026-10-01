import path from "node:path";
import { convertShopContent } from "./lib/sqlite-content/convert-shop-content.ts";
const [release, destination, ...extra] = process.argv.slice(2);
if (!release || !destination || extra.length)
  throw new Error(
    "Usage: node scripts/convert-shop-content.ts <release.json> <new-output-directory>",
  );
await convertShopContent(
  process.cwd(),
  path.resolve(release),
  path.resolve(destination),
);
