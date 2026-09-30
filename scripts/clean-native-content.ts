import { lstat, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const marker = ".ascencio-native-stage";
const expectedMarker = "ascencio-native-stage-v1\n";
const args = process.argv.slice(2);
const index = args.indexOf("--target");
if (
  index < 0 ||
  !args[index + 1] ||
  args.some(
    (value, position) =>
      position !== index && position !== index + 1 && value !== "--delete",
  )
) {
  console.error(
    "Usage: node scripts/clean-native-content.ts --target <staging-directory> [--delete]",
  );
  process.exitCode = 2;
} else {
  try {
    const target = await realpath(path.resolve(args[index + 1]!));
    if (target === path.parse(target).root || target === process.env.HOME)
      throw new Error("Refusing a filesystem root or home directory");
    const bundledStage = path.join(projectRoot, "src-tauri", "resources");
    if (
      (target === projectRoot ||
        target.startsWith(`${projectRoot}${path.sep}`)) &&
      target !== bundledStage &&
      !target.startsWith(`${bundledStage}${path.sep}`)
    )
      throw new Error("Refusing a source or generated release input directory");
    if ((await readFile(path.join(target, marker), "utf8")) !== expectedMarker)
      throw new Error("Target lacks the native staging marker");
    const content = path.join(target, "game-content");
    const info = await lstat(content);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Game content must be a real directory");
    const files = (await readdir(content)).sort();
    if (!files.includes("release.json"))
      throw new Error("Target does not contain a staged release manifest");
    console.log(
      JSON.stringify(
        { target: content, files, delete: args.includes("--delete") },
        null,
        2,
      ),
    );
    if (args.includes("--delete")) {
      await rm(content, { recursive: true });
      console.log("Removed staged game content only");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
