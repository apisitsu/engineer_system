# EngineerSystem - Project Instructions

This file provides guidance to Gemini when working with code in this repository.

## Project Overview

**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo. Core domains: MTC (Machine Tooling Configuration), Kanban task board, FEA simulation queues, ECN/ECR process workflows, and user/RBAC management.

`OldProject/` contains retired Google Apps Script prototypes — do not modify.

## Multi-Agent Orchestration

This project utilizes Gemini CLI, Claude Code, and thClaws in a unified terminal workflow.
- **Single Source of Truth:** All agents must follow the instructions in this `GEMINI.md` and `.claude/rules/agent-alignment.md`.
- **Coordination:** Gemini CLI acts as the orchestrator. Complex refactoring is delegated to Claude Code, while local tool-specific tasks are handled by thClaws.
- **Context Sharing:** Always verify session state and current goals before executing cross-cutting changes.
- **Custom Commands:**
  - `gemini update project status`: Triggers an automated sync where Gemini summarizes recent work, updates the "Current Status" in this file, and notifies all agents via shared context.

## Current Project Status
- **Last Update:** 2026-05-25
- **Recent Changes:**
  - **SDS V2 Logic Overhaul:** Implemented "Strict Unique Ownership" and "Eligibility-Aware Grouping" to ensure tools are assigned only to machines physically capable of running the part (syncing with Tooling Select V2 limits).
  - **UI/UX Optimization:** Enabled column sorting in Part Management and Tool Inventory. Added auto-hiding for empty columns in the Tool Inventory table to reduce clutter.
  - **Dashboard Reliability:** Fixed auto-sync bug in Tooling Inspection Dashboard; stats now refresh immediately after data updates (Sync CSV, Record Update, etc.).
- **Active Goal:** Maintaining multi-agent alignment and monitoring system stability after logic synchronization.

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
npm run dev          # node runner.js — nodemon with 30s crash-restart delay (prefer over npm start)
npm test             # Jest unit tests
npx jest --testPathPattern="mtcv2"  # V2 tooling-select tests only
```

### Frontend (`apps/ENG-Frontend`)
```bash
npm start            # React dev server (port 3000)
npm run build        # Production build
npm run cypress:open # Cypress E2E
```

## Architecture

### Backend (`apps/ENG-Backend`)
- **Entry:** `server.js` → Express on port 2005; WebSocket via `api/kanban/websocket.js`
- **Database:** Raw `pg.Pool` — no ORM:
  - `instance/eng_db.js` → `engPool` — main app DB (`eng_system`) on port 6543
  - `instance/instance.js` → `pool` — factory DB `rodpc` on port 5432
  - `instance/maq_db.js` → `maqPool` — factory DB `maqdb` on port 5432
- **Auth:** `middleware/auth.js` (`verifyToken`, `generateToken`); `middleware/mtcAuth.js` (`isAdmin`, `isEngineer`)
- **JWT payload:** `{ empno, name, department, group, role }`
- **MVC per domain:** routes → controller → service → (DB via pool)
- **Key domains:**
  - `api/engineer/mtcv2/` — active Tooling Select (DB-driven, registered as `/api/tooling-select`)
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, tool-request workflow (V1 tooling-select files remain but are not routed)
  - `api/kanban/` — real-time board/card CRUD via Socket.io
  - `api/fea/` — BullMQ job queue + `fea_worker.js` (requires Redis; skips gracefully if absent)
  - `api/engineer/process/` — ECR workflow, tumble conditions
  - `api/system/` — user management, system settings
- **Constants:** MTC table names → `api/engineer/mtc/mtcConstants.js` → `TABLES`. V2 table names → `api/engineer/mtcv2/tsv2Constants.js` → `TSV2_TABLES`. Never hardcode table names.
- **Gmail:** `.env` stores OAuth values as JS assignment syntax (with quotes). Always use `cleanEnv(key)` from `api/engineer/mtc/utils/emailHelper.js` — never `process.env.KEY` directly.

### Frontend (`apps/ENG-Frontend`)
- **Entry:** `App.jsx` — React Router v7; `ProtectedRoute` wraps all auth-required paths
- **Auth state:** Zustand store at `src/stores/authStore.js`
- **UI:** Ant Design v5 + vanilla CSS. No TailwindCSS. Use `destroyOnHidden` (not `destroyOnClose`) on Modal/Drawer.
- **API constants:** `src/constance/constance.js` + `src/constance/constance_prod.js` (keep both in sync). `apiUrl` hardcoded — change to `http://localhost:2005/` for local dev.
- **MTC paths:** `src/constance/mtc_constance.js` → `MTC_PATHS`
- **Adding a page:** update `App.jsx` (route) + `menu_sidebar.jsx` (sidebar entry)

### Infrastructure
- **Docker:** `docker-compose.yml` — backend (2005) + frontend (80) + PostgreSQL volume
- **Nginx:** `/api/` → backend:2005; `/ws` → WebSocket; `/` → React static
- **Production:** PM2 manages backend; Nginx serves React `build/`

## Key Conventions

### Security (mandatory)
- Always use parameterized queries — never interpolate user input into SQL
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin`; engineer actions with `isEngineer`
- `verifyToken` on all non-public routes
- `middleware/auth.js` accepts JWT via `req.query.token` as fallback for file-download links only

### Machine Name Hyphen Convention (MTC)
Machine names **must use hyphens**. A missing hyphen causes silent SQL misses.

Canonical names: `KS-B22G`, `KS-B80`, `KS-03A`, `KS-B22RD`, `KS-400B1`, `KS-400B2`, `KS-400B5`, `KS-400B6`, `KS-400B7`, `KS-500RD`, `TSG-300`, `5b`
Exceptions (no hyphen): `KS400B` (retired — legacy SQL skipped via `use_dynamic_rules=true`); `5b` (Machine Type Code 564, active — replaces TSG-300W).

### Bulk DB operations
- **Fetch:** `WHERE col = ANY($1)` with array param
- **Insert:** multi-row VALUES in chunks of 2000 rows (pg limit: 65535 params)
- Never loop individual queries for 500+ items — causes HTTP timeouts

### Adding a new backend domain
1. Create `api/engineer/<domain>/` with `<domain>Routes.js`, controller, service, constants
2. Register the router in `server.js`
3. Add SQL migration to `apps/ENG-Backend/db_migrations/`

### Adding a new frontend feature
1. Create component under `src/components/engineer/<domain>/`
2. Register route in `App.jsx`; add sidebar entry in `menu_sidebar.jsx`
3. Add API endpoint constants to **both** `constance.js` AND `constance_prod.js`

## Tooling Select (DB-driven, active system)

Domain at `api/engineer/mtcv2/` → registered as `/api/tooling-select`.

### DB Tables (`TSV2_TABLES.*`)
| Table | Purpose |
|---|---|
| `tooling_machine` | Machine registry (inventory_table, enabled) |
| `tooling_machine_limit` | Eligibility limits per machine |
| `tooling_formula` | Formula rows per (machine_id, tooling_name, output_key) |
| `tooling_search_rule` | Maps output_key → inventory column with optional tolerance |
| `tooling_spec_process` | Part specs (CN, OD/ID/W Bf/Aft, type, yball, process) |

### Search pipeline (`searchService.search(cn)`)
1. Fetch spec from `tooling_spec_process`
2. For each enabled machine: check `tooling_machine_limit` eligibility
3. `formulaService.computeDimensions()` → evaluate `tooling_formula` rows via `expr-eval`
4. `searchInventory()` → combined-distance `ORDER BY (ABS(col_A - val_A) + ABS(col_B - val_B)) ASC`

### Adding a new machine (DB-only, no code change)
1. INSERT into `tooling_machine`
2. INSERT `tooling_machine_limit` rows
3. INSERT `tooling_formula` rows per (machine_id, tooling_name, output_key)
4. INSERT `tooling_search_rule` rows

### Frontend
- `tooling_select_v2/ToolingSelectV2Page.jsx` → `MTC_PATHS.TOOLING_SELECT`
- `tooling_select_v2/V2AdminPage.jsx` → `MTC_PATHS.TOOLING_MANAGEMENT`
  - Top tabs: `machines` (V2MachineManager) + `spec` (SpecProcessManager with `embedded`)
  - Machine drill-down tabs: `limits`, `formulas`, `rules`
- `tooling_select/SpecProcessManager.jsx` is still used (embedded in V2AdminPage) — the rest of `tooling_select/` is retired

> Full pipeline + formula engine details: `.claude/rules/mtc-tooling.md`
> SDS pipeline + ECR/Tumble/System routes: `.claude/rules/sds-pipeline.md`
