import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
  readdir,
  mkdir,
  mkdtemp,
  writeFile,
  rm,
} from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { reviewedUnavailableCrop } from "../scripts/lib/images.ts";
import { withWindowsRenameRetry } from "../scripts/lib/windows-rename-retry.ts";

test("fresh clones include the authoring, chapter and normalized set inputs", async () => {
  const root = "content/bootstrap-inputs";
  for (const file of [
    "card-library/config.json",
    "card-library/authoring/card-set-source.json",
    "card-library/authoring/shop-sets.v1.json",
    "chapter-01/config.json",
    "chapter-01/decks.json",
    "chapter-01/opponents.json",
    "chapter-01/story-documents.json",
  ]) {
    assert.ok(JSON.parse(await readFile(`${root}/${file}`, "utf8")));
  }
  assert.equal((await readdir(`${root}/card-library/sets`)).length, 1036);
  assert.equal((await readdir(`${root}/card-library/boosters`)).length, 75);
  const original = await readFile(
    `${root}/card-library/authoring/card-set-source.json`,
  );
  const selections = JSON.parse(
    await readFile(
      `${root}/chapter-01/authoring/chapter-selections.json`,
      "utf8",
    ),
  );
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    selections.sourceSha256,
  );
  assert.match(
    await readFile(`${root}/chapter-01/media/city-map-placeholder.svg`, "utf8"),
    /<svg/,
  );
});

test("only the two reviewed cropped provider PNG responses are optional absences", () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(reviewedUnavailableCrop(66664203, png), true);
  assert.equal(reviewedUnavailableCrop(84031360, png), true);
  assert.equal(reviewedUnavailableCrop(1, png), false);
  assert.equal(
    reviewedUnavailableCrop(66664203, new Uint8Array([0, 1])),
    false,
  );
});

test("headless start builds through Tauri and never tries to launch a GUI", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ascencio-headless-start-"));
  try {
    await mkdir(path.join(root, "scripts"));
    await mkdir(path.join(root, "node_modules/@tauri-apps/cli"), {
      recursive: true,
    });
    await writeFile(path.join(root, "package.json"), '{"type":"module"}');
    await writeFile(
      path.join(root, "scripts/start-desktop.ts"),
      await readFile("scripts/start-desktop.ts"),
    );
    await writeFile(
      path.join(root, "node_modules/@tauri-apps/cli/tauri.js"),
      "console.log(JSON.stringify(process.argv.slice(2)));",
    );
    const result = await promisify(execFile)(
      process.execPath,
      [path.join(root, "scripts/start-desktop.ts"), "--headless", "--debug"],
      { windowsHide: true },
    );
    assert.match(result.stdout, /\["build","--no-bundle","--debug"\]/);
    assert.match(result.stdout, /no desktop window opened/);
    // No executable exists: attempting a GUI launch would fail this command.
    assert.equal(result.stderr, "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Windows stage publication retries temporary locks; Unix failures propagate", async () => {
  let attempts = 0;
  await withWindowsRenameRetry(async () => {
    attempts += 1;
    if (attempts === 1)
      throw Object.assign(new Error("locked"), { code: "EPERM" });
  }, "win32");
  assert.equal(attempts, 2);
  const error = Object.assign(new Error("invalid"), { code: "EINVAL" });
  await assert.rejects(
    withWindowsRenameRetry(async () => {
      throw error;
    }, "win32"),
    error,
  );
  await assert.rejects(
    withWindowsRenameRetry(async () => {
      throw error;
    }, "darwin"),
    error,
  );
});
