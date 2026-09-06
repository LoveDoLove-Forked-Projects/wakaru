const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const terser = require("terser");
const source = fs.readFileSync(path.join(__dirname, "source.ts"), "utf8");
(async () => {
  for (const [name, module, importHelpers] of [
    ["commonjs-inline", ts.ModuleKind.CommonJS, false],
    ["commonjs-import-helpers", ts.ModuleKind.CommonJS, true],
    ["esm-import-helpers", ts.ModuleKind.ESNext, true],
  ]) {
    const code = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES5, module, importHelpers,
        downlevelIteration: true, esModuleInterop: true },
    }).outputText;
    fs.writeFileSync(path.join(__dirname, `${name}.js`), code);
    for (const mangle of [false, true]) {
      const result = await terser.minify(code, { module: true, compress: { defaults: true, unused: false }, mangle, format: { comments: false } });
      fs.writeFileSync(path.join(__dirname, `${name}-${mangle ? "mangled" : "compressed"}.js`), result.code + "\n");
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
