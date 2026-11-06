/** Durable logical-agent handoff when a provider session disappears or exhausts context. */
import { open, readFile, rename, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
export interface Session {
  session_id: string;
  model: string;
  effort: string;
  logical_agent_id?: unknown;
  previous_session_id?: string | null;
  replace_reason?: string;
  usage?: Record<string, number>;
}
export async function saveSession(
  directory: string,
  session: Session,
): Promise<void> {
  const temporary = join(directory, "session.next");
  const file = await open(temporary, "w");
  try {
    await file.writeFile(JSON.stringify(session));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, join(directory, "session.json"));
  const parent = await open(directory, "r");
  try {
    await parent.sync();
  } finally {
    await parent.close();
  }
}
export async function previousSession(
  directory: string,
  model: string,
  effort: string,
): Promise<Session | undefined> {
  let previous: Session;
  let raw: string;
  try {
    raw = await readFile(join(directory, "session.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    previous = JSON.parse(raw) as Session;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    await writeFile(
      join(directory, `corrupted-session-${Date.now()}.json`),
      raw,
    );
    return undefined;
  }
  if (
    !previous ||
    typeof previous.session_id !== "string" ||
    typeof previous.model !== "string" ||
    typeof previous.effort !== "string"
  ) {
    await writeFile(
      join(directory, `corrupted-session-${Date.now()}.json`),
      raw,
    );
    return undefined;
  }
  if (previous.model !== model || previous.effort !== effort)
    throw new Error("Agent settings changed during session");
  let files: string[] = [];
  try {
    files = await readdir(join(directory, "runtime/sessions"), {
      recursive: true,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (
    previous.replace_reason ||
    !files.some((name) => name.includes(previous.session_id))
  ) {
    await writeFile(
      join(directory, `lost-session-${Date.now()}.json`),
      JSON.stringify({
        ...previous,
        reason:
          previous.replace_reason ??
          "persisted session unavailable; recover from durable handoff",
      }),
    );
    return undefined;
  }
  return previous;
}
