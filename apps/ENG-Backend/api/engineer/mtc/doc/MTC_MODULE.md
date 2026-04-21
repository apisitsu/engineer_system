# MTC Module — SDS V2 Progress

## สถานะล่าสุด: 2026-04-18

---

## สิ่งที่ทำเสร็จแล้ว ✅

### 1. Fix 404 — `/api/sds/counts`
- `sdsController.js` ถูก mount ใน `server.js` แล้ว (`app.use('/api/sds', sdsController)`)
- `sdsV2Controller.js` ถูก mount แล้วเช่นกัน (`app.use('/api/sds/v2', sdsV2Controller)`)

### 2. Database Schema (Migration Files)

| File | Tables |
|------|--------|
| `db_migrations/sds_v2_core_tables.up.sql` | `sds_machine_type_code`, `sds_excel_mapping`, `sds_parameter` |
| `db_migrations/sds_v2_images_and_template.up.sql` | `sds_v2_template_config`, `sds_v2_tooling_image`, `sds_v2_grinding_image` |
| `db_migrations/sds_v2_core_tables.down.sql` | DROP ย้อนกลับ |
| `db_migrations/sds_v2_images_and_template.down.sql` | DROP ย้อนกลับ |

**หมายเหตุ migration:** ยังไม่ได้ run กับ DB จริง

### 3. Constants (`mtcConstants.js`)
เพิ่ม table constants ใหม่:
```
SDS_MACHINE_TYPE_CODE, SDS_EXCEL_MAPPING, SDS_PARAMETER,
SDS_V2_TOOLING_IMAGE, SDS_V2_GRINDING_IMAGE
```

### 4. Backend Controllers / Services (ทั้งหมดสร้างใหม่)

| File | Mount Path | หน้าที่ |
|------|-----------|---------|
| `instance/maq_db.js` | — | Shared maqPool instance |
| `services/sdsV2SearchService.js` | — | searchByCn() function |
| `controllers/sdsV2Controller.js` | `/api/sds/v2` | Search (refactored ใช้ service) |
| `controllers/sdsV2ImageController.js` | `/api/sds/v2/images` | CRUD tooling + grinding images |
| `controllers/sdsV2AdminController.js` | `/api/sds/v2/admin` | Admin CRUD: mappings, parameters, machine-types |
| `controllers/sdsV2PdfController.js` | `/api/sds/v2` | Generate PDF (ExcelJS → LibreOffice) |

### 5. API Endpoints ที่พร้อมใช้งาน

**Search:**
- `GET /api/sds/v2/search?cn=C31-01234`

**Images:**
- `GET  /api/sds/v2/images/tooling` — list metadata
- `GET  /api/sds/v2/images/tooling/:tool_dwg_no` — serve binary
- `POST /api/sds/v2/images/tooling` — upload (multipart field: `image`, body: `tool_dwg_no`)
- `DELETE /api/sds/v2/images/tooling/:tool_dwg_no`
- `GET  /api/sds/v2/images/grinding` — list metadata
- `GET  /api/sds/v2/images/grinding/:cn_prefix?process_code=` — serve binary
- `POST /api/sds/v2/images/grinding` — upload (fields: `cn_prefix`, `label`, optional `process_code`)
- `DELETE /api/sds/v2/images/grinding/:id`

**Admin:**
- `GET /api/sds/v2/admin/machine-types?search=`
- `PUT /api/sds/v2/admin/machine-types/:id` — แก้ไข grinding_area_label
- `GET /api/sds/v2/admin/mappings?machine_type_name=`
- `POST/PUT/DELETE /api/sds/v2/admin/mappings[/:id]`
- `GET /api/sds/v2/admin/parameters?cn=&machine_type_name=`
- `PUT /api/sds/v2/admin/parameters` — upsert single
- `PUT /api/sds/v2/admin/parameters/bulk` — upsert หลายตัวพร้อมกัน
- `DELETE /api/sds/v2/admin/parameters/:id`

**PDF:**
- `GET /api/sds/v2/pdf?cn=C31-01234&machine_type_name=KS-B22G&process_code=IDG001`
- `DELETE /api/sds/v2/pdf/cache?cn=&machine_type_name=` — clear cache

---

## สิ่งที่ยังไม่ได้ทำ ❌

### Priority 1 — ต้องทำก่อนใช้งานได้
1. **Run DB Migrations** (ต้องทำด้วยตัวเอง):
   ```bash
   # ใน psql หรือ DBeaver เปิด eng_system DB แล้วรัน:
   db_migrations/sds_v2_core_tables.up.sql
   db_migrations/sds_v2_images_and_template.up.sql
   ```
2. **Seed machine type codes** (ต้องทำด้วยตัวเอง):
   ```bash
   node apps/ENG-Backend/db_migrations/seed_machine_type_code.js
   ```
3. **ตั้งค่า `grinding_area_label`** per machine type เช่น:
   ```sql
   UPDATE sds_machine_type_code SET grinding_area_label = 'ID GRINDING AREA' WHERE machine_type_name = 'KS-B22G';
   UPDATE sds_machine_type_code SET grinding_area_label = 'FACE GRINDING AREA' WHERE machine_type_name LIKE '%TSG%';
   ```

### Priority 2 — Frontend
4. **`SdsV2Page.jsx`** — หน้าหลัก SDS V2
   - Search box (input CN)
   - ตารางผลลัพธ์แสดง: CN, Parts No, Process Code, Machine Type
   - ปุ่ม PDF (เปิด PDF viewer)
   - ปุ่ม Edit (เปิด modal แก้ไข sds_parameter)
5. **Admin Form** — จัดการ sds_parameter
   - Tab 1: Machine Config (cn=NULL) — แก้ไข A16:I55 labels/units per machine type
   - Tab 2: Per-Record Data — program_no, program_name, sds_rev, change log (5 rows)
   - Tab 3: Image Management — upload tooling images + grinding images
6. **Register route** ใน `App.jsx` + เพิ่ม menu sidebar

### Priority 3 — Fine-tuning
7. **ตรวจสอบ cell addresses** ใน `IMAGE_EXTENTS` ใน `sdsV2PdfController.js` ว่าตรงกับ template จริง
8. **`sds_v2_template_config`** table — ยังไม่ได้ใช้งาน (overlap กับ `sds_excel_mapping`) ควรตัดสินใจว่าจะ deprecate หรือ merge
9. **Seed Excel Mapping** — ตรวจสอบว่า `sds_v2_core_tables.up.sql` INSERT ถูกต้องกับ cell addresses ใน `sds_template.xlsx` จริง

---

## Design Decisions ที่ตัดสินใจแล้ว

| หัวข้อ | การตัดสินใจ |
|--------|-------------|
| Excel Template | ใช้ไฟล์เดียว `sds_template.xlsx` (ไม่มี multi-template) |
| PDF Generator | LibreOffice (Portable) — ไม่เปลี่ยนก่อน |
| Cell colors in template | RED=Search API, BLUE=sds_parameter, GREEN=stamps (TODO), WHITE/BLACK=static |
| A16:I55 section | เก็บใน `sds_parameter` cn=NULL (machine-type config) |
| Image storage | BYTEA ใน PostgreSQL (ไม่ใช้ filesystem) |
| `sds_parameter` dual-role | cn=NULL → machine config, cn=specific → per-record data |
| UNIQUE constraint ที่มี NULL | COALESCE(cn, '__machine_config__') |
| Grinding image lookup | cn_prefix (2 chars) + optional process_code fallback |

---

## โครงสร้างไฟล์ที่เกี่ยวข้อง

```
apps/ENG-Backend/
├── instance/
│   ├── eng_db.js          — engPool (eng_system local DB)
│   ├── instance.js        — rodpcPool (rodpc schema)
│   └── maq_db.js          — maqPool (lpb schema) ← ใหม่
├── api/engineer/mtc/
│   ├── mtcConstants.js    — table name constants
│   ├── controllers/
│   │   ├── sdsController.js          — old SDS (setup_sheet)
│   │   ├── sdsV2Controller.js        — /api/sds/v2/search
│   │   ├── sdsV2ImageController.js   — /api/sds/v2/images ← ใหม่
│   │   ├── sdsV2AdminController.js   — /api/sds/v2/admin ← ใหม่
│   │   └── sdsV2PdfController.js     — /api/sds/v2/pdf   ← ใหม่
│   ├── services/
│   │   └── sdsV2SearchService.js     — searchByCn() ← ใหม่
│   └── templates/
│       ├── sds_template.xlsx         — template หลัก
│       └── machine_type_code.xlsx    — 446 machine codes
├── db_migrations/
│   ├── sds_v2_core_tables.up.sql
│   ├── sds_v2_core_tables.down.sql
│   ├── sds_v2_images_and_template.up.sql
│   ├── sds_v2_images_and_template.down.sql
│   └── seed_machine_type_code.js
└── server.js
```
