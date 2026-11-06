/** Mount a writable session store without changing the owner's Codex home. */
export function agentSandbox(input: {
  workspace: string;
  runtime: string;
  originalHome: string;
  authentication: string;
  binaryDirectory: string;
  executable: string;
  args: string[];
}): string[] {
  return [
    "--die-with-parent",
    "--ro-bind",
    "/",
    "/",
    // The outer supervisor already has a private /dev. A recursive read-only
    // root bind makes its PTYs unusable; create fresh devices for shell tools.
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--bind",
    input.workspace,
    input.workspace,
    "--bind",
    input.runtime,
    input.originalHome,
    "--ro-bind",
    input.binaryDirectory,
    input.binaryDirectory,
    "--ro-bind",
    input.authentication,
    input.authentication,
    "--tmpfs",
    "/tmp",
    "--",
    input.executable,
    ...input.args,
  ];
}
