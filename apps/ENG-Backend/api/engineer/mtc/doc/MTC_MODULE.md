# MTC Engineer Module Documentation

## Overview

MTC (Maintenance & Tooling Control) module จัดการข้อมูลด้านวิศวกรรมที่เกี่ยวกับ tooling, setup data sheet, และ DWG request workflow

**Base URL:** `http://localhost:2005`

**Authentication:** ทุก endpoint ใต้ `/api` ต้องใช้ JWT Token ยกเว้นที่ระบุไว้

---

## Sub-modules

| Sub-module | Base Path | ไฟล์ | คำอธิบาย |
|------------|-----------|------|----------|
| Tooling Inspection | `/api/tooling_inspect/*` | `eng_mtc_model.js` | ตรวจสอบ tooling, DWG request, dashboard |
| Tooling Selection | `/api/tooling-select/*` | `tooling_select.js` | เลือก tooling ตาม process/spec |
| SDS v1 | `/api/sds/*` | `sds.js` | Setup Data Sheet (engPool) |
| SDS v2 | `/api/sds/v2/*` | `sds_v2.js` | Setup Data Sheet (maqdb/rodpc) — ดู `SDS_V2_DOCUMENTATION.md` |
| General DWG Request | `/api/engineer/mtc/tool-requests/*` | `tool_req.js` | Workflow ขอ DWG — ดู `API_DOCUMENTATION.md` |
| Work Centers | `/api/master/wc` | `eng_mtc_model.js` | รายการ Work Center |

---

## Tooling Inspection

### GET `/api/tooling_inspect/getlist`
ดึงรายการ tooling inspect ทั้งหมด

### GET `/api/tooling_inspect/dashboard_stats`
สถิติ dashboard ของ tooling inspection

### GET `/api/tooling_inspect/dwg_require_getlist`
รายการ DWG request ของ tooling

### POST `/api/tooling_inspect/dwg_require_add`
เพิ่ม DWG request ใหม่

### PUT `/api/tooling_inspect/dwg_require_update`
อัปเดต DWG request

### POST `/api/tooling_inspect/return_add`
บันทึกการคืน tooling

### POST `/api/tooling_inspect/inspect_update`
อัปเดตผลการตรวจสอบ

### POST `/api/tooling_inspect/sync_csv`
Sync ข้อมูล tooling จาก CSV

### GET `/api/master/wc`
ดึงรายการ Work Center code ทั้งหมด

---

## Tumble Condition (ผ่าน engProcess)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tumble/getAllCondition` | ดึง condition ทั้งหมด |
| POST | `/api/tumble/createCondition` | เพิ่ม condition |
| PUT | `/api/tumble/updateCondition/:id` | แก้ไข condition |
| DELETE | `/api/tumble/deleteCondition/:id` | ลบ condition |
| GET | `/api/tumble/getAllModel` | ดึง model ทั้งหมด |
| POST | `/api/tumble/createModel` | เพิ่ม model |
| PUT | `/api/tumble/updateModel/:id` | แก้ไข model |
| DELETE | `/api/tumble/deleteModel/:id` | ลบ model |

---

## SDS v2

ดูรายละเอียดเต็มใน [`SDS_V2_DOCUMENTATION.md`](./SDS_V2_DOCUMENTATION.md)

**Endpoint:** `GET /api/sds/v2/search?cn=<CN or ItemNo>`

**ข้อมูลที่ได้:**
- Part type & dimension (ball/race/body/sleeve/spherical)
- Material grade จาก `lpb.eng_bom` → `lpb.eng_mcode` (`as400name`, `mate_code`, `procument_spec`)
- DWG revision (normalize เป็น A–Z หรือ NC)
- Process info & process plan พร้อมชื่อ process (TH/EN)
- Production info (customer, model, approval type)

---

## General DWG Request

ดูรายละเอียดเต็มใน [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)

**Workflow:** Eng Check → Draft Man → DWG Check → Eng Review → Eng Approve → Eng Inform

---

## Database Connections

| Pool variable | Database | Schema หลัก | ใช้ใน |
|---------------|----------|-------------|-------|
| `engPool` | eng_system (local PostgreSQL port 6543) | public | SDS v1, Tooling Inspect, Tool Request |
| `maqPool` | maqdb (`PG_MAQ_HOST`) | lpb | SDS v2 — dimension, BOM, material |
| `rodpcPool` | rodpc (`instance.js`) | rodpc | SDS v2 — production, process name |

---

## Key Tables (maqdb / lpb schema)

| Table | Description |
|-------|-------------|
| `lpb.eng_item` | Master item (control_no, parts_no, gnk, old_control_no) |
| `lpb.eng_bom` | BOM — เชื่อม parent_cn → child_cn (PM raw material) |
| `lpb.eng_mcode` | Material code master (as400name, mate_code, procument_spec, mate_class_code4) |
| `lpb.eng_ball/body/race/sleeve/sph` | Dimension ตามประเภทชิ้นงาน |
| `lpb.eng_process_info` | Process cycle time, WC, batch size |
| `lpb.eng_r_pi_item` | Process plan ↔ item mapping |
| `lpb.eng_r_pi_tool` | Tooling per process |
| `lpb.eng_tooling` | Tooling master |
| `lpb.eng_cad_rev_data` | CAD drawing revision |
| `lpb.eng_temp_parts_name` | Part type name mapping |

---

## Environment Variables (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 2005 | Backend port |
| `PG_MAQ_HOST` | plbmp00 | maqdb host |
| `PG_MAQ_PORT` | 5432 | maqdb port |
| `PG_MAQ_DB` | maqdb | maqdb database name |
| `PG_MAQ_USER` | — | maqdb username (required) |
| `PG_MAQ_PASSWORD` | — | maqdb password (required) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-17 | เพิ่ม SDS v2 (maqdb/rodpc), BOM material lookup, eng_mcode integration |
