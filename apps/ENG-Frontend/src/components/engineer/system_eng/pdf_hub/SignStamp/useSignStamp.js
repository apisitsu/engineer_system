import { useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ============================================================================
// Constants — The Critical mm → PDF Point Math
// ============================================================================
const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72;
/** 1 mm = 72/25.4 ≈ 2.83465 PDF points */
export const MM_TO_POINTS = POINTS_PER_INCH / MM_PER_INCH;

/**
 * Convert millimeters to PDF points.
 * When printed at 100% scale, the result matches physical dimensions exactly.
 */
export function mmToPoints(mm) {
    return mm * MM_TO_POINTS;
}

/**
 * Convert screen (CSS pixel) coordinates to PDF point coordinates.
 * PDF origin = bottom-left, Y goes up. Screen origin = top-left, Y goes down.
 *
 * @param {number} screenX - X in CSS px on the canvas
 * @param {number} screenY - Y in CSS px on the canvas
 * @param {number} canvasDisplayWidth - CSS width of the rendered canvas
 * @param {number} canvasDisplayHeight - CSS height of the rendered canvas
 * @param {number} pageWidth - PDF page width in points
 * @param {number} pageHeight - PDF page height in points
 * @returns {{ pdfX: number, pdfY: number }}
 */
export function screenToPdfCoords(screenX, screenY, canvasDisplayWidth, canvasDisplayHeight, pageWidth, pageHeight) {
    const scaleX = pageWidth / canvasDisplayWidth;
    const scaleY = pageHeight / canvasDisplayHeight;
    return {
        pdfX: screenX * scaleX,
        pdfY: pageHeight - (screenY * scaleY), // Flip Y-axis
    };
}

/**
 * Custom hook encapsulating all Sign & Stamp business logic.
 */
export default function useSignStamp() {
    const { empNo } = useAuthStore();

    // ── PDF State ──
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);         // pdfjs-dist document
    const [pdfLibDoc, setPdfLibDoc] = useState(null);    // pdf-lib document (for manipulation)
    const [pdfBytes, setPdfBytes] = useState(null);      // Raw ArrayBuffer
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(1.0);
    const [pdfLoading, setPdfLoading] = useState(false);

    // ── Stamp/Signature Data (from backend) ──
    const [stampData, setStampData] = useState(null);
    const [stampLoading, setStampLoading] = useState(false);

    // ── Placements ──
    const [placements, setPlacements] = useState([]);   // Array of { id, type, pageNum, screenX, screenY, widthMm, heightMm }
    const [activeStampType, setActiveStampType] = useState(null); // 'stamp' | 'signature' | null
    const [selectedPlacementId, setSelectedPlacementId] = useState(null);

    // ── History (Undo/Redo) ──
    const [history, setHistory] = useState([[]]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const canvasContainerRef = useRef(null);

    // ── Push a new state to history ──
    const pushHistory = useCallback((newPlacements) => {
        setHistory(prev => {
            const trimmed = prev.slice(0, historyIndex + 1);
            return [...trimmed, newPlacements];
        });
        setHistoryIndex(prev => prev + 1);
    }, [historyIndex]);

    // ── Undo ──
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setPlacements(history[newIndex]);
        }
    }, [historyIndex, history]);

    // ── Redo ──
    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setPlacements(history[newIndex]);
        }
    }, [historyIndex, history]);

    // ── Load PDF from file ──
    const loadPdf = useCallback(async (file) => {
        setPdfLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            setPdfBytes(new Uint8Array(arrayBuffer));

            // Load with pdfjs-dist for rendering
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setCurrentPage(1);

            // Load with pdf-lib for manipulation
            const libDoc = await PDFDocument.load(arrayBuffer.slice(0));
            setPdfLibDoc(libDoc);

            setPdfFile(file);
            setPlacements([]);
            setHistory([[]]);
            setHistoryIndex(0);
            setActiveStampType(null);
            setSelectedPlacementId(null);
        } catch (err) {
            console.error('Failed to load PDF:', err);
            message.error('Failed to load PDF. The file may be corrupted or password protected.');
        } finally {
            setPdfLoading(false);
        }
    }, []);

    // ── Fetch user stamp data from backend ──
    const fetchStamps = useCallback(async (emId) => {
        const targetId = emId || empNo;
        if (!targetId) return;

        setStampLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${server.PDF_HUB_STAMPS}/${targetId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.data?.result === 'true') {
                setStampData(res.data.data);
            }
        } catch (err) {
            if (err.response?.status !== 404) {
                console.error('Failed to fetch stamps:', err);
            }
            // 404 is expected if user has no stamps yet
            setStampData(null);
        } finally {
            setStampLoading(false);
        }
    }, [empNo]);

    // Auto-fetch stamps on mount
    useEffect(() => {
        fetchStamps();
    }, [fetchStamps]);

    // ── Upload/Update stamp ──
    const uploadStamp = useCallback(async (data) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(server.PDF_HUB_STAMPS, data, {
                headers: { Authorization: `Bearer ${token}` },
            });
            message.success('Stamp saved successfully');
            await fetchStamps(data.em_id);
        } catch (err) {
            console.error('Failed to save stamp:', err);
            message.error('Failed to save stamp');
        }
    }, [fetchStamps]);

    // ── Add a placement to the canvas ──
    const addPlacement = useCallback((screenX, screenY, canvasWidth, canvasHeight) => {
        if (!activeStampType || !stampData) return;

        const isStamp = activeStampType === 'stamp';
        const widthMm = isStamp ? stampData.stamp_width_mm : stampData.sig_width_mm;
        const heightMm = isStamp ? stampData.stamp_height_mm : stampData.sig_height_mm;

        const newPlacement = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            type: activeStampType,
            pageNum: currentPage,
            screenX,
            screenY,
            widthMm,
            heightMm,
            canvasWidth,
            canvasHeight,
        };

        const newPlacements = [...placements, newPlacement];
        setPlacements(newPlacements);
        pushHistory(newPlacements);
        setSelectedPlacementId(newPlacement.id);
    }, [activeStampType, stampData, currentPage, placements, pushHistory]);

    // ── Update placement position (after drag) ──
    const updatePlacementPosition = useCallback((id, screenX, screenY) => {
        const newPlacements = placements.map(p =>
            p.id === id ? { ...p, screenX, screenY } : p
        );
        setPlacements(newPlacements);
        pushHistory(newPlacements);
    }, [placements, pushHistory]);

    // ── Delete a placement ──
    const removePlacement = useCallback((id) => {
        const newPlacements = placements.filter(p => p.id !== id);
        setPlacements(newPlacements);
        pushHistory(newPlacements);
        if (selectedPlacementId === id) setSelectedPlacementId(null);
    }, [placements, selectedPlacementId, pushHistory]);

    // ── Apply all stamps to PDF and download ──
    const applyAndDownload = useCallback(async () => {
        if (!pdfBytes || !stampData || placements.length === 0) {
            message.warning('No stamps placed on the document.');
            return;
        }

        try {
            // Create a fresh pdf-lib document from the original bytes
            const doc = await PDFDocument.load(pdfBytes);
            const pages = doc.getPages();

            // Prepare stamp/signature images
            let stampImg = null;
            let sigImg = null;

            if (stampData.stamp_image) {
                const stampBytes = Uint8Array.from(atob(stampData.stamp_image), c => c.charCodeAt(0));
                try {
                    stampImg = await doc.embedPng(stampBytes);
                } catch {
                    stampImg = await doc.embedJpg(stampBytes);
                }
            }

            if (stampData.signature_image) {
                const sigBytes = Uint8Array.from(atob(stampData.signature_image), c => c.charCodeAt(0));
                try {
                    sigImg = await doc.embedPng(sigBytes);
                } catch {
                    sigImg = await doc.embedJpg(sigBytes);
                }
            }

            // Apply each placement
            for (const placement of placements) {
                const pageIndex = placement.pageNum - 1;
                if (pageIndex < 0 || pageIndex >= pages.length) continue;

                const page = pages[pageIndex];
                const pageWidth = page.getWidth();
                const pageHeight = page.getHeight();

                const img = placement.type === 'stamp' ? stampImg : sigImg;
                if (!img) continue;

                // Convert mm dimensions to PDF points
                const widthPt = mmToPoints(placement.widthMm);
                const heightPt = mmToPoints(placement.heightMm);

                // Convert screen position to PDF coordinates
                const { pdfX, pdfY } = screenToPdfCoords(
                    placement.screenX,
                    placement.screenY,
                    placement.canvasWidth,
                    placement.canvasHeight,
                    pageWidth,
                    pageHeight
                );

                // drawImage uses bottom-left as anchor point
                page.drawImage(img, {
                    x: pdfX,
                    y: pdfY - heightPt,
                    width: widthPt,
                    height: heightPt,
                });
            }

            // Save and download
            const finalBytes = await doc.save();
            const blob = new Blob([finalBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `signed_${pdfFile?.name || 'document'}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            message.success('Signed PDF downloaded successfully!');
        } catch (err) {
            console.error('Failed to apply stamps:', err);
            message.error('Failed to apply stamps to PDF.');
        }
    }, [pdfBytes, stampData, placements, pdfFile]);

    return {
        // PDF state
        pdfFile, pdfDoc, totalPages, currentPage, zoom, pdfLoading,
        setPdfFile, setCurrentPage, setZoom, loadPdf,

        // Stamp data
        stampData, stampLoading, fetchStamps, uploadStamp,

        // Placements
        placements, activeStampType, selectedPlacementId,
        setActiveStampType, setSelectedPlacementId,
        addPlacement, updatePlacementPosition, removePlacement,

        // Actions
        applyAndDownload, undo, redo,
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,

        // Refs
        canvasContainerRef,
    };
}
