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
    // view | annotate | shapes | sign | dwgCheck | merge | export
    activeMode: 'view',
    currentDwgRole: null, // 'drawer' | 'checker' | 'approver'

    // ── Active Tool within current mode ──
    // View:     select, pan
    // Annotate: highlight, underline, strikethrough, sticky, addText, maskReplace
    // Shapes:   rect, circle, arrow, line, freehand, ruler
    // Sign:     formFill, signature, stamp, date
    // dwgCheck: rect, circle, arrow, addText, stampCheckmark, stampCross, stampCircle, stampOk, stampUserDate
    // Merge:    (no sub-tools)
    // Export:   (no sub-tools)
    activeTool: 'select',

    // ── Tool-Specific Properties ──
    toolSettings: {
        rect: { strokeColor: '#e74c3c', fillColor: 'transparent', strokeWidth: 2, opacity: 1.0 },
        circle: { strokeColor: '#e74c3c', fillColor: 'transparent', strokeWidth: 2, opacity: 1.0 },
        arrow: { strokeColor: '#e74c3c', strokeWidth: 2, opacity: 1.0 },
        line: { strokeColor: '#e74c3c', strokeWidth: 2, opacity: 1.0 },
        freehand: { strokeColor: '#e74c3c', strokeWidth: 2, opacity: 1.0 },
        highlight: { highlightColor: '#ffeb3b', opacity: 0.5 },
        underline: { strokeColor: '#e74c3c', strokeWidth: 2 },
        strikethrough: { strokeColor: '#e74c3c', strokeWidth: 2 },
        addText: { strokeColor: '#000000', fontSize: 16, fontFamily: 'Helvetica', opacity: 1.0 },
        maskReplace: { strokeColor: '#cccccc', fillColor: '#ffffff', strokeWidth: 1, opacity: 1.0 },
        stampCheckmark: { strokeColor: '#27ae60', strokeWidth: 3, fontSize: 12 },
        stampCross: { strokeColor: '#e74c3c', strokeWidth: 3, fontSize: 12 },
        stampCircle: { strokeColor: '#3498db', strokeWidth: 3, fontSize: 12 },
        stampOk: { strokeColor: '#3498db', strokeWidth: 3, fontSize: 12 },
        stampUserDate: { strokeColor: '#e74c3c', fontSize: 16 },
        // Fallback for missing tools
        default: { strokeColor: '#e74c3c', fillColor: 'transparent', strokeWidth: 2, fontSize: 16, fontFamily: 'Helvetica', opacity: 1.0, highlightColor: '#ffeb3b' }
    },

    // ── Selected Object ──
    selectedObjectId: null,
    selectedObjectProps: null, // { type, fill, stroke, ... } for PropertiesPanel

    // ── Clipboard (for Copy/Paste) ──
    clipboard: null,

    // ── Ruler / Measurement ──
    rulerScale: 1.0,       // px per mm (calibratable)
    rulerUnit: 'mm',       // mm | cm | in
    paperSize: 'A4',       // Physical paper size for calibration
    physicalRulerVisible: false,
    physicalRulerPosition: { x: 100, y: 100 },
    physicalRulerAngle: 0,

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
    
    setClipboard: (obj) => set({ clipboard: obj }),

    setCanvasObjectCount: (pageNum, count) => set(state => ({
        canvasObjectCounts: {
            ...state.canvasObjectCounts,
            [pageNum]: count
        }
    })),

    // Tool property setter
    setToolSetting: (tool, key, value) => set(state => {
        const settings = state.toolSettings[tool] || state.toolSettings.default;
        return {
            toolSettings: {
                ...state.toolSettings,
                [tool]: { ...settings, [key]: value }
            }
        };
    }),

    // Drawing property setters (Backward compatible for selected objects)
    setStrokeColor: (c) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), strokeColor: c } } })),
    setFillColor: (c) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), fillColor: c } } })),
    setStrokeWidth: (w) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), strokeWidth: w } } })),
    setFontSize: (s) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), fontSize: s } } })),
    setFontFamily: (f) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), fontFamily: f } } })),
    setOpacity: (o) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), opacity: o } } })),
    setHighlightColor: (c) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), highlightColor: c } } })),
    
    // Ruler setters
    setRulerScale: (s) => set({ rulerScale: s }),
    setRulerUnit: (u) => set({ rulerUnit: u }),
    setPaperSize: (size) => set({ paperSize: size }),
    setPhysicalRulerVisible: (v) => set({ physicalRulerVisible: v }),
    setPhysicalRulerPosition: (pos) => set({ physicalRulerPosition: pos }),
    setPhysicalRulerAngle: (angle) => set({ physicalRulerAngle: angle }),

    // Overlay setters
    setOverlayEnabled: (v) => set({ overlayEnabled: v }),
    setOverlayOpacity: (v) => set({ overlayOpacity: v }),
    setOverlayBlend: (v) => set({ overlayBlend: v }),

    // View Mode
    setViewMode: (v) => set({ viewMode: v }),

    // DWG Role Setter
    setDwgRoleColor: (roleName, color) => set(state => {
        const toolsToUpdate = [
            'rect', 'circle', 'arrow', 'line', 'freehand', 'addText',
            'stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate',
            'underline', 'strikethrough'
        ];
        const newSettings = { ...state.toolSettings };
        toolsToUpdate.forEach(t => {
            newSettings[t] = { ...(newSettings[t] || state.toolSettings.default), strokeColor: color };
        });
        // Also update the 'select' tool so that if we have a selected object, its properties take this new color
        newSettings['select'] = { ...(newSettings['select'] || state.toolSettings.default), strokeColor: color };
        newSettings['pan'] = { ...(newSettings['pan'] || state.toolSettings.default), strokeColor: color };
        return { toolSettings: newSettings, currentDwgRole: roleName };
    }),

    // Update Text Content
    updateSelectedTextContent: (newText, fabricCanvasRefs, currentPage) => set(state => {
        const fc = fabricCanvasRefs?.current?.[currentPage];
        if (fc && state.selectedObjectId) {
            const obj = fc.getObjects().find(o => (o.id === state.selectedObjectId || o.__uid === state.selectedObjectId));
            if (obj && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
                obj.set('text', newText);
                fc.renderAll();
                return { selectedObjectProps: { ...state.selectedObjectProps, text: newText } };
            }
        }
        return state;
    }),
}));
