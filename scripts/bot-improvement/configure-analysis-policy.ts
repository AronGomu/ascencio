/** Immutable cohorts plus explicit budget continuation through the owning ledger. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { json, save } from "./session-checkpoint.ts";
import { withSessionLock } from "./session-lock.ts";
import { analysisScope } from "./analysis-scope.ts";
import {
  resolveAnalysisPolicy,
  policyIdentity,
  type AnalysisPolicy,
} from "./analysis-policy.ts";
import { controlSession } from "./control-session.ts";
import type { ControlAction } from "./session-control-contract.ts";
type Continuation = Extract<ControlAction, { action: "continue" }>;
export interface ConfigureAnalysisRequest {
  id: string;
  policy: Partial<AnalysisPolicy>;
  expandFrom?: string;
  continuation?: Omit<Continuation, "action">;
}
export async function configureAnalysisPolicy(
  session: string,
  request: ConfigureAnalysisRequest,
) {
  analysisScope(1, "control", request.id);
  const check = async () => {
    const config = await json(path.join(session, "config.json"));
    const policy = resolveAnalysisPolicy(
      request.policy,
      config.limits.analysisWorkers,
    );
    if (
      policy.pipeline &&
      JSON.stringify(policy.pipeline) !==
        JSON.stringify(config.analysisPolicy?.pipeline)
    )
      throw Error(
        "Pipeline storage envelopes are session-global; configure them at setup",
      );
    const previous = config.analysisPolicies?.[request.id];
    if (previous && policyIdentity(previous) !== policyIdentity(policy))
      throw Error("Cohort policy is immutable; choose a new id");
    if (
      previous &&
      config.analysisCohorts?.[request.id]?.expandFrom !== request.expandFrom
    )
      throw Error("Cohort provenance is immutable");
    if (request.expandFrom) {
      const source = config.analysisPolicies?.[request.expandFrom];
      if (!source) throw Error("Unknown expansion source");
      if (
        source.mode === "full" ||
        (policy.mode !== "full" &&
          (policy.mode !== source.mode ||
            policy.seed !== source.seed ||
            policy.sampleMatches! <= source.sampleMatches))
      )
        throw Error("Expansion must preserve selection and increase coverage");
    }
    if (
      (policy.maxBytes !== undefined || policy.maxWallMs !== undefined) &&
      !request.continuation?.limits
    )
      throw Error(
        "Resource changes require explicit complete continuation limits",
      );
    if (request.continuation) {
      const limits = request.continuation.limits;
      if (!limits) throw Error("Complete continuation limits required");
      const ledger = await json(path.join(session, "control.json"));
      for (const key of Object.keys(ledger.limits))
        if (!Object.hasOwn(limits, key))
          throw Error("Complete continuation limits required");
      if (
        (policy.maxBytes !== undefined &&
          limits.maxBytes !== policy.maxBytes) ||
        (policy.maxWallMs !== undefined &&
          limits.maxWallMs !== policy.maxWallMs)
      )
        throw Error("Policy resource request differs from continuation limits");
    }
    return { config, policy };
  };
  await withSessionLock(session, check);
  // The owner controller validates stop tokens, original start and consumed budgets.
  // No config mutation occurs if continuation is rejected. Ledger history is authoritative.
  if (request.continuation)
    await controlSession(session, {
      action: "continue",
      ...request.continuation,
    });
  return withSessionLock(session, async () => {
    const { config, policy } = await check();
    config.analysisPolicies ??= {};
    config.analysisPolicies[request.id] = policy;
    config.analysisCohorts ??= {};
    config.analysisCohorts[request.id] = {
      policyIdentity: policyIdentity(policy),
      ...(request.expandFrom ? { expandFrom: request.expandFrom } : {}),
    };
    await save(path.join(session, "config.json"), config);
    return { id: request.id, policyIdentity: policyIdentity(policy), policy };
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [session, request] = process.argv.slice(2);
  if (!session || !request)
    throw Error("Usage: configure-analysis-policy.ts SESSION REQUEST.json");
  console.log(
    JSON.stringify(await configureAnalysisPolicy(session, await json(request))),
  );
}
