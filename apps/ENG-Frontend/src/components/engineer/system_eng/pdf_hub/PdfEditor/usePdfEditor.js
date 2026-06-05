import { useState, useRef } from 'react';
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
        loadPdf, loadPdfFromBytes, goToPage, nextPage, prevPage
    } = usePdfDocument(canvasWrapperRef, setZoom);

    // ── 2. Annotation State ──
    const { 
        pageAnnotations, setPageAnnotations, 
        pageHighlights, setPageHighlights, 
        getAnnotationCount, totalAnnotations, clearAllAnnotations
    } = useAnnotations();

    // ── 3. History State ──
    const { 
        pushHistory, saveCurrentPageState, undo, redo, clearHistory, canUndo, canRedo, historyVersion 
    } = useHistory(setPageAnnotations, setPageHighlights);

    // ── 4. Merge State ──
    const { mergeFiles, setMergeFiles } = useMerge();

    // ── 5. Export State ──
    const { exportedImages, setExportedImages } = useExport();

    // ── Zoom Controls ──
    const zoomIn = () => setZoom(z => Math.min(z + 0.25, 3.0));
    const zoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
    const zoomTo = (val) => setZoom(val);

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
