import { useEffect, useCallback } from 'react';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';

/**
 * ShortcutsHandler — Global keyboard shortcut listener for the PDF Workstation.
 *
 * Captures key events for tool switching, navigation, and actions.
 * Does NOT render any UI elements.
 */
export default function ShortcutsHandler({
    onUndo,
    onRedo,
    onPrevPage,
    onNextPage,
    onZoomIn,
    onZoomOut,
    onDelete,
    onSave,
    fabricCanvasRefs,
    currentPage
}) {
    const store = usePdfEditorStore();

    const handleKeyDown = useCallback((e) => {
        const activeElement = document.activeElement;
        const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable;

        // Allow copy/paste in text inputs
        if (isInput && (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v')) {
            return;
        }

        if (isInput) {
            if (e.key === 'Escape') {
                activeElement.blur();
                store.setActiveTool('select');
            }
            return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const code = e.code?.toLowerCase();
        const key = e.key?.toLowerCase();

        // ── Escape — deselect or switch to select tool ──
        if (key === 'escape') {
            e.preventDefault();
            store.setActiveTool('select');
            if (fabricCanvasRefs?.current) {
                Object.values(fabricCanvasRefs.current).forEach(fc => {
                    if (fc) {
                        fc.discardActiveObject();
                        fc.renderAll();
                    }
                });
            }
            return;
        }

        // Also ignore when Fabric.js IText is being edited for other shortcuts
        let isEditingText = false;
        if (fabricCanvasRefs?.current) {
            Object.values(fabricCanvasRefs.current).forEach(fc => {
                if (fc) {
                    const active = fc.getActiveObject();
                    if (active && active.isEditing) isEditingText = true;
                }
            });
        }
        if (isEditingText) return;

        // ── Undo / Redo ──
        if (ctrl && !shift && (code === 'keyz' || key === 'z')) {
            e.preventDefault();
            onUndo?.();
            return;
        }
        if (ctrl && (code === 'keyy' || key === 'y' || (shift && (code === 'keyz' || key === 'z')))) {
            e.preventDefault();
            onRedo?.();
            return;
        }

        // ── Copy / Paste ──
        if (ctrl && (code === 'keyc' || key === 'c')) {
            if (fabricCanvasRefs?.current) {
                Object.values(fabricCanvasRefs.current).forEach(fc => {
                    if (fc) {
                        const active = fc.getActiveObject();
                        if (active) {
                            e.preventDefault();
                            active.clone().then(cloned => {
                                store.setClipboard(cloned);
                            });
                        }
                    }
                });
            }
            return;
        }

        if (ctrl && (code === 'keyv' || key === 'v')) {
            const clipboard = store.clipboard;
            if (clipboard && fabricCanvasRefs?.current && currentPage) {
                const fc = fabricCanvasRefs.current[currentPage];
                if (fc) {
                    e.preventDefault();
                    clipboard.clone().then(clonedObj => {
                        fc.discardActiveObject();
                        clonedObj.set({
                            left: clonedObj.left + 20,
                            top: clonedObj.top + 20,
                            evented: true,
                        });
                        if (clonedObj.type === 'activeSelection') {
                            clonedObj.canvas = fc;
                            clonedObj.forEachObject(obj => fc.add(obj));
                            clonedObj.setCoords();
                        } else {
                            fc.add(clonedObj);
                        }
                        if (clonedObj.customData) {
                            clonedObj.set('customData', { ...clonedObj.customData, createdAt: Date.now() });
                        }
                        fc.setActiveObject(clonedObj);
                        store.setClipboard(clonedObj); // Update clipboard to the new slightly offset object
                        fc.renderAll();
                    });
                }
            }
            return;
        }

        // ── Save (Ctrl+S) ──
        if (ctrl && (code === 'keys' || key === 's')) {
            e.preventDefault();
            onSave?.();
            return;
        }

        // ── Navigation ──
        if (key === 'pageup' || (ctrl && key === 'arrowup')) {
            e.preventDefault();
            onPrevPage?.();
            return;
        }
        if (key === 'pagedown' || (ctrl && key === 'arrowdown')) {
            e.preventDefault();
            onNextPage?.();
            return;
        }

        // ── Zoom ──
        if (ctrl && (key === '=' || key === '+')) {
            e.preventDefault();
            onZoomIn?.();
            return;
        }
        if (ctrl && key === '-') {
            e.preventDefault();
            onZoomOut?.();
            return;
        }

        // ── Delete ──
        if (key === 'delete' || key === 'backspace') {
            e.preventDefault();
            onDelete?.();
            return;
        }

        // (Escape logic moved up)
        // ── Tool shortcuts (single keys) ──
        if (!ctrl && !shift && !e.altKey) {
            switch (key) {
                case 'v':
                    store.setActiveTool('select');
                    break;
                case 'h':
                    store.setActiveTool('pan');
                    break;
                case 'r':
                    store.setActiveTool('rect');
                    break;
                case 'c':
                    store.setActiveTool('circle');
                    break;
                case 'l':
                    store.setActiveTool('line');
                    break;
                case 'a':
                    store.setActiveTool('arrow');
                    break;
                case 'p':
                    store.setActiveTool('freehand');
                    break;
                case 't':
                    store.setActiveTool('addText');
                    break;
                case 'm':
                    store.setActiveTool('ruler');
                    break;
                default:
                    break;
            }
        }
    }, [store, fabricCanvasRefs, onUndo, onRedo, onPrevPage, onNextPage, onZoomIn, onZoomOut, onDelete, onSave]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return null; // No UI
}
