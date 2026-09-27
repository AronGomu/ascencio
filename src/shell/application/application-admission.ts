export interface ApplicationAdmission {
  enter(kind: "session" | "restore" | "approval"): (() => void) | null;
  close(): void;
}

/** Root-local admission closes synchronously, before any capability awaits. */
export function createApplicationAdmission(): ApplicationAdmission {
  let sessions = 0;
  let exclusive = false;
  let closed = false;
  return Object.freeze({
    enter(kind: "session" | "restore" | "approval") {
      if (closed || exclusive || (kind !== "session" && sessions > 0))
        return null;
      if (kind === "session") sessions += 1;
      else exclusive = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (kind === "session") sessions -= 1;
        else exclusive = false;
      };
    },
    close() {
      closed = true;
    },
  });
}
