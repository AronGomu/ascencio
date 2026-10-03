import { readFile, writeFile } from "node:fs/promises";
import ts from "typescript";
const vendor = "vendor/ocgcore-wasm/0.1.2";
const bytes = await readFile(`${vendor}/lib/ocgcore.sync.wasm`);
const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
const source = await readFile(`${vendor}/lib/ocgcore.sync.mjs`, "utf8");
const ast = ts.createSourceFile(
  "loader.mjs",
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
);
const bindings: Record<string, string> = {};
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(ast) === "ub" &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    for (const property of node.initializer.properties)
      if (ts.isPropertyAssignment(property))
        bindings[property.name.getText(ast)] =
          property.initializer.getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (
  imports.length !== 17 ||
  imports.some((entry) => entry.module !== "a" || !bindings[entry.name])
)
  throw new Error("FROZEN_IMPORT_AUDIT_CHANGED");
const report = {
  vendor,
  imports: imports.map((entry) => ({
    ...entry,
    implementation: bindings[entry.name],
  })),
  sourcePolicy:
    "The sync loader owns a virtual Emscripten filesystem. Native Tauri IPC is not supplied as a WASM host import. Worker callbacks resolve cards/scripts from prepared memory. Syntax validation is not proof of script correctness or immunity to hangs.",
};
const output = process.argv[2];
if (!output)
  throw new Error("Usage: node scripts/audit-mod-runtime.ts <new-report.json>");
await writeFile(output, JSON.stringify(report, null, 2), { flag: "wx" });
console.log(`Audited ${imports.length} frozen host imports; report written.`);
