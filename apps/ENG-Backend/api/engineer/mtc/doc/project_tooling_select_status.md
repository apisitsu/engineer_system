---
name: Tooling Select — Formula Migration Status
description: สถานะการ migrate ทุกเครื่องจาก hardcoded JS calc -> DB-driven dynamic formulas + bug fixes รวม SQL fixes
type: project
originSessionId: 3d42d5c3-b89d-4ebc-a7a7-0ec111e71300
---
## Bug Fixes เสร็จแล้ว (2026-04-20/21)

### FormulaService.js
- `round/ceil/floor` แก้ให้รับ 2 args: `round(x, n)` → decimal places
- `hasFormulaError` flag: ถ้า formula ใดๆ fail → return `{ error: '...' }` ทันที (เดิม return partial)

### formulaController.js + server.js
- เพิ่ม `updateFormula` (PUT `/api/mtc/formulas/:id`) — FormulaManager edit button ทำงานได้แล้ว

### toolingSelectController.js
- `res.status(404)` → `res.status(400)` สำหรับ user error

---

## SQL File Fixes (2026-04-21) — รันใน DB แล้ว ✅

### Bug 1: `&&` operator ไม่ support ใน expr-eval 2.0.2
- `&&` → `and` (ใน `migrate_calc_common_formulas.sql` สูตร baseC)
- expr-eval 2.0.2 ใช้ `and`/`or` แทน `&&`/`||`

### Bug 2: 2-argument round/ceil/floor ไม่ทำงาน
- expr-eval hardcodes `round`, `ceil`, `floor` เป็น **unary operator** ใน grammar
- `round(x, 2)` → `parse error: Expected )` แม้จะ override `parser.functions.round`
- Fix: expand ทุก 2-arg call → `round(x, N)` = `round((x) * 10^N) / 10^N`
- แก้ 50 occurrences ทั่วทุก 6 ไฟล์

### Bug 3: Non-ASCII characters ใน SQL comments ทำให้ pgAdmin error
- `—` (em dash U+2014) และ `→` (right arrow U+2192) ใน comments
- pgAdmin parser อ่าน boundary ผิด → `syntax error at or near "'CALC_COMMON'"`
- Fix: แทนด้วย `-` และ `->` (ASCII)

---

## Migration Status: ✅ SQL รันใน DB แล้วทั้งหมด (2026-04-22)

### สถาปัตยกรรม: Hybrid (JS base + DB patch)
- JS legacy calc เรียกทุกครั้งเป็น base (handles limit checks, provides complete structure)
- DB formulas PATCH values ทับ base → "adapter pattern"

### Pre-computed flags ที่เพิ่มใน partData (fixtureLogic.js)
```js
partData.sdCalc           = calculateSD(partData) || 0;
partData.isYBall          = partData.yBall === 'Y' ? 1 : 0;
partData.isBallInner      = (partData.type.includes('ABR') || partData.type.includes('BALL_INNER')) ? 1 : 0;
partData.isABR            = (partData.type.includes('ABR') || partData.yBall === 'Y' || partData.yBall === 'B') ? 1 : 0;
partData.isInner          = (partData.type.includes('INNER') || partData.yBall === 'Y') ? 1 : 0;
partData.isIDtoOD         = partData.process === 'ID->OD' ? 1 : 0;
partData.isNormalOrOther  = (partData.type.includes('NORMAL') || partData.type.includes('OTHER')) ? 1 : 0;
```

### SQL Files Status

| เครื่อง | SQL file | Adapter fn | สถานะ |
|---------|----------|-----------|-------|
| KSB22G / KSB80 / TSG300 | `migrate_calc_common_formulas.sql` | `adaptDynamicCalcCommon` | ✅ รันแล้ว |
| KS400B | `migrate_ks400b_formulas.sql` | `adaptDynamicKS400B` | ✅ รันแล้ว |
| KS500RD | `migrate_ks500rd_formulas.sql` | `adaptDynamicKS500RD` | ✅ รันแล้ว |
| KS400B5 | `migrate_ks400b5_formulas.sql` | `adaptDynamicKS400B5` | ✅ รันแล้ว |
| KS400B6 | `migrate_ks400b6_formulas.sql` | `adaptDynamicKS400B6` | ✅ รันแล้ว |
| KS03A | `migrate_ks03a_formulas.sql` | `adaptDynamicKS03A` | ✅ รันแล้ว |

---

## FormulaManager Sidebar (2026-04-22) ✅
- `FormulaManager.jsx` มี `MenuTemplate type="MTC"` แล้ว
- เข้าถึงได้จาก MTC sidebar: Admin config > Formula config
- `defaultSelectedKeys="admin-formula"` / `defaultOpenKeys="admin-config"`

---

## Test Infrastructure (2026-04-22)
- `apps/ENG-Backend/tests/mtc/formulaService.test.js` — 12 test cases:
  - `validateFormula` (pure): valid expr, 2-arg round pattern, `and` operator, invalid expr
  - `calculateMachineParams` (DB mock): result, DB error, empty formula list
- รอ `npm install --save-dev jest supertest` (ติด proxy auth)

---

## Verify Steps (ยังไม่ได้ทำ)
1. Test Tooling Select ด้วย C/N ที่รู้ค่าถูกต้อง — เปรียบเทียบผลก่อน/หลัง migration
2. แก้ formula strings ใน FormulaManager UI (`/eng/mtc/formulas`) ถ้าพบ discrepancy

---

## Key Files

| ไฟล์ | บทบาท |
|------|-------|
| `api/engineer/mtc/services/FormulaService.js` | evaluate DB formulas ด้วย expr-eval 2.0.2 |
| `api/engineer/mtc/services/fixtureLogic.js` | adapter functions + Promise.all calls |
| `api/engineer/mtc/services/calculationLogic.js` | legacy JS calc — base + limit checks |
| `api/engineer/mtc/services/searchFunctions.js` | consume `calc.*` properties |
| `src/components/engineer/mtc_eng/formula/FormulaManager.jsx` | UI จัดการ formula, Admin config submenu |
| `tests/mtc/formulaService.test.js` | Unit tests รอ jest install |

## expr-eval 2.0.2 Notes (สำคัญ)
- `&&` NOT supported → ใช้ `and`
- `||` works; `!` prefix works; `==` works; `^` power works
- `round/ceil/floor` = unary operator ใน grammar → 2-arg ไม่ support แม้ override functions
- Pattern สำหรับ N decimal: `round((x) * 10^N) / 10^N`
- Custom function names (เช่น `round2`) รับ multi-arg ได้
