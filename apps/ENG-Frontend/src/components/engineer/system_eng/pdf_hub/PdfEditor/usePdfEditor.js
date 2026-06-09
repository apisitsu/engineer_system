import { useState, useRef, useCallback } from 'react';
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
        loadPdf: _loadPdf, loadPdfFromBytes: _loadPdfFromBytes, goToPage, nextPage, prevPage
    } = usePdfDocument(canvasWrapperRef, setZoom);

    // ── 2. Annotation State ──
    const { 
        pageAnnotations, setPageAnnotations, 
        pageHighlights, setPageHighlights, 
        getAnnotationCount, totalAnnotations, clearAllAnnotations
    } = useAnnotations();

    // ── 3. History State ──
    const { 
        pushHistory: _pushHistory, saveCurrentPageState, undo: _undo, redo: _redo, clearHistory, canUndo, canRedo, historyVersion 
    } = useHistory(setPageAnnotations, setPageHighlights);

    // Wrapper for pushHistory to capture current state
    const pushHistoryRef = useRef();
    pushHistoryRef.current = () => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            if (fc) {
                const json = fc.toJSON(['customData']);
                json._canvasWidth = fc.width;
                json._canvasHeight = fc.height;
                currentAnnotations[pNum] = json;
            }
        });
        _pushHistory({
            annotations: currentAnnotations,
            highlights: { ...pageHighlights }
        });
    };

    const pushHistory = useCallback(() => {
        if (pushHistoryRef.current) pushHistoryRef.current();
    }, []);

    const _applyStateToCanvases = (restoredState) => {
        if (!restoredState) return;
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            if (fc && restoredState.annotations[pNum]) {
                fc.loadFromJSON(restoredState.annotations[pNum]).then(() => {
                    fc.renderAll();
                }).catch(err => console.error("loadFromJSON error:", err));
            } else if (fc) {
                fc.clear();
            }
        });
    };

    const undo = () => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            if (fc) {
                const json = fc.toJSON(['customData']);
                json._canvasWidth = fc.width;
                json._canvasHeight = fc.height;
                currentAnnotations[pNum] = json;
            }
        });
        const restoredState = _undo(currentAnnotations, { ...pageHighlights });
        _applyStateToCanvases(restoredState);
    };

    const redo = () => {
        const currentAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs.current || {}).forEach(([pNum, fc]) => {
            if (fc) {
                const json = fc.toJSON(['customData']);
                json._canvasWidth = fc.width;
                json._canvasHeight = fc.height;
                currentAnnotations[pNum] = json;
            }
        });
        const restoredState = _redo(currentAnnotations, { ...pageHighlights });
        _applyStateToCanvases(restoredState);
    };

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
        clearHistory();
    };

    return {
        // Document
        pdfFile, pdfDoc, pdfLibDoc, pdfBytes, totalPages, currentPage, pdfLoading, pageSize,
        loadPdf, loadPdfFromBytes, goToPage, nextPage, prevPage,
        
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
