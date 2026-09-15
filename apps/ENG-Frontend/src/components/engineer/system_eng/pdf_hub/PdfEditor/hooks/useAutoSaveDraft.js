import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';
import { FABRIC_SERIALIZE_PROPS } from '../engine/commitHelpers';

/**
 * useAutoSaveDraft — Ultra-fast, memory-efficient debounced auto-saving of temporary drafts.
 *
 * Architecture:
 * - Base PDF uploaded ONCE per session directly as raw file (0ms client CPU impact).
 * - Subsequent auto-saves send ONLY a lightweight delta JSON (~5KB) to /draft/annotations.
 * - Scheduled via requestIdleCallback so active user drawing/gestures are never interrupted.
 * - Resumption reassembles the PDF on the server (Node.js) offloading work from client.
 */
export default function useAutoSaveDraft({
    pdfBytes,
    pdfFile,
    empNo,
    pageAnnotations,
    pageHighlights,
    fabricCanvasRefs,
    historyVersion,
    saveCurrentPageState,
}) {
    const [draftStatus, setDraftStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
    const [lastSavedTime, setLastSavedTime] = useState(null);

    const timerRef = useRef(null);
    const idleCallbackIdRef = useRef(null);
    const initialVersionRef = useRef(historyVersion);
    const isSavingRef = useRef(false);
    const hasUploadedBaseRef = useRef(false);
    const lastSavedJsonRef = useRef(null);

    // Reset tracking when document changes
    useEffect(() => {
        initialVersionRef.current = historyVersion;
        hasUploadedBaseRef.current = false;
        lastSavedJsonRef.current = null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfFile]);

    /**
     * Explicitly mark that the base PDF is already on the server (e.g. after resuming a draft)
     */
    const markBaseUploaded = useCallback((val = true) => {
        hasUploadedBaseRef.current = val;
    }, []);

    /**
     * Delete the draft from server & SQLite database
     */
    const deleteDraft = useCallback(async () => {
        if (!empNo) return;
        try {
            await axios.delete(`${server.PDF_HUB_DRAFT}?empno=${encodeURIComponent(empNo)}`);
            setDraftStatus('idle');
            setLastSavedTime(null);
            hasUploadedBaseRef.current = false;
            lastSavedJsonRef.current = null;
        } catch (err) {
            console.warn('[AutoSaveDraft] Failed to delete draft:', err.message);
        }
    }, [empNo]);

    /**
     * Check if user has an active draft on the server
     */
    const checkDraft = useCallback(async () => {
        if (!empNo) return { hasDraft: false, draft: null };
        try {
            const res = await axios.get(`${server.PDF_HUB_DRAFT}?empno=${encodeURIComponent(empNo)}`);
            if (res.data && res.data.result === 'true') {
                return { hasDraft: !!res.data.hasDraft, draft: res.data.draft };
            }
            return { hasDraft: false, draft: null };
        } catch (err) {
            console.warn('[AutoSaveDraft] Failed to check draft:', err.message);
            return { hasDraft: false, draft: null };
        }
    }, [empNo]);

    /**
     * Fetch draft PDF as a File object for resumption
     */
    const fetchDraftFile = useCallback(async () => {
        if (!empNo) return null;
        try {
            const res = await axios.get(`${server.PDF_HUB_DRAFT}/download?empno=${encodeURIComponent(empNo)}`, {
                responseType: 'blob'
            });
            const blob = res.data;
            const contentDisp = res.headers['content-disposition'] || '';
            let fileName = 'recovered_draft.pdf';
            const match = contentDisp.match(/filename="?([^";]+)"?/i);
            if (match && match[1]) {
                fileName = decodeURIComponent(match[1]);
            }
            return new File([blob], fileName, { type: 'application/pdf' });
        } catch (err) {
            console.error('[AutoSaveDraft] Failed to download draft:', err.message);
            return null;
        }
    }, [empNo]);

    /**
     * High-speed, non-blocking draft save.
     * Uses Delta JSON synchronization to eliminate client freezing and massive memory allocation.
     */
    const saveDraftNow = useCallback(async () => {
        if (!empNo || !pdfFile || isSavingRef.current) return;
        if (!pdfBytes && !(pdfFile instanceof File)) return;

        try {
            isSavingRef.current = true;
            setDraftStatus('saving');

            // Snapshot all current annotations without blocking UI
            const finalAnnotations = { ...pageAnnotations };
            Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
                if (fc && !fc.isDisposed) {
                    const json = fc.toObject ? fc.toObject(FABRIC_SERIALIZE_PROPS) : fc.toJSON(FABRIC_SERIALIZE_PROPS);
                    json._canvasWidth = fc.width;
                    json._canvasHeight = fc.height;
                    finalAnnotations[pageNumStr] = json;
                }
            });

            const projectData = {
                annotations: finalAnnotations,
                highlights: pageHighlights || {},
            };
            const jsonStr = JSON.stringify(projectData);

            // Skip network transfer if no changes since last save
            if (lastSavedJsonRef.current === jsonStr && hasUploadedBaseRef.current) {
                setDraftStatus('saved');
                return;
            }

            if (!hasUploadedBaseRef.current) {
                // ── STEP 1: Upload raw base PDF once (streamed directly, 0ms CPU) ──
                const formData = new FormData();
                if (pdfFile instanceof File) {
                    formData.append('file', pdfFile, pdfFile.name || 'draft.pdf');
                } else if (pdfBytes) {
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    formData.append('file', blob, pdfFile.name || 'draft.pdf');
                }
                formData.append('empno', empNo);
                formData.append('filename', pdfFile.name || 'draft.pdf');
                formData.append('original_filename', pdfFile.name || 'draft.pdf');
                formData.append('project_data', jsonStr);

                await axios.post(server.PDF_HUB_DRAFT, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                hasUploadedBaseRef.current = true;
                lastSavedJsonRef.current = jsonStr;
            } else {
                // ── STEP 2: Delta Sync — send ONLY lightweight JSON delta (~5KB) ──
                await axios.post(`${server.PDF_HUB_DRAFT}/annotations`, {
                    empno: empNo,
                    project_data: jsonStr
                });

                lastSavedJsonRef.current = jsonStr;
            }

            setDraftStatus('saved');
            setLastSavedTime(new Date());
        } catch (err) {
            console.error('[AutoSaveDraft] Error saving draft:', err);
            // If delta update failed because draft row was missing on server, retry by re-uploading base
            if (hasUploadedBaseRef.current) {
                hasUploadedBaseRef.current = false;
            }
            setDraftStatus('error');
        } finally {
            isSavingRef.current = false;
        }
    }, [empNo, pdfFile, pdfBytes, pageAnnotations, pageHighlights, fabricCanvasRefs]);

    // ── Debounced auto-save effect triggered on modifications ──
    useEffect(() => {
        // Only trigger auto-save if user has made an edit since opening this document
        if (!pdfFile || !empNo) return;
        if (historyVersion <= initialVersionRef.current) return;

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (idleCallbackIdRef.current) {
            if (typeof window !== 'undefined' && window.cancelIdleCallback) {
                window.cancelIdleCallback(idleCallbackIdRef.current);
            } else {
                clearTimeout(idleCallbackIdRef.current);
            }
        }

        timerRef.current = setTimeout(() => {
            // Schedule via requestIdleCallback so active user drawing/gestures are never interrupted
            const scheduleIdle = (typeof window !== 'undefined' && window.requestIdleCallback)
                ? window.requestIdleCallback
                : (cb) => setTimeout(cb, 50);

            idleCallbackIdRef.current = scheduleIdle(() => {
                saveDraftNow();
            });
        }, 4000); // 4-second debounce

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (idleCallbackIdRef.current) {
                if (typeof window !== 'undefined' && window.cancelIdleCallback) {
                    window.cancelIdleCallback(idleCallbackIdRef.current);
                } else {
                    clearTimeout(idleCallbackIdRef.current);
                }
            }
        };
    }, [historyVersion, pdfFile, empNo, saveDraftNow]);

    return {
        draftStatus,
        lastSavedTime,
        saveDraftNow,
        deleteDraft,
        checkDraft,
        fetchDraftFile,
        markBaseUploaded
    };
}
