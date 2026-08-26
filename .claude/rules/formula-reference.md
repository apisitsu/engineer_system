---
paths:
  - "apps/ENG-Backend/api/engineer/mtc/**/*formula*"
  - "apps/ENG-Backend/api/engineer/mtc/**/*Formula*"
  - "apps/ENG-Backend/api/engineer/mtc/services/tsv2*"
  - "apps/ENG-Backend/api/engineer/mtc/controllers/tsv2*"
---

# Tooling Calculation Formula Reference

> **A, B, C, ... = Dimension labels บน DWG ของ tooling**  
> แต่ละ key ตรงกับ label มิติที่ปรากฏบน engineering drawing โดยตรง  
> Input คือมิติชิ้นงาน (OD, ID, W) → สูตรคำนวณออกมาเป็นขนาด tooling ตาม label บน DWG  
> ถ้า DWG ถูก revise → ต้อง update `tooling_formula` ใน DB ให้ตรงด้วย

---

## หมายเหตุ: TYPE คืออะไร

**TYPE** ที่ปรากฏในเอกสารนี้ **ไม่ใช่** field ในฐานข้อมูล และไม่ใช่คอลัมน์ `type` ของชิ้นงาน (ซึ่งหมายถึง INNER/OUTER)

TYPE คือ **ชื่อย่อสำหรับกลุ่ม condition** ที่ใช้ค่าคงที่ชุดเดียวกัน — เพื่อให้ตารางสูตรอ่านง่ายขึ้น

**หลักการ:**
- TYPE ถูก "คำนวณ" จากมิติ input (OD หรือ W) ณ เวลา evaluate formula
- ผลลัพธ์คือกำหนดว่าจะใช้สูตรกิ่งไหนสำหรับ key นั้น
- ในโค้ดจริง (`tooling_formula` / `tsv2_formula`) ไม่มีตัวแปรชื่อ TYPE ปรากฏ — มีแต่ `if(OD < 19.05, 36.96, 50.96)`

**ตัวอย่าง:**
```
TYPE classification: TYPE1 = OD < 19.05, TYPE2 = OD ≥ 19.05

Key B:
  TYPE1 → 36.96
  TYPE2 → 50.96

แปลงเป็น expr-eval: B = if(OD < 19.05, 36.96, 50.96)
```

**ข้อควรระวัง:** TYPE ของแต่ละ tooling ไม่เหมือนกัน — เกณฑ์แบ่งและจำนวน TYPE ต่างกันทุก tooling ให้ดูในส่วนของ tooling นั้นๆ

---

## 5b (= HAMAI 5B, machine id=6)
### 5b CARRIER 4564-03  — DWG-confirmed by SME 2026-06-11
**Input**
- **OD** = Work outer diameter MAX (ワーク外径MAX) = `od_aft`/`odBf_max`
- **W** = Work width after surface grind MIN (ワーク巾平研後MIN) = `wAft_min`

**Formula** (DB store)
| Key | Formula | DB expr |
|---|---|---|
| A | OD + 0.5 (round up 0.5) | `ceil05(if(odBf>0, odBf_max, odAft_max) + 0.5)` — turning OD MAX, NULL-safe — **match dim_a** |
| B | # holes — even, edge-gap ≥ 4, on a **fixed Ø88 pitch circle** | `2 * floor(PI*88 / (2*(A+4)))` |
| C | 88 − A (round down 0.5; 88.5−A also acceptable) | `floor05(88 - A)` |
| D | 360 ÷ B | `360 / B` |
| E | W × 0.9 (range 0.6–0.9; round down 0.5) | `floor05(W*0.9)` (W=`wAft_min`) — **match dim_e** |

> **B fix 2026-06-11** (`api/engineer/mtc/db_migrations/20260611_fix_hamai5b_carrier_hole_count.js`): was
> `2*floor(PI*(88-A)/(2*(A+4)))` → gave 14 for A=12. The holes sit on the **fixed Ø88 pitch
> circle** (the `88-A` is C, not the hole circle); per-hole pitch = A+4 (pocket + 4mm min gap):
> `2*floor(PI*88/(2*(A+4)))` → **16**. expr-eval has no trig, so this linear circumference/pitch
> model is used (matches the worked example). Only B changed; A/C/D/E already matched the DWG.

**Example result:** OD=11.245, W=5.95 → A=12, **B=16**, C=76 (DWG primary; 76.5 = the 88.5−A
alternative), D=22.5, E=5

---

## TSG-300

### TSG-300 CARRIER 4556-01

**Input** — DB variable: `OD` (= `od_aft`, after-grind OD nominal)
- **OD** = Work outer diameter after grind (nominal)
- **W** = Work width after grind (nominal)

**Formula**
| Key | DB expr | Notes |
|---|---|---|
| A | `ceil(if(odBf>0, odBf_max, odAft_max) + 0.5)` | xlsx `ROUNDUP(turning OD MAX + 0.5, 0)` — integer ceil, NULL-safe. Pocket dia |
| B | `404 - A` | derived; search rule disabled as a filter (collinear with A) |
| C | `A - 2` | derived; search rule disabled as a filter (collinear with A) |
| D | snap-ladder of `if(wBf>0,wBf,wAft)*0.55` → {2.5,3,4,4.5,5,6,8,9,10,12,round} | xlsx allowed-value ladder, NULL-safe; `dim_d <= D` upper bound |
| E | 360 / F | (not DB-driven) |
| F | Value that divides 360 evenly ≤ 2 decimal places | (not DB-driven) |
| (G) | ≥ 0.4 × A | (not DB-driven) |
| H   | No heat build-up (D < 8 or 52.5 < C) | (not DB-driven) |
| J   | Refer to a separate table | (not DB-driven) |

**Example result:** OD=22.35, W=15.94 → A=24, B=380, C=22, D=8, E=36, F=10, G=(19,21) (G≥8.4), H=No heat build-up required, J=SS400

> **Note (2026-06-20 audit):** the live DB had **reverted** to the NULL-unsafe `ceil05(odBf_max + 0.5)` and `floor(wBf_max*0.55)` (od_bf NULL ~35% → A≈0.5, D=0 → carrier returned NONE for 70% of CNs). Re-fixed to the xlsx form with a NULL-safe before→after fallback and the snap-ladder D, and disabled the collinear B/C filters. CARRIER factory top-1 24%→34%, top-2 24%→65% (none 616→26). Migration `api/engineer/mtc/db_migrations/20260620_fix_tsg300_hamai5b_formulas.js`. The xlsx selects on **turning (before-grind) OD/W**; residual misses are factory adjacent-size discretion.

---

### TSG-300 CHUTE COVER 4866-14

**Input** — DB variables: `OD` (= `od_aft`), `W` (= `w_aft`)
- **OD** = Work outer diameter after grind (nominal)
- **W** = Work width after grind (nominal)

**Formula**
| Key | DB expr | Notes |
|---|---|---|
| A | `if(odBf>0, odBf_max, odAft_max) + 0.2` | turning OD MAX + 0.2, NULL-safe — **match dim_a** |
| B | `if(wBf>0, wBf_max, wAft_max) + 0.1` | turning W MAX + 0.1, NULL-safe — **match dim_b** |
| C | `ceil(B + 5)` | Minimum 5mm clearance (display; xlsx snaps to mult-of-5) |
| D | `roundN(12 + A / 2, 1)` | Round to 1 decimal |
| E | φ10.5 C'SINK (B < 25) / φ8 C'BORE DEPTH 4.4 (25 ≤ B) | (not DB-driven) |
| F | 2−φ4.5 THRU. (fixed) | (not DB-driven) |
| (G) | C − B (5MIN. BLUE) | (not DB-driven) |

**Example result:** OD=24.99, W=17.46 → A=25.19, B=17.56, C=23, D=24.6

> **Note (2026-06-20):** live DB had reverted to bare `odBf_max + 0.2` / `wBf_max + 0.1` (NULL od_bf → A≈0.2 → wrong/smallest tool). Re-fixed to the NULL-safe before→after form (xlsx uses turning OD/W MAX). CHUTE COVER factory top-1 55%→82%, top-2→92%; dim_a/dim_b within ±1.0 of req for 99%. Only A and B drive selection. Migration `api/engineer/mtc/db_migrations/20260620_fix_tsg300_hamai5b_formulas.js`.

---

## KS-B22G

### Machine Limit
| Dimension | Condition |
|---|---|
| OD | ≤ φ38 MAX |
| ID | φ4 ≤ ID ≤ φ20 |
| W  | ≥ 5 |

> **Widened 2026-06-20** (`api/engineer/mtc/db_migrations/20260620_fix_ksb22g_ksb80_jaw_and_limits.js`): was ID 4.8–16, W≥10 — too strict; excluded 70 (W 7–9.5) + 19 (ID up to 19.62) real factory CNs the xlsx itself tools. Factory proc-1061 range: OD≤34.9, ID 4–19.6, W from ~7. JAW/BACK PLATE `none` 88→11.

---

### KS-B22G JAW 4027-01

**Input**
- **OD** = Work ball diameter (Tolerance Center)  
  ※ Check Process — Before or After Grind Dia.
- **W** = After Grind Width (Nominal)

**Formula**
| Key | Formula | DB expr |
|---|---|---|
| A | machining OD (process-dependent) | `if(isODtoID, odAft_max, if(odBf>0, odBf_max, odAft_max))` |
| B | A − 0.4 | `A - 0.4` |
| C | 18.5 + W/2 + 3 (normal) / 18.5 + W − 2 (ABR) | `ceil05(...)` (cond `isABR`) |
| D | 10 | `10` |

> **JAW A = process-dependent machining OD** (xlsx VLOOKUP on PROCESS): the jaw grips the workpiece OD — for **ID→OD** (ID-grind first) it grips the **turning/before-grind OD**; for **OD→ID** the already-ground **after-grind OD**. **Fixed 2026-06-20:** live formula was bare `odBf_max` → 0 when od_bf NULL → search returned the smallest jaw `4027-01-0079` for ~half the CNs. Now NULL-safe + process-aware. Factory top-1 18.5%→57.5% (top-2 87.4%); dim_a/dim_b within ±1.0 of req for 100%. Migration `api/engineer/mtc/db_migrations/20260620_fix_ksb22g_ksb80_jaw_and_limits.js`. Same fix on KS-B80 JAW (id 3): 52.8%→73.1%.

**Result format:** OD=x.xxx, W=x.xx, A=x.xx, B=x.xx, C=x(x.5), D=x

---

### KS-B22G BACK PLATE 4027-02

**Input**
- **ID** = After Grind (MAX)

**Formula**
| Key | Formula |
|---|---|
| A | ID + 0.3 |
| B | A + 1.0 (Round up x.x) |
| C | 2 ～ 4.5 |
| D | 28 ～ 36 |

**Result format:** ID=x.xxx, A=x.xx, B=x.x, C=x.x, D=x.x

---

## KS-B80

### Machine Limit
| Dimension | Condition |
|---|---|
| OD | φ15 < OD ≤ φ70 |
| ID | φ7.9 MIN |
| W  | 14 MIN |

**TYPE classification**
- **TYPE1** : φ15 < OD ≤ φ54
- **TYPE2** : φ54 < OD ≤ φ70

---

### KS-B80 JAW 4021-01

**TYPE classification**
- **TYPE1** : φ15 < OD ≤ φ54
- **TYPE2** : φ54 < OD ≤ φ70

**Input**
- **OD** = Work ball diameter (Tolerance Center)  
  ※ Check Process — Before or After Grind Dia.
- **W** = After Grind Width (Nominal)

**Formula**
| Key | Formula |
|---|---|
| A | OD |
| B | A − 0.4 |
| C | 18.5 + W/2 + 3 (STANDARD normal design) |
|   | 18.5 + W − 2 (ABR etc. ball-insert inner type) |
|   | ※ Round up to 0.5 increment |
| D | 10 (Under 10 Accept. ABR etc. Chuck one side of groove O.D.) |
| E | None — TYPE1 |
|   | A + 2.5 (Round up 0.5 jump) — TYPE2 |

**Result format**
- TYPE1: OD=x.xx, W=x.xx, A=x.xx, B=x.xx, C=x(x.5), D=x, E=None
- TYPE2: OD=x.xx, W=x.xx, A=x.xx, B=x.xx, C=x(x.5), D=x, E=x(x.5)

---

### KS-B80 BACK PLATE 4021-02

**TYPE classification**
- **TYPE1** : φ15 < OD ≤ φ54
- **TYPE2** : φ54 < OD ≤ φ70

**Input**
- **ID** = After Grind (MAX)

**Formula**
| Key | Formula |
|---|---|
| A | ID + 0.3 — TYPE1 |
|   | ID + 0.6 — TYPE2 |
| B | A + 1.0 — TYPE1 |
|   | None — TYPE2 |

**Result format**
- TYPE1: ID=x.xxx, A=x.xx, B=x.x
- TYPE2: ID=x.xxx, A=x.xx, B=None

---

## KS-03A (= KS-B22RD when idAft ≥ 12.0)

### Machine Limit
- OD After ≤ φ33 MAX

---

### KS-03A FRONT PLATE 4559-01

**TYPE classification**
- **TYPE1** : OD < φ19.05
- **TYPE2** : φ19.05 ≤ OD (※φ33 MAX)

**Input**
- **OD** = After Grind (MAX)
- **ID** = After Grind (MIN)
- **SD** = Shoulder Dia. (Nominal)
- **S"D"** = SHOE "D"
- **CC"A"** = CHUTE COVER "A"

**Formula**
| Key | Formula |
|---  |---|
| A   | ID + 0.15 |
| B   | 36.96 — TYPE1 |
|     | 50.96 — TYPE2 |
| C   | 15 — TYPE1 |
|     | 30 — TYPE2 |
| D   | 11 (SD < 10.5) |
|     | 18 (10.5 ≤ SD < 17.5) |
|     | 22 (17.5 ≤ SD < 21.5) |
|     | 32 (21.5 ≤ SD < 31.5) — TYPE2 |
| E   | 1.6 (SD < 17.5) |
|     | 2.6 (17.5 ≤ SD < 31.5) |
| F   | 7.94  (SD < 10.5) |
|     | 14.3  (10.5 ≤ SD < 17.5) |
|     | 19.05 (17.5 ≤ SD < 21.5) |
|     | 28.55 (21.5 ≤ SD < 31.5) — TYPE2 |

---

### KS-03A CHUTE COVER 4559-04

**TYPE classification**
- **TYPE1** (4559-04-0XXX) : OD < φ19.05
- **TYPE2** (4559-04-2XXX) : φ19.05 ≤ OD (※φ33 MAX)

**Input**
- **OD** = After Grind (MAX)
- **W** = Width (MAX)

**Formula**
| Key | Formula |
|---  |---|
| A   | OD + 0.2 (Round half up) |
| B   | W + 0.15 (Round half up) |
| C   | 13 (W ≤ 8.35) |
|     | 18 (8.35 < W ≤ 13.35) |
|     | 24 (13.35 < W ≤ 19.35) |
|     | 30 (19.35 < W ≤ 25.35) |
|     | 36 (25.35 < W ≤ 31.35) |
| D   | W − 1 (>=0.5 <=1.0 Accept; Round half up) |
| E   | 20.88 − (1.1 × OD)  TYPE1 Round half up |
|     | 34.88 − (1.1 × OD)  TYPE2 Round half up |
|     | None (E < 1.5 — omit when E is below 1.5) |
| F   | C − B − 1 (Round down to integer) |
| (G) | E + 42 — TYPE1 ※55.8 MAX |
|     | E + 52 — TYPE2 ※55.8 MAX |
|     | None (E < 1.5) |
| (H) | E + 226.6 — TYPE1 |
|     | E + 212.6 — TYPE2 |

---

### KS-03A ROLLER SHOE 4559-05

> ROLLER SHOE และ CPX SHOE ใช้สูตรคนละชุด — อย่าสลับกัน

**TYPE classification (by W MAX)**
- **TYPE1** : 7 ≤ W < 12.3
- **TYPE2** : 12.3 ≤ W < 29
- **TYPE3** : W < 7

**Input**
- **OD** = Work outer diameter (**MAX** = nominal + od_aft_max)
- **W**  = Work width (**MAX** = nominal + w_aft_max)

**Formula**
| Key | condition     | Formula |
|---  |---            | ---
| A   | —             | (15.88 + (0.1 × OD))       (Round up to 2 decimal places / X.XX) |
| B   | OD < 13       | (68.26 − (0.5 × OD) + 0.1) (Round up to 2 decimal places / X.XX) |
|     | 13 <= OD < 17 | (68.26 − (0.5 × OD) + 0.3) (Round up to 2 decimal places / X.XX) |
|     | 17 <= OD < 22 | (68.26 − (0.5 × OD) + 0.5) (Round up to 2 decimal places / X.XX) |
|     | 22 <= OD      | (68.26 − (0.5 × OD) + 0.8) (Round up to 2 decimal places / X.XX) |
| C   | —             | W + 0.2 |
| D   | —             | OD + 1.0 (Round off to 1 decimal place / X.X) |
| E   | —             | B − 0.5 |
| F   | TYPE1         | 6 |
|     | TYPE2         | 8 |
|     | TYPE3         | 4 |
| G   | TYPE1         | 3 |
|     | TYPE2         | 4 |
|     | TYPE3         | 1.5 |
| H   | —             | F / 2 (Round off to 1 decimal place / X.X) |
| I   | —             | H − 0.5 |
| L   | TYPE1         | I + G / 2 + 1(>=0.5 <=1.0) |
|     | TYPE2         | I + G / 2 + 1(>=0.5 <=1.0) |
|     | TYPE3         | 6 |
| M   | TYPE2         | I − G / 2 |
| R   | TYPE1         | A − F |

**Inventory search keys (V2):** A (shoe OD), B (shoe bore)

---

### KS-03A CPX SHOE 4559-40

**TYPE classification (by OD Nominal)**
- **TYPE1** : OD ≤ φ15
- **TYPE2** : φ15 < OD ≤ φ20
- **TYPE3** : φ20 < OD ≤ φ30
- **TYPE4** : φ30 < OD ≤ φ33

**Input**
- **OD** = Work outer diameter (Nominal)
- **W** = Work width (Nominal)
- **Y** = Groove width

**Formula**
| Key | Condition | Formula |
|---|---|---|
| A | — | W + 0.14 |
| C | — | W − 0.5  |
| D | — | OD × 0.1 + 15.88 |
| E | OD ≤ φ9  | OD × 0.233 + 0.4 |
|   | OD ≤ φ15 | 3.0 |
|   | OD ≤ φ20 | 4.0 |
|   | OD ≤ φ30 | 5.0 |
|   | OD ≤ φ33 | 6.0 |
| F | TYPE1       | OD × 0.6 |
|   | TYPE2, 3, 4 | None     |
| G | φ24 < OD ≤ φ33 | 25     |
|   | OD <= φ24      | OD + 1 |
| M | — | 68.26 − OD / 2 |
| N | TYPE1 | 35.5 |
|   | TYPE2 | 40 |
|   | TYPE3, 4 | None |
| O | TYPE1 | N − (D − F) |
|   | TYPE2 | 31 |
|   | TYPE3, 4 | None |
| P | TYPE2 | 68.3 |
|   | TYPE1, 3, 4 | None |
| Q | OD ≤ φ9  | 0.2 |
|   | OD ≤ φ20 | 0.3 |
|   | OD ≤ φ30 | 0.5 |
|   | OD ≤ φ33 | 1.0 |
| R | OD ≤ φ9  | 0.3 |
|   | OD ≤ φ20 | 0.5 |
|   | OD ≤ φ30 | 1.0 |
|   | OD ≤ φ33 | 1.5 |
| S | TYPE1 | 10 |
|   | TYPE2, 3, 4 | 9 |
| T | TYPE1, 2, 3 | 45 |
|   | TYPE4 | 30 |
| V | ball-insert inner | Y + 1 |
|   | C < 6       | C |
|   | 6 >= C < 8  | 4 |
|   | 8 < C       | 5 |

**Inventory search keys (V1/V2):** A (width), D (shoe OD)

---

### KS-03A SETTING GAUGE 4559-19

**TYPE classification**
- **TYPE1** : A < φ10
- **TYPE2** : φ10 ≤ A < φ19
- **TYPE3** : φ19 ≤ A

**Input**
- **F"A"** = FRONT PLATE "A"
- **W** = WORK WIDTH

**Formula**
| Key | Formula |
|---|---|
| A | F"A" |
| B | W + 63 — TYPE1 |
|   | W + 67 — TYPE2, 3 |
| C | 14 — TYPE1 |
|   | 20 — TYPE2 |
|   | 22 — TYPE3 |
| D | 12 — TYPE1 |
|   | 16 — TYPE2, 3 |
| M | M6×1.0 — TYPE1 |
|   | M8×1.25 — TYPE2, 3 |

---

### KS-03A PLUG GAUGE 4559-18
**TYPE classification**
- **TYPE1** : A < φ10
- **TYPE2** : φ10 ≤ A < φ19
- **TYPE3** : φ19 ≤ A

**Input**
- **ID** = Work inner diameter (Nominal)
- **ID max** = Upper tolerance limit of inner diameter
- **ID min** = Lower tolerance limit of inner diameter
- **T** = Tolerance (ID max − ID min)
- **Tc** = Tolerance Center

**Formula**
| Key | Formula |
|---|---|
| A | ID |
| B | ID min + 0.005 (T ≤ 0.012) |
|   | Tc − 0.001     (0.012 < T) |
| C | ID min + 0.03  (T ≤ 0.012) |
|   | Tc − 0.003     (0.012 < T) |
| D | None — TYPE1 |
|   | A − 4 — TYPE2, 3 |
| E | None — TYPE1 |
|   | A − 2 — TYPE2, 3 |
| F | 14 — TYPE1 |
|   | 20 — TYPE2 |
|   | 22 — TYPE3 |

---

### KS-03A MASTER RING GAUGE 4559-20

**TYPE**
- TYPE1: Standard BALL
- TYPE2: Oil hole BALL

**Input**
- **OD** = After Grind (MAX)
- **W** = Width (Nominal)
- **F"A"** = FRONT PLATE "A"

**Formula**
| Key | Formula |
|---|---|
| A | OD |
| B | F"A" |
| C | W |

---

### KS-03A (LOADER 4559-06 NYLON, LOADER 4559-06)
**Input**
- **OD** = Outer diameter (Nominal)
- **W** = Width (Nominal)

**Formula**
| Key | Formula |
|---|---|
| A | W − 1 (0.6W to W range acceptable) |
| B | OD (1/1000 Round down) |
| C | OD / 2 + 0.5 (1/1000 Round down) |
| D | 12.7 (OD ≤ φ12.7) |
|   | 15.9 (φ12.7 < OD ≤ φ15.9) |
|   | 19.1 (φ15.9 < OD ≤ φ19.1) |
|   | 23.8 (φ19.1 < OD ≤ φ23.8) |
|   | 28.0 (φ23.8 < OD ≤ φ33) |
| E | 25° (OD ≤ φ15) |
|   | 30° (φ15 < OD ≤ φ33) |
| F | OD (NYLON LOADER 4559-41)|

---

### KS-03A PRESSURE ROTOR 4559-17
* **Specification:** "TYPE" is the same as "SETTING GAUGE".
* **Base Formula:** A = Front Plate "A" Dimension + 0.05
* **Maximum "A" Dimension Constraints:**
  * **TYPE 1:** A <= 10
  * **TYPE 2:** A <= 16.25
  * **TYPE 3:** A <= 20.25

---

## KS-400B1

### KS-400B1 LOADING CHUTE 4664-02

### Machine Limit
* **W:** 30 MAX
* **OD:** DIA 32 MAX
* **Note:** Connecting R is not possible (No radius/fillet allowed at the joint)

### Parameter Definitions
* **OD:** Turning OD / Workpiece Cutting Outer Diameter (MAX)
* **W:** After Grind Width (MAX)

### Calculation Formulas
* **A:** 197 - (OD / 2) + E *(Round UP to nearest integer)* — **DB store `dim_a` ("Height") is NOT a ranking dim** (`is_match_dim=false`); it is a near-constant ~190 whose magnitude would otherwise dominate the closest-match distance and pick the wrong chute. Rank by C (bore) + D (OD) only.
* **B:** W + 6 *(Round UP to nearest integer)*
* **C:** W + 0.2
* **D:** Turning OD + 0.2 — **NO round-up.** DB expr `if(odBf > 0, odBf_max, odAft_max) + 0.2` (turning/before-grind OD per DWG, NULL-safe fallback to after-grind). Earlier was `odAft_max + 0.2` (after-grind only, to dodge od_bf NULL) and before that `ceil(...)`/`ceil(...,1)` (rounding biased the precise inventory `dim_d` at band boundaries). Validated vs factory 618 CNs 2026-06-19: turning-OD raised top-1 88.0→91.4%, top-2 96.4→97.4% (net +21 CN). **Known residual:** ~8.6% are factory family-standardizations (e.g. C31-00814→0020) where a snugger valid chute exists in inventory — no closest-match formula reproduces them.
* **E:** OD / 6 *(Round Down)*
* **F:** (C)

> **Audit fix (2026-06-10, `api/engineer/mtc/db_migrations/20260610_fix_ks400b1_search_rules.js`):** CN311008
> returned (NONE) for PLUG(A)/PLUG(B)/WORK DRIVER and the wrong LOADING CHUTE/SUPPORT BLOCK
> suffix. Root causes: (1) LOADING CHUTE `dim_a` Height was a ranking dim; (2) WORK DRIVER
> `dim_b` Bore + (3) PLUG(A/B) `dim_c` Length had hard tolerance windows that excluded the
> correct item (those secondary-dim formulas over-estimate) — made rank-only; (4) the D
> `ceil`. Validated vs the factory process plan (`lpb.eng_r_pi_tool`, 618 CNs):
> LOADING CHUTE top-2 79% → 96%. Re-run check: `api/engineer/mtc/db_migrations/20260610_validate_ks400b1.js`.

---

### KS-400B1 PLUG A 4664-06

### Type Classification
* **TYPE 1:** SD <= 8.5
* **TYPE 2:** 8.5 < SD and ID <= 11.4
* **TYPE 3:** 8.5 < SD and 11.4 < ID

### Parameter Definitions
* **ID:** Inner Diameter (MIN)
* **W:** Width (MIN)
* **SD:** Shoulder Diameter (Nominal)

### Calculation Formulas
* **A:**
  * For ID < 20: ID x 0.7
  * For 20 <= ID: ID - 4.0
* **B:** SD - 0.5 *(0.3 ~ 0.5 Allowable)*
* **C:**
  * For W <= 5: 6 ~ 8
  * For 5 < W <= 20: W x 0.9
* **D:**
  * For ID < 4: 0.5
  * For 4 <= ID: 1
* **E:**
  * **TYPE 1, 3:** A / 2
  * **TYPE 2:** 4
* **F:** 48

---

### KS-400B1 PLUG B 4664-07

### Type Classification
* **TYPE 1:** SD <= 8.5
* **TYPE 2:** 8.5 < SD and ID <= 11.4
* **TYPE 3:** 8.5 < SD and 11.4 < ID

### Parameter Definitions
* **ID:** Inner Diameter (MIN)
* **W:** Width (MIN)
* **SD:** Shoulder Diameter (Nominal)

### Calculation Formulas
* **A:**
  * For ID < 20: ID - 0.7
  * For 20 <= ID: ID - 1.0
* **B:** SD - 0.5 *(0.3 ~ 0.5 Allowable)*
* **C:**
  * For W <= 5: 6 ~ 8
  * For 5 < W <= 20: W x 0.9
* **D:**
  * For ID < 4: 0.5
  * For 4 <= ID: 1
* **E:**
  * **TYPE 1, 3:** A / 2
  * **TYPE 2:** 4
* **F:** 70

---

### KS-400B1 SUPPORT BLOCK 4664-03

### Parameter Definitions
* **OD:** Turning OD / Workpiece Cutting Outer Diameter (MAX)
* **W:** After Grind Width (MAX)

### Calculation Formulas
* **A:** 20 + (OD/2 - OD/6)
* **B:** W + 0.3
* **C:** OD - OD/6
* **D:** 30 - OD/2
* **E:** 30 + OD/4

### Component Relationships
* SUPPORT BLOCK Part Number: (4664-03-XXXX)
* LOADING CHUTE Part Number: (4664-02-XXXX)
* **Note:** The last 4 digits XXXX are basically the same.

---

### KS-400B1 WORK DRIVER 4664-01

### Machine Limit
* **W:** 30 MAX
* **OD:** DIA 32 MAX
* **Note:** Connecting R is not possible (No radius/fillet allowed at the joint)

### Type Classification
* **TYPE 1:** SD < DIA 19.5
* **TYPE 2:** DIA 19.5 <= SD

### Parameter Definitions
* **SD:** Shoulder Diameter (Nominal)
* **ID:** (Nominal)

### Calculation Formulas
* **A:** SD - 0.5 *(Round up 0.5 jump)*
* **B:** ID - 0.8 *(Round Down 0.5 jump)*
* **C:**
  * For A < 13: 32
  * For 13 <= A: 36
* **D:**
  * For SD < 13.5: 24
  * For 13.5 <= SD: 30
* **E:**
  * For KS-400B1, B2, B3: 23
  * For KS-400B4: 24
* **F:**
  * For KS-400B1, B2, B3: 8
  * For KS-400B4: 10

### KS400B PILOT PIN 4931-03

### Parameter Definitions
* **ID:** Workpiece Inner Diameter (Before Grind, MIN)
* **W:** Workpiece Width (After Grind, Nominal)

### Type Classification
* **TYPE 1:** ID < 5
* **TYPE 2:** 5 <= ID < 10
* **TYPE 3:** 10 <= ID < 31

### Calculation Formulas
* **A:** ID - 1
* **B:** W + 3.5
* **C:**
  * **TYPE 1:** ID - 1
  * **TYPE 2:** ID - 1.5
  * **TYPE 3:** ID - 2
* **D:**
  * **TYPE 1, 2:** W
  * **TYPE 3:** None
* **E:**
  * **TYPE 1:** 6
  * **TYPE 2:** 9
  * **TYPE 3:** None
* **F:** B + 5

---

## KS-400B5 (Spherical Grind / 球研)

> Source: `20241223_TOOLING LIST_KS-400B5.xlsx`. Seeded by
> `api/engineer/mtc/db_migrations/20260610_seed_ks400b5_tooling_select.js` (machine id 10,
> inventory `tooling_ks400b5`). The B5 machine type already exists in
> `sds_machine_type_code` (code 906, `machine_type_name='KS-400B5'`, no group) —
> the T-Select `machine_name` matches it exactly, so SDS PDF resolution works
> with no rename.

### Workpiece dimension columns (DIMENSION sheet → spec var)

The part is **turned first, then spherically ground**. Two dimension blocks:

| Block | DIMENSION cols | Meaning | Spec var |
|---|---|---|---|
| GRIND (研磨) | G/J/M (+tol H,I / K,L / N,O) | after-grind ID / OD / W (final) | `ID` / `OD` / `W` (= id_aft/od_aft/w_aft) |
| TURNING (切削) | S/V/Y (+tol) | before-grind / turned-blank ID / OD / W | `idBf` / `odBf` / `wBf` |
| 判別式 / 肩径 | P,R (grind) · AB,AD (turning) | shoulder dia (geometric or shoulder-ref for Y-ball) | `SD` |
| 工程 (F) | `球→内` = OD->ID (`isODtoID`) · `内→球` = ID->OD (`isIDtoOD`) | grind order | process flags |

`*_max`/`*_min` context vars are absolute bounds (nominal + signed tol delta).

### Inventory: ONE table, ten tooling types

All ten tooling types share `tooling_ks400b5` keyed by `tooling_name`. **Every
search rule MUST set `inventory_tooling_filter = <tooling_name>`** or the search
ranks across the whole table and returns a row from the wrong tooling type.

### Formulas (A,B,… = DWG dim labels → inventory `dim_a`,`dim_b`,…)

| Tooling (DWG) | Key | Formula | Inv col · match |
|---|---|---|---|
| **WORK CHUTE** 4906-03 | A | `odBf + 0.1` | dim_a ✓ |
| | B | `wBf + 0.1` | dim_b ✓ |
| | C | `odBf/2 + 27.55` | dim_c |
| | D | `if(wBf<20,30,37)` | dim_d |
| **WORK LOADER** 4906-04 (工事中) | A | `odBf + 0.1` | dim_a ✓ |
| | D | `wBf` | dim_d ✓ |
| **MASTER RING FOR JAW** 4906-12 | A | `(idBf_max+idBf_min)/2` | dim_a ✓ |
| | B | `(odBf_max+odBf_min)/2` | dim_b ✓ |
| | C | `W` | dim_c ✓ |
| **STOPPER** 4906-11 | A | `if(isIDtoOD, idAft_max, idBf_max) + 0.5` | dim_a ✓ |
| | B | `SD - 0.1` | dim_b |
| **CHUCK JAW** 4906-08 | A | `if(isIDtoOD, idAft_max, idBf_max) + 0.5` | dim_a ✓ |
| | B | `A - 0.8` | dim_b ✓ |
| | C | `36 + W*2/3` | dim_c |
| | D | `if(isIDtoOD, idAft_min, idBf_min) - 0.03` | dim_d |
| **WORK HOLDER** 4906-06 | A | `SD + 2` | dim_a ✓ |
| | B | `if(A<11.5,0, if(A<15,10, if(A<18.5,13, if(A<20.8,16, if(A<27.7,18, if(A<34.6,24,0))))))` | dim_b |
| **WORK CLAMP** 4906-01 | A | `SD` (tip dia A spans [ID+0.3 .. SD]) | dim_a ✓ |
| | W | `W` (work width — firm match) | dim_w ✓ |
| | B | `49 - W` (design rule B+W≈49) | dim_b |
| **SHAFT** 4906-02 | A | `SD - 0.5` (A spans [ID+0.3 .. SD−0.5]) | dim_a ✓ |
| | B | `if(W>12,10,8)` | dim_b |
| | C | `if(isIDtoOD, ID, idBf) - 0.5` | dim_c |
| **WORK CHUCK** 4906-05 | A | `if(OD<16,10.38, if(OD<20,12.12, if(OD<23,15.59, if(OD<33,17.32,19.05))))` | dim_a ✓ |
| | B | `if(OD<12,22.95, if(OD<16,20.15, if(OD<20,18.15, if(OD<23,16.65, if(OD<33,12.75,11.15)))))` | dim_b ✓ |
| | C | `if(OD<16,10, if(OD<20,12, if(OD<29,14, if(OD<33,18,16))))` | dim_c ✓ |

> **WORK CHUCK is a stepped lookup by after-grind OD (ball dia)**, not a
> continuous formula. dim_a collides across bands (0004=0005 share a=17.32;
> 0001≈0007 share a≈10.38), so A/B/C are each reconstructed as step functions of
> OD and matched together. 100% match on the answer key.

### Validation (against DIMENSION AE–AQ answer key, 58 CNs — `api/engineer/mtc/db_migrations/20260610_validate_ks400b5.js`)

Top-2 accuracy: WORK CHUCK 100%, SHAFT 93%, CHUCK JAW 88%, WORK CHUTE 86%,
WORK HOLDER 86%, WORK CLAMP 74%, MASTER RING 73%, WORK LOADER 68%.

**Needs SME / DWG review:**
- **WORK CHUTE GUIDE** 4906-09 (17%) — likely **retired** after a ~2016 DWG
  change (source comment); inventory mixes 4906-09 and 4906-15 families under one
  `tooling_name`, and it is selected by **pairing with the matched WORK CHUTE**
  (a suffix-link like B1's SUPPORT BLOCK↔LOADING CHUTE), not by a dimension match.
- **WORK LOADER** specials 0019–0033 ("Normal BALL") carry no computed dims and
  are picked by exact ball P/N — dimensional search cannot select them.
- **WORK CLAMP / SHAFT** tip dia A is a *range* [ID+0.3 .. SD]; encoded as a point
  target (SD / SD−0.5) with an asymmetric tol_minus. Carries a 現合 (manual fit at
  assembly) note in the source, so it is not fully deterministic.

---

## KS-500RD (Spherical Grind, large balls)

> Source: `IDE製作中_20180828_TOOLING LIST_KS-500RD(SPHERICAL GRIND).xlsx`
> (marked 製作中 / WIP). Seeded by
> `api/engineer/mtc/db_migrations/20260610_seed_ks500rd_tooling_select.js` (machine id 14,
> inventory `tooling_ks500rd`). Work envelope: ID φ14–38.125, OD φ26–59.531.
> Machine already exists in `sds_machine_type_code` (code 033, `KS-500RD`, no
> group) → T-Select `machine_name` matches; SDS resolves with no change.
>
> **Machine limit (fixed 2026-07-02, `api/engineer/mtc/db_migrations/20260702_fix_ks500rd_machine_limit.js`):**
> the live limit had drifted to the loose seed `OD 24–62` with **no ID limit**. Reset to the
> DIMENSION-sheet envelope (対応ワークサイズ A2–A4): **ID 14–38.125, OD 26–59.531**. The seed
> `LIMITS` array was corrected to match so a re-seed won't reintroduce the loose value.

### DIMENSION var map
GRIND (研磨) cols E/H/K/O = after-grind `ID`/`OD`/`W`/SD; TURNING (切削) cols
P/S/V/Z = before-grind. **`SD` = stored `sd`** (NOT geometric `sqrt(OD²−W²)` —
that breaks for Y-ball / wide parts where W>OD; reconstruction confirms stored SD).

### Inventory: 3 tooling types in one table `tooling_ks500rd` (dim_a..dim_h)
Every search rule sets `inventory_tooling_filter=<tooling_name>` (shared table).

| Tooling (DWG) | Key | Formula | Inv col · match |
|---|---|---|---|
| **WORK DRIVER** 4033-01 | A | `SD - 0.2` | dim_a ✓ |
| | B | `A - 7` (design: dim_a−dim_b=7) | dim_b |
| **LOADING PINTLE** 4033-02 | A | `round(ID - 1)` | dim_a ✓ |
| | B | `round(ID + 3)` | dim_b |
| | C | `if(wAft_max<=20, wAft_max*0.6, 12)` | dim_c |
| | D | `if(ID<=14.5,9, if(ID<=24.5,9.5,17.5))` | dim_d |
| | E | `if(ID<=24.5,5.5,11)` | dim_e |
| | F | `round(ID - 4.5, 1)` | dim_f |
| | G | `if(ID<=24.5,9,20)` | dim_g |
| | H | `round(ID - 0.8, 1)` | dim_h ✓ |
| **FRONT SHOE** 4033-03 | A | `if(OD<19,0, if(OD<21,19, if(OD<28,21, if(OD<37,28, if(OD<46,37,46)))))` | dim_a ✓ |

> **FRONT SHOE** inventory dim_a/dim_b are OD-band lower/upper bounds with very
> unequal widths (19,2,7,9,9,54), so a bounds-distance match is unsafe — instead
> compute the band lower bound (= inventory dim_b boundaries) and match dim_a
> exactly. If the band table changes, update this formula.

### Validation (`api/engineer/mtc/db_migrations/20260610_validate_ks500rd.js`)
No per-CN answer key in the source (`TOOLING LIST_旧` is a leftover KS-400B/4664
sheet, unrelated). Validated by **inventory reconstruction** over 28 spec CNs —
avg dim_a residual: FRONT SHOE 0.00, LOADING PINTLE 0.05, WORK DRIVER 0.14 → the
formulas faithfully reproduce real designed items. Example CN 350644 →
FRONT SHOE 0006, LOADING PINTLE 0010, WORK DRIVER 0017.

**Needs SME confirmation:** FRONT SHOE selection variable assumed to be after-grind
OD (source has no FRONT SHOE formula sheet, only the 6-band table). WORK DRIVER uses
stored SD; the WIP Excel's own cell used geometric SD (stale) — stored SD reconstructs
better, but confirm against current DWG.

---

## KS-400B6 (Spherical Grind) — REVERSE-ENGINEERED (source has no formulas)

> Source: `（計算式追加予定_山本）20240912_TOOLING LIST_KS-400B6.xlsx`.
> **「計算式追加予定」= formulas to be added later (by Yamamoto).** The file is a
> single `MASTER` sheet — a hand-curated per-P/N tooling lookup with **ZERO formula
> cells**. V1's `KS400B6_PARAMS` was deleted with V1. So these formulas are
> **reverse-engineered** from inventory dims + the MASTER assignment (used as an
> answer key) — not transcribed. Seeded by
> `api/engineer/mtc/db_migrations/20260610_seed_ks400b6_tooling_select.js` (machine id 15, inventory
> `tooling_ks400b6`). SDS: `sds_machine_type_code` already has 'KS-400B6' (code 931).

### MASTER input dims → spec var
OD (col C) = `odBf` · W (col F) = `w_aft` (`W`) · ID (col I) = `idBf`.
**id_bf is NULL for many ball CNs** → all ID formulas fall back to after-grind:
`if(idBf>0, idBf, idAft)` (same pattern as KS-400B1 WORK DRIVER).

### Formulas (9 tooling share `tooling_ks400b6`; every rule sets inventory_tooling_filter)

| Tooling (DWG) | Key | Formula | match |
|---|---|---|---|
| **PILOT PIN** 4931-03 (shared w/ B1–B3/B7) | A | `(if(idBf>0,idBf_min,idAft_min)) - 1` | dim_a ✓ |
| | B | `W + 3.5` (rank-only; breaks for wide parts) | dim_b ✓ |
| | D/E/F | `W` / stepped / `B+5` | — |
| **PLUG** 4931-06 | A | `(if(idBf>0,idBf_min,idAft_min)) - 1` | dim_a ✓ |
| | B | `W - 1.5` | dim_b ✓ |
| | C | `if(W*0.6<8, W*0.6, 8)` | — |
| **LOADING CHUTE** 4931-02 | C | `odBf + 0.15` | dim_c ✓ |
| | D | `W + 0.1` | dim_d ✓ |
| | B/E | `if(W<20,30,40)` / `if(idBf<7,10,20)` | — |
| **WORK GUIDE** 4931-09 | A | `round(W)` | dim_a ✓ |
| **WORK PUSHER** 4931-14 | A | `odBf * 0.55` | dim_a ✓ |
| **WORK DRIVER** 4931-01 | A | `(if(idBf>0,idBf,idAft)) - 0.4` | dim_a ✓ |
| **FRONT SHOE** 4931-11 | A | `if(isBallInner, odBf*0.32, W/2+2)` | dim_a ✓ |
| **REAR SHOE** 4931-12 | B | `if(isBallInner, odBf-0.5, W/2+2)` | dim_b ✓ |

### FRONT SHOE 4931-11 / REAR SHOE 4931-12 — AUTHORITATIVE DWG (SME-confirmed 2026-06-11)

OD = Workpiece OD before grind MAX (odBf_max); W = Workpiece Width after grind nominal (W).
**Two categories**, branched on `isBallInner` (= yball='Y' / ABR ball-insert):

| | Cat.1 Inner Ring w/ Balls Included (ボール入りインナー, isBallInner=1) | Cat.2 Standard Ball (通常ボール, isBallInner=0) |
|---|---|---|
| FRONT A | V (端面からの距離) | W/2 + 2 |
| FRONT B | if(OD<10, 8, 9) | if(OD<10, 8, 9) |
| FRONT C | 0.15 | 0.15 |
| FRONT D | round(31 − (10 − A − 1)) = round(A+22) | same |
| REAR A | X − 1.0 (端面からの距離1) | W/2 − 2 |
| REAR B | Y + 1.0 (端面からの距離2) | W/2 + 2 |
| REAR C | if(OD<10, 4, 5) | if(OD<10, 4, 5) |
| REAR D | angle: B<7.5 → 180°/30°; 7.5≤B<31 → None | same |

> **V, X, Y are per-part END-FACE DISTANCES — NOT in the spec and NOT derivable from OD/ID/W**
> (the DWG lists them as given inputs). So Cat.1 (ABR) A/B can't be auto-computed; the seed
> keeps the `odBf` proxy for that branch. **⚠ The DWG `Y` (end-face distance 2) ≠ the spec
> `Y` context var (= `groove_y`, the ABR groove width) — do not reuse `Y` in these formulas.**
> Only **A** (FRONT) / **B** (REAR) are match dims; B/C/D constants don't discriminate
> (dim_b=9, dim_c=0.15/5 are constant across inventory) so they're left as inventory display.
> Verified vs MASTER (26 rows, nearest-match): FRONT 23%→46%, REAR 58%→81% — all residual
> misses are Cat.1 (ABR) parts whose V/X/Y are absent. Cat.2 (WHT/standard ball) is exact.

**Path to full Cat.1 accuracy (manual, like `groove_y`):** add per-part columns V / X / Y to
`tooling_spec_process`, backfill for the ~14–21 ABR parts, expose in `buildSpecContext`
(renaming the DWG Y to avoid the groove_y clash), then branch FRONT A=V, REAR A=X−1, B=Yface+1.

### Validation (`api/engineer/mtc/db_migrations/20260610_validate_ks400b6.js`, vs MASTER answer key, 32 CNs)
WORK DRIVER 100%, LOADING CHUTE 100%, WORK PUSHER 100%, WORK GUIDE 94%, PLUG 88%,
PILOT PIN 84%. SHOES (now isBallInner-branched DWG): Cat.2 exact; Cat.1 proxy-limited.

**Needs SME / real formula (the 計算式 Yamamoto was to add):**
- **FRONT/REAR SHOE Cat.1 (ABR)** — needs per-part end-face distances V/X/Y (see manual path
  above). Cat.2 (standard ball) is now the real DWG formula and is exact.
- **PILOT PIN** remaining misses are out-of-inventory families (`4664-`/`4034-`,
  cross-machine pins) and a few large-part outliers where historical pin dia
  doesn't follow `idmin−1`.
- All B6 formulas are reverse-engineered approximations — confirm against DWGs
  before production use.

---

## PSG-64 (Surface Grinding, MSB races) — 2MSB-T series added; 3MSB/9MSB excluded

> Source: `MSB_SURFACE-GRINDING_TOOLING(20150213yamamoto).xlsx`. **Added 2026-06-10**
> (`api/engineer/mtc/db_migrations/20260610_seed_psg64_tooling_select.js`, machine id 19, inventory
> `tooling_psg64`). Validated 12/12 family match; SDS already covered it too.

### What the source is
Sheet1 is a **pure P/N → exact tooling-DWG lookup** with **0 formulas and 0 dimensions**:
`WORK FIXED BASE` · `COLLET` · `COLLET ARBOR` · `COLLAR` · `SPACER` · `ASSY`, each
`4547-01-XXXX-YY`, keyed by MSB race P/N. But the **factory `lpb.eng_race` dims** reveal the
work-fix-jig family is a clean **step-function of work bore ID** for the dimensioned 2MSB-T
parts — so it IS expressible as a dimensional formula for those.

### What was implemented (2MSB-T only)
- **Formula** (all 5 tooling types): `A = ID` (work bore = `id_aft`); rule `A → dim_a`
  closest-match (rank-only). Each `tooling_psg64` row = a tool family component with
  `dim_a` = the bore ID it serves.
- **Family selection (deterministic, validated 12/12 vs factory):**
  `ID<50 → 0036 · 52–56 → 0029 · 56–60 → 0030 · 60–70 → 0017 · ID≥70 → 0024`
- **18 dimensioned 2MSB-T parts** added to `tooling_spec_process` (id/od/w from factory).
- **Machine limit `ID ≥ 38`** scopes PSG-64 to large-bore races (balls/small races excluded;
  the big OD also gets every other machine limit-excluded → clean isolation, verified).

### NOT covered — 3MSB / 9MSB (categorical, no dims)
The P/N **series prefix** (`3…`→ 0031 for *all* sizes, `9…`→ 0037) is the primary driver and is
**not a dimension**; worse, those parts have **no dimensions in `eng_race`** at all. They can't
be dimension-driven and are excluded. SDS still serves them (below). If they're ever needed in
the tooling-select UI, that requires a P/N-family categorical lookup (a different mechanism).

### SDS — already complete (independent path, all PSG-64 parts)
- `sds_machine_type_code`: `PSG-64` (code 547, active).
- `sds_machine_tool`: `T1 → 4547-01` for `process_code 1101` (machine_type_id 86) — the PDF
  tool whitelist (prefix match per the DWG prefix-fallback rule).
- Factory process plan `lpb.eng_r_pi_tool` (process_code **1101**, 316 rows) holds the exact
  4547-01-* tools per C29 race control_no. SDS reads tooling from here.

→ PSG-64 setup-data-sheet tooling already resolves end-to-end. If PSG-64 tooling is ever wanted
in the Tooling Select UI, the correct design is a **P/N-family lookup** (categorical), not the
dimensional formula engine.

### Tool family map (base 4547-01-XXXX)
| Base | Parts | bore ID | in tooling-select |
|---|---|---|---|
| 0036 | 2MSB32-607 | ~42 | ✅ |
| 0029 | 2MSB40/41-60x | ~52–54 | ✅ |
| 0030 | 2MSB46, 2MSB48-605~607 | ~58 | ✅ |
| 0017 | 2MSB48-202/203 | ~61.5 | ✅ |
| 0024 | 2MSB70-201/202, 2MSB91-60x | ~90–113 | ✅ |
| 0031 | all 3MSB (40/41/45/46/48/70/91) | no eng_race dims | ❌ SDS only |
| 0037 | 9MSB32-607/608 | no eng_race dims | ❌ SDS only |

Components per family: BASE `-01` · COLLET `-05` (0024/0036 use `-02`) · ARBOR `-03` · COLLAR
`-04` · ASSY `-99` (0029/0024). Re-validate: `api/engineer/mtc/db_migrations/20260610_seed_psg64_tooling_select.js`.

---

## KL-20 (TRIM, bearing race/sleeve)

> Source: `20241204_TOOLING LIST_KL-20(TRIM).xlsx` (data → `db_migrations/kl20_data.json`).
> Added 2026-06-10 (`api/engineer/mtc/db_migrations/20260610_seed_kl20_tooling_select.js`, machine id 24,
> inventory `tooling_kl20`). SDS already has 'KL-20' (sds_machine_type_code 030).

### Selection model
KL-20 trims bearings with one of two collet types, chosen by **grip mode**:
- **4030-01_COLLET** (OD chuck / 外径把握) — races; matched by **trim OD**
- **4030-02_COLLET** (ID chuck / 内径把握) — sleeves & flange parts; matched by **trim ID**

The DIMENSION sheet's G (4030-01) / H (4030-02) columns are the per-CN answer key.
Grip mode ≈ flange flag (`F`→ID chuck, `N`→OD chuck) but 10 flange-`N` sleeves still
ID-grip, so the seeder uses the **master-list collet** to set grip mode when known, else
the flange flag. Stored in spec `type` ('N'=OD chuck, 'F'=ID chuck; was NULL).

### Trim dims ≠ finished dims
Trim OD/ID differ from `od_aft`/`id_aft` (flange parts' trim OD is the flange dia; some
races' `od_aft` is the bore-side OD). The Excel trim OD/ID are stored in `od_bf`/`id_bf`
(NULL/0 for these parts) and used by the formula.

### Formulas (grip gate via unmatchable sentinel, NOT condition_expr)
A skipped `condition_expr` leaves the output undefined → `searchInventory` drops the
tolerance filter and returns arbitrary rows. So the grip gate is embedded with a `-999`
sentinel that keeps the BETWEEN filter active (wrong-grip tooling → no match).

**Grip mode = explicit `type` OR (when blank) a deterministic CN-prefix rule** (2026-06-11).
`type` ('N'/'F') is a shared column a factory sync / Part-Management save can clobber to NULL —
which used to make BOTH formulas return -999 → **no match at all** (the 614033 symptom).
Fallback: when `type` is blank, derive grip from the CN class prefix (`cnPrefix`, added to
`buildSpecContext`), proven from the DIMENSION sheet (98.7% of 624 parts):
- OD-chuck (4030-01): classes **23/25/26/41/42/61/63**
- ID-chuck (4030-02): classes **62/64/69**

- 4030-01: `A = if(Type == "N" or (Type != "N" and Type != "F" and (cnPrefix==23 or …61 or 63)), odBf, -999)` → `dim_a` (grip OD, tol 0.5)
- 4030-02: `A = if(Type == "F" or (Type != "N" and Type != "F" and (cnPrefix==62 or 64 or 69)), idBf + 0.15, -999)` → `dim_a` (grip ID, tol 0.4; +0.15 = 2024 design rule)

`expr-eval` supports string equality (`Type == "F"`) and `or`/`and`/`!=`. Clobbered-type
(type=NULL) grip recovery: **0% → 95.2%** (4030-01 88/88, 4030-02 109/119; the 10 misses are
the **8 prefix exceptions** that need an explicit `type`: 620715, 634033, 644138/161/281/359/393,
414255). When `type` is set by the seeder (not clobbered) it is the ground truth and handles them.

> **614033 example:** class 61 → OD-chuck → **4030-01** (not 4030-02). Source DIMENSION C='N'
> confirms. "4030-02 not found" is correct behaviour for an N part.

### Inventory: dual grip dims for stepped OD collets
4030-01 stepped (1XXX-band) collets grip the part at **A2** (sheet col E), not **A1** (col C)
— e.g. collet 1010 has A1=27.19 but A2=20.83 = the part OD. So `tooling_kl20` stores **both
A1 and A2 as separate rows per 4030-01 collet** (same tooling_no), letting closest-match find
whichever grip dim fits. This took 4030-01 from 66% → 95%.

### Validation (`kl20_data.json` answer key, in-spec parts)
4030-01_COLLET 95% (88), 4030-02_COLLET 97% (119). Both share `tooling_kl20` →
inventory_tooling_filter set on every rule. ~144 KL-20 parts not yet in the spec table are
not searchable until spec-synced (seeder UPDATE-only, to avoid cross-machine spec noise).

---

## KVD-300CRII — FACE GRIND CARRIER (4036-01)

**Source:** `20251202_TOOLING LIST_KVD300CR2(FACE GRIND).xlsx`, CARRIER sheet rows 11–24.
**Seed:** `api/engineer/mtc/db_migrations/20260611_seed_kvd300cr2_tooling_select.js`
**Inventory table:** `tooling_kvd300cr2` (14 rows, all CARRIER type)
**Machine id:** 29 (machine limit: OD 9.5–46, W 6–29)

### Input variables

The KVD-300CRII grinds both faces of a blank that was previously turned. The CARRIER holds the **turned blank** (before width grind). Input comes from TURNING block columns in the DIMENSION sheet.

| Spec variable | Source | Meaning |
|---|---|---|
| `OD` = `if(odBf_max>0, odBf_max, odAft_max)` | TURNING: nominal + TOL(+) | Turned OD upper bound; od_aft fallback if no turning record |
| `W` = `if(wBf_max>0, wBf_max, wAft_max)` | TURNING: width nominal + TOL(+) | Turned width upper bound |

### Formulas — AUTHORITATIVE DWG (SME-confirmed 2026-06-11)

OD = Workpiece Outer Diameter MAX (ワーク外径MAX); W = Workpiece Width MAX (ワーク巾MAX).

| Key | DB expr | Meaning |
|---|---|---|
| **A** | `if(OD<=30, ceil05(OD+0.4), ceil05(OD+1))` | Pocket bore dia — **match dim** |
| B | `281 - A` | Reference (display only) |
| (C) | `A - 5` | Reference (A is 0.5-step → no rounding per DWG; was `round(A-5,1)`, identical) |
| **D** | `ceil05(W*0.8)` | Pocket width — **match dim** |
| H | `if(A<=40,"R0.5","R1")` | Corner R (TEXT column, display only) |
| J | `if(D<=2.5,"S45C-S55C",if(D<=12,"SS400","S45C-S55C"))` | Material — DWG says 別表参照 (separate table); this IF is that table, keyed by D |

**E (# pockets)** and **(G) (pocket depth)** are 現合 (match-machining / hand-fit at assembly)
— confirmed by SME, correctly omitted from the engine. E = basically a multiple of 4; (G)
basically satisfies 0.3×A ≤ G. **F = 360/E** depends on the 現合 E → also not computed.

### Search rules

| Output key | Column | tol_plus | tol_minus | is_match_dim |
|---|---|---|---|---|
| A | dim_a | 0.5 | 0.5 | true |
| D | dim_d | 0.5 | 0.5 | true |
| B | dim_b | null | null | false |
| C | dim_c | null | null | false |
| H | dim_h (TEXT) | null | null | false |
| J | dim_j (TEXT) | null | null | false |

H and J are TEXT columns — setting tol_plus/minus=null and is_match_dim=false prevents `::numeric` cast and keeps them out of ORDER BY distance ranking.

### Inventory notes

- Rows 0001–0010: **old standard** — A was calculated ad-hoc (OD+0.4 to OD+1.4); dim_a NOT at 0.5 boundaries.
- Rows 0011–0014: **new standard** (row 0013 marked "以降、新基準" 2025-12-05); A is at 0.5 boundaries per formula.
- Dump error corrected: 4036-01-0009 B dimension was shown as 25.15 in the raw dump; corrected to 251.5 (= 281 − 29.5).
- `inventory_tooling_filter` = null (single tooling type, no cross-tooling ranking issue).

### Validation

14/14 rows matched (100%): new-standard 9/9 (100%), old-standard 5/5. Test: for each row, implied OD = dim_a − 0.4 (A≤30 branch) or dim_a − 1.0 (A>30), implied W = dim_d / 0.8; then search within ±0.5 tolerance returns the correct row as top match.

---

## OC-16A — CENTERLESS GRINDING JIGS (4560-18, 4560-21)

**Source:** `20200212_TOOLING LIST_CENTERLESS-GRINDING-JIG.xlsx`
**Seed:** `api/engineer/mtc/db_migrations/20260611_seed_oc16a_tooling_select.js`
**Inventory table:** `tooling_oc16a` (shared: 77 RACE PUSHER + 218 SET PIN = 295 rows)
**Machine id:** 31 (machine limit: OD 3–85)

OC-16A is a **dimensional lookup** machine — no generative formula. Selection is driven by the finished work OD (RACE PUSHER) or work bore ID (SET PIN). Three other tooling types (COLLAR, PIN, ARBOR) are categorical/SDS-only with no dimension driver.

### RACE PUSHER (4560-18, 77 rows)

Pushes the work through the grinding gap. Pusher OD must be ≤ work OD − 1 (clears the
wheel). DWG dim labels: A=pusher OD (col E), B=ID (F), C=c'bore depth (G), D=notch depth
(H), E=inner chamfer (I), F=note (J), G=notch width (K), H=notch position (L).

**Authoritative DWG formula (confirmed by SME 2026-06-11):**

| Key | Formula | DB? | Match | Notes |
|---|---|---|---|---|
| **A** | `floor05(OD - 1)` (largest 0.5-step ≤ OD−1; OD=od_aft) | ✅ | dim_a, ±1.0 | selection dim |
| B | `floor(A - 3)` (integer ≤ A−3) | ✅ | dim_b, display | follows A |
| C | `(BW − SW)/2 + 0.5` — TYPE.1 (bar) only; TYPE.2 (pipe)/Race/Sleeve = None | ✗ | — | needs ball width BW & SPH race width SW |
| D | `round(A×0.3)` for 12≤A<40 (THAI/BOTH); `12` for A≥40; None for MTD & A<12; THAI & A<12 → round(A×0.3) | ✗ | — | needs **destination** (USE AREA: MTD/THAI/BOTH) — a design choice, not a workpiece prop |
| E | `0.5` (basic; widen to C-chamfer if B interferes with the hole) | ✗ | — | |
| F | TYPE.1: "2. BOTTOM CONFIGURATION OF C'BORE IS FREE"; TYPE.2: "2. FACE TURNING" + "3. ADD PROCESS TO PIPE …(MISUMI)" | ✗ | — | note text by material type |
| G | `12` if D≠None else None (notch width) | ✗ | — | gated by D |
| H | `25` if D≠None else None (notch position) | ✗ | — | gated by D |

**Material TYPE** (col D / DWG D): TYPE.1 = bar (バー材, use when pipe can't meet reqs);
TYPE.2 = pipe (パイプ材, prefer standard pipe sizes, extra OD machining allowed).

Only **A** drives selection (B is fully determined by A → display-only; C/D/F depend on
BW/SW/material-TYPE/destination which are not workpiece-spec variables → design-time).

> **Fix 2026-06-11:** was wrongly `A = OD` with asymmetric tol `[OD−1, OD]`, which let the
> pusher be ≈ work OD instead of ≤ OD−1. CN 614033 (OD=14.32) → old gave 4560-18-1010 (14);
> correct DWG `floor05(14.32−1)=13` → **4560-18-1009** (A=13, B=10). Verified e2e via
> `searchService.search('614033')`.

Deprecated row 4560-18-1011 excluded ("Do not use — Merged into -1032").

### SET PIN (4560-21, 218 rows)

Centerless **setting-gauge pin** — its diameter equals the **work OUTER diameter**
(the pin sets the regulating-wheel gap to the target dia). It is NOT a bore pin: the
pin dia is larger than the work bore. Drive by OD **before grind** (turned blank), with
od_aft fallback when od_bf is NULL.

| Key | Formula | Match column | tol_plus | tol_minus |
|---|---|---|---|---|
| A | `if(odBf>0, odBf, OD)`  (od_bf, else od_aft) | dim_a | 0.15 | 0.15 |

> **Fix 2026-06-11:** was wrongly `A = ID` (id_aft). CN 614033 (od_bf=14.47, id_aft=11.15)
> returned the wrong pin (~11.1) because the formula matched the bore; correct pin is
> **4560-21-0044** (dim_a=14.42), which tracks the OD. `odBf=14.47` → 0044 is the exact
> top match (`od_aft=14.32` ranks it #2, so od_bf is the right driver). Verified end-to-end
> through `searchService.search('614033')`.

Two deprecated entries excluded: 4560-21-0154 (note: "use 0015") and 4560-21-0163 (note: "使用禁止→0011を使用"). inventory_tooling_filter set on both rules (shared table).

### Needs-SME / Notes

- COLLAR / PIN / ARBOR: no clean dimension driver identified; remain SDS/categorical only.
- Centerless grinds OD → both RACE PUSHER and SET PIN are OD-driven. RACE PUSHER A =
  `floor05(OD−1)` (DWG-confirmed, OD=od_aft); SET PIN uses before-grind OD (`odBf`,
  od_aft fallback). Both A formulas now confirmed (DWG for pusher, factory CN for pin).
- **Validation caveat:** the original "295/295 100%" was a hollow self-match test (feed each
  inventory dim_a back, find the same row) — it cannot catch a *wrong input variable* (SET PIN
  was ID not OD; RACE PUSHER A was OD not floor05(OD−1)). Real correctness needs CN→tool
  answer keys: CN 614033 → RACE PUSHER 4560-18-1009 + SET PIN 4560-21-0044 (both verified).
  OD reference = od_aft (finished) — SME-confirmed 2026-06-11. Remaining design-time dims
  (C/D/F, depend on BW/SW/material-TYPE/destination) are not computed from workpiece spec.

---

## Mecha Part — Sleeve-Insertion Pin 4577-22 (ASSEMBLY JIG — no T-Select entry)

**Source:** handoff note `tmp_formula_study_handoff.md` section 3; original `4577-22-XXXX` tooling list.

### What it is

`4577-22-XXXX` = **スリーブ挿入ピン** (sleeve-insertion pin): a flanged pin used in an **assembly jig** (not grinding) to press sleeves/bushes into mecha sub-assembly parts. "Mecha parts" (メカパーツ) = assembly components such as sleeves, spherical bushes, inner/outer races(PB) — classes ~C95/C99 in the spec system.

### Geometry

| Dim | Meaning |
|---|---|
| B | Pin/shaft dia (軸径) — fits sleeve bore (clearance fit) |
| C | Flange dia — ≥ sleeve flange dia |
| D | Total length |
| E | Shaft length / flange thickness |
| **F = D − E** | The only formula (derivable) |

Purchased part encodes dims in the P/N: `SPGA-SK-H{flange}-L{len}-D{dia}-T{thick}`.

### Selection driver

Pin dia B ≈ sleeve bore ID + flange dia. The 適用型式 sheet maps each 4577-22 jig to specific mecha sleeves/bushes (by CN: `61AJF*`, `98BACB28*`, `MA-*`, `FSW-*`).

### Why it is SDS/categorical only

- Selection by bore ID + flange dia requires the spec to carry sleeve bore and flange dimensions, which the standard `od_aft`/`id_aft`/`w_aft` fields may not hold for mecha/assembly parts.
- F = D − E is the only derivable formula; all other dims are looked up from the P/N application table.
- Closest T-Select analogues: PSG-64 3MSB/9MSB (P/N-family categorical) or KL-20 (dimensional lookup). A dimensional entry would need SME confirmation that spec columns carry bore/flange.
- **Recommendation:** Do not seed into T-Select. SDS resolves this jig from the factory process plan. If dimensional T-Select is requested in the future: `A = sleeve_bore_ID` → match pin dia B; secondary dim C = flange dia.

---

## KN-312A / KN-312B — ARBOR-MOUNT OD GRIND (ARBOR 4828-01 + NUT 4828-02)

> Source: DWG spec (provided 2026-06-12). **✅ SEEDED into T-Select 2026-06-12**
> (`api/engineer/mtc/db_migrations/20260612_seed_kn312_tooling_select.js`, machines **KN-312A id 37 +
> KN-312B id 38**, shared inventory `tooling_kn312`). Machine also in SDS
> (`sds_machine_type_code` id 341 `KN-312A`, id 336 `KN-312B`; **id 332 `KN-312B,KN-312A`
> code 828 is a combined/duplicate entry — leave it, the FK matches on exact name so the
> new `tooling_machine.sds_machine_type_id` links cleanly: KN-312A→341, KN-312B→336**).
> Factory process_code = **1041** (OD→ID grind, 1119 rows). 4828 = イズミ arbor
> (Izumi). The part mounts on the ARBOR by its **bore (ID)**; the NUT clamps it; the OD
> is then ground. Same arbor/nut family serves both KN-312A and KN-312B.
>
> **Inventory is reverse-engineered** from the factory answer key (`lpb.eng_r_pi_tool`
> proc 1041 → CN → `tooling_spec_process`): each 4828-01/02 tool's dims = the median
> bore/W/OD of the CNs that use it (130 ARBOR + 101 NUT rows). **Validated vs the answer
> key** (a different CN with the same bore must re-select the factory tool — NOT a hollow
> self-match): **ARBOR 80.8% exact / 84.8% base, NUT 79.9%** (323/319 CNs). The residual
> ~15–20% are **revision-duplicates** (identical part dims, multiple tool numbers — e.g.
> 0025/0288, 0030/0259) that no dimensional formula can resolve. Re-seed/validate via the
> migration; the seed RE's inventory at runtime so it tracks new factory data.

### Input variables (workpiece → spec var)

| DWG input | Meaning | Spec var |
|---|---|---|
| **SD** | Shoulder Diameter (Nominal / 肩径) | `SD` |
| **ID** | Inner Diameter (**MIN** / 内径) — the locating bore the arbor enters | `idAft_min` *(confirm bf vs aft with SME)* |
| **W** | Width (Center / 巾) ≈ nominal | `W` (= `w_aft`) |

### ARBOR 4828-01 — formulas (A,B,… = DWG dim labels)

TYPE 1–4 variants exist in the factory (`4828-01-0000STD-TYPE1..4`) but the **TYPE
classification rule is NOT in the source** — must be obtained before the TYPE-branched
dims can be encoded.

| Key | DB expr (expr-eval) | condition_expr | TYPE? | Notes |
|---|---|---|---|---|
| **D2** | `SD - 0.5` | — | no | shoulder seat dia |
| **D3** | `idAft_min - 0.01` | — | no | **arbor fit dia = part bore − 0.01 → SELECTION/match dim** |
| D1 | `46` | `D2 < 45` | no | else None (D2≥45) |
| L3 | `if(SD <= 10, 10, 15)` | `SD <= 46` | no | else None (SD>46) |
| J | `"R1"` (text) | `D2 < 45` | no | display; else None |
| K | `"R3"` (text) | `D2 < 30` | no | display; else None |
| L1 | TYPE1,2 `ceil(W + 4)` · TYPE3,4 `ceil(W + 7)` | TYPE | **yes** | round up to integer |
| L2 | `15`–`20` (design pick) | — | no | range — not deterministic |
| L | `L1 + L2 + 50` | — | no | needs L1, L2 |
| D4 | `D3 - F*2` | TYPE2,3,4 | **yes** | TYPE1 None; needs F numeric |
| F | TYPE1 `1~2×15°` (chamfer) · TYPE2 `1.5` · TYPE3,4 `3` | TYPE | **yes** | radius/chamfer; feeds D4 |
| G | TYPE2 `3` · TYPE3,4 `6` | TYPE | **yes** | TYPE1 None |
| H | TYPE2 `4.5` · TYPE3,4 `7.5` | TYPE | **yes** | TYPE1 None |
| E | thread dia — **select** `E < D3`; M18+ pitch 2.0; M20+ in 10-steps; M5− no relief→indicate thread length | — | no | categorical (selected, not computed) |

### NUT 4828-02 — formulas (consumes ARBOR D2/D3/E)

`AD2 = ARBOR D2 = SD−0.5`, `AD3 = ARBOR D3 = idAft_min−0.01`, `AE = ARBOR E`. The NUT
threads onto the arbor, so it is computed **from the matched ARBOR** (a sequential
dependency like B1 SUPPORT BLOCK↔LOADING CHUTE; in T-Select either evaluate NUT after
ARBOR or fold the arbor algebra in, as below).

| Key | DB expr (folded to workpiece vars) | TYPE? | Notes |
|---|---|---|---|
| **B** | `SD - 0.5` (= AD2) | no | **SELECTION/match dim** (threads onto arbor D2) |
| **A** | `SD + 7.5` (= B + 8) | no | outer dia |
| **C** | `idAft_min + 0.09` (= AD3 + 0.1) | no | bore; accept +0.05~+0.2 |
| D | `= AE` (arbor thread dia) | no | categorical (mirror arbor E) |
| L1 | `15` | no | const |
| L2 | `10` (accept 5~12) | no | const |
| L | `25` (= L1 + 10; accept 10~12 added) | no | const |
| F | TYPE2 `(L - L1)/2` = `5` | **yes** | TYPE1 None |
| G | TYPE1 select ∈ {5.5,7,8,10,12,14,17,19} s.t. `B ≤ G < A−4` · TYPE2 `4-ø5 c'bore depth5, 90° apart` | **yes** | categorical |

### Selection model AS SEEDED (TYPE-independent)

Selection is purely dimensional, no TYPE rule needed — TYPE only affects display dims:
- **ARBOR**: primary match **D3** (`idAft_min − 0.01`, tol ±0.5) + secondary rank-only
  tie-breakers **P=W** (`dim_c`) and **Q=OD** (`dim_d`). Bore alone collides for 89/118
  arbors; W+OD break the ties → 52.9% → **80.8%**. D2 (`SD−0.5`) is display.
- **NUT**: primary match **C** (`idAft_min + 0.09`, tol ±0.5) + secondary **P=W** (`dim_d`)
  → 57.7% → **79.9%**. B (`SD−0.5`) and A (`SD+7.5`) are display.
- `inventory_tooling_filter` = 'ARBOR' / 'NUT' on every rule (shared `tooling_kn312`).

### TYPE 1–4 — DERIVED from the spec's own thresholds (display dims only)

The source has no separately-labelled "TYPE classification," but the boundaries are stated
implicitly in the deterministic dims and are reused for the TYPE-branched ones (so they are
**derived, not invented**):

| TYPE | Condition (DB expr) | from spec rule |
|---|---|---|
| TYPE1 | `SD ≤ 10` | L3 band1 (SD≤10→10); "M5↓ → no relief groove" (E constraint 3) |
| TYPE2 | `SD > 10` AND `D2 < 30` | K = R3 when D2<30 |
| TYPE3/4 | `D2 ≥ 30` | K = None when D2≥30 (TYPE3 & 4 share all values) |
| (TYPE4 edge) | `SD > 46` | L3=None, J=None, D1=None at SD>46 |

**Seeded as DISCRETE rows per TYPE branch** (one `tooling_formula` row per TYPE, gated by
`condition_expr` on the explicit `T` dim — FormulaService applies the first matching row per
`output_key`), mirroring the DWG's "TYPE 1: X / TYPE 2: Y / TYPE 3,4: Z" form:

| key | rows (condition → value) |
|---|---|
| `T` | `if(SD≤10,1, if(D2<30,2, if(SD≤46,3,4)))` — explicit TYPE 1/2/3/4 |
| `F` | `T==2 → 1.5` · `T>=3 → 3` (TYPE1 chamfer text → None) |
| `D4`| `T>=2 → D3 − F×2` (TYPE1 → None) |
| `G` | `T==2 → 3` · `T>=3 → 6` (TYPE1 → None) |
| `H` | `T==2 → 4.5` · `T>=3 → 7.5` (TYPE1 → None) |
| `L1`| `T<=2 → ceil(W+4)` · `T>=3 → ceil(W+7)` |
| `L3`| `SD≤10 → 10` · `SD≤46 → 15` (else None) |
| NUT `F` | `T==2 → (L−L1)/2` (NUT `T=if(B<30,1,2)`; TYPE1 → None) |

**These do NOT affect tool selection** (not match dims). Text forms (F "1~2×15°", J "R1",
K "R3", thread dia E) stay documented here, not computed. Verified across all bands on the 323
answer-key CNs (TYPE spread 1:19 / 2:209 / 3:74 / 4:21): e.g. SD=9 →T1 (F/D4/G/H None, L3=10);
D2≈40 →T3 (F=3, D4=D3−6, G=6, H=7.5, L3=15).

### Known limits / follow-up

- **Revision-duplicates** (~15–20%): identical part dims map to >1 tool number (0025/0288,
  0030/0259) — unresolvable dimensionally; factory picks by availability. Same class as
  KS-400B5 WORK CHUTE GUIDE / OC-16A duplicates.
- `-01`/`-02` sub-suffix = ARBOR + BLOCK of one unit (per `lpb.eng_tooling`). Base-number
  accuracy (treating them as one) is ARBOR 84.8%.
- The seed RE's inventory at runtime from the answer key, so re-running tracks new factory
  CNs. ~150 KN-312 CNs without spec rows aren't searchable until spec-synced.

---

## KS-H70 — SUPER SPHERE FINISH (COLLET 4691-19 + BODY 4691-18 + STOPPER 4691-02)

> Source: `Select_tool_backup/20210210_TOOLING LIST_SUPER SPHERE FINISH.xlsx`. **✅ SEEDED
> 2026-06-12** (`api/engineer/mtc/db_migrations/20260612_seed_ksh70_tooling_select.js`, machine id 47,
> inventory `tooling_ksh70`). SDS: `sds_machine_type_code` id 410 code 907 'KS-H70' →
> FK links cleanly. Factory process_code = **1241** (SPH SUPER FINISH).

The machine super-finishes a spherical ball **held by its bore (ID)** in a COLLET. Selection
is a **BAND LOOKUP on the workpiece ID** (sheet `COLEET&組合せ検索` rows 12-78) that cascades:

| Tooling | DWG | how chosen |
|---|---|---|
| **COLLET** | 4691-19-7xxx | the band `[OD MIN, OD MAX]` for the part ID (its grip-bore range) |
| **COLLET BODY** | 4691-18-8xxx | determined by the matched collet (table col E) |
| **STOPPER** | 4691-02-00xx | 1st stopper for the matched collet (col F) |

(The sheet's "OD MIN/MAX" columns are the collet's gripping-bore range = the part **ID**
range — the workbook formula matches `MASTER!G = ID`, not OD.)

### Implementation (lookup, no generative formula)

- Formula (all 3 toolings): **`A = ID`** (= `id_aft`). Search rule `A → dim_a`, **rank-only**
  (null tol) → the **closest band OD MIN** to the part ID. `inventory_tooling_filter` per
  tooling (shared `tooling_ksh70`).
- **Inventory restricted to the 21 factory-USED collets** (queried from `lpb.eng_r_pi_tool`
  1241 at seed time). The design table has 67 bands but only ~21 collets were ever made;
  matching against all 67 returns ideal-but-nonexistent collets. Each used band → one
  COLLET + BODY + STOPPER row (dim_a=OD MIN, dim_b=W, dim_c=midpoint, dim_d=OD MAX).
- **Match by OD MIN beat band-midpoint** — parts cluster at standard bore sizes (= band
  starts), and the factory assigns to the nearest available collet.

### Validation (vs factory answer key, process 1241, ~126 CNs)

COLLET **90.5%**, COLLET BODY **92.9%**, STOPPER **76.8%**. Canonical Excel example exact:
CN 310917 (ID=15.875) → COLLET 7204 / BODY 8200 / STOPPER 0005. Residual = collets/stoppers
the factory swapped for an adjacent size or a 2nd-stopper (col G) choice.

### Not yet modeled (other 4691 families on this machine — future work)

- **4691-01 GRINDING STONE HOLDER** + **4691-04 GRINDSTONE BASE** (~195 CNs each) — the
  grinding-wheel-side tooling, likely OD-driven (sheets STONE HOLDER PART / AC&STOPPER).
- **4691-10 JOINT** (3 thread sizes M3/M4/M5 — categorical), **4691-03** alt COLLET (A)/(B)
  (many 使用禁止/retired), **4691-20**, **4691-08**. Add when their selection driver is confirmed.

---
