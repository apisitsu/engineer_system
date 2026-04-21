---
name: SDS V2 Module Progress
description: สถานะการพัฒนา SDS V2 — backend controllers, DB schema, PDF generation, Admin page, machine type split, PDF button fix
type: project
originSessionId: 3d42d5c3-b89d-4ebc-a7a7-0ec111e71300
---
SDS V2 module เสร็จ feature หลักทั้งหมดแล้ว รวม machine type split KS-400B1/B2/B7, grinding params migration, และ PDF button fix (2026-04-21)

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
  - Tab 1: Machine Types — list + inline edit `grinding_area_label` + `tool_code_filter`
  - Tab 2: Per-record Params — load by CN+machine, edit header fields + revision log (5 rows)
  - Tab 3: Images — upload tooling images (by tool_dwg_no) + grinding images (by cn_prefix)
- Route: `/eng/mtc_eng/sds-v2/admin` → SdsV2AdminPage
- Menu: "SDS v2 Admin" ใน MTC sidebar

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
// เดิม
const token = authHeader && authHeader.split(' ')[1];
// แก้เป็น
const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
```
Fallback รับ token จาก query param สำหรับ file-download endpoints

**2. `apps/ENG-Frontend/src/components/engineer/mtc_eng/sds/SdsV2Page.jsx` (handleGeneratePdf)**
```js
// เดิม: window.open(fullUrl, '_blank')
// แก้เป็น: anchor click — เปิดเป็น tab ใหม่เสมอ ไม่ถูก popup blocker block
const a = document.createElement('a');
a.href = fullUrl;
a.target = '_blank';
a.rel = 'noopener noreferrer';
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
```

Frontend ส่ง `token: localStorage.getItem('token')` เป็น query param อยู่แล้ว — ไม่ต้องแก้

---

## Key Files

| ไฟล์ | หน้าที่ |
|------|---------|
| `api/engineer/mtc/templates/sds_template.xlsx` | Excel template หลัก |
| `api/engineer/mtc/controllers/sdsV2PdfController.js` | Generate PDF |
| `api/engineer/mtc/controllers/sdsV2AdminController.js` | Admin CRUD API |
| `middleware/auth.js` | JWT verify — รับ token จาก header หรือ query param |
| `src/components/engineer/mtc_eng/sds/SdsV2Page.jsx` | Search page + PDF modal |
| `src/components/engineer/mtc_eng/sds/SdsV2AdminPage.jsx` | Admin page |

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
- **แก้โดย:** ต้องเปิด `sds_template.xlsx` แล้ว format ช่วง A16:I55 ด้วยมือ (เพิ่ม border, background สำหรับ header rows)
- **ข้อควรระวัง:** อย่าแก้ผ่าน ExcelJS — border ที่ ExcelJS เขียนทำให้ template อื่น error

### 2. Manual Tasks หลัง Migration
1. ทดสอบ PDF กับ CN จริง (ลบ cache ใน `output/sds-pdf/` ก่อน)
2. Upload grinding/tooling images ผ่าน Admin (Tab 3)
3. Set `grinding_area_label` ต่อ machine type ที่ไม่ใช่ default (Tab 1)
4. ตรวจสอบ KS-400B7 PDF ว่า tool_dwg_no prefix '664' ทำงานถูกต้อง
