# ENG System — Project Status
**Date:** 2026-03-29
**Working Directory:** `C:\Users\apisi\eng_nmb\`
**Backend Port:** 2005 | **DB:** PostgreSQL eng_system @ localhost:5432

---

## Section: MTC Engineering (mtc_eng)

### Features & Status

| Feature | Status | Frontend Path | Notes |
|---|---|---|---|
| Tooling Inspect | ✅ ใช้งานได้ | `/eng/mtc_eng/tooling` | ระบบเก่า — stable |
| **General DWG Request** | ✅ **พร้อม deploy** | `/eng/mtc_eng/tool-request` | ระบบใหม่ แทน Tool Request |
| Tooling Select | ✅ ใช้งานได้ | `/eng/mtc_eng/tooling-select` | stable |
| Setup Data Sheet | ✅ ใช้งานได้ | `/eng/mtc_eng/sds` | stable |

---

## General DWG Request — รายละเอียด

### Workflow 6 Stage
```
Eng Check → Draft Man → DWG Check → Eng Review → Eng Approve → Eng Inform
```

| Stage | ผู้รับผิดชอบ | Action | Email ไปที่ |
|---|---|---|---|
| Eng Check | วิศวกร | Approve / Deny | Draft Man team |
| Draft Man | ช่างเขียนแบบ | Submit Drawing | DWG Check team |
| DWG Check | ผู้ตรวจแบบ | Approve / Deny | Eng Review |
| Eng Review | วิศวกร | Approve + classify | Eng Approve |
| Eng Approve | หัวหน้า | Approve / Deny | Requester |
| Eng Inform | วิศวกร | Inform cost + evidence | Requester (email) |

### Database Tables
| Table | บทบาท |
|---|---|
| `tr_request` | คำขอหลัก — 1 row ต่อ 1 request |
| `tr_workflow` | ประวัติทุก action ของ request |

### Backend Files
| File | Path |
|---|---|
| Route handler | `api/engineer/mtc/tool_req.js` |
| Email service | `api/system/emailService.js` |
| Server routes | `server.js` lines 165–171 |

### Frontend Files
| File | Path |
|---|---|
| Main page (list) | `src/components/engineer/mtc_eng/Tool_req/ToolRequest.jsx` |
| Modal (create/view) | `src/components/engineer/mtc_eng/Tool_req/components/RequestDetailsModal.jsx` |
| Sidebar menu | `src/components/menu_sidebar/menu_sidebar.jsx` |
| Home MTC | `src/components/engineer/mtc_eng/home_mtc.jsx` |

### API Endpoints
```
GET    /api/engineer/mtc/tool-requests           — list + filter
GET    /api/engineer/mtc/tool-requests/dashboard — stats
GET    /api/engineer/mtc/tool-requests/:id       — detail + workflow history
POST   /api/engineer/mtc/tool-requests           — create new request
POST   /api/engineer/mtc/tool-requests/:id/action — submit workflow action
PUT    /api/engineer/mtc/tool-requests/:id       — update request
DELETE /api/engineer/mtc/tool-requests/:id       — delete request
```

---

## Email System

| Method | สถานะ | หมายเหตุ |
|---|---|---|
| GAS (Google Apps Script) | ⚠️ 401 จากเครื่อง dev | ต้องอยู่บน Minebea network |
| Gmail API (fallback) | ✅ ใช้งานได้ | ใช้ GMAIL_REFRESH_TOKEN ใน .env |

**Function:** `sendEmailWithFallback(to, subject, html)` — ลอง GAS ก่อน ถ้าไม่ได้ใช้ Gmail API

**GAS URL (deployed):**
```
https://script.google.com/a/macros/minebea.co.th/s/AKfycbw61g0vS9-1vt84GDNrtx_wf9T49pSoKg2VzxIHM0lzCktHKhNSTx46L2IcgPaTnL85/exec
```
**Secret Key:** `ENG_DWG_2026`

---

## DB Migration (เสร็จแล้ว)

ไฟล์: `C:\Users\apisi\eng_nmb\db\migrations\tool_request_workflow.sql`

Columns ที่เพิ่มใน `tr_request`:
- `request_item`, `requester`, `requester_email`, `work_center`, `work_center_name`
- `type_of_request`, `category`, `drawing_required`, `type_of_drawing`
- `machine_no`, `machine_name`, `req_due_date`, `current_stage`

Columns ที่เพิ่มใน `tr_workflow`:
- `req_id`, `step_no`, `action_by`, `action_date`, `action_type`
- `comment`, `status`, `stage_name`, `extra_data`, `created_at`

---

## Bugs ที่แก้ไปแล้ว (2026-03-29)

| # | ปัญหา | ไฟล์ที่แก้ |
|---|---|---|
| 1 | `.env` มี quotes/semicolons → Gmail OAuth `invalid_client` | `.env` |
| 2 | GAS 401 → ไม่มี fallback | `emailService.js` |
| 3 | `groupByYearMonth` crash ถ้า `created_at` null | `ToolRequest.jsx` |
| 4 | `request_item` null → table แสดง blank | `ToolRequest.jsx` |
| 5 | Modal title แสดง `null` | `RequestDetailsModal.jsx` |
| 6 | `isDone` ไม่รู้จัก status เก่า `'Complete'` | `RequestDetailsModal.jsx` |
| 7 | Filter "Complete" ไม่ครอบคลุม legacy status | `ToolRequest.jsx` |
| 8 | `ORDER BY created_at` fail (column ไม่มีก่อน migrate) | `tool_req.js` |
| 9 | Double-click ไม่เปิด modal (ไม่มี Authorization header) | `ToolRequest.jsx`, `RequestDetailsModal.jsx` |

---

## Checklist ก่อน Deploy ไป Factory Machine (plbmp129)

- [ ] เปลี่ยน `constance.js` → `export const apiUrl = "http://plbmp129:2005/";`
- [ ] `npm run build` frontend
- [ ] Copy build ไปที่ server `plbmp129`
- [ ] Restart backend server
- [ ] ทดสอบ create request 1 ใบ
- [ ] Walk-through workflow ทุก stage
- [ ] ตรวจ email notification แต่ละ stage

---

## DB ที่ต้องการตรวจสอบเพิ่มเติม (Pending)

- `tool_dwg_request` — ระบบเก่า อาจ deprecate ได้ถ้าไม่มีการใช้งานแล้ว
- `eng_check`, `draft_man`, `dwg_check`, `eng_review`, `eng_approve`, `eng_inform` — tables ว่าง อาจเป็น draft schema เก่า → พิจารณา DROP
- `tooling` (generic) vs `tooling_*` (machine-specific) — อาจ overlap กัน

ดูรายละเอียดเต็มที่: `mtc_db_tables.txt`

---

## Environment

| Key | Value |
|---|---|
| Backend port | 2005 |
| DB host (dev) | localhost:5432 |
| DB name | eng_system |
| DB owner | postgres |
| DB user (app) | eng_admin |
| Frontend dev URL | http://localhost:2005 |
| Frontend prod URL | http://plbmp129:2005 |
| GAS Secret | ENG_DWG_2026 |
