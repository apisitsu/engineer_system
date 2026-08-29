# Phase C — formula vs workbook for the machines NOT in the index

The ~13 machines that carry live `tooling_formula` rows but are **not** flagged `治具選定=1` in
`20260202_Tooling_Excel_List.xlsm` (the index predates their onboarding — most joined Tooling Select in
the 2026-08-14+ audit rounds).

**Extracted 2026-08-28** (`scripts/dump_tooling_calc_blocks.ps1`) — 11 workbooks, PDFs/TSVs under
`api/engineer/mtc/doc/tooling_calc_blocks/<family>/`. Config formulas dumped to compare against.

---

## Verdicts

| family | machine(s) | verdict | detail |
|---|---|---|---|
| **4036** | KVD-300CRII | ✅ **EXACT MATCH (6/6)** | `CARRIER.pdf` sample (OD 28.168, W 7.161): `A=⌈0.5 OD+0.4=29.0` · `B=281−A=252.0` · `C=A−5=24.0` · `D=⌈0.5 W×0.8=6.0` · `H=R0.5 (A≤40)` · `J=SS400 (D≤12)` — all reproduce the workbook row. E/F/G are `現合` (fit-to-part), correctly not computed. **Audit K-1's open point was the OD *limit* range (`MAX OD Φ25` in TEMPLATE_B vs config `9.5–46`), not the formula.** |
| **4564** | HAMAI 5B | ✅ **MATCH (pattern)** | `寸法表.tsv` 浜井巾ラップ用キャリア: workbook gives ranges `A MIN=OD+0.1 … A MAX=OD+1.0`, `E MIN=W×0.6 … E MAX=W×0.9`. Config `A=⌈0.5 OD+0.5` and `E=⌊0.5 W_min×0.9` target the **MAX end** — same pattern as TSG-300W CARRIER. `D=360/B` = the sheet's `等配角 D` exactly. `B`/`C` are hole-count / PCD geometry (`π·88 / pitch`), structure plausible, not sample-verified. |
| **4501** | FTL-10(I) | ✅ **MATCH (audit-sourced)** | COLLET OP1/OP2, PUSHER OP2 — every `description` quotes the sheet cell (`A7 = RD`, `A7 = OD`, `C7 = ROUND(TB + 1.5, 1)`) with plan agreement, from the 2026-08-15 组切削 audit. PUSHER OP1 on this machine is **cn-mapped** by design (`20260817_` — the sheet's block was measured and rejected: 2% right; the ACCESS DB holds the real design). |
| **4816 / 4853** | KN-113A | ✅ **MATCH (audit-sourced)** | JAW/BACK PLATE/WHEEL/BACKING PLATE/GAUGE — descriptions quote sheet rows (`B24: A = ROUND(ワーク内径MAX + 0.6, 1)`, `B28: A = ROUNDDOWN(ROUND(ID_min×0.75,1),0) + …`). From `20260814h_` / `20260815b_` (和泉 ball inner grind). 8 picture-block PDFs vendored for a full re-diff. |
| **4560** | OC-16A | ◑ **MATCH + one unencodable** | COLLAR/PIN/RACE PUSHER/SET PIN — `A = OD − 0.5` from the RACE PUSHER sheet header (`OD < A ×, A < OD ○`), validated 5 pairs ±0.45 (audit). **COLLAR is a conditional jig** (audit I-2: 10,469 offered vs 58 planned) — the "only when requested" condition **cannot be encoded** (no spec column), a known 🔴. |
| **4832** | KN-312A / KN-312B | ◑ **standard-sourced; 溝研 gap** | ARBOR/NUT keyed on `RE33032 B §8-1/§8-2` (`20260814_conform_…`). Formulas cite the standard, not the workbook. **`4832` (KN-312B groove-grind) and `4837` (KN-312A) are the unencoded gap** (audit H-2/H-3 — ~150 C/N, no rule). Extracted `20220408_4832-XX_TOOLING LIST_IDY` (BACKING PLATE + 装塡/回収 PLUG picture sheets) for when that gap is worked. |
| **4606** | TP-SW-03他 | ✅ **MATCH** | SET STICK `A = W + 0.5` from the `RELEASE-JIG` list header (`SBW + 0.5`); `A`/`B` both = the value, the `+0` containment (`A1 ≤ W+0.5 ≤ A2`). `20260821i_`. |
| **9901** | 測定用治具全般 | ✅ **MATCH (audit-sourced)** | CONCENTRICITY MEASURING PIN — `A = ⌊2 (ID − 0.01)` (pin enters the ball bore), `B/C/D` rank-only, all quoting sheet `9901-09-0XXX_SPH`. `20260815q_` / `20260827d_`. Same shape as X-100 ARBOR. |
| **4547** | GS-64PFII / PSG-64 / MSG-410 | 🟡 **THIN** | All four toolings (COLLAR, COLLET, COLLET ARBOR, WORK FIXED BASE) are just `A = ID`; `COLLET B = isThaiMsb48Collet` (a boolean flag). No calc block extracted from `MSB_SURFACE-GRINDING_TOOLING` (sheet names didn't match). The MSB grinders hold work by bore on a magnetic chuck — `A = ID` may genuinely be the whole rule, but it is **not verified against a workbook block**. |
| **4649** | LB15 | 🔴 **INFERRED — no calc block** | `Sheet1.pdf` (球削アーバー) is a **per-P/N list** — D2/D3/D4/L1/E filled per row from the 適用型式, **no calculation block**. Config `A = ID − 0.3` is **explicitly marked INFERRED** in its own `description`, and the two verifiable samples put `D3` at **`ID − 0.2`**, not −0.3. Treat as unvalidated — a candidate for cn-map, same as KS-400B6 (4931). |

---

## Summary

| bucket | families |
|---|---|
| ✅ MATCH (verified or audit-sourced) | 4036, 4564, 4501, 4816/4853, 4606, 9901 — **6 machines / 7 families** |
| ◑ MATCH with a recorded gap | 4560 (OC-16A COLLAR unencodable), 4832 (KN-312 溝研 gap) |
| 🟡 THIN — not workbook-verified | 4547 (MSB grinders, `A = ID` only) |
| 🔴 INFERRED — no calc block | 4649 (LB15, `ID − 0.3` guessed, samples say −0.2) |

**Phase C net-new findings:**
- **KVD-300CRII** — was "not fully checked" (audit K-1). Now checked: formulas **EXACT MATCH**; the only open item is the OD *limit* range.
- **LB15** — the `A = ID − 0.3` formula is a guess (`−0.2` is closer on the 2 samples) against a workbook that has no calc block. Weakest config in the whole set alongside KS-400B6.
- **MSB grinders (4547)** — `A = ID` unverified; needs the actual MSB workbook block located.
- Everything else lines up with its onboarding audit.
