import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';
import { FABRIC_SERIALIZE_PROPS, base64ToUtf8 } from '../engine/commitHelpers';

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
     * Delete draft(s) from server & SQLite database.
     * @param {string} [filename] - Specific file to delete, or omit to delete all drafts for user.
     */
    const deleteDraft = useCallback(async (filename) => {
        if (!empNo) return;
        try {
            let url = `${server.PDF_HUB_DRAFT}?empno=${encodeURIComponent(empNo)}`;
            if (filename) {
                url += `&filename=${encodeURIComponent(filename)}`;
            }
            await axios.delete(url);
            setDraftStatus('idle');
            setLastSavedTime(null);
            hasUploadedBaseRef.current = false;
            lastSavedJsonRef.current = null;
        } catch (err) {
            console.warn('[AutoSaveDraft] Failed to delete draft:', err.message);
        }
    }, [empNo]);

    /**
     * Check if user has active draft(s) on the server.
     * Returns list of drafts and primary draft.
     */
    const checkDraft = useCallback(async () => {
        if (!empNo) return { hasDraft: false, count: 0, drafts: [], draft: null };
        try {
            const res = await axios.get(`${server.PDF_HUB_DRAFT}?empno=${encodeURIComponent(empNo)}`);
            if (res.data && res.data.result === 'true') {
                const drafts = res.data.drafts || (res.data.draft ? [res.data.draft] : []);
                return {
                    hasDraft: !!res.data.hasDraft,
                    count: res.data.count || drafts.length,
                    drafts,
                    draft: res.data.draft || drafts[0] || null
                };
            }
            return { hasDraft: false, count: 0, drafts: [], draft: null };
        } catch (err) {
            console.warn('[AutoSaveDraft] Failed to check draft:', err.message);
            return { hasDraft: false, count: 0, drafts: [], draft: null };
        }
    }, [empNo]);

    /**
     * Fetch draft PDF as a File object for resumption with optional progress callback
     * @param {string} [filename]
     * @param {Function} [onProgress] - (percent, loaded, total) => void
     */
    const fetchDraftFile = useCallback(async (filename, onProgress) => {
        if (!empNo) return null;
        try {
            let url = `${server.PDF_HUB_DRAFT}/download?empno=${encodeURIComponent(empNo)}`;
            if (filename) {
                url += `&filename=${encodeURIComponent(filename)}`;
            }
            const res = await axios.get(url, {
                responseType: 'blob',
                onDownloadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percent, progressEvent.loaded, progressEvent.total);
                    }
                }
            });
            const blob = res.data;
            const contentDisp = res.headers['content-disposition'] || '';
            let fileName = filename || 'recovered_draft.pdf';
            const match = contentDisp.match(/filename="?([^";]+)"?/i);
            if (match && match[1]) {
                fileName = decodeURIComponent(match[1]);
            }
            const fileObj = new File([blob], fileName, { type: 'application/pdf' });

            // Extract X-Eng-Project-Data header if sent by server for instant zero-loss hydration
            const rawHeader = res.headers['x-eng-project-data'];
            if (rawHeader) {
                try {
                    fileObj._projectData = JSON.parse(base64ToUtf8(rawHeader));
                } catch (e) {
                    console.warn('[AutoSaveDraft] Could not parse X-Eng-Project-Data header:', e);
                }
            }

            return fileObj;
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

        const docFilename = pdfFile.name || 'draft.pdf';

        try {
            isSavingRef.current = true;
            setDraftStatus('saving');

            // Snapshot all current annotations without blocking UI
            const finalAnnotations = { ...pageAnnotations };
            Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
                if (fc && !fc.isDisposed) {
                    const json = fc.toObject ? fc.toObject(FABRIC_SERIALIZE_PROPS) : fc.toJSON(FABRIC_SERIALIZE_PROPS);
                    if (json && Array.isArray(json.objects)) {
                        json.objects.forEach(obj => {
                            if (obj && (obj.type === 'FabricText' || obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text')) {
                                if (obj.text === undefined || obj.text === null) {
                                    obj.text = '';
                                }
                            }
                        });
                    }
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
                    formData.append('file', pdfFile, docFilename);
                } else if (pdfBytes) {
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    formData.append('file', blob, docFilename);
                }
                formData.append('empno', empNo);
                formData.append('filename', docFilename);
                formData.append('original_filename', docFilename);
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
                    filename: docFilename,
                    project_data: jsonStr
                });

                lastSavedJsonRef.current = jsonStr;
            }

            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            setDraftStatus('saved');
            setLastSavedTime(timeStr);
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
