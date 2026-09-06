// Real two-stage producer: inline SWC async wrapper around a tslib generator.
const fs = require("node:fs");
const path = require("node:path");
const swc = require("@swc/core");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "source.js"), "utf8");
const first = swc.transformSync(source, {
  filename: "input.js",
  jsc: { target: "es2015", parser: { syntax: "ecmascript" } },
  module: { type: "es6" },
}).code;
const second = ts.transpileModule(first, {
  compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS, importHelpers: true },
}).outputText;
fs.writeFileSync(path.join(__dirname, "generated.js"), second);
