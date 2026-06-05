import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Segmented, Button, Tooltip, Upload, Typography, Spin, Tag,
    Select, Space, message,
} from 'antd';
import {
    EyeOutlined, HighlightOutlined, BorderOutlined,
    EditOutlined, FormOutlined, MergeCellsOutlined,
    FileImageOutlined, FilePdfOutlined, InboxOutlined,
    LeftOutlined, RightOutlined, ZoomInOutlined, ZoomOutOutlined,
    UndoOutlined, RedoOutlined, DownloadOutlined, DeleteOutlined,
    ToolOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
    AppstoreOutlined, InsertRowAboveOutlined, DashboardOutlined, BgColorsOutlined
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
import PdfUsageDashboard from './PdfUsageDashboard.jsx';
import WatermarkManagerModal from './WatermarkManagerModal.jsx';
import { commitAllToPdf, exportPageToImage, mergePdfFiles } from './engine/PdfCommitEngine';
import JSZip from 'jszip';
import axios from 'axios';
import './PdfEditorTool.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ZOOM_OPTIONS = [
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2.0, label: '200%' },
    { value: 3.0, label: '300%' },
];

const MODE_OPTIONS = [
    { value: 'view',     icon: <EyeOutlined />,         label: 'View' },
    { value: 'annotate', icon: <HighlightOutlined />,   label: 'Annotate' },
    { value: 'shapes',   icon: <BorderOutlined />,      label: 'Shapes' },
    { value: 'edit',     icon: <EditOutlined />,        label: 'Edit' },
    { value: 'sign',     icon: <FormOutlined />,        label: 'Fill & Sign' },
    { value: 'watermark',icon: <BgColorsOutlined />,    label: 'Watermark' },
    { value: 'merge',    icon: <MergeCellsOutlined />,  label: 'Merge' },
    { value: 'export',   icon: <FileImageOutlined />,   label: 'Export' },
];

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
        pdfLoading, loadPdf, loadPdfFromBytes,
        goToPage, nextPage, prevPage, zoomIn, zoomOut, zoomTo, setZoom,
        pageAnnotations, setPageAnnotations, saveCurrentPageState,
        getAnnotationCount, totalAnnotations,
        pageHighlights, setPageHighlights,
        pushHistory, undo, redo, canUndo, canRedo, historyVersion,
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
        goToPage(pageNum);
        if (store.viewMode === 'continuous' && pageRefs.current[pageNum]) {
            isProgrammaticScroll.current = true;
            pageRefs.current[pageNum].scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Release lock after scroll completes
            setTimeout(() => { isProgrammaticScroll.current = false; }, 600);
        }
    }, [goToPage, store.viewMode]);

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
    // File Upload Handler
    // ══════════════════════════════════════════════════════════════════
    const handleFileUpload = (file) => {
        if (file.type !== 'application/pdf') {
            message.error('Please upload a PDF file.');
            return Upload.LIST_IGNORE;
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
    }, [pdfDoc, pdfFile, logPdfUsage]);

    // ══════════════════════════════════════════════════════════════════
    // Apply & Download (commit annotations to PDF)
    // ══════════════════════════════════════════════════════════════════
    const handleApplyAndDownload = useCallback(async () => {
        if (!pdfBytes) return;

        // Save current page state first
        saveCurrentPageState();

        try {
            const finalAnnotations = { ...pageAnnotations };
            // Include all active canvases
            Object.entries(fabricCanvasRefs?.current || {}).forEach(([pageNumStr, fc]) => {
                if (fc) {
                    const json = fc.toJSON(['customData']);
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

            logPdfUsage('export_pdf');
            message.success('PDF downloaded successfully!');
        } catch (err) {
            console.error('Commit error:', err);
            message.error('Failed to apply annotations to PDF.');
        }
    }, [pdfBytes, pageAnnotations, fabricCanvasRefs, pdfFile, saveCurrentPageState, logPdfUsage]);

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
            const mergedBytes = await mergePdfFiles(mergeFiles);
            await loadPdfFromBytes(mergedBytes, `merged_${Date.now()}.pdf`);
            setMergeFiles([]);
            store.setActiveMode('view');
            logPdfUsage('merge');
            message.success('PDFs merged! You can now annotate, sign, or export.');
        } catch (err) {
            console.error('Merge error:', err);
            message.error('Failed to merge PDFs.');
        } finally {
            setMergeLoading(false);
        }
    }, [mergeFiles, loadPdfFromBytes, setMergeFiles, store, logPdfUsage]);

    const handleMergeFilesAdd = useCallback((files) => {
        setMergeFiles(prev => {
            const existingNames = new Set(prev.map(f => f.name));
            const newItems = files.filter(f => !existingNames.has(f.name));
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
                    const json = fc.toJSON(['customData']);
                    json._canvasWidth = fc.width;
                    json._canvasHeight = fc.height;
                    allAnnotations[pageNumStr] = json;
                }
            });

            for (const pageNum of exportSelectedPages) {
                const blob = await exportPageToImage(
                    pdfDoc, pageNum,
                    allAnnotations[pageNum] || null,
                    format, scale
                );
                const url = URL.createObjectURL(blob);
                const filename = `${(pdfFile?.name || 'page').replace('.pdf', '')}_p${pageNum}.${format}`;
                results.push({ url, filename, pageNum });
            }

            setExportedImages(results);

            // Auto-download if single page
            if (results.length === 1) {
                const link = document.createElement('a');
                link.href = results[0].url;
                link.download = results[0].filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            logPdfUsage('export_image');
            message.success(`Exported ${results.length} page(s) as ${format.toUpperCase()}`);
        } catch (err) {
            console.error('Export error:', err);
            message.error('Failed to export pages.');
        } finally {
            setExportLoading(false);
        }
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

                <Spin spinning={pdfLoading} tip="Loading PDF..." size="large">
                    <div className="pdf-ws-upload-landing" style={{ background: theme.colors.background }}>
                        <div className="pdf-ws-upload-card">
                            <div className="pdf-ws-upload-icon" style={{
                                background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.primary}08)`,
                                color: theme.colors.primary,
                            }}>
                                <FilePdfOutlined />
                            </div>
                            <Title level={3} style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>
                                PDF Workstation
                            </Title>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, display: 'block', marginBottom: 32 }}>
                                View, annotate, edit, sign, merge, and export — all in one place
                            </Text>
                            <Dragger
                                accept=".pdf,application/pdf"
                                showUploadList={false}
                                beforeUpload={handleFileUpload}
                                style={{
                                    borderRadius: 16, padding: '40px 24px',
                                    border: `2px dashed ${theme.colors.primary}55`,
                                    background: `${theme.colors.primary}04`,
                                }}
                            >
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined style={{ color: theme.colors.primary, fontSize: 48 }} />
                                </p>
                                <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
                                    Click or drag a PDF file here
                                </p>
                                <p className="ant-upload-hint" style={{ fontSize: 13 }}>
                                    Open a document to start editing, annotating, or converting
                                </p>
                            </Dragger>
                        </div>
                    </div>
                </Spin>

                {/* ── Dashboard Modal ── */}
                <PdfUsageDashboard 
                    open={dashboardOpen} 
                    onClose={() => setDashboardOpen(false)} 
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

            {/* ── Keyboard Shortcuts ── */}
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
            />

            {/* ── Signature Pad Modal ── */}
            <SignaturePad
                open={sigPadOpen}
                onClose={() => setSigPadOpen(false)}
                onComplete={handleSignatureComplete}
            />

            {/* ── Mode Switcher Bar ── */}
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
                    value={store.activeMode === 'watermark' ? 'view' : store.activeMode}
                    onChange={(val) => {
                        if (val === 'watermark') {
                            usedToolsRef.current.add('watermark');
                            setWatermarkOpen(true);
                            return;
                        }
                        saveCurrentPageState();
                        store.setActiveMode(val);
                        store.setActiveTool('select');
                    }}
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

                {/* ── Global actions ── */}
                <Space size={4}>
                    <Tooltip title="Usage Dashboard">
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<DashboardOutlined style={{ color: theme.colors.primary }} />} 
                            onClick={() => setDashboardOpen(true)}
                        />
                    </Tooltip>
                    
                    <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                    {/* View Toggle */}
                    <Tooltip title={store.viewMode === 'continuous' ? "Switch to Single Page" : "Switch to Continuous"}>
                        <Button size="small" 
                            icon={store.viewMode === 'continuous' ? <AppstoreOutlined /> : <InsertRowAboveOutlined />}
                            onClick={() => store.setViewMode(store.viewMode === 'continuous' ? 'single' : 'continuous')}
                            style={{ borderRadius: 7 }} 
                        />
                    </Tooltip>

                    <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                    {/* Page nav */}
                    <Tooltip title="Previous page">
                        <Button size="small" icon={<LeftOutlined />}
                            disabled={currentPage <= 1} onClick={handlePrevPage}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>
                    <span className="pdf-ws-page-pill" style={{
                        background: `${theme.colors.primary}12`,
                        color: theme.colors.primary,
                    }}>
                        {currentPage} / {totalPages}
                    </span>
                    <Tooltip title="Next page">
                        <Button size="small" icon={<RightOutlined />}
                            disabled={currentPage >= totalPages} onClick={handleNextPage}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>

                    <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                    {/* Zoom */}
                    <Tooltip title="Zoom out">
                        <Button size="small" icon={<ZoomOutOutlined />} onClick={() => { saveCurrentPageState(); zoomOut(); }}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>
                    <Select
                        size="small"
                        value={ZOOM_OPTIONS.some(o => o.value === zoom) ? zoom : undefined}
                        placeholder={`${Math.round(zoom * 100)}%`}
                        onChange={(val) => {
                            saveCurrentPageState();
                            if (val === 'fit') {
                                // Re-calculate fit-to-width
                                if (canvasWrapperRef.current && pdfDoc) {
                                    pdfDoc.getPage(currentPage).then(page => {
                                        const vp = page.getViewport({ scale: 1.0 });
                                        const wrapperW = canvasWrapperRef.current.clientWidth - 60;
                                        const fitZoom = Math.min(wrapperW / vp.width, 1.5);
                                        setZoom(Math.max(0.25, +(fitZoom).toFixed(2)));
                                    });
                                }
                            } else {
                                zoomTo(val);
                            }
                        }}
                        options={[
                            { value: 'fit', label: 'Fit Width' },
                            ...ZOOM_OPTIONS,
                        ]}
                        style={{ width: 90 }}
                    />
                    <Tooltip title="Zoom in">
                        <Button size="small" icon={<ZoomInOutlined />} onClick={() => { saveCurrentPageState(); zoomIn(); }}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>

                    <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                    {/* Undo / Redo */}
                    <Tooltip title="Undo (Ctrl+Z)">
                        <Button size="small" icon={<UndoOutlined />}
                            disabled={!canUndo} onClick={undo}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>
                    <Tooltip title="Redo (Ctrl+Y)">
                        <Button size="small" icon={<RedoOutlined />}
                            disabled={!canRedo} onClick={redo}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>

                    {/* Delete selected */}
                    {store.selectedObjectId && (
                        <Tooltip title="Delete selected (Del)">
                            <Button size="small" danger icon={<DeleteOutlined />}
                                onClick={handleDeleteSelected}
                                style={{ borderRadius: 7 }} />
                        </Tooltip>
                    )}

                    <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                    {/* Toggle panels */}
                    <Tooltip title={leftCollapsed ? "Show pages" : "Hide pages"}>
                        <Button size="small"
                            icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setLeftCollapsed(!leftCollapsed)}
                            style={{ borderRadius: 7 }} />
                    </Tooltip>

                    {/* Save/Download */}
                    <Tooltip title="Apply & Download PDF">
                        <Button size="small" type="primary" icon={<DownloadOutlined />}
                            onClick={handleApplyAndDownload}
                            disabled={(totalAnnotations === 0 && !canUndo && Object.values(fabricCanvasRefs?.current || {}).every(fc => !fc || fc.getObjects().length === 0)) && store.activeMode !== 'merge'}
                            style={{ borderRadius: 7, fontWeight: 600 }}>
                            Save
                        </Button>
                    </Tooltip>

                    {/* Change PDF */}
                    <Upload
                        accept=".pdf,application/pdf"
                        showUploadList={false}
                        beforeUpload={handleFileUpload}
                    >
                        <Tooltip title="Open another PDF">
                            <Button size="small" style={{ borderRadius: 7 }}>
                                <FilePdfOutlined />
                            </Button>
                        </Tooltip>
                    </Upload>
                </Space>
            </div>

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
                            <MergePreview mergeFiles={mergeFiles} />
                        ) : pdfDoc ? (
                            store.viewMode === 'continuous' ? (
                                <div className="pdf-ws-continuous-container" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0', alignItems: 'center' }}>
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <div 
                                            key={i+1} 
                                            data-page={i+1} 
                                            ref={el => pageRefs.current[i+1] = el}
                                            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        >
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
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
                                    <div style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
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
                    </div>

                    {/* Status Bar */}
                    <div className="pdf-ws-statusbar" style={{
                        background: theme.colors.surface,
                        borderColor: theme.colors.border,
                        color: theme.colors.textSecondary,
                    }}>
                        <span>
                            {pdfFile && (
                                <>
                                    <Tag color="blue" style={{ borderRadius: 6, fontSize: 10 }}>
                                        <FilePdfOutlined style={{ marginRight: 3 }} />
                                        {pdfFile.name}
                                    </Tag>
                                    Page {currentPage}/{totalPages} • Zoom {Math.round(zoom * 100)}%
                                </>
                            )}
                        </span>
                        <span>
                            {totalAnnotations > 0 && `${totalAnnotations} annotation(s)`}
                            {store.activeTool !== 'select' && ` • Tool: ${store.activeTool}`}
                        </span>
                    </div>
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
                fabricCanvasRefs={fabricCanvasRefs}
                pushHistory={pushHistory}
                logPdfUsage={logPdfUsage}
            />
        </div>
    );
};

export default PdfEditorTool;
