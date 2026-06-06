import { create } from 'zustand';

/**
 * PDF Editor Workstation — Global State Store
 *
 * Manages state shared across deeply-nested components:
 *   ModeToolbar ↔ EditorCanvas ↔ PropertiesPanel
 *
 * Per-page annotation data is managed in usePdfEditor hook (local state),
 * only cross-cutting UI state lives here.
 */
export const usePdfEditorStore = create((set, get) => ({
    // ── Operating Mode ──
    // view | annotate | shapes | edit | sign | merge | export
    activeMode: 'view',

    // ── Active Tool within current mode ──
    // View:     select, pan
    // Annotate: highlight, underline, strikethrough, sticky
    // Shapes:   rect, circle, arrow, line, freehand, ruler
    // Edit:     addText, maskReplace
    // Sign:     formFill, signature, stamp, date
    // Merge:    (no sub-tools)
    // Export:   (no sub-tools)
    activeTool: 'select',

    // ── Drawing / Styling Properties ──
    strokeColor: '#e74c3c',
    fillColor: 'transparent',
    strokeWidth: 2,
    fontSize: 12,
    fontFamily: 'Helvetica',
    opacity: 1.0,
    highlightColor: '#ffeb3b',

    // ── Selected Object ──
    selectedObjectId: null,
    selectedObjectProps: null, // { type, fill, stroke, ... } for PropertiesPanel

    // ── Ruler / Measurement ──
    rulerScale: 1.0,       // px per mm (calibratable)
    rulerUnit: 'mm',       // mm | cm | in

    // ── Real-time Object Counts ──
    canvasObjectCounts: {},

    // ── Overlay Compare (View mode) ──
    overlayEnabled: false,
    overlayOpacity: 0.5,   // 0..1
    overlayBlend: 'difference', // difference | multiply | normal

    // ── View Mode (continuous vs single) ──
    viewMode: 'continuous', // 'continuous' | 'single'

    // ── Actions ──
    setActiveMode: (mode) => set({
        activeMode: mode,
        activeTool: mode === 'view' ? 'select' : get().activeTool,
        selectedObjectId: null,
        selectedObjectProps: null,
    }),

    setActiveTool: (tool) => set({ activeTool: tool }),

    setSelectedObject: (id, props) => set({
        selectedObjectId: id,
        selectedObjectProps: props,
    }),

    clearSelection: () => set({
        selectedObjectId: null,
        selectedObjectProps: null,
    }),

    setCanvasObjectCount: (pageNum, count) => set(state => ({
        canvasObjectCounts: {
            ...state.canvasObjectCounts,
            [pageNum]: count
        }
    })),

    // Drawing property setters
    setStrokeColor: (c) => set({ strokeColor: c }),
    setFillColor: (c) => set({ fillColor: c }),
    setStrokeWidth: (w) => set({ strokeWidth: w }),
    setFontSize: (s) => set({ fontSize: s }),
    setFontFamily: (f) => set({ fontFamily: f }),
    setOpacity: (o) => set({ opacity: o }),
    setHighlightColor: (c) => set({ highlightColor: c }),
    setRulerScale: (s) => set({ rulerScale: s }),
    setRulerUnit: (u) => set({ rulerUnit: u }),

    // Overlay setters
    setOverlayEnabled: (v) => set({ overlayEnabled: v }),
    setOverlayOpacity: (v) => set({ overlayOpacity: v }),
    setOverlayBlend: (v) => set({ overlayBlend: v }),

    // View Mode
    setViewMode: (v) => set({ viewMode: v }),
}));
