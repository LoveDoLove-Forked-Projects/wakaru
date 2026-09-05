#!/usr/bin/env node

import { batchRunner, runMatrix, tscBatch, withTerserVariants } from "../lib/runner.mjs";
import { validateModuleRecovery, prewarmModuleRecovery } from "./compare.mjs";

// Each source is a module: importHelpers has no effect on script inputs.
// Use actual compiler output, including real named imports vs CJS namespaces.
const snippets = [
  {
    name: "async-await",
    source: "export async function load(value) { return await value; }",
    targets: ["ES5", "ES2015"],
  },
  {
    name: "generator-delegation",
    source: "export function* values(items) { yield* items; }",
  },
  {
    name: "object-assign",
    source: "export function copy(obj) { return { ...obj, x: 1 }; }",
  },
  {
    name: "object-rest",
    source: "export function rest(obj) { const {x, ...tail} = obj; return tail; }",
    acceptForms: ["export function rest({x, ...tail}) { return tail; }"],
  },
  {
    name: "array-read",
    source: "export function read(items) { const [a, b] = items; return a + b; }",
    acceptForms: ["export function read([a, b]) { return a + b; }"],
  },
  {
    name: "array-spread",
    source: "export function spread(items) { return [...items]; }",
  },
  {
    name: "class-extends",
    source: "export class Child extends Parent { value() { return super.value() + 1; } }",
  },
  {
    name: "for-of-values",
    source: "export function visit(items) { for (const item of items) { consume(item); } }",
  },
  {
    name: "import-default",
    source: "import fn from './provider.js'; export function run() { return fn(); }",
    transformerFilter: ({ name }) => name.includes("commonjs"),
  },
  {
    name: "import-star",
    source: "import * as provider from './provider.js'; export function run() { return provider.value; }",
    transformerFilter: ({ name }) => name.includes("commonjs"),
  },
  {
    name: "tagged-template",
    source: "export function template(name) { return tag`hello ${name}`; }",
  },
  {
    name: "private-field",
    source: "export class Foo { #x = 1; getX() { return this.#x; } setX(value) { this.#x = value; } }",
    targets: ["ES2015"],
  },
];

const transformers = [];
for (const target of ["ES5", "ES2015"]) {
  const sources = snippets.filter((s) => (s.targets ?? ["ES5"]).includes(target)).map((s) => s.source);
  for (const { label, module, importHelpers } of [
    { label: "commonjs-inline", module: "CommonJS", importHelpers: false },
    { label: "commonjs-import-helpers", module: "CommonJS", importHelpers: true },
    { label: "esm-import-helpers", module: "ESNext", importHelpers: true },
  ]) {
    transformers.push(...withTerserVariants(
      `tsc-5.9.3-${target.toLowerCase()}-${label}`,
      sources,
      batchRunner(() => tscBatch(sources, {
        version: "5.9.3", target, module, importHelpers,
        downlevelIteration: true, esModuleInterop: true,
      })),
    ));
  }
}

runMatrix({
  name: "tslib-helpers",
  snippets: snippets.map(({ targets = ["ES5"], transformerFilter, ...snippet }) => ({
    ...snippet,
    transformerFilter: (tool) => targets.some((target) => tool.name.includes(`-${target.toLowerCase()}-`))
      && (!transformerFilter || transformerFilter(tool)),
  })),
  transformers,
  // Use the shared alpha-renaming comparison for every row, including raw
  // output: tsc itself renames imports, and CJS recovery moves export syntax.
  validateRecovered: validateModuleRecovery,
  prewarm: prewarmModuleRecovery,
});
