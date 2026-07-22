---
paths:
  - "apps/ENG-Backend/api/engineer/mtc/**"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/tooling_select/**"
  - "apps/ENG-Backend/db_migrations/**"
---

> **Active system:** `api/engineer/mtc/` (tsv2 files: `tsv2Routes.js`, `tsv2Constants.js`, `controllers/`, `services/`) → `/api/tooling-select`. The V1 pipeline below is **retired** — files remain on disk but are not routed in `server.js`. Do not add logic to V1 files.

## MTC Tooling Selection V1 — Full Pipeline (RETIRED — not routed)

```
ToolingOrchestrator.findFixtures(cnNumber)
  ├─ CacheAgent.get('tooling:{CN}')        → return immediately on hit (5-min TTL)
  ├─ SpecAgent.execute()                   → fetchSpecRow → mapPartData → computeDerivedFlags
  ├─ FormulaAgent × N machines             → Promise.allSettled (parallel, partial-failure OK)
  │    └─ FormulaService.calculateMachineParams() per machine → tooling_formula table
  ├─ buildCalcMap()                        → merges formula output with machine adapters
  ├─ computeOkFlags()                      → eligibility flags per machine
  ├─ Promise.all([                         → legacy search + dynamic search in PARALLEL
  │    fetchToolingRows(),                 → hardcoded SQL; skips machines with use_dynamic_rules=true
  │    findDynamicFixtures()               → tooling_selection_rules for new + KS-400B1/2/7
  │  ])
  ├─ assembleResults()                     → formats + ranks per machine
  └─ CacheAgent.set('tooling:{CN}', result, 5min)
```

### Agent Layer (`services/agents/`)

| File | Role | Timeout |
|---|---|---|
| `BaseAgent.js` | Base class — `execute()` wraps `run()` with timeout + catch + monitor | — |
| `MonitorAgent.js` | Singleton — rolling-window latency stats; `getAllStats()`, `slowAgents(ms)` | — |
| `CacheAgent.js` | Singleton — in-memory TTL Map; `TTL.TOOLING=5min`, `TTL.SDS=10min` | — |
| `SpecAgent.js` | Wraps `partDataMapper` fetch + normalize + derivedFlags | 5 s |
| `FormulaAgent.js` | Wraps `FormulaService.calculateMachineParams` for one machine | 8 s |
| `SdsAgent.js` | Wraps `sdsV2SearchService.searchByCn`; on connection error retries with `NULL_POOL` | 15 s |

**Formula Swarm failure:** one FormulaAgent timeout/error → machine skipped, `_formulaWarnings: { machineName: reason }` in response.

### Cache Invalidation Rules

| Trigger | Scope |
|---|---|
| Formula / rule / inventory / machineConfig create-update-delete | `invalidatePrefix('tooling:')` — all CNs |
| Spec update/delete | `invalidateCache(cn)` from ToolingOrchestrator — specific CN only |
| SDS | TTL-only (no write path) |

Import `{ invalidateCache }` from `ToolingOrchestrator` for CN-specific; import `cache` from `agents/CacheAgent` for prefix flush.

### Two Search Paths

| Path | Machines | Configured via |
|---|---|---|
| **Legacy** (`machineQueryService.fetchToolingRows`) | KSB22G, KSB80, TSG300, KS03A, KS400B, KS500RD, KS400B5, KS400B6 | Hardcoded SQL. Skipped when `use_dynamic_rules=true` in `tooling_machine_config`. |
| **Dynamic** (`dynamicLogic.findDynamicFixtures`) | Any new machine + KS-400B1/2/7 | `tooling_selection_rules` table |

**KS-B80:** absent from `LEGACY_MACHINES` — no FormulaAgent run. Hardcoded in `machineQueryService`/`searchFunctions`.

**KS-400B1/B2/B7 (2026-05-19):** use `calc_context='ks400b'` → resolves to `calcs.ks400b_calc`. KS400B stays in `LEGACY_MACHINES` for formula compute (formula output is shared). Legacy SQL is skipped via `use_dynamic_rules=true`.

### Three-Table Dependency (new machine, no code change)

1. `tooling_<machine>` — inventory table
2. `tooling_formula` — formula rows
3. `tooling_selection_rules` — linking calc output to inventory columns

`dynamicLogic.js` auto-detects any `calc_context` not in `allCalcs`, looks up `tooling_formula`, computes at runtime.

### `tooling_selection_rules` Schema

- `calc_context` — for new machines: exact `machine_name` from `tooling_formula`. Normalized via `toLowerCase().replace(/-/g,'')` — `KS-X100`, `KSX100`, `ksx100` all resolve to same.
- `dims` (JSONB) — array of `{ calc_key, tool_field, tol_plus, tol_minus, label, sort_priority, penalty_over, penalty_below, penalty_above }`
- `result_fields` (JSONB) — array of `{ tool_field, label }` controlling result display columns
- `machine_ok_condition` — key in `okFlags`; if `false`, machine skipped
- `calc_key` must match `parameter_name` in `tooling_formula` (or derived key from `_enrichContext`). No DB FK — naming convention only.

**Live validation:** `calc_key` options from `GET /api/mtc/tooling-formula/:machineName`; `tool_field` from `GET /api/tooling-select/columns/:tableName`.

---

## MTC Formula Engine

### `parameter_name` = DWG Dimension Label

`parameter_name` values (`'A'`, `'B'`, `'C'`, ...) in `tooling_formula` correspond **directly to dimension labels on the tooling engineering drawing (DWG)**. Input is workpiece dimensions (OD/ID/W) → formulas compute tooling dimensions A, B, C → matched against inventory. If a DWG is revised (new or renamed labels), `tooling_formula` rows must be updated to match. See `.claude/rules/formula-reference.md` for the full formula reference per machine/tooling.

- Formulas stored in `tooling_formula` table (sole store — `mtc_formulas` is retired, can be dropped)
- Evaluated sequentially (`id ASC`) with `expr-eval`. `formula_type='limit'` rows are **skipped**.
- `_enrichContext()` adds: `odAft_max/min`, `idAft_max/min`, `wAft_max/min`, `W_max`, `T1`, `SD`, `sdCalc`, `Offset`, `isInner`, `isIDtoOD`, `isYBall`, `isABR`, `isBallInner`, `PI`, `E`, `A–Z` (default 0).
- **`idAft_min` cap**: `Math.min(0, ...)` — caps minus-tolerance to ≤ 0 (prevents CHUCK JAW dim blowup from corrupted positive values, e.g. `id_aft_min=508`).
- `isInner`: `type.toUpperCase().includes('INNER') || yBall==='Y'` → 1 else 0 (used by KS-400B6 formulas).
- **Do NOT use `round(x,n)` in DB formulas** — `expr-eval` v2 treats `round/ceil/floor` as unary; `_preprocess()` auto-rewrites to `roundN/ceilN/floorN`.
- Missing formula rows → `FormulaService` returns `0` for all params (no error). Verify row counts after migrations.

**Custom functions:** `round05/ceil05/floor05` (nearest 0.5), `lookup(val, v1, v2, ...)` (first ≥ val), `roundN/ceilN/floorN(x,n)` (precision).

### Hardcoded Adapter Constants in `partDataMapper.js`

Still code-level (not DB-driven) — changing requires a code deploy:

| Constant | What it covers |
|---|---|
| `KS03A_PARAMS` | OD_MAX, type thresholds, chute E/G limits |
| `KS400B_PARAMS` | OD/W eligibility, SD/ID thresholds, fixed PA_F/PB_F dimensions |
| `KS500RD_PARAMS` | ID/OD/W eligibility, FRONT_SHOE_MAP |
| `KS400B5_PARAMS` | OD_MAX, WORK CLAMP/SHAFT thresholds |
| `KS400B6_PARAMS` | PILOT PIN thresholds, STOCKER CHUTE limits, drill/thread lookup |

### Visual Formula Builder

`FormulaBuilderInput.jsx` — reusable `Form.Item`-compatible component. Two modes: **Visual** (template-based) and **Text** (raw string). `onTest` → `POST /api/mtc/tooling-formula/test`. Used in `ToolingSelectPage.jsx` and `ToolManagementPage.jsx`.

---

## Tooling Select API Routes (V1 — RETIRED, `toolingSelectController.js` not routed)

`toolingSelectController.js` at `/api/tooling-select/*` — **these routes no longer exist in `server.js`**. See CLAUDE.md "Tooling Select (DB-driven)" for the live V2 route table.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/search` | Main tooling search by CN number |
| `GET/POST/PUT/DELETE` | `/rules[/:id]` | CRUD for selection rules (isAdmin mutations) |
| `GET` | `/rules/validate` | Health check: cross-checks `dims[].calc_key` vs formula params |
| `GET` | `/columns/:tableName` | Real column names from inventory table |
| `GET` | `/tables` | List all tooling inventory tables |
| `GET` | `/machine-table-config` | Static display config (sourced from `machineTableConfig.js`) |
| `GET/POST/PUT/DELETE` | `/inventory/:tableName[/:id]` | Inventory CRUD (isAdmin mutations) |
| `GET/POST/PUT/DELETE` | `/spec[/:cn]` | Part spec CRUD (isAdmin mutations) |
| `GET` | `/spec/factory-preview/:cn` | Read-only preview from `lpb.*` via maqPool — never writes |
| `POST` | `/spec/sync/:cn` | Upsert factory dims into `tooling_spec_process`; never overwrites `type` |
| `POST` | `/spec/sync-new` | Bulk insert spec rows for CNs in factory not yet in engPool. Use `ANY($1)` + chunks of 2000 — do NOT revert to per-CN loop |
| `GET/POST/PUT/DELETE` | `/machine-config[/:id]` | CRUD for `tooling_machine_config` (isAdmin mutations) |
| `GET` | `/monitor` | Latency stats per agent + cache size (isAdmin) |
| `DELETE` | `/monitor/cache` | Manual cache flush; `?prefix=tooling:` or `?prefix=sds:` (isAdmin) |

> Live V2 route table and DB schema → `.claude/rules/tooling-select.md`

**`tooling_spec_process` derivation rules (hardcoded in controller):**
- `yball`: class `35` (C35-xxxxx) → `'Y'`; all others → `'N'`
- `process`: process_code `1061/1062` → `'ID->OD'`; `1041/1042` → `'OD->ID'`
- `type`: no factory source — must be set manually
- Update `YBALL_Y_CLASSES` and `ID/OD_GRIND_PROCESS_CODES` when new CN series or process codes are added

**`spec/sync-new` pitfalls:**
- **INSERT column order** — `sd`/`sd_aft` must come BEFORE `type`/`yball`/`process` in both the SQL column list and the values array: `(cn, od_bf,...,w_aft,w_aft_max,w_aft_min, sd, sd_aft, type, yball, process)`. Swapping silently causes `invalid input syntax for type numeric` (string `'N'` written into the `sd` numeric column).
- **slice before filter** — call `.filter(notInExisting).slice(0, MAX)`, not `.slice(0, MAX).filter(...)`. Slicing first means every run sees the same first-N already-inserted CNs and always reports 0 new.

## Formula API Routes (V1 — RETIRED, routes removed from `server.js`)

`toolingFormulaController.js` routes at `/api/mtc/tooling-formula/*` **are no longer registered**. Formula management for V2 is done via `/api/tooling-select/machines/:machineId/formulas` (V2AdminPage → V2FormulaManager).

Legacy `/api/mtc/formulas/*` routes and `formulaController.js` have been deleted — do not recreate.

---

## V2AdminPage (active admin UI)

`src/components/engineer/mtc_eng/tooling_select/V2AdminPage.jsx` — routed at `MTC_PATHS.TOOLING_MANAGEMENT`.

**Top-level tabs** (when no machine is selected):
- `machines` → `V2MachineManager` — machine list + enable/disable; click row to drill into machine
- `spec` → `SpecProcessManager` with `embedded={true}` prop — part spec CRUD + factory sync

**Machine drill-down tabs** (after selecting a machine row):
- `limits` → `V2LimitManager` — OD/ID/W eligibility bounds per machine
- `formulas` → `V2FormulaManager` — formula rows per (machine_id, tooling_name, output_key)
- `rules` → `V2SearchRuleManager` — search rules mapping output_key → inventory column

Back button at machine drill-down level returns to machine list (no navigation). Top-level back button navigates to `MTC_PATHS.TOOLING_SELECT`.

**`SpecProcessManager` embedded prop:** when `embedded={true}`, the component omits its own Layout/MenuTemplate wrapper and back button. The outer `V2AdminPage` provides the layout context.

