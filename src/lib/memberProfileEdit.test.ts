import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const path = "src/app/member/[cardCode]/page.tsx";
const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const effects: ts.CallExpression[] = [];
function visit(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" &&
      node.arguments[0]?.getText(source).includes("setEditForm({")) effects.push(node);
  ts.forEachChild(node, visit);
}
visit(source);

function runSync(editModalOpen: boolean, member: unknown) {
  expect(effects).toHaveLength(1);
  const setEditForm = vi.fn();
  const setEditImageFile = vi.fn();
  const setEditImagePreviewUrl = vi.fn();
  const callback = ts.transpile(`return (${effects[0].arguments[0].getText(source)})();`);
  new Function("member", "editModalOpen", "setEditForm", "setEditImageFile", "setEditImagePreviewUrl", callback)(
    member, editModalOpen, setEditForm, setEditImageFile, setEditImagePreviewUrl,
  );
  return { setEditForm, setEditImageFile, setEditImagePreviewUrl };
}

describe("member profile edit synchronization", () => {
  it("preserves the selected photo and draft fields when a foreground refresh arrives during editing", () => {
    const setters = runSync(true, { name: "Server name", weight: 42 });
    for (const setter of Object.values(setters)) expect(setter).not.toHaveBeenCalled();
  });

  it("syncs the latest profile and clears the photo draft outside editing", () => {
    const setters = runSync(false, { name: "Latest name", weight: 42 });
    expect(setters.setEditForm).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Latest name", weight: "42" }));
    expect(setters.setEditImageFile).toHaveBeenCalledWith(null);
    expect(setters.setEditImagePreviewUrl).toHaveBeenCalledWith("");
    expect(effects[0].arguments[1].getText(source)).toContain("editModalOpen");
  });

  it("does not initialize without a loaded profile", () => {
    for (const setter of Object.values(runSync(false, null))) expect(setter).not.toHaveBeenCalled();
  });
});
