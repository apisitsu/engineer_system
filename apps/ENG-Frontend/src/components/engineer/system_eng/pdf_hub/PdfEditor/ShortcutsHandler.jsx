import { useEffect, useCallback } from 'react';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';

/**
 * ShortcutsHandler — Global keyboard shortcut listener for the PDF Workstation.
 *
 * Captures key events for tool switching, navigation, and actions.
 * Does NOT render any UI elements.
 */
const ShortcutsHandler = ({
    onUndo,
    onRedo,
    onPrevPage,
    onNextPage,
    onZoomIn,
    onZoomOut,
    onDelete,
    onSave,
    fabricCanvasRef,
}) => {
    const store = usePdfEditorStore();

    const handleKeyDown = useCallback((e) => {
        // Ignore when typing in inputs/textareas
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

        // Also ignore when Fabric.js IText is being edited
        const fc = fabricCanvasRef?.current;
        if (fc) {
            const active = fc.getActiveObject();
            if (active && active.isEditing) return;
        }

        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const key = e.key.toLowerCase();

        // ── Undo / Redo ──
        if (ctrl && !shift && key === 'z') {
            e.preventDefault();
            onUndo?.();
            return;
        }
        if (ctrl && (key === 'y' || (shift && key === 'z'))) {
            e.preventDefault();
            onRedo?.();
            return;
        }

        // ── Save (Ctrl+S) ──
        if (ctrl && key === 's') {
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

        // ── Escape — deselect or switch to select tool ──
        if (key === 'escape') {
            e.preventDefault();
            if (fc) fc.discardActiveObject();
            store.setActiveTool('select');
            fc?.renderAll();
            return;
        }

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
    }, [store, fabricCanvasRef, onUndo, onRedo, onPrevPage, onNextPage, onZoomIn, onZoomOut, onDelete, onSave]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return null; // No UI
};

export default ShortcutsHandler;
