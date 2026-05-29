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

    // ── History (undo/redo) ──
    const historyRef = useRef({ past: [], future: [] });

    // ── Merge mode state ──
    const [mergeFiles, setMergeFiles] = useState([]);

    // ── Export mode state ──
    const [exportedImages, setExportedImages] = useState([]);

    // ── History version for reactivity ──
    const [historyVersion, setHistoryVersion] = useState(0);

    // ── Fabric canvas ref (set by EditorCanvas) ──
    const fabricCanvasRef = useRef(null);

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

        // Save current page's Fabric.js state before navigating
        if (fabricCanvasRef.current) {
            const json = fabricCanvasRef.current.toJSON(['customData']);
            json._canvasWidth = fabricCanvasRef.current.width;
            json._canvasHeight = fabricCanvasRef.current.height;
            setPageAnnotations(prev => ({ ...prev, [currentPage]: json }));
        }

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
    // Undo / Redo (snapshot-based)
    // ══════════════════════════════════════════════════════════════════
    const pushHistory = useCallback(() => {
        if (!fabricCanvasRef.current) return;
        const snapshot = fabricCanvasRef.current.toJSON(['customData']);
        historyRef.current.past.push(snapshot);
        historyRef.current.future = []; // Clear redo stack
        // Cap at 50 entries
        if (historyRef.current.past.length > 50) {
            historyRef.current.past.shift();
        }
        setHistoryVersion(v => v + 1);
    }, []);

    const undo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (past.length === 0 || !fabricCanvasRef.current) return;
        const current = fabricCanvasRef.current.toJSON(['customData']);
        future.push(current);
        const prev = past.pop();
        fabricCanvasRef.current.loadFromJSON(prev, () => {
            fabricCanvasRef.current.renderAll();
            setHistoryVersion(v => v + 1);
        });
    }, []);

    const redo = useCallback(() => {
        const { past, future } = historyRef.current;
        if (future.length === 0 || !fabricCanvasRef.current) return;
        const current = fabricCanvasRef.current.toJSON(['customData']);
        past.push(current);
        const next = future.pop();
        fabricCanvasRef.current.loadFromJSON(next, () => {
            fabricCanvasRef.current.renderAll();
            setHistoryVersion(v => v + 1);
        });
    }, []);

    const canUndo = historyRef.current.past.length > 0;
    const canRedo = historyRef.current.future.length > 0;

    // ══════════════════════════════════════════════════════════════════
    // Save Current Page State
    // ══════════════════════════════════════════════════════════════════
    const saveCurrentPageState = useCallback(() => {
        if (!fabricCanvasRef.current) return;
        const json = fabricCanvasRef.current.toJSON(['customData']);
        json._canvasWidth = fabricCanvasRef.current.width;
        json._canvasHeight = fabricCanvasRef.current.height;
        setPageAnnotations(prev => ({ ...prev, [currentPage]: json }));
    }, [currentPage]);

    // ══════════════════════════════════════════════════════════════════
    // Get Annotation Count
    // ══════════════════════════════════════════════════════════════════
    const getAnnotationCount = useCallback((pageNum) => {
        const data = pageAnnotations[pageNum];
        return data?.objects?.length || 0;
    }, [pageAnnotations]);

    const totalAnnotations = Object.values(pageAnnotations)
        .reduce((sum, data) => sum + (data?.objects?.length || 0), 0);

    // ══════════════════════════════════════════════════════════════════
    // Keyboard Shortcuts
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        const handler = (e) => {
            // Skip if inside input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
                e.preventDefault();
                redo();
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (fabricCanvasRef.current) {
                    const active = fabricCanvasRef.current.getActiveObjects();
                    if (active.length > 0) {
                        e.preventDefault();
                        pushHistory();
                        active.forEach(obj => fabricCanvasRef.current.remove(obj));
                        fabricCanvasRef.current.discardActiveObject();
                        fabricCanvasRef.current.renderAll();
                    }
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo, pushHistory]);

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

        // History
        pushHistory, undo, redo, canUndo, canRedo, historyVersion,

        // Merge
        mergeFiles, setMergeFiles,

        // Export
        exportedImages, setExportedImages,

        // Thumbnails
        thumbnails, setThumbnails,

        // Fabric ref
        fabricCanvasRef,

        // Container ref for fit-to-width
        canvasWrapperRef,
    };
}
