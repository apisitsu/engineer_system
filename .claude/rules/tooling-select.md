---
paths:
  - "apps/ENG-Backend/api/engineer/mtc/tsv2*"
  - "apps/ENG-Backend/api/engineer/mtc/controllers/**"
  - "apps/ENG-Backend/api/engineer/mtc/services/**"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/tooling_select/**"
---

## Tooling Select V2 (DB-driven, active)

Domain at `api/engineer/mtc/` (tsv2 files) — registered in `server.js` as `/api/tooling-select`. The legacy V1 system has been retired; V1 files remain on disk but are not routed.

### DB Tables

| Table | Purpose |
|---|---|
| `tooling_machine` | Machine registry (inventory_table, inventory_machine_filter, enabled) |
| `tooling_machine_limit` | Eligibility limits on spec inputs per machine |
| `tooling_formula` | Formula rows: one per (machine_id, tooling_name, output_key) — evaluated in sort_order ASC |
| `tooling_search_rule` | Maps formula output_key → inventory column with optional tolerance |
| `tooling_spec_process` | Part specifications (CN, OD/ID/W Bf/Aft, type, yball, process) — managed via admin |

> `tsv2Constants.js` maps constant names to the above table names. Always use `TSV2_TABLES.*` — never hardcode.

### Routes (`/api/tooling-select/`)

Registered in `server.js` via `api/engineer/mtc/tsv2Routes.js`. Main endpoints:
- `POST /search` — search by CN
- `GET/POST/PUT/DELETE /machines[/:id]`
- `GET/POST/PUT/DELETE /machines/:machineId/limits`
- `GET/POST/PUT/DELETE /machines/:machineId/formulas`
- `GET/POST/PUT/DELETE /machines/:machineId/search-rules`
- `GET/POST/PUT/DELETE /spec[/:cn]` — Part spec CRUD
- `GET /spec/factory-preview/:cn` — Read-only factory dim preview
- `POST /spec/sync/:cn` — Upsert factory dims into spec
- `POST /spec/sync-new` — Bulk insert new CNs from factory

### Excluding a part class from sync-new

`sync-new` scans only prefixes listed in `PREFIX_TABLE_MAP` in `specController.js`. To permanently exclude a part class, remove its prefix entries from `PREFIX_TABLE_MAP`.

> A41–A49 (Spherical) is **included** as of 2026-06-13. Dims come from a JOIN: `lpb.eng_sph` (has `sph_design_no`, no dim cols) → `lpb.eng_sph_design` (`sph_od, sph_width, dall_id`) on `sph_design_cn = sph_design_no`. Aliased `od/id/w` so `mapFactoryDimToSpec` reads them. Both `syncNewCns` and `buildDriftAudit` have a post-fetch spherical override block. OC-16A T-Select formulas (process 1011 OD GRIND) make spec data valuable.

### Formula Evaluation (`formulaService.js`)

- `expr-eval` engine with custom functions: `round05`, `roundN`, `if`, `lookup`, etc.
- `_preprocess()` rewrites `round(x,n) → roundN(x,n)` before parsing
- `condition_expr`: if truthy, row applies; first passing row per `output_key` wins
- Returns `computedDims = { A: ..., B: ..., C: ... }` — A–Z keys only

### Search Logic (`searchService.js` → `searchInventory`)

- **withTol rules** (`tol_plus` or `tol_minus` not null): add `WHERE col BETWEEN lo AND hi`
- **withoutTol rules** (both null): no WHERE filter; closest-match only
- **Ranking** — combined-distance `ORDER BY`:
  `ORDER BY (ABS(col_A - val_A) + ABS(col_B - val_B) + ...) ASC`
- **`is_match_dim` (bool, default true)** on `tooling_search_rule` selects which dims feed the ranking. Only rules with `is_match_dim = true` contribute to the `ORDER BY` distance; set `false` on constant / SD-lookup dims so the closest match is ranked by the OD/ID/W part-fit dims only. **Tolerance WHERE filters apply regardless of this flag.** Fallback: if every rule for a tooling is `false`, ranking falls back to all mapped dims (deterministic result). Editable in `V2SearchRuleManager` (the "Use in closest-match ranking" switch / "Ranking" column). Migration: `db_migrations/20260605_add_is_match_dim_to_search_rule.sql`. The `/search` response exposes `result.matchDimCols` (inventory columns of match-dim rules); `ToolingSelectV2Page` highlights those result-table headers (gold ★).

### Adding a new machine (DB-only, no code change)

1. INSERT into `tooling_machine` (inventory_table, inventory_machine_filter if needed)
2. INSERT `tooling_machine_limit` rows for OD/ID/W eligibility bounds
3. INSERT `tooling_formula` rows per (machine_id, tooling_name, output_key)
4. INSERT `tooling_search_rule` rows mapping output_key → inventory column

> Established seeding flow (≥9 machines): idempotent `db_migrations/<date>_seed_<machine>_tooling_select.js` (deletes+reinserts by machine_id) + a `<date>_validate_<machine>.js` that builds a live answer key from `lpb.eng_r_pi_tool` (by `process_code`) where one exists, and document the formula table in `.claude/rules/formula-reference.md`. Confirm SDS coupling: `sds_machine_type_code.name` must match the T-Select `machine_name` exactly (or be linked via `machine_group`).

### Common seeding patterns (proven across machine seeds)

These recur in every machine added so far — treat them as defaults, not per-machine discoveries.

1. **Shared inventory table → `inventory_tooling_filter` is mandatory.** When several tooling types live in ONE inventory table keyed by `tooling_name` (ks400b5/b6, ks500rd, oc16a, kl20, psg64), **every** search rule MUST set `inventory_tooling_filter=<tooling_name>`. Otherwise search ranks across the whole table and returns wrong-tooling rows. This is consistently the single biggest accuracy fix when onboarding a shared-table machine.

2. **Gate a tooling branch with an unmatchable sentinel, never a skipped `condition_expr`.** To disable a tooling for parts it doesn't apply to, make its key compute an impossible value, e.g. `A = if(Type=="N", odBf, -999)`. A *skipped* `condition_expr` leaves the output undefined → `searchInventory` drops the tolerance WHERE filter and returns **arbitrary** rows (silent wrong-match bug). The `-999` keeps the `BETWEEN` filter active so the wrong-gate tooling correctly returns nothing.

3. **Before-grind NULL fallback: `if(xBf>0, xBf_min, xAft_min)`.** `id_bf`/`od_bf` are NULL/0 for ~62% of spec rows, so a raw `idBf_min`/`odBf_max` reference computes garbage (e.g. `A=−1` → no match). Use the fallback to after-grind dims whenever a before-grind variable drives selection. (See Troubleshooting #6 for the symptom; the fallback is the preferred fix when before-grind is the *correct* design variable and you only need NULL safety.)

4. **Ranking-dim discipline (extends `is_match_dim` below).** A large near-constant dim (e.g. a ~190 mm chute height) must NOT be a ranking dim — its magnitude dominates the combined distance and selects the wrong item; set `is_match_dim=false` and rank by the OD/ID/W part-fit dims. A secondary dim whose formula only *approximates* (length = `W+3.5` etc.) should be **rank-only** (`tol_plus`/`tol_minus` NULL) — never a hard `BETWEEN`, which can exclude a correct primary-dim match.

### Frontend

Components in `src/components/engineer/mtc_eng/tooling_select/`:
- `ToolingSelectV2Page.jsx` — search UI; uses `server.TSV2_SEARCH`; registered at `MTC_PATHS.TOOLING_SELECT`
- `V2AdminPage.jsx` — admin: Machines & Rules tab + Part Management tab; registered at `MTC_PATHS.TOOLING_MANAGEMENT`
- `V2FormulaManager.jsx`, `V2LimitManager.jsx`, `V2SearchRuleManager.jsx`, `V2MachineManager.jsx`

Part Management (spec CRUD) is embedded inside V2AdminPage as a tab via `SpecProcessManager` from `tooling_select/SpecProcessManager.jsx` with `embedded` prop.

Route paths in `mtc_constance.js`: `MTC_PATHS.TOOLING_SELECT` and `MTC_PATHS.TOOLING_MANAGEMENT`.
API constants: `server.TSV2_*` (all point to `/api/tooling-select/`), `server.MTC_TOOLING_SPEC*`.

---

## Troubleshooting T-Select Mismatches

When T-Select returns "(-)None" or the wrong match, check in this order:

**1. Machine limit exclusion** (all tools for a machine return None)
- Cause: `tooling_machine_limit` min/max too strict for the part's OD/ID/W
- Diagnose: `SELECT * FROM tooling_machine_limit WHERE machine_id=...` and compare against spec
- Fix: `UPDATE tooling_machine_limit SET min_value='10' WHERE ...`

**2. Missing inventory item** (one tooling type returns None, others are fine)
- Cause: item exists in process plan but was never inserted into the inventory table (e.g. `tooling_ks03a`)
- Diagnose: `SELECT * FROM tooling_ks03a WHERE tooling_no='4559-17-xxxx'` returns nothing
- Fix: `INSERT INTO tooling_ks03a (tooling_name, tooling_no, dim_a) VALUES (...)`

**3. tol_minus too tight** (#1=wrong item, #2=None; expected item dim_x slightly below computed)
- Cause: gap between computed value and item's dim_x exceeds `tol_minus`
- Diagnose: gap = computed_A − item.dim_x; need `tol_minus > gap`
- Fix: `UPDATE tooling_search_rule SET tol_minus='0.15' WHERE ...`

**4. tol_plus too tight** (#1=correct, #2=None; expected #2 item dim_x slightly above computed)
- Fix: `UPDATE tooling_search_rule SET tol_plus='1.0' WHERE ...`

**5. spec.process non-standard format** (formula flags `isODtoID`/`isIDtoOD` always 0)
- Cause: `process` stored as `"OD=>ID"`/`"ID=>OD"` instead of `"OD->ID"`/`"ID->OD"`
- Fix: `UPDATE tooling_spec_process SET process='OD->ID' WHERE process='OD=>ID'`

**6. Formula uses wrong spec variable; all tools way off** (e.g. entire family ranked wrong)
- Cause: formula references `odBf_max`/`wBf_max` but the CN has `od_bf = NULL` → `buildSpecContext` converts null → 0 → variable = 0, formula output is near 0
- Diagnose: check `tooling_spec_process` for the CN — if `od_bf` is NULL but `od_aft` is populated, and formula uses `odBf_max`, output will be 0
- Fix: update `tooling_formula` to use `OD`/`W` (= `od_aft`/`w_aft`) instead of `odBf_max`/`wBf_max`
- Example fixed (2026-05-28): TSG-300 (formerly TSG-300ZNC) CARRIER A: `ceil05(odBf_max+0.5)` → `ceil05(OD+0.5)`; CHUTE COVER A: `odBf_max+0.2` → `OD+0.2`; CHUTE COVER B: `wBf_max+0.1` → `W+0.1`
