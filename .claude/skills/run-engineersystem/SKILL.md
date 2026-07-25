---
name: run-engineersystem
description: Launch, drive, and screenshot EngineerSystem (Express backend on :2005 + React/CRA frontend on :3000) — an internal manufacturing engineering platform (MTC tooling, Kanban, ECR, FEA). Use when asked to run, start, smoke-test, or screenshot this app, or to confirm a code change works end-to-end rather than just passing unit tests.
---

Paths below are relative to the repo root (`EngineerSystem/`), not to this skill
directory, unless stated otherwise.

**This is not a disposable sandboxed app.** The backend (`apps/ENG-Backend`)
connects to real corporate Postgres databases (`eng_system` on `plbmp130:6543`,
`rodpc`/`rodqc` on `plb018:5432`, `maqdb` on `plbmp00:5432` — per `apps/ENG-Backend/.env`)
and a live Gmail OAuth integration. Per `CLAUDE.md`, `plbmp130` is documented as the
**production** DB host. Only run this against real infra with explicit user
sign-off, and prefer read-only interactions (GET requests, screenshots) — avoid
mutating requests, sending email, or writing data unless the user asked for that
specifically.

## Prerequisites

- This machine already has both processes runnable: `npm install` was already run
  (root + workspaces), and in the verified session both were **already running**
  (started via `run.ps1` / `auto_update_and_run.ps1`) — backend on `:2005`, frontend
  on `:3000`. Check first with `netstat -ano | grep -E ":2005|:3000"` before starting
  new ones.
- System Chrome must be installed (verified at
  `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`) — `puppeteer`
  (an `ENG-Backend` dependency, hoisted to the root `node_modules` by npm
  workspaces) has **no bundled Chromium downloaded** (`npx puppeteer browsers
  install chrome` was never run), so the driver points `executablePath` at the
  system install instead.
- This shell has corporate proxy env vars set (`HTTP_PROXY`/`HTTPS_PROXY`
  pointing at `proxyth.bp.minebea.local`) — `curl` needs `--noproxy '*'` for
  `localhost` or every request 502s through a McAfee Web Gateway page instead of
  reaching the app.

## Build / Start (only if not already running)

```bash
cd "EngineerSystem"
npm install                     # root + workspaces (apps/ENG-Backend, apps/ENG-Frontend)
npm run dev:backend &           # apps/ENG-Backend: node runner.js — nodemon, port 2005
npm run dev:frontend &          # apps/ENG-Frontend: react-scripts start, port 3000
```

Wait for `GET /api/health` to return `{"status":"ok",...}` and `GET :3000/` to
return 200 before driving either.

## Run (agent path) — the driver

Two tools, both under `.claude/skills/run-engineersystem/`:

- **`mint-token.mjs`** — signs a JWT with the backend's own `JWT_SECRET`
  (read from `apps/ENG-Backend/.env`), for read-only local testing without a
  real employee login. Run from inside `apps/ENG-Backend` so dotenv finds `.env`.
- **`driver.mjs`** — puppeteer-based screenshot driver for the React frontend.

### 1. Backend — curl, using a self-minted token

```bash
curl -s --noproxy '*' http://localhost:2005/api/health

TOKEN=$(cd apps/ENG-Backend && node "../../.claude/skills/run-engineersystem/mint-token.mjs" LC043 "Phanuwach Thongpradab" HEAD ENG)

curl -s --noproxy '*' -H "Authorization: Bearer $TOKEN" http://localhost:2005/api/get-all-users
curl -s --noproxy '*' -H "Authorization: Bearer $TOKEN" http://localhost:2005/api/tooling-select/machines
curl -s --noproxy '*' -H "Authorization: Bearer $TOKEN" http://localhost:2005/api/ecr/getlist
```

`empno`/`name`/`role`/`department` should belong to a **real row** in
`eng_system.users` (see Gotchas) — `LC043` / `Phanuwach Thongpradab` / `HEAD` / `ENG`
is a real, verified-working record as of this writing; if it's gone, get another
one from an unauthenticated-then-authenticated call to `/api/get-all-users`.

### 2. Frontend — puppeteer driver, screenshots

```bash
mkdir -p /tmp/shots   # or any writable dir; SHOT_DIR controls where PNGs land

# Unauthenticated sign-in page
SHOT_DIR=/tmp/shots node .claude/skills/run-engineersystem/driver.mjs \
  shot http://localhost:3000/sign_in signin.png

# Authenticated view of any protected route (injects a synthetic session)
SHOT_DIR=/tmp/shots node .claude/skills/run-engineersystem/driver.mjs \
  login-shot http://localhost:3000/home "$TOKEN" LC043 "Phanuwach Thongpradab" HEAD ENG home.png
```

`driver.mjs shot <url> <outfile.png>` — plain navigate + screenshot.
`driver.mjs login-shot <url> <jwt> <empno> <name> <role> <department> <outfile.png>`
— injects a synthetic authenticated session before the app boots, then navigates
and screenshots. Swap the URL for any route under `MTC_PATHS`
(`apps/ENG-Frontend/src/constance/mtc_constance.js`) — e.g.
`http://localhost:3000/eng/mtc/tooling-select`.

## Direct invocation (for PRs that touch backend logic only)

Most MTC/formula/SDS PRs touch `apps/ENG-Backend/api/engineer/**` services, not
the UI. For those, skip the browser entirely and just curl the affected route
with a minted token (§1 above), or run the Jest suite:

```bash
cd apps/ENG-Backend
npx jest --testPathPattern="formulaService"   # or mtcv2, etc.
```

## Run (human path)

`npm run dev` from the repo root starts both with `concurrently` and opens no
browser automatically; visit `http://localhost:3000`. Useless headless — no
different from the agent path once running, except no screenshots.

## Gotchas

- **Corporate proxy black-holes `localhost` for `curl`.** This shell has
  `HTTP_PROXY`/`HTTPS_PROXY` set globally; plain `curl http://localhost:2005/...`
  gets silently routed through `proxyth.bp.minebea.local` and returns a McAfee
  Web Gateway "Cannot Connect" HTML page with HTTP 200 (not an error!) instead of
  hitting the app. Always pass `--noproxy '*'` (or `-u`, but bypass is simpler).

- **`dotenv` pollutes stdout, corrupting naive JWT capture.** `node -e "require('dotenv').config(); ... console.log(token)"` prints a `[dotenv@x] injecting env...` tip line to stdout *before* the token, so
  `TOKEN=$(node -e '...')` captures both lines glued together — the resulting
  `Authorization: Bearer <garbage>\n<token>` header is malformed enough that
  Node's raw HTTP parser rejects it with a bodyless `400 Bad Request` /
  `Connection: close` (not a normal Express 401/403 — no `Content-Type` header at
  all, which was the tell). `mint-token.mjs` fixes this with
  `dotenv.config({ quiet: true })`; don't reintroduce plain `require('dotenv').config()` in a script whose stdout gets captured.

- **A self-minted JWT is enough for `verifyToken`, but not enough for every
  route.** `middleware/auth.js`'s `verifyToken` only checks the signature — any
  payload signed with the real `JWT_SECRET` passes. But several controllers
  (e.g. `update-user-theme`, called on every authenticated page load to sync the
  UI theme) do a real DB lookup by `empno` and 401 if the row doesn't exist.
  The frontend's global axios response interceor
  (`apps/ENG-Frontend/src/utils/HttpClient.js`) force-logs-out on **any** 401
  from **any** endpoint, so a made-up `empno` silently bounces every protected
  page back to `/sign_in` a few hundred ms after it renders — no error shown,
  just a `framenavigated` back to sign-in. Fix: mint the token for an `empno`
  that's a real row (see §1).

- **Injecting the session via `/sign_in` + `localStorage.setItem` doesn't
  work.** `sign_in.jsx`'s mount effect unconditionally wipes the session
  (`LOGIN_PASSED="no"`, removes `token`) as an anti-stale-session guard — it
  runs *after* your `page.evaluate()` if you navigate to `/sign_in` first, so
  whatever you just set gets clobbered on the very next navigation. Use
  `page.evaluateOnNewDocument()` instead (as `driver.mjs login-shot` does) so
  the values exist *before* the SPA boots at all — there's then no `/sign_in`
  mount in the sequence to race against.

- **No bundled Chromium for puppeteer.** `apps/ENG-Backend` depends on
  `puppeteer` (for its own PDF generation, unrelated to this driver) but
  `npx puppeteer browsers install chrome` was never run — the browser cache dir
  (`~/.cache/puppeteer`) is empty. `driver.mjs` points `executablePath` at the
  system Chrome install instead of trying to download one.

- **The CRA dev bundle hangs forever in headless Chrome unless you block a
  handful of CDN hosts.** `apps/ENG-Frontend/public/index.html` (AdminLTE
  template) has several classic, render-blocking `<script src>`/`<link>` tags
  pointing at `cdn.jsdelivr.net`, `code.ionicframework.com`, `unpkg.com`, and
  `fonts.googleapis.com`. On this corporate network those hosts don't resolve
  through the proxy from inside headless Chrome's own network stack, so the
  parser blocks on one of them indefinitely — `document.readyState` sits at
  `"loading"` forever, `load`/`domcontentloaded` never fire, and even
  `Page.captureScreenshot` eventually times out, even though `page.evaluate()`
  keeps responding the whole time (the JS thread isn't hung, the HTML parser
  is). Confirmed by request-intercepting and `abort()`-ing those hosts: page
  loads in ~5s instead of never. `driver.mjs` does this by default
  (`BLOCK_HOSTS`); don't remove it without re-verifying the page still loads.
  Un-blocked, cold-load can run past 90–100+ seconds and still not resolve —
  don't just "raise the timeout" as the fix.

- **`apiUrl` in `constance.js` targets a remote dev host, not this machine.**
  On branch `mtc` it's hardcoded to `http://plbmp118:2005/` (see `CLAUDE.md`'s
  prod-safety invariant note — do not "fix" this by leaving it pointed at
  `localhost`). A token minted with *this* machine's local `JWT_SECRET` will
  **not** validate against `plbmp118`'s backend (different `.env` there). If
  you need the frontend to hit the local backend you just started, temporarily
  edit the `apiUrl` line, test, then revert it to exactly what it was — check
  `git diff` on that file *before* editing, since it may already carry
  unrelated local changes from the user (it did in this verified session); back
  up the file first and restore it byte-for-byte afterward, never `git checkout --`
  it blind.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `curl` returns a McAfee "Cannot Connect" HTML page (HTTP 200) for `localhost` | Add `--noproxy '*'` |
| Protected endpoint returns a bodyless `400 Bad Request` with only a `Connection: close` header (no `Content-Type`, no JSON) | Your `Authorization` header is corrupted — almost always the dotenv-stdout issue above. Re-mint with `mint-token.mjs` |
| `Error: Could not find Chrome (ver. ...)` from puppeteer | No bundled Chromium — pass `executablePath` (driver.mjs already does) or `CHROME_PATH` env var if Chrome lives elsewhere |
| `page.goto()` times out on `http://localhost:3000` (or hangs past 90s) | You removed/bypassed the `BLOCK_HOSTS` interception in `driver.mjs` — restore it |
| Authenticated screenshot shows the sign-in page again a moment after loading `/home` | Either (a) empno doesn't exist in `eng_system.users` — the theme-sync 401 force-logs-out — or (b) you set `localStorage` via `page.evaluate()` after navigating to `/sign_in` instead of `evaluateOnNewDocument()` before navigating |
| `GET /api/get-all-users` (or any `/api/*`) returns `{"result":"false","message":"Token is invalid or expired"}` | The minted token's 1h TTL expired — re-run `mint-token.mjs` |
