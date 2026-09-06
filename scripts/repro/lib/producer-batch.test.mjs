import assert from "node:assert/strict";
import test from "node:test";
import { swcBatch } from "./runner.mjs";

test("concurrent SWC minifier profiles retain their external-helper setting", async () => {
  const source = "export async function load(value) { return await value; }";
  const options = externalHelpers => ({ minify: true, externalHelpers });
  const external = (await swcBatch([source], options(true))).get(source);
  const inline = (await swcBatch([source], options(false))).get(source);
  assert.match(external, /@swc\/helpers/);
  assert.doesNotMatch(inline, /@swc\/helpers/);

  for (const order of [[true, false], [false, true]]) {
    const outputs = await Promise.all(order.map(value => swcBatch([source], options(value))));
    for (let i = 0; i < order.length; i++) {
      assert.equal(outputs[i].get(source), order[i] ? external : inline);
    }
  }
});
