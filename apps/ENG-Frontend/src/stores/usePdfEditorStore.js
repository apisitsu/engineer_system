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
    // Annotate: highlight, underline, strikethrough, sticky, addText, maskReplace, addImage
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
        stampUserDate: { strokeColor: '#e74c3c', fontSize: 12 },
        addImage: { opacity: 1.0 },
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
    setFontWeight: (w) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), fontWeight: w } } })),
    setFontStyle: (s) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), fontStyle: s } } })),
    setUnderline: (u) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), underline: u } } })),
    setTextAlign: (a) => set(state => ({ toolSettings: { ...state.toolSettings, [state.activeTool]: { ...(state.toolSettings[state.activeTool] || state.toolSettings.default), textAlign: a } } })),
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

    // Update Text Content or Any Property
    updateSelectedObjectProperty: (key, value, fabricCanvasRefs, currentPage) => set(state => {
        const fc = fabricCanvasRefs?.current?.[currentPage];
        if (fc && state.selectedObjectId) {
            const obj = fc.getObjects().find(o => (o.id === state.selectedObjectId || o.__uid === state.selectedObjectId));
            if (obj) {
                if (key === 'text' && (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
                    obj.set('text', value);
                } else if (key === 'strokeColor') {
                    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') obj.set('fill', value);
                    else if (obj.customData?.type?.startsWith('stamp')) {
                        if (obj.type === 'group') {
                            obj.getObjects().forEach(child => {
                                if (child.stroke) child.set('stroke', value);
                                if (child.fill && child.fill !== 'transparent' && child.fill !== '#ffffff') child.set('fill', value);
                            });
                        } else {
                            if (obj.stroke) obj.set('stroke', value);
                            else if (obj.fill && obj.fill !== 'transparent' && obj.fill !== '#ffffff') obj.set('fill', value);
                        }
                    } else if (obj.type === 'group') {
                        obj.getObjects().forEach(child => {
                            if (child.stroke) child.set('stroke', value);
                            if (child.type === 'triangle' && child.fill) child.set('fill', value);
                        });
                    } else {
                        if (obj.stroke !== undefined) obj.set('stroke', value);
                    }
                } else if (key === 'fillColor') {
                    if (obj.fill !== undefined) obj.set('fill', value);
                } else if (key === 'strokeWidth') {
                    if (obj.type === 'group' && !obj.customData?.type?.startsWith('stamp')) {
                        obj.getObjects().forEach(child => {
                            if (['line', 'rect', 'circle', 'ellipse', 'path'].includes(child.type)) child.set('strokeWidth', value);
                        });
                    } else if (obj.strokeWidth !== undefined) {
                        obj.set('strokeWidth', value);
                    }
                } else if (key === 'fontSize') {
                    if (obj.fontSize !== undefined) obj.set('fontSize', value);
                    else if (obj.type === 'group' && !obj.customData?.type?.startsWith('stamp')) {
                        obj.getObjects().forEach(child => {
                            if (child.type === 'i-text' || child.type === 'text') child.set('fontSize', value);
                            if (child.type === 'triangle') child.set({ width: value, height: value });
                        });
                    } else if (obj.customData?.type?.startsWith('stamp')) {
                        if (obj.customData.type === 'stampCheckmark' || obj.customData.type === 'stampCross') obj.set('fontSize', value * 2.5);
                        else if (obj.customData.type === 'stampCircle') obj.set('radius', value);
                        else if (obj.customData.type === 'stampOk') {
                            obj.getObjects()[0].set('radius', value * 1.2);
                            obj.getObjects()[1].set('fontSize', value * 1.1);
                        } else if (obj.customData.type === 'stampUserDate') {
                            const scale = (value / 16) * 0.75;
                            obj.set({ scaleX: scale, scaleY: scale });
                        }
                    }
                } else if (key === 'fontFamily' || key === 'fontWeight' || key === 'fontStyle' || key === 'underline' || key === 'textAlign') {
                    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') obj.set(key, value);
                    else if (key === 'fontFamily' && obj.fontFamily !== undefined) obj.set('fontFamily', value);
                } else if (key === 'opacity') {
                    if (obj.opacity !== undefined) obj.set('opacity', value);
                }

                obj.set({ dirty: true });
                obj.setCoords();
                fc.renderAll();

                return { selectedObjectProps: { ...state.selectedObjectProps, [key]: value } };
            }
        }
        return state;
    }),
}));
