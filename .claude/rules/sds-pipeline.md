---
paths:
  - "apps/ENG-Backend/api/engineer/mtc/controllers/sds**"
  - "apps/ENG-Backend/api/engineer/mtc/services/sds**"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/**"
  - "apps/ENG-Backend/api/engineer/process/**"
  - "apps/ENG-Backend/api/system/**"
---

## Tooling Select ↔ SDS: Relationship and Shared Pipeline

Both systems key on CN number but use **entirely separate orchestrators** and **different DB pools**.

**Tooling Select** (`POST /api/tooling-select/search`) — `searchService.search(cn)` (`api/engineer/mtc/services/`):
- Spec → `tooling_spec_process` (engPool): odBf, idBf, wBf, odAft, idAft, wAft, type, yball, process, sd
- Eligibility → `tooling_machine_limit` (engPool) per enabled machine in `tooling_machine`
- Dimensions → `formulaService.computeDimensions()` → `tooling_formula` (engPool)
- Inventory search → table in `tooling_machine.inventory_table` (engPool); column rules in `tooling_search_rule`
- No server-side cache (stateless per request)

**SDS** (`GET /api/sds/v2/search`) — `SdsOrchestrator.search(cn)` → `sdsV2SearchService.searchByCn()`:
- Part dims: `lpb.eng_ball/body/race/sleeve/sph` (maqPool)
- Process plan + tools: `lpb.eng_r_pi_tool`, `eng_tooling`, `eng_r_pi_item`, `eng_item`, `eng_cad_rev_data`, `eng_process_info` (maqPool)
- Production info: `rodpc.kzwmaq_eng_production/process` (rodpcPool)
- Cache: `sds:{CN}` TTL 10 min

**PDF generation (current — Chrome grid, Approach B; LibreOffice retired 2026-06-14):** `sdsV2HeadlessController.js` route `GET /api/sds/v2-headless/pdf-chrome/grid?cn=&machine_type_name=&process_code=[&template_id=]`. Resolves the **grid layout** via `loadGridForMachine`: the machine's assigned template (`sds_machine_type_code.grid_template_id`) → the `is_default` template → the legacy `sds_template_css_config` key `grid-layout` (fallback). Grids live in **`sds_grid_template`** (multi-template, migration `20260703_create_sds_grid_template.js`; the old single grid-layout was migrated into a `Standard` default row). Then `buildValueMap` → `applyDataToGrid` injects per-CN data by **cell address** (`sds_excel_mapping` param_key→cell + `row_N_COL` param table + GW + `row_N_is_header` highlight + `tool_dwg_no_T01` + `IMAGE_EXTENTS` images) → warm Puppeteer → PDF. `sds_template.xlsx` is now only the **grid import source**. Full detail: auto-memory `project_sds_grid_pdf`.

> **Multi-template + CN-override precedence (2026-07-03):** (1) Templates: admin CRUD at `/api/sds/v2/admin/template-grids[/:id][/default]`; assign per machine via `PUT /machine-types/:id/grid-template`; editor picker in `SdsBlankTemplateGrid.jsx`; assignment column in `MachineTypes.jsx`. Singular `/template-grid` GET/PUT now target the **default** template. (2) In `applyDataToGrid` an explicit `sds_parameter` value (machine-default or per-CN, CN wins) now **overrides** the auto-derived factory scalar — this is what lets a CN override edit `ct` (CYCLE TIME → cell B4); `ct` is exposed in `HEADER_CELL_FIELDS` (SdsV2AdminPage MachineConfigTab). (3) Grinding image lookup matches the **full CN and the 3-char prefix**, ranking a per-CN image above a family-prefix image; upload UI (`GrindingImagesTab`) accepts specific CNs (stored in the same `cn_prefixes` text[]).

> **Retired:** `sdsV2PdfController.js` (ExcelJS → LibreOffice/soffice), `mtcController.generateSdsPdf`, and the LibreOfficePortable binary were deleted. The old "never apply ExcelJS borders to `sds_template.xlsx`" constraint only mattered for that xlsx→LibreOffice path; borders are now designed in the grid editor.

### Critical Coupling Points

**1. `tooling_spec_process` vs `lpb.*` dimensions**
Independent tables — use `POST /api/tooling-select/spec/sync/:cn` to re-sync if spec drifts after CN revision.

**2. Machine type name must be identical across:**
- `tooling_formula.machine_name` (formula calc)
- `tooling_selection_rules.machine_name` / `calc_context` (rule lookup)
- `sds_machine_type_code.machine_type_name` (SDS PDF)

A mismatch → silent wrong or missing PDF data. Always rename machine types via `PUT /api/sds/v2/admin/machine-types/:id` — it cascades rename in a transaction.

> **⚠ Do NOT rename `sds_machine_type_code` entries to match T-Select group names.** `machine_group` already handles the group label display (e.g. `'TSG-300W/TSG-300ZNC'`). Renaming both TSG-300W and TSG-300ZNC to `'TSG-300'` once destroyed 1,299 `sds_parameter` rows and required a full revert. The `machine_group` field is the right mechanism — use it.

**2b. T-Select → SDS machine name resolution**
`searchService.js` returns `result.machine` as the `machine_group` display name (e.g. `'KS-400B1/B2/B7'`) when a machine belongs to a group. SDS stores the **representative** `machine_type_name` (e.g. `'KS-400B1'`). In `SdsV2Page.jsx → buildExpandedContent`, always call `resolveMachine(result.machine)` before any comparison against `processMachineNames`, `eligibleMachines`, or `configMachineNames` — a missing resolve silently drops all T-Select data for grouped machines.

**3. `sds_machine_tool` controls PDF tool list**
When rows exist for a `(machine_type, process_code)` pair → authoritative ordered whitelist for T01–T20 slots. No rows → fallback to `machine_type_code` prefix filter.

> **`process_code` must be ONE code per row.** Every consumer matches it exactly (PDF whitelist `WHERE process_code = $2`; coverage `checkToolingMatch` keyed `machine||process`), so a comma-joined value like `'1241,1242'` is silently dead config — the tools never appear in PDFs and never count as a tooling match. Insert one row per process code. Existing comma rows (KS-H70/OC-16A/GS-64PF) were split by `db_migrations/20260613_split_sds_machine_tool_comma_process.js` (idempotent — safe to re-run).

**3a. Tool DWG No matching requires prefix fallback**
DWG numbers follow `XXXX-XX-NNNN` (or `XXXX-XX-NNNN-NN`). The first two dash-segments (`XXXX-XX`) identify the tool family/machine type. Three data sources may store **different suffixes** for the same tool family:
- `lpb.eng_r_pi_tool.tool_dwg_no` (SDS process plan)
- T-Select inventory table (e.g. `4556-01-0048-01`)
- `sds_machine_tool.tool_drawing_no`

Exact string match alone will silently fail. Always use prefix fallback in frontend matching:
```js
const dwgPrefix = (no) => { const p = no?.split('-'); return p?.length >= 2 ? `${p[0]}-${p[1]}` : no; };
```
Applied in `SdsV2Page.jsx`: T-Select result assignment tries exact match first, then `dwgPrefix` fallback via `sdsPrefixToNo` map. Validation against `sds_machine_tool` uses `sdsPrefixSet`.

**3b. A blank PDF is usually the WRONG MACHINE, not a missing-data bug**

The PDF machine picker (`openPdfModal`) is built from `sds_machine_tool` config for the
process **plus** machines whose `machine_type_code` matches the plan's tool-DWG prefix.
Neither source knows whether the part actually *fits* the machine, so machines Tooling
Select has excluded are offered anyway — and the resulting sheet renders with every
T-Select tool slot blank while the Tooling table behind the modal shows a full list.

This bites hardest on **range-split pairs**: two machines sharing one tooling family with
the range divided between them. `tooling_machine_limit` records the split *and* names the
partner in `description`:

| machine | input_var | bound | description |
|---|---|---|---|
| KS-03A | ID | max 12 (exclusive) | `KS-03A: ID < 12 (use KS-B22RD for ID >= 12)` |
| KS-B22RD | ID | min 12 | `KS-B22RD: ID >= 12 (same formulas as KS-03A)` |

Diagnosed 2026-08-05 on **C31-00839** (BALL, bore 12.700), process 1061: the KS-B22RD
sheet carried all 10 tools (2 factory + 8 from T-Select/similar-part, marked ` *`); the
KS-03A sheet carried only the 2 factory tools. Correct behaviour — bore 12.7 belongs to
KS-B22RD — but nothing said so. `SdsV2Page` now flags excluded machines in the picker
with the T-Select reason (`ID=12.7 > max 12`) and names the machine that does own the
part's tooling family.

> The alternative-machine suggestion **must** be filtered by tooling family, not just by
> T-Select eligibility. Every machine configured for the process is in the picker, so for
> this part KS-B22G (4027-*) and KS-B80 (4021-*) were "eligible" yet irrelevant — offering
> them just sends the user to another empty sheet. Match `sds_machine_tool.tool_drawing_no`
> prefixes against the part's own `process_plan` tool prefixes.

> **Production history is not proof the limit is wrong.** The `Machine History` chips are
> real `lpb.pc_production` lots, and they showed 3 lots of this CN on KS-03A (floor machine
> IDG-10, which has ground bores 6.35–16.0). Reality crosses the documented split; the
> limit still encodes the intended routing. **Do not "fix" a limit from production data
> alone** — the split is deliberate and shared by both machines' formulas.

**4. Independent caches — invalidation does not cross systems**
SDS admin mutations now auto-flush the `sds:` cache: `/machine-types` (inline) and `/parameters`, `/parameters/bulk`, `/machine-tools/bulk`, `/machine-tools/combo`, `/mappings` (via the `flushSds` `res.on('finish')` middleware in `sdsV2AdminController.js`). So edits reflect on the next search/PDF. (Fixed 2026-06-09 — previously only machine-types flushed, so parameter/tool/mapping edits served stale data until the 10-min TTL.) The T-Select config cache flushes independently (see `tsv2ConfigCache`).

**5. Factory CN lookup must normalize before querying `lpb.*` tables**
`lpb.eng_race`, `lpb.eng_ball`, `lpb.eng_body`, `lpb.eng_sleeve` all store `control_no` in **5-digit suffix format** (`C25-00235`, `C11-00808`). Never query with raw user-entered strings — always normalize via `itemNoToCN` or the pattern in `sdsV2SearchService.searchByCn`:
```js
// Handles: "250235" (6-digit), "C25-0235" (4-digit suffix), "C25-00235" (5-digit)
const m = cnUpper.match(/^([A-Z])(\d{2})-0*(\d{4})$/);
if (m) cnUpper = itemNoToCN(m[2] + m[3]);
```
Raw input `C25-0235` → query fails silently (0 rows → `dimension: null`). Fixed 2026-05-28.

**6. `sds_excel_mapping` link**
Each `param_key` in `sds_parameter` must have a corresponding row in `sds_excel_mapping` (same `machine_type_name`) to appear in PDF. Audit: `GET /api/sds/v2/admin/audit/data-integrity`.

**`sds_grinding_image`**: uses `cn_prefixes text[]` and `process_codes text[]` (GIN indexed). Empty `process_codes='{}'` = default (matches any process).

### `sds_parameter` param_key naming
- A:I section: `row_{N}_{COL}` (value), `row_{N}_is_header`, `row_{N}_{COL}_type` (e.g. `red`)
- GW section (AN:AV): `gw_row_{N}_{COL}`, `gw_row_{N}_is_header`, `gw_row_{N}_{COL}_type`

### `{{dim.*}}` tokens — part dimensions fill themselves per CN

A cell holding a PART dimension must never store a literal number. `sds_parameter` rows with
`cn IS NULL` are **machine defaults**: they apply to every part that machine grinds, so a
number frozen there prints one part's dimensions on every other part's sheet — and the values
look plausible (12.700, 19.050), so nothing appears wrong on paper.

Store a token instead. It resolves from the part's own factory row at render time:

| token | meaning | `\|N` |
|---|---|---|
| `{{dim.OD}}` | outer diameter | `{{dim.W\|3}}` → `35.000` |
| `{{dim.ID}}` | bore / inner diameter | decimals, optional |
| `{{dim.W}}` | width | |
| `{{dim.SD}}` | derived `sqrt(OD² − W²)` | |

Works in A:I, the GW section, and mapped (`sds_excel_mapping`) cells; composable with text
(`Ø{{dim.OD}} mm`). Column resolution per part class lives in
`api/engineer/mtc/utils/partDimAlias.js` (BALL `ball_dia/in_dia/width`, RACE `od/id/width`,
SLEEVE `od/id/full_length`, BODY has **no** OD, SPHERICAL `sph_od/dall_id/sph_width` via the
`eng_sph_design` join, MECHA none). A class without that column resolves to null — it never
substitutes a different dimension.

**An unresolved token renders BLANK**, never the literal token and never a stale value, and
logs `[sds-pdf] dim.X unresolved for cn=…`. Blank reads as incomplete on a setup sheet; a
leftover number reads as real.

**Currently tokenised** (migration `db_migrations/20260719_sds_param_dim_tokens.js`):
KN-312A `row_38_H`/`row_39_H` (W, OD) · KS-500RD `row_45_H`/`row_46_H` (W, OD) ·
KS-B80 `row_24_H` (ID) · KS-H70 `row_56_H`/`row_57_H` (ID, W).

**Two things that surprise people:**
1. **Nothing is automatic.** A token fires only where someone put one in the config. New
   machines and new rows need the token added by hand in the MachineConfigTab editor.
2. **A per-CN override still beats the token** (precedence: CN+process > CN > machine
   default). Typing a value for one CN silently disables the auto-fill for that CN.

**Choosing OD vs ID for a vague label:** trust an explicit label (OUT DIA / BORE / WIDTH /
SPHERICAL DIAMETER) over any inference. "The value entered is the value being ground" is a
**tiebreaker for silent labels only** — KS-H70 grips the part by its bore and finishes the
sphere, so its `WORK BORE` cell is the HOLDING reference and that rule would give the wrong
answer. Before committing an inferred mapping, check it against the part population: does
the old frozen default equal that dimension across the parts the machine actually runs?
(KS-B80's 19.050 matched `in_dia` on 50 parts and `ball_dia` on 0 → ID.)

Not tokenised on purpose: values that are ranges (OC-16A/18BR/20BR `"Ø50 - 54"`), cells whose
default is already `"-"`, and **KN-312A `row_41_H` SHAFT DIA** — proven derivable from neither
part nor tooling (four CNs sharing one arbor carry four different values), so it stays per-CN.

---

## SDS Routes (`/api/sds/*`)

| Prefix | Controller | Notes |
|---|---|---|
| `/api/sds/v2` | `sdsV2Controller.js` | Search by CN — 10-min cache, rodpcPool graceful degradation |
| `/api/sds/v2/images` | `sdsV2ImageController.js` | Image upload/retrieval |
| `/api/sds/v2/admin` | `sdsV2AdminController.js` | Full admin management (isAdmin mutations); grid editor: `GET/PUT /template-grid`, `GET /template-grid/from-xlsx` |
| `/api/sds/v2-headless` | `sdsV2HeadlessController.js` | **PDF generation (Chrome grid + warm Puppeteer).** `GET /pdf-chrome/grid` = production SDS PDF; `/pdf-chrome` = HTML-template render; `/pdf-chrome/blank` = grid-editor preview. `/api/sds/v2/pdf` 307-redirects here. |

**SDS v2 Admin sub-routes** (all under `/api/sds/v2/admin/`):

| Method | Sub-route | Table | Purpose |
|---|---|---|---|
| `GET` | `/machine-types` | `sds_machine_type_code` | List machine types |
| `PUT` | `/machine-types/:id` | `sds_machine_type_code` | **Always rename via API** — cascades to `sds_parameter`, `sds_machine_tool`, `sds_excel_mapping`; flushes `sds:*` cache |
| `GET/POST/PUT/DELETE` | `/mappings[/:id]` | `sds_excel_mapping` | Excel cell → param_key mapping; `machine_type_name=null` = shared layout |
| `GET/PUT` | `/parameters` | `sds_parameter` | Upsert single param; `cn=null` = machine-config row |
| `POST` | `/parameters/bulk` | `sds_parameter` | Batch upsert |
| `GET/POST/PUT/DELETE` | `/machine-tools[/:id]` | `sds_machine_tool` | Tool ordering per (machine_type, process_code) |
| `GET` | `/machine-tools/combos` | `sds_machine_tool` | Distinct (machine_type, process_code) pairs |
| `POST` | `/machine-tools/bulk` | `sds_machine_tool` | Bulk replace tool list for a combo |
| `DELETE` | `/machine-tools/combo` | `sds_machine_tool` | Delete all tools for a specific combo |
| `GET` | `/audit/data-integrity` | multiple | Cross-check param keys vs excel mapping |

---

## SDS Approval → Kanban board (auto-intake)

`POST /api/sds/v2/approval` (a **live** sign) calls `kanbanIntake.syncCard` with
`sourceType='sds_approval'`, `sourceRef='<cn>||<machine_type_name>||<process_code>'`,
`stageKey=<role>`. One sheet → one card; each later sign moves that card. Fail-open:
a board problem never blocks the signature. `POST /backfill` is deliberately **not**
hooked — 4,196 historical rows would flood the board.

Whether anything happens at all is config, not code: `syncCard` silently no-ops
unless `mtc_board_config` has an enabled row. Current live config (set 2026-08-04):
board 25 `Setup Data Sheet`, `prepared→77 In Progress`, `checked→78 Check`,
`approved→79 Done`, owner `LE485`. Admin API: `GET/PUT /api/tooling-select/board-config/:sourceType`
(isAdmin) — **no frontend UI yet**.

### Backlog feed — coverage report → To Do (2026-08-04)

`default_list_id` (76 To Do) is reached by the *other* producer: after every successful
coverage build, `services/sdsBacklogIntake.syncNoStampBacklog` seeds a card for each row
that is `pending_reason === 'NO_STAMP'` **and not** `limit_excluded`. Those are sheets that
are tool- and config-complete with only the signature missing — a real task. The other
pending reasons are config gaps (256 rows vs 38 when this was built) and would bury the
board; limit-anomaly rows rest on contradictory data and are not actionable.

Manual trigger: `POST /api/sds/v2/report/backlog-to-board` (isAdmin), `?dryRun=1` to preview.
It reads the cached payload only and never kicks a cold build. `MAX_CARDS_PER_RUN = 150`
aborts the run rather than flooding a shared board.

Cards are seeded with **`createOnly`** — the feed re-runs on every rebuild, and without it
each run would drag already-signed cards back to To Do. One sheet therefore has one card
for its whole life: seeded in To Do, then moved by each signature.

> **Both producers must agree on `sourceRef` or a sheet gets two cards.** The report
> deduplicates a machine group to its *representative* (`TSG-300W`), while a signer picks a
> specific *member* (`TSG-300ZNC`). `utils/sdsBoardRef.boardRef` normalises the machine
> segment to the **group label** (`TSG-300W/TSG-300ZNC`) on both sides — the group, not the
> representative, because the representative is whichever member holds the Excel config and
> moves when config moves, orphaning every card keyed to the old value. Cards linked before
> this were re-keyed by `db_migrations/20260804_rekey_sds_board_card_link_to_group.js`
> (idempotent; skips rather than merges on collision).

> A helper that takes a process code must not name the parameter `process` — it shadows the
> Node global and `process.env` throws. Cost a silent no-op run before it was caught.

**Deep link.** The card carries a `kb_attachment` of `attachment_type='link'` pointing at
`/eng/mtc_eng/sds-v2?cn=&machine=&process=`, which `SdsV2Page` parses on mount to search
the CN and open that sheet's PDF/sign modal. It is an attachment, not a description line,
because the description renders as plain text (clicking it opens the editor). `_upsertLink`
is idempotent on `(card_id, file_path)` and runs on move as well as create, so cards made
before the link existed acquire one on their next stage change. Absolute when
`FRONTEND_BASE_URL` is set, else relative — fine while board and SDS page share an origin.

**Who may sign** — `sds_approval_role_config`, evaluated by `userCanSign`: department `AD`
or role `AD` bypasses everything; otherwise a role with **no enabled row denies everyone**.
`match_type` ∈ `any | department | role | feature_perm | em_id`. Sequential gating applies
to live signs only (`prepared` → `checked` → `approved`); `/backfill` skips it.

## Tool Request Workflow (`/api/engineer/mtc/tool-requests/*`)

Multi-stage approval workflow in `toolRequestController.js` + `toolRequestAuth.js`. Auth uses `mtcVerifyToken` (alias for `verifyToken`, different import path).

- `GET /tool-requests` — list; `GET /tool-requests/dashboard` — summary; `GET /tool-requests/permissions` — stage config
- `GET/POST/PUT/DELETE /tool-requests/:id` — CRUD
- `POST /tool-requests/:id/action` — stage-advance
- `GET/POST/PUT/DELETE /email-config[/:id]` — per-stage email config

---

## ECR / Tumble Routes

ECR (`api/engineer/process/eng_process_model.js`) — uses engPool + rodpcPool:
- `GET /api/ecr/users-by-dept/:dept`, `PUT /api/ecr/:id/resubmit`
- `POST /api/ecr/:id/tasks`, `GET /api/ecr/:id/tasks`, `PUT /api/ecr/tasks/:taskId/ack`

Tumble — full CRUD: `/api/tumble/getAllCondition|createCondition|updateCondition/:id|deleteCondition/:id` + same for Model.

Note: routes use "ECR" not "ECN" — ECN appears in legacy UI text only.

---

## System Routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /api/system/settings` | public | Read system settings |
| `POST /api/system/settings` | `requireSystemEngineer` (inline `server.js`) | Write system settings |
| `GET /api/system/user-management/schema` | public | Fetch user table schema |
| `GET/POST/PUT/DELETE /api/system/user-management/users[/:u_code]` | public/none | User CRUD |
| `POST /api/system/user-management/schema/add-column` | `requireSuperAdminOrEmergency` | Live ALTER TABLE |
| `POST /api/system/user-management/schema/drop-column` | `requireSuperAdminOrEmergency` | Live ALTER TABLE |

`requireSuperAdminOrEmergency` and `requireSystemEngineer` defined inline in `server.js` — not in middleware files.

## External Proxy

`GET /api/proxy/job_check` — no auth (whitelisted in global auth middleware). Proxies factory job-check API at `pkv0198.kz.minebea.local:5002`. Handler: `api/engineer/new_prod/tool.js`.
