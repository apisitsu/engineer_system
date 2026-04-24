# SDS v2 Common Template Plan

## เป้าหมาย
ใช้ไฟล์ Excel ไฟล์เดียว ชีทเดียว (common template) สำหรับออก SDS ทุกประเภท
โดย config cell dynamically ตาม CN, Process code, Machine type
และ embed PNG รูป tooling (ตาม tool_dwg_no) และ grinding area (ตาม CN prefix เช่น C31, C32)

---

## Phase 1 — Database Schema

### 1.1 เพิ่ม column ใน `template_excel_mapping`
```sql
ALTER TABLE template_excel_mapping
  ADD COLUMN data_source VARCHAR(50) DEFAULT 'param';
```
| data_source | ความหมาย |
|---|---|
| `param` | ค่าจาก `setup_parameter_value` (พฤติกรรมเดิม) |
| `sdsv2` | ค่าจาก SDS v2 field โดยตรง เช่น `dimension.od`, `cn`, `process_name` |

### 1.2 สร้างตาราง `template_image_config`
```sql
CREATE TABLE template_image_config (
  id           SERIAL PRIMARY KEY,
  template_id  INT REFERENCES template(id),
  image_type   VARCHAR(50),    -- 'tooling' | 'grinding_area'
  lookup_key   VARCHAR(100),   -- tool_dwg_no หรือ cn_prefix เช่น C31
  image_path   TEXT,           -- path ไฟล์ PNG เช่น images/tooling/KS03A.png
  anchor_cell  VARCHAR(20),    -- ตำแหน่งวางรูปใน sheet เช่น D15
  width_px     INT DEFAULT 200,
  height_px    INT DEFAULT 150
);
```

### 1.3 สร้างตาราง `template_image_store` (เก็บรูปจริง)
```sql
CREATE TABLE template_image_store (
  id          SERIAL PRIMARY KEY,
  image_type  VARCHAR(50),   -- 'tooling' | 'grinding_area'
  lookup_key  VARCHAR(100),  -- tool_dwg_no หรือ cn_prefix
  file_name   TEXT,
  mime_type   VARCHAR(50) DEFAULT 'image/png',
  data        BYTEA          -- binary PNG
);
```
> หรือเลือกเก็บเป็นไฟล์บน filesystem แล้วใช้ `image_path` ใน `template_image_config` อย่างเดียวก็ได้

---

## Phase 2 — Image Management API

Endpoints สำหรับ upload/manage รูป PNG:

```
POST   /api/sds/images/tooling        → upload PNG ตาม tool_dwg_no
POST   /api/sds/images/grinding-area  → upload PNG ตาม cn_prefix (C31, C32 ...)
GET    /api/sds/images/:type/:key     → ดูรูป
DELETE /api/sds/images/:id            → ลบรูป
```

---

## Phase 3 — SDS v2 Excel Generation

### Endpoint ใหม่ใน `sds_v2.js`
```
GET /api/sds/v2/export-pdf?cn=C31-0001&process_code=IDG&machine=KSB22G
```

### Flow การทำงาน
```
1. รับ cn, process_code, machine
        ↓
2. เรียก SDS v2 /search logic → ได้ข้อมูลครบ
   (dimension, tooling, process_plan, production, material)
        ↓
3. ดึง template จาก DB ตาม process_code + machine
        ↓
4. โหลด common Excel ไฟล์เดียว
        ↓
5. เติม text cells ← template_excel_mapping (data_source='sdsv2')
   resolve field:
     "dimension.od"  → dimensionResult.od
     "process_name"  → processName
     "cn"            → cnUpper
        ↓
6. embed PNG tooling
   ← หา tool_dwg_no จาก process_plan
   ← query template_image_config WHERE image_type='tooling' AND lookup_key=tool_dwg_no
   ← workbook.addImage() ตาม anchor_cell
        ↓
7. embed PNG grinding_area
   ← cn_prefix = cn.slice(0,3)  →  C31
   ← query template_image_config WHERE image_type='grinding_area' AND lookup_key='C31'
   ← workbook.addImage() ตาม anchor_cell
        ↓
8. writeFile → convert via LibreOffice → PDF
        ↓
9. sendFile PDF
```

### การ resolve `param_key` จาก SDS v2 data
ใช้ dot notation เข้าถึง nested field:
| param_key | ค่าที่ได้ |
|---|---|
| `cn` | control number |
| `process_name` | ชื่อ process |
| `dimension.od` | outer diameter |
| `dimension.id` | inner diameter |
| `production.model` | model |
| `production.customer` | customer |
| `material.material` | material name |

---

## Phase 4 — Template Config UI (Frontend)

หน้า admin `/sds/template-config`:
- จัดการ template (ชื่อ, ไฟล์ xlsx)
- จัดการ cell mapping (cell address, param_key, data_source)
- Upload PNG tooling ตาม tool_dwg_no
- Upload PNG grinding area ตาม CN prefix

---

## ลำดับการทำงาน

| Phase | งาน | ประมาณเวลา |
|---|---|---|
| 1 | DB Schema | 1 วัน |
| 2 | Image Management API | 1 วัน |
| 3 | Excel Generation (SDS v2) | 2-3 วัน |
| 4 | Template Config UI | 2 วัน |

---

## ประเด็นที่ต้องตัดสินใจ

| ประเด็น | ตัวเลือก |
|---|---|
| เก็บรูป PNG | DB (BYTEA) vs Filesystem |
| 1 CN มีหลาย tool_dwg_no | วางรูปซ้อน vs เรียงหลายช่อง |
| template lookup key | ต่อ process_code หรือต่อ machine หรือ combination |
| cache PDF invalidation | invalidate เมื่อรูปเปลี่ยน / data เปลี่ยน |

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|---|---|
| `sds_v2.js` | entry point หลัก — เพิ่ม `/export-pdf` |
| `sds.js` | Excel generation เดิม — ใช้เป็น reference |
| `mtcModel.js` | `getTemplateMapping()` — ยังใช้ได้ |
| `mtcConstants.js` | เพิ่ม table constants ใหม่ |
| `templates/` | เก็บ common xlsx file |
