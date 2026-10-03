import path from "node:path";
import { exportSqliteSource } from "./lib/json-content/export-sqlite-source.ts";
import { compileSource } from "./lib/json-content/compile-source.ts";

const [command, input, output] = process.argv.slice(2);
try {
  if (command === "--help" || input === "--help") {
    console.log(
      "Usage: npm run content:convert:sqlite-to-json -- <verified.sqlite> <new-source-directory>\n       npm run content:compile:json -- <source-directory> <output-directory>",
    );
  } else {
    if (!input || !output || !["convert", "compile"].includes(command ?? ""))
      throw new Error(
        "Usage: npm run content:convert:sqlite-to-json -- <verified.sqlite> <new-source-directory>\n       npm run content:compile:json -- <source-directory> <output-directory>",
      );
    if (command === "convert") {
      const result = await exportSqliteSource(
        process.cwd(),
        input,
        path.resolve(output),
      );
      console.log(
        `Exported ${result.manifest.packageId}; installed content and saves untouched.`,
      );
    } else {
      const result = await compileSource(input, output);
      console.log(
        `${result.snapshot.manifest.packageId}: ${result.bytes} bytes; sha256 ${result.sha256}`,
      );
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
