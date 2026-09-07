# Goal: Tooling Select = TEMPLATE_B + 20260202 Index (retire the Excel workflow)

**Owner's goal (stated 2026-08-29):** an engineer enters a C/N and the system returns the
machine(s), tooling, and the exact drawing with the same fidelity as working
`TEMPLATE_B.xlsx` and `20260202_Tooling_Excel_List.xlsm` by hand — so those files stop being
the operational tool and become the reference the system is validated against.

Both files are vendored in `api/engineer/mtc/doc/`. Neither is *executed* — the live config
in `eng_system` was hand-transcribed from them and from the per-machine workbooks they point
at. This roadmap tracks the distance to parity.

---

## What each source encodes

| file | role | in the system as |
|---|---|---|
| **TEMPLATE_B.xlsx** | the coverage matrix: process code → machine → tooling family → drawing family, plus the grey/white fill = *selected / not selected for this part family* | `templateBConformance.js` + the TEMPLATE-B Conformance page |
| **20260202_Tooling_Excel_List.xlsm** | the index: every per-machine tooling list, with a 工程 column and col K `治具選定` = in-scope flag; points at the per-machine workbooks (`DesignStandards_Dimensions_InventoryData\` on G:) whose `加工対象物寸法記入欄` calc block *is* the selection rule | `selectionConditionConformance.js` + the Selection-Condition Conformance page |
| **per-machine workbooks (~30, G: only, NOT vendored)** | the actual formulas / limits / dimension tables | `tooling_formula`, `tooling_machine_limit`, `tooling_search_rule`, `tooling_<machine>` — transcribed by hand, round by round |
| **RE33xxx PDFs (13 vendored)** | work-size limits + TYPE branch conditions | `tooling_machine_limit`, `condition_expr` |

---

## Status — 2026-08-29 (after round 7)

### Layer 1 · Coverage (the map) — ~92–95 %

- **TEMPLATE_B conformance:** `pctFull 92 %` (99/108 process×machine×tooling pairs) ·
  `familyCovered 95 %` (260/274) · `unexplainedGaps 0` · 9 `none`
- **Selection-Condition (index `治具選定=1`):** `pctSelectable 88 %` (was 65 % before round 7) ·
  rule 18 · lookup 5 · none 1 · na 2 · `unexplained 0`. The last `none` is **4029 KS-450C**
  (plan C/Ns are `C99-*` prototype dummies — blocked until real C/Ns enter `tooling_spec_process`).
- 36 machines enabled, ~285 search rules, ~585 formula rows

### Layer 2 · Selection accuracy (right drawing) — ~71 / 80 % — the weak layer

- `eval_tooling_accuracy.js` vs `lpb.eng_r_pi_tool`: **17 rule-families 71 % top-1 / 80 % top-2**;
  all 35 machines ~62 / 76
- ~10 rule-families still 40–70 % top-2 even where the formula matches the workbook —
  ranking / tolerance / shelf issues, not formula errors. Known: KS-400B1 PLUG(A)/(B),
  LNC45 BODY HOLDER, X-100 ARBOR PIN, MSB, KS-400B6 溝研, KN-312 溝研.

### Layer 3 · Rule fidelity (formula = workbook/standard)

- Phase B (17 index families): 15 MATCH · 4907 sentinels-by-design · **4931 KS-400B6 not
  verifiable** (workbook has no calc block)
- Phase C (11 non-index machines): 6 MATCH · LB15 inferred · MSB no block located
- **`tooling_machine_limit`: 20/36 machines** carry a real work-size limit (was 16).

**RE33xxx re-checked against config 2026-08-29** (the 2026-08-14 conformance pass predated
7 of the vendored RE PDFs). Cited limits all match — KS-400B1 (RE33037 D), KS-B80
(RE33041 B), KS-03A/B22RD (RE33038 F), KN-312 (RE33032 B), LNC45 (RE33024 D) — with the
two deliberate KS-B22G deviations (`ID ≤ 19.7` vs std 16, `W ≥ 5` vs std ≥ 14, both
plan-backed and documented). **Gaps found and fixed (`20260829i_`):** X-100 had NO limit
(RE33039 A §7: OD ≤ φ60) · XD-8 none (RE33040 A §7: OD ≤ φ41.275, ballWidth ≤ 32.51) ·
FTL-10(I) none (RE33026 A §7: OD ≤ φ50) · 1MP-H shankDia ≤ φ25 (RE33034 B §7). Verified:
0 planned C/N exceed any of these OD bounds. NOT added — standard behind practice:
X-100 ballWidth ≤ 32.51 (15 planned C/N over), TM330 shankDia ≤ 25 (9 over). Still open:
`4649-03 SHANK HOLDER` (RE33025 B, LB15) not configured; KS-400B1 WORK DRIVER TYPE split
(RE33037 D §8 SD 19.5 vs config SD 13.5 — drawing verified at 73 % top-2, drawing wins).

**RM35xxx (grinding-condition manuals) NOT reconcilable as a config diff.** They are
per-part-size × material lookup matrices (RM35061 F Table 2: conditions per ID size #4–#24
per material); `sds_parameter` is a per-machine *display template* (3,560 default cells /
25 machines), and the per-part values on a real SDS sheet come from the RM matrix by
size+material or a `cn` override — so "in sync" is a per-sheet question, not a config-level
one. Most RM PDFs are scanned images with no text layer (only RM35061 F, rev 2026-03-02,
is born-digital). A proper RM audit needs OCR + a per-CN generated-sheet comparison — its
own workstream.

### Layer 4 · Part & dimension data

- `tooling_spec_process` 16,635 rows — all numeric C/N (bearing + SPH). Body dims partly
  synced (KN-113A fixed round 7).
- **Assembly-side processes** (STAKING, RELEASE, INSTALL LUB FITTING, CHECK CLEARANCE, HAND
  FEEL INSPECT) work on assembled rod-ends whose C/Ns are alphanumeric (`00M950`) — **not in
  the system at all.** Structural data-model decision.
- The 5 round-7 tables (`tooling_qtn200/tm330/1mph/dtsis/nsv1555fe`) carry **NULL dims** —
  cn-map covers mapped C/Ns; ~170 ambiguous C/Ns + closest-match wait on the workbooks.

### Layer 5 · SDS config (process code + machine visibility) — checked 2026-08-29

Cross-checked `sds_machine_type_code` (`is_active`) + `sds_machine_tool` (process/tool
whitelist) against TEMPLATE_B and the index:

- **Process codes — 92 % (`templateBConformance`: 99/108 pairs, 0 unexplained).**
  The **9 `none`** all share one root cause: the machine that runs the process has **no name
  in `sds_machine_type_code`** — codes `001` / `571` / `577` / `656` / `713` are `null` or
  `'no data'` and `is_active=false`, so no `sds_machine_tool` config can attach.
  | process | tooling family | machine code | C/N |
  |---|---|---|---|
  | **2401 SWAGE** | SWAGE DIE / DIE PIN / GUIDE PIN 4571 | 571 = `no data` (→ a CPRS press) | **~4,485** |
  | 2201 / 3002 / 3041 INSTALL SPH / LUB | SPH INSERT JIG 4577 | 577 = `no data` | ~235 |
  | 1081 SUPER FINISH | CHUCK JAW / QUILL 4656 | 656 = `no data` | 38 |
  | 2411 / 2412 RELEASE | WORK HOLDER 9713 | 713 = `null` | 63 |
  | 0331 DRILL INSPECT HOLE | BASE PLATE 4001 | 001 = `null` | 138 |
  | 3491 OD GRIND | (blank) | — | 0 |
  The **70 `extra`** (SDS has config, TEMPLATE_B doesn't list) are almost all legitimate —
  grind-condition codes the tooling sheets never enumerate (1041/1042/1101/1102/1061/1161/…),
  floor machines outside TEMPLATE_B's tooling scope (CPRS-*, PHK3FLS, MC-*, GI-20N, …), plus
  3 from the round-7 onboarding (`QTN200 0011`, `TM330 0321`, `THREAD ROLL 1841`).

- **Machine visibility — 100 %.** All 26 index (`治具選定=1`) families resolve to an
  `is_active` SDS machine; all 36 Tooling Select machines are `is_active` **and** carry
  `sds_machine_tool` rows. No real family resolves to an inactive machine — the only inactive
  ones are the 5 unnamed codes above, and they are inactive *because* unnamed.

- **Action:** name codes `001, 571, 577, 656, 713` in SDS → Machine Types (SWAGE / 571 →
  the CPRS swage press is the priority — 4,485 C/N), then wire `sds_machine_tool` for the 9
  `none` processes. This is also gap #3 below, seen from the SDS side.

---

## Gap list to 100 % — ranked by impact

| # | Gap | Unblocks | Effort | Blocked on |
|---|---|---|---|---|
| 1 | **Vendor + transcribe the ~30 per-machine workbooks from G:** | fill NULL dims · verify & fix the ~10 low-scoring families · resolve 4931 / MSB `4547-01-0031` / LB15 · resolve the ~170 ambiguous cn-map C/Ns | high — the main body of work | **the files** (G: / Japan `U:\製造技術\yamamoto\…`) |
| 2 | **Per-family accuracy pass** — measure `planned − computed` and fix rule/tolerance/shelf for the ~10 families < 70 % top-2 | 80 % → ~90 %+ top-2 | medium — tooling exists (`eval_tooling_accuracy.js`, `measure_offsets.js`, `score_machine.js`) | nothing — can start now |
| 3 | **Onboard the remaining machines** — 9 TEMPLATE_B `none` pairs + 4800 BONDING | `pctFull` 92 → 100 % | medium | machine-type names in the registry + workbooks |
| 4 | **Add `tooling_machine_limit` for the other 19 machines** from RE33xxx | stop offering a machine for out-of-range parts | low–medium | the RE33xxx PDFs for those machines |
| 5 | **Assembly-side data model** — load rod-end assembly C/Ns into the spec universe | covers the ❌ process group (STAKING etc.) | high | an architecture decision + a factory data source |
| 6 | **File → system sync / drift check** — config is hand-derived; a revised source file raises no flag. Conformance pages catch *coverage* drift, not *rule* drift | keeps parity as the files move | medium | design |
| 7 | **4029 KS-450C** — plan C/Ns are `C99-*` 試作 dummies | last Selection-Condition `none` | small | real C/Ns entering the spec table |

**Bottleneck:** items 1, 3, 4 all wait on the same thing — **the per-machine workbooks and
RE33xxx PDFs that live only on G: / the Japan share.** With those in the repo, the rest is
transcription + tuning with tools that already exist.

### Gap #1 progress — 8 workbooks extracted from G: (2026-08-29)

`dump_tooling_calc_blocks.ps1` vendored the calc-block sheets (PDF + TSV + `source.xlsx`)
for the 8 that were missing, into `tooling_calc_blocks/`:

| family | machine | what the workbook holds | next step |
|---|---|---|---|
| **4691** | DTS-IS | `MASTER` = authoritative **C/N → full tooling-set** table (219 rows) · `COLEET_組合せ検索` = COLLET `4691-19` **OD-range rule** (`OD MIN/MAX/W → drawing`, `+0` pattern) + which `4691-18` body / `4691-02` stopper pairs · `STOPPER` = `4691-02` by 外径/巾/内径 | **implement a real rule** (not just cn-map) + load dims + replace the plan cn-map with MASTER |
| **4863** | NSV-1555FE | `寸法算出` / `寸法算出(2)` = model-keyed calc: Vブロック `4863-01` by shank-dia + 貫通穴 flag, センタピン `4863-02` by ID band; full computed dims A–R / K–R | transcribe the two rules; 貫通穴 flag not in spec — needs a proxy |
| **4516** | 1MP-H | `Sheet2` = `図番 → 型式` (P/N-pattern) list, **no dimensions** — a model lookup, like a partno_map | keep the cn-map; optionally key a partno_map on the model patterns |
| **4800-bond** | BONDING (`その他`) | `DIMENSION` (547 rows) keyed on `a スリーブ外径(MAX)` / `b フランジ外径` / `c ストレート長` — a real dimensional rule for BONDING PLATE + GUIDE RING | onboard first (still `none`), then implement |
| **4007** | QTN200 | `BODY COLLET` calc-block PIC present; `DIMENSION` sheet is `(工事中)` — empty | cn-map stands; no dims to load |
| **4009** | TM330 | calc blocks in `01 BH下部` etc.; `DIMENSION` sheet is `作成予定 / NO USE` | cn-map stands; no dims to load |
| **4029** | KS-450C | full calc blocks (BLADE, CARRIER, LIFTER, GUIDE TUBE…) + `DIMENSION` (58 rows) | **vendored for reference only** — plan C/Ns are `C99-*` dummies, nothing to select against |
| **4547** | PSG-64 | `MSB_SURFACE-GRINDING_TOOLING(20150213yamamoto)` is a **2-sheet stub** (32×24 / 29×5). The `4547-01-0031` jig-assembly set is **not in this workbook and not elsewhere in the folder** | the 0031 gap is confirmed unrecoverable from G: — needs Japan or a shop measurement |

Still not extracted: the ~20 other Phase-B/C workbooks were done in the prior session; the
DIMENSION-sheet data from *all* of them is dumped to TSV but **not loaded into the inventory
`dim_a..dim_f`** — that load is gap #2's first task.

---

---

## Layer 6 — Japanese → English in the UI, and SDS config re-check (2026-08-29)

### Display labels anglicized

`20260829j_anglicize_display_labels.js` + `20260829k_nsv1555fe_label.js` (applied, idempotent,
`--revert`): 14 rows across `tooling_machine.label` (9) and `tooling_search_rule.label` (5).
Examples — `その他 (4800 BONDING / 接着)` → `Other — misc bucket (4800 BONDING / adhesive)`,
`測定用治具全般 (検査 · 9901 series)` → `Measuring jigs — general (inspection · 9901 series)`,
`TM330 (BBS KINMEI 巾切削)` → `TM330 (BBS KINMEI · width cutting)`, `巾(大)` → `width (max)`,
`STOPPER 外径 nearest` → `STOPPER OD (outer dia) nearest`.

**Japanese join keys kept, English alias added via `machine_group`** — the sanctioned
mechanism (`.claude/rules/sds-pipeline.md`):
- `20260829m_` — the 3 Tooling-Select machines: `測定用治具全般` → "Measuring Jig (general)",
  `TP-SW-03他` → "TP-SW-03 series", `その他` → "Other (misc)".
- `20260829o_` — the other **19** Japanese-named `sds_machine_type_code` rows (バグマスター →
  "Bug Master (deburring)", 超仕上げ機 → "Superfinishing machine", フラクチャー組立機 →
  "Fracture-split assembly machine", 試作用ダミー番号 → "Prototype dummy number", …). These
  appear in the SDS admin Machine Types / Configure Settings lists.

Every Japanese machine name in the SDS registry now displays English in the UI. The
`machine_type_name` / `machine_name` join keys are untouched (renaming the registry once
destroyed 1,299 `sds_parameter` rows). Safe: 0 `sds_approval` / 0 `sds_parameter` rows for
any aliased code; conformance keys on `machine_type_name`, not group → KPI unaffected.

**Still Japanese, and correctly so:** `tooling_formula.description` (26 rows) — source
citations that quote the origin workbook's sheet names and cell formulas
(`A ピン外径 = ROUNDDOWN(ID - 0.01, 2)`). These are the audit trail the tooling-select rules
doc requires; they are not names.
- `tooling_formula.description` (26 rows) — provenance notes that quote the source workbook
  sheet names and cell formulas (`A ピン外径 = ROUNDDOWN(ID - 0.01, 2)`). These are the audit
  trail the tooling-select rules doc requires; translating them breaks traceability. Not names.

### SDS Configure Settings — re-verified, still `unexplainedGaps = 0`

`templateBConformance.build()`: `pairsInTemplateB 108 · full 99 · none 9 · pctFull 92% ·
unexplainedGaps 0`. Visible-machine coverage per the `20260202` index (`治具選定=1`) is 100%
(all 24 families → an `is_active` registry row). The 9 `none` pairs all carry one reason —
the registry entry has no name — and map to **5 unnamed `sds_machine_type_code` codes**:

| code | process(es) | missing families | C/N | name in a cited source |
|---|---|---|---|---|
| **571** | 2401 SWAGE | 4571-01/-02/-03 | **13,207** | `20260202` index `machine` col = `SWAGE` (process name); TEMPLATE_B `mach` blank → **process-named only, do not use** (see `20260815d_` precedent) |
| 577 | 2201/3002/3041 INSTALL SPH / ASSEMBLY / LUB FITTING | 4577-01/-04/-20/-21 | ~246 | index lists **4 different** machines (`MECHA PARTS` / `ASRD` / `HAND PRESS` / `TKR`) → ambiguous |
| 001 | 0331 DRILL INSPECT HOLE | 4001-01 | 138 | `20260202` index `machine` col = **`HX400iα`** (real Mazak HMC model) — source-backed |
| 656 | 1081 SUPER FINISH | 4656-06/-10 | 38 | TEMPLATE_B `mach` col = **`TECH ONE`** — source-backed |
| 713 | 2411/2412 RELEASE | 9713-10 | 63 | not in either source |

**Why a name alone is not enough:** naming a code in `sds_machine_type_code` **without**
also adding its `sds_machine_tool` whitelist rows flips that pair's conformance reason from
"registry not named" to blank → `unexplainedGaps` 0 → 2+, i.e. it *regresses* the KPI. A
pair is closed only by name + activate + whitelist (families = TEMPLATE_B ∪ the machine's
own planned families) + a render check.

- **`656` → `TECH ONE`: APPLIED (`20260829l_`, owner-confirmed).** T1 4656-06 CHUCK JAW,
  T2 4656-10 QUILL, process 1081 — both families plan only at 1081 (34 / 4 C/N).
  `TECH ONE / 1081` → `full`.
- **`001` → `HX400iα`: APPLIED (`20260829n_`, owner-confirmed).** T1 4001-01, process 0331 —
  the only family the plan uses there (138 C/N). The 12 distinct 4001-01 drawings a C/N may
  carry all pass the family filter, so no planned tool is hidden. `HX400iα / 0331` → `full`.
  (Naming 001 also surfaced `HX400iα / 3491` missing `0001-99` — 0 plan C/N, reason NO_PLAN,
  a phantom family, nothing to configure.)
- **`571` / `577` / `713`: owner input required** — `571` (SWAGE, 13,207 C/N) both sources
  give only "SWAGE" (the process name); `577` (~250 C/N) the index lists 4 different
  machines; `713` (9713-10, 63 C/N) appears in neither source.

**Result: `none` 9 → 7, `full` 99 → 101, `pctFull` 92% → 94%, `unexplainedGaps` still 0.**

### KS-450C ROLLER PIN — cannot onboard (2026-08-29)

Asked whether the centreless KS-450C could be onboarded from `20160324_TOOLING
LIST_KS-450C_ROLLER PIN`. Two independent blockers:

1. **No real parts.** `lpb.eng_r_pi_tool` has 346 rows / 39 C/N for family 4029 (KS-450C) —
   **`real_cns = 0`**: every one is a `C99-*` prototype dummy, none in `tooling_spec_process`.
   A T-Select machine with zero real C/Ns to serve is dead config. (This is the standing
   blocker the roadmap already recorded for 4029.)
2. **The workbook is not vendored.** `tooling_calc_blocks/4029/` holds only the generic
   KS-450C workbook (BLADE / CARRIER / GUIDE TUBE / LIFTER / SEPARATE …), no ROLLER PIN
   sheet. The `20160324_…_ROLLER PIN` list is on `G:` only.

"ROLLER PIN" in the factory data is `9901-14 ROLLER PIN SORTING JIG` — an **inspection
sorting jig** under `測定用治具全般` (code 901), used at sorting/inspection processes
(8011/8012/3101…) on 60+ real C/Ns — a different family on a different machine, not KS-450C
grinder tooling. If that is what should be added, it is a new family under an existing
machine and needs its selection rule (the 9901-14 workbook).

---

## What is needed from the owner to finish

1. **The ~30 per-machine workbooks** under
   `G:\Shared drives\RD Development Technology Review Request\Tooling Select\DesignStandards_Dimensions_InventoryData\`
   — copied into the repo (`api/engineer/mtc/doc/workbooks/` or similar), or a confirmation
   that I may read them directly off G: in this session and vendor the calc-block PDFs.
   Priority order = the low-scoring families in gap #2 + the NULL-dim tables from round 7 +
   4931 / MSB.
2. **The remaining RE33xxx design-standard PDFs** for the 19 machines with no limits, and for
   the 9 TEMPLATE_B `none` machines.
3. **A decision on the assembly side (gap #5):** do rod-end assembly C/Ns belong in
   `tooling_spec_process`? If yes, where do their dimensions come from.
4. **Machine-type names** for the 5 unnamed `sds_machine_type_code` codes behind the 9
   TEMPLATE_B `none` rows (see Layer 6 table). Two have a source-backed candidate ready —
   `001` → `HX400iα`, `656` → `TECH ONE` — and need only a yes/no + a render-check of the
   whitelist. `571` (SWAGE, 13,207 C/N) and `577` (ambiguous) and `713` (no source) need the
   real machine model from the floor.
5. **Confirmation on 4800 BONDING** — is the bonding jig chosen by a dimensional rule, or is
   it a fixed/manual fixture? (decides whether it can be onboarded like the other 5).
6. **Ongoing:** keep pointing at the columns / notes the way you did for the NOTE column and
   the 荒径 meaning — one correct hint per workbook has unpicked each of these.
