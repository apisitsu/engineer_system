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

## ✅ แก้ไขแล้ว (2026-04-20/21)

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

---

## ⏳ รอดำเนินการ (Pending)

### Tooling Select Formula Migration — รอ Run SQL
SQL ไฟล์พร้อมทั้งหมด รอ run ใน DB ตามลำดับ:
```
1. migrate_calc_common_formulas.sql  (KSB22G, KSB80, TSG300)
2. migrate_ks400b_formulas.sql
3. migrate_ks500rd_formulas.sql
4. migrate_ks400b5_formulas.sql
5. migrate_ks400b6_formulas.sql
6. migrate_ks03a_formulas.sql
```
หลัง run: restart backend → test Tooling Select → แก้ใน FormulaManager ถ้าผิด

### SDS V2 — Template Border (Manual Task)
- `sds_template.xlsx` ช่วง A16:I55 ไม่มี border → ต้อง manual Excel edit
- **ห้ามแก้ผ่าน ExcelJS** — เคยทำแล้วพัง template อื่น

### SDS V2 — Manual Post-Migration Tasks
1. Test PDF กับ CN จริง (ลบ cache `output/sds-pdf/` ก่อน)
2. Upload grinding/tooling images ผ่าน Admin (Tab 3)
3. Set `grinding_area_label` ต่อ machine type ที่ไม่ใช่ default (Tab 1)
4. ตรวจสอบ KS-400B7 PDF ว่า tool_dwg_no prefix '664' ถูกต้อง

### FormulaManager Sidebar Link
- Route `/eng/mtc/formulas` ทำงานได้แต่ยังไม่มี sidebar menu item

---

## Modules ที่ Active

| Module | สถานะ | หมายเหตุ |
|--------|--------|----------|
| SDS V2 | ✅ Feature complete | รอ manual tasks + template border |
| Tooling Select | ⏳ Code ready | รอ run SQL migration |
| FormulaManager | ✅ ทำงานได้ | ยังไม่มี sidebar link |
| ECR (Engineering Change Request) | ✅ | ไม่ได้แตะ session นี้ |
