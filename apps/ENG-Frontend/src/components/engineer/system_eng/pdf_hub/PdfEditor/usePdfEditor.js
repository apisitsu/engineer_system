import { useState, useRef, useCallback } from 'react';
import './engine/fabricSafeguard';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import usePdfDocument from './hooks/usePdfDocument';
import useAnnotations from './hooks/useAnnotations';
import useHistory from './hooks/useHistory';
import useMerge from './hooks/useMerge';
import useExport from './hooks/useExport';

/**
 * usePdfEditor — Master Composition Hook
 * Composes individual domain hooks into a single interface for PdfEditorTool.
 */
export default function usePdfEditor() {
    // ── Container ref for fit-to-width calculation ──
    const canvasWrapperRef = useRef(null);
    const fabricCanvasRefs = useRef({});
    const [zoom, setZoom] = useState(1.0);
    const [thumbnails, setThumbnails] = useState({});

    // ── 1. Document State ──
    const { 
        pdfFile, pdfDoc, pdfLibDoc, pdfBytes, totalPages, currentPage, pdfLoading, pageSize,
        loadPdf: _loadPdf, loadPdfFromBytes: _loadPdfFromBytes, goToPage, nextPage, prevPage, closePdf: _closePdf
    } = usePdfDocument(canvasWrapperRef, setZoom);

    // ── 2. Annotation State ──
    const { 
        pageAnnotations, setPageAnnotations, 
        pageHighlights, setPageHighlights, 
        getAnnotationCount, totalAnnotations, clearAllAnnotations
    } = useAnnotations();

    // ── 3. History State ──
    const { 
        pushHistory: _pushHistory, saveCurrentPageState: _saveCurrentPageState, undo: _undo, redo: _redo, clearHistory, canUndo, canRedo, historyVersion 
    } = useHistory(setPageAnnotations, setPageHighlights);

    const deepCloneHighlights = (hls) => {
        const out = {};
        Object.entries(hls || {}).forEach(([pNum, arr]) => {
            out[pNum] = Array.isArray(arr) ? arr.map(h => ({ ...h })) : [];
        });
        return out;
    };

    const getCanvasSnapshot = (fc) => {
        if (!fc) return null;
        // Do not call discardActiveObject here, as doing so during an active transform
        // causes Fabric to recursively re-invoke endCurrentTransform and crash the call stack.
        const propertiesToInclude = [
            'customData', 'textLines', 'id', 'text', 'fontSize', 'fontFamily', 
            'fontWeight', 'fontStyle', 'underline', 'textAlign', 'fill', 'stroke', 
            'strokeWidth', 'opacity'
        ];
        const json = fc.toObject ? fc.toObject(propertiesToInclude) : fc.toJSON(propertiesToInclude);
        json._canvasWidth = fc.width;
        json._canvasHeight = fc.height;
        if (json && Array.isArray(json.objects)) {
            json.objects.forEach(obj => {
                if (obj && (obj.type === 'FabricText' || obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
                    if (obj.text === undefined || obj.text === null) {
                        obj.text = '';
                    }
                }
            });
        }
        return json;
    };

    // Resilient saveCurrentPageState that defaults to currentPage and its active canvas
    const saveCurrentPageState = useCallback((pageNum, canvas, highlightsState) => {
        const targetPage = pageNum || currentPage;
        const targetCanvas = canvas || fabricCanvasRefs.current?.[targetPage];
        const targetHighlights = highlightsState !== undefined ? highlightsState : pageHighlights[targetPage];
        if (targetCanvas) {
            return _saveCurrentPageState(targetPage, targetCanvas, targetHighlights);
        }
    }, [currentPage, fabricCanvasRefs, pageHighlights, _saveCurrentPageState]);

    // Wrapper for pushHistory to capture current state
    const pushHistoryRef = useRef();
    pushHistoryRef.current = () => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            const json = getCanvasSnapshot(fc);
            if (json) {
                currentAnnotations[pNum] = json;
            }
        });
        _pushHistory({
            annotations: currentAnnotations,
            highlights: deepCloneHighlights(pageHighlights)
        });
    };

    const pushHistory = useCallback(() => {
        if (pushHistoryRef.current) pushHistoryRef.current();
    }, []);

    const _applyStateToCanvases = useCallback((restoredState) => {
        if (!restoredState) return;
        // Deselect any active object in store to avoid stale selection handles
        usePdfEditorStore.getState().clearSelection();

        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            if (fc) {
                try {
                    fc.discardActiveObject();
                } catch (e) {
                    console.warn("discardActiveObject warning:", e);
                }
            }
            if (fc && restoredState.annotations?.[pNum]) {
                fc.loadFromJSON(restoredState.annotations[pNum]).then(() => {
                    fc.renderAll();
                    usePdfEditorStore.getState().setCanvasObjectCount(Number(pNum), fc.getObjects().length);
                }).catch(err => console.error("loadFromJSON error:", err));
            } else if (fc) {
                fc.clear();
                fc.renderAll();
                usePdfEditorStore.getState().setCanvasObjectCount(Number(pNum), 0);
            }
        });
    }, [fabricCanvasRefs]);

    const undo = useCallback(() => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            const json = getCanvasSnapshot(fc);
            if (json) {
                currentAnnotations[pNum] = json;
            }
        });
        const restoredState = _undo(currentAnnotations, deepCloneHighlights(pageHighlights));
        _applyStateToCanvases(restoredState);
    }, [pageAnnotations, pageHighlights, _undo, _applyStateToCanvases, fabricCanvasRefs]);

    const redo = useCallback(() => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            const json = getCanvasSnapshot(fc);
            if (json) {
                currentAnnotations[pNum] = json;
            }
        });
        const restoredState = _redo(currentAnnotations, deepCloneHighlights(pageHighlights));
        _applyStateToCanvases(restoredState);
    }, [pageAnnotations, pageHighlights, _redo, _applyStateToCanvases, fabricCanvasRefs]);

    // ── 4. Merge State ──
    const { mergeFiles, setMergeFiles } = useMerge();

    // ── 5. Export State ──
    const { exportedImages, setExportedImages } = useExport();

    // ── Zoom Controls ──
    const zoomIn = () => setZoom(z => Math.min(z + 0.25, 3.0));
    const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
    const zoomTo = (val) => setZoom(val);

    const loadPdf = async (file, callbacks) => {
        await _loadPdf(file, callbacks);
        setThumbnails({});
        clearAllAnnotations();
        Object.values(fabricCanvasRefs.current || {}).forEach(fc => {
            if (fc) fc.clear();
        });
        clearHistory();
    };

    const loadPdfFromBytes = async (bytes, filename, callbacks) => {
        await _loadPdfFromBytes(bytes, filename, callbacks);
        setThumbnails({});
        clearAllAnnotations();
        Object.values(fabricCanvasRefs.current || {}).forEach(fc => {
            if (fc) fc.clear();
        });
        clearHistory();
    };

    const closePdf = () => {
        _closePdf();
        setThumbnails({});
        clearAllAnnotations();
        Object.values(fabricCanvasRefs.current || {}).forEach(fc => {
            if (fc) fc.clear();
        });
        clearHistory();
    };

    return {
        // Document
        pdfFile, pdfDoc, pdfLibDoc, pdfBytes, totalPages, currentPage, pdfLoading, pageSize,
        loadPdf, loadPdfFromBytes, goToPage, nextPage, prevPage, closePdf,
        
        // Zoom & UI Refs
        zoom, setZoom, zoomIn, zoomOut, zoomTo,
        canvasWrapperRef, fabricCanvasRefs,
        thumbnails, setThumbnails,

        // Annotations
        pageAnnotations, setPageAnnotations,
        pageHighlights, setPageHighlights,
        getAnnotationCount, totalAnnotations, clearAllAnnotations,

        // History
        pushHistory, saveCurrentPageState, undo, redo, clearHistory, canUndo, canRedo, historyVersion,

        // Merge
        mergeFiles, setMergeFiles,

        // Export
        exportedImages, setExportedImages
    };
}

export * from './engine/commitHelpers'; // Re-export MM_TO_POINTS and coordinate math
