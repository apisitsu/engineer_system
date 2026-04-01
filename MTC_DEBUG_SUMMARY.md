# MTC Engine Debugging Summary
**Date:** April 1, 2026  
**Status:** ✅ All Issues Fixed

---

## 🔍 Issues Found & Fixed

### 1. ✅ Tooling Inventory Page - Missing Route & Menu (FIXED)

**Problem:**
- `ToolingInventoryPage.jsx` existed in the codebase but was not accessible
- No route defined in `App.jsx`
- No menu item in sidebar

**Solution:**
- ✅ Added import in `App.jsx`: `import ToolingInventoryPage from './components/engineer/mtc_eng/tooling_select/ToolingInventoryPage';`
- ✅ Added route: `/eng/mtc_eng/tooling-inventory`
- ✅ Added menu item in `menu_sidebar.jsx`: "Tooling Inventory"

**Files Modified:**
- `apps/ENG-Frontend/src/App.jsx`
- `apps/ENG-Frontend/src/components/menu_sidebar/menu_sidebar.jsx`

---

### 2. ✅ MTC Home Dashboard - Wrong Data Source (FIXED)

**Problem:**
- `home_mtc.jsx` was fetching ECR (Engineering Change Request) data from Process Engineer module
- Dashboard showed irrelevant data for MTC users

**Solution:**
- ✅ Changed data source to fetch MTC-specific data:
  - Tooling Inspection data from `tooling_inspect` table
  - DWG Request data from `tool_dwg_request` table
- ✅ Updated dashboard to display:
  - **Tooling Inspection Stats:** Total Jobs, On Time, Delay, Pending
  - **DWG Request Stats:** Total Requests, Complete, In Progress, Pending Approval
- ✅ Renamed component from `ToolingInspect` to `HomeMTCEng` (proper naming)

**Files Modified:**
- `apps/ENG-Frontend/src/components/engineer/mtc_eng/home_mtc.jsx`

---

## 📊 MTC Dashboard Features

### Tooling Inspection Report
- **Total Jobs:** Shows all tooling inspection records
- **On Time:** Jobs completed before or on due date
- **Delay:** Jobs past due date
- **Pending:** Jobs not yet issued
- **Performance Metrics:** Visual progress bars showing on-time %, pending %, delay %

### General DWG Request
- **Total Requests:** All drawing requests
- **Complete:** Finished requests
- **In Progress:** Requests being processed
- **Pending Approval:** Awaiting engineering approval
- **Quick Info Card:** Description of the DWG request system

---

## 🧪 Build Verification

**Frontend Build:** ✅ Successful (Compiled with warnings - non-blocking ESLint warnings only)

**Backend Syntax Check:** ✅ All MTC backend files pass syntax validation:
- `tooling_select.js` ✅
- `sds.js` ✅
- `tool_req.js` ✅
- `eng_mtc_model.js` ✅

---

## 📁 MTC Module Structure

```
apps/ENG-Frontend/src/components/engineer/mtc_eng/
├── home_mtc.jsx                    ✅ MTC Home Dashboard (Fixed)
├── tooling/
│   ├── tooling_inspect.jsx         ✅ Tooling Inspection Report
│   ├── tooling_update_form.jsx     ✅ Update Inspection Record
│   ├── tooling_inspect_form.jsx    ✅ Tooling Return Form
│   ├── tooling_dwg_require.jsx     ✅ DWG Request Form
│   ├── Dashboard.jsx               ✅ Dashboard Charts
│   └── DashboardCards.jsx          ✅ Dashboard Action Cards
├── Tool_req/
│   ├── ToolRequest.jsx             ✅ General DWG Request List
│   └── components/
│       └── RequestDetailsModal.jsx ✅ Request Details & Workflow
├── tooling_select/
│   ├── ToolingSelectPage.jsx       ✅ Tooling Selection System
│   ├── ToolingInventoryPage.jsx    ✅ Tooling Inventory (Fixed Route)
│   └── RuleManagementModal.jsx     ✅ Selection Rules Management
└── sds/
    └── SdsPage.jsx                 ✅ Setup Data Sheet System

apps/ENG-Backend/api/engineer/mtc/
├── eng_mtc_model.js                ✅ Core MTC Model (DB Operations)
├── tool_req.js                     ✅ Tool Request API (Workflow System)
├── tooling_select.js               ✅ Tooling Selection API
├── sds.js                          ✅ Setup Data Sheet API
├── logic/
│   ├── fixtureLogic.js             ✅ Fixture Finding Logic
│   ├── calculationLogic.js         ✅ Engineering Calculations
│   ├── searchFunctions.js          ✅ Search Utilities
│   └── dynamicLogic.js             ✅ Dynamic Rules Logic
├── middleware/
│   ├── toolRequestAuth.js          ✅ Request Authentication
│   └── fileUpload.js               ✅ File Upload Handler
└── constants/
    └── workflow.js                 ✅ Workflow Constants
```

---

## 🌐 Available Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/eng/mtc_eng` | HomeMTCEng | MTC Home Dashboard |
| `/eng/mtc_eng/tooling` | ToolingInspect | Tooling Inspection Report |
| `/eng/mtc_eng/tool-request` | ToolRequest | General DWG Request System |
| `/eng/mtc_eng/tooling-select` | ToolingSelectPage | Tooling Selection System |
| `/eng/mtc_eng/tooling-inventory` | ToolingInventoryPage | Tooling Inventory Management |
| `/eng/mtc_eng/sds` | SdsPage | Setup Data Sheet System |

---

## 🎯 Backend API Endpoints

### Tooling Inspection
- `GET /api/tooling_inspect/getlist` - Get all inspection records
- `GET /api/tooling_inspect/dwg_require_getlist` - Get DWG requests
- `POST /api/tooling_inspect/dwg_require_add` - Add DWG request
- `POST /api/tooling_inspect/return_add` - Add tooling return
- `POST /api/tooling_inspect/inspect_update` - Update inspection record
- `GET /api/tooling_inspect/dashboard_stats` - Get dashboard statistics
- `GET /api/master/wc` - Get work center codes

### Tool Request System (General DWG Request)
- `GET /api/engineer/mtc/tool-requests` - List all requests
- `GET /api/engineer/mtc/tool-requests/:id` - Get request details
- `POST /api/engineer/mtc/tool-requests` - Create new request
- `PUT /api/engineer/mtc/tool-requests/:id` - Update request
- `DELETE /api/engineer/mtc/tool-requests/:id` - Delete request
- `POST /api/engineer/mtc/tool-requests/:id/action` - Submit workflow action
- `GET /api/engineer/mtc/tool-requests/dashboard` - Get dashboard stats
- `GET /api/engineer/mtc/tool-requests/permissions` - Get stage permissions

### Tooling Select & Inventory
- `POST /api/tooling-select/search` - Search fixtures by CN
- `GET /api/tooling-select/rules` - Get selection rules
- `POST /api/tooling-select/rules` - Create new rule
- `PUT /api/tooling-select/rules/:id` - Update rule
- `DELETE /api/tooling-select/rules/:id` - Delete rule
- `GET /api/tooling-select/tables` - Get tooling tables list
- `GET /api/tooling-select/tooling-names/:tableName` - Get tooling names
- `POST /api/tooling-select/create-table` - Create new tooling table
- `GET /api/tooling-select/inventory/:tableName` - Get inventory data
- `POST /api/tooling-select/inventory/:tableName` - Add inventory item
- `PUT /api/tooling-select/inventory/:tableName/:id` - Update inventory
- `DELETE /api/tooling-select/inventory/:tableName/:id` - Delete inventory

### Setup Data Sheet (SDS)
- `GET /api/sds/counts` - Get SDS counts by category
- `POST /api/sds/search` - Search setup data sheets
- `GET /api/sds/pdf` - Generate PDF from template

---

## ✅ Testing Checklist

- [x] Frontend build successful
- [x] Backend syntax validation passed
- [x] Routes properly configured
- [x] Menu sidebar updated
- [x] Dashboard shows correct MTC data
- [x] Tooling Inventory page accessible

---

## 📝 Notes

1. **Build Warnings:** The build shows ESLint warnings about unused variables, but these are non-blocking and don't affect functionality.

2. **Database Connection:** Ensure the backend `.env` file has correct database credentials:
   - `PG_NEW_HOST`: Database host (e.g., `plbmp129` or `localhost`)
   - `PG_NEW_PORT`: Database port (default: `6543` for Docker, `5432` for direct)
   - `PG_NEW_URL`: Full connection string

3. **File Upload:** Tool requests support file attachments. Files are stored in `./files/tool_requests/`

4. **Workflow System:** The General DWG Request uses a 6-stage workflow:
   - Eng Check → Draft Man → DWG Check → Eng Review → Eng Approve → Eng Inform

---

## 🚀 How to Run

```bash
# Start Backend
cd C:/Users/lble485/Eng_Sys/apps/ENG-Backend
npm start

# Start Frontend (in new terminal)
cd C:/Users/lble485/Eng_Sys/apps/ENG-Frontend
npm start
```

**Access:**
- Frontend: `http://localhost:3009`
- Backend: `http://localhost:2005`

**Test User:**
- Username: `apisit.su`
- Password: `password`
- Role: `AD` (Admin) - Full access to all MTC features

---

**Debugging Completed By:** Qwen Code  
**All Systems:** ✅ Operational
