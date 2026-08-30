# Tooling Select — selection rules (DRAFT, for comparison)

> **This file does not replace `.claude/rules/tooling-select.md`.** It was written
> from scratch on 2026-08-21 by reading the two source workbooks on `G:` and the live
> `eng_system` database, deliberately *without* copying the existing rules file, so the
> two can be compared. Nothing here is loaded automatically — it sits in `docs/`, not
> in `.claude/rules/`. Promote, merge or discard after the comparison.
>
> Every number below was counted from the file or the table named beside it.

---

## 1. What decides a selection

A selection is the answer to one question: **given a control number, which physical
tooling row on the shelf should this machine use?** Four things decide it, in this order,
and each is owned by a different artefact:

| # | Decides | Owned by | Stored in |
|---|---|---|---|
| 1 | **Whether** this machine touches this part family at all | `TEMPLATE_B.xlsx` — the white/grey fill on the family's sheet | nothing; a human reads it |
| 2 | **Whether** the part physically fits the machine | `RE33xxx` design standard §7 対象ワークサイズ | `tooling_machine_limit` (31 rows) |
| 3 | **What size** the tooling must be | the per-machine workbook's <code>加工対象物寸法記入欄</code> block, or the tooling drawing | `tooling_formula` (576 rows) |
| 4 | **Which shelf row** is that size | how the workbook looks the value up — nearest, ceiling or floor | `tooling_search_rule` (277 rows) |

Steps 2–4 run per search. Step 1 never does: it is a judgement recorded in a spreadsheet,
and the system only ever sees its consequence — a machine that has formulas, or one that
does not.

**A fifth path exists for tooling no formula can select**: `tooling_partno_map`
(6,701 rows) pins a specific drawing to a specific `cn` or `parts_no`. Use it only after
a design rule has been measured and *rejected*.

---

## 2. Tooling groups, per machine

30 machines enabled. "Formulas" counts rows in `tooling_formula`, which is larger than the
number of dimensions — a branching rule contributes one row per branch.

### Grinders

| Machine | Inventory table | Formulas | Tooling group |
|---|---|---|---|
| `KS-03A` | `tooling_ks03a` | 138 | CHUTE COVER · CPX SHOE · FRONT PLATE · LOADER · LOADER (4559-06 REF) · MASTER RING GAUGE · PLUG GAUGE · PRESSURE ROTOR · ROLLER SHOE · SETTING GAUGE |
| `KS-B22RD` | `tooling_ks03a` | 138 | identical set — the pair shares one shelf and one formula set |
| `KS-400B1` | `tooling_ks400b` | 44 | LOADING CHUTE · PILOT PIN · PLUG(A) · PLUG(B) · STOCKER CHUTE · SUPPORT BLOCK · WORK DRIVER |
| `KS-400B5` | `tooling_ks400b5` | 29 | CHUCK JAW · MASTER RING FOR JAW · SHAFT · STOPPER · WORK CHUCK · WORK CHUTE · WORK CHUTE GUIDE · WORK CLAMP · WORK HOLDER · WORK LOADER |
| `KS-400B6` | `tooling_ks400b6` | 18 | FRONT SHOE · LOADING CHUTE · PILOT PIN · PLUG · REAR SHOE · WORK DRIVER · WORK GUIDE · WORK PUSHER |
| `KS-500RD` | `tooling_ks500rd` | 11 | FRONT SHOE · LOADING PINTLE · WORK DRIVER |
| `KS-B80` | `tooling_ksb80` | 14 | BACK PLATE · JAW · WHEEL |
| `KS-B22G` | `tooling_ksb22g` | 7 | BACK PLATE · JAW |
| `KS-H70` | `tooling_ksh70` | 12 | COLLET · COLLET (A) · COLLET BODY · GRIND STONE HOLDER · GRINDSTONE · GRINDSTONE BASE · JOINT · LOADER 4907-05 · LOADER 4907-06 · LOADER END BLOCK · LOADER FINGER CHUCK · STOPPER |
| `KN-113A` | `tooling_kn113a` | 12 | BACK PLATE (4853-16) · BACKING PLATE · GAUGE · JAW (4853-15) · WHEEL |
| `KN-312A` | `tooling_kn312` | 27 | ARBOR · NUT |
| `KN-312B` | `tooling_kn312` | 27 | ARBOR · NUT — shares the shelf with KN-312A |
| `TSG-300W` | `tooling_tsg300` | 8 | CARRIER · CHUTE COVER |
| `HAMAI 5B` | `tooling_tsg300w` | 5 | CARRIER |
| `KVD-300CRII` | `tooling_kvd300cr2` | 6 | CARRIER |
| `PSG-64` | `tooling_psg64` | 5 | COLLAR · COLLET · COLLET ARBOR · WORK FIXED BASE |
| `GS-64PFII` | `tooling_psg64` | 5 | identical set — shares the shelf |
| `MSG-410` | `tooling_psg64` | 5 | identical set — shares the shelf |
| `OC-16A` | `tooling_oc16a` | 8 | COLLAR · PIN · RACE PUSHER · SET PIN |

### 組切削 (SPH assembly turning) — process 2071 / 2031

| Machine | Inventory table | Formulas | Tooling group |
|---|---|---|---|
| `J-WAVE` | `tooling_jwave` | 20 | COLLET OP1 · COLLET OP2 · GUIDE PIN · GUIDE PIN HOLDER · WRIST END · WRIST END COLLAR |
| `X-100` | `tooling_x100` | 8 | ARBOR · ARBOR PIN · CENTER · WRIST END |
| `XD-8` | `tooling_xd8` | 5 | COLLET · INVERSION JAW · LOADER JAW · **+ STOPPER L / STOPPER R / WRIST END ASSY pinned per C/N** |
| `FTL-10(I)` | `tooling_ftl10` | 7 | COLLET OP1 · COLLET OP2 · PUSHER OP2 · **+ PUSHER OP1 pinned per C/N** |

### Everything else

| Machine | Inventory table | Formulas | Tooling group | Selects on |
|---|---|---|---|---|
| `LB15` | `tooling_lb15` | 4 | ARBOR · COLLAR · NUT | ID |
| `LNC45/C200` | `tooling_finish_id` | 2 | BODY HOLDER | `HD` (blank head), not OD/ID/W |
| `KL-20` | `tooling_kl20` | 2 | 4030-01_COLLET · 4030-02_COLLET | **`cnPrefix`**, not any dimension |
| `THREAD ROLL` | `tooling_rolling` | 2 | ROLL DIE | **thread**, not any dimension |
| `TP-SW-03他` | `tooling_tpsw03` | 2 | SET STICK | — |
| `MD-V9910WA` | `tooling_marking` | 1 | PALLET | — |
| `測定用治具全般` | `tooling_measuring` | 4 | CONCENTRICITY MEASURING PIN | ID |

> **Rule — a shared inventory table makes `inventory_tooling_filter` mandatory.**
> Six machines share a table with another machine, and several tables hold more than one
> tooling type keyed by `tooling_name`. Every search rule on such a table must set
> `inventory_tooling_filter`, or the ranking sweeps the whole table and returns a row of
> the wrong tooling type. This is consistently the single largest accuracy fix when
> onboarding a shared-table machine.

> **Rule — the tooling group is what the machine can *select*, not what it owns.**
> `XD-8` shows 3 formula-driven families and 3 pinned ones; `FTL-10(I)` shows 3 and 1.
> Counting families per machine hides that. **Check formula *and* rule counts per
> tooling, never per machine** — a family whose rows were loaded but whose formulas were
> not is on the shelf and unreachable, which is exactly how 106 XD-8 rows sat invisible.

---

## 3. Formula rules

### 3.1 Evaluation order

Rows for one `(machine_id, tooling_name)` run in `sort_order ASC`. For each row:

1. If `condition_expr` is present, evaluate it. Falsy ⇒ **skip the row entirely.**
2. If this row's `output_key` was already set by an earlier row ⇒ **skip.**
3. Otherwise evaluate `formula_expr` and assign it to `output_key`.

So **the first passing row per key wins**, and unconditional rows act as the default when
they sort last. `KS-400B1 PILOT PIN` is the canonical shape:

```
sort 30  C = idBf_min - 1     when  idBf_min < 5
sort 40  C = idBf_min - 1.5   when  idBf_min < 10
sort 50  C = idBf_min - 2     (no condition — the default)
```

`A`–`Z` are all seeded to `0` before the first row runs, then filled in as they resolve —
which is why a later formula may reference an earlier key by letter (`C = if(B <= 17, 22, 32)`).

### 3.2 Functions

| Function | Behaviour |
|---|---|
| `if(cond, a, b)` | **Both branches are evaluated eagerly** — expr-eval does not short-circuit. A non-finite value in the dead branch is harmless, but never write a formula that depends on the false branch being skipped. |
| `round05` `ceil05` `floor05` | to the nearest / next / previous 0.5 |
| `round(x,n)` `ceil(x,n)` `floor(x,n)` | rewritten to `roundN`/`ceilN`/`floorN` before parsing — expr-eval's own versions are unary |
| `lookup(v, a, b, c…)` | first item in the list `>= v` |
| `sqrt` `abs` `max` `min` | plain maths |

A thrown error **or** a non-finite result (`NaN`, `Infinity`) is a failure: the key is
left undefined and the reason is written to `mtc_formula_error_log`, deduped on the root
cause for 10 minutes. **That log is the first place to look when a family stops appearing.**

### 3.3 Input variables

| Group | Variables | Note |
|---|---|---|
| finished size | `OD` `ID` `W` (= `odAft` `idAft` `wAft`) | the default inputs |
| tolerance bounds | `odAft_max/min`, `idAft_max/min`, `wAft_max/min` | DB stores a **delta**; the context returns `nominal + delta` |
| before-grind | `odBf` `idBf` `wBf` + their `_max`/`_min` | **NULL on ~62 % of rows → 0** |
| shoulder | `SD` | stored value wins; falls back to `√(OD² − W²)` only when `sd` is missing **and** `OD > W` |
| SPH / ball / race | `sphOd` `sphWidth` `ballDia` `ballWidth` `ballBore` `raceOd` `raceWidth` | filled on ~5,166 rows — the SPH population. A body or sleeve correctly has none. |
| derived geometry | `TB` `TBrace` `SD1` `SD2` `sphCutOd` `sphCutOd_max` | see §3.5 |
| blank head | `HD` `headWidth` `shankDia` | for BODY HOLDER — designed off the blank, not the bearing |
| thread | `threadDia` (inches) `threadTPI` `threadOd_max/min` | for ROLL DIE |
| flags | `isYBall` `isABR` `isBallInner` `isIDtoOD` `isODtoID` `isThaiMsb48Collet` | `1` / `0` |
| raw | `Type` `YBall` `Process` `cnPrefix` `Y` | `cnPrefix` = first two digits of the CN |

> **Rule — always guard a before-grind variable.** Write
> `if(idBf > 0, idBf_min, idAft_min)`, never a bare `idBf_min`. NULL becomes `0`, so
> `idBf_min - 1` silently computes `-1` and matches nothing. This is the most common cause
> of "the whole family ranks wrong".

> **Rule — `head_width` is not the head diameter.** The column names in
> `tooling_spec_process` do not all mean what they look like. Score a candidate column
> against a workbook's own C/N list before wiring it into a formula: reading `head_width`
> as HD puts an 8.31 mm value against a 25.85 mm head.

### 3.4 Where the rule actually lives

The rule is the workbook's calculation block (`加工対象物寸法記入欄`) or the tooling
drawing — **never the tooling list beside it.**

> **Rule — a drawing beats a list; the factory plan beats a standard.**
> A list says what is on the shelf. A drawing says what made it that size. `lpb.eng_r_pi_tool`
> says what the shop actually fits, and it is evidence: where a standard and the plan
> disagree, measure before restoring a bound.

The single worked example that justifies the rule: STOCKER CHUTE's `OD` means the
**before-turning diameter at MAX** (荒径), which is on the drawing and in no standard.

| read `OD` as | rows matched, of 87 |
|---|---|
| after-grind OD | **1** |
| plain before-grind OD | 40 |
| `odBf_max` | **73** |

Three attempts to reverse-engineer this from the list produced wrong answers.

**A workbook with no visible calculation block is not finished business.** Six files were
wrongly written off on a first pass. Check four places before declaring one unimplementable:

1. **A prose note above a *sibling* sheet** — OC-16A's COLLAR and PIN sheets carry no rule; the RACE PUSHER sheet in the same file prints `A = OD − 0.5` over the whole workbook.
2. **Columns past the ones you sampled** — the roll-die sheet's drawing numbers are in columns 11–13, headed `巾 60mm / 80mm / 100mm`.
3. **A `NOTE` column that encodes the dimensions** — `FACS-V11-D14-L11` means bore 11, outside 14, length 11, and confirms which column is which.
4. **A `P/N` column** — `tooling_spec_process.pn` joins straight to it, so a loosely-stated rule can still be *validated*.

### 3.5 Vocabulary that means different things in different workbooks

These are settled by measurement, not by reading a label. Getting one wrong is a
millimetre-scale error that no test catches.

| Term | X-100 | FTL | J-WAVE | XD-8 |
|---|---|---|---|---|
| `とば口径` (TB) | `√(BD² − SW²)` | `√(BD² − SW²)` | `√(BD² − SW²)` | `√(BD² − RW²)` |
| context variable | `TB` | `TB` | `TB` | **`TBrace`** |

On C/N 413010 the assembled race is 12.70 and the blank 14.38 — the two mouths differ by
over a millimetre. Each sheet reproduces with its own width and no other.

**`SD1` / `SD2`** — the sheets agree here and split by ball type. A formula wanting "the
shoulder" writes `if(isYBall == 1, SD1, SD2)`. Use `isYBall`, **not** `isBallInner`: the
latter also accepts an INNER type, and a normal ball has no `SD1` at all.

**`sphCutOd`** — the diameter the SPH is turned to is `sph_od` plus a fixed allowance,
quoted two ways by two workbooks: XD-8 states a nominal and adds `0.10` with a separate
`+0.05` TOL column; FTL states an already-MAX value and adds `0.15`. Same allowance.

---

## 4. Search rules — turning a computed size into a shelf row

One row maps one `output_key` to one inventory column and says how to use it.

### 4.1 The tolerance shape decides the filter

| `tol_plus` | `tol_minus` | Emitted SQL | Meaning |
|---|---|---|---|
| set | set | `col BETWEEN computed−minus AND computed+plus` | nearest fit within a band |
| set | null | `col <= computed + plus` | **ceiling** — largest that does not exceed |
| null | set | `col >= computed − minus` | **floor** — smallest that still suffices |
| null | null | *(no filter)* | ranking only |

> **Rule — a range table is the `+0` containment pattern.** A sheet stating
> `巾min | 巾max | 内径min | 内径max` needs `tol_plus = 0` against the min column **and**
> `tol_minus = 0` against the max column, which together are exactly
> `min <= value <= max`. It needs **two distinct `output_key`s** — `tooling_search_rule`
> is UNIQUE on `(machine_id, tooling_name, output_key)`, so reusing one key fails on the
> second insert.

### 4.2 Ranking

All rules whose `is_match_dim` is true contribute to a single summed distance:

```sql
ORDER BY (ABS("dim_a"::numeric - A) + ABS("dim_b"::numeric - B) + …) ASC
LIMIT 2
```

> **Rule — `is_match_dim = false` means "does not rank either", not "rank only".**
> Both tolerances NULL already means no filter. The flag *additionally* removes the dim
> from the ORDER BY. Set it from measurement: three J-WAVE families went from 36–46 % to
> 64–93 % on that flag alone, while WRIST END COLLAR went **89 → 67** when its secondaries
> were switched on.

> **Rule — a large near-constant dim must never rank.** A ~190 mm chute height dominates
> the summed distance and selects the wrong item. Rank on the OD/ID/W part-fit dims.

> **Rule — an approximate secondary should be rank-only, never a hard `BETWEEN`.**
> A length of `W + 3.5` is a guide, not a fit; filtering on it can exclude a row that is
> correct on the dimension that matters.

> **Rule — count the filters before adding one.** On a shelf of ~120 rows, three
> simultaneous `BETWEEN`s is the practical ceiling; a fourth empties the result. X-100
> ARBOR was measured both ways against the factory plan — rank-only won 72 % to 69 %,
> with 38 no-matches against 47. A better formula does not raise the ceiling.

### 4.3 Two guards that must survive any refactor

- **No computed dim ⇒ return `[]`.** If every rule's `output_key` is undefined (because
  every formula errored), the SQL would degrade to `SELECT * … LIMIT 2` — no WHERE, no
  ORDER BY — and hand back arbitrary rows presented as real matches. The guard turns a
  broken formula into "no match" instead of a silent wrong match.
- **Gate a tooling branch with an unmatchable sentinel, never a skipped `condition_expr`.**
  A skipped row leaves the key undefined, which drops the filter and reopens the same hole.
  Make the key compute an impossible value instead — **and the sign follows the rule shape**:

  | shape | sentinel |
  |---|---|
  | `BETWEEN` | `-999` |
  | floor (`tol_minus` only) | `-999` |
  | **ceiling (`tol_plus` only)** | **`999999`** |

  Wrong sign on a one-sided rule fails **open**: FTL COLLET OP1 shipped as `A = raceOd`
  with `tol_minus = 0`; on a part with no race the filter became `dim_a >= 0`, the whole
  126-row shelf qualified, and three dimensionless bodies were each handed `4501-01-A004`.

### 4.4 `sort_priority` currently does nothing

The code sorts `distanceRules` by it and a comment claims the ORDER BY is hierarchical,
but the emitted SQL is one summed distance and addition is commutative. **153 of 277 rules
carry a non-zero value that has no effect.** Making it real means emitting
`ORDER BY ABS(a), ABS(b)` as separate terms, which would change live results on every
multi-dimension tooling — measure against `lpb.eng_r_pi_tool` first. Do not "fix" it as
a tidy-up.

---

## 5. When there is no formula

### 5.1 Pin per C/N, but only after the design rule was measured and rejected

`db_migrations/lib/seedCnMapFromPlan.js` does the whole job: shelf as whitelist, plan as
answer, ambiguous C/Ns skipped rather than guessed, idempotent per (machine, tooling).

```js
await seedCnMapFromPlan({ engPool, maqPool, machine: 'XD-8', inventory: 'tooling_xd8',
                          tooling: 'STOPPER L', family: '4858-15', source: '…' });
```

> **Rule — the map records what the shop *did*, not why.** It cannot extrapolate to a
> part nobody has made. Reach for it only when the workbook's own block has been scored
> and lost — FTL PUSHER OP1's sheet rule is right **2 %** of the time, and seventeen
> candidate quantities were scored before the map was chosen.

> **Rule — key on `cn`, not `parts_no`, unless the part number is actually populated.**
> Only 66 of PUSHER OP1's 811 mappable C/Ns (8 %) carry a `parts_no`. A cn-keyed row
> leaves `parts_no` NULL, which is load-bearing: the table's UNIQUE includes `parts_no`,
> NULLs are distinct in a Postgres unique index, and `parts_no = <value>` is never true
> for NULL — so legacy consumers cannot be disturbed by adding these rows.

> **Rule — convert `control_no` → spec `cn` with `cnFormat.toSpecCn` and nothing else.**
> An ad-hoc "strip the leading zeros" mangles short suffixes (`A41-00045` → `4145`
> instead of `410045`), which once under-reported reachable C/Ns by 19 %.

### 5.2 A lookup-only family must still enter the search

The search enumerates toolings from `tooling_formula`, so a family with no formula never
entered it at all. `_applyLookupOnlyToolings` is the pass that adds them, with two guards
worth preserving: **only machines that passed eligibility may receive one**, and **it
never displaces a formula-driven result**.

> **Rule — show an empty row, not nothing, when a lookup family has no pin for this part.**
> The map is always a subset of the eligible population. Emitting nothing made "no pinned
> selection for this part" indistinguishable from "the system has never heard of this
> tooling" — which is what the floor reported after the first sync looked like it had done
> nothing.

### 5.3 "No jig required" is a third answer, not a limit

Surface grind (process `1101` / `1102`) on a part with `OD > 40` **or** `W > 38` needs no
fixture — the MSB grinders hold work on a magnetic chuck. The machine's toolings are **not
searched at all**; left to run, the ranking would return the nearest small-part fixture
and present it as the selection.

| signal | means | consumers |
|---|---|---|
| `type: 'limit'` | the part **cannot run** here | SDS red badge, coverage anomaly filter |
| empty `matches` | a fixture should exist and none was found | the coverage report's gap count |
| `type: 'no_jig'` | it runs here and **needs no fixture** | T-Select info alert, SDS PDF label |

Reusing `'limit'` would report a false problem on 2,509 of 16,627 specced rows.

> **Rule — the factory plan overrides the engineering rule, in both directions.**
> Four real C/Ns (`394010` `394011` `394013` `394021`) are OD 47–53 on process 1101 and
> the plan assigns a COLLET anyway. `_factoryPlansJig` asks the plan first and suppresses
> the warning when a tool is planned — run **at most once per search and only when the
> part is over a bound**, so the ~85 % of parts the rule cannot touch pay nothing.
> Both sides **fail to the rule, not to silence**: an unreadable `maqdb` means we do not
> know the plan disagrees, and the engineering rule is the default answer.

---

## 6. Machine names

`tooling_machine.machine_name` must equal `sds_machine_type_code.machine_type_name`, or
the T-Select `machine_group` must. **That registry is the factory's own spelling and it
wins.** Do not take a name from the index workbook — it writes `TSG300(SEIBU)`, `KL20`,
`KS-400B`, `KVD300CRⅡ` where the registry writes `TSG-300W`, `KL-20`, `KS-400B1`,
`KVD-300CRII`.

> **Rule — the hyphen convention covers the `KS-` / `KN-` / `TSG-` grinders and nothing
> else.** `LB15` and `LNC45/C200` are correct as spelled; "fixing" them to `LB-15` /
> `LNC-45` breaks the SDS join.

Three sites match the name as a raw string, and **all three fail silently** — a missing
row, not an error:

| Site | Query |
|---|---|
| `sdsV2HeadlessController.js` (PDF tooling-slot order) | `tooling_machine … WHERE machine_name = ANY([machine_type_name, group])` |
| `sdsV2HeadlessController.js` · `searchService.js` ×2 | `tooling_partno_map … WHERE machine_name = $1` |
| `inventoryController.js` (name → inventory table) | `WHERE (machine_name = $1 OR machine_group = $1)` |

Everything else keys on `machine_id`.

Groups: `KS-400B1` → `KS-400B1/B2/B7`, `TSG-300W` → `TSG-300W/TSG-300ZNC`. The member
names have no rows of their own, so **filtering search results on a bare member name
finds nothing**.

---

## 7. Adding a machine — the checklist

No code change is required. Four inserts, in this order:

1. `tooling_machine` — `inventory_table`, and `inventory_machine_filter` if the table is shared with another machine's rows.
2. `tooling_machine_limit` — OD/ID/W bounds, each row's `description` citing its clause (`RE33042 A §7: …`) so the next reader can tell a standard's number from a local one.
3. `tooling_formula` — one row per `(machine_id, tooling_name, output_key)`; extra rows for branches.
4. `tooling_search_rule` — mapping each key to a column, with `inventory_tooling_filter` set whenever the table holds more than one tooling type.

Ship it as an idempotent `db_migrations/<date>_seed_<machine>_tooling_select.js` that
deletes and reinserts by `machine_id`, plus a `<date>_validate_<machine>.js` that builds
a live answer key from `lpb.eng_r_pi_tool` by `process_code` where one exists.

> **Rule — validate against the plan, per tooling family, and record the score.**
> Every family that shipped this way carries a measured top-2 rate. A family that cannot
> be scored has not been validated, whatever its formulas look like.

Two cache flushes are wired into the routes and must stay there: `flushConfig` drops the
in-memory config cache so an admin edit applies on the next search, and
`flushTselectOnWrite` drops `tselect_cn_cache`, without which the SDS PDF and the coverage
report serve stale matches for up to 6 hours. **A new mutating route missing the second
one shows the change in the admin UI and nowhere else.**

---

## 8. Diagnosing a wrong or missing match

In this order:

1. **All toolings for one machine return none** → `tooling_machine_limit` too strict. Compare the row against the spec.
2. **One tooling returns none, others fine** → the row is not in the inventory table.
3. **#1 wrong, #2 none, expected row slightly below** → `tol_minus` too tight. Gap = `computed − dim_x`.
4. **#1 correct, #2 none, expected row slightly above** → `tol_plus` too tight.
5. **`isODtoID` / `isIDtoOD` always 0** → `process` stored as `OD=>ID` instead of `OD->ID`.
6. **A whole family ranks wrong** → the formula reads a before-grind variable on a CN where it is NULL. Check §3.3.
7. **A family stopped appearing** → `mtc_formula_error_log`, deduped 10 min on the root cause.

---

## 9. Open items found on 2026-08-21

| Item | Evidence | Status |
|---|---|---|
| `RE33033` cited by TEMPLATE_B, PDF absent from `doc/` | TEMPLATE_B `standard` column on M-BODY / F-BODY / ABR BODY / ROLLER BODY; `doc/` holds 12 PDFs, none of them 33033 | **RESOLVED 2026-08-28 — `RE33033` is a phantom number; the standard meant is `RE33028` "ボディ内研用治具 / Body ID-grind jig" (est. 1998.2.24, covers BODY HOLDER 4652-12 / CLAMP PLATE 4652-11 / GUIDE PIN 4652-10, machine GI-20N). Vendored as `doc/RE33028_BodyIDGrind-Jig-design.pdf`. Note: TEMPLATE_B lists these rows under `4651-20` (NEW TYPE thin holder) whose arithmetic is governed by `RE33024 D`; `RE33028` is the family-level design authority.** |
| LINK LIST rows 185–192 have no path and no type | `4931-02-` … `4664-34-`; also outside the autofilter range `A1:C184` | the DATA hyperlink on those rows resolves to nothing |
| Index `M` column formula reads `FALESE` | all 134 rows | returns `#NAME?` instead of `FALSE`; the corrupt-file repair workflow does not work as written |
| `sort_priority` inert | 153 of 277 rules carry a non-zero value | do not "fix" without measuring against the plan |
| 6 index rows marked `ACCESS` | `TOOL寸法.mdb` on `\\pk4473\rdengnr\` | unreachable from the app — those families need a pin or an export |
