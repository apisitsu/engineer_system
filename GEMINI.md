# GEMINI.md - Agent Context & Project Status

## Repository Overview
**EngineerSystem** is an engineering management platform for manufacturing operations, built as an NPM workspace monorepo with a React frontend and Express.js backend.

## Current Project Status
- **Last Update:** 2026-09-11
- **Active Goal:** PDF Hub (PdfEditor, SignStamp, PdfCommitEngine) architectural bug fixes, shortcuts, and Undo/Redo stabilization completed.

### Recent Changes
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
