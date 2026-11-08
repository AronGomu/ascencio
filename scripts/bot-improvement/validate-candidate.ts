import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  CandidateValidationRequest,
  CandidateValidationResult,
  FrozenBot,
} from "./session-contract.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import { identity } from "./session-fixtures.ts";
import {
  hashes,
  readTree,
  treeIdentity,
  writeTree,
} from "./candidate-files.ts";
import { compileCandidate, ValidationFailure } from "./validation-build.ts";

function body(bot: FrozenBot) {
  const { identity: _id, files: _files, ...metadata } = bot;
  void _id;
  void _files;
  return metadata;
}
function assertIdentity(bot: FrozenBot, label = "Accepted") {
  if (
    Object.hasOwn(bot.files, "frozen-bot.json") ||
    identity({ ...body(bot), files: bot.files }) !== bot.identity
  )
    throw new ValidationFailure(
      "input",
      `${label} bot descriptor identity mismatch`,
    );
}
/** Prepared workspaces retain the accepted descriptor while heuristics are edited. */
function payload(
  archive: Record<string, Buffer>,
  accepted: FrozenBot,
  label: string,
) {
  const { "frozen-bot.json": descriptor, ...files } = archive;
  if (descriptor) {
    let bot: FrozenBot;
    try {
      bot = JSON.parse(descriptor.toString());
      assertIdentity(bot, label);
    } catch (error) {
      throw new ValidationFailure(
        "input",
        `${label} archive descriptor invalid: ${String(error)}`,
      );
    }
    if (identity(bot) !== identity(accepted))
      throw new ValidationFailure(
        "input",
        `${label} archive descriptor differs from pinned accepted bot`,
      );
  }
  return files;
}
function inside(a: string, b: string) {
  return a === b || a.startsWith(`${b}${path.sep}`);
}

export async function validateCandidate(
  request: CandidateValidationRequest,
): Promise<CandidateValidationResult> {
  // Reserve evidence before reading mutable input. A retry requires a fresh output path.
  const output = path.resolve(request.output);
  const outputParent = await realpath(path.dirname(output));
  const destination = path.join(outputParent, path.basename(output));
  for (const input of [
    request.candidate,
    request.accepted.path,
    request.fixture.path,
  ]) {
    const resolved = await realpath(input);
    if (inside(destination, resolved) || inside(resolved, destination))
      throw new Error("Validation output must be disjoint from inputs");
  }
  await mkdir(destination);
  const result: CandidateValidationResult = {
    schemaVersion: 1,
    status: "invalid",
    fixtureIdentity: request.fixture.identity,
    acceptedIdentity: request.accepted.bot.identity,
    reasons: [],
    evidence: destination,
  };
  try {
    await writeFile(
      path.join(destination, "request.json"),
      JSON.stringify(request, null, 2),
    );
    if (request.schemaVersion !== 1)
      throw new ValidationFailure("input", "Unsupported validation schema");
    const frozen = await verifyFrozen(request.fixture.path);
    if (frozen.identity !== request.fixture.identity)
      throw new ValidationFailure(
        "input",
        "Fixture reference identity mismatch",
      );
    const accepted = request.accepted.bot;
    assertIdentity(accepted);
    if (identity(body(accepted)) !== identity(body(frozen.target)))
      throw new ValidationFailure(
        "scope",
        "Accepted deck, policy, module or configuration differs from frozen target",
      );
    const acceptedArchive = await readTree(request.accepted.path);
    const acceptedFiles = payload(acceptedArchive, accepted, "Accepted");
    if (identity(hashes(acceptedFiles)) !== identity(accepted.files))
      throw new ValidationFailure(
        "input",
        "Accepted archive bytes differ from pinned descriptor",
      );
    const submittedArchive = await readTree(request.candidate);
    await writeTree(path.join(destination, "submitted"), submittedArchive);
    result.snapshotIdentity = treeIdentity(submittedArchive);
    const submitted = payload(submittedArchive, accepted, "Candidate");
    if (
      treeIdentity(await readTree(request.candidate)) !==
      result.snapshotIdentity
    )
      throw new ValidationFailure(
        "input",
        "Candidate changed while snapshotting; retry to a fresh output directory",
      );

    let editable: string;
    let executable: string;
    if (
      accepted.kind === "module" &&
      accepted.module === "builtin:generalist"
    ) {
      editable = "strategy.mjs";
      executable = "bot.mjs";
    } else
      throw new ValidationFailure(
        "scope",
        "Rust AI packages are retired. Supported candidate boundary: builtin:generalist strategy.mjs (compiled from TypeScript).",
      );
    // Accepted versions may differ only in heuristic source and its generated executable.
    for (const file of new Set([
      ...Object.keys(frozen.target.files),
      ...Object.keys(accepted.files),
    ])) {
      if (
        file !== editable &&
        file !== executable &&
        frozen.target.files[file] !== accepted.files[file]
      )
        throw new ValidationFailure(
          "scope",
          `Accepted archive changes frozen boundary: ${file}`,
        );
    }
    const acceptedHashes = hashes(acceptedFiles),
      submittedHashes = hashes(submitted);
    const changes = [
      ...new Set([...Object.keys(acceptedFiles), ...Object.keys(submitted)]),
    ].filter((file) => acceptedHashes[file] !== submittedHashes[file]);
    const forbidden = changes.filter((file) => file !== editable);
    if (forbidden.length)
      throw new ValidationFailure(
        "scope",
        `Only ${editable} may change; restore: ${forbidden.join(", ")}`,
      );
    if (!submitted[editable])
      throw new ValidationFailure(
        "scope",
        `Required heuristic source missing: ${editable}`,
      );
    result.sourceIdentity = identity(
      hashes(
        Object.fromEntries(
          Object.entries(submitted).filter(([file]) => file !== executable),
        ),
      ),
    );
    const compiledRoot = path.join(destination, "candidate");
    await writeTree(compiledRoot, submitted);
    const runtime =
      accepted.kind === "module"
        ? await readFile(
            path.join(request.fixture.path, "versions/initial/bot.mjs"),
          )
        : undefined;
    await compileCandidate(
      accepted,
      compiledRoot,
      request.fixture.path,
      destination,
      runtime,
    );
    // Build/check processes cannot silently change their source or other frozen inputs.
    const compiled = await readTree(compiledRoot);
    const compiledHashes = hashes(compiled);
    for (const file of new Set([
      ...Object.keys(submitted),
      ...Object.keys(compiled),
    ])) {
      if (
        file !== executable &&
        !(accepted.kind === "module" && file === editable) &&
        submittedHashes[file] !== compiledHashes[file]
      )
        throw new ValidationFailure(
          "check",
          `Build/check modified archived input: ${file}`,
        );
    }
    if (
      treeIdentity(await readTree(path.join(destination, "submitted"))) !==
      result.snapshotIdentity
    )
      throw new ValidationFailure(
        "check",
        "Submitted snapshot changed during validation",
      );
    await verifyFrozen(request.fixture.path);
    if (
      treeIdentity(await readTree(request.accepted.path)) !==
      treeIdentity(acceptedArchive)
    )
      throw new ValidationFailure(
        "input",
        "Accepted archive changed during validation",
      );
    const files = hashes(compiled);
    const bot = {
      ...body(accepted),
      files,
      identity: identity({ ...body(accepted), files }),
    };
    result.executableIdentity = identity({
      [executable]: files[executable],
      ...(accepted.kind === "module"
        ? { "strategy.mjs": files["strategy.mjs"] }
        : {}),
    });
    // Publish the descriptor after checking and hashing the compiled payload.
    await writeFile(
      path.join(compiledRoot, "frozen-bot.json"),
      JSON.stringify(bot, null, 2) + "\n",
      { flag: "wx" },
    );
    result.candidate = { path: compiledRoot, bot };
    result.status = "valid";
  } catch (error) {
    result.reasons.push({
      category: error instanceof ValidationFailure ? error.category : "input",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  await writeFile(
    path.join(destination, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx" },
  );
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const file = path.resolve(process.argv[2] ?? "");
    if (!process.argv[2])
      throw new Error("Usage: npm run bot:validate -- validation-request.json");
    const request = JSON.parse(
      await readFile(file, "utf8"),
    ) as CandidateValidationRequest;
    const base = path.dirname(file);
    request.fixture.path = path.resolve(base, request.fixture.path);
    request.accepted.path = path.resolve(base, request.accepted.path);
    request.candidate = path.resolve(base, request.candidate);
    request.output = path.resolve(base, request.output);
    const result = await validateCandidate(request);
    console.log(JSON.stringify(result));
    if (result.status !== "valid") process.exitCode = 1;
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
