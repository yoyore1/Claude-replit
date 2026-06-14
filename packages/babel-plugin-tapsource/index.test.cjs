const test = require("node:test");
const assert = require("node:assert");
const babel = require("@babel/core");
const plugin = require("./index.cjs");

function transform(code, filename = "/proj/App.tsx") {
  return babel.transformSync(code, {
    filename,
    plugins: [[plugin, { projectRoot: "/proj" }]],
    presets: [["@babel/preset-typescript", { isTSX: true, allExtensions: true }]],
    configFile: false,
    babelrc: false,
  }).code;
}

test("injects __tapSource with relative file path", () => {
  const out = transform(`const x = <Text>Hi</Text>;`);
  assert.match(out, /__tapSource=\{/);
  assert.match(out, /file: "App\.tsx"/);
});

test("captures 1-based line and 0-based column of the opening tag", () => {
  // <Text> starts at line 2, column 2 (after two spaces).
  const out = transform(`const x = (\n  <Text>Hi</Text>\n);`);
  assert.match(out, /line: 2/);
  assert.match(out, /col: 2/);
});

test("tags nested elements independently", () => {
  const out = transform(`const x = <View><Text>Hi</Text></View>;`);
  const matches = out.match(/__tapSource/g) || [];
  assert.strictEqual(matches.length, 2);
});

test("does not double-inject", () => {
  const out = transform(`const x = <Text __tapSource={{}}>Hi</Text>;`);
  const matches = out.match(/__tapSource/g) || [];
  assert.strictEqual(matches.length, 1);
});
