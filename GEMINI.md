# GEMINI.md - Agent Context & Project Status

## Repository Overview
**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React frontend and Express.js backend.

## Current Project Status
- **Last Update:** 2026-09-11
- **Active Goal:** PDF Hub (PdfEditor, SignStamp, PdfCommitEngine) architectural bug fixes and coordinate stabilization completed.

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

- **PDF Hub Engine Stabilization & Bug Fixes (2026-09-11):**
  - **PDF Rotation Preservation:** Eliminated destructive `setRotation(degrees(0))` and `setSize()` pre-pass from `commitEngine.js` and `useSignStamp.js`. Implemented `getRawPlacement` and updated `visualToRawPdfCoords` to properly map elements onto rotated pages (0°, 90°, 180°, 270°) without corrupting or clipping original PDF content.
  - **Watermark Multi-Page Omission:** Resolved issue where watermarks only applied to active viewed pages in `WatermarkManagerModal.jsx` and `PdfEditorTool.jsx` by directly serializing annotations across unmounted pages into `pageAnnotations` state. Fixed typo `handleCreate` -> `handleSave`.
  - **Freehand Path Drift & Scaling:** Corrected Fabric v6 `pathOffset.x/y` and `scaleX/scaleY` mapping in `commitEngine.js` for freehand drawing strokes.
  - **Eraser Tool Interception:** Removed `'eraser'` from `isDragTool` in `EditorCanvas.jsx` to prevent the text selection layer from blocking cursor clicks, and enabled Fabric object removal and highlight hit-testing in `useFabricTools.js`.
  - **Signature Pad Decoupling:** Decoupled canvas sizing from `penColor`/`penWidth` in `SignaturePad.jsx` to prevent erasing user signatures upon palette selection, and added unique element IDs to font `<link>` tags.
  - **Thumbnail Observer Loop:** Broke circular dependency loop in `ThumbnailPanel.jsx` by caching `thumbnails` in `thumbnailsRef`, stabilizing `renderThumbnail` and stopping observer thrashing.
  - **Merge DnD Missing UID:** Enforced unique `uid` and resilient array buffer generation in `PdfEditorTool.jsx` for newly added merge files.
  - **Export Image Background:** Added white canvas fill before PDF rendering in `exportEngine.js` to eliminate black background artifacts on JPEG exports.
  - **Data-URL Prefix Safety:** Ensured safe handling of Base64 strings in `SignStamp/PdfCanvas.jsx` and `ToolPreview.jsx` to prevent double-prefixing `data:image/png;base64,`.
  - **Verification:** 100% passed on automated tests in `PdfCommitEngine.test.js` (including newly added page rotation preservation test) and zero-error production build via `npm run build`.
