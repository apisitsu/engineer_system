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

### Conformance to the RE330xx design standards (2026-08-14)

The five machine tooling-design standards in `api/engineer/mtc/doc/` are the authority for
work-size limits and for KN-312's TYPE branch conditions. `db_migrations/20260814_conform_tooling_select_to_re330_standards.js`
brought the config in line and is **idempotent** — re-running reports "already correct".

| Machine | Standard | What it now enforces |
|---|---|---|
| KS-B22G | RE33042 A | ID φ4.8–16, OD ≤38, **W ≥5** (see below — the standard's ≥14 is behind practice) |
| KS-03A / KS-B22RD | RE33038 F | OD ≤33, ID ≤19 (pair), W ≤29 |
| KN-312A / KN-312B | RE33032 B | ID ≥4, OD ≤66.7, W ≤68 · ARBOR/NUT TYPE |
| KS-B80 | RE33041 B | ID ≥7.9, OD ≤70, W ≥14 |
| KS-400B1 | RE33037 D | OD ≤32, W ≤30 |

Four things worth knowing before touching any of it:

- **Tightening a limit removes a machine from parts it was offered for.** KS-B22G went from
  8,255 eligible parts to 1,186 — RE33042 A's `W ≥ 14` alone excludes 11,751 of the population,
  against the `W ≥ 5` that was stored. Every limit row now carries its clause
  (`RE33042 A §7: …`) in `description`, so the next reader can tell a standard's number from a
  local one. **The old state is in `tooling_config_backup_re330_20260814`**; the migration's
  `--revert` restores it in one command.
- **KS-B22G's `W ≥ 14` is the one place the standard lost, and the factory plan is why**
  (settled 2026-08-15, `20260815o_`). The bound went back to `W ≥ 5` at the floor's request
  with the question left open; `lpb.eng_r_pi_tool` answers it. 453 C/Ns plan one of the
  machine's two tooling families (4027-01 / 4027-02); of the 161 that also carry a finished
  width, **97 are between 5 and 14** — 60 % — and **none is below 5**, the narrowest being
  5.97 (`3MHT5V-603`). `W ≥ 5` is the measured floor of what the machine actually runs, not
  a concession pending review. RE33042 A §7 is what needs revising. When a standard and the
  plan disagree, the plan is evidence — go and get it before restoring a bound "temporarily".
- **`ID < 12` on KS-03A and `ID ≥ 12` on KS-B22RD is the routing split, not an outer limit.**
  RE33038 F caps the *pair* at ID ≤ 19; that cap belongs on B22RD, which is where it now is.
- **Two bounds are stricter than their standard and were kept** — KN-312 `ID ≤ 48` and KS-B80
  `OD ≥ 15`. Conforming does not mean loosening a limit somebody added deliberately; both say
  so in their description.
- **KN-312's TYPE read the wrong variable.** ARBOR branched on `SD` where RE33032 B §8-1
  branches on `ID` (35.5% of parts got a different type); NUT branched on `B < 30` where §8-2
  says `(SD−0.5)+8 ≤ 20`, i.e. the `A` the formula already computes (63.4% differed). TYPE feeds
  no search rule — it gates the reported design dimensions `F/G/H/D4/L1/L3` — so this was
  wrong *drawings*, never a wrong tool off the shelf.

**`LOADER` pointed at the family withdrawn in 2015** — fixed by
`db_migrations/20260814b_re330_loader_rename_and_provenance.js`. `tooling_ks03a` held
`LOADER` = 4559-06 and `NYLON LOADER` = 4559-41, which is backwards in every source:
RE33038 F §6-10 names 4559-41 as LOADER, its rev C (2015.03.20) demoted 4559-06 to
reference-only, TEMPLATE_B calls both rows LOADER and marks 4559-06
*「2017/04/03より選定/設計しないこと」*, and **the word NYLON appears in no standard, no
worksheet row and no drawing number**. `LOADER` is now 4559-41 (104 rows); 4559-06
survives as `LOADER (4559-06 REF)` (154 rows) because the worksheet still lists it,
marked do-not-select. The rename covered `tooling_name` *and*
`inventory_tooling_filter` — missing the filter would have returned nothing.

**Provenance is now honest about which machines a standard actually names.** RE33032 B
is written for KN-312**B**; KN-312A's limits say so rather than claiming the standard
covers them. KS-400B5 / KS-400B6 say plainly that RE33037 D's scope is B1–B4 and that
their OD bounds (40 / 35) are local and deliberately exceed it.

### The tooling the standards name and the system cannot select yet

Against the **standards** (not TEMPLATE_B — that distinction matters) the system now covers
17 of the 18 tooling the five standards name. The one gap is **STOCKER CHUTE 4664-34**,
RE33037 D §6-6. QUILL / QUILL BOLT / WHEEL (4021-03/04/05) and the second plug pair
(4664-21/22) appear in TEMPLATE_B and in **no standard**, so their absence is the
standards lagging the worksheet, not the system failing conformance.

**The source data exists and is reachable** — this was wrongly written off twice. The
authoritative lists are on the Google shared drive, mirroring the Japan-side
`U:\製造技術\yamamoto\設計基準・寸法・在庫データ` tree that TEMPLATE_B's LINK LIST points at:

```
G:\Shared drives\RD Development Technology Review Request\Tooling Select\
  20260202_Tooling_Excel_List.xlsm                 ← the index of every list, per machine
  DesignStandards_Dimensions_InventoryData\
    研磨_内研_4021-XX_KS-B80(坂本)\20241223_TOOLING LIST_KS-B80.xlsx    → sheet 砥石・クイル
    研磨_球研_4664-XX_KS-400B1~4(百瀬)\20210628_TOOLING LIST_KS400B(SPHERICAL GRIND).xlsx
                                                                      → sheet STOCKER CHUTE (88 rows)
```

**And the engine can already express their selection.** The quill sheet is a *range
lookup* — `巾min | 巾max | 内径min | 内径max → QUILL | QUILL BOLT | WHEEL` — which looks
like it needs containment matching the search rules do not have. It does not: a one-sided
tolerance emits `col <= computed + tol_plus` or `col >= computed - tol_minus`, so
`tol_plus = 0` against the min column plus `tol_minus = 0` against the max column is
exactly `min <= value <= max`. **KS-03A LOADER already uses that `+0` pattern.**

**STOCKER CHUTE 4664-34 is implemented** (`db_migrations/20260814c_…`): 80 inventory rows
in `tooling_ks400b`, six formulas and four search rules on KS-400B1. The design rule is on
the **tooling drawing**, not in RE33037 D — the standard publishes only the TYPE split:

```
OD : Turning OD 荒径 (MAX)     A = OD + 0.5      D = 2 (SD≤6) 4 (6<SD≤8) 6 (8<SD≤10) 8 (10<SD)
W  : Width 巾 (Nominal)        B = W + 0.5       E = B / 2
SD : Shoulder Dia. (Nominal)   C = 22 (B≤17) 32 (17<B≤27)     TYPE1 W≤10 · TYPE2 10<W
```

> **`OD` means the BEFORE-TURNING diameter at its MAX** (荒径). That one word is why three
> attempts to reverse-engineer this failed: against the after-grind OD the rule matches
> **1 of 87** rows and against the plain before-grind OD **40 of 87** — against
> `odBf_max` it matches **73 of 87**. The rules needing no part data land at 79/80 (C) and
> 80/80 (E). Never infer a dimension rule from the tooling list when the drawing exists.

The remaining ~16 % is part-revision drift, not a wrong formula: the sheet accumulated over
years against specs that have since moved. That is what the search tolerance is for — the
formula computes the target, the search finds the nearest chute that exists.

Two things about the config, both deliberate:

- **A and B carry the tolerance (±1.0); C and D rank but never exclude.** C and D are steps
  derived from B and SD, so a hard filter on them discards a chute that fits on the
  dimensions that actually matter.
- **Coverage is 30 % of KS-400B1-eligible parts, and that is normal.** 80 chutes against
  12,555 eligible parts; a chute is made per part family as it is needed. WORK DRIVER, the
  same machine's oldest tooling, has 43 rows against the same population.

> Verified live after commit: `C31-00190` → `4664-34-0078` (computed A 25.24 vs dim_a 26),
> `C31-00213` → `4664-34-0016` (computed A 13.33 vs dim_a 13.3), 5 of 6 sample CNs matched.
> **`KS-400B1` is in a `machine_group`, so search results carry the group label
> `KS-400B1/B2/B7` — filtering results on the bare machine name finds nothing.**

### Machines added from the TEMPLATE_B sheet audit (2026-08-14)

Working the SPH sheets and then the RACE / SLEEVE / BALL sheets end-to-end produced four
new machines. Every one took its rules from the **Excel calculation block inside the
tooling workbook** (`加工対象物寸法記入欄`), never from the tooling list beside it.

| Migration | Machine | Tooling | Rows |
|---|---|---|---|
| `20260814d_x100_sph_arbor.js` | **X-100** (組切削, proc 2071/2031) | ARBOR | 123 |
| `20260814e_x100_sph_rest.js` | X-100 | ARBOR PIN · CENTER · WRIST END | 81 / 132 / 68 |
| `20260814f_xd8_sph.js` | **XD-8** | COLLET · STOPPER L/R · WRIST END ASSY · LOADER JAW · INVERSION JAW | 62 / 32 / 44 / 30 / 4 / 5 |
| `20260814g_ksb80_wheel.js` | KS-B80 | WHEEL 4021-05 | 17 |
| `20260814h_kn113a_ball_inner_grind.js` | **KN-113A** (和泉 ball inner grind, proc 1181) | WHEEL · BACK PLATE · JAW | 3 / 3 / 8 |
| `20260814i_oc16a_collar_and_pin.js` | OC-16A (centreless) | COLLAR · PIN | 44 / 3 |
| `20260814j_rolling_dies.js` | **ROLLING** (転造, proc 2511/2501) | ROLL DIE | 73 |
| `20260814k_marking_and_ball_arbor.js` | **MARKING** (proc 3491) · **LB-15** (球削) | PALLET · ARBOR/NUT/COLLAR | 37 / 60·56·3 |

### Reading a tooling workbook: where the rule actually hides

A first pass over these files wrote six of them off as "flat list, no calculation block".
That was wrong on all six, and the four places the rule turned out to be hiding are worth
knowing before declaring any future sheet unimplementable:

1. **A prose note above a *sibling* sheet.** OC-16A's COLLAR and PIN sheets have no rule;
   the RACE PUSHER sheet in the same workbook prints `A = OD − 0.5` with `OD < A ・・・×`
   over the whole file. Same for MARKING — the 4918-03 sheet states
   `W = ワーク最大巾 + GAP (0.05〜0.35)` and 4918-02 follows it.
2. **Columns past the ones you sampled.** The rolling-die sheet looks like a bare AS8879
   standards table for its first fourteen rows; the drawing numbers are in columns 11–13,
   headed 巾 60mm / 巾 80mm / 巾 100mm.
3. **A `NOTE` column that encodes the dimensions.** COLLAR notes read `FACS-V11-D14-L11` —
   V = bore, D = outside dia, L = length. It restates the dimension columns, which is how
   you confirm which column is which. *(The user pointed at this column; it was the thread
   that unpicked the rest.)*
4. **A `P/N` column, which is ground truth.** `tooling_spec_process.pn` joins straight to
   it, so a sheet with part numbers can be *validated* even when the rule is only stated
   loosely. That is how `A = OD − 0.5` was confirmed for COLLAR (5 pairs, all within
   ±0.45) and how the B column was ruled out (off by 2.4–4.9 on the same rows).

### Thread-driven selection (`threadDia`, `threadTPI`)

`buildSpecContext` derives two thread variables from `tooling_spec_process.thread_name`
(populated on 1,064 rows). They exist for the rolling dies, which key on thread and
nothing else — no OD/ID/W rule is possible for them.

`thread_name` arrives in **two spellings for the same thread** — `.3125-24UNJF` and
`5/16-24UNF` — so it is parsed to a number rather than string-matched. `threadDia` is the
nominal diameter in **inches**, matching column A of `新_転造ダイス先端R.xls`.

> **Mixed fractions must be tested before the decimal form.** `1-1/8-12UNJF` splits on `-`
> to a head of `1`, which the decimal branch accepts as 1 inch — checking decimals first
> silently truncates every 1-1/8, 1-1/4 and 1-3/8 die to 1″. Nine spellings are covered by
> the parser test in `tests/mtc/searchService.test.js`.

Both rolling rules match **exactly** (`tol_plus = tol_minus = 0`): a die either cuts the
thread or it does not, so there is no nearest-fit. Die width (60/80/100 mm) deliberately
carries no rule — it is a setup choice, so every width for the thread is returned.

Two shapes recur and are worth recognising on sight:

- **A range table** (`巾min | 巾max | 内径min | 内径max`) is the `+0` containment pattern —
  `tol_plus = 0` on the min column and `tol_minus = 0` on the max column. It needs **two
  distinct `output_key`s** per range (a floor key and a ceiling key); `tooling_search_rule`
  is UNIQUE on `(machine_id, tooling_name, output_key)`, so reusing one key for both
  columns fails on the second insert. KS-B80 WHEEL uses four keys for two ranges.
- **`tooling_ksb80` stops at `dim_e`.** The KS-B80 wheel list carries both 砥石長 and 砥石径;
  only the length is stored. Adding `dim_f` to that table is the fix if the diameter is
  ever needed for ranking.

### Coverage by process code (audited 2026-08-15)

TEMPLATE_B's first column is the **process code**, the second its name, the third the
machine, the fifth the tooling and the sixth the drawing family. That makes it the map
from a process number to everything Tooling Select would need to cover it. Against the
24 codes on the floor's list:

| | codes |
|---|---|
| ✅ complete | `0083` TURNING(3) |
| 🟡 partial | `1181` `1081` `3491` `1241` `1161` `0451` `2071` `2031` `3002` `3001` |
| ❌ none | `0351` `2411` `3161` `2211` `3041` `0561` |
| — not in TEMPLATE_B | `0401` `0082` `2021` (absent entirely) · `0081` `3131` `3221` `3191` (present, but their tooling carries non-`NNNN-NN` numbers) |

Two things this shows that a per-machine view does not:

- **The ❌ group's parts are not in `tooling_spec_process` at all.** This is the real
  blocker and it is structural, not a missing tooling list. The spec table holds **16,627
  rows, every one a numeric CN** — bearing and SPH components. The assembly-side processes
  (STAKING, RELEASE, INSTALL LUB FITTING, CHECK CLEARANCE, HAND FEEL INSPECT) work on
  *assembled rod-ends*, whose C/Ns are alphanumeric (`00M950`, `00B220`) and whose P/Ns are
  assembly numbers (`ASRD4-1`, `ARRL6MDZ-30C`). Zero of the 83 C/Ns on the STAKING jig list
  and zero of its 117 P/Ns resolve against the spec table.

  So `2211` STAKING is otherwise ready — `20230523_リベッティングマシン用治具リスト` has a
  C/N-driven DIMENSION sheet, BASE 4843-01 (42 rows) and HEAD 4843-02 (41 rows), and the
  BASE columns map cleanly (`dim_a` = DIMENSION col N アウター外径, `dim_b` = col O
  インナー内径MIN, both of which the context could supply). It cannot be *validated or
  used* until those parts exist in the system. Loading the rod-end assembly universe into
  `tooling_spec_process` is a data-model decision, not a config gap.

  `0081`'s tooling is separately out of scope — it is a cutting insert (`INSERT Q-51-`,
  `HOLDER MXC-`), selected from a catalogue, not designed per part.
- **`0351` FINISH ID was the exception, and is now implemented** (`20260815c_…`, BODY
  HOLDER 4651-20, 203 rows) — see below.

### Body tooling and the `HD` / `headWidth` / `shankDia` context variables

`0351` FINISH ID is designed off the **blank's head**, not off the finished bearing, so it
needed inputs `buildSpecContext` did not carry. Three were added. Their identity was
*measured*, not assumed — the 4651-20 workbook's `DIMENSION` sheet lists 147 C/Ns with
their HD/CD/W/FL/SHD, so every candidate column was scored against it:

| sheet input | spec column | agreement |
|---|---|---|
| HD 頭部径 | `blank_head` → context `HD` | 73/73 (100 %) |
| 巾 | `head_width` → context `headWidth` | 81/81 (98 %) |
| SHD | `female_shankdia` → context `shankDia` | 20/21 (95 %) |
| CD 面取り径 | — no column above 50 % | not available |
| FL フラット部長さ | — no column above 50 % | not available |

> **`head_width` is not the head diameter.** Reading it as HD puts a 25.85 mm head against
> an 8.31 mm value. The names in `tooling_spec_process` do not all mean what they look
> like; score a candidate against a C/N list before wiring it into a formula.

BODY HOLDER ships `A = ROUND(HD, 2)` and `C = ROUND(10 + 巾×0.75, 0)` only — B needs CD and
D/E need FL. **It carries the only eligibility limit any machine added this week has**:
`HD ≤ 68`, from RE33024 D §7 対象ワークサイズ, verified live (a CN with HD 70.48 is excluded).

Two families named by RE33024 D are deliberately absent. **CLAMP PLATE 4651-13 has no
tooling list on the shared drive** under any searched name. **BODY HOLDER 4651-12's only
list is `使用禁止_BD5XXX_ボディーホルダーLIST.xlsx`** — 使用禁止, do not use. Its design
sheet does carry live formulas (`A = 外径最大値`, `C = 面取り径最大値 + 0.5`, `D = 29 − 巾`,
`B = D + 0.75×巾 + 19`), so the family is implementable the day a permitted list exists —
but loading a do-not-use shelf into a selection system would actively mislead. Rev D of the
standard made the thin holder (4651-20) the standard design anyway.

The partial rows are mostly one or two families short. The recurring absentees are
QUILL 4853-05 (no shelf — see below), the 9901 measuring pins, and the 4879 / 4501 collet
sets on X-100.

### SPH / ball / race component dimensions (2026-08-15)

The 組切削 tooling is designed against the **ball and race inside** an SPH assembly, not
against the assembly's own OD/ID/W. Those dimensions live in the factory DB and are now
synced into `tooling_spec_process` by `20260815f_spec_component_dims.js`.

`tooling_spec_process.cn` is numeric (`434061`); every `lpb` table keys on a prefixed form
(`A43-04061`). **Build the join on the lpb side** — the reverse conversion is exact, while
forward you would have to guess the class letter:

```sql
substring(control_no from 2 for 2) || ltrim(substring(control_no from 5), '0')
```

```
lpb.eng_sph --sph_design_no--> lpb.eng_sph_design   sph_od, sph_width,
     |                                              ball_sph_dia, ball_width, dall_id
     +--lpb.eng_bom (parent_cn -> child_cn)-------> lpb.eng_race  (od, width)
                                                    lpb.eng_ball  (ball_dia, width, in_dia)
```

| context var | column | agreement | scored against |
|---|---|---|---|
| `ballWidth` | `ball_width` | 100 % | FTL sheet (n=20) · J-WAVE (n=23) |
| `ballBore` | `ball_bore` | 100 % | FTL (n=20) · J-WAVE (n=23) |
| `ballDia` | `ball_dia` | 85–100 % | FTL (n=20) · J-WAVE (n=23) |
| `raceOd` | `race_od` | 88–95 % | FTL `RD` (n=16) · J-WAVE `ROD` (n=21) |
| `raceWidth` | `race_width` | 100 % | J-WAVE `RW` (n=21) |
| `sphOd`, `sphWidth` | `sph_od`, `sph_width` | — | equal to `OD`/`W` on SPH parts |

Coverage is 5,166 of 16,627 spec rows (31 %) — the SPH/ball population. A body or a sleeve
correctly has none of these.

**`SW` is `sphWidth`**, confirmed three ways: X-100 ARBOR D reproduces 87 % with it against
59 % for `raceWidth`; J-WAVE scores 91 % within 0.3 (n=23); FTL 79 % (n=19).

**`TB` (とば口径) is stored nowhere and does not need to be.** It is a *race* dimension —
the XD-8 workbook groups it under RACE beside RACE WIDTH — but `lpb.eng_race` has no column
for it; od, width, id, chaner and mating_ball were each scored against 366 matched rows and
none comes close. It is geometry: a race of width RW wrapped around a sphere of diameter BD
leaves a mouth of

```
TB = sqrt(BD² − RW²)
```

which reproduces the XD-8 DIMENSION sheet's own TB column **within 0.01 mm on 96.6 % of its
503 rows**, median error 0.003. `buildSpecContext` exposes it as `TB`; 2,679 spec rows can
produce it. Guarded to return 0 when either input is missing or `RW >= BD`.

**A fourth simultaneous filter empties the result.** X-100 ARBOR B is a sound rule — after
the TB correction below it reproduces the arbor the shop plans with median error 0.00 and
93 % within 1.0 (n=249) — but A, C, D and B must hit the *same* arbor. Flipping B to a
±1.0 filter was measured against the factory plan and **loses**: 69 % to top-2 against
72 % rank-only, with 47 no-matches against 38. It stays rank-only (`is_match_dim = false`,
no tolerance). Count the filters before adding one: on a 123-row shelf, three is the
practical ceiling, and a better formula does not raise it.

### Two とば口径, two ボール肩径, and one machining allowance (2026-08-15)

The 組切削 workbooks share vocabulary and **do not share definitions**. Three quantities
were resolved by measuring each sheet against the live data rather than by reading a label.

**`TB` — the same name for two different numbers.** The identity is not in dispute: a race
of width *w* around a ball of diameter *BD* leaves a mouth of `sqrt(BD² − w²)`. Which width
goes in is:

| sheet | column | width it uses | spec column |
|---|---|---|---|
| X-100 `DIMENSION` I | `=SQRT(D²−H²)` | **H** = SW, SPH RACE WIDTH (assembled) | `sph_width` |
| FTL `DIMENSION` L | `=SQRT(I²−E²)` | **E** = SW, SPH レース巾 (assembled) | `sph_width` |
| XD-8 `DIMENSION` N | `=SQRT(J²−D²)` | **D** = RW, レース単体巾 (the blank) | `race_width` |

On C/N 413010 the assembled race is 12.70 and the blank 14.38, so the two mouths differ by
over a millimetre. Each sheet is reproduced by its own width and by no other:

|  | `sqrt(ball_dia²−sph_width²)` | `sqrt(ball_dia²−race_width²)` |
|---|---|---|
| X-100 TB | 35 % exact · 81 % ±0.1 | 2 % exact · 5 % ±0.3 |
| XD-8 TB | 6 % exact · 13 % ±0.1 | 74 % exact · 81 % ±0.1 |

> The context now carries **both** — `TB` (assembled, what X-100 and FTL mean) and `TBrace`
> (the blank, what XD-8 means). `TB` shipped in `20260815i_` wired to `race_width`, which is
> XD-8's reading inside X-100's only consumer; the 96.6 % that justified it was the XD-8
> **sheet reproducing itself**, never the DB column. X-100's own sheet warns about exactly
> this above the two columns: `旧設計はRWにSWの値が入っている。要修正。`

**`SD1` / `SD2` — the sheets agree here, and simply split by ball type.** Both FTL and XD-8
carry the two in adjacent columns with exactly one filled per row. `SD1` (ボール肩径 Yボール)
is a drawing value, synced from `lpb.eng_ball.shoulder_dia` by `20260815j_` — 245 rows, the
Y-ball population, 62 % exact / 95 % within 0.1 (n=21). `SD2` (通常) is
`ROUND(SQRT(BD²−BW²),2)`, needs no column, and reproduces at 86 % exact / 96 % within 0.1
(n=382). A formula wanting "the shoulder" writes `if(isYBall == 1, SD1, SD2)` — and
`isYBall`, not `isBallInner`, which also takes an INNER type and would send normal balls
down a branch where they have no value.

**`OD` (SPH 切削外径) is `sph_od` plus a fixed allowance**, which two workbooks quote two
ways: XD-8 states a nominal with its own +TOL column (0.05 on 360 of 413 rows) and runs
`sph_od + 0.10` on 81 % of 371 rows; FTL states an already-MAX value and runs `sph_od + 0.15`
on 53 % of 32. `0.10 + 0.05 = 0.15`. Exposed as `sphCutOd` / `sphCutOd_max`. The rows that
miss are two-stage parts, where an intermediate D-cut diameter is a designer's choice no
spec column holds.

### A ceiling rule's sentinel is 999999, not −999

The seeding rule "gate a tooling branch with an unmatchable sentinel" has a worked example
of `-999` that is correct for a `BETWEEN` and **backwards for a ceiling**:

| rule shape | emitted SQL | sentinel |
|---|---|---|
| `tol_plus` **and** `tol_minus` | `col BETWEEN lo AND hi` | `-999` |
| `tol_minus` only (ceiling) | `col >= computed - tol_minus` | `999999` |
| `tol_plus` only (floor) | `col <= computed + tol_plus` | `-999` |

FTL COLLET OP1 shipped as `A = raceOd` with `tol_minus = 0`. On a part with no race,
`raceOd` is 0, the filter becomes `dim_a >= 0`, the whole 126-row shelf qualifies and the
ranking returns the two smallest — verified live on C/N 110001/110011/110016, bodies with
no dimension of any kind, each handed `4501-01-A004`. Fixed in `20260815k_`.

### FTL 4501, validated against the factory plan (2026-08-15)

`lpb.eng_r_pi_tool` joined on `process_plan_no` (the prefixed C/N) is a live answer key —
938 C/Ns carry a 4501-01 or 4501-02, 691 of them specced. Measuring
`planned dim_a − computed A` over ~280 planned tools per family says what each shelf
lookup actually is, and it is not always what the sheet's `MIN(IF(A >= A7))` implies:

| family | rows | median Δ | shape shipped | → top-2 |
|---|---|---|---|---|
| COLLET OP1 | 126 | 0.00 | ceiling, `tol_minus = 0.1` | **81 %** (was 64 % at `0`) |
| COLLET OP2 | 142 | 0.00 | ceiling on `sphCutOd_max`, `tol_minus = 0.1` | **80 %** |
| PUSHER OP2 | 116 | −0.15 | nearest on `sphOd`, ±0.5 | **85 %** (was 3 %) |
| PUSHER OP1 | 63 | +4.75 | **withdrawn** | — |

Two things worth carrying forward:

- **The allowance belongs to the collet, not to the pusher.** PUSHER OP2's −0.15 offset is
  exactly the turning allowance COLLET OP2 needs. A collet grips the turned diameter and is
  built to it at MAX; a pusher bears on the face and is built to the SPH's own OD. Same
  sheet, same word `OD`, two different quantities — so it has to be measured per family.
- **A quarter of planned collets sit 0.01–0.05 *below* the computed value.** That is spec
  revision after the collet was made. `tol_minus = 0.1` keeps the ceiling's shape and lets
  the ranking reach them; it is worth 17 and 27 points respectively.

**PUSHER OP1 is withdrawn, and that is a finding, not a gap.** Shipped exactly as its sheet
states it (`A7 = IF(WORK TYPE="Y", SD1, SD2)`, ceiling) it is right **2 %** of the time.
Seventeen candidate quantities were scored against its 659 planned pushers and the best
(`TB`) puts only 25 % within 0.5 mm of its own median. Even the 適合表's coarser claim
fails — deriving the pusher's TYPE band from the ball shoulder (`≤13 → 1`, `≤28 → 2`, else
3) agrees on 62 % and errs high 215 times. Every sheet in the workbook says why at the top:
`設計計算のみ有効・結果はACCESSに入力の事` — the sheet designs a *new* pusher; the shop's
choice among existing ones lives in an ACCESS database this system cannot see. The 63 shelf
rows stay in `tooling_ftl10`; only the formulas and rules were removed, so the family
reports nothing rather than something wrong. SD1/SD2 are what made the disproof possible,
and PUSHER OP2 — the larger family — ships on the same sync.

> **Next: J-WAVE 4879.** The three quantities that blocked it — `SW`, `TB`, `SD` — are all
> in the context now, and its workbook (`20210315_TOOLING LIST_J-WAVE.xlsx`) has the same
> `DIMENSION` + per-tooling-sheet shape as FTL's. Its sheets have not yet been worked.
> Build the `lpb.eng_r_pi_tool` answer key **first** this time: it is what caught PUSHER
> OP1, and it would have caught the TB wiring too.

Two things shipped the moment the sync landed:

- **X-100 ARBOR `D`** (`20260815g_`) — `ceilN((ballWidth - sphWidth)/2 + 0.5, 1)`. Which
  column was `SPH SW` was settled by computing D both ways against the 121 arbors that
  have one: `sphWidth` reproduces the shelf exactly on **87 %**, `raceWidth` on 59 %.
- **FTL COLLET OP1** (`20260815h_`, 126 rows) — the first piece of process 2071's biggest
  gap. `A = raceOd` with a **ceiling** lookup, not a nearest match: the sheet does
  `MIN(IF(A >= A7))`, which `searchInventory` expresses as a lone `tol_minus`
  (`col >= computed - tol_minus`) plus the existing ranking. It shipped at `tol_minus = 0`
  and with no sentinel; both were wrong and are corrected in `20260815k_` / `20260815n_`
  — see "A ceiling rule's sentinel" and the factory-plan table above.

### Tooling that is documented but cannot be selected, and why

These were each chased to their source file and are **not** oversights. Do not re-open one
without new source material — three earlier attempts to reverse-engineer a rule from a
tooling list all produced wrong answers.

| Tooling | Blocker |
|---|---|
| **4664-21 / 4664-22** (KS-400B1 second plug pair) | No dimension data exists anywhere. The referenced `プラグA_B（榊原）/球研機KS400_プラグA_B.xls` is **an empty workbook** (Sheet1 one row, Sheet2/3 blank), and the main file's PLUG(A)/(B) sheets hold only 4664-06/07. |
| **4560-04-0001…0005** (押さえ棒) and the OC-16A **ARBOR** sheet | Every dimension cell is blank — the ARBOR sheet says so outright (`CAD図無し`). The 3 PIN rows that *do* carry dimensions are implemented. |
| **4560-11-0001…0022, 0024** | Noted 詳細不明（図面が見つからない）— drawing lost — and 未設計. No dimensions exist to store. The other 44 COLLAR rows are implemented. |
| **QUILL 4853-05** (KN-113A) | Its whole block reads cells out of the WHEEL sheet (`='WHEEL(4853-14)'!B34`), and the sheet has no 図番 rows at all. Dependent on the wheel — there is no shelf to search. |
| **JAW 4853-15 dimension C** | The sheet computes `ROUND(18.5 + 0.6×OD, 1)` stepped to 0.5, but the shelf runs 39·34·32.5·32·30·28 against A 47.75→25.12 and then rises again — not monotonic in A, so it is not the quantity the formula produces. Stored, no search rule. |
| **4918-03 SPACER** | Its stated key is `S = シャンク（ねじ）外径`, the shank thread OD. `threadOd_max`/`threadOd_min` now reach the context, but the sheet's 穴径 ladder is keyed on hole pattern and array (`7×5`, 35 holes) as much as on S — it is a plate layout, not a one-dimension fit. 4918-02 PALLET *is* implemented. |

> **`加工対象物寸法記入欄` is sufficient, not necessary.** A workbook carrying that block is
> implementable outright. A flat list is not automatically hopeless — check the four hiding
> places above before writing one off. Six sheets were wrongly written off on the first pass.

**One rule in this system is inferred rather than sourced**, and it is marked as such in
both the migration header and the formula `description`: **LB-15 ARBOR `A = ID − 0.3`**.
The 球削 workbook has no calculation block anywhere; the rule rests on two 適用型式 that
resolve to real spec rows (D3 at ID −0.24 and −0.35) plus the shape of X-100's documented
arbor rule. Its ±1.0 tolerance is deliberately wide — the result is a shortlist, not an
answer. If the 球削 drawing surfaces, replace the formula; do not tune the tolerance.

### The TEMPLATE_B grey-fill convention

Worth knowing, because it settles several arguments at once: a tooling row shaded grey
(`theme0` with a negative tint) is **not selected for that part family**; white is selected.
Counting white vs grey across all 33 sheets:

| drawing | white | grey | reading | in Tooling Select |
|---|---|---|---|---|
| 4021-03 QUILL, 4021-04 QUILL BOLT | **0** | 10 | never selected | absent — **correct** |
| 4559-06 LOADER (old) | **0** | 5 | never selected | kept as `LOADER (4559-06 REF)` |
| 4559-41 LOADER (new) | 5 | 0 | always selected | now `LOADER` — **independently confirms the rename** |
| 4021-05 WHEEL | 7 | 3 | selected | absent — real gap, but in no standard |
| 4664-21 / -22 PLUG pair | 2 | 3 | selected | absent — real gap, but in no standard |
| 4664-34 STOCKER CHUTE | 1 | **0** | selected | absent — **the one conformance gap** |

The control that proves the reading: `4664-06` PLUG(A) is grey on BALL(1)(2)(3) and white on
BALL(内径にTFE) and S_ROLLER_ASSY — and it *is* in Tooling Select. So grey means "not for
this family", never "not implemented".

> The same caution applies to the QUILL / WHEEL sheet if it is ever wired up — each row
> carries three drawing numbers for three tooling names and the wheel column is a spec
> string (`15D-20T-6H-4.4X`), not a dimension.

Full findings, with the measured counts behind each: the RE330 Conformance Review artifact.

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

2. **Gate a tooling branch with an unmatchable sentinel, never a skipped `condition_expr`.** To disable a tooling for parts it doesn't apply to, make its key compute an impossible value, e.g. `A = if(Type=="N", odBf, -999)`. A *skipped* `condition_expr` leaves the output undefined → `searchInventory` drops the tolerance WHERE filter and returns **arbitrary** rows (silent wrong-match bug). The `-999` keeps the `BETWEEN` filter active so the wrong-gate tooling correctly returns nothing. **The sentinel's sign depends on the rule shape** — `-999` is right for a `BETWEEN` and for a floor, and backwards for a ceiling, where it must be `999999`. See "A ceiling rule's sentinel is 999999, not −999" below; getting it wrong on a one-sided rule fails *open*, not closed.

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
