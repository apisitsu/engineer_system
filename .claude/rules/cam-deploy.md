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
| `package.json` + `package-lock.json` | five runtime deps: `@salusoft89/planegcs`, `clipper-lib`, `comlink`, and (2026-08-08) `three-bvh-csg`, `three-mesh-bvh` |

`git_sync_mtc.ps1` stages with `git add .`, so all of it goes provided nothing is
ignored — verified with `git check-ignore`; `public/wasm/` is **not** ignored.

**`npm install` must run on each host before `npm run build`.** The runtime
dependencies are imported by the bundle; without them the build fails outright
(it does not degrade). The vitest/jsdom devDependencies are not needed to build
and can be skipped by a production install.

> **`three-bvh-csg` / `three-mesh-bvh` were added 2026-08-08** for the solid
> boolean the sketcher's Build panel offers, so a host that has built this module
> before still needs a fresh `npm install`. Both are peer-dependent on `three`,
> which is already here at 0.184 and satisfies them. They land in their own lazy
> chunk (~31 kB gzip) because `lib/csg.js` is `import()`ed on demand — a session
> that never presses Cut never downloads it.

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

## The saved library (as of 2026-08-06: a private shelf per operator)

The library is the `cam_saved_work` table reached through
`/api/engineer/cam/library`. Saving is **private** to the operator who saved it;
publishing to the shelf everybody sees is an explicit Share. The rules and why
they are shaped that way are in `.claude/rules/cam-web.md`.

> ### ⚠ The migration is ALREADY APPLIED — the code is what is now outstanding
>
> **Applied 2026-08-06** to `eng_system` on plbmp130, deliberately and with the
> operator's agreement, while the table held one row. Do not run it looking for
> something to do; it is done, and it is idempotent anyway.
>
> The consequence is live right now: **saving from plbmp118 and plbmp130 fails
> until this branch is deployed.** `db_migrations/cam_saved_work.sql` replaced
> the primary key — `key` became `id`, with `(shelf, key)` unique instead — and
> the backend still running on both hosts upserts with `ON CONFLICT (key)`,
> which no longer resolves. Reading, opening and deleting are unaffected; only
> the write path is. Ship `mtc` → `dev` → `main` and restart PM2 to close it.
>
> Both directions of the ordering hurt, which is why they must land together:
> migration first breaks saving (where we are), code first fails the other way
> (`ON CONFLICT (shelf, key)` against an index that does not exist yet). For any
> *future* change to this table, deploy the code first, then migrate, then
> restart — or take the app down for the minute it takes.

Run it with `node db_migrations/run_cam_saved_work_migration.js`. Every statement
is idempotent (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`,
`CREATE ... IF NOT EXISTS`), so it is safe to re-run and safe against either
shape of the table.

**Mind whose database you are pointing at.** This repo's `apps/ENG-Backend/.env`
has `PG_NEW_HOST=plbmp130`, so running that script *from the dev box* migrates
**production**, not a local copy. That is how the table came to exist there in
the first place, and how it came to be migrated.

What the migration does to existing rows: everything already in the table moves
to the **shared** shelf, not to its owner's. Those rows were saved into a library
everybody could see and colleagues may be relying on seeing them; making them
private retroactively would look like data loss. Only saves made after the
release are private, and an owner can pull their own work back at any time.

Verified twice: first inside a transaction against the live table that was then
rolled back, and after applying it for real, end to end against the local backend
as two different logins. Both operators saving `program/ZZ-claude-check` got
separate rows keeping their own payloads; neither could list or `GET` the other's
(404, not 403 — a 403 would confirm the colleague has a job by that name); after
one shared it the other was refused with *"The shared library already has
“ZZ-claude-check” from Apisit Suwannakate…"* and refused the delete with *"That
belongs to Apisit Suwannakate, so it is not yours to delete."*; unshare returned
it. Both test rows were deleted afterwards. Re-run that shape of check if the
table is ever changed again.

> **Dev and production still share one database.** Because plbmp118's backend
> points at the same `eng_system` on plbmp130, anything you *share* from the dev
> site appears on the shop's shared shelf immediately. Your own private saves are
> now only yours, which removes most of the old footgun — but a test item you
> pressed Share on is visible to everyone. Unshare or delete it when finished.

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
