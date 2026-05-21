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
  - `api/engineer/mtc/` — tooling inspection, SDS v1/v2, formula engine (`expr-eval`), tooling selection, tool-request workflow
  - `api/engineer/process/` — ECR workflow (`/api/ecr/*`), tumble conditions/models (`/api/tumble/*`)
  - `api/engineer/system/` — PDF converter (`pdfConverter.js`) at `/api/engineer/system`
  - `api/engineer/new_prod/` — external job-check proxy (`/api/proxy/job_check`, **no auth** — whitelisted in the global auth middleware)
  - `api/kanban/` — real-time board/card CRUD via Socket.io
  - `api/fea/` — FEA simulation (BullMQ job queue + `fea_worker.js`); **not** under `api/engineer/`
  - `api/user/` — JWT auth, user profile, RBAC roles
  - `api/system/` — Gmail integration, system settings (`/api/system/settings`), user management schema (`/api/system/user-management/*`)
- **Database:** Raw `pg.Pool` (no Sequelize) from `instance/`:
  - `instance/eng_db.js` → `engPool` — main app DB (`eng_system`) on port 6543
  - `instance/instance.js` → `pool` — factory DB `rodpc` on port 5432
  - `instance/maq_db.js` → `maqPool` — factory DB `maqdb` on port 5432
  - `maqQcPool` appears in `.env` (`PG_RODQC_*`) but **no instance file exists** for it — the env vars are declared but unused in current code
- **Auth middleware:** Two separate files:
  - `middleware/auth.js` — `verifyToken` (JWT), `generateToken`
  - `middleware/mtcAuth.js` — exports `authorize(roles[])` factory plus pre-built `isAdmin` (dept/role 'AD') and `isEngineer` ('AD' or 'Engineering'). Use `authorize(['AD', 'SomeOtherDept'])` for custom role combos. `toolingSelectController.js` imports `isAdmin` from here — do not redefine it locally.
  - **Inline guards in `server.js`:** `requireSuperAdminOrEmergency` (for schema-altering user-management routes) and `requireSystemEngineer` (for settings writes) are defined inline in `server.js`, not in middleware files
- **JWT payload shape:** `{ empno, name, department, group, role }` — in Kanban routes `empno` is mapped to `id` via middleware in `server.js`
- **Constants:** Domain-specific paths and table names in `<domain>Constants.js`; never hardcode table names. MTC table names are in `api/engineer/mtc/mtcConstants.js` → `TABLES`
- **FEA dependency:** Requires Redis (BullMQ) at `REDIS_HOST/REDIS_PORT` env vars — gracefully skips if Redis is absent

### Frontend (`apps/ENG-Frontend`)
- **Entry:** `App.jsx` — React Router v7 routes; `ProtectedRoute` wraps all auth-required paths
- **Auth state:** Zustand store at `src/stores/authStore.js`
- **UI:** Ant Design v5 + vanilla CSS. No TailwindCSS. Use `destroyOnHidden` (not `destroyOnClose`) on Modal/Drawer — `destroyOnClose` is deprecated in antd v5.
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
| **SDS PDF** | `SOFFICE_PATH`, `SDS_TEMPLATE_DIR` | LibreOffice `soffice.exe` path (default: `./tools/LibreOfficePortable/.../soffice.exe`); SDS template dir (default: `api/engineer/mtc/templates/`) |
| **Misc** | `EXTERNAL_JOB_CHECK_API_KEY`, `GAS_EMAIL_URL` | External integrations |

Frontend (`apps/ENG-Frontend/.env`) only needs `BROWSER=none` and `GENERATE_SOURCEMAP=false`; the API base URL is set in `constance.js` not via env.

## Key Conventions

### Security (mandatory)
- Always use parameterized queries for SQL — never interpolate user input directly
- Whitelist table/column names for any dynamic query construction
- Guard admin mutations with `isAdmin` middleware; engineer actions with `isEngineer`
- `verifyToken` must be applied to all non-public routes; public exceptions are listed explicitly in `server.js`
- `middleware/auth.js` accepts JWT via `req.query.token` as fallback to `Authorization` header — added for file-download endpoints opened via `<a target="_blank">`. All non-download routes should use the header form only.

### Machine Name Hyphen Convention (MTC)

Machine names **must use hyphens** consistently across all storage locations. `FormulaService` uses exact-match SQL (`WHERE machine_name = $1`) — a missing hyphen silently returns `0` for every parameter with no error thrown.

Canonical names (hyphen form): `KS-B22G`, `KS-B80`, `KS-03A`, `KS-B22RD`, `KS-400B5`, `KS-400B6`, `KS-500RD`, `TSG-300ZNC`, `TSG-300W`  
Exception: `KS400B` intentionally has no hyphen — consistent in both code and DB.

When renaming a machine in `LEGACY_MACHINES` (ToolingOrchestrator) or `machineTableConfig.js`, always pair with a DB migration:
```sql
UPDATE tooling_formula        SET machine_name  = 'KS-XXX' WHERE machine_name  = 'KSXXX';
UPDATE tooling_selection_rules SET calc_context  = 'KS-XXX' WHERE calc_context  = 'KSXXX';
UPDATE tooling_selection_rules SET machine_name  = 'KS-XXX' WHERE machine_name  = 'KSXXX';
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
4. Add new API endpoint constants to **both** `src/constance/constance.js` and `src/constance/constance_prod.js`

### Bulk DB operations (pg.Pool)

When inserting or fetching many rows, **never loop individual queries** — use bulk patterns:
- **Fetch:** `WHERE col = ANY($1)` with an array param, then build a lookup map from results
- **Insert:** multi-row VALUES in chunks of 2000 rows (24 params × 2000 = 48000 < pg 65535 limit)

```javascript
// Bulk fetch
const r = await pool.query(`SELECT * FROM t WHERE col = ANY($1)`, [ids]);
const map = Object.fromEntries(r.rows.map(row => [row.col, row]));

// Multi-row insert — build placeholders dynamically
const COLS = 24;
const placeholders = chunk.map((_, ri) =>
  `(${Array.from({ length: COLS }, (__, ci) => `$${ri * COLS + ci + 1}`).join(',')})`
).join(',');
await pool.query(`INSERT INTO t (...) VALUES ${placeholders}`, chunk.flat());
```

Per-row loops for 500+ items cause HTTP timeouts (~90s). Bulk approach completes in ~10s.

**INSERT column order** must exactly match the parameter array position-by-position. A mismatch silently writes wrong data or throws a type error (e.g., string `"N"` into a numeric column) with no obvious link to the INSERT. Count `$n` positions explicitly when writing parameterized INSERTs.

### PDF / Excel generation
- PDF: Puppeteer (renders HTML templates server-side) or `pdf-lib` / `pdfkit`
- Excel: `exceljs` with template-based mapping; mapping config lives in `template_excel_mapping` DB table
- Generation logic belongs in the Service layer, not the controller
- ExcelJS solid fill cells **must** set both `fgColor` and `bgColor` — LibreOffice ignores fills where `bgColor` is absent, producing a white cell in the rendered PDF.

## MTC Tooling Selection — Full Pipeline

The tooling search (`POST /api/tooling-select/search`) runs through `ToolingOrchestrator.js`. `fixtureLogic.js` is now a thin re-export wrapper — do not add logic there.

```
ToolingOrchestrator.findFixtures(cnNumber)
  ├─ CacheAgent.get('tooling:{CN}')        → return immediately on hit (5-min TTL)
  ├─ SpecAgent.execute()                   → fetchSpecRow → mapPartData → computeDerivedFlags
  ├─ FormulaAgent × N machines             → Promise.allSettled (parallel, partial-failure OK)
  │    └─ FormulaService.calculateMachineParams() per machine → tooling_formula table
  ├─ buildCalcMap()                        → merges formula output with machine adapters
  ├─ computeOkFlags()                      → eligibility flags per machine
  ├─ Promise.all([                         → legacy search + dynamic search in PARALLEL
  │    fetchToolingRows(),                 → hardcoded SQL for 8 legacy machines
  │    findDynamicFixtures()               → tooling_selection_rules for new machines
  │  ])
  ├─ assembleResults()                     → formats + ranks per machine
  └─ CacheAgent.set('tooling:{CN}', result, 5min)
```

### Agent Layer (`services/agents/`)

All agents extend `BaseAgent` which provides: **timeout per agent**, **uniform error shape** `{ _agentError, agent, error }`, and **automatic latency recording** to `MonitorAgent`.

| File | Role | Timeout |
|---|---|---|
| `BaseAgent.js` | Base class — `execute()` wraps `run()` with timeout + catch + monitor | — |
| `MonitorAgent.js` | Singleton — rolling-window latency stats per agent name; `getAllStats()`, `slowAgents(ms)` | — |
| `CacheAgent.js` | Singleton — in-memory TTL Map; `get/set/invalidate/invalidatePrefix`; `TTL.TOOLING=5min`, `TTL.SDS=10min` | — |
| `SpecAgent.js` | Wraps `partDataMapper` fetch + normalize + derivedFlags | 5 s |
| `FormulaAgent.js` | Wraps `FormulaService.calculateMachineParams` for one machine | 8 s |
| `SdsAgent.js` | Wraps `sdsV2SearchService.searchByCn`; on connection error retries with `NULL_POOL` (graceful degradation) | 15 s |

**Formula Swarm failure behaviour:** if one `FormulaAgent` times out or errors, its machine is skipped. The response includes `_formulaWarnings: { machineName: reason }` instead of crashing the request.

**SDS degradation:** if `rodpcPool` is unreachable, `SdsAgent` retries with a null pool → response still contains MAQ data but `production: null` and `process_names: []`, with `_rodpcUnavailable: true`.

### Cache Invalidation Rules

Any mutation that affects tooling search results must call `cache.invalidatePrefix('tooling:')` or `invalidateCache(cn)` after the DB write:

| Trigger | Scope |
|---|---|
| Formula create / update / delete (`toolingFormulaController`) | `tooling:*` — all CNs |
| Selection rule create / update / delete | `tooling:*` — all CNs |
| Inventory update / delete | `tooling:*` — all CNs |
| Machine config create / update / delete | `tooling:*` — all CNs |
| Spec update / delete | `tooling:{cn}` — specific CN only |
| SDS | TTL-only (no write path into maqdb/rodpc) |

Import `{ invalidateCache }` from `ToolingOrchestrator` for CN-specific invalidation; import `cache` from `agents/CacheAgent` for prefix flush.

### Two search paths for tooling lookup

| Path | Machines | Configured via |
|---|---|---|
| **Legacy** (`machineQueryService.fetchToolingRows`) | KSB22G, KSB80, TSG300, KS03A, KS400B, KS500RD, KS400B5, KS400B6 | Hardcoded SQL inventory lookup. Any machine with `use_dynamic_rules=true` in `tooling_machine_config` is **skipped here** and handled by `dynamicLogic` instead. |
| **Dynamic** (`dynamicLogic.findDynamicFixtures`) | Any new machine | `tooling_selection_rules` table |

**KS-B80 has no FormulaAgent run** — it is absent from `LEGACY_MACHINES` in `ToolingOrchestrator.js`, so no DB formula calculation occurs for it. Its eligibility and inventory lookup are handled entirely by hardcoded logic in `machineQueryService` / `searchFunctions`. Formula rows in `tooling_formula` for `KS-B80` are not evaluated by the pipeline.

### Three-table dependency for a new machine

A new machine created via +Add Tool returns search results when **all three** are configured — **no code change required**:

1. **`tooling_<machine>`** — inventory table (created by +Add Tool → New Machine)
2. **`tooling_formula`** — formula rows for the machine (via Formula Setting UI)
3. **`tooling_selection_rules`** — linking calc output to inventory columns (via Selection Rules in ToolManagementPage)

`dynamicLogic.js` auto-detects any `calc_context` not already in `allCalcs`, looks up the matching formula machine name from `tooling_formula`, and calculates it at runtime — so new machines work without touching `fixtureLogic.js` or `partDataMapper.js`.

### `tooling_selection_rules` schema

Key columns for the dynamic (new-style) approach:
- `machine_name` — display name
- `tool_category` — tool type, e.g. "JAW"
- `target_tool_table` — inventory table, e.g. `tooling_ksx100`
- `calc_context` — for **new machines**: set this to the exact `machine_name` as stored in `tooling_formula` (e.g. `KSX100`). For **legacy machines**: the short-key forms (`ks400b`, `ks03a`, etc.) are kept for backward compat. Matching is by normalization: `toLowerCase().replace(/-/g, '')` — so `KS-X100`, `KSX100`, and `ksx100` all resolve to the same formula machine.
- `machine_ok_condition` — key in `okFlags`; if `false`, machine is skipped
- `dims` (JSONB) — array of `{ calc_key, tool_field, tol_plus, tol_minus, label, sort_priority, penalty_over }`
- `result_fields` (JSONB) — array of `{ tool_field, label }` controlling result display columns
- `is_active` — soft-delete flag

**`dims[].calc_key`** must match a `parameter_name` in `tooling_formula` for the same machine (or a derived key produced by `FormulaService._enrichContext`, e.g. `odAft_max`, `W_max`). There is no DB foreign key — the linkage is by naming convention only.

**`SelectionRuleManager.jsx` live validation**: The `DimsEditor` and `ResultFieldsEditor` sub-components fetch valid values at edit time — `calc_key` options come from `GET /api/mtc/tooling-formula/:machineName` and `tool_field` options come from `GET /api/tooling-select/columns/:tableName`. Both show a red border + warning icon when a saved value is not found in current options.

**`calc_context` auto-fill** — hidden from the Add/Edit Rule form; automatically set equal to the selected `machine_name`. `machine_ok_condition` is also hidden and auto-filled from `GET /api/tooling-select/machine-config` (`ok_flag_key` for that machine). `target_tool_table` is auto-populated from `GET /api/tooling-select/machine-table-config` (matching `tfMachine`) or by `tooling_<normalized_name>` convention for new machines not in that list. An info bar in the form shows the auto-filled values so admins can verify.

## MTC Formula Engine

- Formulas stored in `tooling_formula` table (sole formula store — `mtc_formulas` table is retired and should be dropped from DB), evaluated sequentially at runtime with `expr-eval`
- `FormulaService` (`api/engineer/mtc/services/FormulaService.js`) extends `expr-eval` with:
  - `round05`, `ceil05`, `floor05` — round to nearest 0.5
  - `lookup(val, v1, v2, ...)` — returns first value in list ≥ val
  - `roundN(x, n)` / `ceilN(x, n)` / `floorN(x, n)` — precision rounding with optional decimal places. **Do NOT use `round(x,n)` in DB formulas** — `expr-eval` v2 registers `round/ceil/floor` as built-in unary operators; a second argument causes a parse error even when `parser.functions.round` is overridden. `_preprocess()` auto-rewrites `round(` → `roundN(` etc. before parsing, so existing DB formulas with `round(x, n)` continue to work transparently.
  - `_enrichContext()` — adds derived vars: `odAft_max`, `odAft_min`, `W_max`, `T1`, `SD`, `isInner` (type includes INNER or yBall=Y), `Offset`, plus all single letters A–Z default to **0**. Each machine must supply its own A–Z values via explicit `tooling_formula` rows — there are no inherited "jawA" defaults. KS-B80 does **not** use FormulaAgent at all (absent from `LEGACY_MACHINES`); its calc is entirely hardcoded in `searchFunctions.js`.
- Formula rows are evaluated in **`id ASC` order** — each row's output is written into the shared context for subsequent rows. `formula_type = 'limit'` rows are skipped during evaluation. When adding formulas that reference output from a prior group, verify `id` ordering in the DB — wrong order produces silent incorrect results, not errors.
- If a machine's `tooling_formula` rows are absent or incomplete, `FormulaService` returns **`0`** for all missing parameters — no error is thrown. Always verify formula row counts in DB before deploying a migration that removes hardcoded values.
- Formulas are evaluated sequentially: each formula's output becomes a variable available to subsequent formulas in the same machine run
- Multi-statement formulas use `;` separator; assignment form `varName = expr` stores intermediate values; the assignment regex uses a negative lookahead `=(?!=)` to avoid matching `==` as an assignment
- `_preprocess()` handles (in order): `round/ceil/floor(` → `roundN/ceilN/floorN(`, arrow normalization, Excel-style lookup, `&&`/`||` → `and`/`or`, unquoted enum auto-quoting. Note: `Y` and `N` are intentionally NOT auto-quoted (they map to A–Z dimension defaults = 0, not string literals)
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
| `GET` | `/api/tooling-select/rules/validate` | Health check: cross-checks every active rule's `dims[].calc_key` against current formula params + enriched context keys; also cross-checks `calc_context` values against `sds_machine_type_code.machine_type_name` for cross-system mismatches; returns `{ issues[], valid_keys_by_context, enriched_context_keys, machine_sync: { ok, in_formula_not_sds, in_sds_not_formula } }` |
| `GET` | `/api/tooling-select/columns/:tableName` | Real column names from an inventory table (whitelisted via `inventoryService.tableExists()`) — used by SelectionRuleManager for live `tool_field` validation |
| `GET` | `/api/tooling-select/tables` | List all tooling inventory tables |
| `GET` | `/api/tooling-select/machine-table-config` | Static display config for all known legacy machines (key, label, table, tfMachine, machineFilter) — sourced from `services/machineTableConfig.js` using `TABLES` constants |
| `GET` | `/api/tooling-select/tooling-names/:tableName` | Distinct tooling names in a table |
| `GET/POST/PUT/DELETE` | `/api/tooling-select/inventory/:tableName[/:id]` | Inventory CRUD (isAdmin for mutations) |
| `GET/POST/PUT/DELETE` | `/api/tooling-select/spec[/:cn]` | Part spec CRUD (isAdmin for mutations) |
| `GET` | `/api/tooling-select/spec/factory-preview/:cn` | Read-only preview: fetches lpb.* dimensions via maqPool + derives `yball`/`process` — never writes to engPool |
| `POST` | `/api/tooling-select/spec/sync/:cn` | Upserts factory-derived dimensions into `tooling_spec_process` (engPool); invalidates `tooling:{cn}` cache (CN-scoped only). On existing rows: overwrites dimensions + sd, overwrites `yball`/`process` only when derived, **never overwrites `type`** |
| `POST` | `/api/tooling-select/spec/sync-new` | Bulk inserts spec rows for CNs that exist in factory (`lpb.*`) but not yet in `tooling_spec_process`. No rodpcPool dependency. One run handles all new CNs. Uses `normalizeCn()` + `PREFIX_TABLE_MAP` (both in `toolingSelectController.js`). Strategy: bulk-fetch dims with `ANY($1)` per table, then multi-row INSERT in chunks of 2000. **Do not revert to per-CN loop** — 500 CNs × 2 queries = timeout. |
| `POST` | `/api/tooling-select/create-table` | Create new tooling inventory table (isAdmin) |
| `GET/POST/PUT/DELETE` | `/api/tooling-select/machine-config[/:id]` | CRUD for `tooling_machine_config` rows — eligibility conditions and Dynamic Rules toggle per machine (isAdmin for mutations) |
| `GET` | `/api/tooling-select/monitor` | Latency stats per agent + cache size/keys (isAdmin) |
| `DELETE` | `/api/tooling-select/monitor/cache` | Manual cache flush; `?prefix=tooling:` or `?prefix=sds:` for partial flush (isAdmin) |

### Formula API Routes (current)

All formula operations go through `toolingFormulaController.js` at `/api/mtc/tooling-formula/*`:

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/mtc/tooling-formula/test` | Evaluate a formula string (no DB access, uses FormulaService) |
| `GET` | `/api/mtc/tooling-formula/machines` | Distinct machine names in `tooling_formula` |
| `GET` | `/api/mtc/tooling-formula/:machineName` | Formula rows; optional `?tooling_name=` filter |
| `POST` | `/api/mtc/tooling-formula` | Create formula row (isAdmin) |
| `PUT` | `/api/mtc/tooling-formula/:id` | Update formula row (isAdmin) — runs in a **transaction**; if `parameter_name` changes, cascades the rename into `tooling_selection_rules.dims[].calc_key` for all active rules whose `calc_context` normalizes to the same machine |
| `DELETE` | `/api/mtc/tooling-formula/:id` | Hard-delete formula row (isAdmin) |

The legacy `/api/mtc/formulas/*` routes and `formulaController.js` have been deleted. Do not recreate them.

### ToolManagementPage

`src/components/engineer/mtc_eng/tooling_select/ToolManagementPage.jsx` — standalone page (has its own route + sidebar entry) for admin-side tooling management.

Uses a single `activeView` state (`'main'` | `'formula'` | `'machineLimits'` | `'selectionRules'`) to switch the entire content area between views — **not** modal/drawer overlays. The header re-renders with a back button + contextual action buttons for each view.

- **`'main'`** — machine selector + inventory table with inline editing
- **`'formula'`** — full-page CRUD for `tooling_formula` rows (scoped to selected machine/tooling-name); includes test-simulation panel with mock part dimensions; action buttons (Test, Add Formula, Save) live in the header
- **`'machineLimits'`** — full-page editor for `tooling_machine_config` rows (eligibility conditions + Dynamic Rules toggle per machine)
- **`'selectionRules'`** — `SelectionRuleDrawer` rendered inline via `inline={true}` prop

**Health Check button** (main header) — calls `GET /api/tooling-select/rules/validate`, opens a modal showing bad `calc_key` per rule with a "Replace with" dropdown. "Apply Fixes" PUTs the corrected dims back and re-runs audit automatically.

**`toolingTables` state** — fetched on mount from `GET /api/tooling-select/machine-table-config` (`MTC_MACHINE_TABLE_CONFIG` constant). The backend source is `services/machineTableConfig.js`. The API returns `machineFilter` as a string (`'W'`, `'NOT_W'`, or `null`); `ToolManagementPage.jsx` converts it to a row-filter function `mf`. Adding a new legacy machine requires adding an entry to `machineTableConfig.js` only — no frontend changes needed.

Notable shared-table entries in `machineTableConfig.js`:
- `KS-B22RD` and `KS-03A` both point to `TABLES.TOOLING_KS03A` (`tooling_ks03a`) — the backend uses `targetMachine` to distinguish them at result-assembly time
- `TSG-300ZNC` (`machineFilter: 'NOT_W'`) and `TSG-300W` (`machineFilter: 'W'`) both point to `TABLES.TOOLING_TSG300` (`tooling_tsg300`)

### Selection Rules UI

`SelectionRuleDrawer` (exported from `tooling_select/SelectionRuleManager.jsx`) supports two rendering modes:
- **Drawer mode** (default, `inline=false`): slides in from the right — used in `ToolingSelectPage`
- **Inline mode** (`inline={true}`): renders directly into the parent layout — used in `ToolManagementPage` full-page `selectionRules` view

When `inline=true`, the component loads data on mount (not gated by `open` prop), and renders an "Add Rule" button at the top instead of a Drawer header.

**Add/Edit Rule form** — only exposes Machine Name, Tool Category, and Inventory Table to the user. `calc_context` and `machine_ok_condition` are hidden `Form.Item`s that are auto-filled when Machine Name changes (see `autoFillFromMachine` callback). An info bar (`ThunderboltOutlined`) shows the auto-detected Calc and OK flag values. On edit, the info bar reflects the existing saved values; auto-fill only re-runs when the user actively changes Machine Name.

### Known Sync Risks (hardcode)

Previously critical sync risks — **now resolved**:

| Value | Resolution |
|---|---|
| `idAft >= 12.0` threshold (KS-B22RD vs KS-03A) | Backend computes `targetMachine` and sends it as `res.ks03a.machineName`; frontend reads that field — no longer duplicated |
| `normalBaseC`, `jawB` in test simulation panel | Extracted to `LEGACY_JAW_SIM` constant object in `ToolManagementPage.jsx` |
| `tooling_formula` table name | Now `TABLES.TOOLING_FORMULA` in `mtcConstants.js`; used in all controllers + FormulaService |
| `ENRICHED_CONTEXT_KEYS` | Defined once in `FormulaService.js`, exported as `instance.ENRICHED_CONTEXT_KEYS`; imported in `toolingSelectController.js`; non-letter keys also returned by `/rules/validate` as `enriched_context_keys` for frontend dropdowns |
| `toolingTables` machine list | Now fetched from `GET /api/tooling-select/machine-table-config`; source is `services/machineTableConfig.js` using `TABLES` constants |
| Audit modal `enrichedKeys` | Now read from `auditResult.enriched_context_keys` (API response) instead of a hardcoded array |
| Jaw/BP search tolerances in `searchFunctions.js` | Extracted to `KSB22G_SEARCH`, `KSB80_SEARCH`, `JAW_A_CLEARANCE`, `BP_A_MAX_EXCESS`, `KS400B_PLUG` constants at module top |
| `calc_context`, `machine_ok_condition`, `target_tool_table` in `SelectionRuleManager.jsx` | Were user-editable dropdowns. Now all three are auto-filled when Machine Name is selected: `calc_context` = machine_name; `machine_ok_condition` = `ok_flag_key` from `machine-config` API; `target_tool_table` = lookup from `machine-table-config` or naming convention. `calc_context` and `machine_ok_condition` are hidden Form.Items; `target_tool_table` remains a visible Select (pre-populated, overrideable). |
| New machine formula calculation in `fixtureLogic.js` | Was hardcoded to 7 machines; `dynamicLogic.js` now auto-detects any `calc_context` not in `allCalcs` and calls `FormulaService.calculateMachineParams` at search time — no code change needed to add a new machine |

**Remaining machine adapter constants** (in `partDataMapper.js`) — extracted to named constant objects at the top of the file but still code-level (not DB-driven). Changing machine dimension thresholds still requires a code deploy:

| Constant object | What it covers |
|---|---|
| `KS03A_PARAMS` | OD_MAX, CPX/RS/CHUTE/SG/PR type thresholds, chute E min, chute G max |
| `KS400B_PARAMS` | OD/W eligibility limits, SD/ID type thresholds, fixed PA_F/PB_F dimensions |
| `KS500RD_PARAMS` | ID/OD/W eligibility limits, FRONT_SHOE_MAP (W range → part number) |
| `KS400B5_PARAMS` | OD_MAX, WORK CLAMP / SHAFT type thresholds |
| `KS400B6_PARAMS` | PILOT PIN type thresholds, STOCKER CHUTE limits, drill/thread string lookup |

`LEGACY_JAW_SIM` in `ToolManagementPage.jsx` — these constants shadow `tooling_formula` DB values for the test simulation panel **only**. They must stay consistent with the actual formula rows for KS-B22G in the DB.

`inventoryService.js` caches column schema per table with a 5-minute TTL (`_colCache` + `_colCacheAt`). Schema changes to inventory tables are visible within 5 minutes without restart; `registerTable()` immediately invalidates the cache for a given table.

`MAX_JAW_DEPTH = 10.0` is defined in `fixtureAssembler.js` (exported) and imported in `fixtureLogic.js` — single definition.

### MTC Legacy Duplicate Files

Several files exist both at `api/engineer/mtc/<file>.js` (old) **and** at `api/engineer/mtc/services/<file>.js` (active). Always use the `services/` versions:

| Active (`services/`) | Legacy root (ignore) |
|---|---|
| `services/fixtureLogic.js` | `fixtureLogic.js` |
| `services/dynamicLogic.js` | `dynamicLogic.js` |
| `services/calculationLogic.js` | `calculationLogic.js` |
| `services/partDataMapper.js` | _(no root duplicate)_ |

The root-level duplicates are dead code — do not edit them.

## Tooling Select ↔ SDS: Relationship and Shared Pipeline

These two systems serve the same engineer workflow keyed on the same **CN number**, but they run through **entirely separate orchestrators** and pull from **different database pools**. They must stay coherent with each other — mismatches silently produce wrong outputs.

### Side-by-side pipeline

```
CN NUMBER
   │
   ├─── Tooling Select (POST /api/tooling-select/search)
   │       ToolingOrchestrator.findFixtures(cn)
   │         ├─ SpecAgent → tooling_spec_process (engPool)
   │         │    → odBf, idBf, wBf, odAft, idAft, wAft, type, yBall, process, sd …
   │         ├─ FormulaAgent × N machines → tooling_formula (engPool)
   │         ├─ computeOkFlags → tooling_machine_config (engPool)
   │         └─ Inventory search → tooling_ks* tables (engPool)
   │       Cache key: tooling:{CN}  TTL: 5 min
   │       Output: per-machine tooling fixture recommendations + dimensions
   │
   └─── SDS (GET /api/sds/v2/search + /api/sds/v2/pdf)
           SdsOrchestrator.search(cn)
             └─ SdsAgent → sdsV2SearchService.searchByCn()
                  ├─ lpb.eng_ball/body/race/sleeve/sph (maqPool)  ← part dimensions
                  ├─ lpb.eng_r_pi_tool, lpb.eng_tooling (maqPool) ← process plan + tool DWG nos
                  ├─ lpb.eng_r_pi_item, lpb.eng_item (maqPool)    ← BOM, parts_no
                  ├─ lpb.eng_cad_rev_data, lpb.eng_process_info (maqPool)
                  └─ rodpc.kzwmaq_eng_production/process (rodpcPool) ← model, customer, process names
           Cache key: sds:{CN}  TTL: 10 min
           Output: part info, dimensions, process plan, tooling list

           PDF generation (sdsV2PdfController.buildValueMap):
             ├─ sdsV2SearchService data (maqPool + rodpcPool) ← part/production data
             ├─ sds_machine_tool (engPool) ← whitelist + ordering of tools T01–T20
             ├─ sds_parameter (engPool) ← per-CN or machine-config manual values
             ├─ sds_machine_type_code.grinding_area_label (engPool)
             ├─ sds_tooling_image (engPool) ← tool drawing images per slot
             └─ sds_grinding_image (engPool) ← grinding layout diagram
           → mapped to sds_excel_mapping cell addresses → sds_template.xlsx → LibreOffice PDF
             (images placed per IMAGE_EXTENTS map in sdsV2PdfController.js — update if template layout changes)
```

### Critical coupling points (where the two systems must stay in sync)

**1. `tooling_spec_process` vs `lpb.*` part dimensions**

Tooling Select uses `tooling_spec_process` (manual, in `engPool`) as its spec source. SDS uses `lpb.*` factory data (from `maqPool`) as its dimension source. These are **independent tables**. If `tooling_spec_process` drifts from the actual part drawing (e.g., after a CN revision), the formula engine will compute wrong tooling dimensions while the SDS PDF will show correct factory data — a silent inconsistency. Use `POST /api/tooling-select/spec/sync/:cn` to re-sync from factory data.

**`tooling_spec_process` special fields — derivation rules (hardcoded in `toolingSelectController.js`):**

| Field | Source | Rule |
|---|---|---|
| `yball` | CN class code (2-digit) | Class `35` (C35-xxxxx) → `'Y'`; all others → `'N'`. Verified from DB: `SELECT LEFT(cn,2), yball, COUNT(*) FROM tooling_spec_process WHERE yball<>'N' GROUP BY 1,2` |
| `process` | `lpb.eng_process_info.process_code`, first by `seq_no` | `1061`/`1062` = ID Grind → `'ID->OD'`; `1041`/`1042` = OD Grind → `'OD->ID'` |
| `type` | No factory source | Must be set manually — never derived |
| `sd`/`sd_aft` | `lpb.*` dimension column `sd`/`sd_aft` (if exists) | Auto-mapped by name if column present |

`yball` and `process` affect formula branches in `FormulaService._enrichContext()` (`isInner`, `isIDtoOD`, `isABR`). Wrong values = silent formula miscalculation. Update constants `YBALL_Y_CLASSES` and `ID/OD_GRIND_PROCESS_CODES` in `toolingSelectController.js` when new CN series or process codes are added.

**2. Machine type name must match exactly across both systems**

| System | Where the machine name is stored | Used for |
|---|---|---|
| Tooling Select | `tooling_formula.machine_name` | Formula calculation |
| Tooling Select | `tooling_selection_rules.machine_name` / `calc_context` | Rule lookup |
| SDS | `sds_machine_type_code.machine_type_name` | PDF generation, parameter lookup |

These three must be **identical strings**. A mismatch means SDS generates a PDF for "KS-B22G" while Tooling Select looks up formulas under a different name — no error is thrown, the PDF just has wrong or missing data.

`sds_machine_type_code.machine_type_code` (2-4 char code, e.g. `"B22"`) must match characters 2–4 of `tool_dwg_no` in the process plan. This is the fallback filter when `sds_machine_tool` has no entries for a given combo.

**3. `sds_machine_tool` controls which tools appear in SDS PDF**

When `sds_machine_tool` has rows for a `(machine_type, process_code)` pair, they act as the **authoritative ordered whitelist** — only those `tool_dwg_no` entries appear in the PDF (T01–T20 slots). When no rows exist, the PDF falls back to filtering by `machine_type_code` prefix.

If an engineer finds the wrong tools appearing in a PDF, configure `sds_machine_tool` via SDS Admin → Machine Tools tab. The `tool_drawing_no` supports prefix matching (`"4664-01"` matches `"4664-01-0001"` in the process plan).

**4. Independent caches — invalidation does not cross systems**

Clearing `tooling:{CN}` does not affect `sds:{CN}` and vice versa. After updating `tooling_formula` or `tooling_selection_rules`, the tooling cache is invalidated automatically. After updating `sds_parameter` or `sds_machine_tool`, the SDS cache is **not** automatically invalidated — use `DELETE /api/tooling-select/monitor/cache?prefix=sds:` to force a refresh.

**5. `sds_excel_mapping` links param_key to template cell — missing rows = blank PDF cells**

Each `param_key` used in `sds_parameter` must have a corresponding row in `sds_excel_mapping` (with the same `machine_type_name`) for the value to appear in the PDF. The audit endpoint (`GET /api/sds/v2/admin/audit/data-integrity`) cross-checks this and reports orphans.

### Frontend entry points

| Page | Route | CN input → System called |
|---|---|---|
| `ToolingSelectPage.jsx` | `/mtc/tooling-select` | POST `/api/tooling-select/search` → ToolingOrchestrator |
| `SdsV2Page.jsx` | `/mtc/sds-v2` | GET `/api/sds/v2/search` → SdsOrchestrator; PDF → `/api/sds/v2/pdf` |
| `SdsV2AdminPage.jsx` | `/mtc/sds-v2/admin` | All `/api/sds/v2/admin/*` admin management routes |

An engineer typically uses both pages for the same CN: Tooling Select gives fixture/jig recommendations; SDS gives the grinding setup sheet with machine parameters and tool drawings.

## Other Backend Route Groups

These routes exist in `server.js` but are not part of the MTC tooling pipeline:

### SDS Routes (`/api/sds/*`)

| Prefix | Controller | Notes |
|---|---|---|
| `/api/sds/v2` | `sdsV2Controller.js` | Search by CN — routes through `SdsOrchestrator` (10-min cache, rodpcPool graceful degradation) |
| `/api/sds/v2/images` | `sdsV2ImageController.js` | Image upload/retrieval for SDS v2 records |
| `/api/sds/v2/admin` | `sdsV2AdminController.js` | Full admin management; uses `engPool` + `maqPool` + `rodpcPool` (isAdmin for mutations) |
| `/api/sds/v2` | `sdsV2PdfController.js` | PDF generation for SDS v2 (also mounted at `/api/sds/v2`) |

SDS v2 admin is notably the only domain that queries all three DB pools in the same handler.

**SDS v2 Admin sub-routes** (all under `/api/sds/v2/admin/`):

| Method | Sub-route | Table | Purpose |
|---|---|---|---|
| `GET` | `/machine-types` | `sds_machine_type_code` | List machine types; supports `?search=` |
| `PUT` | `/machine-types/:id` | `sds_machine_type_code` | Update name, grinding_area_label, tool_code_filter, is_active. When `machine_type_name` changes, wraps in a transaction and cascades the rename to `sds_parameter`, `sds_machine_tool`, `sds_excel_mapping`. **Always rename via this API — direct SQL UPDATE on `sds_machine_type_code` will leave orphans in all three dependent tables.** Also flushes `sds:*` cache. |
| `GET/POST/PUT/DELETE` | `/mappings[/:id]` | `sds_excel_mapping` | Excel cell → param_key mapping per machine type; `machine_type_name=null` = shared layout |
| `GET/PUT` | `/parameters` | `sds_parameter` | Upsert single param; `cn=null` = machine-config row, `cn=C31-…` = per-record data |
| `POST` | `/parameters/bulk` | `sds_parameter` | Batch upsert parameters |
| `GET/POST/PUT/DELETE` | `/machine-tools[/:id]` | `sds_machine_tool` | Tool ordering per (machine_type, process_code) |
| `GET` | `/machine-tools/combos` | `sds_machine_tool` | Distinct (machine_type, process_code) pairs |
| `POST` | `/machine-tools/bulk` | `sds_machine_tool` | Bulk replace tool list for a (machine_type, process_code) combo |
| `DELETE` | `/machine-tools/combo` | `sds_machine_tool` | Delete all tools for a specific combo |
| `GET` | `/audit/data-integrity` | multiple | Cross-check param keys vs excel mapping; returns orphans and missing keys |

**`sds_parameter` param_key naming conventions** — all params stored under `(cn, machine_type_name)` key:
- `row_{N}_{COL}` — cell value for A:I section (rows 16–55), e.g. `row_16_A`
- `row_{N}_is_header` — flag: row N is a header row in the A:I section
- `row_{N}_{COL}_type` — cell type override (`red` = red font) in A:I section
- `gw_row_{N}_{COL}` — cell value for AN:AV section (rows 50–55), e.g. `gw_row_50_AN`
- `gw_row_{N}_is_header` — header flag for GW section
- `gw_row_{N}_{COL}_type` — cell type override for GW section

**`sds_grinding_image` schema** (constant `TABLES.SDS_V2_GRINDING_IMAGE = 'sds_grinding_image'`):** Uses `cn_prefixes text[]` and `process_codes text[]` (both PostgreSQL arrays) — one image can cover multiple CN prefixes **and** multiple process codes. Both columns have GIN indexes. Lookups use `WHERE $1 = ANY(cn_prefixes) AND $2 = ANY(process_codes)`; empty `process_codes = '{}'` means "default" (matches any process). POST accepts both as JSON-encoded array strings; DELETE uses array-overlap (`&&`) on both columns. `process_codes` was migrated from a scalar `process_code TEXT` column — run `node api/engineer/mtc/doc/migrate_grinding_image_process_codes.js` on any DB that predates this change.

### Tool Request Workflow (`/api/engineer/mtc/tool-requests/*`)

Multi-stage approval workflow managed by `toolRequestController.js` and `toolRequestAuth.js`:
- `GET /api/engineer/mtc/tool-requests` — list requests
- `GET /api/engineer/mtc/tool-requests/dashboard` — summary dashboard
- `GET /api/engineer/mtc/tool-requests/permissions` — stage permission config
- `GET/POST/PUT/DELETE /api/engineer/mtc/tool-requests/:id` — request CRUD
- `POST /api/engineer/mtc/tool-requests/:id/action` — stage-advance action
- `GET/POST/PUT/DELETE /api/engineer/mtc/email-config[/:id]` — per-stage email config

Auth uses `mtcVerifyToken` (separate alias for `verifyToken` from `toolRequestAuth.js`) — same JWT validation, different import path.

### ECR / Tumble Routes

ECR (Engineering Change Request) in `api/engineer/process/eng_process_model.js` — uses `engPool` + `rodpcPool`:
- `GET /api/ecr/users-by-dept/:dept`, `PUT /api/ecr/:id/resubmit`, `POST /api/ecr/:id/tasks`, `GET /api/ecr/:id/tasks`, `PUT /api/ecr/tasks/:taskId/ack`

Tumble (cutting-condition models) — full CRUD:
- `/api/tumble/getAllCondition`, `/api/tumble/createCondition`, `/api/tumble/updateCondition/:id`, `/api/tumble/deleteCondition/:id`
- `/api/tumble/getAllModel`, `/api/tumble/createModel`, `/api/tumble/updateModel/:id`, `/api/tumble/deleteModel/:id`

Note: the domain is named "ECR" in routes (not "ECN") — ECN is referenced in legacy UI text only, not in route names.

### System Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/system/settings` | public | Read system settings |
| `POST /api/system/settings` | `requireSystemEngineer` (inline in `server.js`) | Write system settings |
| `GET /api/system/user-management/schema` | public | Fetch user table schema |
| `GET/POST/PUT/DELETE /api/system/user-management/users[/:u_code]` | public/none | User CRUD |
| `POST /api/system/user-management/schema/add-column` | `requireSuperAdminOrEmergency` | Live schema ALTER TABLE |
| `POST /api/system/user-management/schema/drop-column` | `requireSuperAdminOrEmergency` | Live schema ALTER TABLE |

`requireSuperAdminOrEmergency` and `requireSystemEngineer` are defined inline in `server.js` — not in middleware files.

### External Proxy

`GET /api/proxy/job_check` — no auth required (whitelisted in the global auth middleware at the top of `server.js`). Proxies an internal factory job-check API at `pkv0198.kz.minebea.local:5002`. Handler in `api/engineer/new_prod/tool.js`.
