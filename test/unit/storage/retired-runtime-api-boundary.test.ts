import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ts from "typescript";

function exportedNames(file: string): readonly string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  return source.statements.flatMap((statement) => {
    if (
      ts.canHaveModifiers(statement) &&
      ts
        .getModifiers(statement)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement))
    )
      return statement.name === undefined ? [] : [statement.name.text];
    return [];
  });
}

describe("retired browser delivery APIs", () => {
  it("keeps only semantic image leases and placeholders", () => {
    expect(
      exportedNames("src/battle/app/images/card-image-cache.ts").toSorted(),
    ).toEqual(
      [
        "CardImageDiagnostic",
        "CardImageDiagnosticStatus",
        "CardImageLease",
        "CardImageLibrary",
        "createCardImageSourceLibrary",
      ].sort(),
    );
  });

  it("has no hosted browser runtime loader", () => {
    expect(
      existsSync("src/battle/worker/assets/browser-runtime-assets.ts"),
    ).toBe(false);
  });
  it.each([
    "scripts/lib/chapter-content-source.ts",
    "scripts/lib/sqlite-content/chapter-story-source.ts",
    "scripts/lib/sqlite-content/normalized-package-source.ts",
  ])("keeps SQLite authoring independent of retired delivery: %s", (file) => {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const imports = source.statements.flatMap((statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [],
    );
    expect(
      imports.filter(
        (specifier) =>
          specifier.includes("/content/") ||
          specifier.includes("/asset-delivery/"),
      ),
    ).toEqual([]);
  });
});
