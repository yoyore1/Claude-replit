import { describe, it, expect } from "vitest";
import { parse, t } from "./parse.js";
import { applyEdit } from "./index.js";
import type { SourceLocation } from "@cr/protocol";

/**
 * Helper: find the (line, col) of the nth JSX element with a given tag name,
 * matching exactly how the babel plugin would capture it (1-based line, 0-based
 * column of the opening "<").
 */
function locOf(code: string, name: string, nth = 0): SourceLocation {
  const ast = parse(code);
  const hits: SourceLocation[] = [];
  t.visit(ast, {
    visitJSXElement(path) {
      const opening = path.node.openingElement;
      const elName = (opening.name as any).name;
      if (elName === name && opening.loc) {
        hits.push({
          file: "App.tsx",
          line: opening.loc.start.line,
          col: opening.loc.start.column,
        });
      }
      this.traverse(path);
    },
  });
  if (!hits[nth]) throw new Error(`no <${name}> #${nth} found`);
  return hits[nth];
}

describe("applyEdit — text", () => {
  it("replaces a JSXText child", () => {
    const code = `export default () => <Text>Hello world</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "text",
      value: "Goodbye",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("<Text>Goodbye</Text>");
  });

  it("replaces a {'string'} expression child", () => {
    const code = `export default () => <Text>{'Hi'}</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "text",
      value: "Yo",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("Yo");
    expect(res.code).not.toContain("Hi");
  });

  it("preserves surrounding code formatting", () => {
    const code = [
      "function App() {",
      "  return (",
      "    <View>",
      "      <Text>Title</Text>",
      "    </View>",
      "  );",
      "}",
      "",
    ].join("\n");
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "text",
      value: "New Title",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("<Text>New Title</Text>");
    expect(res.code).toContain("  return (");
    expect(res.code).toContain("    <View>");
  });
});

describe("applyEdit — color", () => {
  it("edits an inline style object", () => {
    const code = `export default () => <Text style={{ color: 'black' }}>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "color",
      value: "#ff0000",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain('"#ff0000"');
    expect(res.code).not.toContain("'black'");
  });

  it("adds a color key when missing from inline style", () => {
    const code = `export default () => <Text style={{ fontSize: 12 }}>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "color",
      value: "blue",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("fontSize");
    expect(res.code).toContain("color");
    expect(res.code).toContain("blue");
  });

  it("adds a style prop when none exists", () => {
    const code = `export default () => <Text>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "backgroundColor",
      value: "#eee",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("style={{");
    expect(res.code).toContain("backgroundColor");
  });

  it("overrides a StyleSheet ref element-scoped (wraps in array, leaves shared style)", () => {
    const code = [
      "import { StyleSheet, Text } from 'react-native';",
      "export default () => <Text style={styles.title}>Hi</Text>;",
      "const styles = StyleSheet.create({",
      "  title: { color: 'black', fontSize: 20 },",
      "});",
      "",
    ].join("\n");
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "color",
      value: "rebeccapurple",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("rebeccapurple");
    // Element-scoped: the shared StyleSheet entry is untouched...
    expect(res.code).toContain("color: 'black'");
    // ...and the ref is preserved inside an array with the inline override.
    expect(res.code).toContain("styles.title");
    expect(res.code).toMatch(/\[\s*styles\.title\s*,/);
  });

  it("overrides a token / PlatformColor value element-scoped", () => {
    const code = `export default () => <Text style={{ color: tokens.label }}>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "color",
      value: "#123456",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain('"#123456"');
    expect(res.code).not.toContain("tokens.label");
  });

  it("edits the inline override inside a style array", () => {
    const code = [
      "export default () => (",
      "  <Text style={[styles.title, { color: 'black' }]}>Hi</Text>",
      ");",
      "",
    ].join("\n");
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "color",
      value: "green",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("green");
  });
});

describe("applyEdit — prop (component text)", () => {
  it("edits a string prop on a component", () => {
    const code = `export default () => <SettingsRow label="Notifications" />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "prop",
      prop: "label",
      value: "Reminders",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain('label="Reminders"');
    expect(res.code).not.toContain("Notifications");
  });

  it("edits a {'string'} prop expression", () => {
    const code = `export default () => <AppButton title={'Save'} />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "AppButton"),
      kind: "prop",
      prop: "title",
      value: "Done",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("Done");
    expect(res.code).not.toContain("Save");
  });

  it("adds the prop when missing", () => {
    const code = `export default () => <AppButton />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "AppButton"),
      kind: "prop",
      prop: "title",
      value: "Go",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain('title="Go"');
  });

  it("errors when prop name is missing", () => {
    const code = `export default () => <AppButton title="x" />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "AppButton"),
      kind: "prop",
      value: "y",
    });
    expect(res.ok).toBe(false);
  });
});

describe("applyEdit — safety", () => {
  it("returns a re-tap error on a stale/missing location", () => {
    const code = `export default () => <Text>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: { file: "App.tsx", line: 999, col: 0 },
      kind: "text",
      value: "x",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/re-tap/);
  });

  it("output always re-parses", () => {
    const code = `export default () => <Text style={{ color: 'black' }}>Hi</Text>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "Text"),
      kind: "text",
      value: "Updated",
    });
    expect(res.ok).toBe(true);
    // applyEdit internally re-parses; a second parse here proves validity.
    expect(() => parse(res.code!)).not.toThrow();
  });
});
