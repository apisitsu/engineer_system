# GEMINI.md - Agent Context & Project Status

## Repository Overview
**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React frontend and Express.js backend.

## Current Project Status
- **Last Update:** 2026-09-10
- **Active Goal:** System verification and User Management audit tracking operational.

### Recent Changes
- **User Management Refactoring & Audit Trail System (2026-09-10):**
  - **Frontend Refactor:** Deconstructed monolithic `UserManagement.jsx` (originally 2,886 lines) into modular subcomponents:
    - `constants/userConstants.js`: Centralized constants, options, styling helpers, and data mappers.
    - `components/UserManagementHeader.jsx`: Portal header, quick actions, export buttons, and Change History trigger.
    - `components/UserStatsOverview.jsx`: Metrics cards (Registered, Active, Leaders, Avg Team Powers).
    - `components/UserFilterBar.jsx`: Multi-criteria search, department/role/auth filters, sorters, Cards/Table toggle.
    - `components/UserCardView.jsx`: Responsive engineer cards with RPG power stats and action menus.
    - `components/UserTableView.jsx`: High-density table view with inline power bars.
    - `components/UserDetailsModal.jsx`: Modern card-based user profile inspector with combat attributes and change log shortcut.
    - `components/UserFormModal.jsx`: Dynamic user creation/editing modal supporting RODPC auto-fetch and custom schema columns.
    - `components/SchemaModals.jsx`: Add/Drop database column modal guards for Super Admin.
    - `components/UserAuditLogDrawer.jsx`: Comprehensive change history drawer featuring stats banner, category/user filters, CSV export, and field-by-field Visual Diff Modal (`Before` vs `After`).
  - **Backend & Database Audit Trail:**
    - Upgraded `system_logs` in PostgreSQL `eng_system` with structured columns: `actor_name`, `category`, `target_id`, `target_name`, `old_data`, `new_data`, `changes`, `ip_address` with performance indexes.
    - Implemented deep diff logging in `apps/ENG-Backend/api/user/userManagementModel.js` across:
      - Profile updates (`USER_PROFILE`) with field-by-field comparison.
      - User creation (`USER_CREATE`) & deletion (`USER_DELETE`) with archive snapshots.
      - Skill scoring and power calibration (`SKILLS_CALIBRATION`) logging ATK/DEF/HP/MP deltas.
      - Qualification badges (`QUALIFICATIONS`).
      - Evaluation criteria rules (`CRITERIA`).
      - Dynamic schema alterations (`DATABASE_SCHEMA`).
    - Added API endpoints:
      - `GET /api/system/user-management/audit-logs` (filtering, pagination, search).
      - `GET /api/system/user-management/audit-logs/stats` (metrics, category breakdown, top actors).
  - **Verification:** Verified 0 compile/syntax errors with `npm run build` and validated full UI and diff viewer in browser.
