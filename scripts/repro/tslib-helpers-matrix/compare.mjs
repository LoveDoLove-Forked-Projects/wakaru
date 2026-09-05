import { createRequire } from "node:module";
import { join } from "node:path";
import { ensureNodeTool } from "../lib/runner.mjs";
import { matchesAnyForm, prewarmNormalize } from "../lib/compare.mjs";

let typescript;
function tsApi() {
  typescript ??= createRequire(join(ensureNodeTool("typescript-5.9.3", ["typescript@5.9.3"]), "package.json"))("typescript");
  return typescript;
}

// Compare the complete recovered module, not just the presence of async/class
// syntax. Canonicalize only export spelling/placement. A CJS round trip can
// emit `function f() {}; export { f }` instead of `export function f() {}`.
// Keep local export targets distinct from their public names for alpha-renaming.
function moduleParts(code) {
  const ts = tsApi();
  const file = ts.createSourceFile("module.js", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) return null;
  const printer = ts.createPrinter();
  const body = [], exports = [], tslib = [];
  for (let statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      statement = ts.factory.updateImportDeclaration(statement, statement.modifiers,
        statement.importClause, ts.factory.createStringLiteral(statement.moduleSpecifier.text), statement.attributes);
    }
    if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === "tslib") {
      tslib.push(printer.printNode(ts.EmitHint.Unspecified, statement, file));
    } else if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier
      && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      exports.push(...statement.exportClause.elements);
    } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement))
      && statement.name && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      // These fixtures have only named exports; fail closed for default forms.
      if (statement.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) return null;
      exports.push(ts.factory.createExportSpecifier(false, undefined, statement.name));
      body.push(printer.printNode(ts.EmitHint.Unspecified, ts.factory.replaceModifiers(
        statement, statement.modifiers.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword),
      ), file));
    } else {
      body.push(printer.printNode(ts.EmitHint.Unspecified, statement, file));
    }
  }
  exports.sort((a, b) => a.name.text.localeCompare(b.name.text, "en"));
  if (exports.length) body.push(printer.printNode(ts.EmitHint.Unspecified,
    ts.factory.createExportDeclaration(undefined, false, ts.factory.createNamedExports(exports)), file));
  return { body: body.join("\n"), tslib: tslib.join("\n") };
}

export function comparisonInputs(snippet, recovered) {
  const actual = moduleParts(recovered);
  if (!actual) return { recovered, forms: [] };
  // Helper imports are injected by the compiler and may survive after their
  // calls disappear. Include those exact imports in the expected module too;
  // never erase helper calls, declarations, or any other program statements.
  // Other imports (e.g. the interop provider) must match the source normally.
  const prefix = actual.tslib + "\n";
  const forms = [snippet.source, ...(snippet.acceptForms ?? [])]
    .map(moduleParts).filter(Boolean).map((form) => prefix + form.body);
  return { recovered: prefix + actual.body, forms };
}

export function validateModuleRecovery({ snippet, recovered }) {
  const input = comparisonInputs(snippet, recovered);
  const success = matchesAnyForm(input.recovered, input.forms);
  return {
    recovered: success,
    notes: success ? "complete module matches an accepted source form" : "module differs from accepted source forms",
  };
}

export async function prewarmModuleRecovery(rows) {
  await prewarmNormalize(rows.flatMap(({ snippet, recovered }) => {
    if (recovered == null) return [];
    const input = comparisonInputs(snippet, recovered);
    return [input.recovered, ...input.forms];
  }), { rename: true });
}
