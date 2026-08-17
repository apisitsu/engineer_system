---
name: test-like-prod
description: Sync branch `mtc` with production, exercise the app in Chrome the way plbmp130 runs it, and report exactly what plbmp130 needs installed or configured before the change can ship. Use whenever the user says "Test" (or test this / ทดสอบ / เทสให้หน่อย) on this repo — it is the standard pre-release check, not a unit-test run.
---

The user develops on branch **`mtc` only**. "Test" means all four steps below, in
order, ending in the report. Unit tests are part of it, not the whole of it: the
question being answered is *"can this ship to plbmp130, and what does plbmp130
need first?"*

Read `.claude/skills/run-engineersystem/SKILL.md` before step 3 — it owns the
Chrome driver, the JWT minting, the proxy/CDN gotchas, and it is not repeated
here. Paths below are relative to the repo root.

> **The database is already production.** `apps/ENG-Backend/.env` has
> `PG_NEW_HOST=plbmp130`, so this machine reads and writes the live `eng_system`.
> A migration run here is *already deployed*; only the code is still local. That
> asymmetry is the single most common way this repo breaks production — see
> "Config already on production" in the report template.

## 1. Sync with production

```bash
git rev-parse --abbrev-ref HEAD          # must be mtc — stop if not
git status --porcelain                   # commit or stash first; never merge over a dirty tree
git fetch origin
git merge origin/main -m "Merge origin/main into mtc"
```

**Merge `origin/main` — the remote ref — never the local `main` branch.** Local
`main` on this machine is diverged from `origin/main` (it has carried commits
like `AA` and `merge dev to main local plbmp118` that never reached the server,
while missing work that has). Checking it out or merging into it drags that mess
into the release. `origin` is `ssh://git@plbmp130:2222/LE131/EngineerSystem.git`;
there is also a `github` remote, so be explicit about which one.

Also fetch and merge `origin/mtc` if the local branch is behind it — someone else
pushes there.

Check the merge result before going on:

```bash
git merge-tree --write-tree mtc origin/main >/dev/null && echo CLEAN || echo CONFLICTS
grep -m1 '^export const apiUrl' apps/ENG-Frontend/src/constance/constance.js
```

`apiUrl` **must end up `plbmp130`** on anything that will be merged onward to
`dev`/`main`. `CLAUDE.md`'s prod-safety invariant says branch `mtc` is
`plbmp118`; that is for local development, and it must not be the value that
travels. If you set it to `plbmp118` for local testing, revert before pushing —
whoever merges next will not notice, and production will silently call the dev
backend.

## 2. Unit tests — all three suites

```bash
cd apps/ENG-Backend  && npx jest                                   # ~250 tests, ~70s
cd apps/ENG-Frontend && CI=true npx react-scripts test --watchAll=false
cd apps/ENG-Frontend && npx vitest run                             # CAM suite, ~500s — run in background
```

Known-failing before you start, so do not report them as regressions — but do
re-check that the count has not grown:

| suite | failure | why |
|---|---|---|
| CRA | `sign_up.test.js` | imports `enzyme`, which is not a dependency anywhere |
| CAM | `App.test.jsx > survives playback, unlike the sidebar block it replaced` | 30 s timeout |
| CAM | `App.test.jsx > stops a run in progress, like a cycle stop` | 30 s timeout |

**Run CAM's vitest on its own.** It takes ~8 minutes and forks a worker per file;
with anything else competing for the machine you get phantom failures that look
like real ones — a run alongside a DB-heavy script produced three failures plus
nine `[vitest-pool]: Failed to start forks worker … Timeout waiting for worker to
respond`, and the same commit on an idle machine produced two. Never report a CAM
failure without re-running it alone.

`--reporter=basic` is not supported by the installed version: it fails while
*loading the reporter* and still exits 0, which reads exactly like a passing run.
Use the default reporter and read the `Test Files` / `Tests` summary lines.

The two known CAM failures share one cause and are worth recognising rather than
re-diagnosing. Both are the only tests in the file that do
`await setStore({ playing: true })`; `App.jsx`'s playback effect then starts a
`setInterval(…, 40)` that writes to the store every tick until the program ends,
nothing in the test stops it, and there are no fake timers — so `act()` never
settles. Neither is caused by MTC work: `stops a run in progress` came in with
the original vendoring commit (`223b923a`, already on `origin/main`) and the
playback loop is byte-identical on `origin/main`. **Do not "fix" them by editing
the CAM suite without reading `.claude/rules/cam-web.md` first** — it is a
vendored copy of the standalone `cam-web` project and every local edit is a
divergence a future re-sync will silently undo.

## 3. Drive it in Chrome, the way plbmp130 actually runs it

**Production is not the Docker/nginx path.** `auto_update_and_run.ps1` — what
plbmp130 runs — does `git pull origin main` then `npm run dev`, i.e. **nodemon on
:2005 plus the CRA dev server on :3000**. `nginx.conf` and `docker-compose.yml`
exist and describe a static-build deployment that is *not* what is live. So:

- Test against `npm run dev` to match production behaviour.
- Also run `npm run build` if the change touches the frontend — the dev server
  tolerates things a production build rejects (unused imports become errors under
  `CI=true`, and CRA's eslint cache can report stale phantom errors after a large
  edit; `rm -rf apps/ENG-Frontend/node_modules/.cache` and rebuild).
- If you find behaviour that depends on which path serves the app, say so in the
  report — that divergence is a real risk nobody has retired.

Then use the `run-engineersystem` driver for the screens the change touches.
Prefer read-only routes. Exercise the actual UI path the user described, not just
the route loading.

## 4. The report — what plbmp130 needs

This is the deliverable. Compute it mechanically rather than from memory:

```bash
git diff --stat origin/main...mtc | tail -3
git diff origin/main...mtc -- package.json apps/*/package.json          # new deps
git diff origin/main...mtc --name-only -- apps/ENG-Backend/db_migrations # migrations
git diff origin/main...mtc -- nginx.conf docker-compose.yml
git diff origin/main...mtc -G'process\.env\.' --name-only               # new env vars
git log origin/main..mtc --oneline
```

Report under these headings, and write "none" where there is nothing — a heading
with nothing under it is information, a missing heading is ambiguity:

**a. `npm install` needed?** Yes if any `package.json` dependency changed. Say
which packages and which workspace. plbmp130 does *not* run `npm install`
automatically — `auto_update_and_run.ps1` only pulls and restarts, so a new
dependency means the app fails to boot until someone installs it by hand.

**b. New or changed environment variables.** Name each one, give its default, and
say what happens if it is left unset. Check `apps/ENG-Backend/.env` on *this*
machine against what the code now reads — a variable that works here because it
is set here is exactly the kind that is missing there.

**c. Database migrations.** List each `db_migrations/` file and — critically —
**whether it has already been run against production**, since this machine's
`engPool` points at plbmp130. If it has, say so plainly and note that the code
supporting it is what is still outstanding, not the data.

**d. Host paths, shares and drive letters.** Any new UNC path, mapped drive or
Google Drive folder. Drive letters are per-signed-in-session, not per machine, so
"it works on plbmp118" says nothing about the account running the backend on
plbmp130. `node scripts/ti_check_paths.js` reports the Tooling Inspection ones
per host and per account.

**e. Web server / proxy config.** Changes to `nginx.conf` only matter if the app
is reached on port 80; production's `apiUrl` goes straight to `:2005` and bypasses
the proxy. Say which applies.

**f. Local modifications on plbmp130 that will conflict.** Files edited directly
on the production host and never committed will be overwritten by `git pull` or
will block it. Known instances: `legacyMtcController.js` (a hand-added 2-minute
timeout) and `tooling_inspect.jsx` (hand-added `Stage:` logging). Ask before
assuming these should go.

**g. What still fails, and whether it blocks.** Report honestly, with counts.

## Gotchas specific to this flow

- **Never push `dev` or `main` from this machine.** The agreed flow is: push
  `mtc` to `origin/mtc` only, and whoever maintains production merges onward.
  Local `dev` and `main` are both diverged and pushing them would rewrite work.

- **`git add -A` sweeps the user's concurrent edits into your commit.** They work
  in this repo at the same time. Stage explicit paths, or check
  `git status --porcelain` immediately before staging and confirm every file is
  yours.

- **A validation number measured against the same table that seeded it is not
  validation.** Several tooling rules are pinned per C/N from
  `lpb.eng_r_pi_tool`; scoring them against that same plan returns 100% by
  construction. Say which numbers are independent and which are self-confirming.

- **Formula failures on production look like "undefined variable".** If
  `tooling_formula` rows reference a context variable that
  `searchService.buildSpecContext` on `main` does not define, every search logs
  `[formula] FAILED … → undefined variable: X` and the tooling returns no match.
  That is the config-ahead-of-code asymmetry; check it before shipping DB config:
  ```bash
  git show main:apps/ENG-Backend/api/engineer/mtc/services/searchService.js | grep -c 'sphCutOd_max'
  ```
