# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React 19 frontend and an Express.js backend. Core domains: MTC (Machine Tooling Configuration), Kanban task board, FEA simulation queues, ECN/ECR process workflows, and user/RBAC management.

`OldProject/` contains retired Google Apps Script prototypes (AppsScript_EngReq, AppsScript_SetupDataSheet) — do not modify.

## Commands

### Root (run from `D:\Projects\EngineerSystem`)
```bash
npm install          # Install all workspace dependencies
npm run dev          # Run backend + frontend concurrently
npm run dev:backend  # Backend only (nodemon)
npm run dev:frontend # Frontend only (port 3000)
npm run build        # Build all workspaces
```

### Backend (`apps/ENG-Backend`)
```bash
npm start            # nodemon server.js (development)
npm run dev          # node runner.js — nodemon with 30s crash-restart delay (prefer over npm start to avoid rapid loops)
npm test             # Jest unit tests (tests in tests/**/*.test.js; coverage covers api/engineer/mtc/services|controllers|utils only)
npm run test:watch   # Jest watch mode
npm run test:coverage
npx jest --testPathPattern="formulaService"   # single test file
npx jest --testPathPattern="mtcv2"            # V2 tests only
```

### Frontend (`apps/ENG-Frontend`)
```bash
npm start            # React dev server (port 3000)
npm run build        # Production build → build/
npm test             # React Testing Library
npm run cypress:open # Cypress E2E GUI
npm run cypress:run  # Cypress E2E headless
```

## Architecture

### Backend (`apps/ENG-Backend`)
- **Entry:** `server.js` → Express app on port 2005; WebSocket via `api/kanban/websocket.js` (body-parser limit gotcha → `.claude/rules/backend-gotchas.md`)
- **Routing:** Most domains register routes inline in `server.js`. MTC has a partial `routes/mtcRoutes.js`, but most MTC controllers are also registered directly in `server.js`
- **MVC per domain:** routes → controller (HTTP layer) → service (business logic, PDF/Excel) → model (DB access)
- **Key domains:**
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, formula engine (`expr-eval`), tooling selection, tool-request workflow
  - `api/engineer/process/` — ECR workflow (`/api/ecr/*`), tumble conditions/models (`/api/tumble/*`)
  - `api/engineer/system/` — PDF converter (`pdfConverter.js`) at `/api/engineer/system`
  - `api/engineer/cam/` — CAD/CAM saved-work library (`/api/engineer/cam/library`, `verifyToken`); table `cam_saved_work` in `engPool`. **A private shelf per operator plus one shared shelf**: saving is always private, publishing is an explicit `POST /library/:id/share`, and every ownership rule is enforced in `camService` against the row (not by a route guard). Replaced the module's per-browser IndexedDB store, then replaced the single shared namespace that first fix created — where two operators saving "OP10" overwrote each other. Rows are addressed by `id`, not by the record key → `.claude/rules/cam-web.md`
  - `api/engineer/new_prod/` — external job-check proxy (`/api/proxy/job_check`, **no auth** — whitelisted in global auth middleware)
  - `api/kanban/` — real-time board/card CRUD via Socket.io
  - `api/fea/` — FEA simulation (BullMQ job queue + `fea_worker.js`); **not** under `api/engineer/`
  - `api/user/` — JWT auth, user profile, RBAC roles
  - `api/system/` — Gmail integration, system settings, user management schema
- **Database:** Raw `pg.Pool` (no Sequelize) from `instance/`:
  - `instance/eng_db.js` → `engPool` — main app DB (`eng_system`) on port 6543
  - `instance/instance.js` → `pool` — factory DB `rodpc` on port 5432
  - `instance/maq_db.js` → `maqPool` — factory DB `maqdb` on port 5432
  - `maqQcPool` in `.env` (`PG_RODQC_*`) but **no instance file exists** — env vars declared but unused
- **Auth middleware:**
  - `middleware/auth.js` — `verifyToken` (JWT), `generateToken`
  - `middleware/mtcAuth.js` — `authorize(roles[])` factory, `isAdmin` (dept/role 'AD'), `isEngineer` ('AD' or 'Engineering'). All MTC admin controllers (e.g. `api/engineer/mtcv2/controllers/specController.js`) import `isAdmin` from here — do not redefine locally.
  - **Inline guards in `server.js`:** `requireSuperAdminOrEmergency` and `requireSystemEngineer` — not in middleware files
- **JWT payload:** `{ empno, name, department, group, role }` — in Kanban routes `empno` is mapped to `id`
- **Constants:** MTC table names in `api/engineer/mtc/mtcConstants.js` → `TABLES`; never hardcode table names
- **FEA:** Requires Redis (BullMQ) at `REDIS_HOST/REDIS_PORT`; gracefully skips if absent

### Frontend (`apps/ENG-Frontend`)
- **Entry:** `App.jsx` — React Router v7 routes; `ProtectedRoute` wraps all auth-required paths
- **Auth state:** Zustand store at `src/stores/authStore.js`
- **UI:** Ant Design v5 + vanilla CSS. No TailwindCSS. Use `destroyOnHidden` (not `destroyOnClose`) on Modal/Drawer.
- **API constants:** `src/constance/constance.js` + `src/constance/mtc_constance.js`. Add new API constants to `constance.js` only — **`constance_prod.js` is dead** (imported by nothing; do not update it).
- **Request timeouts are set centrally in `utils/HttpClient.js`**, whose interceptors are installed on the *default* axios instance (`export const httpClient = axios`), so `import axios from 'axios'` gets them everywhere. Ordinary calls default to 10 s; **a `FormData` body defaults to 10 min instead**, because axios's `timeout` is a deadline for the whole request rather than an idle timeout — a large upload transferring healthily would otherwise be aborted mid-flight, and the server accepts up to 500 MB. An explicit per-request `timeout` always wins; use one for any endpoint that is slow for reasons other than payload size (the Tooling Inspection import passes 15 min). Locked in by `utils/HttpClient.test.js`.
- **`apiUrl` is branch-specific (prod-safety invariant):** `constance.js` hardcodes `export const apiUrl`. Branch `mtc` → `http://plbmp118:2005/` (dev); branches `dev` and `main` → `http://plbmp130:2005/` (**PROD**). Use `http://localhost:2005/` for local dev. Every `mtc`→`dev` merge risks flipping this — **`main` must stay plbmp130**, or the production frontend calls the dev backend silently. `runner.js` auto-repairs a duplicated `apiUrl` on startup via `scripts/fix_constance_prod.ps1` (which edits `constance.js`, despite its name); `git_sync_mtc.ps1` gates the release flow on it.
- **Navigation:** Adding a page → update `App.jsx` (route) + `menu_sidebar.jsx` (sidebar entry). MTC paths in `mtc_constance.js` → `MTC_PATHS`. `menu_sidebar.jsx` numbers items from a fixed `numberIcons` array with a `|| numberIcons[0]` fallback — adding an item past the end of that array silently renumbers it "1".
- **CAD/CAM (`mtc_eng/cam`)** is a vendored copy of the standalone **cam-web** project, not code written here. It is the only `React.lazy` route, it carries its own vitest suite, and it has four deliberate divergences from upstream that a naive re-copy undoes. Read `.claude/rules/cam-web.md` before touching it.

### Infrastructure
- **Docker:** `docker-compose.yml` — backend (port 2005) + frontend (port 80) + PostgreSQL volume for uploads
- **Nginx:** `/api/` → backend:2005; `/uploads/` → backend:2005; `/ws` → WebSocket upgrade; `/` → React static
- **Production:** PM2 manages backend; Nginx serves React `build/` as static files

### Environment Variables (`apps/ENG-Backend/.env`)

| Group | Vars | Notes |
|---|---|---|
| **Main DB** | `PG_NEW_HOST`, `PG_NEW_PORT`, `PG_NEW_DB`, `PG_NEW_USER`, `PG_NEW_PASS` | `eng_system` on port 6543 → `engPool` |
| **Factory DB** | `PG_RODPC_HOST/PORT/DB/USER/PASSWORD` | `rodpc` on 5432 → `pool` |
| **MAQ DB** | `PG_MAQ_HOST/PORT/DB/USER/PASSWORD` | `maqdb` on 5432 → `maqPool` |
| **QC DB** | `PG_RODQC_HOST/PORT/DB/USER/PASSWORD` | `rodqc` on 5432 → `maqQcPool` |
| **Auth** | `JWT_SECRET` | Signs all tokens |
| **Redis** | `REDIS_HOST`, `REDIS_PORT` | BullMQ for FEA; backend starts without it |
| **Gmail** | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_REFRESH_TOKEN` | OAuth2; values stored as JS syntax with quotes → `cleanEnv()` strips before use |
| **Proxy** | `PROXY_HOST`, `PROXY_PORT`, `PROXY_USER`, `PROXY_PASS` | Corporate proxy for outbound HTTP |
| **TI import** | `TI_INSP_REC_DIR`, `TI_DWG_PRINT_FILE`, `TI_CSV_OUTPUT_DIR` | Tooling Inspection "Update data" sources + CSV output. All optional; defaults are the two UNC shares and `G:\Shared drives\...`. **Set `TI_CSV_OUTPUT_DIR` to a UNC path on prod** — `G:` is a mapped drive the PM2 service account does not have |
| **TI import (retired)** | ~~`PYTHON_EXE`, `TOOLING_IMPORT_SCRIPT`, `DWG_PRINT_IMPORT_SCRIPT`, `TOOLING_IMPORT_ENGINE`~~ | **Retired 2026-08-04** — "Update data" no longer shells out to Python; the scripts, the `PATHS` entries and the fallback branch are all gone. Unused. |
| **SDS PDF** | ~~`SOFFICE_PATH`, `SDS_TEMPLATE_DIR`~~ | **Retired 2026-06-14** — LibreOffice removed; SDS PDF renders via Chrome grid (`/api/sds/v2-headless/pdf-chrome/grid`). These env vars are unused. |
| **Misc** | `EXTERNAL_JOB_CHECK_API_KEY`, `GAS_EMAIL_URL` | External integrations |
| **Frontend URL** | `FRONTEND_BASE_URL` | Optional. Origin used to build deep links the backend puts on Kanban cards (SDS approval → sign page). Unset → relative URLs, which resolve correctly while board and app share an origin |

Frontend `.env` only needs `BROWSER=none` and `GENERATE_SOURCEMAP=false`.

> Gmail creds are stored as JS assignment syntax → always use `cleanEnv()`, never `process.env.KEY` directly. Details → `.claude/rules/backend-gotchas.md`.

## Key Conventions

### Security (mandatory)
- Always use parameterized queries — never interpolate user input into SQL
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin`; engineer actions with `isEngineer`
- `verifyToken` on all non-public routes; public exceptions listed explicitly in `server.js`
- `middleware/auth.js` accepts JWT via `req.query.token` as fallback (for file-download `<a target="_blank">` links only)

### Machine Names (MTC) — the SDS registry is the spelling

**A machine's name must match `sds_machine_type_code.machine_type_name` exactly** (or its T-Select `machine_group` must) — that registry is the factory's own spelling. The name is matched as a raw string in three places, so a mismatch fails silently rather than loudly: the SDS PDF's tooling-slot ordering (`tooling_machine.machine_name = ANY([machine_type_name, group])`), the Part-No fixture map (`tooling_partno_map.machine_name`, used by both the SDS PDF and the similar-part fallback), and inventory-table resolution (`machine_name = $1 OR machine_group = $1`).

For the grinder families the registry spelling carries hyphens, and the `KS-` / `KN-` / `TSG-` names **must** keep them: `KS-B22G`, `KS-B80`, `KS-03A`, `KS-B22RD`, `KS-400B1`, `KS-400B5`, `KS-400B6`, `KS-500RD`, `TSG-300W`, `HAMAI 5B`. (`KS-400B2`, `KS-400B7` and `TSG-300ZNC` exist only inside the group labels `KS-400B1/B2/B7` and `TSG-300W/TSG-300ZNC`.)

**This is not a house style to enforce on new machines.** The registry spells other families without hyphens — `LB12`, `LB15`, `LNC45/C200`, `THREAD ROLL`, `測定用治具全般` — and those names are correct as they stand. Renaming `LB15` to `LB-15` breaks the SDS join. Take the spelling from `sds_machine_type_code`, never from the pattern of the name next to it.

Historical exception, still true: `KS400B` (retired) and `HAMAI 5B` (Machine Type Code 564, active — Hamai-brand 5B grinder replacing TSG-300W; floor code VSG-02; renamed from `5B` 2026-06-05).

When renaming a machine, pair it with a DB migration that updates **`tooling_machine.machine_name`, `sds_machine_type_code.machine_type_name` and `tooling_partno_map.machine_name`** together — the last keys on the string rather than on `machine_id`. Formulas, limits and search rules all key on `machine_id` and need no change.

> An older version of this section claimed `FormulaService` matches machines by exact-match SQL and prescribed `UPDATE`s against `tooling_formula.machine_name` and `tooling_selection_rules`. **All three statements would error today** — `tooling_formula` has only `machine_id`, and `tooling_selection_rules` was dropped from the database with V1. Verified live 2026-08-17. Details → `.claude/rules/tooling-select.md`.

### MTC Legacy vs New API
Two parallel MTC route namespaces coexist — **do not remove legacy routes**:
- Legacy flat: `/api/tooling_inspect/*` — still used by older frontend components
- New MVC: `/api/engineer/mtc/*` and `/api/tooling-select/*` — active development target

### Adding a new backend domain
1. Create `api/engineer/<domain>/` with `<domain>Routes.js`, `<domain>Controller.js`, `<domain>Service.js`, `<domain>Constants.js`
2. Register the router in `server.js`
3. Add SQL migration to `apps/ENG-Backend/db_migrations/`

### Adding a new frontend feature
1. Create component under `src/components/engineer/<domain>/`
2. Use existing Zustand store or add one in `src/stores/`
3. Register route in `App.jsx` and add sidebar entry in `menu_sidebar.jsx`
4. Add new API endpoint constants to `constance.js` (**not** `constance_prod.js` — it is dead)

> Backend gotchas (body-parser double-registration, Gmail `cleanEnv`) → `.claude/rules/backend-gotchas.md`
> Bulk DB patterns (bulk fetch/insert, chunk sizes, INSERT column-order pitfall), PDF/Excel generation rules → `.claude/rules/db-patterns.md`
> V1 MTC tooling pipeline (`ToolingOrchestrator`, `FormulaAgent`, `toolingSelectController.js`) — retired, removed from disk. Historical reference: `.claude/rules/mtc-tooling.md`.
> **But `services/agents/` still exists and is live** — `BaseAgent.js`, `CacheAgent.js`, `MonitorAgent.js`, `SdsAgent.js` survived V1 and now serve SDS: required by `services/SdsOrchestrator.js`, `controllers/specController.js`, `controllers/sdsV2AdminController.js`. Do not delete them as V1 leftovers.
> SDS pipeline, Tooling↔SDS coupling, SDS Admin sub-routes, ECR/Tumble/System routes: `.claude/rules/sds-pipeline.md`
> Tooling Select V2 (DB-driven): DB tables, routes, formula evaluation, search logic, adding a new machine, frontend components → `.claude/rules/tooling-select.md`
> CAD/CAM (`mtc_eng/cam`, vendored from cam-web): re-sync procedure, the vite→webpack divergences, the planegcs WASM assets, the two test runners → `.claude/rules/cam-web.md`
> CAD/CAM deployment to plbmp118/plbmp130 (what must reach the host, the `/wasm/` nginx location, why the saved library does not travel) → `.claude/rules/cam-deploy.md`; moving a library between origins → `.claude/rules/cam-library-migration.md`
