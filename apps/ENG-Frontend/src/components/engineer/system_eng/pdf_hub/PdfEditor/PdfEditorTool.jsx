import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Segmented, Button, Tooltip, Upload, Typography, Space, message, Modal
} from 'antd';
import {
    DashboardOutlined, ToolOutlined, SaveOutlined
} from '@ant-design/icons';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import { useAuthStore } from '../../../../../stores/authStore';
import { server } from '../../../../../constance/constance';
import ScrollbarStyle from '../../../../common/scrollbar';
import usePdfEditor from './usePdfEditor';
import EditorCanvas from './EditorCanvas';
import ThumbnailPanel from './ThumbnailPanel';
import ModeToolbar from './panels/ModeToolbar';
import PropertiesPanel from './panels/PropertiesPanel';
import SignaturePad from './panels/SignaturePad';
import ShortcutsHandler from './ShortcutsHandler';
import MergePreview from './MergePreview';
import PhysicalRuler from './canvas/PhysicalRuler';
import PdfUsageDashboard from './wrappers/PdfUsageDashboard.jsx';
import WatermarkManagerModal from './wrappers/WatermarkManagerModal.jsx';
import { MODE_OPTIONS } from './constants.jsx';
import useAutoSaveDraft from './hooks/useAutoSaveDraft';
import { FABRIC_SERIALIZE_PROPS, utf8ToBase64, base64ToUtf8 } from './engine/commitHelpers';

// UI Extract Components
import UploadLanding from './ui/UploadLanding';
import StatusBar from './ui/StatusBar';
import HeaderModeBar from './ui/HeaderModeBar';

import { commitAllToPdf, exportPageToImage, mergePdfFiles, exportSelectedPagesToPdf } from './engine/PdfCommitEngine';
import JSZip from 'jszip';
import axios from 'axios';
import './PdfEditorTool.css';

// ── Virtualization Wrapper (#17) ──
const LazyPageWrapper = ({ children, estimatedHeight }) => {
    const [hasIntersected, setHasIntersected] = React.useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setHasIntersected(true);
                observer.disconnect();
            }
        }, { rootMargin: '200% 0px' }); // Render when within 2 viewport heights

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} style={{ minHeight: hasIntersected ? 'auto' : estimatedHeight, width: '100%', display: 'flex', justifyContent: 'center' }}>
            {hasIntersected ? children : null}
        </div>
    );
};

// eslint-disable-next-line no-unused-vars
const { Title, Text } = Typography;
// eslint-disable-next-line no-unused-vars
const { Dragger } = Upload;



/**
 * PdfEditorTool — Main Workstation Orchestrator.
 *
 * Full-screen 3-panel layout with mode switcher.
 * Consolidates all PDF tools: View, Annotate, Shapes, Edit, Fill&Sign, Merge, Export.
 */
const PdfEditorTool = () => {
    const { theme } = useTheme();
    const store = usePdfEditorStore();
    const { empNo } = useAuthStore();

    const editor = usePdfEditor();
    const {
        pdfFile, pdfDoc, pdfBytes, totalPages, currentPage, zoom,
        pdfLoading, loadPdf, loadPdfFromBytes, closePdf,
        // eslint-disable-next-line no-unused-vars
        goToPage, nextPage, prevPage, zoomIn, zoomOut, zoomTo, setZoom,
        pageAnnotations, setPageAnnotations, saveCurrentPageState,
        getAnnotationCount, totalAnnotations,
        pageHighlights, setPageHighlights,
        // eslint-disable-next-line no-unused-vars
        pushHistory, undo, redo, clearHistory, canUndo, canRedo, historyVersion,
        mergeFiles, setMergeFiles,
        exportedImages, setExportedImages,
        thumbnails, setThumbnails,
        fabricCanvasRefs,
        canvasWrapperRef,
    } = editor;

    // ── Continuous Scroll ──
    const pageRefs = useRef({});
    const isProgrammaticScroll = useRef(false);

    // ── Panel visibility ──
    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);

    // ── Merge state ──
    const [mergeLoading, setMergeLoading] = useState(false);

    // ── Export state ──
    const [exportSelectedPages, setExportSelectedPages] = useState([]);
    const [exportLoading, setExportLoading] = useState(false);

    // ── Stamp data ──
    const [stampData, setStampData] = useState(null);

    // ── Signature Pad ──
    const [sigPadOpen, setSigPadOpen] = useState(false);

    // ── Watermark Manager ──
    const [watermarkOpen, setWatermarkOpen] = useState(false);

    // ── Usage Dashboard ──
    const [dashboardOpen, setDashboardOpen] = useState(false);
    const usedToolsRef = useRef(new Set());

    // ── Overlay/Compare ──
    const [overlayPdfDoc, setOverlayPdfDoc] = useState(null);
    const [overlayFile, setOverlayFile] = useState(null);
    const [mergeRotations, setMergeRotations] = useState({});

    // ── Temporary Draft Auto-Save & Recovery ──
    const [draftModalOpen, setDraftModalOpen] = useState(false);
    const [pendingDraft, setPendingDraft] = useState(null);

    const autoSave = useAutoSaveDraft({
        pdfBytes,
        pdfFile,
        empNo,
        pageAnnotations,
        pageHighlights,
        fabricCanvasRefs,
        historyVersion,
        saveCurrentPageState,
    });
    const { checkDraft } = autoSave;

    // Check for pending temporary draft on mount
    useEffect(() => {
        if (!empNo || pdfBytes) return;
        checkDraft().then(res => {
            if (res && res.hasDraft && res.draft) {
                setPendingDraft(res.draft);
                setDraftModalOpen(true);
            }
        });
    }, [empNo, pdfBytes, checkDraft]);

    // ── Continuous Scroll Observer ──
    useEffect(() => {
        if (store.viewMode !== 'continuous' || !pdfDoc) return;
        
        const observer = new IntersectionObserver((entries) => {
            if (isProgrammaticScroll.current) return; // Skip if we are auto-scrolling
            
            entries.forEach(entry => {
                if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                    const page = Number(entry.target.dataset.page);
                    if (page !== currentPage) {
                        goToPage(page);
                    }
                }
            });
        }, { threshold: 0.5 });

        Object.values(pageRefs.current).forEach(node => {
            if (node) observer.observe(node);
        });

        return () => observer.disconnect();
    }, [pdfDoc, store.viewMode, currentPage, goToPage]);

    // Override manual navigation for smooth scroll
    const handleGoToPage = useCallback((pageNum) => {
        saveCurrentPageState();
        goToPage(pageNum);
        if (store.viewMode === 'continuous' && pageRefs.current[pageNum]) {
            isProgrammaticScroll.current = true;
            pageRefs.current[pageNum].scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Release lock after scroll completes
            setTimeout(() => { isProgrammaticScroll.current = false; }, 600);
        }
    }, [goToPage, store.viewMode, saveCurrentPageState]);

    const handleNextPage = () => handleGoToPage(currentPage + 1);
    const handlePrevPage = () => handleGoToPage(currentPage - 1);

    // ── Initialize export selection when entering export mode ──
    useEffect(() => {
        if (store.activeMode === 'export' && totalPages > 0 && exportSelectedPages.length === 0) {
            setExportSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
        }
    }, [store.activeMode, totalPages, exportSelectedPages.length]);

    // ── Fetch stamp data for Sign mode ──
    useEffect(() => {
        if (store.activeMode === 'sign' && empNo && !stampData) {
            const fetchStamps = async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.get(`${server.PDF_HUB_STAMPS}/${empNo}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (res.data?.result === 'true') {
                        setStampData(res.data.data);
                    }
                } catch (err) {
                    if (err.response?.status !== 404) console.error('Stamp fetch error:', err);
                }
            };
            fetchStamps();
        }
    }, [store.activeMode, empNo, stampData]);

    // ── Track used tools ──
    useEffect(() => {
        if (store.activeMode && store.activeMode !== 'view' && store.activeMode !== 'export') {
            usedToolsRef.current.add(store.activeMode);
        }
    }, [store.activeMode]);

    // ══════════════════════════════════════════════════════════════════
    // Draft Resume / Discard Handlers
    // ══════════════════════════════════════════════════════════════════
    const handleResumeDraft = async () => {
        try {
            message.loading({ content: 'กำลังโหลดไฟล์ร่าง...', key: 'draft_load' });
            const file = await autoSave.fetchDraftFile();
            if (file) {
                setDraftModalOpen(false);
                setPendingDraft(null);
                await handleFileUpload(file);
                autoSave.markBaseUploaded?.(true);
                message.success({ content: 'โหลดไฟล์ร่างสำเร็จ!', key: 'draft_load' });
            } else {
                message.error({ content: 'ไม่พบไฟล์ร่างบนเซิร์ฟเวอร์', key: 'draft_load' });
            }
        } catch (e) {
            console.error('Failed to resume draft:', e);
            message.error({ content: 'เกิดข้อผิดพลาดในการโหลดไฟล์ร่าง', key: 'draft_load' });
        }
    };

    const handleDiscardDraft = async () => {
        try {
            await autoSave.deleteDraft();
            setDraftModalOpen(false);
            setPendingDraft(null);
            message.success('ลบไฟล์ร่างเรียบร้อยแล้ว');
        } catch (e) {
            message.error('ไม่สามารถลบไฟล์ร่างได้');
        }
    };

    // ══════════════════════════════════════════════════════════════════
    // File Upload Handler
    // ══════════════════════════════════════════════════════════════════
    const handleFileUpload = async (file) => {
        if (file.type !== 'application/pdf') {
            message.error('Please upload a PDF file.');
            return Upload.LIST_IGNORE;
        }

        // ── Reset all states (like a full reload) ──
        store.setActiveMode('view');
        store.setViewMode('continuous');
        setZoom(1.0);
        store.clearSelection();
        store.setOverlayEnabled(false);
        setOverlayPdfDoc(null);
        setOverlayFile(null);
        setExportedImages([]);
        setExportSelectedPages([]);
        setMergeFiles([]);
        setLeftCollapsed(false);
        setRightCollapsed(false);
        setPageAnnotations({});
        setPageHighlights({});
        clearHistory();

        // Clear existing Fabric canvas objects
        if (fabricCanvasRefs?.current) {
            Object.values(fabricCanvasRefs.current).forEach(fc => {
                if (fc && !fc.isDisposed) {
                    try { fc.clear(); } catch (e) {}
                }
            });
            fabricCanvasRefs.current = {};
        }

        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            let projectData = null;
            let originalPdfBytes = bytes;
            
            // 1. Try to read from pdf-lib Custom Metadata first
            try {
                const { PDFDocument } = await import('pdf-lib');
                const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
                const infoDict = doc.getInfoDict();
                const engDataObj = infoDict.get(doc.context.obj('EngProjectData'));
                if (engDataObj) {
                    const rawStr = typeof engDataObj.asString === 'function' ? engDataObj.asString() : (engDataObj.value || '');
                    if (rawStr) {
                        try {
                            const jsonStr = base64ToUtf8(rawStr);
                            projectData = JSON.parse(jsonStr);
                        } catch {
                            const jsonStr = decodeURIComponent(escape(window.atob(rawStr)));
                            projectData = JSON.parse(jsonStr);
                        }
                    }
                }
            } catch (e) {
                console.warn('No valid pdf-lib metadata found, checking legacy EOF...', e);
            }
            
            // 2. Fallback to Legacy EOF Appending if not found
            if (!projectData) {
                const signature = new TextEncoder().encode('\nENG_PROJECT_DATA:');
                let sigIndex = -1;
                for (let i = bytes.length - signature.length; i >= 0; i--) {
                    let match = true;
                    for (let j = 0; j < signature.length; j++) {
                        if (bytes[i + j] !== signature[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        sigIndex = i;
                        break;
                    }
                }
    
                if (sigIndex !== -1) {
                    const jsonBytes = bytes.slice(sigIndex + signature.length);
                    const jsonStr = new TextDecoder().decode(jsonBytes);
                    projectData = JSON.parse(jsonStr);
                    originalPdfBytes = bytes.slice(0, sigIndex);
                }
            }

            if (projectData) {
                await loadPdfFromBytes(originalPdfBytes, file.name);
                if (projectData.annotations) setPageAnnotations(projectData.annotations);
                if (projectData.highlights) setPageHighlights(projectData.highlights);
                message.success('Editable project loaded successfully!');
                return false;
            }
        } catch (e) {
            console.error('Failed to parse editable project:', e);
        }

        loadPdf(file);
        return false;
    };

    // ══════════════════════════════════════════════════════════════════
    // Analytics / Usage Logging
    // ══════════════════════════════════════════════════════════════════
    const logPdfUsage = useCallback(async (actionType) => {
        try {
            const token = localStorage.getItem('token');
            if (!token || !empNo) return;
            const filename = pdfFile?.name || 'document.pdf';
            const payload = {
                filename,
                empno: empNo,
                user_name: useAuthStore.getState().userName || '',
                total_pages: totalPages || 1,
                action_type: actionType,
            };
            if (actionType !== 'view' && usedToolsRef.current.size > 0) {
                payload.details = Array.from(usedToolsRef.current).join(', ');
            }
            await axios.post(server.PDF_USAGE_LOG, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (err) {
            console.error('Failed to log PDF usage:', err);
        }
    }, [empNo, pdfFile, totalPages]);

    // Log 'view' when PDF successfully loads
    useEffect(() => {
        if (pdfDoc && pdfFile) {
            usedToolsRef.current.clear();
            logPdfUsage('view');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDoc, pdfFile]);

    // ── Warn user before closing with unsaved annotations (#11) ──
    useEffect(() => {
        const handler = (e) => {
            if (totalAnnotations > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [totalAnnotations]);

    // ── Cleanup export image URLs on unmount (#2) ──
    useEffect(() => {
        return () => {
            if (exportedImages?.length > 0) {
                exportedImages.forEach(img => URL.revokeObjectURL(img.url));
            }
        };
    }, [exportedImages]);

    // ══════════════════════════════════════════════════════════════════
    // Apply & Download (commit annotations to PDF)
    // ══════════════════════════════════════════════════════════════════
    const handleClearPage = useCallback(() => {
        const fc = fabricCanvasRefs?.current?.[currentPage];
        if (fc) {
            pushHistory(currentPage);
            fc.clear();
            fc.backgroundColor = 'transparent';
            fc.renderAll();
        }
    }, [fabricCanvasRefs, currentPage, pushHistory]);

    const handleSaveEditable = useCallback(async () => {
        if (!pdfBytes) return;
        saveCurrentPageState();

        const finalAnnotations = { ...pageAnnotations };
        Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
            if (fc && !fc.isDisposed) {
                if (fc.discardActiveObject) {
                    fc.discardActiveObject();
                    fc.renderAll?.();
                }
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
        
        try {
            // First, try to embed it natively using pdf-lib Custom Metadata
            const { PDFDocument, PDFString } = await import('pdf-lib');
            const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            
            // Safe UTF-8 Base64 encoding
            const base64Str = utf8ToBase64(jsonStr);
            
            // Set custom Document Info Dictionary property
            doc.getInfoDict().set(doc.context.obj('EngProjectData'), PDFString.of(base64Str));
            
            const finalBytes = await doc.save();
            const blob = new Blob([finalBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `editable_${pdfFile?.name || 'document.pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Delete server temporary draft on successful user save
            if (autoSave && autoSave.deleteDraft) {
                await autoSave.deleteDraft();
            }

            logPdfUsage('export_editable_pdf');
            message.success('Editable PDF saved! You can load it back to edit annotations.');
        } catch (e) {
            console.error('Failed to save editable PDF using pdf-lib, falling back to raw appending:', e);
            
            // Fallback (Legacy EOF Appending)
            const jsonBytes = new TextEncoder().encode('\nENG_PROJECT_DATA:' + jsonStr);
            const finalBytes = new Uint8Array(pdfBytes.length + jsonBytes.length);
            finalBytes.set(pdfBytes);
            finalBytes.set(jsonBytes, pdfBytes.length);
    
            const blob = new Blob([finalBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `editable_${pdfFile?.name || 'document.pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            if (autoSave && autoSave.deleteDraft) {
                await autoSave.deleteDraft();
            }

            logPdfUsage('export_editable_pdf');
            message.success('Editable PDF saved (Legacy Mode)!');
        }
    }, [pdfBytes, pageAnnotations, pageHighlights, fabricCanvasRefs, pdfFile, saveCurrentPageState, logPdfUsage, autoSave]);

    const handleApplyAndDownload = useCallback(async () => {
        if (!pdfBytes) return;

        // Save current page state first
        saveCurrentPageState();

        try {
            const finalAnnotations = { ...pageAnnotations };
            // Include all active canvases
            Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
                if (fc && !fc.isDisposed) {
                    if (fc.discardActiveObject) {
                        fc.discardActiveObject();
                        fc.renderAll?.();
                    }
                    const json = fc.toObject ? fc.toObject(FABRIC_SERIALIZE_PROPS) : fc.toJSON(FABRIC_SERIALIZE_PROPS);
                    json._canvasWidth = fc.width;
                    json._canvasHeight = fc.height;
                    finalAnnotations[pageNumStr] = json;
                }
            });

            const finalBytes = await commitAllToPdf(pdfBytes, finalAnnotations, null, pageHighlights);
            const blob = new Blob([finalBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `edited_${pdfFile?.name || 'document.pdf'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            // Clean up temporary draft after successful apply & download
            if (autoSave && autoSave.deleteDraft) {
                await autoSave.deleteDraft();
            }

            logPdfUsage('export_pdf');
            message.success('PDF downloaded successfully!');
        } catch (err) {
            console.error('Commit error:', err);
            message.error('Failed to apply annotations to PDF.');
        }
    }, [pdfBytes, pageAnnotations, pageHighlights, fabricCanvasRefs, pdfFile, saveCurrentPageState, logPdfUsage, autoSave]);

    const handleClosePdf = useCallback(async () => {
        if (autoSave && autoSave.deleteDraft) {
            await autoSave.deleteDraft();
        }
        setPageAnnotations({});
        setPageHighlights({});
        clearHistory();
        store.clearSelection();
        if (fabricCanvasRefs?.current) {
            Object.values(fabricCanvasRefs.current).forEach(fc => {
                if (fc && !fc.isDisposed) {
                    try { fc.clear(); } catch (e) {}
                }
            });
            fabricCanvasRefs.current = {};
        }
        closePdf();
        message.info('Document closed');
    }, [closePdf, clearHistory, store, fabricCanvasRefs, setPageAnnotations, setPageHighlights, autoSave]);

    // ══════════════════════════════════════════════════════════════════
    // Merge Handler
    // ══════════════════════════════════════════════════════════════════
    const handleMerge = useCallback(async () => {
        if (mergeFiles.length < 2) {
            message.warning('Add at least 2 PDF files to merge.');
            return;
        }
        setMergeLoading(true);
        try {
            const mergedBytes = await mergePdfFiles(mergeFiles, mergeRotations);
            await loadPdfFromBytes(mergedBytes, `merged_${Date.now()}.pdf`);
            setMergeFiles([]);
            setMergeRotations({});
            store.setActiveMode('view');
            logPdfUsage('merge');
            message.success('PDFs merged! You can now annotate, sign, or export.');
        } catch (err) {
            console.error('Merge error:', err);
            message.error('Failed to merge PDFs.');
        } finally {
            setMergeLoading(false);
        }
    }, [mergeFiles, mergeRotations, loadPdfFromBytes, setMergeFiles, store, logPdfUsage]);

    const handleMergeFilesAdd = useCallback((files) => {
        setMergeFiles(prev => {
            const getFileKey = (f) => `${f.name}-${f.size}-${f.lastModified || 0}`;
            const existingKeys = new Set(prev.map(getFileKey));
            const newItems = files
                .filter(f => !existingKeys.has(getFileKey(f)))
                .map(f => {
                    const uid = f.uid || `merge_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    return Object.assign(f, {
                        uid,
                        arrayBuffer: typeof f.arrayBuffer === 'function'
                            ? () => f.arrayBuffer()
                            : () => f.originFileObj?.arrayBuffer()
                    });
                });
            return [...prev, ...newItems];
        });
    }, [setMergeFiles]);

    // ══════════════════════════════════════════════════════════════════
    // Export Handler (client-side PDF → Image)
    // ══════════════════════════════════════════════════════════════════
    const handleExport = useCallback(async (format, quality) => {
        if (!pdfDoc || exportSelectedPages.length === 0) return;

        setExportLoading(true);
        saveCurrentPageState();

        const scaleMap = { low: 1.0, medium: 1.5, high: 2.0 };
        const scale = scaleMap[quality] || 2.0;

        try {
            const results = [];
            const allAnnotations = { ...pageAnnotations };
            Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
                if (fc) {
                    if (fc.discardActiveObject) {
                        fc.discardActiveObject();
                        fc.renderAll?.();
                    }
                    const json = fc.toObject ? fc.toObject(['customData', 'textLines', 'id']) : fc.toJSON(['customData', 'textLines', 'id']);
                    json._canvasWidth = fc.width;
                    json._canvasHeight = fc.height;
                    allAnnotations[pageNumStr] = json;
                }
            });

            if (format === 'pdf') {
                // Export as PDF
                const annotatedBytes = await commitAllToPdf(pdfBytes, allAnnotations, null, pageHighlights);
                const blob = await exportSelectedPagesToPdf(annotatedBytes, exportSelectedPages);
                const url = URL.createObjectURL(blob);
                const filename = `${(pdfFile?.name || 'document').replace('.pdf', '')}_extracted.pdf`;
                results.push({ url, filename, pageNum: 'PDF' });
                
                // Auto download PDF
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                for (const pageNum of exportSelectedPages) {
                    const blob = await exportPageToImage(
                        pdfDoc, pageNum,
                        allAnnotations[pageNum] || null,
                        pageHighlights ? pageHighlights[pageNum] : null,
                        format, scale
                    );
                    const url = URL.createObjectURL(blob);
                    const filename = `${(pdfFile?.name || 'page').replace('.pdf', '')}_p${pageNum}.${format}`;
                    results.push({ url, filename, pageNum });
                }

                // Auto-download if single page
                if (results.length === 1) {
                    const link = document.createElement('a');
                    link.href = results[0].url;
                    link.download = results[0].filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            }

            // Revoke previous export URLs
            if (exportedImages?.length > 0) {
                exportedImages.forEach(img => URL.revokeObjectURL(img.url));
            }
            setExportedImages(results);

            logPdfUsage(format === 'pdf' ? 'export_pdf_extracted' : 'export_image');
            message.success(`Exported ${results.length} page(s) as ${format.toUpperCase()}`);
        } catch (err) {
            console.error('Export error:', err);
            message.error('Failed to export pages.');
        } finally {
            setExportLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfDoc, exportSelectedPages, pageAnnotations, fabricCanvasRefs, pdfFile, saveCurrentPageState, setExportedImages, logPdfUsage]);

    // ══════════════════════════════════════════════════════════════════
    // Batch ZIP Download
    // ══════════════════════════════════════════════════════════════════
    const handleBatchZipDownload = useCallback(async () => {
        if (!exportedImages || exportedImages.length === 0) return;
        try {
            const zip = new JSZip();
            for (const img of exportedImages) {
                const resp = await fetch(img.url);
                const blob = await resp.blob();
                zip.file(img.filename, blob);
            }
            const content = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(pdfFile?.name || 'export').replace('.pdf', '')}_pages.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            message.success('ZIP downloaded!');
        } catch (err) {
            console.error('ZIP error:', err);
            message.error('Failed to create ZIP.');
        }
    }, [exportedImages, pdfFile]);

    // ══════════════════════════════════════════════════════════════════
    // Overlay/Compare — Load a second PDF for comparison
    // ══════════════════════════════════════════════════════════════════
    const handleLoadOverlay = useCallback(async (file) => {
        try {
            const pdfjsLib = await import('pdfjs-dist');
            const arrayBuffer = await file.arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setOverlayPdfDoc(doc);
            setOverlayFile(file);
            store.setOverlayEnabled(true);
            message.success(`Overlay loaded: ${file.name}`);
        } catch (err) {
            console.error('Overlay load error:', err);
            message.error('Failed to load overlay PDF.');
        }
    }, [store]);

    const handleClearOverlay = useCallback(() => {
        setOverlayPdfDoc(null);
        setOverlayFile(null);
        store.setOverlayEnabled(false);
    }, [store]);

    // ══════════════════════════════════════════════════════════════════
    // Place Stamp / Signature on Canvas
    // ══════════════════════════════════════════════════════════════════
    const placeImageOnCanvas = useCallback(async (src, customData = {}) => {
        const fc = fabricCanvasRefs?.current?.[currentPage];
        if (!fc) return;
        pushHistory(currentPage);

        const imgEl = new Image();
        imgEl.src = src;
        imgEl.onload = async () => {
            const fabricModule = await import('fabric');
            const fImg = new fabricModule.FabricImage(imgEl, {
                left: 100,
                top: 100,
                scaleX: 0.5,
                scaleY: 0.5,
                opacity: 0.85,
                customData,
            });
            fc.add(fImg);
            fc.setActiveObject(fImg);
            fc.renderAll();
        };
    }, [fabricCanvasRefs, currentPage, pushHistory]);

    const handlePlaceStamp = useCallback(async (type) => {
        if (!stampData) return;
        const imgSrc = type === 'stamp' ? stampData.stamp_image : stampData.signature_image;
        if (!imgSrc) return;
        placeImageOnCanvas(`data:image/png;base64,${imgSrc}`, {
            type: type === 'stamp' ? 'stamp' : 'signature',
            widthMm: type === 'stamp' ? stampData.stamp_width_mm : stampData.sig_width_mm,
            heightMm: type === 'stamp' ? stampData.stamp_height_mm : stampData.sig_height_mm,
        });
    }, [stampData, placeImageOnCanvas]);

    // ── Signature Pad complete ──
    const handleSignatureComplete = useCallback((dataUrl) => {
        placeImageOnCanvas(dataUrl, { type: 'drawn-signature', createdAt: Date.now() });
    }, [placeImageOnCanvas]);

    // ── Delete selected objects ──
    const handleDeleteSelected = useCallback(() => {
        Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
            if (!fc) return;
            const active = fc.getActiveObjects();
            if (active.length > 0) {
                pushHistory(Number(pageNumStr));
                active.forEach(obj => fc.remove(obj));
                fc.discardActiveObject();
                fc.renderAll();
            }
        });
    }, [fabricCanvasRefs, pushHistory]);

    // ══════════════════════════════════════════════════════════════════
    // CSS Variables for theme
    // ══════════════════════════════════════════════════════════════════
    const cssVars = {
        '--ws-bg': theme.colors.background,
        '--ws-surface': theme.colors.surface,
        '--ws-border': theme.colors.border,
        '--ws-primary': theme.colors.primary,
        '--ws-primary-light': `${theme.colors.primary}18`,
    };

    // ── Draft Recovery Modal Element ──
    const DraftRecoveryModal = (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SaveOutlined style={{ color: theme.colors.primary, fontSize: 18 }} />
                    <span style={{ fontWeight: 600 }}>พบไฟล์ร่างที่ยังไม่ได้บันทึก (Unsaved Draft Found)</span>
                </div>
            }
            open={draftModalOpen}
            closable={false}
            maskClosable={false}
            centered
            footer={[
                <Button key="discard" danger onClick={handleDiscardDraft} style={{ borderRadius: 6 }}>
                    ลบไฟล์ร่างนี้ (Discard)
                </Button>,
                <Button key="cancel" onClick={() => setDraftModalOpen(false)} style={{ borderRadius: 6 }}>
                    ปิด (Close)
                </Button>,
                <Button key="resume" type="primary" onClick={handleResumeDraft} style={{ borderRadius: 6, fontWeight: 600 }}>
                    ทำงานต่อ (Resume)
                </Button>
            ]}
        >
            <p style={{ marginBottom: 12 }}>ระบบตรวจพบไฟล์ร่างของคุณที่เคยเปิดทำงานค้างไว้:</p>
            <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                marginBottom: 14
            }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>
                    {pendingDraft?.original_filename || pendingDraft?.filename || 'document.pdf'}
                </div>
                <div style={{ marginTop: 6, color: '#64748b', fontSize: 12 }}>
                    <strong>บันทึกล่าสุด:</strong> {pendingDraft?.updated_at ? new Date(pendingDraft.updated_at).toLocaleString('th-TH') : '-'}
                </div>
                <div style={{ marginTop: 4, color: '#64748b', fontSize: 12 }}>
                    <strong>ขนาดไฟล์:</strong> {pendingDraft?.file_size ? `${(pendingDraft.file_size / 1024).toFixed(1)} KB` : '-'}
                </div>
            </div>
            <p style={{ color: '#64748b', fontSize: 12.5, marginBottom: 0 }}>
                คุณต้องการโหลดไฟล์ร่างนี้เพื่อทำงานต่อ หรือต้องการลบทิ้งเพื่อไม่ให้แจ้งเตือนอีก?
            </p>
        </Modal>
    );

    // ══════════════════════════════════════════════════════════════════
    // Upload Landing (no PDF loaded)
    // ══════════════════════════════════════════════════════════════════
    if (!pdfDoc && store.activeMode !== 'merge') {
        return (
            <div className="pdf-ws" style={cssVars}>
                <ScrollbarStyle primary={theme.colors.primary} />
                {/* Mode bar (still visible for Merge mode) */}
                <div className="pdf-ws-modebar" style={{
                    background: theme.colors.surface,
                    borderColor: theme.colors.border,
                }}>
                    <div className="pdf-ws-modebar-logo">
                        <div className="pdf-ws-modebar-logo-icon"
                            style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}cc)` }}>
                            <ToolOutlined />
                        </div>
                        <div>
                            <div className="pdf-ws-modebar-title" style={{ color: theme.colors.textPrimary }}>
                                PDF Workstation
                            </div>
                            <div className="pdf-ws-modebar-subtitle" style={{ color: theme.colors.textSecondary }}>
                                Editor & Tools
                            </div>
                        </div>
                    </div>

                    <Segmented
                        value={store.activeMode}
                        onChange={(val) => store.setActiveMode(val)}
                        options={MODE_OPTIONS.map(m => ({
                            value: m.value,
                            label: (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    {m.icon} {m.label}
                                </span>
                            ),
                        }))}
                    />
                    
                    <div style={{ flex: 1 }} />
                    
                    <Space size={4}>
                        <Tooltip title="Usage Dashboard">
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<DashboardOutlined style={{ color: theme.colors.primary }} />} 
                                onClick={() => setDashboardOpen(true)}
                            />
                        </Tooltip>
                    </Space>
                </div>

                {/* ── Dashboard Modal ── */}
                <PdfUsageDashboard 
                    open={dashboardOpen} 
                    onClose={() => setDashboardOpen(false)} 
                />

                {DraftRecoveryModal}

                <UploadLanding 
                    pdfLoading={pdfLoading}
                    onFileUpload={handleFileUpload}
                />
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Main Workstation (PDF loaded)
    // ══════════════════════════════════════════════════════════════════
    return (
        <div className="pdf-ws" style={cssVars}>
            <ScrollbarStyle primary={theme.colors.primary} />

            {DraftRecoveryModal}

            <ShortcutsHandler
                onUndo={undo}
                onRedo={redo}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onDelete={handleDeleteSelected}
                onSave={handleApplyAndDownload}
                fabricCanvasRefs={fabricCanvasRefs}
                currentPage={currentPage}
                pushHistory={pushHistory}
            />

            {/* ── Signature Pad Modal ── */}
            <SignaturePad
                open={sigPadOpen}
                onClose={() => setSigPadOpen(false)}
                onComplete={handleSignatureComplete}
            />

            {/* ── Mode Switcher Bar ── */}
            <HeaderModeBar
                onOpenDashboard={() => setDashboardOpen(true)}
                onOpenWatermark={() => setWatermarkOpen(true)}
                onSavePageState={saveCurrentPageState}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                onClosePdf={handleClosePdf}
                currentPage={currentPage}
                totalPages={totalPages}
                zoom={zoom}
                setZoom={setZoom}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                zoomTo={zoomTo}
                canUndo={canUndo}
                canRedo={canRedo}
                undo={undo}
                redo={redo}
                onDeleteSelected={handleDeleteSelected}
                leftCollapsed={leftCollapsed}
                setLeftCollapsed={setLeftCollapsed}
                onApplyAndDownload={handleApplyAndDownload}
                onSaveEditable={handleSaveEditable}
                onClearPage={handleClearPage}
                totalAnnotations={totalAnnotations}
                fabricCanvasRefs={fabricCanvasRefs}
                onFileUpload={handleFileUpload}
                usedToolsRef={usedToolsRef}
                canvasWrapperRef={canvasWrapperRef}
                pdfDoc={pdfDoc}
                draftStatus={autoSave.draftStatus}
                lastSavedTime={autoSave.lastSavedTime}
            />

            {/* ── Mode-Specific Toolbar ── */}
            <ModeToolbar />

            {/* ── Body (3-panel) ── */}
            <div className="pdf-ws-body">
                {/* Left Panel */}
                {!leftCollapsed && (
                    <ThumbnailPanel
                        pdfDoc={pdfDoc}
                        totalPages={totalPages}
                        currentPage={currentPage}
                        goToPage={handleGoToPage}
                        getAnnotationCount={getAnnotationCount}
                        thumbnails={thumbnails}
                        setThumbnails={setThumbnails}
                        mergeFiles={mergeFiles}
                        setMergeFiles={setMergeFiles}
                        onMergeFilesAdd={handleMergeFilesAdd}
                        exportSelectedPages={exportSelectedPages}
                        setExportSelectedPages={setExportSelectedPages}
                    />
                )}

                {/* Center Canvas */}
                <div className="pdf-ws-center">
                    <div
                        ref={canvasWrapperRef}
                        className="pdf-ws-canvas-wrapper kb-vscroll"
                        data-tool={store.activeTool}
                        style={{ background: theme.colors.background }}
                    >
                        {store.activeMode === 'merge' ? (
                            <MergePreview mergeFiles={mergeFiles} onRotationsChange={setMergeRotations} />
                        ) : pdfDoc ? (
                            store.viewMode === 'continuous' ? (
                                <div className="pdf-ws-continuous-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0', minWidth: 'fit-content', margin: '0 auto' }}>
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <div 
                                            key={i+1} 
                                            data-page={i+1} 
                                            ref={el => pageRefs.current[i+1] = el}
                                            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', margin: '0 auto', width: 'fit-content' }}
                                        >
                                            <LazyPageWrapper estimatedHeight={842 * zoom}>
                                                <EditorCanvas
                                                    pageNum={i+1}
                                                    pdfDoc={pdfDoc}
                                                    zoom={zoom}
                                                    pageAnnotations={pageAnnotations}
                                                    pageHighlights={pageHighlights}
                                                    setPageHighlights={setPageHighlights}
                                                    fabricCanvasRefs={fabricCanvasRefs}
                                                    pushHistory={pushHistory}
                                                    overlayPdfDoc={overlayPdfDoc}
                                                    stampData={stampData}
                                                />
                                            </LazyPageWrapper>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: 24, display: 'flex', minWidth: 'fit-content', margin: '0 auto' }}>
                                    <div style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)', margin: '0 auto', width: 'fit-content' }}>
                                        <EditorCanvas
                                            pageNum={currentPage}
                                            pdfDoc={pdfDoc}
                                            zoom={zoom}
                                            pageAnnotations={pageAnnotations}
                                            pageHighlights={pageHighlights}
                                            setPageHighlights={setPageHighlights}
                                            fabricCanvasRefs={fabricCanvasRefs}
                                            pushHistory={pushHistory}
                                            overlayPdfDoc={overlayPdfDoc}
                                            stampData={stampData}
                                        />
                                    </div>
                                </div>
                            )
                        ) : pdfFile ? (
                            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', color: theme.colors.textPrimary }}>
                                <div style={{ fontSize: 64, marginBottom: 24 }}>🔒</div>
                                <h2>PDF is Protected (Blind Mode)</h2>
                                <p style={{ fontSize: 16 }}>The viewer failed to load this PDF because it is password-protected or encrypted.</p>
                                <p style={{ fontSize: 16 }}>However, you can still open the <b>Watermark</b> tool, use "Apply to All", and click <b>Save</b> to export a clean copy.</p>
                            </div>
                        ) : null}

                        <PhysicalRuler pdfDoc={pdfDoc} zoom={zoom} />
                    </div>

                    {/* Status Bar */}
                    <StatusBar
                        pdfFile={pdfFile}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        zoom={zoom}
                        totalAnnotations={totalAnnotations}
                    />
                </div>

                {/* Right Panel */}
                {!rightCollapsed && (
                    <PropertiesPanel
                        pdfFile={pdfFile}
                        totalPages={totalPages}
                        totalAnnotations={totalAnnotations}
                        mergeFiles={mergeFiles}
                        onMerge={handleMerge}
                        mergeLoading={mergeLoading}
                        exportSelectedPages={exportSelectedPages}
                        onExport={handleExport}
                        exportLoading={exportLoading}
                        exportedImages={exportedImages}
                        stampData={stampData}
                        onPlaceStamp={handlePlaceStamp}
                        onOpenSignaturePad={() => setSigPadOpen(true)}
                        onBatchZipDownload={handleBatchZipDownload}
                        overlayFile={overlayFile}
                        onLoadOverlay={handleLoadOverlay}
                        onClearOverlay={handleClearOverlay}
                        fabricCanvasRefs={fabricCanvasRefs}
                        currentPage={currentPage}
                        pushHistory={pushHistory}
                    />
                )}
            </div>
            {/* ── Dashboard Modal ── */}
            <PdfUsageDashboard 
                open={dashboardOpen} 
                onClose={() => setDashboardOpen(false)} 
            />

            {/* ── Watermark Modal ── */}
            <WatermarkManagerModal
                open={watermarkOpen}
                onClose={() => setWatermarkOpen(false)}
                pdfDoc={pdfDoc}
                pdfFile={pdfFile}
                totalPages={totalPages}
                currentPage={currentPage}
                fabricCanvasRefs={fabricCanvasRefs}
                pushHistory={pushHistory}
                logPdfUsage={logPdfUsage}
                pageAnnotations={pageAnnotations}
                setPageAnnotations={setPageAnnotations}
            />
        </div>
    );
};

export default PdfEditorTool;
