# SDS v2 — Setup Data Sheet API Documentation

## Overview

SDS v2 ดึงข้อมูล Setup Data Sheet ของชิ้นงาน (Control No) จาก 2 database pool แบบ parallel:

| Pool | Database | ใช้กับ |
|------|----------|--------|
| `maqPool` | maqdb (lpb schema) | Dimension, BOM, Tooling, Process Info, Material Code |
| `rodpcPool` | rodpc | Production info, Process name |

**Base URL:** `http://localhost:2005/api/sds/v2`

**Authentication:** ต้องใช้ JWT Token (ผ่าน middleware `/api` ทั่วไป)

---

## Endpoint

### GET `/api/sds/v2/search`

ค้นหาข้อมูลชิ้นงานด้วย Control No หรือ Item No

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `cn` | string | Yes | Control No (เช่น `C39-04137`) หรือ Item No 6 หลัก (เช่น `394137`) |

**CN Format ที่รองรับ:**
- Control No โดยตรง: `C39-04137`, `A41-0001`
- Item No 6 หลัก: `394137` → ระบบแปลงเป็น `C39-04137` อัตโนมัติ

---

## Part Type Mapping

ระบบแยกประเภทชิ้นงานจาก 3 ตัวแรกของ CN:

| Prefix | Type | Dimension Table |
|--------|------|-----------------|
| C11–C19, C51–C59 | BODY | `lpb.eng_body` |
| C21–C29 | RACE | `lpb.eng_race` |
| C31–C39 | BALL | `lpb.eng_ball` |
| C61–C64, C69 | SLEEVE | `lpb.eng_sleeve` |
| A41–A44, A48–A49 | SPHERICAL | `lpb.eng_sph` |

---

## Response

```json
{
  "result": "true",
  "cn": "C39-04137",
  "item_no": "394137",
  "part_type": "BALL",
  "part_info": {
    "class1": "C39",
    "class1_name": "...",
    "sub_class": "...",
    "sub_class_name": "...",
    "part_type": "..."
  },
  "parts_no": "3L117548-T",
  "dwg_rev": "A",
  "material": {
    "material": "52100 AMS6444",
    "mate_code": "M8X",
    "procument_spec": "RP2118X",
    "raw_control_no": "PM1-04844",
    "raw_parts_no": "10E9004762"
  },
  "dimension": {
    "control_no": "C39-04137",
    "ball_dia": "42.029",
    "width": "9.987",
    "in_dia": "34.999",
    "..."
  },
  "process_info": [
    {
      "seq_no": "10",
      "process_seqno": "1",
      "process_code": "GR01",
      "wc": "KS03A",
      "ct": "120",
      "st": "60",
      "batch_size": "100",
      "process_name": "...",
      "process_eng": "..."
    }
  ],
  "process_plan": [
    {
      "process_plan_no": "PP-001",
      "seq_no": "10",
      "rev": "A",
      "process_code": "GR01",
      "tool_dwg_no": "T-001",
      "tool_update_date": "...",
      "tool_name": "...",
      "process_seqno": "1",
      "process_name": "...",
      "process_eng": "..."
    }
  ],
  "production": {
    "control_no": "C39-04137",
    "model": "...",
    "customer": "...",
    "type": "...",
    "packing": "...",
    "approval_type": "...",
    "cust_dwg_no": "...",
    "cust_dwg_no_rev": "...",
    "sdwg_no": "...",
    "sdwg_no_rev": "...",
    "update_date": "..."
  }
}
```

---

## Field Notes

### `dwg_rev`
- ค่าที่เป็นตัวอักษร A–Z ตัวเดียว → แสดงค่านั้น (uppercase)
- ค่าอื่น (`N/C`, `-`, ว่าง, null) → แสดงเป็น `"NC"`

### `material`
ดึงข้อมูลผ่าน 2 ขั้นตอน:
1. **BOM Lookup** (`lpb.eng_bom`): `parent_cn = CN` → ได้ `child_cn` (PM part เช่น `PM1-04844`)
2. **Material Code Lookup** (`lpb.eng_mcode`): `mate_class_code4 = LEFT(PM.parts_no, 4)` → ได้ `as400name`, `mate_code`, `procument_spec`

| Field | Source | Description |
|-------|--------|-------------|
| `material` | `eng_mcode.as400name` | ชื่อเกรดวัสดุ เช่น "52100 AMS6444" |
| `mate_code` | `eng_mcode.mate_code` | รหัสวัสดุ เช่น "M8X" |
| `procument_spec` | `eng_mcode.procument_spec` | Procurement Spec เช่น "RP2118X" |
| `raw_control_no` | `eng_bom.child_cn` | CN ของ PM part |
| `raw_parts_no` | `lpb.eng_item.parts_no` | Parts No ของ PM part (มี purchase code นำหน้า) |

หาก BOM ไม่พบ → `material: null`

### `process_info` และ `process_plan`
เรียงตาม `seq_no` แล้วตาม `process_seqno` และ merge ชื่อ process จาก `rodpc.kzwmaq_eng_process`

---

## Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 400 | ไม่ส่ง `cn` | `{ "error": "cn is required" }` |
| 400 | แปลง item_no ไม่ได้ | `{ "error": "Cannot convert item_no: ..." }` |
| 400 | prefix ไม่รู้จัก | `{ "error": "Unknown CN prefix: ..." }` |
| 500 | Database error | `{ "error": "<message>" }` |

---

## Database Tables Used

| Table | Pool | ใช้กับ |
|-------|------|--------|
| `lpb.eng_item` | maqPool | Parts info, gnk, old_control_no |
| `lpb.eng_bom` | maqPool | BOM link (parent_cn → child_cn) |
| `lpb.eng_mcode` | maqPool | Material grade, mate_code, procument_spec |
| `lpb.eng_ball/body/race/sleeve/sph` | maqPool | Dimension ตามประเภท |
| `lpb.eng_r_pi_tool` | maqPool | Tooling per process |
| `lpb.eng_tooling` | maqPool | Tool name |
| `lpb.eng_r_pi_item` | maqPool | Process plan ↔ item |
| `lpb.eng_temp_parts_name` | maqPool | Part type info |
| `lpb.eng_cad_rev_data` | maqPool | DWG revision |
| `lpb.eng_process_info` | maqPool | Process cycle time, WC |
| `rodpc.kzwmaq_eng_production` | rodpcPool | Production info |
| `rodpc.kzwmaq_eng_process` | rodpcPool | Process name (TH/EN) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-04-17 | Initial release — BOM-based material lookup, eng_mcode integration, DWG rev normalization |
