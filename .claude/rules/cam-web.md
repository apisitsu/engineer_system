---
paths:
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/**"
  - "apps/ENG-Frontend/public/wasm/**"
  - "apps/ENG-Frontend/scripts/copy-cam-wasm.js"
  - "apps/ENG-Frontend/vitest.config.js"
---

# CAD/CAM (`mtc_eng/cam`) — imported from cam-web

Browser CAD/CAM: G-code parse + backplot, material-removal simulation (dexel /
voxel / turning), STL→toolpath planning, and a constraint-solved 2D sketcher.
Route `MTC_PATHS.CAM` → `/eng/mtc_eng/cam`, sidebar entry "CAD/CAM".

## This is now the only copy — develop it here

`cam/` began as a vendored copy of the standalone **cam-web** project
(`C:\User DATA\Projects\cam-web`), imported at `a2a5775` and re-synced from
`c781b78`. **That is history: as of 2026-08-05 this folder is the source of
truth and all CAD/CAM work happens here, on `mtc`.** cam-web is the archived
origin — do not develop there and re-sync, and do not treat anything here as
"must stay verbatim".

What survives from that arrangement is the *reasoning*: the notes below explain
why several files look the way they do, and they are still load-bearing
constraints of building under CRA — not stylistic choices to tidy away.

Keep cam-web's house style, because the code is written to it and the tests
depend on it: engine-first (pure logic in `engine/`, tested, then store, then
view), and toolbar buttons are glyphs from a command catalogue (`engine/view/commands.js`),
never labelled buttons. Its `CLAUDE.md` is still the best statement of that.

> If a future re-sync ever does happen, copy from `git archive <commit>`, never
> from cam-web's working tree — that tree is usually mid-feature, and a `cp -r`
> during the first import picked up a half-finished feature plus files that
> changed under it mid-copy. Verify by hashing every file against the snapshot: a
> corrupted copy is not always a visible one (a `\n` escape that became a real
> CRLF kept the byte count identical and only surfaced as a parse error).

## Four things CRA forces — do not "fix" them back

cam-web was built by **vite**; ENG-Frontend is **CRA/webpack**. These four look
like odd choices and are not: each one is the only way the file builds here.
Reverting any of them breaks the production build, so leave them alone unless
you are replacing the bundler.

| File | Change | Why |
|---|---|---|
| `workers/sketch.worker.js` | `import wasm from '…planegcs.wasm?url'` → loads `/wasm/planegcs.{js,wasm}` at runtime | webpack has no `?url`, and it **fails outright** on the emscripten glue: the glue's dead Node branch has `new URL('./', import.meta.url)`, which webpack resolves at build time → `Can't resolve './'`. The glue is served as a static asset and imported with `/* webpackIgnore: true */` so webpack never parses it. |
| `engine/sketch/planegcs.js` | imports `enums.js` / `gcs_wrapper.js` by exact path, not the package root; `createSolver` takes an injected `initModule` | The package root statically imports that same glue. Injection keeps this a pure module — the worker and the Node checks resolve the loader differently. |
| `engine/gcode/macro.js` → `macros.js` | renamed | CRA's babel preset always loads `babel-plugin-macros`, which claims any import matching `/[./]macro(\.c?js)?$/` as a *babel* macro and fails the build demanding `createMacro()`. This one is Fanuc's macro, not babel's. |
| `engine/sketch/annotations.js` | one import hoisted above the body | CRA's eslint makes `import/first` a build **error**; vite doesn't care. |

Also note: CRA's eslint config **restricts `self` and does not define
`globalThis`**, so neither can be used to build an absolute asset URL inside a
worker. Root-relative `/wasm/...` is correct here because webpack serves the
worker from this origin — but a worker created from a `blob:` URL would have no
base to resolve it against.

## The wasm is committed, and also copied on every build

`public/wasm/planegcs.{js,wasm}` are **tracked in git**. Deploys are git-based
(`mtc` → `dev` → `main`), so a build step is not the only thing that has to work
for a runtime asset to exist on prod — see the gitignored-artifacts rule in
`backend-gotchas.md`. `scripts/copy-cam-wasm.js` (run from
`predev`/`prestart`/`prebuild`) re-copies them from node_modules and only writes
when the bytes differ, so they cannot go stale when `@salusoft89/planegcs` is
upgraded. **If it prints "commit it", commit it.**

## Tests: two runners, disjoint file sets

The 70 CAM test files (1866 tests as of `c781b78`) are **vitest**, and stay that way —
they use per-file `@vitest-environment jsdom` pragmas and `@react-three/test-renderer`.
A re-sync should leave them all green; that suite passing is the main signal the copy
landed intact.

- `npm run test:cam` (in `apps/ENG-Frontend`) — vitest, `vitest.config.js`, only
  `mtc_eng/cam/**`.
- `npm test` — CRA jest, with `testMatch` in package.json overridden by
  `"!**/mtc_eng/cam/**"` so it does not try to run them. (`testPathIgnorePatterns`
  is *not* one of the jest keys CRA lets you override; `testMatch` is.)
- `node --test engine/sketch/planegcs_check.mjs` — the real WASM solver end to
  end. `*_check.mjs` scripts are cam-web's convention for solver/WASM-level
  checks and are not picked up by either runner.

`testTimeout` is raised to 30s in `vitest.config.js`: a few of these are real
compute (the runaway-macro guard expands a program until it trips) and time out
under the full suite's parallelism while passing in isolation.

## Bundle

The route is the **only** `React.lazy` import in `App.jsx` — the CAM engine is a
~94 kB gzip chunk that nobody visiting Tooling Inspection should download. Keep
it lazy; `main.js` grows only ~10 kB from this whole module.

## The library is per-origin, and that surprises people

Saved work (`lib/workDb.js`) lives in IndexedDB, which the browser scopes to an
**origin** — scheme + host + **port**. So `localhost:3100` (standalone cam-web),
`localhost:3000` (CRA dev), `plbmp118` and `plbmp130` each hold a *separate*
library, and work saved in one is invisible from the others. The first question
after this import was "my files are gone" — they were not; they were still on
`:3100`. There is no export/import in the UI, so moving them is a manual step:
`.claude/rules/cam-library-migration.md` has the two verified console snippets.

Two things to know before writing any code against that database:

- **Both stores use an inline key** (`createObjectStore(store, { keyPath: 'key' })`),
  so records go in as `put(value)` with **no** second argument. Passing an explicit
  key throws `DataError`.
- **Never `indexedDB.open('cam-web', 1)` just to look.** Opening a database that
  does not exist *creates* it — empty, at version 1 — and since the app also opens
  at version 1, its `onupgradeneeded` would then never fire and it could never
  create its stores. That bricks the library on that origin. Check
  `(await indexedDB.databases()).map(d => d.name)` first.

## Verifying a re-sync

`npm run test:cam` + `npm run build` are necessary but not sufficient — per cam-web's
own CLAUDE.md the render and interaction layers have no automated coverage. Load
`/eng/mtc_eng/cam` and drive it. What the `c781b78` sync was checked against:

- sample program parses (Cycle time 1:04 · 355 segments) — exercises `gcode.worker`
- Simulate carves the part, round holes included — exercises `sim.worker`
- the library saves and **survives a full page reload** — exercises `lib/workDb.js`
  (IndexedDB); the panel's `[data-library-item]` / `[data-library-save]` hooks make
  this scriptable
- the readout names the running tool (`T— Endmill Ø6 · N26 · F 100 mm/min`)
- the sketcher draws and the planegcs solver boots (see the wasm notes above)
