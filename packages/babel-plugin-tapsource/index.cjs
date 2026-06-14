/**
 * babel-plugin-tapsource
 *
 * Injects a stable `__tapSource={{file,line,col,end}}` prop onto every JSX
 * element so the tap-to-edit runtime can recover the exact source location of a
 * tapped element WITHOUT relying on React internals (`_debugSource` was removed
 * in React 19; the jsxDEV source arg was dropped in 19.2). We own this prop, so
 * version churn can't break us.
 *
 * Coordinates use babel's convention: 1-based line, 0-based column of the
 * opening "<". The @cr/codemod engine matches against the same coordinate.
 *
 * Options:
 *   projectRoot: absolute path used to make `file` repo-relative (default cwd).
 *   attrName:    prop name to inject (default "__tapSource").
 *
 * Must be a no-op in production builds — only enable it via babel.config when
 * developing (so the prop never ships and adds no overhead).
 */
const path = require("path");

const SKIP = "__tapSourceSkip"; // internal marker to avoid re-visiting

module.exports = function tapSourcePlugin({ types: t }) {
  return {
    name: "tapsource",
    visitor: {
      JSXOpeningElement(nodePath, state) {
        const node = nodePath.node;
        if (node[SKIP]) return;
        node[SKIP] = true;

        const loc = node.loc;
        if (!loc) return; // generated nodes have no location

        const attrName = state.opts.attrName || "__tapSource";

        // Don't double-inject (e.g. if the plugin runs twice).
        const already = node.attributes.some(
          (a) =>
            a.type === "JSXAttribute" &&
            a.name &&
            a.name.name === attrName,
        );
        if (already) return;

        const root = state.opts.projectRoot || process.cwd();
        const filename = state.file.opts.filename || "unknown";
        let rel = path.relative(root, filename);
        // Normalize to POSIX so it matches across OSes and the file API.
        rel = rel.split(path.sep).join("/");

        const props = [
          objProp(t, "file", t.stringLiteral(rel)),
          objProp(t, "line", t.numericLiteral(loc.start.line)),
          objProp(t, "col", t.numericLiteral(loc.start.column)),
          objProp(
            t,
            "end",
            t.objectExpression([
              objProp(t, "line", t.numericLiteral(loc.end.line)),
              objProp(t, "col", t.numericLiteral(loc.end.column)),
            ]),
          ),
        ];

        const attr = t.jsxAttribute(
          t.jsxIdentifier(attrName),
          t.jsxExpressionContainer(t.objectExpression(props)),
        );

        node.attributes.push(attr);
      },
    },
  };
};

function objProp(t, key, valueNode) {
  return t.objectProperty(t.identifier(key), valueNode);
}
