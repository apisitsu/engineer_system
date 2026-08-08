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

## Four invariants a plausible-looking change undoes (2026-08-07)

Each of these was a real complaint from the shop floor, and each has a tested
invariant behind it now. They read as arbitrary until you know what they fixed.

- **Only the insert may reach the cutting plane.** Lathe markers used to seat the
  insert exactly flush: rake face on Y=0, holder top face on Y=0, and the head's
  bevels lying *along* the insert's own edges. Three pairs of coplanar faces —
  the depth buffer cannot order them, so the tool flickered gold/grey as the view
  moved. `toolScale().standout` now drops each body below the plane and sets it
  back from the corner. Do not "tidy" the holder back onto Y=0, and do not put
  the marker trigonometry back into `Viewport.jsx`: it lived in both files, which
  is how a fix to `engine/view/latheTool.js` could leave the bug on screen.
- **Feed is posted in mm/min everywhere**, milling and turning alike — a lathe's
  programmed `F0.15` and a mill's `F850` in one field are not comparable
  quantities and the field never said which it held. The programmed per-rev
  figure survives as `droFeed().note` (and `turningSpeeds().feedPerMin` is the
  CAM panel's equivalent), because that is the only number checkable against the
  program text. **The posted G-code is unchanged — turning still posts G99 `fn`.**
- **`sim/stockColors.js` CUT and RAW must differ in hue, not brightness.** CUT was
  a near-white "bright steel", which is exactly what a strong light does to
  amber — so a machined face read as a lit face of raw stock and the pair stopped
  meaning anything. Cool blue-steel against amber cannot be confused by lighting.
- **Opening the library only lists the library.** It used to open with a name box
  pre-filled from a suggestion and a *Project* button beside it, so looking
  something up was one click from writing a record nobody named. Naming now
  happens in the save dialog, and nothing is written until it is confirmed.

## 2D → 3D: the sketch builds the part now (2026-08-08)

The sketcher used to end at DXF. It now makes solids, and they enter the CAM
pipeline through the door an imported STL uses. Five pieces, engine-first as
usual:

| file | what it is |
|---|---|
| `engine/sketch/loops.js` | closed regions of a sketch — outer boundary and its holes |
| `engine/sketch/plane.js` | the plane a sketch is drawn on (serializable data, not a matrix) |
| `engine/sketch/shapes.js` | slot and polygon — compound, not new entity kinds |
| `engine/sketch/dxfImport.js` | DXF → sketch, the other half of `dxf.js` |
| `engine/solid/triangulate.js` | ear clipping with hole bridging — the flat caps |
| `engine/solid/extrude.js` | extrude / revolve → triangle soup |
| `engine/solid/regionBoolean.js` | union / subtract / intersect on **profiles** |
| `engine/solid/featureTree.js` | the ordered operations, and the fold that replays them |
| `lib/csg.js` | boolean between **solids**, the one part that needs three.js |

**`camPlanStore.loadSoup` is why this was cheap.** `loadPart` always converted a
file to a triangle soup and everything after that point — measure, features,
slice, plan, simulate, post — worked on the soup alone. Splitting the soup half
out gave the sketcher a way in that needs no second pipeline. Anything else that
ever generates geometry should enter the same way; do not add a parallel path.

Four things here are load-bearing and read as arbitrary:

- **Chaining is topological, not by tolerance.** A sketch is point-based, so a
  shared corner *is* one point id — `sliceLoops` welds by distance only because a
  triangle soup has no ids to use. Coincident constraints and points sitting on
  top of each other are folded in with a union-find first.
- **Regions come from planar-face traversal**, not from following edges until
  one runs out. Arriving along a half-edge, take its reverse and step to the next
  half-edge **clockwise** around the vertex: that turns as sharply left as
  possible, so a bounded face comes out counter-clockwise and the single
  unbounded face comes out clockwise, which is how it is told apart and dropped
  (by the sign of its area). A line across a rectangle therefore gives two
  regions, as it does in any CAD. Departure angles are taken from the tessellated
  polyline's **first step**, not the chord between a curve's endpoints — where an
  arc meets a line the ordering has to follow the tangent, and the chord can
  point the other side of the line entirely. Dangling geometry is pruned first
  (iteratively — removing an edge can leave its neighbour hanging) and reported
  as `open`; `branches` is now information, not a refusal.
- **The hole seam is found by ray cast** (leftmost vertex, −x), not by searching
  vertex pairs for one that looks clear. Nothing of a hole lies left of its own
  leftmost point, so the seam cannot re-enter the hole — which a pair search
  does, producing a self-intersecting ring that ear clipping cannot detect and
  that quietly fills the bore back in.
- **The ear test is strictly-inside.** A bridged ring deliberately repeats the
  seam's endpoints; an "inside or on" test sees the duplicate on its own corner,
  blocks every ear, and the clipper falls back to dropping vertices.
- **`normalizeLoops` probes an `interiorPoint`, not a vertex.** Nesting decides
  solid from hole, and a vertex sits on its own boundary — so two loops touching
  at a corner had one become a pocket in the other. This fixed a latent bug in
  `sliceLoops` as well.

Winding is the contract throughout: **outer CCW, hole CW**, enforced by
`normalizeLoops` (shared with `sliceLoops`, deliberately one copy). Extrude wall
winding, Clipper's non-zero fill and the CAM planner all read it. `analyzeMesh`
warns about an inside-out solid, and the build tests assert it never fires.

**Prefer the profile boolean over the mesh one.** Clipper is exact and returns a
real boundary; a mesh boolean returns triangles that approximate one and every
later operation inherits that. `lib/csg.js` exists for what profiles cannot
express — cutting a pocket drawn on the front plane out of a part standing on the
table — and is `import()`ed on demand so the 31 kB library never loads for a
session that only draws and extrudes.

**Multi-sketch:** `sk` is the active document and is the *same object* as
`sketches[active].doc`, never a copy — edits mutate in place. Anything swapping
`sk` for a different document (undo, redo, clear, open) must go through
`_docs()`. Undo history is **per sketch** but only the active one's lives in
store state, because `past`/`future` are read all over the sketcher: the stacks
are stashed onto the entry being left and restored from the one being opened
(`_stash()`). They are deliberately **not** written to a project file — a stack
of whole documents, meaningless in a session that has not happened yet.

**Sketch on a face:** `planeFromFace` turns a picked face
(`camPlanStore.selectedFeature`) into a plane, and an *axis-aligned* face comes
back as the matching **preset with an offset** rather than a custom frame — so a
pocket floor 12 mm up reads "Top (XY) +12", keeps the machine's axes, and a
dimension typed on it means what it meant on the table. Only a genuinely angled
face becomes a custom frame, whose `u` is derived from the world axis *least*
aligned with the normal (crossing with a nearly-parallel one gives a vector of
almost no length, whose direction is noise).

**Slot and polygon are compound**, built from existing primitives plus the
constraints that keep them what they are (tangent flanks + equal caps; vertices
pinned to a construction circle + equal sides). That is the point: a new entity
kind would have to be taught to the solver bridge, the loop chainer, the DXF
writer *and* reader, the hit tests and the renderer before it could be drawn at
all. **This is why ellipse and spline are not here** — they are genuinely new
solver primitives, not compositions.

**DXF import welds endpoints, and that is the point.** A DXF carries no topology:
four lines round a rectangle are four independent coordinate pairs. `sketchLoops`
chains through shared point *ids*, so an import that made eight separate points
would produce a profile that looks closed, cannot chain, and refuses to extrude
for no visible reason. `$INSUNITS` is honoured too — a drawing that arrives 25.4×
too small is the kind of mistake that reaches the floor.

## The feature tree (2026-08-08)

The part is no longer the output of one build — it is **what replaying the tree
produces**. `featureStore.buildFromSketch` is the only way a solid gets made;
there is deliberately no one-shot path, because a build that left no feature
behind would mean the tree and the part disagreed the moment it was used.

- **`featureStore` is its own store** because a feature reads a *sketch* and
  produces the *part*: `featureStore → sketchStore` and `featureStore →
  camPlanStore`, neither of which learns about features. Putting the tree in
  either would have made the import cycle real — `sketchStore` already imports
  `camPlanStore`.
- **Topological naming is sidestepped, not solved.** Nothing names a face: a
  sketch placed on one stores the *resolved plane* (`planeFromFace`), which is
  numbers and cannot go stale. The price, stated rather than hidden: changing an
  early feature does **not** move a sketch placed on its face.
- **`loadSoup` takes `keepDatum` / `keepPage`.** Clearing the datum is right for
  an imported file and wrong for a rebuild — without it the operator loses
  X0/Y0/Z0 every time they change a dimension. Same for being thrown to the
  machine page while standing at the sketch they are editing.
- **Rebuild is a button.** A sketch drag emits a solve per frame; auto-rebuild
  would fire a CSG evaluation per frame with it. `dirty` is set by a subscription
  to `sketchStore.version` — subscribed inside `featureStore` so the sketcher
  still has no idea features exist.
- **A broken feature is skipped, not fatal.** Its message is recorded against it
  and the fold carries on, so one bad operation costs that operation and not the
  part. `buildFromSketch` removes a feature whose *own* first build failed rather
  than leaving a permanently broken entry.
- Imports go through **`featureStore.importPart`**, never `camPlanStore.loadPart`
  directly, or a file arrives with no history behind it.

Project files are **v4** (`features`), on top of v3's `sketches: { active,
items }`. v1/v2/v3 all still open — an older file simply has no tree, which is
exactly what it had.

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
