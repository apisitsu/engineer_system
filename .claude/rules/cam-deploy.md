---
paths:
  - "nginx.conf"
  - "apps/ENG-Frontend/public/wasm/**"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/**"
---

# Shipping CAD/CAM to plbmp118 → plbmp130

The release flow itself is unchanged (`.\git_sync_mtc.ps1 "message"`: mtc → dev →
github main). What follows is only what this module adds on top, and the two
things that behave differently once it is on a real host.

## What must actually reach the host

| path | why it breaks without it |
|---|---|
| `apps/ENG-Frontend/public/wasm/planegcs.{js,wasm}` | the sketch solver loads both at runtime; they are **committed on purpose** — see `cam-web.md` |
| `apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/**` | the module (169 files) |
| `apps/ENG-Frontend/scripts/copy-cam-wasm.js` | `prebuild` keeps the two assets in step with the installed package |
| `package.json` + `package-lock.json` | three new runtime deps: `@salusoft89/planegcs`, `clipper-lib`, `comlink` |

`git_sync_mtc.ps1` stages with `git add .`, so all of it goes provided nothing is
ignored — verified with `git check-ignore`; `public/wasm/` is **not** ignored.

**`npm install` must run on each host before `npm run build`.** The three new
dependencies are imported by the bundle; without them the build fails outright
(it does not degrade). The vitest/jsdom devDependencies are not needed to build
and can be skipped by a production install.

## The apiUrl gate

`git_sync_mtc.ps1` refuses to touch main unless dev's `apiUrl` is `plbmp130`
(CLAUDE.md's prod-safety invariant). Checked for this release with
`git merge-tree --write-tree dev mtc`: the merge is clean and the merged
`constance.js` keeps `plbmp130`, so the gate passes with no manual step.

That result is specific to this state of the branches. Re-check it the same way
before any later release rather than assuming — it is one command and it reads
the real merge:

```bash
T=$(git merge-tree --write-tree dev mtc) && git show "$T:apps/ENG-Frontend/src/constance/constance.js" | grep -m1 '^export const apiUrl'
```

If it comes back `plbmp118`, fix `constance.js` on dev (`scripts/fix_constance_prod.ps1`)
and re-run — never force past the gate.

## nginx: `/wasm/` needs its own location

Added to `nginx.conf`. Two production-only failure modes it removes:

- **MIME.** `planegcs.js` is fetched by a dynamic `import()` inside a worker, and
  browsers reject a module script that is not served as JavaScript. `planegcs.wasm`
  wants `application/wasm` to stream-compile — a type nginx only ships in its
  `mime.types` from **1.21.1**. Both are declared explicitly so the module does not
  depend on the host nginx's vintage. (A wrong wasm type is survivable — the
  emscripten glue catches the streaming failure and falls back to
  `instantiateArrayBuffer` — but a wrong *JS* type is fatal.)
- **A missing file returning HTML.** The catch-all `location /` answers anything it
  cannot find with `index.html` and HTTP 200. A `wasm/` file absent from the deploy
  therefore arrives as HTML and shows up as `Unexpected token '<'` from the import,
  which points nowhere near the real cause. The dedicated location 404s instead.

Not immutable-cached deliberately: the two filenames carry no content hash, so a
`@salusoft89/planegcs` upgrade has to be able to reach browsers holding the old copy.

> The block was written against `nginx:stable-alpine` (what `apps/ENG-Frontend/Dockerfile`
> serves with) but **could not be syntax-checked here** — no docker on the dev box.
> Run `nginx -t` before reloading.

## The saved library (as of 2026-08-05: shared, server-side)

The library is no longer per-browser. It is the `cam_saved_work` table reached
through `/api/engineer/cam/library`, so every origin and every operator sees the
same one — that was the whole point of moving it off IndexedDB.

**The table already exists on the production database.** This repo's
`apps/ENG-Backend/.env` has `PG_NEW_HOST=plbmp130`, so running
`node db_migrations/run_cam_saved_work_migration.js` from the dev box created it
in **prod's** `eng_system`, not a local copy. Nothing further is needed at deploy
time — but re-run the migration on any host whose `PG_NEW_*` points somewhere
else, and be aware of the consequence below.

> **Dev and production share one library.** Because plbmp118's backend points at
> the same `eng_system` on plbmp130, anything saved from the dev site appears in
> the shop's library on plbmp130 immediately. That is convenient and also a
> footgun: test saves made while developing are visible to operators. Name test
> items obviously, and delete them when finished — there is no separate dev
> library to hide behind.

Carrying the *old* per-browser libraries in is a one-off, described in
`.claude/rules/cam-library-migration.md`: export from the origin that holds them
(usually `localhost:3100`), then upload once — the destination is the server, so
it does not have to be repeated per origin.

Two things that did not change:

- **`clearAll` wipes everyone's work now**, so `DELETE /library` is behind
  `isAdmin` and nothing in the UI calls it. Keep it that way.
- **A `.camweb.json` file on a shared drive is still the most durable form** of a
  setup (Sketch page → save project; drag the file back to reopen). The shared
  library is a real system of record now, but a file survives database restores,
  environment moves and this application entirely.
