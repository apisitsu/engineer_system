---
name: SDS V2 Module Progress
description: สถานะการพัฒนา SDS V2 — backend controllers, DB schema, PDF generation, Admin page, machine type split, PDF button fix, grinding label auto-derive
type: project
originSessionId: 3d42d5c3-b89d-4ebc-a7a7-0ec111e71300
---
SDS V2 module เสร็จ feature หลักทั้งหมดแล้ว รวม machine type split KS-400B1/B2/B7, grinding params migration, PDF button fix, และ grinding area label auto-derive (2026-04-22)

**Why:** SDS V2 ใช้ Excel template เดียว (sds_template.xlsx) fill ข้อมูลแล้วแปลงเป็น PDF ผ่าน LibreOffice

**How to apply:** งานที่เหลือคือ manual tasks — ดู "ปัญหาคงค้าง" ด้านล่าง

---

## สิ่งที่ทำเสร็จแล้ว (2026-04-20)

### Backend
- Migrations รันแล้ว: `sds_v2_core_tables.up.sql`, `sds_v2_images_and_template.up.sql`
- Seed: 446 machine type codes จาก machine_type_code.xlsx
- Controllers: sdsV2Controller, sdsV2ImageController, sdsV2AdminController, sdsV2PdfController
- server.js mounts: `/api/sds/v2`, `/api/sds/v2/images`, `/api/sds/v2/admin`

### Frontend
- `SdsV2Page.jsx` — Search + Header/Dimension/Process/Tooling + ปุ่ม PDF ต่อ process row → modal เลือก machine type
- `SdsV2AdminPage.jsx` — Admin 3 tabs:
  - Tab 1: Machine Types — list + inline edit `tool_code_filter` (ลบ `grinding_area_label` ออกจากฟอร์มแล้ว)
  - Tab 2: Per-record Params — load by CN+machine, edit header fields + revision log (5 rows)
  - Tab 3: Images — upload tooling images (by tool_dwg_no) + grinding images (by cn_prefix)
- Route: `/eng/mtc_eng/sds-v2/admin` → SdsV2AdminPage
- Menu: "Machine template config" ใน Admin config submenu

---

## สิ่งที่ทำเสร็จเพิ่ม (2026-04-20)

### Machine Type Split: KS-400B1 / KS-400B2 / KS-400B7
- แยก code 664 (เดิม `KS-400B,400B1,400B2`) → 3 records
- เพิ่ม column `tool_code_filter VARCHAR` ใน `sds_machine_type_code`
- `sdsV2PdfController.js`: query `tool_code_filter` แล้วใช้แทน `machine_type_code` เมื่อมีค่า

### KS-400B7 Data Migration
- ใช้ `spg_ks400b1.xlsx` template (เดียวกัน)
- รัน migration แล้ว: 275 CNs, 3025 rows ใน `sds_parameter`

### Gray Fill ใน PDF (LibreOffice)
- ExcelJS solid fill ต้องมีทั้ง `fgColor` และ `bgColor` ไม่งั้น LibreOffice ไม่ render

---

## สิ่งที่ทำเสร็จเพิ่ม (2026-04-21) — PDF Button Fix

### ปัญหา: กดปุ่ม PDF แล้วแสดง JSON แทนที่จะเป็น PDF
- **Root cause 1**: `middleware/auth.js:40-41` อ่าน token เฉพาะจาก `req.headers['authorization']` เท่านั้น
- `window.open(url, '_blank')` ไม่ส่ง Authorization header → auth middleware return `{ message: 'Token is required' }` as JSON (401)
- **Root cause 2**: `window.open` อาจเปิดเป็น popup window แทน tab ใน browser บางตัว

### Fix ที่ทำ
**1. `apps/ENG-Backend/middleware/auth.js` (line 41)**
```js
const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
```
**2. `apps/ENG-Frontend/.../sds/SdsV2Page.jsx` (handleGeneratePdf)**
```js
const a = document.createElement('a');
a.href = fullUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
```

---

## สิ่งที่ทำเสร็จเพิ่ม (2026-04-22) — UX + Bug Fixes

### Process Plan UX
- ลบ Batch column ออกจาก `processInfoCols`
- รวม Tooling เข้า Process Plan เป็น expandable rows:
  - `rowExpandable`: แสดงลูกศรเฉพาะ row ที่มี tooling (`toolingByCode[row.process_code]?.length > 0`)
  - `expandedRowRender`: Table ย่อย แสดง Rev, Tool DWG No, Tool Name
- Dimension label: `key.charAt(0).toUpperCase() + key.slice(1)`

### Admin Machine Config — Filter Nulls
- `SdsV2AdminPage.jsx` loadList: `filter(m => m.is_active && m.machine_type_name)`
- PDF modal dropdown: filter เหมือนกัน + label แสดง `machine_type_name` เท่านั้น (ไม่มี code prefix)

### Grinding Area Label Auto-derive
- ลบออกจาก Admin form ทั้งหมด (ไม่ต้อง manual set อีกต่อไป)
- `sdsV2PdfController.js` logic:
  ```js
  const grindMatch = (map['process_name'] || '').match(/^(.*?)\s*grind/i);
  if (grindMatch && grindMatch[1].trim()) {
    map['grinding_area_label'] = `${grindMatch[1].trim().toUpperCase()} GRINDING AREA`;
  } else {
    // fallback: query grinding_area_label from sds_machine_type_code
  }
  ```
- ตัวอย่าง: "Id grind" → "ID GRINDING AREA", "Face grind" → "FACE GRINDING AREA"

### process_code Type Mismatch Bug Fix
- **root cause**: `req.query.process_code` = string `"1021"`, DB return = number `1021`
- `===` strict comparison fail → `find` return wrong row → wrong `process_name` → regex no match → wrong label
- **Fix**: ใช้ `String(r.process_code) === String(process_code)` ทุกที่ใน `sdsV2PdfController.js`

### ExcelHelpers Refactor
- แยก pure functions → `api/engineer/mtc/utils/excelHelpers.js`:
  - `colLetterToIndex`, `cellAddressToRC`, `cellAddressTo0Based`
- `sdsV2Helpers.test.js` — 20 parametrized test cases รอ jest install

---

## Key Files

| ไฟล์ | หน้าที่ |
|------|---------|
| `api/engineer/mtc/templates/sds_template.xlsx` | Excel template หลัก |
| `api/engineer/mtc/controllers/sdsV2PdfController.js` | Generate PDF + grinding label auto-derive |
| `api/engineer/mtc/controllers/sdsV2AdminController.js` | Admin CRUD API |
| `api/engineer/mtc/utils/excelHelpers.js` | Pure helper functions (testable) |
| `middleware/auth.js` | JWT verify — รับ token จาก header หรือ query param |
| `src/components/engineer/mtc_eng/sds/SdsV2Page.jsx` | Search page + PDF modal + expandable process/tooling |
| `src/components/engineer/mtc_eng/sds/SdsV2AdminPage.jsx` | Admin page (Tab 1: no grinding_area_label field) |
| `tests/mtc/sdsV2Helpers.test.js` | Unit tests รอ jest install |

## API Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sds/v2/search?cn=` | GET | Search data |
| `/api/sds/v2/pdf?cn=&machine_type_name=&process_code=&token=` | GET | Generate PDF (token via query param) |
| `/api/sds/v2/admin/machine-types` | GET/PUT | Machine type CRUD |
| `/api/sds/v2/admin/parameters` | GET/PUT | Per-record params |
| `/api/sds/v2/images/tooling` | GET/POST/DELETE | Tooling images |
| `/api/sds/v2/images/grinding` | GET/POST/DELETE | Grinding images |

---

## ปัญหาคงค้าง

### 1. Template A16:I55 ไม่มี Border/Structure
- `sds_template.xlsx` — cells A16:I55 ไม่มี border → ค่าถูก write แต่มองไม่เห็นโครงสร้างใน PDF
- **แก้โดย:** ต้องเปิด `sds_template.xlsx` แล้ว format ช่วง A16:I55 ด้วยมือ
- **ข้อควรระวัง:** อย่าแก้ผ่าน ExcelJS — border ที่ ExcelJS เขียนทำให้ template อื่น error

### 2. Manual Tasks หลัง Migration
1. ทดสอบ PDF กับ CN จริง (ลบ cache ใน `output/sds-pdf/` ก่อน)
2. Upload grinding/tooling images ผ่าน Admin (Tab 3)
3. ตรวจสอบ KS-400B7 PDF ว่า tool_dwg_no prefix '664' ทำงานถูกต้อง
