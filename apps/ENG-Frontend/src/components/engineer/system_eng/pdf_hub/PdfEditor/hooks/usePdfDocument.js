import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';

// ── PDF.js worker config ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
    `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * usePdfDocument — Handles loading, repairing, unlocking, and parsing PDF files.
 */
export default function usePdfDocument(canvasWrapperRef, setZoom) {
    const { message } = App.useApp();

    const [pdfFile, setPdfFile] = useState(null);
    const [pdfDoc, setPdfDoc] = useState(null);         // pdfjs-dist (rendering)
    const [pdfLibDoc, setPdfLibDoc] = useState(null);   // pdf-lib (manipulation)
    const [pdfBytes, setPdfBytes] = useState(null);     // Raw Uint8Array
    const [totalPages, setTotalPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pageSize, setPageSize] = useState({ width: 612, height: 792 }); // Default letter

    const loadPdf = useCallback(async (file, callbacks = {}) => {
        setPdfLoading(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            setPdfBytes(bytes);

            let doc = null;
            let libDoc = null;
            let finalBytes = bytes;

            // ── Try backend repair ──
            try {
                const formData = new FormData();
                formData.append('pdf', new Blob([bytes], { type: 'application/pdf' }), file.name || 'document.pdf');
                
                const token = localStorage.getItem('token');
                const res = await axios.post(server.PDF_REPAIR, formData, {
                    headers: { Authorization: `Bearer ${token}` },
                    responseType: 'arraybuffer'
                });
                
                finalBytes = new Uint8Array(res.data);
                console.log('PDF repaired and rebuilt via backend successfully!');
            } catch (repairErr) {
                console.warn('Backend repair failed, falling back to original bytes:', repairErr);
                finalBytes = bytes;
            }

            try {
                libDoc = await PDFDocument.load(finalBytes.slice(0), { ignoreEncryption: true });
            } catch (e) {
                console.warn('pdf-lib failed to load doc during init:', e);
            }

            try {
                doc = await pdfjsLib.getDocument({ data: finalBytes.slice(0) }).promise;
            } catch (renderErr) {
                console.warn('PDF.js rendering failed, attempting backend unlock...', renderErr);
                try {
                    const formData = new FormData();
                    formData.append('pdf', new Blob([finalBytes], { type: 'application/pdf' }), file.name || 'document.pdf');
                    
                    const token = localStorage.getItem('token');
                    const res = await axios.post(server.PDF_UNLOCK, formData, {
                        headers: { Authorization: `Bearer ${token}` },
                        responseType: 'arraybuffer'
                    });
                    
                    finalBytes = new Uint8Array(res.data);
                    
                    doc = await pdfjsLib.getDocument({ data: finalBytes.slice(0) }).promise;
                    libDoc = await PDFDocument.load(finalBytes); 
                    message.success('PDF unlocked successfully via backend!');
                } catch (unlockErr) {
                    console.error('Failed to unlock PDF:', unlockErr);
                }
            }

            setPdfBytes(finalBytes);
            setPdfDoc(doc);
            setPdfLibDoc(libDoc);

            if (doc) {
                setTotalPages(doc.numPages);
                setCurrentPage(1);
            } else {
                setPdfDoc(null);
                setTotalPages(libDoc ? libDoc.getPageCount() : 0);
                setCurrentPage(1);
                message.warning('PDF is protected. Viewer disabled, but you can still apply watermarks and Save.', 5);
            }

            setPdfFile(file);

            if (callbacks.onLoadSuccess) {
                callbacks.onLoadSuccess();
            }

            if (doc) {
                const page = await doc.getPage(1);
                const vp = page.getViewport({ scale: 1.0 });
                setPageSize({ width: vp.width, height: vp.height });

                requestAnimationFrame(() => {
                    if (canvasWrapperRef.current && setZoom) {
                        const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                        const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                        setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                    }
                });
                message.success(`Loaded: ${file.name} (${doc.numPages} pages)`);
            }
        } catch (err) {
            console.error('Failed to load PDF:', err);
            message.error('Failed to load PDF. File may be corrupted or password-protected.');
        } finally {
            setPdfLoading(false);
        }
    }, [canvasWrapperRef, setZoom, message]);

    const loadPdfFromBytes = useCallback(async (bytes, filename = 'merged.pdf', callbacks = {}) => {
        setPdfLoading(true);
        try {
            const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            setPdfBytes(uint8);

            const doc = await pdfjsLib.getDocument({ data: uint8.slice(0) }).promise;
            setPdfDoc(doc);

            const libDoc = await PDFDocument.load(uint8.slice(0), { ignoreEncryption: true });
            setPdfLibDoc(libDoc);

            setTotalPages(doc.numPages);
            setCurrentPage(1);
            
            const dummyFile = new File([uint8], filename, { type: 'application/pdf' });
            setPdfFile(dummyFile);

            if (callbacks.onLoadSuccess) {
                callbacks.onLoadSuccess();
            }

            const page = await doc.getPage(1);
            const vp = page.getViewport({ scale: 1.0 });
            setPageSize({ width: vp.width, height: vp.height });

            requestAnimationFrame(() => {
                if (canvasWrapperRef.current && setZoom) {
                    const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                    const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                    setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                }
            });
            message.success(`Loaded merged PDF (${doc.numPages} pages)`);
        } catch (err) {
            console.error('Failed to load bytes:', err);
            message.error('Failed to render PDF from bytes.');
            throw err;
        } finally {
            setPdfLoading(false);
        }
    }, [canvasWrapperRef, setZoom, message]);

    const goToPage = useCallback((pageNum) => {
        if (pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
        }
    }, [totalPages]);

    const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
    const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

    const closePdf = useCallback(() => {
        setPdfFile(null);
        setPdfDoc(null);
        setPdfLibDoc(null);
        setPdfBytes(null);
        setTotalPages(0);
        setCurrentPage(1);
    }, []);

    return {
        pdfFile, pdfDoc, pdfLibDoc, pdfBytes, totalPages, currentPage, pdfLoading, pageSize,
        loadPdf, loadPdfFromBytes, closePdf, goToPage, nextPage, prevPage
    };
}
