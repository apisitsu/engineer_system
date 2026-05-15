# Tooling Select — Refactoring Plan

Date: 2026-04-27

## Current Problems

| File | Lines | Problem |
|---|---|---|
| `controllers/toolingSelectController.js` | 306 | Router + Cache + Security + Business + DDL mixed |
| `services/fixtureLogic.js` | 515 | God function `findFixtures` = 290 lines, 5 responsibilities |
| `ToolingSelectPage.jsx` | 776 | Search + Inventory Drawer + Add Modal + Result Rendering |
| `ToolingInventoryPage.jsx` | 236 | Duplicate inventory logic |

---

## Phase 1 — Backend: แยก Controller จาก Service
**Status:** ✅ Done (2026-04-27)

Extract cache management, tableExists, getValidColumns, CRUD ops ออกจาก router.

```
routes/toolingSelectRoutes.js     (~60 lines)   ← route definitions only
services/inventoryService.js      (~120 lines)  ← tableExists, CRUD, cache
services/tableAdminService.js     (~50 lines)   ← createTable, listTables
```

---

## Phase 2 — Backend: แยก findFixtures เป็น 3 ชั้น ✅
**Status:** ✅ Done (2026-04-27)

```
services/partDataMapper.js        (~260 lines)  ← mapPartData, computeFlags, adapt*
services/machineQueryService.js   (~110 lines)  ← computeOkFlags, fetchToolingRows
services/fixtureAssembler.js      (~110 lines)  ← assembleResults
services/fixtureLogic.js          (~60 lines)   ← orchestrator only
```

---

## Phase 3 — Frontend: Extract InventoryDrawer ⬜
**Status:** ⬜ Pending

```
components/InventoryDrawer.jsx    ← shared drawer, reuse in both pages
ToolingSelectPage.jsx             ← ~280 lines (ลดจาก 776)
ToolingInventoryPage.jsx          ← ~100 lines (wrapper)
```

---

## Phase 4 — Frontend: แยก buildResults renderers ⬜
**Status:** ⬜ Pending

```
renderers/TsgResultSection.jsx
renderers/KsB22gB80ResultSection.jsx
renderers/Ks400BResultSection.jsx
renderers/Ks400B5ResultSection.jsx
renderers/Ks400B6ResultSection.jsx
renderers/Ks500RdResultSection.jsx
renderers/Ks03AResultSection.jsx
```

---

## Rules

- ❌ ห้าม rewrite findFixtures ทั้งหมดพร้อมกัน
- ❌ ห้าม microservices
- ✅ extract ก่อน optimize ทีหลัง
- ✅ แต่ละ Phase ต้อง runnable ก่อนไปต่อ
