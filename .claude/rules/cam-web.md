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

## This is the source of truth — develop it here

`cam/` began as a vendored copy of the standalone **cam-web** project
(`C:\User DATA\Projects\cam-web`), imported at `a2a5775` and re-synced from
`c781b78`. **As of 2026-08-05 this folder is the source of truth and all CAD/CAM
work happens here, on `mtc`.** Do not develop in cam-web and pull changes back,
and do not treat anything here as "must stay verbatim".

> **Update 2026-09-06:** cam-web is no longer archived. It was revived as a
> maintained standalone app, kept level with this folder, and the sync direction
> is **EngineerSystem → cam-web** (first re-sync on cam-web branch
> `resync-from-eng`). The files that deliberately differ there (vite `?url`
> worker/solver loaders, `100vh` App, offline IndexedDB `workApi.js`) are listed
> in the `cam-web-resync` memory note — a naive wholesale copy breaks them.
> cam-web's own CLAUDE.md still describes the old vendor-in direction.

What survives from that arrangement is the *reasoning*: the notes below explain
why several files look the way they do, and they are still load-bearing
constraints of building under CRA — not stylistic choices to tidy away.

Keep cam-web's house style, because the code is written to it and the tests
depend on it: engine-first (pure logic in `engine/`, tested, then store, then
view), and toolbar buttons are glyphs from a command catalogue (`engine/view/commands.js`),
never labelled buttons. Its `CLAUDE.md` is still the best statement of that.

## Name and window chrome (2026-11-06)

**The module is called "Basic CAM Lite"** (renamed 2026-11-10 from "Engineer CAM
Lite", before that "Engineer CAD/CAM"): it is a
shop-floor aid — open and check G-code, backplot and simulate the cut, check
standard cutting speeds, sketch simple parts — not a full CAM system like Mastercam
or SolidCAM (fillet/chamfer only on straight edges and axis-aligned round rims —
see `engine/solid/edgeTreat.js`; no variable fillet, assemblies, STEP, ellipse/spline). The name is in five
places: the header in `App.jsx`, `MenuBar.jsx` (About), `ToolGallery.jsx`,
`home_overall.jsx` and the sidebar entry in `menu_sidebar.jsx`. The route, folder
and `MTC_PATHS.CAM` keep their names.

A SolidWorks-style window is being built in stages (`docs/cadcam_layout_mockup.html`
is the agreed layout — open it in a browser). **Done:** feature-tree icons per row
(`TreeIcons.jsx`; a sketch that follows a face shows the link icon; `inverse` icons
on the selected row, which is drawn on the accent colour) and a **status bar**
(`StatusBar.jsx`, docked after the working area in `App.jsx`). The status bar shows
only values the app really holds — what is being edited, what is selected, tree
up-to-date — never placeholder coordinates. The Insert menu and command search are in
`MenuBar.jsx`, with the app name on the same row. The **Ribbon** is `CommandRibbon.jsx`:
tabs Features / Sketch / Mill / Turn, with the Sketch tab's buttons portalled in from
`SketchToolbar`. The rule in `engine/view/commands.js` still holds for the rails —
glyphs named on hover — and the Ribbon is the agreed exception: **buttons on the Ribbon
carry a label under the glyph**. It holds only commands that exist, so the mockup's
Fillet, Pattern, G71, Billet and the rest stay out until they do, and the *Evaluate*
tab (Measure, Section, Check part) is not built until there is something real to put
in it. **Project saving, opening, DXF and the library are in the File menu, not the
Ribbon** — the operator's decision, 2026-11-07, overriding the mockup's Sketch tab.
The **view toolbar** (`data-cam-hud`, top centre of the viewport) holds framing and the
show/hide toggles; the bottom rail holds playback, which the mockup has no place for.
`WorkspaceTabs.jsx` under the viewport only reaches panels that already exist, and is
the one switch for the left column's Model and Program panes.
The mockup's Zoom to area, Section view and Display style are not built.

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
| `lib/manifoldLoader.js` | cam-web: `import 'manifold-3d'` + `manifold.wasm?url`; here: imports `/wasm/manifold.js` with `webpackIgnore`, or `public/wasm/manifold.js` off the disk under Node (`test:cam`, cwd = apps/ENG-Frontend) | Same glue problem as planegcs. And manifold-3d is **not an npm dependency here**: the package drags in ~50 others (gltf-transform, sharp) for its CLI; only `manifold.{js,wasm}` are needed. |
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

`public/wasm/manifold.{js,wasm}` (v3.5.4, Apache-2.0 — `manifold.LICENSE.txt`) are
committed **by hand** and are not refreshed by `copy-cam-wasm.js`: there is no
package to copy from. They are the solid boolean (`lib/csg.js`) — closed results,
exact on touching faces; three-bvh-csg remains only as the fallback for a mesh that
is not closed. To upgrade, copy both files from a newer `manifold-3d`.

## Tests: two runners, disjoint file sets

The CAM tests — 127 files / 2880 tests as of 2026-11-06 (118 `*.test.*` files plus 9
`*_check.mjs`; it was 70 files / 1866 tests at `c781b78`) — are **vitest**, and stay that way —
they use per-file `@vitest-environment jsdom` pragmas and `@react-three/test-renderer`.
A re-sync should leave them all green; that suite passing is the main signal the copy
landed intact.

- `npm run test:cam` (in `apps/ENG-Frontend`) — vitest, `vitest.config.js`, only
  `mtc_eng/cam/**`.
- `npm test` — CRA jest, with `testMatch` in package.json overridden by
  `"!**/mtc_eng/cam/**"` so it does not try to run them. (`testPathIgnorePatterns`
  is *not* one of the jest keys CRA lets you override; `testMatch` is.)
- `*_check.mjs` — cam-web's convention for solver/WASM/engine-level checks (the
  real planegcs WASM solver end to end, the interpreter, the carvers). They are
  written against `node:test` and **are run by `npm run test:cam`**: `vitest.config.js`
  includes them and aliases `node:test` to `vitest`. They still run alone with
  `node --test <file>`. Before 2026-11-06 *no* runner picked them up, and one
  (`sim/_node_check.mjs`, drill `cutter`) had silently gone stale when drills gained
  a shape in `cam/cutters.js`. `engine/cam/cam_check.mjs` is the exception: a demo
  that writes sample `.nc`/`.stl` into `./nc_program/` (untracked — delete it after
  running), so it is excluded.

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

## The viewport rail is the run surface; the drawer is the setup surface (2026-08-14)

Setup is a **drawer**, and a drawer covers the viewport. So the split is not
cosmetic: anything pressed or read *while looking at the cut* has to be on the
rail, or using it means opening a panel over the thing it is about.

Since 2026-11-07 "on screen" means three places, one job each, and a command sits in
only one of them: the **Ribbon** for what is done to the job (Setup, Parse, Simulate,
Post), the **view toolbar** for framing and what is drawn, the **bottom rail** for
playback alone. The rule below still decides what stays out of the drawer. Simulate left
the toggles' side for the Ribbon, per the agreed mockup: that is a short reach across
the top of the viewport, not the crossing of the screen the rule was written against.
The menu bar repeats Ribbon commands on purpose: it is the text door, and search reads it.

| on screen | in the drawer |
|---|---|
| Parse — pressed after every edit, and it redraws the backplot | Open file — how a program *arrives*, once |
| Simulate — **milling and turning both** | the grid sizes it is judged AT (height-field cell, voxel edge) |
| the show/hide toggles (part, arbor, toolpath) | the voxel run — the deliberate second opinion, not the mid-job press |
| Cycle time · Cutting length · Rapid · Segments (top-left, `data-cam-overlay="stats"`) | machine settings, tool table, stock, warnings |

Turning's Simulate was the last one still in the drawer, which made the lathe the
one mode where carving the bar and then dropping the backplot to look at it
crossed the whole screen. It is now the same button in the same place, differing
only in glyph — `App.test.jsx` asserts both sit exactly one position from
`showToolpath`.

The four figures moved out of the sidebar for the same reason and are formatted by
**`engine/view/programStats.js`** (pure, tested) rather than in JSX. Two
consequences worth knowing:

- **`'stats'` is gone from `SECTIONS`** in `engine/view/sidebar.js`. That list is
  checked against App.jsx by `sidebar.test.js` in both directions, so a name left
  behind for a block that no longer exists fails the suite rather than rotting.
- **They survive playback**, unlike the sidebar block, because the rail does and
  cycle time is what the bottom bar's elapsed clock is measured against.

`formatDuration` lives in that module too — it was a local in App.jsx and the
bottom bar still uses it, so a second copy would drift silently.

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
- **Topological naming is sidestepped, not solved — but axis-aligned faces now
  follow (2026-11-06).** Nothing names a face by index: a sketch placed on one
  stores the *resolved plane* (`planeFromFace`), which is numbers. When that face
  is an axis-aligned **end of one feature's own solid** (top of an extrude, floor
  of a pocket), the plane also carries `ref: { featureId, axis, side }`
  (`linkFaceToSolids`, made by `featureStore.sketchOnFace` — the panel calls that,
  not the sketcher's, because the sketcher cannot know about features). Each
  rebuild re-resolves it against that feature's bounds (`resolvePlaneRef`) and
  writes the moved plane back onto the sketch, so editing the feature's depth
  moves the sketch and anything built on it. Three rules: a **cut's** faces point
  the other way (a pocket floor is the *min* end of the tool that carved it); the
  link is ignored — numbers stand — if its feature is suppressed, failed, or comes
  *later* in the tree; and a sketch a feature already built from is resolved at
  that moment, not again after. **The picked face must be taken back to the raw frame
before the plane is made OR the link is compared** (`faceToRawFrame` in
`engine/mesh/datum.js`, reached via `camPlanStore.faceInRawFrame`; passed to the
sketcher as `sketchOnFace({ face })`): a face comes off the *displayed* mesh — laid
down, datum-shifted — while feature solids, and the sketch itself, live in the raw
frame (the Sketch page does not draw the part at all). Before 2026-11-06 the plane
came from the displayed face and was only right while the frames agreed: with the
base at 30 mm the lay-down put another face down, and the face that reads as "top"
on screen is really the solid's x = −10.4 wall, so the old plane was `Top (XY) −10.4`
— below the whole part — instead of `Right (YZ) −10.4`. Seen in the live app: a
20×56×10 extrude is displayed quarter-turned about Z (x′=y, y′=−x), and after a
rebuild to 30 mm it was laid down on a different face entirely (part size `[56,35,20]`);
compared unconverted, no face ever matched. Unit tests could not show this — they
share one frame by construction — so re-check face links in the browser, not only in
vitest. Still NOT followed: angled faces, and faces that
  are not a bounding-box end (e.g. a boss side wall). `ref` is an additive field
  of the plane, so project files need no version bump and old ones open as before.
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

## The program listing draws a window, not the program (2026-08-10)

`GcodePanel` renders only the rows on screen plus a few either side, from
`engine/view/listing.js`. It is not an optimisation looking for a problem: the
panel used to render **every line of the program**, and playback re-renders it 25
times a second. Measured in Chrome on a 6,000-line program with the removal sim
carving along: **~250 ms of main thread per frame with the listing on screen,
~80 ms with it hidden.** The UI ran at about four frames a second, playback fell
to less than half its own speed setting, and the highlight lurched ~50 lines at a
time — which is what reached the floor as *"the highlight doesn't follow what is
actually running."* Single-stepping never showed it, because one update has
nothing to keep up with. After: ~50 ms, and a 100 % run finishes in the 6 s the
speed setting says it should.

Three things it rests on, none of them obvious from the file:

- **Every row is exactly `LINE_H` tall**, set as an explicit `height`. The window
  is row index × row height, so a row that sizes itself to its font puts the
  highlight on the wrong line. The two pad divs above and below are what keep the
  scrollbar the whole program's length.
- **Following the playhead writes `scrollTop`, never `scrollIntoView`** — which
  forces a synchronous layout of the whole box, on every tick. `followScrollTop`
  returns `null` for a line already in view, which is the common case and is what
  stops the panel taking itself away from an operator who is reading it. A jump of
  more than a screenful centres instead of scrolling minimally: a slider drag that
  lands the running line hard against an edge shows none of what comes next.
- **A `clientHeight` of 0 is refused, not believed.** It means "not laid out" far
  more often than it means a zero-tall panel — it is what every environment
  without layout reports — and believing it renders a blank listing. That is a
  real regression, not a hypothetical: it failed `App.test.jsx`'s "pressing play
  shows the program" the first time round.

The panel fills its column for the same reason it is virtualised at all: while a
program runs the listing is the one live thing on screen, and the 320 px box it
used to sit in left two thirds of the column empty under it. `LeftColumn`'s
program pane is therefore `overflow: hidden` — the listing has to be the element
whose height is the panel's and whose `scrollTop` means a position in the
program, and a second scroller around it takes both away.

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

## Standard cutting speeds (Tools ▸ Standard cutting speeds…, 2026-11-02/03)

On opening an NC file the module finds the material (file name, then a `(MATERIAL: …)`
header comment), reads each tool's Vc and feed, and offers to rewrite the *editor text*
to the shop's standard Vc table; the operator confirms, and Tools ▸ Restore program
undoes it. Pure logic is `engine/cam/stdVc.js`, sequencing is `stores/stdStore.js`, the
dialogs are `StdVcDialog` (check) and `StdEditorDialog` (edit the table).

- **The table is in the database**: `cam_std_material` + `cam_std_vc`, behind
  `GET/PUT /api/engineer/cam/std-vc`. Operations: turning, milling, drilling, reaming,
  tap, parting, grooving, centre. Threading deliberately has **no** figure.
- **Both migrations are ALREADY APPLIED to the shared (prod) database** — 2026-11-02
  (`20261102_create_cam_std_vc.js`) and 2026-11-03 (`20261103_extend_cam_std_vc_ops.js`, which
  widens the operation CHECK). The code that reads them is not on plbmp118/130 until released;
  the client treats a missing table or route as "no standard" and stays silent.
- **Every figure is `draft`.** The five original ranges are the shop's Vc_Table_Internal; parting/
  grooving come from a Haas HU30 insert chart (VDI 3323 groups N/M), centre drill from HSS-E
  Hoffmann/Hommel datasheets. None is verified; an administrator marks a material `approved`.
- **Program type comes from the text, not the CAM tab** (`detectProgramMode`: G96, G50, T0101
  → lathe; M6, G43 → mill), with a Program type dropdown to override. The tab is just the last
  thing the operator clicked; trusting it read a lathe file as milling and priced it at ten hours.
- Out-of-range → the **lower bound**; rpm is capped (mill 8000, lathe 2200 or the machine's),
  so some rows say "Spindle limit". Mill feeds scale with S, lathe feed/rev is untouched.
- `parseToolTable` files grooving under type `parting`, so `operationOf` decides from the words.
- Drei `<Html>` labels need an explicit `zIndexRange`: the default (~16.7M) floats above antd modals.

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
