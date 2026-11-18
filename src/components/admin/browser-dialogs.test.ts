import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return /\.[jt]sx?$/.test(filename) && !/\.test\./.test(filename) ? [filename] : [];
  });
}

it("does not call native browser dialogs in application source", () => {
  const failures: string[] = [];
  for (const filename of sourceFiles(path.resolve("src"))) {
    const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const name = ts.isIdentifier(expression) ? expression.text
          : ts.isPropertyAccessExpression(expression) && expression.expression.getText(source) === "window" ? expression.name.text
          : null;
        if (name && ["alert", "confirm", "prompt"].includes(name)) {
          failures.push(`${path.relative(process.cwd(), filename)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(failures).toEqual([]);
});
