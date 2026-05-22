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
- **Entry:** `server.js` → Express app on port 2005; WebSocket via `api/kanban/websocket.js`
- **Routing:** Most domains register routes inline in `server.js`. MTC has a partial `routes/mtcRoutes.js`, but most MTC controllers are also registered directly in `server.js`
- **MVC per domain:** routes → controller (HTTP layer) → service (business logic, PDF/Excel) → model (DB access)
- **Key domains:**
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, formula engine (`expr-eval`), tooling selection, tool-request workflow
  - `api/engineer/process/` — ECR workflow (`/api/ecr/*`), tumble conditions/models (`/api/tumble/*`)
  - `api/engineer/system/` — PDF converter (`pdfConverter.js`) at `/api/engineer/system`
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
- **API constants:** `src/constance/constance.js` + `src/constance/mtc_constance.js`. `apiUrl` hardcoded to `http://plbmp118:2005/` — change to `http://localhost:2005/` for local dev. **Add new API constants to both `constance.js` AND `constance_prod.js`.**
- **Navigation:** Adding a page → update `App.jsx` (route) + `menu_sidebar.jsx` (sidebar entry). MTC paths in `mtc_constance.js` → `MTC_PATHS`.

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
| **MTC scripts** | `PYTHON_EXE`, `TOOLING_IMPORT_SCRIPT` | PC-tooling import pipeline |
| **SDS PDF** | `SOFFICE_PATH`, `SDS_TEMPLATE_DIR` | LibreOffice path; SDS template dir |
| **Misc** | `EXTERNAL_JOB_CHECK_API_KEY`, `GAS_EMAIL_URL` | External integrations |

Frontend `.env` only needs `BROWSER=none` and `GENERATE_SOURCEMAP=false`.

> **Gmail creds format:** `.env` stores values as JS assignment syntax (e.g., `GMAIL_CLIENT_ID = '47418...';`). Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — **never** `process.env.KEY` directly — or the OAuth call gets `invalid_client` from literal quote characters in the value.

## Key Conventions

### Security (mandatory)
- Always use parameterized queries — never interpolate user input into SQL
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin`; engineer actions with `isEngineer`
- `verifyToken` on all non-public routes; public exceptions listed explicitly in `server.js`
- `middleware/auth.js` accepts JWT via `req.query.token` as fallback (for file-download `<a target="_blank">` links only)

### Machine Name Hyphen Convention (MTC)

Machine names **must use hyphens** consistently. `FormulaService` uses exact-match SQL — a missing hyphen silently returns `0` for every parameter.

Canonical names: `KS-B22G`, `KS-B80`, `KS-03A`, `KS-B22RD`, `KS-400B1`, `KS-400B2`, `KS-400B5`, `KS-400B6`, `KS-400B7`, `KS-500RD`, `TSG-300ZNC`, `TSG-300W`
Exception: `KS400B` intentionally has no hyphen (retired — formula still computed but legacy SQL skipped via `use_dynamic_rules=true`).

When renaming a machine, always pair with a DB migration:
```sql
UPDATE tooling_formula         SET machine_name = 'KS-XXX' WHERE machine_name = 'KSXXX';
UPDATE tooling_selection_rules SET calc_context  = 'KS-XXX' WHERE calc_context = 'KSXXX';
UPDATE tooling_selection_rules SET machine_name  = 'KS-XXX' WHERE machine_name = 'KSXXX';
```

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
4. Add new API endpoint constants to **both** `constance.js` and `constance_prod.js`

> Bulk DB patterns (bulk fetch/insert, chunk sizes, INSERT column-order pitfall), PDF/Excel generation rules → `.claude/rules/db-patterns.md`
> V1 MTC tooling pipeline (`ToolingOrchestrator`, `CacheAgent`, `FormulaAgent`, etc.) — full reference: `.claude/rules/mtc-tooling.md`. V1 is retired and fully removed from disk.
> SDS pipeline, Tooling↔SDS coupling, SDS Admin sub-routes, ECR/Tumble/System routes: `.claude/rules/sds-pipeline.md`
> Tooling Select V2 (DB-driven): DB tables, routes, formula evaluation, search logic, adding a new machine, frontend components → `.claude/rules/tooling-select.md`
