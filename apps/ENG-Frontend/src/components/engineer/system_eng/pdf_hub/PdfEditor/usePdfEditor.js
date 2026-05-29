import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';

// ── PDF.js worker config (same CDN pattern as useSignStamp) ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================================================
// Coordinate Constants (proven math from useSignStamp.js)
// ============================================================================
const POINTS_PER_INCH = 72;
const MM_PER_INCH = 25.4;
export const MM_TO_POINTS = POINTS_PER_INCH / MM_PER_INCH; // 1mm ≈ 2.835pt

export function mmToPoints(mm) {
    return mm * MM_TO_POINTS;
}

/**
 * Convert Fabric.js screen coords → PDF point coords.
 * PDF: origin bottom-left, Y↑.  Screen: origin top-left, Y↓.
 */
export function screenToPdfCoords(sx, sy, canvasW, canvasH, pageW, pageH) {
    const scaleX = pageW / canvasW;
    const scaleY = pageH / canvasH;
    return {
        pdfX: sx * scaleX,
        pdfY: pageH - sy * scaleY,
    };
}

// ============================================================================
// usePdfEditor — Master Hook
// ============================================================================
export default function usePdfEditor() {
    // ── PDF Document State ──
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);         // pdfjs-dist (rendering)
    const [pdfLibDoc, setPdfLibDoc] = useState(null);    // pdf-lib (manipulation)
    const [pdfBytes, setPdfBytes] = useState(null);      // Raw Uint8Array
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1.0);
    const [pdfLoading, setPdfLoading] = useState(false);

    // ── Container ref for fit-to-width calculation ──
    const canvasWrapperRef = useRef(null);

    // ── Per-page Fabric.js annotation JSON ──
    const [pageAnnotations, setPageAnnotations] = useState({});

    // ── Per-page highlight data (plain objects, rendered on blend canvas) ──
    const [pageHighlights, setPageHighlights] = useState({});

    // ── History (undo/redo) ──
    const historyRef = useRef({ past: [], future: [] });

    // ── Merge mode state ──
    const [mergeFiles, setMergeFiles] = useState([]);

    // ── Export mode state ──
    const [exportedImages, setExportedImages] = useState([]);

    // ── History version for reactivity ──
    const [historyVersion, setHistoryVersion] = useState(0);

    // ── Fabric canvas refs map (for continuous scroll) ──
    const fabricCanvasRefs = useRef({});

    // ── Page size cache ──
    const [pageSize, setPageSize] = useState({ width: 612, height: 792 }); // Default letter

    // ── Thumbnail cache ──
    const [thumbnails, setThumbnails] = useState({});

    // ══════════════════════════════════════════════════════════════════
    // PDF Loading
    // ══════════════════════════════════════════════════════════════════
    const loadPdf = useCallback(async (file) => {
        setPdfLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            setPdfBytes(bytes);

            // pdfjs-dist for rendering
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setCurrentPage(1);

            // pdf-lib for manipulation
            const libDoc = await PDFDocument.load(arrayBuffer.slice(0));
            setPdfLibDoc(libDoc);

            setPdfFile(file);
            setPageAnnotations({});
            setPageHighlights({});
            setThumbnails({});
            historyRef.current = { past: [], future: [] };

            // Read first page dimensions
            const page = await doc.getPage(1);
            const vp = page.getViewport({ scale: 1.0 });
            setPageSize({ width: vp.width, height: vp.height });

            // Auto fit-to-width
            requestAnimationFrame(() => {
                if (canvasWrapperRef.current) {
                    const wrapperW = canvasWrapperRef.current.clientWidth - 60; // padding
                    const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                    setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                }
            });

            message.success(`Loaded: ${file.name} (${doc.numPages} pages)`);
        } catch (err) {
            console.error('Failed to load PDF:', err);
            message.error('Failed to load PDF. File may be corrupted or password-protected.');
        } finally {
            setPdfLoading(false);
        }
    }, []);

    // Load PDF from bytes (e.g., after merge)
    const loadPdfFromBytes = useCallback(async (bytes, filename = 'merged.pdf') => {
        setPdfLoading(true);
        try {
            const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            setPdfBytes(uint8);

            const doc = await pdfjsLib.getDocument({ data: uint8.slice(0) }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setCurrentPage(1);

            const libDoc = await PDFDocument.load(uint8.slice(0));
            setPdfLibDoc(libDoc);

            setPdfFile({ name: filename, size: uint8.length });
            setPageAnnotations({});
            setPageHighlights({});
            setThumbnails({});
            historyRef.current = { past: [], future: [] };

            const page = await doc.getPage(1);
            const vp = page.getViewport({ scale: 1.0 });
            setPageSize({ width: vp.width, height: vp.height });

            // Auto fit-to-width
            requestAnimationFrame(() => {
                if (canvasWrapperRef.current) {
                    const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                    const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                    setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                }
            });
        } catch (err) {
            console.error('Failed to load PDF from bytes:', err);
            message.error('Failed to process PDF.');
        } finally {
            setPdfLoading(false);
        }
    }, []);

    // ══════════════════════════════════════════════════════════════════
    // Page Navigation
    // ══════════════════════════════════════════════════════════════════
    const goToPage = useCallback(async (pageNum) => {
        if (!pdfDoc || pageNum < 1 || pageNum > totalPages) return;

        // Note: The actual DOM scrolling will be handled by the continuous scroll container
        setCurrentPage(pageNum);

        // Update page size for the target page
        try {
            const page = await pdfDoc.getPage(pageNum);
            const vp = page.getViewport({ scale: 1.0 });
            setPageSize({ width: vp.width, height: vp.height });
        } catch (err) {
            console.error('Error getting page size:', err);
        }
    }, [pdfDoc, totalPages, currentPage]);

    const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
    const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

    // ══════════════════════════════════════════════════════════════════
    // Zoom
    // ══════════════════════════════════════════════════════════════════
    const zoomIn = useCallback(() => setZoom(z => Math.min(3.0, +(z + 0.25).toFixed(2))), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2))), []);
    const zoomTo = useCallback((val) => setZoom(Math.max(0.25, Math.min(3.0, val))), []);

    // ══════════════════════════════════════════════════════════════════
    // Undo / Redo (snapshot-based per page)
    // ══════════════════════════════════════════════════════════════════
    const pushHistory = useCallback((pageNum) => {
        const fc = fabricCanvasRefs?.current?.[pageNum];
        if (!fc) return;
        const fabricSnapshot = JSON.stringify(fc.toJSON(['customData']));
        // Snapshot highlights for this page too
        const highlightSnapshot = JSON.stringify(
            (typeof pageHighlights === 'object' ? pageHighlights : {})[pageNum] || []
        );
        historyRef.current.past.push({ pageNum, fabricSnapshot, highlightSnapshot });
        historyRef.current.future = []; // Clear redo stack
        // Cap at 50 entries
        if (historyRef.current.past.length > 50) {
            historyRef.current.past.shift();
        }
        setHistoryVersion(v => v + 1);
    }, [pageHighlights]);

    const undo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (past.length === 0) return;

        const prevEntry = past.pop();
        const { pageNum, fabricSnapshot, highlightSnapshot } = prevEntry;
        const fc = fabricCanvasRefs?.current?.[pageNum];
        
        if (!fc) {
            // Put it back if canvas isn't rendered
            past.push(prevEntry);
            return;
        }

        // Save current state to future (redo)
        const currentFabricSnapshot = JSON.stringify(fc.toJSON(['customData']));
        const currentHighlightSnapshot = JSON.stringify(
            (typeof pageHighlights === 'object' ? pageHighlights : {})[pageNum] || []
        );
        future.push({ pageNum, fabricSnapshot: currentFabricSnapshot, highlightSnapshot: currentHighlightSnapshot });

        // Restore fabric
        const parsedSnapshot = typeof fabricSnapshot === 'string' ? JSON.parse(fabricSnapshot) : fabricSnapshot;
        fc.loadFromJSON(parsedSnapshot, () => {
            fc.requestRenderAll();
        });

        // Restore highlights
        if (highlightSnapshot) {
            const restoredHL = typeof highlightSnapshot === 'string' ? JSON.parse(highlightSnapshot) : highlightSnapshot;
            setPageHighlights(prev => ({ ...prev, [pageNum]: restoredHL }));
        }

        setHistoryVersion(v => v + 1);
        setCurrentPage(pageNum);
    }, [pageHighlights]);

    const redo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (future.length === 0) return;

        const nextEntry = future.pop();
        const { pageNum, fabricSnapshot, highlightSnapshot } = nextEntry;
        const fc = fabricCanvasRefs?.current?.[pageNum];
        
        if (!fc) {
            future.push(nextEntry);
            return;
        }

        // Save current state to past (undo)
        const currentFabricSnapshot = JSON.stringify(fc.toJSON(['customData']));
        const currentHighlightSnapshot = JSON.stringify(
            (typeof pageHighlights === 'object' ? pageHighlights : {})[pageNum] || []
        );
        past.push({ pageNum, fabricSnapshot: currentFabricSnapshot, highlightSnapshot: currentHighlightSnapshot });

        // Restore fabric
        const parsedSnapshot = typeof fabricSnapshot === 'string' ? JSON.parse(fabricSnapshot) : fabricSnapshot;
        fc.loadFromJSON(parsedSnapshot, () => {
            fc.requestRenderAll();
        });

        // Restore highlights
        if (highlightSnapshot) {
            const restoredHL = typeof highlightSnapshot === 'string' ? JSON.parse(highlightSnapshot) : highlightSnapshot;
            setPageHighlights(prev => ({ ...prev, [pageNum]: restoredHL }));
        }

        setHistoryVersion(v => v + 1);
        setCurrentPage(pageNum);
    }, [pageHighlights]);

    const canUndo = historyRef.current.past.length > 0;
    const canRedo = historyRef.current.future.length > 0;

    // ══════════════════════════════════════════════════════════════════
    // Save Current Page State (All active canvases)
    // ══════════════════════════════════════════════════════════════════
    const saveCurrentPageState = useCallback(() => {
        setPageAnnotations(prev => {
            const next = { ...prev };
            Object.entries(fabricCanvasRefs.current).forEach(([pageNumStr, fc]) => {
                if (fc) {
                    const json = fc.toJSON(['customData']);
                    json._canvasWidth = fc.width;
                    json._canvasHeight = fc.height;
                    next[pageNumStr] = json;
                }
            });
            return next;
        });
    }, []);

    // ══════════════════════════════════════════════════════════════════
    // Get Annotation Count
    // ══════════════════════════════════════════════════════════════════
    const getAnnotationCount = useCallback((pageNum) => {
        const data = pageAnnotations[pageNum];
        return data?.objects?.length || 0;
    }, [pageAnnotations]);

    const totalAnnotations = Object.values(pageAnnotations)
        .reduce((sum, data) => sum + (data?.objects?.length || 0), 0);

    // Keyboard Shortcuts listener removed - now handled by ShortcutsHandler.jsx

    // ══════════════════════════════════════════════════════════════════
    // Return
    // ══════════════════════════════════════════════════════════════════
    return {
        // PDF state
        pdfFile, pdfDoc, pdfLibDoc, pdfBytes, totalPages,
        currentPage, zoom, pdfLoading, pageSize,

        // Actions
        loadPdf, loadPdfFromBytes,
        goToPage, nextPage, prevPage,
        zoomIn, zoomOut, zoomTo, setZoom,

        // Annotations
        pageAnnotations, setPageAnnotations,
        saveCurrentPageState, getAnnotationCount, totalAnnotations,

        // Highlights (blend layer)
        pageHighlights, setPageHighlights,

        // History
        pushHistory, undo, redo, canUndo, canRedo, historyVersion,

        // Merge
        mergeFiles, setMergeFiles,

        // Export
        exportedImages, setExportedImages,

        // Thumbnails
        thumbnails, setThumbnails,

        // Fabric refs map
        fabricCanvasRefs,

        // Container ref for fit-to-width
        canvasWrapperRef,
    };
}
