/** Metadata-only status and standalone dashboard; does not inspect gameplay. */
import path from "node:path";
import {
  readWorkflowSnapshot,
  renderWorkflowDashboard,
} from "./workflow-telemetry.ts";
import { writeOutput } from "./output-storage.ts";
const [session, htmlFile] = process.argv.slice(2);
if (!session) throw Error("Usage: workflow-status.ts SESSION [DASHBOARD.html]");
const snapshot = await readWorkflowSnapshot(session);
if (!snapshot) throw Error("No workflow telemetry recorded");
if (htmlFile)
  await writeOutput(path.resolve(htmlFile), renderWorkflowDashboard(snapshot));
console.log(
  JSON.stringify({
    revision: snapshot.revision,
    updatedAt: snapshot.updatedAt,
    current: snapshot.current,
    coverage: snapshot.coverage,
    resources: snapshot.resources,
    ...(htmlFile ? { dashboard: path.resolve(htmlFile) } : {}),
  }),
);
