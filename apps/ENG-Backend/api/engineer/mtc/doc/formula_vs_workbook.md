# Formula vs workbook — direct line-by-line check

The third layer of the Tooling-Select correctness check, complementing:
1. **existence** — `selectionConditionConformance.js` / the Selection-Condition Conformance page
2. **accuracy vs the factory plan** — `scripts/eval_tooling_accuracy.js` (top-1/top-2 vs `lpb.eng_r_pi_tool`)
3. **this** — does `tooling_formula` say the same thing as the per-machine workbook's `加工対象物寸法記入欄` calc block

## Method

- **extract** (`scripts/dump_tooling_calc_blocks.ps1`, Excel COM) — per family, dump every sheet's cell text
  (`.tsv`) and export a fit-to-width **PDF of every sheet that carries a pasted-picture formula** (the calc
  block is an image, not cells, on most of these workbooks) into `api/engineer/mtc/doc/tooling_calc_blocks/<family>/`.
  Manifest: `api/engineer/mtc/doc/tooling_calc_blocks/manifest.json`.
- **diff** — read each PDF, transcribe the calc block, pull the live `tooling_formula` + `tooling_search_rule`,
  write the diff into `api/engineer/mtc/doc/tooling_calc_blocks/<family>.md`. For every disputed variable, score the candidate
  `tooling_spec_process` column against the workbook's own C/N list (the `DIMENSION` sheet) before calling it.
  Verdict per (machine, tooling): `match` / `config-wrong` / `workbook-wrong` (plan wins) / `equivalent`
  (different form, same value).

## Scope split (decided 2026-08-28)

30 machines carry live `tooling_formula` rows. Only 26 rows are flagged `治具選定=1` in
`20260202_Tooling_Excel_List.xlsm` (dated 2026-02-02); of those, 17 resolve to a machine with formulas.

- **Phase B = the 17 index-flagged families.** Extraction done; **diff 17/17 done** (2026-08-28).
- **Phase C = the ~11 formula-configured machines the index does NOT flag** — mostly onboarded to
  Tooling Select in the 2026-08-14+ audit rounds, after the index workbook was last stamped. Needs its
  own extraction pass (their workbooks are on `G:\...\DesignStandards_Dimensions_InventoryData\`).

## Phase B — the 17 (index `治具選定=1`)

| family | machine | extracted | diff | verdict summary |
|---|---|:--:|:--:|---|
| 4021 | KS-B80 | ✅ | ✅ | JAW/BACK PLATE/WHEEL **MATCH**; QUILL/QUILL BOLT cn-mapped by design; W≥14 soft note → `4021.md` |
| 4027 | KS-B22G | ✅ | ✅ | **formulas MATCH**; W≥5 and ID 4–19.7 limits diverge on purpose (plan evidence) → `4027.md` |
| 4030 | KL-20 | ✅ | ✅ | 4030-02 `ID+0.15` **exact**; 4030-01 grips OD; routing is a cnPrefix heuristic ≠ workbook RACE/SLEEVE (cn-map hides it) → `4030.md` |
| 4033 | KS-500RD | ✅ | ✅ | WORK DRIVER exact; PINTLE ≈ (G=9 vs 10, A/B rounding); FRONT SHOE→`対応表`; limits no source → `4033.md` |
| 4556 | TSG-300W CARRIER | ✅ | ✅ | **MATCH** — A/B/C reproduce `設計基準` (C = A−2 ⟺ (400+A−B)/2); W MIN 6.0 not encoded (audit A-2) → `4556.md` |
| 4559 | KS-03A | ✅ | ◑ | CPX SHOE **exact MATCH** (13/13, one E-band to confirm); limits sourced; other 9 toolings carry sheet-quoted descriptions from the audit, not re-diffed → `4559.md` |
| 4651 | LNC45/C200 | ✅ | ✅ | A/C **exact MATCH** to the 薄型 sheet; B/D/E omitted by design (no CD/FL in spec); limit RE33024 D → `4651.md` |
| 4664 | KS-400B1 | ✅ | ✅ | WORK DRIVER + SUPPORT BLOCK **EXACT MATCH** (spot-verified); limits match RE33037 D + workbook box; STOCKER CHUTE via audit; PLUG A/B cn-mapped → `4664.md` |
| 4800 | THREAD ROLL | ✅ | ✅ | **MATCH** — die keyed on (threadDia, threadTPI) exact-match = workbook ネジサイズ column; width/hand free by design → `4800.md` |
| 4857 | X-100 | ✅ | ✅ | **MATCH** — ARBOR spot-verified exact (A/B/C/D); all rows are sheet-quote + plan-measured (2026-08-15 audit) → 4857.md |
| 4858 | XD-8 | ✅ | ✅ | **MATCH** — COLLET OD@MAX, JAW range-table; STOPPER L/R + WRIST END ASSY cn-mapped by design → 4857.md |
| 4866 | TSG-300W CHUTE COVER | ✅ (shared 4556) | ✅ | A/B/D **MATCH**; **C = ceil(B+5) integer vs workbook next-5mm bucket** — but C unused in search, no impact → `4866.md` |
| 4879 | J-WAVE | ✅ | ✅ | **MATCH** — ~20 outputs each a sheet-quote + plan agreement (2026-08-15 audit); rank-only + (-999) SPH gates → 4857.md |
| 4906 | KS-400B5 | ✅ | ✅ | WORK CHUTE **EXACT MATCH** (A=Z+0.1, B=W+0.1, C=Z/2+27.55, D step); audit E-1 closed 10/10 → 4906.md |
| 4907 | KS-H70 | ✅ | ✅ | sentinels **by design** — 4907 runs on parts_no-map, **100 % of planned C/N pinned** (59/59, 57/57, 164/164, 162/162); band formula = negative value. NOT a defect → `4907.md` |
| 4918 | MD-V9910WA | ✅ | ✅ | **MATCH** — `wAft_max + 0.2` = workbook "ワーク最大巾 + GAP (0.05–0.35)" mid-band → `4918.md` |
| 4931 | KS-400B6 | ✅ | 🔴 | **NOT VERIFIABLE** — workbook has no calc block (計算式追加予定); 8 formulas are unvalidated ports from KS-400B1, STOCKER CHUTE scored 17 %; 溝研 side unencoded → `4931.md` |

Extraction: **17/17 families, ~90 sheet PDFs** of pasted-picture calc blocks under `api/engineer/mtc/doc/tooling_calc_blocks/`.

### Phase B result (2026-08-28)

| bucket | families | note |
|---|---|---|
| **MATCH** (formula = workbook) | 4021, 4027, 4030*, 4033*, 4556, 4559, 4651, 4664, 4800, 4857, 4858, 4866*, 4879, 4906, 4918 | 15/17. `*` = a minor sub-point below |
| **sentinels BY DESIGN** (runs on a map, formula intentionally off) | **4907** KS-H70 | 4 LOADER families, all `-999` sentinels — `tooling_partno_map` (parts_no) pins **100 % of planned C/N** (59/59, 57/57, 164/164, 162/162). Checked 2026-08-28. Not a defect. |
| **NOT VERIFIABLE** (workbook has no calc block) | **4931** KS-400B6 | filename says 「計算式追加予定」; formulas are unvalidated ports (STOCKER CHUTE 17 % top-2); 溝研 side unencoded — the one genuine gap |

**Minor sub-points inside the MATCH bucket — all low/zero impact:**
- **4033** KS-500RD LOADING PINTLE: `G` = `9` where the current workbook design is `10`; `A`/`B` use
  integer `round()` where the workbook rounds to 1 dp. `G` and `A`/`B` are rank-only or within tolerance.
- **4866** CHUTE COVER: `C = ceil(B + 5)` (next integer) where the workbook buckets to the next 5 mm.
  `C` is **not** a search dimension → no sheet is affected today; fix only if `C` is ever wired into ranking.
- **4030** KL-20: the collet-routing rule is a `cnPrefix` heuristic that approximates — not equals — the
  workbook's RACE→OD-grip / SLEEVE→ID-grip split; hidden by a 1,361-row cn-map (eval 100 % top-1).
- **4559** KS-03A: CPX SHOE spot-verified exact (13/13); a possible `E`-band label swap for OD ≤ 15 to
  confirm against the source Excel. The other 9 toolings carry sheet-quoted descriptions from the audit,
  not re-diffed line-by-line.
- **4021** W ≥ 14, **4027** W ≥ 5 / ID 4–19.7, **4556** W MIN 6.0 — **machine-limit** divergences from the
  workbook/standard, each recorded and (where acted on) backed by factory-plan evidence.

**Nothing found in Phase B is a wrong tool on a live sheet.** 4907 (KS-H70 LOADER) runs 100 % on the
parts_no map — its sentinels are intentional. The one genuine gap is **4931** (KS-400B6 溝研): no
workbook calc block, ported formulas, and the one measured tooling scored 17 % — needs Japan to fill
in the workbook, or a cn-map for the groove side.

## Phase C — formula machines NOT in the index

**Extracted + diffed 2026-08-28** — full write-up: api/engineer/mtc/doc/tooling_calc_blocks/phase_c.md

| bucket | families | |
|---|---|---|
| MATCH (verified / audit-sourced) | 4036 KVD-300CRII (exact 6/6) · 4564 HAMAI 5B · 4501 FTL · 4816/4853 KN-113A · 4606 TP-SW-03 · 9901 measuring pin | 6 machines |
| MATCH + recorded gap | 4560 OC-16A (COLLAR conditional = unencodable) · 4832 KN-312 (溝研 4832/4837 unencoded, audit H-2/H-3) | |
| THIN — not workbook-verified | 4547 MSB grinders (GS-64PFII/PSG-64/MSG-410) — all "A = ID" only, no calc block located | |
| INFERRED — no calc block | 4649 LB15 — "A = ID − 0.3" is a guess; the 2 samples say "ID − 0.2"; per-P/N list has no formula block | |

Phase C net-new: **KVD-300CRII formulas EXACT MATCH** (audit K-1 only flagged the OD limit range) · **LB15 = weakest config in the set** (guessed, alongside KS-400B6) · **MSB grinders need their workbook block located**.

### Selection-condition fixes from the 2026-08-28 eval (round 7, 2026-08-29)

The eval (top-1/top-2 vs the factory plan) exposed families where the formula matches
the workbook yet the shelf pick was wrong. Root causes and fixes — full write-up in
`tooling_select_audit_findings.md` "รอบที่เจ็ด":

| family | eval was | root cause | fix (`db_migrations/`) | tool-level after |
|---|---|---|---|---|
| **KN-113A** 4853-01/07/14 | 0.6 % t2 | **BODY-class specs all-zero** — `id_aft` never synced from `eng_body.final_id`; `A = OD` → 0 | `20260829_kn113a_body_bore.js` — `id_aft = final_id` on 1 065 body C/N + `A → roundN(ID+0.8,1)` | **58 / 86.4** |
| **KS-400B1** WORK DRIVER | 20 / 22 | rule `tol_minus 0` floored out the lower half (shelf sits ~0.5 below calc) | `20260829c_…` — `tol_minus 1.0` + rank-only C/D | **42 / 73** |
| **KS-400B1** PLUG(A)/(B) | 17–31 | ceiling/negative-tol rules + a weak dim wired as a hard filter | `20260829c_…` — symmetric ±0.3/±0.4, drop the B filter | A **23/36** · B **35/48** |
| **X-100** CENTER | 46 / 69 | secondary C hard-filtered out good primary (A) matches | `20260829b_…` — C → rank-only | **56 / 79** |
| **X-100** WRIST END | 40 / 65 | tol ±0.5 vs a measured −1.5 p10 tail | `20260829b_…` — tol `+0.6/−1.6` | 33 / 67 (flat) |

Not touched (diagnosed, no safe fix without source): **X-100 ARBOR PIN** — A is 99 % exact,
shelf out-resolves the part data (no context var predicts dim_b > 43 %). **THREAD ROLL** —
die lookup is 542/543 exact; the 61.5 % is DWG-family-width alignment noise, not a defect.

**MSB grinders** (`20260829d_msb_cnmap.js`) — partial: `seedCnMapFromPlan` pinned 303
cn-map rows (5 roles × 3 machines) for the drawings the shelf already stocks, lifting the
reachable-C/N hit rate ~40 % → ~60-67 % on COLLAR / COLLET / COLLET ARBOR. The dominant
`4547-01-0031-xx` jig-assembly set stays a gap — off-shelf, absent from
`lpb.eng_tooling_size`, and each C/N uses a bespoke sub-part subset, so it cannot be
reconstructed without the Okamoto PSG-64 workbook.

Workbooks (found under `G:\...\DesignStandards_Dimensions_InventoryData\`:

| machine | family | folder hint |
|---|---|---|
| FTL-10(I) | 4501 | `組切削_FTLコレットチャック` |
| GS-64PFII / PSG-64 / MSG-410 | 4547 | `研磨_平研_4547-XX_岡本PSG-64` |
| HAMAI 5B | 4564 | `研磨_巾研_4564-XX_浜井巾ラップ盤5B` |
| KN-113A | 4816 / 4853 | `研磨_内研_4816-XX_KN-113A用冶具` · `研磨_内研_4853-XX_和泉用治具` |
| KN-312A | 4837 | `研磨_溝研_4828・4832-XX_KN-312B` (check) |
| KN-312B | 4832 / 4828 | `研磨_溝研_4828・4832-XX_KN-312Bシューセンタレス` |
| OC-16A | 4560 | `センタレス_外研_4560-XX_押し棒・セットピン・カラー` |
| KVD-300CRII | 4036 | `研磨_巾研_4036-XX_KVD300CR2` |
| LB15 | 4649 | `切削_投入_球削アーバー(4649-05)` |
| TP-SW-03他 | 4606 | (to locate) |
| 測定用治具全般 | 9901 | look up via the index workbook's 工程 column, not a machine folder |

> KS-B22RD reuses KS-03A's formulas (`tooling_ks03a`, 4559) — covered by Phase B.
