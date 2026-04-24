---
name: EngineerSystem — Overall Project Status
description: ภาพรวมสถานะโปรเจค ปัญหาที่แก้แล้วและที่ยังค้างอยู่ทุก module
type: project
originSessionId: 3d42d5c3-b89d-4ebc-a7a7-0ec111e71300
---
## โปรเจค Overview
EngineerSystem = monorepo: `ENG-Frontend` (React/Ant Design) + `ENG-Backend` (Node.js/Express/PostgreSQL)
Branch ปัจจุบัน: `mtc` (งาน MTC engineer tools)

---

## ✅ แก้ไขแล้ว (2026-04-20/21/22)

### SDS V2 — PDF Button
| ปัญหา | สาเหตุ | Fix |
|-------|--------|-----|
| กดปุ่ม PDF ได้ JSON แทน PDF | `auth.js` อ่าน token จาก header เท่านั้น, `window.open` ไม่ส่ง header | `auth.js:41` เพิ่ม `|| req.query.token` fallback |
| PDF เปิดเป็น popup window แทน tab | `window.open()` | เปลี่ยนเป็น anchor click (`a.target = '_blank'`) |

### Tooling Select — Formula Migration SQL
| ปัญหา | สาเหตุ | Fix |
|-------|--------|-----|
| `SQL Error [42601]` ใน pgAdmin | Non-ASCII chars (`—`, `→`) ใน SQL comments | แทนด้วย `-`, `->` (ASCII) ทุก 6 ไฟล์ |
| Formula `&&` ใช้ไม่ได้ | expr-eval 2.0.2 ไม่ support `&&` | เปลี่ยนเป็น `and` |
| `round(x, N)` fail silently | expr-eval hardcodes round/ceil/floor เป็น 1-arg | Expand เป็น `round((x) * 10^N) / 10^N` (50 occurrences) |
| FormulaManager edit button ไม่ทำงาน | ไม่มี PUT endpoint | เพิ่ม `updateFormula` (PUT `/api/mtc/formulas/:id`) |

### SDS V2 — Machine Type Split
| ปัญหา | สาเหตุ | Fix |
|-------|--------|-----|
| KS-400B1/B2/B7 ต้องแยกกัน | code 664 เป็น record เดียว | แยกเป็น 3 records + เพิ่ม `tool_code_filter` column |

### SDS V2 — Gray Fill PDF
| ปัญหา | สาเหตุ | Fix |
|-------|--------|-----|
| Gray fill ไม่แสดงใน PDF | ExcelJS ต้องมีทั้ง `fgColor` + `bgColor` | เพิ่ม `bgColor` ใน `GRAY_FILL` constant |

### MTC Sidebar Restructure (2026-04-22)
- Sidebar เดิมไม่มีลำดับชัดเจน แก้เป็น 5 items + Admin config submenu:
  1. Home, 2. General DWG Request, 3. Tooling Inspection, 4. Tooling Select, 5. Setup Data Sheet v2
  - Admin config (submenu): Email config, Formula config, Machine template config
- `menu_sidebar.jsx` — ปรับ `mtc` export ให้ตรงกับโครงสร้างใหม่

### EmailConfigManager + FormulaManager Sidebar Fix (2026-04-22)
- `EmailConfigManager.jsx` — เพิ่ม `MenuTemplate type="MTC"` + outer Layout wrapper, `defaultSelectedKeys="admin-email"`
- `FormulaManager.jsx` — เพิ่ม `MenuTemplate type="MTC"` ใน outer component, `defaultSelectedKeys="admin-formula"`

### SDS V2 — Process Plan UX Improvements (2026-04-22)
- ลบ Batch column ออกจาก `processInfoCols`
- รวม Tooling เข้ากับ Process Plan เป็น expandable rows (Ant Design `Table expandable`)
- แถวที่มี Tooling กดลูกศรดู, แถวที่ไม่มีไม่แสดงลูกศร (`rowExpandable`)
- Dimension label: แปลงตัวอักษรแรกเป็นพิมพ์ใหญ่ (`charAt(0).toUpperCase()`)

### SDS V2 — Admin Machine Config Filter Nulls (2026-04-22)
- `SdsV2AdminPage.jsx` `MachineConfigTab.loadList`: `filter(m => m.is_active && m.machine_type_name)`
- PDF modal dropdown ก็ filter เหมือนกัน: `filter(m => m.is_active && m.machine_type_name)`
- PDF modal label แสดงเฉพาะ `machine_type_name` ไม่มี code prefix

### SDS V2 — Grinding Area Label Auto-derive (2026-04-22)
- ลบ `grinding_area_label` ออกจากฟอร์ม Admin (ไม่ต้อง manual กรอกอีก)
- `sdsV2PdfController.js`: regex `/^(.*?)\s*grind/i` จาก `process_name` → เช่น "Id grind" → "ID GRINDING AREA"
- Fallback: ถ้า process_name ไม่มี "grind" → query `grinding_area_label` จาก DB
- ลบ `grindingLabel`, `selectedMachineId` states + setters ใน SdsV2AdminPage

### SDS V2 — process_code Type Mismatch Bug Fix (2026-04-22)
- root cause: `req.query.process_code` เป็น string `"1021"` แต่ DB return number `1021`
- `find(r => r.process_code === process_code)` ใช้ strict `===` → fail → ใช้ process row ผิด → label ผิด
- Fix: `String(r.process_code) === String(process_code)` ทุก comparison ใน `sdsV2PdfController.js`

### Tooling Select — SQL Migration Run (2026-04-22)
- SQL files ทั้ง 6 รันใน DB แล้ว ✅

### ExcelHelpers Refactor (2026-04-22)
- แยก pure helper functions ออกมาเป็น `api/engineer/mtc/utils/excelHelpers.js`
- ทำให้ testable แยกจาก PDF controller

---

## ⏳ รอดำเนินการ (Pending)

### SDS V2 — Template Border (Manual Task)
- `sds_template.xlsx` ช่วง A16:I55 ไม่มี border → ต้อง manual Excel edit (รูปแบบไว้แล้ว รอ apply)
- **ห้ามแก้ผ่าน ExcelJS** — เคยทำแล้วพัง template อื่น

### SDS V2 — Manual Post-Migration Tasks
1. Test PDF กับ CN จริง (ลบ cache `output/sds-pdf/` ก่อน)
2. Upload grinding/tooling images ผ่าน Admin (Tab 3)
3. ตรวจสอบ KS-400B7 PDF ว่า tool_dwg_no prefix '664' ถูกต้อง

### Test Infrastructure — jest/supertest
- ไฟล์ test สร้างไว้พร้อมแล้วใน `apps/ENG-Backend/tests/mtc/`:
  - `formulaService.test.js` — 12 cases (validateFormula, calculateMachineParams)
  - `sdsV2Helpers.test.js` — 20 cases (colLetterToIndex, cellAddressToRC, cellAddressTo0Based)
  - `adminConfig.test.js` — Formula CRUD, machine-type CRUD, email config
- รอ `npm install --save-dev jest supertest` (ติด proxy auth — ทำเมื่อพร้อม)

---

## Modules ที่ Active

| Module | สถานะ | หมายเหตุ |
|--------|--------|----------|
| SDS V2 | ✅ Feature complete | รอ manual tasks + template border |
| Tooling Select | ✅ SQL migration รันแล้ว | ทดสอบ formula calc ได้เลย |
| FormulaManager | ✅ ทำงานได้ | มี sidebar link แล้ว (Admin config > Formula config) |
| EmailConfigManager | ✅ ทำงานได้ | มี sidebar link แล้ว (Admin config > Email config) |
| ECR (Engineering Change Request) | ✅ | ไม่ได้แตะ session นี้ |
