import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  open,
  readdir,
  lstat,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { withSessionLock } from "./session-lock.ts";
import { evidence, json } from "./session-checkpoint.ts";
import type { SessionControl } from "./session-control-contract.ts";
import { verifyFrozen } from "./frozen-setup.ts";
import { digest, identity } from "./session-fixtures.ts";
import {
  hashes,
  readTree,
  treeIdentity,
  writeTree,
} from "./candidate-files.ts";
import type {
  FrozenBot,
  CandidateValidationRequest,
  CandidateValidationResult,
} from "./session-contract.ts";
import type { IterationManifest } from "./iteration-contract.ts";
import type {
  CandidateDecisionRequest,
  CandidateDecisionResult,
} from "./decision-contract.ts";

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value, null, 2) + "\n");
const same = (a: unknown, b: unknown) => identity(a) === identity(b);
async function pinned(ref: { path: string; sha256: string }) {
  const bytes = await readFile(ref.path);
  if (digest(bytes) !== ref.sha256)
    throw new Error(`Evidence identity mismatch: ${ref.path}`);
  return bytes;
}
async function sync(file: string) {
  const handle = await open(file, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncTree(root: string) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) await syncTree(file);
    else await sync(file);
  }
  await sync(root);
}
async function archiveBot(root: string, bot: FrozenBot, descriptor = true) {
  const files = await readTree(root);
  const sidecar = files["frozen-bot.json"];
  delete files["frozen-bot.json"];
  const { identity: expected, ...body } = bot;
  if (
    !Object.keys(bot.files).length ||
    Object.hasOwn(bot.files, "frozen-bot.json") ||
    identity(body) !== expected ||
    !same(hashes(files), bot.files) ||
    (descriptor && !sidecar) ||
    (sidecar && !same(JSON.parse(sidecar.toString()), bot))
  )
    throw new Error("Candidate/accepted archive identity mismatch");
}

async function terminalControl(
  session: string,
  iteration: number,
  accepted: { path: string; identity: string },
  fixtureIdentity: string,
) {
  const bytes = await readFile(path.join(session, "control.json"));
  const ledger = JSON.parse(bytes.toString()) as SessionControl;
  const checkpoint = ledger.iterations.at(-1);
  if (
    ledger.schemaVersion !== 1 ||
    ledger.fixtureIdentity !== fixtureIdentity ||
    !checkpoint ||
    checkpoint.iteration !== iteration ||
    !["complete", "failed"].includes(checkpoint.status) ||
    !checkpoint.evidence ||
    !same(checkpoint.accepted, accepted) ||
    ledger.iterations.some((item) =>
      ["active", "interrupted"].includes(item.status),
    ) ||
    ledger.attempts.some((attempt) => attempt.status === "running")
  )
    throw new Error(
      "Finish the iteration ledger and settle all reservations before decision",
    );
  return { bytes, evidence: checkpoint.evidence, attempts: ledger.attempts };
}

/** Shared with preparation and all future state writers (including stop/resume). */
export async function applyDecision(
  input: CandidateDecisionRequest,
): Promise<CandidateDecisionResult> {
  if (
    input.schemaVersion !== 1 ||
    !["accept", "reject"].includes(input.decision) ||
    !input.rationale?.trim() ||
    !Array.isArray(input.evidence)
  )
    throw new Error("Explicit decision, rationale and evidence list required");
  const ref = (value: { path: string; sha256: string }) => ({
    path: path.resolve(value.path),
    sha256: value.sha256,
  });
  const request: CandidateDecisionRequest = {
    schemaVersion: 1,
    session: path.resolve(input.session),
    manifest: ref(input.manifest),
    validation: ref(input.validation),
    candidateIdentity: input.candidateIdentity,
    decision: input.decision,
    rationale: input.rationale,
    evidence: input.evidence.map(ref),
  };
  const session = request.session;
  return withSessionLock(session, async () => {
    let stage: string | undefined;
    let stateStage: string | undefined;
    try {
      const config = await json(path.join(session, "config.json"));
      const statePath = path.join(session, "state.json");
      const state = await json(statePath);
      const frozen = await verifyFrozen(config.fixture.path);
      if (
        config.schemaVersion !== 1 ||
        state.schemaVersion !== 1 ||
        config.fixture.identity !== frozen.identity ||
        state.fixtureIdentity !== frozen.identity ||
        !Number.isSafeInteger(state.iteration) ||
        state.iteration < 0
      )
        throw new Error("Session fixture/state identity mismatch");
      const manifestPath = path.resolve(request.manifest.path);
      const match = /^iteration-(\d{4,})$/.exec(
        path.basename(path.dirname(manifestPath)),
      );
      if (
        !match ||
        manifestPath !==
          path.join(session, "iterations", match[0], "manifest.json")
      )
        throw new Error("Decision requires a session iteration manifest");
      const iteration = Number(match[1]);
      const archive = path.join(session, "versions", match[0]);
      const decisionIdentity = identity(request);
      let result: CandidateDecisionResult;
      let journal:
        | {
            request: CandidateDecisionRequest;
            result: CandidateDecisionResult;
            files: Record<string, string>;
          }
        | undefined;
      try {
        journal = await json(path.join(archive, "decision.json"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (journal) {
        if (
          !same(journal.request, request) ||
          journal.result.identity !== decisionIdentity
        )
          throw new Error("Conflicting decision for iteration");
        const tree = await readTree(archive);
        delete tree["decision.json"];
        if (
          !same(hashes(tree), journal.files) ||
          !same(JSON.parse(tree["outcome.json"]!.toString()), journal.result)
        )
          throw new Error("Decision archive identity mismatch");
        result = journal.result;
        if (
          result.iteration !== iteration ||
          result.archive !== archive ||
          result.fixtureIdentity !== frozen.identity
        )
          throw new Error("Decision archive binding mismatch");
        if (state.iteration >= iteration) {
          if (
            state.iteration === iteration &&
            (!same(state.accepted, result.accepted) ||
              state.lastDecision?.identity !== decisionIdentity)
          )
            throw new Error("Conflicting committed decision state");
          return result;
        }
      } else {
        if (iteration !== state.iteration + 1)
          throw new Error("Stale or out-of-order decision");
        try {
          await lstat(archive);
          throw new Error(
            "Decision destination exists without a valid journal",
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const manifestBytes = await pinned(request.manifest);
        const manifest = JSON.parse(
          manifestBytes.toString(),
        ) as IterationManifest;
        if (
          manifest.schemaVersion !== 1 ||
          manifest.iteration !== iteration ||
          manifest.id !== match[0] ||
          !same(manifest.fixture, config.fixture) ||
          manifest.accepted.identity !== state.accepted.identity ||
          manifest.accepted.bot.identity !== state.accepted.identity ||
          manifest.candidate.basedOn !== state.accepted.identity ||
          !same(manifest.control, manifest.self) ||
          manifest.control.identity !== state.accepted.identity
        )
          throw new Error("Stale iteration or accepted binding mismatch");
        const checkpoint = await terminalControl(
          session,
          iteration,
          state.accepted,
          frozen.identity,
        );
        await evidence(session, checkpoint.evidence);
        const finishBytes = await pinned({
          path: path.join(session, checkpoint.evidence.path),
          sha256: checkpoint.evidence.sha256,
        });
        await archiveBot(manifest.accepted.path, manifest.accepted.bot);
        await archiveBot(
          state.accepted.path,
          manifest.accepted.bot,
          path.resolve(state.accepted.path) !==
            path.resolve(config.fixture.path, "versions/initial"),
        );
        const validationBytes = await pinned(request.validation);
        const validation = JSON.parse(
          validationBytes.toString(),
        ) as CandidateValidationResult;
        if (
          validation.schemaVersion !== 1 ||
          !["valid", "invalid"].includes(validation.status) ||
          validation.fixtureIdentity !== frozen.identity ||
          validation.acceptedIdentity !== state.accepted.identity ||
          request.candidateIdentity !==
            (validation.candidate?.bot.identity ?? null) ||
          path.resolve(request.validation.path) !==
            path.join(validation.evidence, "result.json")
        )
          throw new Error("Validation binding identity mismatch");
        const evidenceTree = await readTree(validation.evidence);
        if (!evidenceTree["result.json"]?.equals(validationBytes))
          throw new Error("Validation changed during capture");
        const validationRequest = JSON.parse(
          evidenceTree["request.json"]!.toString(),
        ) as CandidateValidationRequest;
        if (
          validationRequest.schemaVersion !== 1 ||
          !same(validationRequest.fixture, manifest.fixture) ||
          validationRequest.accepted.path !== manifest.accepted.path ||
          !same(validationRequest.accepted.bot, manifest.accepted.bot) ||
          validationRequest.candidate !== manifest.candidate.path ||
          path.resolve(validationRequest.output) !== validation.evidence
        )
          throw new Error(
            "Validation request does not bind prepared candidate",
          );
        if (
          request.decision === "accept" &&
          (validation.status !== "valid" ||
            !validation.candidate ||
            validation.reasons.length)
        )
          throw new Error("Invalid candidate cannot be accepted");
        if (
          request.decision === "accept" &&
          checkpoint.attempts.some(
            (attempt) =>
              attempt.iteration === iteration &&
              attempt.role === "candidate" &&
              attempt.executableIdentity !== validation.candidate?.bot.identity,
          )
        )
          throw new Error(
            "Evaluated candidate executable identity differs from validation",
          );
        if (validation.status === "valid") {
          const candidate = validation.candidate;
          if (
            !candidate ||
            candidate.path !== path.join(validation.evidence, "candidate")
          )
            throw new Error("Validated candidate archive missing");
          await archiveBot(candidate.path, candidate.bot);
          const metadata = ({
            identity: _id,
            files: _files,
            ...body
          }: FrozenBot) => {
            void _id;
            void _files;
            return body;
          };
          if (!same(metadata(candidate.bot), metadata(frozen.target)))
            throw new Error("Frozen bot metadata changed");
          const submitted = Object.fromEntries(
            Object.entries(evidenceTree)
              .filter(([file]) => file.startsWith("submitted/"))
              .map(([file, bytes]) => [file.slice(10), bytes]),
          );
          if (treeIdentity(submitted) !== validation.snapshotIdentity)
            throw new Error("Validation snapshot identity mismatch");
          delete submitted["frozen-bot.json"];
          const executable =
            candidate.bot.kind === "module" ? "bot.mjs" : "dist/ai.wasm";
          delete submitted[executable];
          const executableFiles = {
            [executable]: candidate.bot.files[executable],
            ...(candidate.bot.kind === "module"
              ? { "strategy.mjs": candidate.bot.files["strategy.mjs"] }
              : {}),
          };
          if (
            treeIdentity(submitted) !== validation.sourceIdentity ||
            identity(executableFiles) !== validation.executableIdentity
          )
            throw new Error("Validation source/executable identity mismatch");
          // Verify the captured bytes too, rather than publishing a later live read.
          const captured = Object.fromEntries(
            Object.entries(evidenceTree)
              .filter(
                ([file]) =>
                  file.startsWith("candidate/") &&
                  file !== "candidate/frozen-bot.json",
              )
              .map(([file, bytes]) => [file.slice(10), bytes]),
          );
          if (
            !same(hashes(captured), candidate.bot.files) ||
            !same(
              JSON.parse(evidenceTree["candidate/frozen-bot.json"]!.toString()),
              candidate.bot,
            )
          )
            throw new Error("Captured candidate identity mismatch");
        }
        result = {
          schemaVersion: 1,
          identity: decisionIdentity,
          decision: request.decision,
          iteration,
          nextIteration: iteration + 1,
          fixtureIdentity: frozen.identity,
          previousAccepted: state.accepted,
          accepted:
            request.decision === "accept"
              ? {
                  path: path.join(archive, "validation/candidate"),
                  identity: validation.candidate!.bot.identity,
                }
              : state.accepted,
          archive,
        };
        const files: Record<string, Buffer> = {
          "manifest.json": manifestBytes,
          "outcome.json": encode(result),
          "control.json": checkpoint.bytes,
          "finish-evidence": finishBytes,
        };
        for (const [file, bytes] of Object.entries(evidenceTree))
          files[`validation/${file}`] = bytes;
        for (const [i, ref] of request.evidence.entries())
          files[`evidence/${i}`] = await pinned(ref);
        stage = `${archive}.staging-${randomUUID()}`;
        await mkdir(stage);
        await writeTree(stage, files);
        await writeFile(
          path.join(stage, "decision.json"),
          encode({ request, result, files: hashes(files) }),
          { flag: "wx" },
        );
        await syncTree(stage);
        await rename(stage, archive);
        stage = undefined;
        await sync(path.dirname(archive));
      }
      // Journal is authoritative before this single state commit; replay uses archived bytes.
      if (
        state.iteration !== iteration - 1 ||
        !same(state.accepted, result.previousAccepted)
      )
        throw new Error("Stale decision recovery state");
      await terminalControl(
        session,
        iteration,
        state.accepted,
        frozen.identity,
      );
      if (!same(await json(statePath), state))
        throw new Error("Session state changed outside mutation lock");
      stateStage = `${statePath}.staging-${randomUUID()}`;
      await writeFile(
        stateStage,
        encode({
          ...state,
          iteration,
          accepted: result.accepted,
          lastDecision: {
            identity: decisionIdentity,
            path: path.join(archive, "decision.json"),
            iteration,
          },
        }),
        { flag: "wx" },
      );
      await sync(stateStage);
      await rename(stateStage, statePath);
      stateStage = undefined;
      await sync(session);
      return result;
    } finally {
      if (stage) await rm(stage, { recursive: true, force: true });
      if (stateStage) await rm(stateStage, { force: true });
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    if (!process.argv[2])
      throw new Error("Usage: npm run bot:decide -- decision-request.json");
    const file = path.resolve(process.argv[2]);
    const request = (await json(file)) as CandidateDecisionRequest;
    const resolve = (value: string) => path.resolve(path.dirname(file), value);
    request.session = resolve(request.session);
    request.manifest.path = resolve(request.manifest.path);
    request.validation.path = resolve(request.validation.path);
    request.evidence = request.evidence.map((ref) => ({
      ...ref,
      path: resolve(ref.path),
    }));
    console.log(JSON.stringify(await applyDecision(request)));
  } catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
