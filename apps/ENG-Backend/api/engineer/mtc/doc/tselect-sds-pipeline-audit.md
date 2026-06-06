# Tooling Select ↔ Setup Data Sheet (SDS) — Data Pipeline Audit

วันที่: 2026-06-06 · ขอบเขต: ความสอดคล้องของ data pipeline ผ่าน key หลัก
(CN, Process code, Process, Machine type code, Machine type, Tool no) + ประสิทธิภาพ

---

## 1. แหล่งฐานข้อมูล

| ระบบ | Pool / DB | ข้อมูล |
|---|---|---|
| **Tooling Select** | `engPool` (eng_system:6543) — local 100% | spec, machine, limit, formula, search_rule, inventory |
| **SDS** | `maqPool` (lpb, สด) + `rodpcPool` (rodpc, สด) + `engPool` (config) | dim/process/tool จากโรงงาน + sds_parameter/machine_tool/excel_mapping/images |

จุดเข้า: `searchService.search(cn)` (T-Select) · `sdsV2SearchService.searchByCn(cn)` (SDS) ·
สะพานเชื่อม: `services/tselectFallback.js` (ใช้ร่วมโดย PDF controller + report controller)

---

## 2. ความสอดคล้องของ Key หลัก

| Key | สถานะ | สรุป |
|---|---|---|
| **CN** | ⚠️→✅ | format ต่าง (6-digit vs Cxx-0YYYY) + เดิมมี normalizer 3 ชุดซ้ำ → **รวมเป็น SSOT แล้ว** (`utils/cnFormat.js`) |
| **Process code** | 🔴→⚠️ | T-Select ไม่มี concept นี้ (เก็บ "ทิศทาง" แทน) → เพิ่ม **direction gate** ใน fallback |
| **Process (ชื่อ/ทิศทาง)** | 🔴 | semantic ต่างกัน: SDS=รหัสโรงงาน, T-Select=`OD->ID`/`ID->OD` |
| **Machine type** | ⚠️ | string-match ไม่มี FK เก็บซ้ำ 7 ตาราง — มี diagnostics ตรวจ orphan แล้ว |
| **Machine type code** | 🔴 | มีเฉพาะ SDS (prefix filter บน tool_dwg_no) |
| **Tool no** | ✅ | match ผ่าน `dwgPrefix` (2 segment แรก) — logic ถูกต้อง |
| **Dimension** | 🔴 | T-Select = สำเนา manual (`/spec/sync`), SDS = สด → drift ได้ |

### รายละเอียดความเสี่ยงเดิม
1. **CN normalizer ซ้ำ 3 ชุด** — `normalizeSpecCn` (searchService), inline regex (sdsV2SearchService),
   `normalizeCn`+`toSpecCn` (reportController) → drift risk
2. **Process code over-counting** — `tselectToolsForMachine` match เฉพาะชื่อเครื่อง ไม่สน process_code →
   coverage report นับ tool ของคนละ process เป็น match
3. **Machine name ผูกด้วย string ไม่มี FK** — เคยเกิดอุบัติเหตุ rename ทำ `sds_parameter` หาย 1,299 แถว
4. **Dimension drift** — CN เดียวกันคำนวณบนค่าคนละชุดถ้าไม่ re-sync spec
5. **3 cache แยกกัน ไม่ invalidate ข้ามระบบ**

---

## 3. การเปลี่ยนแปลงที่ทำในรอบนี้ (implemented)

| # | ไฟล์ | สิ่งที่ทำ |
|---|---|---|
| 1 | `utils/cnFormat.js` (ใหม่) | SSOT แปลง CN: `toItemNo` / `toControlNo` / `toSpecCn` / `itemNoToControlNo` |
| 1 | `services/searchService.js` | `normalizeSpecCn` delegate → `cnFormat.toSpecCn` |
| 1 | `services/sdsV2SearchService.js` | normalize block + `itemNoToCN` → `cnFormat.toControlNo` / re-export |
| 1 | `controllers/sdsV2ReportController.js` | `normalizeCn`/`toSpecCn` → `cnFormat` |
| 2 | `services/tselectFallback.js` | เพิ่ม `directionForProcessCode` + **direction gate** ใน `tselectToolsForMachine(…, {processCode})` (reject เฉพาะเมื่อทิศทางขัดกันชัดเจน — ไม่ reject ตอนข้อมูลขาด) |
| 2 | report + PDF controller | ส่ง `processCode` เข้า fallback |
| 3 | `services/tselectFallback.js` | เพิ่ม **TTL sweep** (`setInterval` แบบ `unref`) กัน Map cache ค้างใน RAM |
| test | `tests/mtc/cnFormat.test.js`, `tests/mtc/tselectFallback.test.js` (ใหม่) | 22 เคสครอบคลุม CN parity + direction gate |
| ค | `db_migrations/20260606_add_tselect_sds_indexes.sql` | index hot-path (idempotent) |
| ค | `db_migrations/20260606_tselect_sds_diagnostics.sql` | ตรวจ index / orphan machine name / spec quality / drift |

> ผลทดสอบ: `npx jest` → 54 passed (4 suites). ไม่กระทบ behavior เดิม (fallback เดิมยังทำงานเมื่อ
> ข้อมูลทิศทางขาด — เป็น additive, ลดเฉพาะ false positive ที่พิสูจน์ได้)

---

## 4. ประสิทธิภาพ

**ดีแล้ว:** SDS cache 10 นาที · report cache 15 นาที + stale-while-revalidate + 202 polling ·
fallback bounded concurrency 6 · information_schema cache.

**ปรับแล้ว:** TTL sweep (#3).

**ยังเหลือ (แนะนำต่อ):**
- N+1 ใน `searchInventory` (1 query/tooling) — รวมเป็น query เดียวต่อเครื่อง
- ตรวจ/เพิ่ม index ตาม migration ข้อ ค
- cross-system cache invalidation (แก้ SDS config แล้ว flush fallback cache อัตโนมัติ)

---

## 5. ข้อเสนอเชิงโครงสร้าง — สถานะหลังดำเนินการ (2026-06-06)

### ✅ #5 Drift detector — **ทำเสร็จ + verify กับ DB จริง**
- `GET /api/tooling-select/spec/drift-audit?tol=0.005` (isAdmin) ใน `specController.js`
- bulk diff `tooling_spec_process` (engPool) vs `lpb.*` (maqPool) เฉพาะ OD/ID/W after-grind
- ใช้ `factoryAfterDims()` map คอลัมน์ถูกต้องต่อ part type (race=od/id/width · ball=ball_dia/in_dia/width ·
  sleeve=od/id) — **ไม่ใช้ `mapFactoryDimToSpec`** เพราะมันอ่าน d.od/d.id/d.w จับ ball/width ไม่ได้
- cache 15 นาที · ผลจริง: 7,782 specs, เทียบ 7,311, drift 3, no-factory 471

### ✅ #6 Tool-no column — **DB มาตรฐานอยู่แล้ว → cleanup โค้ด**
- audit: ทุกตาราง `tooling_*` ใช้ `tooling_no` หมด ไม่มี `No`/`no`/`part_no` → ไม่ต้อง migrate
- `matchNo()` ตัด fallback dead-code เหลือ `tooling_no` · diagnostics section E ดักตารางใหม่ที่ผิด convention

### ⚠️ #4 Machine identity SSOT — **บางส่วน (ถูก block ด้วยสภาพข้อมูล)**
- **ทำแล้ว:** แก้ orphan `HIGRIND-1-D → HI-GRIND-1-D` (2 rows, transactional, มี rollback) — rows เดิม dead
- **Block:** FK-on-name **เป็นไปไม่ได้** — `machine_type_name` ไม่ unique (ซ้ำ 16 กลุ่ม: null×87, "no data"×41,
  KS-03A×2, HI-GRIND-1-D×4…) เพราะ identity จริงคือ `machine_type_code`; และ orphan `GS-64PF` ไม่มี master row
- **เตรียมไว้ (ไม่รัน):** surrogate-id FK migration + rollback + cleanup-prereq ใน `db_migrations/20260606_*`
  → ต้อง dedup ชื่อ + retire junk + เพิ่ม master `GS-64PF` (เจ้าของตัดสิน) ก่อน

### ไฟล์ migration ที่เพิ่ม
| ไฟล์ | สถานะ |
|---|---|
| `20260606_fix_sds_machine_tool_orphans.sql` (+_rollback) | ✅ รันแล้ว |
| `20260606_machine_identity_cleanup_prereq.sql` | 📋 diagnostics ให้เจ้าของรัน |
| `20260606_machine_identity_fk_PREPARED.sql` (+_rollback) | ⏸ เตรียมไว้ รอ cleanup |
| `20260606_add_tselect_sds_indexes.sql` | 📋 idempotent รอรัน |
| `20260606_tselect_sds_diagnostics.sql` | 📋 read-only |

> ⚠️ sds_machine_tool เปลี่ยน → flush SDS cache: `DELETE /api/tooling-select/monitor/cache?prefix=sds:`

> อ้างอิงโค้ด: `searchService.js`, `sdsV2SearchService.js`, `tselectFallback.js`,
> `sdsV2ReportController.js`, `sdsV2PdfController.js`. กฎเดิม: `.claude/rules/sds-pipeline.md`,
> `.claude/rules/tooling-select.md`.
