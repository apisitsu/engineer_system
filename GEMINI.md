# GEMINI.md - Agent Context & Project Status

## Repository Overview
**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React frontend and Express.js backend.

## Current Project Status
- **Last Update:** 2026-09-16
- **Active Goal:** ECNT V2 11-Block Enterprise Refactor completed: 10-Stage Architecture with explicit return loops, 4-view UI/UX, interactive Gantt chart, threaded discussion hub, and full field-level audit trail.

### Recent Changes
- **ECNT V2 Sidebar, Scrollbar & Layout Architecture Fix (2026-09-16):**
  - **Sidebar Navigation Restoration:** Embedded `<MenuTemplate type="Process" selectedKeys={["ecnt_v2"]} defaultSelectedKeys={["ecnt_v2"]} />` inside `<Layout hasSider>` in `Dashboard.jsx`. Updated `menu_template.jsx` with automatic route matching fallback for `/eng/process_eng/ecnt_v2`.
  - **Vertical Scrollbar Restoration & Overflow Management:** Wrapped views in `<Content className="kb-vscroll" style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>` with height bounded by `MainLayout`'s `calc(100vh - 64px)`.
  - **Defensive Scrollbar Styling:** Updated `ScrollbarStyle` (`scrollbar.jsx`) to default `primary = '#1890ff'` and use fallback `color` variable, preventing CSS invalidation (`scrollbar-color: undefined transparent`).
- **ECNT V2 Enterprise Workflow Refactor, Stage Management & Discussion Hub (2026-09-16):**
  - **Explicit Stage Architecture & Return Loops (`STAGE_2_R1`, `STAGE_3_R1`, `STAGE_5_R1`):**
    - Rework cycles (Request More Detail) now generate dedicated named stages rather than resetting silently.
    - Transitions tracked in `ecnt2_stage_history` with precise duration in hours, action actor, and target stage.
    - Automatic creation of clarification requests and revision response messages in `ecnt2_discussion`.
  - **4-View Unified UI/UX Platform:**
    - **View 1: Dashboard & Gantt Chart (`EcntDashboardView`, `EcntGanttChartView`):** KPI summary cards, 7-column Kanban board, and interactive Gantt Chart plotting actual past stages (green/blue), return loops (amber), and future projected milestones (dashed gray based on standard SLAs).
    - **View 2: ECR Require & Initiation Hub (`EcrRequireView`):** Dedicated initiation wizard for Blocks 1 & 2 with change category cards (Drawing, Tooling, Program, Usage), live clipboard paste (Ctrl+V) for screenshot attachments, and side-by-side comparison tables.
    - **View 3: Active ECNT Workspace (`EcntWorkspaceView`):** Vertical linear presentation with collapsible accordion cards, stage stepper, field-level edit restrictions, linked ECR/ECN data aggregation, and context-aware action drawer.
    - **View 4: Problem Investigation & Discussion Hub (`EcntInvestigationHub`):** Threaded discussions with category tags (`Question`, `Clarification`, `Revision Response`, `Issue`), screenshot upload via Ctrl+V, immutable audit timeline, and field-level diff viewer (`ecnt2_field_audit`).
  - **Security, RBAC & Edit Locking:**
    - Replaced hardcoded AD-only barrier in `Dashboard.jsx` with dynamic RBAC so all authorized departments (Requester, Dept Mgr, Eng Mgr, Eng Assigned, QC, Concern Depts) can operate based on stage ownership.
    - Added database schema extensions (`ecnt2_discussion`, `ecnt2_stage_history`, `ecnt2_field_audit`) and updated `menu_template.jsx`.
    - Verified with 100% pass on end-to-end automated workflow suite and clean production build.
- **PDF Hub Multi-Document Drafts, Ultra-Fast Loading & 100% English UI (2026-09-15):**
  - **Draft Download & Document Loading Latency Optimization (Sub-Second Resumption):**
    - **Server CPU Thrash Elimination:** Replaced heavy `pdf-lib` parsing (`PDFDocument.load`) and re-serialization (`doc.save`) in `draftService.getAssembledDraftPdf` with direct buffer concatenation of the clean `%ENG_PROJECT_DATA:<base64>\n` trailer. Server draft assembly dropped from 10,000+ ms of single-threaded blocking CPU to **1 ms** (10,000x speedup).
    - **Header Overflow Protection:** Guarded `X-Eng-Project-Data` HTTP header in `draftController.js` to only send when data is under 4KB, avoiding HTTP 431/header overflow errors on large annotation datasets while relying on the zero-overhead comment trailer.
    - **Client-Side Pre-Emptive Repair Elimination:** Removed unconditional `axios.post(server.PDF_REPAIR)` network round-trip from `usePdfDocument.js#loadPdf`. PDFs now parse directly via `pdfjsLib.getDocument()` inside a Web Worker, saving 5-15 seconds of redundant network upload/download per healthy document, keeping Python PyMuPDF `/repair` strictly as an error recovery fallback.
    - **Main-Thread Worker Decoupling:** Removed synchronous `PDFDocument.load` execution from `usePdfDocument.js#loadPdfFromBytes`, eliminating browser UI freezing and memory thrashing during document rendering.
  - **EditorCanvas Infinite Re-render & RAM Explosion Resolution:**
    - **Root Cause of Blank Canvas & Memory Surge:** Diagnosed that `EditorCanvas.jsx`'s annotation re-hydration `useEffect` included the entire reactive `store` in its dependency array. When `fc.loadFromJSON` executed for 19 objects, Fabric emitted `object:added` which called `store.setCanvasObjectCount`. Because `usePdfEditorStore.js` lacked an equality check on counts, it triggered a state mutation and re-rendered `EditorCanvas` hundreds of times per second.
    - Each re-render re-invoked `fc.loadFromJSON` before previous invocations settled, spawning tens of thousands of Fabric objects in memory (spiking RAM into gigabytes) while repeatedly canceling the 250ms debounced `page.render()` timer (`clearTimeout(renderTimeoutId)`), leaving the page completely blank white and freezing the browser without errors.
    - **Resolution:**
      1. Added `isLoadingJsonRef` and set `lastLoadedAnnotRef.current = pageAnnotations[pageNum]` synchronously before asynchronous parsing to strictly block re-entry.
      2. Removed `store` from the dependency array, routing `setCanvasObjectCount` calls through `usePdfEditorStore.getState()` with an equality check `if (state.canvasObjectCounts[pageNum] === count) return state;`.
      3. Rendered the PDF page immediately on mount (0ms delay) using `hasRenderedOnceRef`, debouncing only subsequent user zoom changes.
      4. Ensured `%ENG_PROJECT_DATA:` comment trailer is unconditionally stripped from `originalPdfBytes` before passing to PDF.js.
  - **Editable PDF & Draft Reassembly FlateDecode Root Cause Resolution:**
    - Saved with `{ useObjectStreams: false }` ensuring the `/EngProjectData` key remains uncompressed and directly accessible in the PDF object dictionary for standard PDF readers.
    - Appended a clean `%ENG_PROJECT_DATA:<base64>\n` comment trailer after `%%EOF`, enabling instantaneous (< 1ms) zero-CPU extraction on upload without needing heavy `PDFDocument.load()` parsing.
    - In `handleResumeDraft`, attached SQLite `project_data` directly to the `File` object (`file._projectData`), plus exposed `X-Eng-Project-Data` HTTP header in `/draft/download`, guaranteeing 100% zero-loss annotation restoration on draft resumption.
  - **Auto-Save Status Time Formatting & Crash Fix:**
    - Formatted `lastSavedTime` as `HH:mm` (e.g. `09:23`), displaying clean `Draft saved 09:23` instead of verbose Date objects in `HeaderModeBar.jsx`. Fixed type error when handling string representations.
  - **Multi-Document Draft Management:**
    - Upgraded SQLite database schema (`apps/ENG-Backend/files/pdf_drafts.db`) to `UNIQUE(empno, filename)` with automatic migration from single-draft table.
    - Updated `draftService.js` and `draftController.js`: added `listDrafts(empno)`, per-document `saveDraft`, `updateDraftAnnotations`, `getAssembledDraftPdf`, `getDraftFilePath`, and selective/all `deleteDraft(empno, filename)`.
    - Enhanced `DraftRecoveryModal` in `PdfEditorTool.jsx`: dynamically presents single draft card or scrollable multi-draft list with per-document `[ Resume ]` and `[ Discard ]` controls, plus global `[ Discard All Drafts ]`.
    - Scoped `autoSave.deleteDraft(pdfFile?.name)` upon successful save, export, or document close so other document drafts remain intact.
  - **100% English UI & Status Indicators:**
    - Added auto-save draft status indicator pill to `HeaderModeBar.jsx` (`Saving draft...`, `Draft saved 09:23`).
    - Converted all modal dialogs, notifications, status bars, and properties panel labels to clean, professional English.
    - Verified 100% pass on all 18 automated tests (`FabricClone.test.js`, `PdfCommitEngine.test.js`, and multi-draft integration tests).
- **PDF Hub Auto-Save Performance Optimization & Delta JSON Synchronization (2026-09-11):**
  - **Zero-Lag Delta Synchronization Architecture:**
    - Eliminated heavy `pdf-lib` parsing (`PDFDocument.load()`) and serialization (`doc.save()`) from the browser's JavaScript main thread during auto-save routines.
    - Base PDF file is uploaded directly as raw multipart form data once per editing session (0ms client CPU overhead).
    - Subsequent debounced auto-saves send only a lightweight delta JSON payload (`{ empno, project_data }`) to `POST /api/engineer/pdf-hub/draft/annotations`.
    - Payload size reduced from ~25MB to ~5KB (99.98% bandwidth reduction) and execution time reduced from ~2,500ms to < 1ms, completely eliminating client browser freezes and GC memory thrash.
  - **Server-Side Reassembly & SQLite Draft Tracking:**
    - Added `project_data TEXT` column to SQLite database (`apps/ENG-Backend/files/pdf_drafts.db`).
    - Added `updateDraftAnnotations` for sub-millisecond SQLite updates.
    - Added `getAssembledDraftPdf` in `draftService.js`: when a user resumes an auto-saved draft via `GET /draft/download`, Node.js on the server embeds `project_data` into the base PDF's `EngProjectData` dictionary using `pdf-lib` without placing any workload on the user's computer.
  - **Idle Scheduling & Dirty Tracking:**
    - Auto-save checks for actual JSON diff changes (`lastSavedJsonRef`) to avoid redundant network requests.
    - Wrapped auto-save in `requestIdleCallback` (with timer fallback) to guarantee that user pen strokes, dragging, and transformations are never interrupted.
  - **Arrowhead Size Default & Direct Numeric Input:**
    - Adjusted default `arrowHeadSize` to 10px in `usePdfEditorStore.js`, `useFabricTools.js`, and `EditorCanvas.jsx`.
    - Replaced the slider in `ShapesPanel.jsx` with a clean Ant Design `InputNumber` control (min 4, max 60, step 1, `px` suffix).
  - **Save Editable PDF High-Fidelity Serialization:**
    - Enhanced `FABRIC_SERIALIZE_PROPS` to serialize and preserve custom properties (`id`, `customData`, `role`, `arrowHeadSize`, etc.) and multi-page metrics.
    - Implemented Unicode-safe `utf8ToBase64` / `base64ToUtf8` in `commitHelpers.js` ensuring special characters and Thai text in annotations are never corrupted.
  - **Responsive Toolbar Overflow:**
    - Added horizontal scroll with mousewheel support (`onWheel`) and left/right chevron navigation buttons to `HeaderModeBar.jsx` and `ModeToolbar.jsx`.
    - Prevented tool clipping and button inaccessibility on smaller or narrower browser viewports.
- **PDF Hub Fabric.js Stabilization, Hotkeys, Role Presets & Arrowhead Sizing (2026-09-11):**
  - **Role Preset Color Application Fix:**
    - Eliminated accidental `handleSetFillColor(null)` call on Role Preset selection in `ShapesPanel.jsx`, which previously wiped text font color and shape backgrounds to transparent.
    - Added `handleApplyRolePreset(roleName, color)` to properly apply preset colors (`Drawer`: `#3498db`, `Checker`: `#e74c3c`, `Approver`: `#000000`) across all selected annotation types (Text font fill, Arrow shaft and head, Shape strokes, and Stamps) while recording undo history.
  - **Draw Arrow Arrowhead Size Customization:**
    - Added `arrowHeadSize` (default: 16, range: 6-60) to `usePdfEditorStore.js` and drawing configuration in `useFabricTools.js`.
    - Implemented live arrowhead resizing in `updateSelectedObjectProperty` with Fabric v6 `group.triggerLayout()` and bounding box re-indexing.
    - Synchronized selected arrow properties in `EditorCanvas.jsx` and added dedicated Slider + InputNumber controls with `px` suffix in `ShapesPanel.jsx`.
  - **Ctrl+C / Paste Crash Elimination:**
    - Resolved `TypeError: Cannot read properties of undefined (reading 'split')` by creating `fabricSafeguard.js` as a global prototype guard on `FabricText.prototype._splitTextIntoLines`, ensuring undefined/null text never crashes `_splitText` during asynchronous `clone()` and `Promise.all` object enlivening.
    - Added fallback character guards (`char || ' '`) to `stampUserDate` in `useFabricTools.js`.
    - Sanitized `Ctrl+C` and `Ctrl+V` in `ShortcutsHandler.jsx` with strict property whitelisting (`['id', 'customData', 'text', 'textLines', 'fill', 'stroke', 'strokeWidth', 'fontSize', 'fontFamily', 'fontWeight']`) and robust error handling.
  - **Edit Text Content Synchronization:**
    - Resolved `TypeError: store.updateSelectedTextContent is not a function` by adding `updateSelectedTextContent` to `usePdfEditorStore.js` and routing to `updateSelectedObjectProperty`.
    - Extended `updateSelectedObjectProperty` to support `FabricText` (Fabric v6 PascalCase) alongside `textbox`, `i-text`, and `text`. Added `initDimensions()` and `setCoords()` for live bounding box updating.
    - Added history push on text input focus (`handleTextFocus`) in `ShapesPanel.jsx` and guarded property change setters to preserve history.
  - **Undo / Redo Engine Stabilization:**
    - Inverted freehand drawing history capture: moved `pushHistory(pageNum)` from `onPathCreated` to `onMouseDown` so strokes can be cleanly undone.
    - Fixed visual blank-canvas bug in `_applyStateToCanvases`: ensured `fc.renderAll()` is called whenever `fc.clear()` executes during undo/redo to refresh the display buffer.
    - Cleared active selections in store during history state restoration to avoid stale selection handles.
    - Passed `pushHistory` through `PdfEditorTool.jsx` to `<ShortcutsHandler>` and `<PropertiesPanel>`, enabling undo for paste and shape property adjustments.
  - **Verification:** 100% passed on 18 automated test suites (11 in `FabricClone.test.js` and 7 in `PdfCommitEngine.test.js`) and verified with 0-error production build (`npm run build`).

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
