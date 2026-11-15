/** Separate immutable analysis cohorts share evaluation evidence, never mutable claims. */
export function analysisScope(
  iteration: number,
  role: string,
  analysisId?: string,
) {
  if (
    !Number.isSafeInteger(iteration) ||
    iteration < 1 ||
    !["control", "candidate"].includes(role) ||
    (analysisId !== undefined &&
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(analysisId))
  )
    throw Error("Invalid analysis scope");
  return `iterations/iteration-${String(iteration).padStart(4, "0")}/analyses/${role}${analysisId ? "/cohorts/" + analysisId : ""}`;
}
