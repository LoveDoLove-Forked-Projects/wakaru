# tslib Helper Matrix

This matrix tests one cross-cutting dimension: whether helper recovery works
when TypeScript keeps helpers inline, loads a tslib namespace with CommonJS,
or emits named ESM imports. The feature-specific matrices continue to cover
larger syntax/control-flow combinations. This matrix deliberately uses small
module sources so helper delivery differences can be compared in one report.

## Producer profiles

TypeScript is pinned to **5.9.3**. Every profile enables `downlevelIteration`
and `esModuleInterop`, and selects one helper delivery mode:

| Profile | Module output | importHelpers | Helper shape |
|---|---|---|---|
| `commonjs-inline` | CommonJS | false | Inline implementation; control case |
| `commonjs-import-helpers` | CommonJS | true | `tslib_1.__helper(...)` |
| `esm-import-helpers` | ESNext | true | `import { __helper } from "tslib"` |

These are actual `ts.transpileModule` outputs, not rewritten helper spellings.
Each profile runs raw, through Terser compression, and through compression plus
name mangling. Mangled ESM imports also test renamed helper aliases. Compiler
packages use the existing `target/repro-tools/` cache and refresh mechanism.

Every source is a module. Adding `importHelpers: true` to a script-only
profile would silently retain inline helpers and miss the namespace bug.
ES5 covers generator state machines, object/array operations, inheritance,
iteration, interop, and tagged templates. Async functions also target ES2015
to cover awaiters wrapping native generators. Private fields target ES2015,
since TypeScript does not support lowering them to ES5. Interop snippets only
run in CommonJS profiles: an ESM-to-ESM pass would not produce an interop helper.

## Comparison and known gaps

The matrix compares the **complete module** with the modern source or an
explicit `acceptForms` alternative, using the shared `debug normalize --rename`
comparison. This applies to raw output too: tsc itself renames provider imports.
The local comparison adapter canonicalizes `export function f` and
`function f; export { f }` to the same export spelling/placement. Public export
names, other imports, declarations, expressions, and side effects still need
to match. It accepts destructuring moved into a parameter via explicit alternate
forms; it does not accept unrecovered indexing as equivalent destructuring.

The compiler-injected tslib import declarations from recovered output are
included in the expected module as well. This allows unused helper imports
that Wakaru preserves after recovery. It does **not** strip helper calls or
helper declarations. Thus `async function` containing a leftover helper call,
`yield* tslib.__values(items)`, a missing export, and an extra side effect still
fail. Tests cover these false-positive boundaries.

This measures structural source recovery, not execution equivalence or tslib
runtime compatibility. The script-only execution harness cannot run these
modules; no `execute` check is claimed. The matrix does not install or execute
tslib itself. Runtime behavior tests remain separate from this recovery score.

The initial baseline has **72 yes / 39 no / 0 errors across 111 distinct
shapes**. The `no` rows are intentional recorded gaps, not skipped tests:

- Generator delegation leaves namespace `__values` calls behind.
- Tagged templates miss namespace calls and mangled named aliases.
- External private-field helpers remain; mangled inline helpers also remain.
- Compressed object-rest and array-destructuring cases do not fully recover.
- Inheritance recovery retains its IIFE when members still capture the
  superclass parameter; full superclass recovery remains incomplete.
- Some current inline interop helper bodies are not recognized.

The original tslib awaiter regression passes all 18 ES5/ES2015 profiles.
Fixes should turn their failing shapes into `yes`; regenerate `stats.json`
and its README/website aggregate when measured numbers change. A falling
aggregate after adding challenge rows does not mean existing recovery regressed.

## Boundaries

These cases belong in focused rule tests or separate compiler reproductions:

- Authored `import * as tslib` and direct `require("tslib").helper(...)` calls.
  This TypeScript configuration emits CommonJS namespaces or named ESM imports,
  not those exact spellings; relabeling an edited output as tsc output would hide
  its provenance.
- Mixed SWC/Babel async wrappers containing tslib generator calls, until a
  concrete multi-stage compiler profile reproduces them.
- Shadowed bindings, `with`, wrong helper sources, unsupported state-machine
  shapes, and rollback behavior: these are rule safety boundaries.
- Bundled tslib provider facts and webpack entry extraction: these need the
  unpack pipeline rather than single-file helper recovery.

## Running

From the repository root, with a CLI built from this checkout:

```bash
WAKARU="$PWD/target/debug/wakaru" node scripts/repro/tslib-helpers-matrix/matrix.mjs --details
WAKARU="$PWD/target/debug/wakaru" node scripts/repro/tslib-helpers-matrix/matrix.mjs --snippet tagged-template --json
WAKARU="$PWD/target/debug/wakaru" node scripts/repro/tslib-helpers-matrix/matrix.mjs --dump generator-delegation commonjs-import-helpers
WAKARU="$PWD/target/debug/wakaru" node --test scripts/repro/lib/tsc-batch.test.mjs scripts/repro/tslib-helpers-matrix/compare.test.mjs
WAKARU="$PWD/target/debug/wakaru" node scripts/repro/collect-stats.mjs --check --jobs 2
```

The matrix is included in the aggregate collector and Repro Stats CI.
`--check` compares the recorded success/failure counts with a fresh run; it does
not require every known gap to be fixed. It is a count baseline, not a per-row
lockfile: equal-count swaps can escape that check, so inspect `--json` or
`--details` when changing helper recovery.
