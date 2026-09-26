import { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { pdfjsLib } from '../../pdfWorkerConfig';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';

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

            // ── Auto-Detect & Unlock Encrypted / Protected PDF First ──
            // Note: Standard Security (empty password / permissions) parses in PDF.js without error,
            // but causes corrupted ciphertext streams in pdf-lib if not decrypted beforehand!
            let isEncrypted = false;
            try {
                const testDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
                isEncrypted = !!testDoc.isEncrypted;
            } catch (e) {
                isEncrypted = true;
            }
            if (!isEncrypted) {
                try {
                    const tail = new TextDecoder('latin1').decode(bytes.slice(-16384));
                    if (tail.includes('/Encrypt')) isEncrypted = true;
                } catch {}
            }

            if (isEncrypted) {
                console.log('Protected/encrypted PDF detected. Auto-unlocking via backend...');
                try {
                    const formData = new FormData();
                    formData.append('pdf', new Blob([bytes], { type: 'application/pdf' }), file.name || 'document.pdf');
                    const token = localStorage.getItem('token');
                    const res = await axios.post(server.PDF_UNLOCK, formData, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        proxy: false,
                        responseType: 'arraybuffer'
                    });
                    if (res.data && res.data.byteLength > 0) {
                        finalBytes = new Uint8Array(res.data);
                        setPdfBytes(finalBytes);
                        console.log('PDF auto-unlocked successfully before rendering!');
                    }
                } catch (unlockErr) {
                    console.warn('Backend auto-unlock failed, continuing with original bytes:', unlockErr);
                }
            }

            // ── Fast Direct Parse with PDF.js Worker (0ms main thread blocking) ──
            try {
                doc = await pdfjsLib.getDocument({ data: finalBytes.slice(0) }).promise;
            } catch (pdfJsErr) {
                console.warn('Direct PDF.js parse failed, attempting backend repair...', pdfJsErr);
                // ── Fallback 1: Try backend repair only if direct parse failed ──
                try {
                    const formData = new FormData();
                    formData.append('pdf', new Blob([bytes], { type: 'application/pdf' }), file.name || 'document.pdf');
                    
                    const token = localStorage.getItem('token');
                    const res = await axios.post(server.PDF_REPAIR, formData, {
                        headers: { Authorization: `Bearer ${token}` },
                        responseType: 'arraybuffer'
                    });
                    
                    finalBytes = new Uint8Array(res.data);
                    doc = await pdfjsLib.getDocument({ data: finalBytes.slice(0) }).promise;
                    console.log('PDF repaired and rebuilt via backend successfully!');
                } catch (repairErr) {
                    console.warn('Backend repair failed, falling back to original bytes:', repairErr);
                }
            }

            // ── Fallback 2: Backend Unlock if still locked/protected ──
            if (!doc) {
                console.warn('PDF.js rendering failed, attempting backend unlock...');
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
                    message.success('PDF unlocked successfully via backend!');
                } catch (unlockErr) {
                    console.error('Failed to unlock PDF:', unlockErr);
                }
            }

            // ── Fallback 3: Try pdf-lib for non-renderable/protected documents ──
            if (!doc) {
                try {
                    libDoc = await PDFDocument.load(finalBytes, { ignoreEncryption: true });
                } catch (libErr) {
                    console.warn('pdf-lib fallback failed:', libErr);
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

                const applyFitZoom = () => {
                    if (canvasWrapperRef.current && setZoom && vp.width > 0) {
                        const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                        if (wrapperW > 100) {
                            const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                            setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                            return true;
                        }
                    }
                    return false;
                };

                if (!applyFitZoom()) {
                    requestAnimationFrame(applyFitZoom);
                }
                message.success(`Loaded: ${file.name} (${doc.numPages} pages)`);
            }
        } catch (err) {
            console.error('Failed to load PDF:', err);
            message.error('Failed to load PDF. File may be corrupted or password-protected.');
        } finally {
            setPdfLoading(false);
        }
    }, [canvasWrapperRef, setZoom, message]);

    const loadPdfFromBytes = useCallback(async (bytes, filename = 'document.pdf', callbacks = {}) => {
        setPdfLoading(true);
        try {
            const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            let finalBytes = uint8;

            // ── Auto-Detect & Unlock Encrypted PDF Bytes ──
            let isEncrypted = false;
            try {
                const testDoc = await PDFDocument.load(finalBytes, { ignoreEncryption: true, throwOnInvalidObject: false });
                isEncrypted = !!testDoc.isEncrypted;
            } catch (e) {
                isEncrypted = true;
            }
            if (!isEncrypted) {
                try {
                    const tail = new TextDecoder('latin1').decode(finalBytes.slice(-16384));
                    if (tail.includes('/Encrypt')) isEncrypted = true;
                } catch {}
            }

            if (isEncrypted) {
                console.log('Protected/encrypted PDF bytes detected. Auto-unlocking via backend...');
                try {
                    const formData = new FormData();
                    formData.append('pdf', new Blob([finalBytes], { type: 'application/pdf' }), filename);
                    const token = localStorage.getItem('token');
                    const res = await axios.post(server.PDF_UNLOCK, formData, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        proxy: false,
                        responseType: 'arraybuffer'
                    });
                    if (res.data && res.data.byteLength > 0) {
                        finalBytes = new Uint8Array(res.data);
                        setPdfBytes(finalBytes);
                        console.log('PDF bytes auto-unlocked successfully before rendering!');
                    }
                } catch (unlockErr) {
                    console.warn('Backend auto-unlock failed for bytes:', unlockErr);
                }
            }

            setPdfBytes(finalBytes);

            // Fast PDF.js parse via Web Worker
            const doc = await pdfjsLib.getDocument({ data: finalBytes.slice(0) }).promise;
            if (!doc) throw new Error('Failed to parse PDF pages with PDF.js');

            setPdfDoc(doc);
            setPdfLibDoc(null);

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

            const applyFitZoom = () => {
                if (canvasWrapperRef.current && setZoom && vp.width > 0) {
                    const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                    if (wrapperW > 100) {
                        const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                        setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                        return true;
                    }
                }
                return false;
            };

            if (!applyFitZoom()) {
                requestAnimationFrame(applyFitZoom);
            }
            message.success(`Loaded: ${filename} (${doc.numPages} pages)`);
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
