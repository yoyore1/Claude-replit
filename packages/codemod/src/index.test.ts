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
        const end = path.node.loc?.end ?? opening.loc.end;
        hits.push({
          file: "App.tsx",
          line: opening.loc.start.line,
          col: opening.loc.start.column,
          end: { line: end.line, col: end.column },
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

  it("scopes a field color to `${field}Style` so siblings recolor independently", () => {
    const code = `export default () => <SettingsRow label="Folders" value="3" />;\n`;
    // Recolor the label text only.
    const lab = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "color",
      value: "#ff0000",
      field: "label",
    });
    expect(lab.ok).toBe(true);
    expect(lab.code).toContain("labelStyle={{");
    expect(lab.code).toContain('"#ff0000"');
    expect(lab.code).not.toContain("valueStyle");

    // Recolor the value text only — independent of the label.
    const val = applyEdit(lab.code!, {
      source: locOf(lab.code!, "SettingsRow"),
      kind: "color",
      value: "#00ff00",
      field: "value",
    });
    expect(val.ok).toBe(true);
    expect(val.code).toContain("valueStyle={{");
    expect(val.code).toContain('"#00ff00"');
    // The label color from the first edit is still there, untouched.
    expect(val.code).toContain('"#ff0000"');
  });

  it("backgroundColor ignores field and stays on the element's box (style)", () => {
    const code = `export default () => <SettingsRow label="Folders" />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "backgroundColor",
      value: "#eeeeee",
      field: "label",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("style={{");
    expect(res.code).toContain("backgroundColor");
    expect(res.code).not.toContain("labelStyle");
  });
});

describe("applyEdit — move (free drag, transform translate)", () => {
  it("adds a transform translate when no style exists", () => {
    const code = `export default () => <View>Hi</View>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "View"),
      kind: "move",
      value: "",
      dx: 40,
      dy: 120,
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("transform:");
    expect(res.code).toContain("translateX: 40");
    expect(res.code).toContain("translateY: 120");
    // Crucially NOT absolute — the element keeps its slot, siblings don't reflow.
    expect(res.code).not.toContain("absolute");
  });

  it("stacks onto a StyleSheet ref element-scoped (leaves shared style)", () => {
    const code = [
      "import { StyleSheet, View } from 'react-native';",
      "export default () => <View style={styles.card}>Hi</View>;",
      "const styles = StyleSheet.create({ card: { padding: 8 } });",
      "",
    ].join("\n");
    const res = applyEdit(code, {
      source: locOf(code, "View"),
      kind: "move",
      value: "",
      dx: 10,
      dy: 20,
    });
    expect(res.ok).toBe(true);
    expect(res.code).toMatch(/\[\s*styles\.card\s*,/);
    expect(res.code).toContain("padding: 8"); // shared entry untouched
    expect(res.code).toContain("translateX: 10");
  });

  it("re-dragging ACCUMULATES the delta in place (no duplicate axes)", () => {
    const code = `export default () => <View>Hi</View>;\n`;
    const first = applyEdit(code, {
      source: locOf(code, "View"),
      kind: "move",
      value: "",
      dx: 5,
      dy: 5,
    });
    const second = applyEdit(first.code!, {
      source: locOf(first.code!, "View"),
      kind: "move",
      value: "",
      dx: 10,
      dy: 20,
    });
    expect(second.ok).toBe(true);
    expect(second.code).toContain("translateX: 15"); // 5 + 10
    expect(second.code).toContain("translateY: 25"); // 5 + 20
    expect(second.code!.match(/translateX:/g)?.length).toBe(1);
    expect(second.code!.match(/translateY:/g)?.length).toBe(1);
  });

  it("accumulates into a negative offset", () => {
    const code = `export default () => <View>Hi</View>;\n`;
    const first = applyEdit(code, {
      source: locOf(code, "View"),
      kind: "move",
      value: "",
      dx: -12,
      dy: 4,
    });
    const second = applyEdit(first.code!, {
      source: locOf(first.code!, "View"),
      kind: "move",
      value: "",
      dx: -8,
      dy: -10,
    });
    expect(second.ok).toBe(true);
    expect(second.code).toContain("translateX: -20"); // -12 + -8
    expect(second.code).toContain("translateY: -6"); // 4 + -10
    expect(() => parse(second.code!)).not.toThrow();
  });

  it("stacks with a prior color override on the same element", () => {
    const code = `export default () => <View style={{ backgroundColor: '#fff' }}>Hi</View>;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "View"),
      kind: "move",
      value: "",
      dx: 30,
      dy: 60,
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("backgroundColor");
    expect(res.code).toContain("translateX: 30");
  });

  it("a field move scopes to `${field}Style` so the TEXT moves, not the box", () => {
    const code = `export default () => <SettingsRow label="Folders" value="3" />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "move",
      value: "",
      dx: 12,
      dy: 34,
      field: "label",
    });
    expect(res.ok).toBe(true);
    // The move lands on labelStyle (the text), not the row's own style (the box).
    expect(res.code).toContain("labelStyle={{");
    expect(res.code).toMatch(/labelStyle=\{\{[^}]*transform/s);
    expect(res.code).not.toContain("valueStyle");
    // The row's own box `style` is left untouched.
    expect(res.code).not.toMatch(/\sstyle=\{/);
  });

  it("moving the label then the value moves each text independently", () => {
    const code = `export default () => <SettingsRow label="Folders" value="3" />;\n`;
    const lab = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "move",
      value: "",
      dx: 1,
      dy: 2,
      field: "label",
    });
    const val = applyEdit(lab.code!, {
      source: locOf(lab.code!, "SettingsRow"),
      kind: "move",
      value: "",
      dx: 9,
      dy: 8,
      field: "value",
    });
    expect(val.ok).toBe(true);
    expect(val.code).toContain("labelStyle={{");
    expect(val.code).toContain("valueStyle={{");
    // The label's offset from the first move is preserved.
    expect(val.code).toContain("translateY: 2");
    expect(val.code).toContain("translateY: 8");
  });

  it("a box move (no field) moves the container via its own style", () => {
    const code = `export default () => <SettingsRow label="Folders" value="3" />;\n`;
    const res = applyEdit(code, {
      source: locOf(code, "SettingsRow"),
      kind: "move",
      value: "",
      dx: 5,
      dy: 6,
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("style={{");
    expect(res.code).toContain("transform:");
    expect(res.code).not.toContain("labelStyle");
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

describe("applyEdit — stale/drift recovery", () => {
  // A screen with two identically-indented rows. Editing the first pushes the
  // second DOWN; a quick follow-up edit on the second still carries its old line
  // (pre-edit), which must still resolve to the right element.
  const screen = [
    "function App() {",
    "  return (",
    "    <View>",
    '      <Text style={styles.row}>Alpha</Text>',
    '      <Text style={styles.row}>Bravo two</Text>',
    "    </View>",
    "  );",
    "}",
    "",
  ].join("\n");

  it("recovers the right element when its line drifted (exact miss)", () => {
    // Capture Bravo's location, then shift the file by editing Alpha's color
    // (recast expands the inline override across several lines).
    const bravoBefore = locOf(screen, "Text", 1);
    const shifted = applyEdit(screen, {
      source: locOf(screen, "Text", 0), // Alpha
      kind: "color",
      value: "#ff0000",
    });
    expect(shifted.ok).toBe(true);
    // Bravo has now moved down, but we still send its OLD line/col (+ end).
    const res = applyEdit(shifted.code!, {
      source: bravoBefore,
      kind: "text",
      value: "Bravo edited",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain("Bravo edited");
    // Alpha's earlier color edit is intact and Alpha text is unchanged.
    expect(res.code).toContain("#ff0000");
    expect(res.code).toContain(">Alpha<");
  });

  it("prefers an exact match over a drift candidate", () => {
    const res = applyEdit(screen, {
      source: locOf(screen, "Text", 0), // exact Alpha
      kind: "text",
      value: "Alpha exact",
    });
    expect(res.ok).toBe(true);
    expect(res.code).toContain(">Alpha exact<");
    expect(res.code).toContain(">Bravo two<"); // Bravo untouched
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
