# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React 19 frontend and an Express.js backend. Core domains: MTC (Machine Tooling Configuration), Kanban task board, FEA simulation queues, ECN/ECR process workflows, and user/RBAC management.

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
npm run dev          # node runner.js
npm test             # Jest unit tests
npm run test:watch   # Jest watch mode
npm run test:coverage
npx jest --testPathPattern="<filename>"   # single test file
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
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, formula engine (`expr-eval`), tooling selection
  - `api/engineer/process/` — ECR/ECN workflow, tumble conditions
  - `api/kanban/` — real-time board/card CRUD via Socket.io
  - `api/fea/` — FEA simulation (BullMQ job queue + `fea_worker.js`); **not** under `api/engineer/`
  - `api/user/` — JWT auth, user profile, RBAC roles
  - `api/system/` — Gmail integration, system settings, user management schema
- **Database:** Raw `pg.Pool` (no Sequelize) from `instance/`:
  - `instance/eng_db.js` → `engPool` — main app DB (`eng_system`) on port 6543
  - `instance/instance.js` → `pool` — factory DB `rodpc` on port 5432
  - `instance/maq_db.js` → `maqPool` — factory DB `maqdb` on port 5432
- **Auth middleware:** Two separate files:
  - `middleware/auth.js` — `verifyToken` (JWT), `generateToken`
  - `middleware/mtcAuth.js` — role-based guards: `isAdmin` = dept/role 'AD' only; `isEngineer` = 'AD' or 'Engineering'
  - `toolingSelectController.js` imports `isAdmin` from `mtcAuth.js` (do not redefine it locally)
- **JWT payload shape:** `{ empno, name, department, group, role }` — in Kanban routes `empno` is mapped to `id` via middleware in `server.js`
- **Constants:** Domain-specific paths and table names in `<domain>Constants.js`; never hardcode table names. MTC table names are in `api/engineer/mtc/mtcConstants.js` → `TABLES`
- **FEA dependency:** Requires Redis (BullMQ) at `REDIS_HOST/REDIS_PORT` env vars — gracefully skips if Redis is absent

### Frontend (`apps/ENG-Frontend`)
- **Entry:** `App.jsx` — React Router v7 routes; `ProtectedRoute` wraps all auth-required paths
- **Auth state:** Zustand store at `src/stores/authStore.js`
- **UI:** Ant Design v5 + vanilla CSS. No TailwindCSS.
- **API constants:** `src/constance/constance.js` (server URL, endpoint paths); `src/constance/mtc_constance.js` (MTC paths, statuses, machine types)
  - `apiUrl` is hardcoded to `http://plbmp118:2005/` — change to `http://localhost:2005/` for local dev
  - `constance_prod.js` mirrors `constance.js` for production builds — **add new API constants to both files**
- **Component structure:** `src/components/engineer/<domain>/` mirrors backend domains
- **Custom hooks:** `src/hooks/` — keep data-fetching and complex logic out of components
- **3D:** Three.js / `@react-three/fiber` used in FEA simulation and Bushing Configurator
- **Real-time:** Socket.io client for Kanban live updates
- **Navigation:** Adding a new page requires updating both `App.jsx` (route) and `menu_sidebar.jsx` (sidebar entry). MTC path constants live in `src/constance/mtc_constance.js` → `MTC_PATHS`

### Infrastructure
- **Docker:** `docker-compose.yml` — backend (port 2005) + frontend (port 80) + PostgreSQL volume for uploads
- **Nginx:** `/api/` → backend:2005; `/uploads/` → backend:2005; `/ws` → WebSocket upgrade; `/` → React static
- **Production:** PM2 manages the backend process; Nginx serves the React `build/` folder as static files

### Environment Variables (`apps/ENG-Backend/.env`)

| Group | Vars | Notes |
|---|---|---|
| **Main DB** | `PG_NEW_HOST`, `PG_NEW_PORT`, `PG_NEW_DB`, `PG_NEW_USER`, `PG_NEW_PASS` | `eng_system` on port 6543 → `engPool` |
| **Factory DB** | `PG_RODPC_HOST/PORT/DB/USER/PASSWORD` | `rodpc` on 5432 → `pool` |
| **MAQ DB** | `PG_MAQ_HOST/PORT/DB/USER/PASSWORD` | `maqdb` on 5432 → `maqPool` |
| **QC DB** | `PG_RODQC_HOST/PORT/DB/USER/PASSWORD` | `rodqc` on 5432 → `maqQcPool` |
| **Auth** | `JWT_SECRET` | Signs all tokens |
| **Redis** | `REDIS_HOST`, `REDIS_PORT` | BullMQ for FEA; backend starts without it |
| **Gmail** | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI`, `GMAIL_REFRESH_TOKEN` | OAuth2 integration |
| **Proxy** | `PROXY_HOST`, `PROXY_PORT`, `PROXY_USER`, `PROXY_PASS` | Corporate proxy for outbound HTTP |
| **MTC scripts** | `PYTHON_EXE`, `TOOLING_IMPORT_SCRIPT` | PC-tooling import pipeline |
| **Misc** | `EXTERNAL_JOB_CHECK_API_KEY`, `GAS_EMAIL_URL` | External integrations |

Frontend (`apps/ENG-Frontend/.env`) only needs `BROWSER=none` and `GENERATE_SOURCEMAP=false`; the API base URL is set in `constance.js` not via env.

## Key Conventions

### Security (mandatory)
- Always use parameterized queries for SQL — never interpolate user input directly
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin` middleware; engineer actions with `isEngineer`
- `verifyToken` must be applied to all non-public routes; public exceptions are listed explicitly in `server.js`

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
4. Add new API endpoint constants to **both** `src/constance/constance.js` and `src/constance/constance_prod.js`

### PDF / Excel generation
- PDF: Puppeteer (renders HTML templates server-side) or `pdf-lib` / `pdfkit`
- Excel: `exceljs` with template-based mapping; mapping config lives in `template_excel_mapping` DB table
- Generation logic belongs in the Service layer, not the controller

## MTC Tooling Selection — Full Pipeline

The tooling search (`POST /api/tooling-select/search`) orchestrates multiple services in `fixtureLogic.js`:

```
fixtureLogic.findFixtures(cnNumber)
  ├─ partDataMapper.fetchSpecRow()         → raw part spec from DB
  ├─ partDataMapper.mapPartData()          → normalized part object
  ├─ partDataMapper.computeDerivedFlags()  → isYBall, isIDtoOD, isABR...
  ├─ FormulaService.calculateMachineParams() × all machines (parallel)
  │    └─ reads tooling_formula table, evaluates with expr-eval
  ├─ partDataMapper.buildCalcMap()         → merges formula output with adaptors
  ├─ machineQueryService.computeOkFlags()  → eligibility flags per machine
  ├─ machineQueryService.fetchToolingRows()→ hardcoded SQL for 8 legacy machines
  ├─ fixtureAssembler.assembleResults()   → formats rows per machine
  └─ dynamicLogic.findDynamicFixtures()   → reads mtc_selection_rules for new machines
```

### Two search paths for tooling lookup

| Path | Machines | Configured via |
|---|---|---|
| **Legacy** (`machineQueryService.fetchToolingRows`) | KSB22G, KSB80, TSG300, KS03A, KS400B, KS500RD, KS400B5, KS400B6 | Hardcoded SQL (inventory lookup only — formula calculation is DB-driven for all) |
| **Dynamic** (`dynamicLogic.findDynamicFixtures`) | Any new machine | `mtc_selection_rules` table |

### Three-table dependency for a new machine

A new machine created via +Add Tool only returns search results when **all three** are configured:

1. **`tooling_<machine>`** — inventory table (created by +Add Tool → New Machine)
2. **`tooling_formula`** — formula rows for the machine (via Formula Setting UI)
3. **`mtc_selection_rules`** — linking calc output to inventory columns (via Selection Rules in ToolManagementPage)

### `mtc_selection_rules` schema

Key columns for the dynamic (new-style) approach:
- `machine_name` — display name
- `tool_category` — tool type, e.g. "JAW"
- `target_tool_table` — inventory table, e.g. `tooling_ksx100`
- `calc_context` — key into `allCalcs` object returned by FormulaService, e.g. `ks400b`
- `machine_ok_condition` — key in `okFlags`; if `false`, machine is skipped
- `dims` (JSONB) — array of `{ calc_key, tool_field, tol_plus, tol_minus, label, sort_priority, penalty_over }`
- `result_fields` (JSONB) — array of `{ tool_field, label }` controlling result display columns
- `is_active` — soft-delete flag

**`dims[].calc_key`** must match a `parameter_name` in `tooling_formula` for the same machine (or a derived key produced by `FormulaService._enrichContext`, e.g. `odAft_max`, `W_max`). There is no DB foreign key — the linkage is by naming convention only.

**`SelectionRuleManager.jsx` live validation**: The `DimsEditor` and `ResultFieldsEditor` sub-components fetch valid values at edit time — `calc_key` options come from `GET /api/mtc/tooling-formula/:machineName` and `tool_field` options come from `GET /api/tooling-select/columns/:tableName`. Both show a red border + warning icon when a saved value is not found in current options.

## MTC Formula Engine

- Formulas stored in `tooling_formula` table (sole formula store — `mtc_formulas` table is retired and should be dropped from DB), evaluated sequentially at runtime with `expr-eval`
- `FormulaService` (`api/engineer/mtc/services/FormulaService.js`) extends `expr-eval` with:
  - `round05`, `ceil05`, `floor05` — round to nearest 0.5
  - `lookup(val, v1, v2, ...)` — returns first value in list ≥ val
  - Overridden `ceil(x, n)` / `floor(x, n)` / `round(x, n)` with optional decimal precision
  - `_enrichContext()` — adds derived vars: `odAft_max`, `odAft_min`, `W_max`, `T1`, `SD`, `Offset`, plus all single letters A–Z default to **0**. Each machine must supply its own A–Z values via explicit `tooling_formula` rows — there are no inherited "jawA" defaults. KS-B22G / KS-B80 use hardcoded SQL in `machineQueryService` and never call `_enrichContext`.
- Formulas are evaluated sequentially: each formula's output becomes a variable available to subsequent formulas in the same machine run
- Multi-statement formulas use `;` separator; assignment form `varName = expr` stores intermediate values; the assignment regex uses a negative lookahead `=(?!=)` to avoid matching `==` as an assignment
- `_preprocess()` handles: Excel-style `func(var, list)` → `lookup(var, list)`, `&&`/`||` → `and`/`or`, unquoted enum auto-quoting. Note: `Y` and `N` are intentionally NOT auto-quoted (they map to A–Z dimension defaults = 0, not string literals)
- All machine calculation logic lives in `tooling_formula` DB rows — `services/calculationLogic.js` now only exports `calculateSD(part)` (returns SD value for a part, or null)
- The formula engine is the calculation source of truth — do not duplicate logic in frontend constants

### Visual Formula Builder

`src/components/engineer/mtc_eng/formula-builder/FormulaBuilderInput.jsx` — reusable Form.Item-compatible component:
- Exports `FORMULA_VARS` (35 categorized variables) used across formula editing UIs
- Visual mode: template-based (arithmetic, rounding, conditional, lookup). Arithmetic template supports **N terms** via `simpleTerms[]` / `simpleOps[]` arrays — not limited to two operands. Switching to Visual is disabled if the current formula string can't be round-tripped through `parseFormula`.
- Text mode: raw formula string. The `value` prop is always the source of truth; `formulaPreview` always reflects it.
- `onTest` prop: async `(formulaStr) => { valid, result, error }` — calls `POST /api/mtc/tooling-formula/test` (`MTC_FORMULA_TEST` constant)
- Used in: `ToolingSelectPage.jsx` (inline formula editing per tooling row) and `ToolManagementPage.jsx` (formula settings full-page view + add-tool wizard)

### Tooling Select API Routes

`toolingSelectController.js` at `/api/tooling-select/*`:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/tooling-select/search` | Main tooling search by CN number |
| `GET` | `/api/tooling-select/rules` | List all active selection rules |
| `POST/PUT/DELETE` | `/api/tooling-select/rules[/:id]` | CRUD for selection rules (isAdmin) |
| `GET` | `/api/tooling-select/rules/validate` | Health check: cross-checks every active rule's `dims[].calc_key` against current formula params + enriched context keys; returns `{ issues[], valid_keys_by_context }` |
| `GET` | `/api/tooling-select/columns/:tableName` | Real column names from an inventory table (whitelisted via `inventoryService.tableExists()`) — used by SelectionRuleManager for live `tool_field` validation |
| `GET` | `/api/tooling-select/tables` | List all tooling inventory tables |
| `GET` | `/api/tooling-select/tooling-names/:tableName` | Distinct tooling names in a table |
| `GET/POST/PUT/DELETE` | `/api/tooling-select/inventory/:tableName[/:id]` | Inventory CRUD (isAdmin for mutations) |
| `GET/POST/PUT/DELETE` | `/api/tooling-select/spec[/:cn]` | Part spec CRUD (isAdmin for mutations) |
| `POST` | `/api/tooling-select/create-table` | Create new tooling inventory table (isAdmin) |

### Formula API Routes (current)

All formula operations go through `toolingFormulaController.js` at `/api/mtc/tooling-formula/*`:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/mtc/tooling-formula/test` | Evaluate a formula string (no DB access, uses FormulaService) |
| `GET` | `/api/mtc/tooling-formula/machines` | Distinct machine names in `tooling_formula` |
| `GET` | `/api/mtc/tooling-formula/:machineName` | Formula rows; optional `?tooling_name=` filter |
| `POST` | `/api/mtc/tooling-formula` | Create formula row (isAdmin) |
| `PUT` | `/api/mtc/tooling-formula/:id` | Update formula row (isAdmin) — runs in a **transaction**; if `parameter_name` changes, cascades the rename into `mtc_selection_rules.dims[].calc_key` for all active rules whose `calc_context` normalizes to the same machine |
| `DELETE` | `/api/mtc/tooling-formula/:id` | Hard-delete formula row (isAdmin) |

The legacy `/api/mtc/formulas/*` routes and `formulaController.js` have been deleted. Do not recreate them.

### ToolManagementPage

`src/components/engineer/mtc_eng/tooling_select/ToolManagementPage.jsx` — standalone page (has its own route + sidebar entry) for admin-side tooling management.

Uses a single `activeView` state (`'main'` | `'formula'` | `'machineLimits'` | `'selectionRules'`) to switch the entire content area between views — **not** modal/drawer overlays. The header re-renders with a back button + contextual action buttons for each view.

- **`'main'`** — machine selector + inventory table with inline editing
- **`'formula'`** — full-page CRUD for `tooling_formula` rows (scoped to selected machine/tooling-name); includes test-simulation panel with mock part dimensions; action buttons (Test, Add Formula, Save) live in the header
- **`'machineLimits'`** — full-page editor for `mtc_machine_config` rows (eligibility conditions + Dynamic Rules toggle per machine)
- **`'selectionRules'`** — `SelectionRuleDrawer` rendered inline via `inline={true}` prop

**Health Check button** (main header) — calls `GET /api/tooling-select/rules/validate`, opens a modal showing bad `calc_key` per rule with a "Replace with" dropdown. "Apply Fixes" PUTs the corrected dims back and re-runs audit automatically.

**`toolingTables` array** — hardcoded list of known legacy machines + inventory tables. Adding a new legacy machine requires updating this array manually.

### Selection Rules UI

`SelectionRuleDrawer` (exported from `tooling_select/SelectionRuleManager.jsx`) supports two rendering modes:
- **Drawer mode** (default, `inline=false`): slides in from the right — used in `ToolingSelectPage`
- **Inline mode** (`inline={true}`): renders directly into the parent layout — used in `ToolManagementPage` full-page `selectionRules` view

When `inline=true`, the component loads data on mount (not gated by `open` prop), and renders an "Add Rule" button at the top instead of a Drawer header.

### Known Sync Risks (hardcode)

These values exist in **both** backend and frontend — changing one without the other causes silent divergence:

| Value | Backend location | Frontend location |
|---|---|---|
| `idAft >= 12.0` threshold (KS-B22RD vs KS-03A routing) | `services/partDataMapper.js` | `ToolingSelectPage.jsx` |
| `normalBaseC = 18.5 + (wAft/2) + 3` | formula in `tooling_formula` DB | `ToolManagementPage.jsx` test simulation context (hardcoded) |
| `jawB = jawA - 0.4` | formula in `tooling_formula` DB | `ToolManagementPage.jsx` test simulation context (hardcoded) |

`ENRICHED_CONTEXT_KEYS` set in `toolingSelectController.js` (used by `/rules/validate`) must also be kept in sync with `FormulaService._enrichContext()` — there is a comment in the controller marking this dependency.

`tooling_formula` table name is still hardcoded as a string in `toolingFormulaController.js` — `TABLES.TOOLING_FORMULA` constant does not yet exist in `mtcConstants.js`.

`inventoryService.js` caches column schema per table with a 5-minute TTL (`_colCache` + `_colCacheAt`). Schema changes to inventory tables are visible within 5 minutes without restart; `registerTable()` immediately invalidates the cache for a given table.

### MTC Legacy Duplicate Files

Several files exist both at `api/engineer/mtc/<file>.js` (old) **and** at `api/engineer/mtc/services/<file>.js` (active). Always use the `services/` versions:

| Active (`services/`) | Legacy root (ignore) |
|---|---|
| `services/fixtureLogic.js` | `fixtureLogic.js` |
| `services/dynamicLogic.js` | `dynamicLogic.js` |
| `services/calculationLogic.js` | `calculationLogic.js` |
| `services/partDataMapper.js` | _(no root duplicate)_ |

The root-level duplicates are dead code — do not edit them.
