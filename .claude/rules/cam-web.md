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

## Every colour comes from `cam/theme.js`

As of 2026-08-06 the module is a **light mechanical-CAD** scheme — the SolidWorks
/ CATIA tone: silver-gray chrome, white paper, one blue accent, and a viewport
that fades from slate blue to near-white. It was cam-web's dark slate palette,
hard-coded as ~130 hexes across a dozen files, and that is the state to keep it
out of. Three things follow:

- **Chrome imports `CAD`; the scene does not.** Panels, rails, text and the
  overlays that float on the viewport name a token. The `meshStandardMaterial`
  colours are *materials* — steel, brass, carbide — and stay literal.
- **`metal()` exists because there is no environment map.** A PBR metal has no
  diffuse colour, so at metalness 0.6–0.75 with nothing to reflect it renders
  near-black. That was invisible on the old dark viewport and is a brown smudge
  on the light one. All the machine's metal goes through `metal()`, which shades
  rather than simulates. Do not raise metalness back up without adding an
  environment — and drei's `<Environment>` fetches an HDR the hosts cannot reach.
- **Component tokens leak in from the app's provider.** Nested antd
  `ConfigProvider`s merge, and a `components.*` token from the outer one beats a
  `token.*` override in the inner one. EngineerSystem's `theme/getAntdTheme.js`
  sets `components.Button.colorPrimary` (platform green) and `controlHeight: 40`,
  so `CamPage.jsx` restates those per component. Deleting one of those lines does
  not fall back to the CAD palette — it falls back to the green platform theme.

Tests read the palette rather than re-typing its hexes (`SketchLayer.test.jsx`,
`PartMesh.test.jsx`): what they are for is that the right *state* gets the right
colour, and a literal would break them on every retheme without a bug in sight.

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

## The library: a private shelf per operator, plus one shared shelf

Saved work is the `cam_saved_work` table behind `/api/engineer/cam/library`,
reached through `lib/workApi.js`. **Every row sits on exactly one shelf**: the
operator's own empno, or `'~shared'` (`camConstants.SHARED_SHELF`), and
`(shelf, key)` is what is unique.

Two moves got here, and the second exists because the first overshot — both are
worth knowing, because a change that forgets either one re-creates a real bug.

1. It began as per-origin **IndexedDB** (`lib/workDb.js`). IndexedDB is scoped to
   scheme + host + **port**, so `localhost:3100` (standalone cam-web),
   `localhost:3000`, `plbmp118` and `plbmp130` each held a *separate* library.
   The first question after the import was "my files are gone" — they were on
   `:3100`. A setup somebody saved is what the next shift needs to open.
2. Moving it to a table made it **one library keyed by the client's own
   `'project/<name>'`**. Two people who both saved "OP10" were writing the same
   row, and the second silently replaced the first's work; anyone could delete
   anyone's. "Saving over a name replaces it" is fine about your own work and a
   trap when the namespace is the whole shop's.

So: **saving is always private**, and publishing is a separate, explicit act.

| rule | where it is enforced |
|---|---|
| a save lands on the caller's own shelf — there is no parameter for saving elsewhere | `camService.putRecord` (shelf comes from `req.user`, never the body) |
| `share` **moves** a row to `'~shared'`, and refuses if that would replace somebody else's published item | `camService.share`, in one transaction with `FOR UPDATE` |
| `unshare` returns a row to **its owner's** shelf, not the caller's | `camService.unshare` |
| delete needs the row to be yours, or the caller to be an admin | `camService.deleteRecord` |

- **Rows are addressed by `id`, not by `key`.** My "OP10" and the shared "OP10"
  are two rows, so a key in a URL no longer names one of them. `libraryStore`'s
  `open`/`remove`/`share`/`unshare` all take the id off the listed row.
- **The panel does not decide what you may do.** `listMeta` returns
  `canShare` / `canUnshare` / `canDelete` per row, computed next to the rules the
  write paths enforce. `LibraryPanel` renders buttons from those booleans. Do not
  re-derive them client-side — the two copies drift, and the direction it drifts
  is a button that looks available and then fails.
- **`isAdminUser`** (predicate, `middleware/mtcAuth.js`) exists for this: these
  are single routes with per-row rules, which a route-level `isAdmin` guard
  cannot express. Import it; do not re-derive "is an admin" in a handler.
- **`lib/workDb.js` is still on disk, and nothing in the running app imports it.**
  It is kept so the one-off export in `.claude/rules/cam-library-migration.md`
  has something to read. `libraryStore` imports `workApi`.
- **There is no availability gate.** IndexedDB had one (private browsing can
  refuse to open a database). A server-backed library cannot know in advance, so
  failures arrive as an error beside the button that caused them —
  `workApi.explain()` unwraps `response.data.message` so the server's *sentence*
  ("The shared library already has “OP10” from Somchai…") is what the operator
  reads, not "Request failed with status code 409".

Deployment — including the fact that **the migration and this code must land
together** — is in `.claude/rules/cam-deploy.md`.

## Verifying a re-sync

`npm run test:cam` + `npm run build` are necessary but not sufficient — per cam-web's
own CLAUDE.md the render and interaction layers have no automated coverage. Load
`/eng/mtc_eng/cam` and drive it. What the `c781b78` sync was checked against:

- sample program parses (Cycle time 1:04 · 355 segments) — exercises `gcode.worker`
- Simulate carves the part, round holes included — exercises `sim.worker`
- the library saves and **survives a full page reload** — exercises `lib/workApi.js`
  and the backend route behind it; the panel's `[data-library-item]` /
  `[data-library-save]` hooks make this scriptable. Delete the test item when
  done: the library is shared, and plbmp118 writes to the same table plbmp130
  reads
- the readout names the running tool (`T— Endmill Ø6 · N26 · F 100 mm/min`)
- the sketcher draws and the planegcs solver boots (see the wasm notes above)
