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

> **Multi-template + CN-override precedence (2026-07-03):** (1) Templates: admin CRUD at `/api/sds/v2/admin/template-grids[/:id][/default]`; assign per machine via `PUT /machine-types/:id/grid-template`; editor picker in `SdsBlankTemplateGrid.jsx`; assignment column in `MachineTypes.jsx`. Singular `/template-grid` GET/PUT now target the **default** template. (2) In `applyDataToGrid` an explicit `sds_parameter` value (machine-default or per-CN, CN wins) now **overrides** the auto-derived factory scalar — this is what lets a CN override edit `ct` (CYCLE TIME → cell B4); `ct` is exposed in `HEADER_CELL_FIELDS` (SdsV2AdminPage MachineConfigTab). (3) Grinding image lookup matches the **full CN and the 3-char prefix**, ranking a per-CN image above a family-prefix image; upload UI (`GrindingImagesTab`) accepts specific CNs (stored in the same `cn_prefixes` text[]). **Superseded 2026-08-13** by a third, broader level (2-char class prefix) plus an edit route — see "Three targeting levels" below.

> **Retired:** `sdsV2PdfController.js` (ExcelJS → LibreOffice/soffice), `mtcController.generateSdsPdf`, and the LibreOfficePortable binary were deleted. The old "never apply ExcelJS borders to `sds_template.xlsx`" constraint only mattered for that xlsx→LibreOffice path; borders are now designed in the grid editor.

### Adding a machine to Tooling Select does NOT put it in SDS

The two systems share no table. `sdsV2SearchService` never reads `tooling_machine`; it reads
the factory process plan (`lpb.eng_r_pi_tool`, `lpb.eng_process_info`, `rodpc.eng_process`).
A machine added to Tooling Select stays invisible in the Setup Data Sheet picker until it is
registered separately. `SdsV2Page.jsx` builds that picker from two sources:

| path | matches on | table |
|---|---|---|
| `byConfig` (authoritative — "has SDS data") | `machine_type_name` having a row for the process | `sds_machine_tool` |
| `byCode` (fallback) | `machine_type_code` == `tool_dwg_no.substring(1,4)` | `sds_machine_type_code` |

So **`machine_type_code` is the drawing family prefix minus its leading digit** — 021 =
KS-B80 (4021), 560 = OC-16A (4560), 857 = X-100 (4857). It is UNIQUE.

**Check the dictionary before naming a new machine.** `sds_machine_type_code` already
assigns most drawing families to the machine model that uses them, and those names predate
anything added to Tooling Select. Three machines named after their *process* in
`20260815_rename_…` had to be renamed again in `20260815d_…` once the dictionary was read:

```
649 → LB15          (was TURNING)      918 → MD-V9910WA   (was L/MARKING)
651 → LNC45/C200    (was FINISH ID)    800 → その他 — a catch-all bucket, not a machine
```

Two names for one machine is precisely the drift `GET /api/sds/v2/admin/audit/machine-identity`
exists to surface, so align Tooling Select to the dictionary, never the reverse. THREAD ROLL
kept its process name only because 4800 maps to the その他 bucket; it claimed code 801, an
inactive `no data` placeholder nothing referenced.

`tooling_machine.sds_machine_type_id` fills itself from `machine_name` via trigger
`trg_tm_set_sds_machine_type_id` — but only if a dictionary row with that exact name exists,
and **no application code reads the column** (it is a join/audit link only). A NULL there
breaks nothing; a missing `sds_machine_tool` row is what keeps a machine out of the picker.

> `SCOPE_WC = ['09','29','30','37']` in `sdsV2AdminController.js` scopes the read-only
> machine-identity **audit** to grinding work centres. It does not gate the picker — widening
> it only adds rows to a report.

Registering a machine makes it *selectable*; it creates no SDS content. Grid layout, Excel
parameters and grinding-wheel config still have to be set up in SDS Admin.

**Duplicate dictionary rows are normal and mostly harmless**: KN-113A has three (816/852/853),
LB15 two (649/682). The picker dedupes by name (`mergedMap[machine_type_name] = m`), but the
trigger links `sds_machine_type_id` to the **lowest id**, so a join that matters should not
assume the code matches the drawing family.

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

> **`process_code` must be ONE code per row.** Every consumer matches it exactly (PDF whitelist `WHERE process_code = $2`; coverage `checkToolingMatch` keyed `machine||process`), so a comma-joined value like `'1241,1242'` is silently dead config — the tools never appear in PDFs and never count as a tooling match. Insert one row per process code. Existing comma rows (KS-H70/OC-16A/GS-64PF) were split by `api/engineer/mtc/db_migrations/20260613_split_sds_machine_tool_comma_process.js` (idempotent — safe to re-run).

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

**Three targeting levels (2026-08-13).** `cn_prefixes` holds any mix of:

| stored value | level | meaning |
|---|---|---|
| `C39-04137` | CN | this part only |
| `C39` | family | the Sub Class |
| `C3` | **class** | every Sub Class under it — the fallback when the family has no picture |

Resolution is **specificity-first** (CN → family → class); a process-code match only breaks
ties *within* one level, so a per-CN default still beats a family image that names the
process. The rules live in **`utils/grindingPrefix.js`** and all three consumers must use
them — `sdsV2HeadlessController.buildValueMap` (what prints),
`GET /images/grinding/:cn_prefix` (the admin preview) and the coverage report's
`matchImage` (the "Missing" list). Coverage matching the exact prefix only would list
families as gaps that already print a class picture.

> **6-digit item-no trap.** A part is written both `C29-00774` and `290774`, and the
> renderer only ever holds the control-no — so a target stored as `290774` matches
> nothing, prints nothing and logs nothing. Found live on record #47, dead since upload.
> Both sides now tolerate it: writes normalise via `normalizeTarget`, lookups match either
> spelling via `cnMatchKeys().exact`. Re-saving an affected row through the admin UI
> rewrites it canonically.

**Editing** — `PUT /api/sds/v2/images/grinding/:id` (multipart, same fields as POST). The
image file is **optional**: omit it to change only the targeting and keep the binary, so
retargeting no longer requires having the original file to hand. Unlike POST it does not
delete overlapping records. Both POST and PUT flush `_covCache`.

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

**Currently tokenised** (migration `api/engineer/mtc/db_migrations/20260719_sds_param_dim_tokens.js`):
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
> this were re-keyed by `api/engineer/mtc/db_migrations/20260804_rekey_sds_board_card_link_to_group.js`
> (idempotent; skips rather than merges on collision).

> A helper that takes a process code must not name the parameter `process` — it shadows the
> Node global and `process.env` throws. Cost a silent no-op run before it was caught.

### Signing from the board itself (2026-08-14)

`GET /api/sds/v2/approval/board?board_id=` answers **one board in four queries** — links,
approval rows, `sds_rev` params, role config — and the board renders Prepared / Checked /
Approved on each SDS card (`Board/SdsSignBadge.jsx`, fed by `store/sdsApprovalSlice.js`,
fetched from `fetchBoardDetails`). Signing posts the existing `POST /approval`; the card
then moves itself, because the intake above already fires on a live sign.

- **Batched on purpose.** The obvious `/state`-per-card is 40+ round trips on load today
  and up to 150 after a backlog run, each re-reading the role config.
- **`canSign` is never re-derived client-side.** It comes from the same `userCanSign` +
  sequential gate the POST enforces; a second copy drifts towards a button that looks
  available and then fails.
- **A group label names no single sheet.** `boardRef` normalises the machine to the group
  (`TSG-300W/TSG-300ZNC`), and `sds_approval` is keyed by the real machine — so the
  endpoint expands it via `sdsBoardRef.groupMembers` and resolves only when there is one
  candidate, or when exactly one candidate already has a sheet started. Otherwise the card
  is returned `ambiguous: true` with no inline signing and falls back to the deep link, so
  the operator picks the machine on the SDS page. Guessing a member would stamp a signature
  on a sheet that is not the one printed. Live board: 38 of 40 links resolve straight
  through, 1 resolves by "already started", 1 stays ambiguous.

> **The list a card sits in and the signatures on its sheet can disagree**, and the badge
> now makes that visible — a card was found sitting in *Check* with only Prepared signed.
> The list is moved by the intake at sign time and by anyone dragging it; the badge reads
> `sds_approval`. The badge is the authority on what is signed.

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

---

## SDS print log — `sds_print_log` (2026-08-25)

**PDF generation had recorded nothing since 2026-06-14.** The `INSERT ... 'PDF'` lived at
`sdsV2PdfController.js:687`; commit `cd689e9f` ("PDF cancel LibraOfice") deleted that whole
file when the Chrome grid renderer replaced LibreOffice, and the replacement never carried
the logging over. Last `access_type='PDF'` row in `sds_access_log` is 2026-06-13, while VIEW
kept running (200–400/month). The public deep link has **never** logged anything.

`sds_print_log` (migration `20260825_sds_print_log.js`) is separate from `sds_access_log` on
purpose: that one answers "who opened the screen", this one answers "which sheet was printed,
for which part and lot, when" — and only the second has to stand up as a reference later.

Written by `services/sdsPrintLog.js`, called from both PDF paths **after** `res.send`:

| path | source | requested_by | carries a lot? |
|---|---|---|---|
| `GET /api/sds/v2-headless/pdf-chrome/grid` (JWT) | `app` | `req.user.empno` | **no** — see below |
| `GET /api/public/sds/pdf` (shared key) | `public` | (none — `source` is the whole attribution) | yes, when the caller sends `&lot=` |

**The in-app button has no lot picker, by decision (2026-08-25).** The route accepts `lot`, but
nothing sends one: the lot is knowledge the production-planning side holds and an operator at
the SDS screen does not, so asking there would only invite a typo. `source = 'app'` rows
therefore carry `lot_no = NULL` and `lot_verified = NULL` — the correct record of "no lot was
stated", not a gap to backfill.

Four rules that are easy to undo:

- **A logging failure must never fail a print.** `record()` catches everything and returns
  null; both callers invoke it without `await` after the response is sent.
- **The lot is never guessed.** One SDS serves a (CN, machine, process) and therefore many
  lots — C31-04050 @1041 has 28, C31-00781 has 208 — and even within ±15 days only **67.4 %**
  of (CN, process) pairs resolve to a single lot. `lot_verified` is `null` (not supplied) /
  `true` (found in `lpb.pc_lot_process`) / `false` (supplied, not found). A mismatch is
  **flagged, never refused** — the plan can lag the floor, and blocking a print to protect a
  log stops real work.
- **`parts_no` comes from `lpb.eng_item`, not from `tooling_spec_process.pn`** — the plan has
  it for essentially every C/N, the spec table for 13.7 % (2,274 / 16,631).
- **`pdf_sha256` is the point of the table.** Configuration moves (24 slots were added to
  `sds_machine_tool` on 2026-08-25 alone), so the same CN printed on two dates is legitimately
  two different sheets. The PDF itself is not stored; the hash and `tooling_snapshot` (the
  T01–Tn list as rendered) are.

> The two `control_no` spellings are NOT interchangeable: `lpb.pc_lot.control_no` is the
> **6-digit item number** and may carry a variant suffix (`350528-C`); `lpb.eng_item.control_no`
> is the **control number** (`C31-04050`). `cnForms()` derives both — use it rather than
> picking one.

### The public link now takes `lot`, and it does not break an old link

The route ignores query params it does not know, so `&lot=` was added with no version bump —
existing links work byte for byte and the caller adopts it whenever it is ready.

```
GET /api/public/sds/pdf?cn=314050&machine=SPG-03&process_code=1041&lot=C14781&key=…
GET /api/public/sds/lots?cn=314050&process_code=1041&key=…      ← so `lot` is picked, never typed
```

**No per-caller field.** This route has exactly one caller, so `source = 'public'` is the whole
attribution; a `?by=` would only ever hold one value. Add one the day a second system calls it.

`/sds/lots` mirrors the role `/sds/machines` already plays. **Send `process_code` with `lot`**:
a lot belongs to a (control_no, process) pair, so without it the check only proves the lot
exists somewhere on that CN. `_meta` on `buildGridHtmlForRequest` is an out-param each request
owns — it carries `valueMap.tooling` back out for the snapshot without changing existing callers.

Covered by `tests/mtc/sdsPrintLog.test.js` (13 tests) — the two properties pinned are that
"not checked" never collapses into "not found", and that a DB failure returns null instead of
throwing.

### A blank Tool No on a slot the config reserves: the fixture-dedup key (2026-08-26)

CN **414303** on X-100/2071 printed **T02 PIN with no Tool No and no image** while T01/T03/T04
carried theirs. Nothing was missing: T-Select finds the pin (`4857-02-0017`, `-0032`), the
whitelist reserves T2 for `4857-02`, and the image was on file. The renderer **discarded** it.

`canonFixtureName` matches on a **substring**, so `ARBOR PIN` canonicalizes to `COLLET_ARBOR`
— the same value as `ARBOR`. The wrong-band dedup in `buildValueMap` keyed on that canon
alone, so once T01's ARBOR was placed the pin looked like a duplicate of it and was skipped.
Whichever fixture the `tooling_formula` sort order reaches first wins; the other vanishes.

**The key is now `(canon fixture, DWG family)`** — `makeFixtureTracker()`. "Wrong band" means
a different *suffix* of one family (`4547-01-0017-05` vs `4547-01-0031-07`), so the family is
what makes two tools the same fixture; the canon still separates the MSB jigs that genuinely
share family 4547-01 (BASE / COLLET / COLLET ARBOR / COLLAR).

Five fixture groups in the live config collide on canon, and four are fixed by this:

| machine | names | families |
|---|---|---|
| X-100 | ARBOR · ARBOR PIN | 4857-01 · 4857-02 |
| KL-20 | 4030-01_COLLET · 4030-02_COLLET | 4030-01 · 4030-02 |
| J-WAVE | COLLET OP1 · COLLET OP2 | 4879-04 · 4879-05 |
| KS-H70 | COLLET · COLLET (A) · COLLET BODY | 4691-19 · 4691-03 · 4691-18 |
| FTL-10(I) | COLLET OP1 · COLLET OP2 | **4501-01 both** — residual |

FTL-10(I) is one fixture by this key *and* one slot to `makeConfigSlotResolver`, which keys on
the same family. Separating those two needs config work, not a different dedup key.

**Measured before and after over 249 (CN, machine, process) combos** — every `sds_print_log`
row plus two live CNs per `sds_machine_tool` combo: **247 byte-identical, 2 changed, both a
blank slot becoming a real tool** (414303 T02, and `C29-04073` KS-H70/1081 T07 COLLET BODY
`4691-18-8500`). Pinned by `tests/mtc/sdsFixtureSlot.test.js`.

> **A missing tooling IMAGE is a separate failure with the same symptom.** 414303's T04 was
> imageless on the same sheet for an unrelated reason — no `sds_tooling_image` row for family
> `4857-04` — and uploading one fixed it with no code change. Check `sds_tooling_image` for
> the 2-segment family before assuming the slot logic dropped the tool: a slot with a Tool No
> but no picture is a data gap, a slot with **neither** is this bug.

### Comparing `sds_machine_tool` against TEMPLATE_B (2026-08-26)

Full sweep: 31 sheets → **274 distinct (process, DWG family) pairs**, 177 covered, 97 missing;
509 config rows, 273 the workbook does not list. Method and the full gap list live in
`api/engineer/mtc/doc/tooling_select_audit_findings.md` (รอบที่ห้า). Three things about the method are worth
knowing before anyone re-runs it, because each one silently changes the answer.

**Resolve a row to a machine through the DWG family, never the machine column.** That column
holds 45 different spellings (`KS-B22G (ID≦φ15.875MAX)`, `(FTL)`, `KS H70`) and **339 usable
rows leave it blank** — the machine is inherited from the block header above. The
`machine_type_code` = family middle digits rule (4858 → 858 → XD-8) resolved **162 of 162**
families.

**Two row classes must be dropped before counting.** A grey fill means "not selected for this
part family" (145 rows), and a DWG written in parentheses — `(4858-01-`, `(4858-09-` — is a
sub-component of the ASSY above it, not its own T-slot (37 rows). Counting either inflates
the gap list with things that were never meant to be slots.

> Sanity-check the fill reader before trusting a run of white: this workbook carries real
> fills (`66FFFF`, `FFFFCC`, theme0 with negative tint), so "no fill anywhere" means the
> parser is wrong, not that everything is selected.

**"Differs from TEMPLATE_B" is not "wrong" — weigh every difference against the factory
plan.** Of the 273 config rows the workbook does not list, only **14 (5 %)** were defects:

| | rows | |
|---|---|---|
| `…1 / …2` process pairs | 25 | TEMPLATE_B usually writes only the first — KS-H70 1082/1242, OC-16A 1012, KVD-300CRII 1022. Deliberate. |
| the plan ahead of the workbook | ~11 groups | KS-400B6 @1041 **182 C/N**, GI-20N @1121 84, IG-15N @1121 52. Deleting these breaks live sheets. |
| genuinely misplaced | **14** | workbook silent **and** plan ≈ 0 |

**The bar for deleting is both sources agreeing.** Aligning to TEMPLATE_B alone would have
deleted KS-400B6's 182-C/N configuration.

`20260826d_sds_machine_tool_template_b_align.js` acts on exactly that: removes XD-8 @2031,
J-WAVE @2031 (both copied from their own 2071 rows — 2031 is X-100's, 531 C/N against 1) and
KN-312A @1161 (the two rows named 4828, which belongs to `KN-312A (EGM)` and has **zero** plan
rows at 1161). It adds the whole of **process 2021**, which
had **no config row for any machine** — XD-8 (67 C/N), FTL-10(I) (19), J-WAVE (23) — plus
X-100's missing `4857-04` @2031 (479 C/N).

> **Creating a combo's FIRST whitelist row can REMOVE a tool that renders today.**
> `buildValueMap` filters the part's own process plan through `configSlotOf`, so a planned
> tool outside the whitelist is dropped. Measure per family before writing the slot list:
> XD-8 @2021 would have lost `4858-04` INTERMEDIATE STATION ASSY on **28 of 69 C/N (41 %)**,
> so it went in as T8 — while the same family at 2071 is 11 of 1,305 (0.8 %) and stays out.
> The asymmetry is the measurement: every whitelist family also prints a NAMED, Tool-No-less
> row on every sheet that does not use it, so a family carried by 1 % of the work is noise on
> the other 99 %. A DWG written in parentheses in TEMPLATE_B (`(4858-09-` PIN) is a
> sub-component of the ASSY above it and correctly never becomes a slot.

> **A WRONG-FAMILY whitelist HIDES the part's real tools, and deleting it gives them back.**
> KN-312A genuinely runs process 1161 (its own code is 837; 16 C/Ns plan a 4837-xx tool there)
> — but its two config rows named **4828**, a family with zero plan rows at that process. Since
> the whitelist FILTERS the plan, those two rows discarded every 4837 tool the part carried and
> left only two T-Select 4828 suggestions. After the delete, C39-00728 renders PLATE 4837-01,
> COLLET FOR INNER GROOVE 4837-08, LOADER JAW 4837-01 and SHAFT 4837-02 again. So check what a
> stray combo is *suppressing*, not just what it wrongly offers.

Two standing rules this run reaffirmed: new slots **mirror the machine's own sibling process**
for slot order (as `20260821o_` did for 2412 ← 2411), and a machine's slots are never restored
just because the workbook lists them — X-100's `4857-06`/`4857-08` are absent **by decision**
(added by `20260821k_`/`20260821n_`, removed by hand), while `4857-04` was simply never
inserted. Check `git log` and the migration folder before calling an absence a gap.

### The name on a slot with no Tool No — `pickFamilyName`

A config slot the part has no Tool No for still prints the fixture's NAME, resolved from
`lpb.eng_tooling` by DWG family. A family holds several drawings with different names, so
something has to choose. **The shop's own usage chooses**: among the family's ASCII names,
the one the factory plan uses most.

Two rules this replaced, both measured against the plan across all 266 whitelist families:

| rule | agrees with the plan |
|---|---|
| "first ASCII name the DB returns" (the original — no `ORDER BY`, so arbitrary) | 46 % |
| `ORDER BY tool_dwg_no` | 35 % — **worse**; sorting is not evidence |

The original printed `WORK STOPPER BASE` for XD-8's `4858-11`, a drawing the plan has
**never** used, over `WORK STOPPER` which it uses 224 times and which is the name TEMPLATE_B
prints; and `PALLET` for MD-V9910WA's `4918-01` (16 rows) over `UNIVERSAL PALLET ASSY` (132),
which put the same word on two different slots of one sheet. Both came from the floor.

Three properties are load-bearing:

- **ASCII is a hard gate, not a tie-break.** The sheet is printed in English, so an unplanned
  ASCII name still beats a busy Japanese one — otherwise `COLLET` becomes `コレット` and
  `COLLAR` becomes `球研アーバー用カラー`. Only a family with **no** ASCII name at all falls
  through to the plan's pick among the Japanese ones, and that fall-through matters: it is
  what keeps the retired `外研アーバー用ナット ON0001（使用禁止）` off `4586-04`'s sheets.
- **An evidence floor.** Replacing the incumbent on ONE plan row is noise, so the winner needs
  `MIN_PLANNED` (10) rows — unless the incumbent is a drawing the plan has never used, where
  any real usage beats none.
- **`planned` empty** (count query failed, maqdb down) ⇒ first-ASCII, unchanged.

Live effect over 249 rendered sheets: **26 name changes**, every one either replacing a
never-planned name or backed by ≥10 plan rows — `V BLOCK(DOUBLE)`→`V BLOCK(TRIPLE)` (13 vs
687), `JAW(B)`→`JAW`, `PILOT PIN`→`PILOT PIN ASSY` (3 vs 62), `MANDRELL ASSY`→`SPHERE TURN
ARBOR` (0 vs 7). Pinned by `tests/mtc/sdsFixtureSlot.test.js`.

> **Two calls worth knowing about, both deliberate.** `4566-01` prints **`OD GRIDO ARBOR`**
> (32 rows) over `ARBOR` (9) — `GRIDO` is a typo in the factory master data, and the rule
> follows usage rather than spelling. `4691-10` prints `COLLET ADAPTER` (46) over `JOINT`
> (43), a near tie between two real names for one part. Either can be settled by fixing
> `lpb.eng_tooling`, not by tuning the rule.

> **Do not "fix" this into a plain most-used rule.** Dropping the ASCII gate or the floor was
> each measured and each loses. Measure against `lpb.eng_r_pi_tool` first.

> The plan-count query is scoped to the families of the empty slots on **one** sheet (~50 ms,
> 122k-row table) and never runs when every slot already has a tool.

### A NAME-keyed tooling image is scoped to ONE DWG family (2026-08-26)

`sds_tooling_image` can be keyed by fixture NAME instead of DWG number, so one picture serves
every bore-ID band of a fixture whose drawing changes per band — the MSB grinders' BASE /
COLLET / COLLET ARBOR / COLLAR, all `4547-01-{band}-{comp}`.

The key was the **bare name**, `NAME:COLLET`, and the renderer matched it against any slot
with that tool name. "Every band of this fixture" quietly became "every tool called COLLET in
the factory". Reported from the floor: **KL-20 T02 printed the MSB COLLET picture**, on a
machine nobody had configured an image for. Measured: **46 (machine, family) pairs** could
receive one of the five NAME images — XD-8 `4858-22`, KS-H70 `4691-19`, KN-312A `4828-01/-02`,
J-WAVE `4879-06`, LNC45/C200 `4651-12`, DTS-IS `4691-07` and ~35 more. Families that happened
to own a DWG-keyed image were shielded by it; the rest printed the wrong fixture.

The key is now **`NAME:<family>:<TOOL>`** (`NAME:4547-01:COLLET`), built by `NAME_IMG_KEY`
and mirrored in the admin upload form — where the DWG-family field is now **required** in
by-name mode. `20260826e_` re-keys the five existing rows. A bare `NAME:<TOOL>` row matches
nothing, which is the fix rather than a loss.

> The family a slot is scoped by is `dwgPrefixOf(cleanDwg || cfg_family)` — the tool's own
> DWG when it has one, else the **whitelist's**, and both go through `dwgPrefixOf` because an
> MSB whitelist row is the 4-segment `4547-01-0031-02` while the image is keyed on `4547-01`.

Verified after the change: PSG-64 and GS-64PFII still print their COLLET / COLLET ARBOR /
COLLAR pictures on `4547-01-0024-xx`; KL-20, XD-8, KS-H70, AUG25-4 and LB15 stopped printing
them (16 slots across the 249-sheet sweep).

### The image-upload picker could only reach the FIRST family of a series

`GET /api/sds/v2/images/tooling/search` returned raw drawings with `LIMIT 20`, and the picker
groups whatever comes back down to 2-segment families. Twenty `4918-01-xxxx` rows therefore
grouped to **one** option: `4918-02`, `-03` and `-10` were unselectable, and `4858` offered
only `4858-01` out of that series' twenty-two families. **An image for a family the picker
cannot reach never gets uploaded** — which is exactly why `4918-02` PALLET had no picture
after someone believed they had uploaded one.

The query now groups to families in SQL (`DISTINCT ON (family)`, `LIMIT 40`), labels each with
the family's most-planned ASCII name so the picker and the sheet agree, and **matches the tool
NAME as well as the number** — searching "PALLET" used to return nothing at all.

> The plan count must be a JOINed aggregate, not a per-row correlated subquery: as a subquery
> this took 2–3 s, which an autocomplete firing per keystroke cannot wear. ~200 ms as written.


### A slot with no Tool No still gets its FAMILY's image (2026-08-26)

The DWG-image lookup was gated on the tool having a Tool No — `tool.cleanDwg ? find(…) : null` —
and the candidate set was built from the part's actual tool DWGs. So a config slot the part
plans nothing for could show the fixture's **name** and never its **picture**, even though the
whitelist says which family the slot is and images are keyed at exactly that level.

Reported as "I set the machine tool config for 4918-01 and the image still does not show":
`MD-V9910WA` @3491 T01 printed `UNIVERSAL PALLET ASSY` with no picture for every part whose
plan has no `4918-01`, while the parts that plan one got it. The config family is now a
candidate in its own right and matches when there is no Tool No. 30+ slots across the
249-sheet sweep gained their picture.

### An alternative that was not chosen is not listed — measured, not guessed

Two config slots can hold **mutually exclusive families for ONE fixture**: KL-20 grips with
COLLET `4030-01` **or** `4030-02` and never both; MD-V9910WA marks on PALLET `4918-01` **or**
`4918-02`. The name-only fill printed every configured family, so the option the part does
**not** use appeared as a named row with no drawing — reported from the floor twice.

**Which slots are alternatives is measured from the factory plan, and the two obvious rules
were both wrong.** "Same fixture name" looked obvious and over-fired: KS-400B1 carries a
second PLUG(A)/PLUG(B) pair whose families `4664-06` and `4664-21` the plan puts on the SAME
C/N 15 times out of 15 — complements that happen to share a name. What separates them is
whether the plan ever puts the two families on **one C/N at this process**:

| | families | C/N each | together | |
|---|---|---|---|---|
| KL-20 | 4030-01 + 4030-02 | 720 / 655 | 5 | **1 % — alternatives** |
| MD-V9910WA | 4918-01 + 4918-02 | 145 / 138 | 0 | **0 % — alternatives** |
| KS-H70 | 4691-03 + 4691-19 | 53 / 141 | 0 | **0 % — alternatives** |
| GI-20N | 4652-10 + 4652-12 | 84 / 57 | 21 | 37 % — unclear → keep |
| KS-400B1 | 4664-06 + 4664-21 | 15 / 15 | 15 | 100 % — complements |
| XD-8 | every 4858 pair | | | 85–100 % — complements |

The population is **bimodal** — of 984 judged pairs, 690 sit at ≥80 % and 72 at 0 % — so the
threshold (`ALT_MAX_TOGETHER_PCT = 5`) lands in an empty gap rather than on a slope.

Three conditions, each earned:

- **Same 4-digit drawing series.** A fixture's alternatives are variants of it. Without this,
  GI-20N's CLAMP PLATE `4652-12` and its ROTARY DRESSER `4800-42` co-occur **0** times — they
  do different jobs — and every sheet carrying the dresser dropped the clamp plate's name.
- **`MIN_ALT_CNS = 5` on both families.** Below that the plan has not said anything yet.
- **Fails toward SHOWING.** Too little evidence, or a failed query, means not alternatives and
  the name still prints. Hiding a complement loses a fixture the setup needs; showing an
  unused alternative is only noise.

Only a slot with **no Tool No** is ever dropped, so nothing carrying data is removed — and a
machine that genuinely mounts both has them filled from the plan and is untouched (see
`A41-02281`, which prints both pallets). 11 of 249 sheets change; `alternativeFamilies` and
`dropUnchosenAlternatives` are pinned by `tests/mtc/sdsFixtureSlot.test.js`.

> **Two ` *` suggestions in mutually exclusive slots are still NOT suppressed**, because both
> carry a Tool No. KL-20 @2562 shows `4030-01-3003 *` beside the plan's `4030-02-0012`. If a
> process truly uses only one family, configure only that one — the whitelist is where that
> belongs, and hiding a tool that has a drawing number would hide real data.

> The co-occurrence query is scoped to the whitelist's families at **one** process code and
> runs only when the sheet has an empty config slot: 50–350 ms depending on how much of the
> plan the families cover.

### `DISTINCT ON` with no tie-break made the same sheet render differently

`_attachSimilarRefFromFactoryPlan` and `_attachSimilarRefFromPartnoMap` both pick the nearest
reference part with `DISTINCT ON (…) … ORDER BY …, dist ASC`. **Equal distances are common** —
a family's reference parts share dimensions — and with no tie-break Postgres returns whichever
row it reached first, so the choice could change between cache rebuilds.

Live: X-100 `4857-04` on C/N 414303 alternated between `-0035` and `-0013` across rebuilds of
`tselect_cn_cache`, with no data change behind it. That also makes `sds_print_log.pdf_sha256`
differ for two prints of a sheet nothing had touched — the column that exists to prove two
prints are the same sheet.

Both queries now end `…, dist ASC, <tool_dwg_no>, <ref cn>`. **Two consecutive full sweeps of
all 249 (CN, machine, process) combos are now byte-identical**; before the tie-break they were
not.

> A flipped ` *` tool is not evidence of a config change. Check `tselect_cn_cache.built_at`
> before hunting for one — a flush (any admin write goes through `flushTselectOnWrite`) used to
> be enough to change the answer.

### Filling a TEMPLATE_B gap: four things that disqualify a row (2026-08-27)

`20260827_sds_machine_tool_fill_template_b_gaps.js` closed 38 combos / 106 slots and took
TEMPLATE_B coverage from **187 to 237** of its 274 (process, family) requirements — 48 → 83
of the 108 (machine, process) pairs, with **all 249 swept sheets byte-identical**. Copying
the workbook straight in would have written four kinds of wrong row:

| | disqualifies |
|---|---|
| **1. The whitelist hides a planned tool** | So the slot list is TEMPLATE_B's families **∪ every family of that machine the plan uses at that process**, including ones the workbook never lists (`4800-10`, `4866-10`, `9901-14`). With the workbook's list alone, 12 combos lost a planned tool on up to **100 %** of their C/Ns. With the union: zero. |
| **2. The plan never uses it there** | 22 families at 0 C/N. Same shape as the KN-312A @1161 rows `20260826d_` deleted: it offers the machine in the picker for parts that can only render blank, and its whitelist then hides the tools they really carry. |
| **3. Someone removed it by hand** | X-100 `4857-06`/`4857-08` stay out. See the note below — the deletion has a cost, but paying it is the floor's call. |
| **4. The sheet cannot open at all** | `APL-001`/`AXPL-01` @2211 are entirely class **F00/F01** (assembled rod-ends) and `getSearchData` has no part-type mapping for those prefixes, so every C/N fails `Unknown CN prefix`. 316 C/N planned, 0 sheets openable. |

> **Rule 4 only shows up if you RENDER.** `AXPL-01 @2211` passes every paper check — the
> workbook lists it, the plan has 180 C/N, the machine is named in the registry — and fails
> every actual sheet. "The data exists" and "a sheet can be opened" are different questions,
> and only rendering answers the second. Render each new combo before shipping the config.

> **X-100 @2031 is already losing 78 % of its planned tools.** The whitelist there
> (4857-01..04) filters out `4857-06` (408 C/N) and `4857-08` (400 C/N), so **414 of 531
> C/Ns** drop a tool the plan assigns them. That is the standing cost of the hand-removal,
> not something the fill introduced; X-100 was excluded from it entirely rather than
> half-patched, because the only family left to add there is `4857-05` (1 C/N).

**What remains is 25 pairs, and every one has a recorded reason** — 9 blocked on registry
naming (**13,686 C/N**, the largest gap in the workbook: code 571 SWAGE alone is 4,483 C/N and
its `machine_type_name` is literally `no data`), 2 on the X-100 decision, 2 unreachable, 12 at
0 C/N. Nothing is pending without an explanation.

### Retiring a tooling means three tables, not one (2026-08-27)

X-100's LOADER JAW `4857-06` and INVERSION JAW `4857-08` had their `sds_machine_tool` slots
deleted by hand. Nothing else went with them: `tooling_x100` still stocked both and
`tooling_partno_map` still pinned them per C/N (**522 and 498 rows**), so
`_applyLookupOnlyToolings` kept returning them and **the Tooling Select page kept showing
them** — while the SDS sheet, whose whitelist filters the part's own plan, showed neither.

```
A41-00056  Tooling Select → LOADER JAW 4857-06-0009 [pinned by cn]
           SDS sheet      → absent   (414 of 531 C/Ns at 2031 lost a planned tool)
```

One system, one part, two answers — and the missing tools were **factory plan** rows, so they
belong on the sheet without the ` *` marker. Restored as T5/T6 by `20260827b_`.

> **A tooling's configuration lives in three tables.** Removing one of them does not turn the
> tooling off; it makes the screens disagree. Retire all three (`20260821k_ --revert` drops
> the shelf and the C/N map together) or none.

### `pickFamilyName`: "English" is a SCRIPT test, not a byte test

Restoring those slots printed **`LOADER JAW BASE`** — a drawing the plan has never used — over
`LOADER CHUCK(Φ12～Φ30)`, which it uses **381 times**. The gate was `/^[\x00-\x7F]+$/`, and
`Φ` (U+03A6) and `～` (U+FF5E) fail it although they are symbols inside an English name. Every
planned name in family 4857-06 carries one, so all three were disqualified at once.

The test is now **Latin letters present, and no kana / CJK / Thai**. Measured across all 305
whitelist families: **2 change, both onto a name the plan uses far more** (4857-06 0→381,
4858-12 1→164), none the other way; 3 of 249 swept sheets.

> A size-annotated name can now win a slot label — `INVERSION JAW (S)` (247 planned) over the
> generic `INVERSION JAW` (4). That is the rule following usage, and it is settled by fixing
> `lpb.eng_tooling`, not by tuning the rule — same as the `OD GRIDO ARBOR` typo.

### TEMPLATE_B conformance is a page now, not an export (2026-08-27)

`GET /api/sds/v2/report/template-b-conformance` → `services/templateBConformance.build()`, shown
at `MTC_PATHS.SDS_TEMPLATE_B` (`TemplateBConformancePage.jsx`, sidebar key `sds-template-b`).
It answers, per (machine, process): which DWG families TEMPLATE_B specifies, which
`sds_machine_tool` has, and how many C/Ns the plan puts behind each — so an edit in SDS Admin
shows up on the next load instead of waiting for someone to regenerate a static export.

The comparison method is the audited one and its three traps are in the service header: resolve
a row to a machine through the **DWG family** (the machine column has 45 spellings and 339
usable rows leave it blank), drop **grey fills and parenthesised sub-components** before
counting, and keep "config the workbook does not list" in its **own bucket** rather than calling
it a defect.

**Every remaining gap carries a `reason`** — registry not named / plan never uses it / SDS cannot
open that class — and `kpi.unexplainedGaps` counts the ones that do not. That number is meant to
stay 0: a blank reason means the page is hiding a decision, and the page prints the count so it
cannot be missed.

> Cost: one workbook parse (31 sheets) plus four queries ≈ **1.5 s cold**. The workbook is read
> once per process and cached in memory — it only changes when someone commits a new copy. The
> payload is persisted to `sds_coverage_cache` under id `template_b_conformance`, so a fresh
> process answers in **~160 ms** from the row instead of re-parsing; in-memory TTL is 10 min and
> `?refresh=1` skips both, which is what the page's "อ่านค่าล่าสุด" button sends.

### An alternative group occupies ONE slot, and it is the group's first (2026-08-27)

Suppressing the unchosen alternative left its slot number empty, so a part that uses the
second of two pallets printed at **T02 with a hole at T01** — which reads as missing data.
Reported on MD-V9910WA @3491, CN 414303. `dropUnchosenAlternatives` now **moves** the chosen
member to the group's earliest configured slot:

| the part uses | result |
|---|---|
| exactly one member | it moves to the group's first slot; the rest are cleared |
| none | the first slot keeps its name, the rest are cleared |
| **both** (the plan fitted both) | **left alone**, each at its own slot — the plan overrules the statistic |

> **Group membership comes from `famBySlot` (what the WHITELIST reserves each slot for), not
> from the payload.** Deriving it from what landed in the slot missed exactly the reported
> case: 414303's chosen pallet is a T-Select ` *` fill, so by payload it looked like it had no
> group and nothing collapsed. The call site builds `famBySlot` from `mtRows`.

Measured over the 249-sheet sweep together with the trim below: **21 sheets changed, 0 lost a
Tool No and 0 gained one** — every change is a position or a name.

### The guard floor and the alternative floor must be the same number

`20260827_` added every family the plan uses at a process (guard against the whitelist hiding
a planned tool) with a floor of **1 C/N**. Too low: a configured family with no Tool No still
prints its NAME, and `alternativeFamilies` needs `MIN_ALT_CNS` (5) C/Ns on both families
before it will call a pair alternatives — so **a family below 5 was outside the only rule that
could ever suppress its row**. It printed for ever.

Reported as `HIGH PALLET BASE ASSY` (`4918-10`, **2 C/N**, 0.9 % of MD-V9910WA @3491) sitting
on the other 99 % of that process's sheets. `20260827c_` removes the **26** such families;
the cost is 43 C/N (1–4 each) losing a planned tool, against a permanent name row on
thousands of sheets — the same trade `20260827_` already made for 4858-04 at 2071 (0.8 %,
left out) versus 2021 (41 %, added).

> Two thresholds that have to agree should be one number. If `MIN_ALT_CNS` ever moves, the
> guard floor moves with it.

### Inspection tooling is filed under its OWN registry code, and the whitelist hid it (2026-08-27)

TEMPLATE_B lists **9901-09 CONCENTRICITY MEASURING PIN as the FIRST tool of every X-100
block** — sheets JWAVE, SPH(DT), SPH(D→T), SPH(D→DT), SPH 中型, at both 2031 and 2071, ahead
of `4857-01 ARBOR`. `sds_machine_tool` had it on **`測定用治具全般` only**, because the
code↔family rule resolves 9901 → registry code 901 → that machine. Every 99xx family in the
workbook was filed the same way.

That is not a missing row, it is a **suppression** — the whitelist filters the part's own
process plan, so X-100's incomplete list discarded a tool the plan had placed:

```
603 C/N plan a 9901-09 AND X-100 tooling at 2071   → pin dropped from every sheet
320 C/N ditto at 2031                              → pin dropped
```

Verified on `A41-00082` / `A41-00222` / `A41-00224` before the fix: plan carries
`9901-09-000x`, rendered sheet showed only the 4857 rows. Same failure class as the
KN-312A/4837 whitelist (`20260826d_`). `20260827d_` inserts it as **T1** and shifts
`4857-01..-08` to T2..T7, per the workbook's own order.

- **`測定用治具全般`'s own 9901 rows stay.** That is a real standalone inspection-jig sheet,
  not a mis-file to clean up. The pin is now on both, which is correct — it is used on X-100
  and it is also a jig in its own right.
- **The other three cases are blocked on naming, not on this.** TEMPLATE_B also puts 9901-09
  in TUGAMI's block @2071 and 9901-21 in RA-10's @1081/@1241; neither name exists in
  `sds_machine_type_code`, so neither has a whitelist and neither is suppressing anything.
- **`UNIQUE (tool_number, process_code, machine_type)` means a slot shift runs highest-first.**

> **Look up a 99xx family through the index workbook's 工程 column, not through a machine
> folder.** Inspection tooling appears in no machine's own workbook — which is how 9901-09
> stayed invisible for three passes over the 組切削 sheets (see `.claude/rules/tooling-select.md`).
> The same blind spot put it on the wrong machine here.

### A machine's whitelist can admit T-Select tooling filed under another machine

Adding the slot was necessary and not sufficient. `tselectFallback.tselectToolsForMachine`
gated on `acceptableNames = {machine_type_name, machineGroup}`, and T-Select returns the pin
under `測定用治具全般` — so on a C/N whose own plan has nothing at that process (414303 plans
no 2071 tooling at all), X-100's T01 printed the NAME with no Tool No.

`opts.acceptFamilies` is the narrow widening: a result filed under a **different** machine is
admitted when its DWG family is in **this** machine's `sds_machine_tool` whitelist. The
whitelist is the sheet's own statement of what belongs on it, so nothing unrelated can enter;
the call site builds the set from `mtRows`.

- **An empty family is rejected inside the function**, not left to the caller — a Tool No that
  is not a DWG number (`MISC-PART`) would otherwise match a whitelist containing `''` and
  admit every foreign tool. A unit test caught this; the code comment claiming it "can never
  happen" was the whole defence.
- Measured over the 249-sheet sweep: **1 sheet gained a Tool No, 0 lost, 0 otherwise changed.**
  Omitting the option is inert — the machine-name gate alone still applies.

### Excel spills over EMPTY neighbours only, and the renderer forgot the second half

`buildGridPdfHtml` set `overflow:visible` on every non-wrapping cell, commented "let injected
text overflow over empty neighbours (Excel behaviour)". Excel stops at the first **occupied**
cell; `overflow:visible` never stops. So a long value ran the length of the row — reported
from the floor as X-100 T01 `CONCENTRICITY MEASURING PIN(FOR SPH)` printing on top of the
`T02` badge and `ARBOR` beside it.

The td stays `overflow:visible` so a value that fits the empty neighbours still spills into
them exactly as before; the content is now wrapped in an inline-block whose `max-width` is the
room Excel would give it — its own (merged) width plus every **consecutive** empty neighbour
in the direction its alignment sends it — with `text-overflow:ellipsis` so a cut reads as a cut.

Three things that decide "occupied", each pinned by `tests/mtc/sdsGridOverflow.test.js`:

| | |
|---|---|
| an image cell | occupied |
| a cell **covered by a merge** | occupied — it holds no data of its own but is not free space |
| a whitespace-only value | **empty**, as in Excel |

A merged cell measures its spill from its **last** column; right-aligned text spills left,
centered spills both ways. On the X-100 sheet the T01 name now caps at 23.8 mm — exactly one
slot — instead of running over T02.
