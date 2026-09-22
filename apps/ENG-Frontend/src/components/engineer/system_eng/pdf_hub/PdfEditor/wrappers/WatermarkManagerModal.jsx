import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Modal, Form, Input, Button, List, Spin, Space, Popconfirm, Select, Slider,
    message, ColorPicker, Row, Col, Tooltip, InputNumber, Switch,
    Segmented, Tag, Radio, Table, Empty, Card
} from 'antd';
import {
    DeleteOutlined, ShareAltOutlined, PlusOutlined, FormatPainterOutlined,
    EditOutlined, BoldOutlined, ItalicOutlined, BorderOuterOutlined,
    VerticalAlignTopOutlined, VerticalAlignBottomOutlined, VerticalAlignMiddleOutlined,
    ColumnHeightOutlined, ClearOutlined, SearchOutlined, HistoryOutlined,
    CopyOutlined, ArrowLeftOutlined, CheckOutlined
} from '@ant-design/icons';
import * as fabric from 'fabric';
import { useAuthStore } from '../../../../../../stores/authStore';
import * as watermarkApi from '../services/watermarkApi';

// ── Constants ──
const FONT_OPTIONS = [
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Courier New', label: 'Courier New' },
    { value: 'Georgia', label: 'Georgia' },
];

const COLOR_PRESETS = [
    {
        label: 'Engineering Standards',
        colors: [
            '#D32F2F', '#C62828', '#B71C1C', '#F57C00', '#2E7D32', '#1976D2',
            '#0288D1', '#757575', '#000000', '#555555', '#9E9E9E', '#E91E63'
        ],
    },
];

const POSITION_PRESETS = [
    { key: 'center', label: 'Center', icon: <VerticalAlignMiddleOutlined /> },
    { key: 'header', label: 'Header (Top)', icon: <VerticalAlignTopOutlined /> },
    { key: 'footer', label: 'Footer (Bottom)', icon: <VerticalAlignBottomOutlined /> },
    { key: 'diagonal', label: 'Diagonal', icon: <ColumnHeightOutlined /> },
    { key: 'top-left', label: 'Top-Left' },
    { key: 'top-right', label: 'Top-Right' },
    { key: 'bottom-left', label: 'Bottom-Left' },
    { key: 'bottom-right', label: 'Bottom-Right' },
];

const PAGE_RANGE_OPTIONS = [
    { value: 'all', label: 'All Pages' },
    { value: 'current', label: 'Current Page' },
    { value: 'custom', label: 'Custom Range' },
    { value: 'odd', label: 'Odd Pages' },
    { value: 'even', label: 'Even Pages' },
];

const PLACEHOLDER_TAGS = [
    { key: '{DATE}', label: 'Date', color: 'blue' },
    { key: '{TIME}', label: 'Time', color: 'cyan' },
    { key: '{USER}', label: 'User', color: 'green' },
    { key: '{FILENAME}', label: 'Filename', color: 'orange' },
    { key: '{PAGE}', label: 'Page #', color: 'purple' },
    { key: '{TOTAL_PAGES}', label: 'Total Pages', color: 'magenta' },
    { key: '{DEPT}', label: 'Dept', color: 'gold' },
    { key: '{COMPANY}', label: 'Company', color: 'geekblue' },
];

/** Safe Color Parser */
function safeColorToHex(c, fallback = '#000000') {
    if (!c) return fallback;
    if (typeof c === 'string') return c;
    if (typeof c.toHexString === 'function') return c.toHexString();
    if (typeof c.toRgbString === 'function') return c.toRgbString();
    return fallback;
}

/** Clean Thai characters or parenthetical annotations from template name for clean international UI */
function getDisplayName(name) {
    if (!name) return '';
    return String(name).replace(/\s*\([^)]*[\u0E00-\u0E7F]+[^)]*\)/g, '').trim();
}

/** Replace dynamic placeholders for client-side preview */
function resolvePlaceholders(text, userName, pdfFileName, userDept) {
    if (!text) return '';
    const now = new Date();
    return String(text)
        .replace(/\{DATE\}/g, now.toISOString().split('T')[0])
        .replace(/\{TIME\}/g, now.toTimeString().split(' ')[0].substring(0, 5))
        .replace(/\{USER\}/g, userName || 'Unknown')
        .replace(/\{FILENAME\}/g, pdfFileName || 'document.pdf')
        .replace(/\{DEPT\}/g, userDept || 'ENG')
        .replace(/\{COMPANY\}/g, 'MinebeaMitsumi');
}

/** Parse a page range string like "1, 3, 5-10" into a Set of page numbers */
function parsePageRange(rangeStr, totalPages) {
    const pages = new Set();
    if (!rangeStr) return pages;
    const parts = rangeStr.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
        if (part.includes('-')) {
            const [a, b] = part.split('-').map(Number);
            if (!isNaN(a) && !isNaN(b)) {
                for (let i = Math.max(1, a); i <= Math.min(totalPages, b); i++) pages.add(i);
            }
        } else {
            const n = Number(part);
            if (!isNaN(n) && n >= 1 && n <= totalPages) pages.add(n);
        }
    }
    return pages;
}

// ── Left Column: True-Aspect Paper Preview Component ──
const RealisticPaperPreview = ({ formValues, pdfFileName, userName }) => {
    const canvasRef = useRef(null);
    const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'

    // Real A4 Aspect Ratios:
    // Portrait: 210 x 297 mm -> Aspect 1 : 1.414 -> e.g. 270 x 382 px
    // Landscape: 297 x 210 mm -> Aspect 1.414 : 1 -> e.g. 360 x 254 px
    const previewDims = useMemo(() => {
        if (orientation === 'portrait') {
            return { width: 270, height: 382 };
        }
        return { width: 360, height: 254 };
    }, [orientation]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // 1. Draw crisp white paper sheet with subtle inner border
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // 2. Draw subtle CAD engineering grid
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        const gridStep = 24;
        for (let y = 0; y < H; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let x = 0; x < W; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

        // Mock CAD Drawing details to show Underlay vs Overlay
        const isUnderlay = formValues?.layer === 'underlay';
        const drawMockCadDrawing = () => {
            ctx.save();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            
            // Outer drawing boundary & title block
            const pad = 16;
            ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
            
            // Title block box (bottom right)
            const tbW = Math.min(125, W * 0.44);
            const tbH = 32;
            ctx.strokeRect(W - pad - tbW, H - pad - tbH, tbW, tbH);
            ctx.fillStyle = '#64748b';
            ctx.font = '7px sans-serif';
            ctx.fillText('MINEBEAMITSUMI ENGINEERING', W - pad - tbW + 5, H - pad - tbH + 11);
            ctx.fillText('DWG NO: B-70492-REV.C', W - pad - tbW + 5, H - pad - tbH + 22);

            // Sample CAD mechanical part geometry in center
            ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.22, 0, Math.PI * 2);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.12, 0, Math.PI * 2);
            ctx.stroke();

            // Center crosshair
            ctx.strokeStyle = '#cbd5e1';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(W / 2 - 50, H / 2); ctx.lineTo(W / 2 + 50, H / 2);
            ctx.moveTo(W / 2, H / 2 - 50); ctx.lineTo(W / 2, H / 2 + 50);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dimensions
            ctx.fillStyle = '#475569';
            ctx.font = '8px monospace';
            ctx.fillText('Ø 42.00 ±0.02', W / 2 + 10, H / 2 - 30);
            ctx.fillText('Ø 20.00 H7', W / 2 - 35, H / 2 + 40);

            ctx.restore();
        };

        // If overlay, draw CAD first, watermark on top.
        // If underlay, draw watermark first, CAD on top!
        if (!isUnderlay) {
            drawMockCadDrawing();
        }

        // Draw Watermark
        const rawText = formValues?.text || 'WATERMARK';
        const text = resolvePlaceholders(rawText, userName, pdfFileName)
            .replace(/\{PAGE\}/g, '1')
            .replace(/\{TOTAL_PAGES\}/g, '12');

        const color = safeColorToHex(formValues?.color, '#D32F2F');
        const opacity = formValues?.opacity ?? 0.35;
        // Proportionate font size for preview canvas
        const baseFontSize = formValues?.font_size || 48;
        const previewFontSize = Math.max(8, Math.min(baseFontSize * (W / 600), 50));
        const angle = -(formValues?.angle || 0) * Math.PI / 180;
        const fontFamily = formValues?.font_family || 'Helvetica';
        const fontWeight = formValues?.font_weight === 'bold' ? 'bold' : 'normal';
        const fontStyle = formValues?.font_style === 'italic' ? 'italic' : 'normal';
        const repeatMode = formValues?.repeat_mode || false;
        const repeatStyle = formValues?.repeat_style || 'full';
        const repeatGap = Math.max(20, (formValues?.repeat_gap || 100) * (W / 600));

        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.font = `${fontStyle} ${fontWeight} ${previewFontSize}px ${fontFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (repeatMode) {
            const textMetrics = ctx.measureText(text);
            const textW = textMetrics.width + repeatGap;
            const textH = previewFontSize + repeatGap;
            const diagonal = Math.sqrt(W * W + H * H);

            if (repeatStyle === 'line') {
                const cols = Math.ceil(diagonal / textW) * 2 + 2;
                for (let col = -cols / 2; col < cols / 2; col++) {
                    const dist = col * textW;
                    const cx = W / 2 + dist * Math.cos(angle);
                    const cy = H / 2 + dist * Math.sin(angle);
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                }
            } else {
                for (let row = -2; row < Math.ceil(H / textH) + 3; row++) {
                    for (let col = -2; col < Math.ceil(W / textW) + 3; col++) {
                        const offsetX = (row % 2 === 0) ? 0 : textW / 2;
                        const cx = col * textW + offsetX + textW / 2;
                        const cy = row * textH + textH / 2;

                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.rotate(angle);
                        ctx.fillText(text, 0, 0);
                        ctx.restore();
                    }
                }
            }
        } else {
            const preset = formValues?.position_preset || 'center';
            const unit = formValues?.margin_unit || 'cm';
            const offsetVal = Number(formValues?.margin_offset ?? 1.5);
            // Convert to cm: 1 inch = 2.54 cm
            const offsetCm = unit === 'in' ? offsetVal * 2.54 : offsetVal;
            // Canvas A4 dimensions in cm: Portrait is 21.0 x 29.7 cm; Landscape is 29.7 x 21.0 cm
            const pageWcm = orientation === 'portrait' ? 21.0 : 29.7;
            const pageHcm = orientation === 'portrait' ? 29.7 : 21.0;
            const pxPerCmX = W / pageWcm;
            const pxPerCmY = H / pageHcm;
            const offX = offsetCm * pxPerCmX;
            const offY = offsetCm * pxPerCmY;

            let cx = W / 2, cy = H / 2;
            const textMetrics = ctx.measureText(text);
            const textW = textMetrics.width;

            if (preset === 'header') {
                cy = Math.max(previewFontSize / 2 + 4, offY + previewFontSize / 2);
            } else if (preset === 'footer') {
                cy = Math.min(H - previewFontSize / 2 - 4, H - offY - previewFontSize / 2);
            } else if (preset === 'top-left') {
                cx = Math.max(textW / 2 + 4, offX + textW / 2);
                cy = Math.max(previewFontSize / 2 + 4, offY + previewFontSize / 2);
            } else if (preset === 'top-right') {
                cx = Math.min(W - textW / 2 - 4, W - offX - textW / 2);
                cy = Math.max(previewFontSize / 2 + 4, offY + previewFontSize / 2);
            } else if (preset === 'bottom-left') {
                cx = Math.max(textW / 2 + 4, offX + textW / 2);
                cy = Math.min(H - previewFontSize / 2 - 4, H - offY - previewFontSize / 2);
            } else if (preset === 'bottom-right') {
                cx = Math.min(W - textW / 2 - 4, W - offX - textW / 2);
                cy = Math.min(H - previewFontSize / 2 - 4, H - offY - previewFontSize / 2);
            }

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        ctx.globalAlpha = 1;

        if (isUnderlay) {
            drawMockCadDrawing();
        }
    }, [formValues, pdfFileName, userName, previewDims, orientation]);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '12px 14px',
            height: 560,
            minHeight: 560,
            justifyContent: 'space-between'
        }}>
            {/* Header controls for preview */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
                    <BorderOuterOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                    Live A4 Preview
                </span>
                <Segmented
                    size="small"
                    value={orientation}
                    onChange={setOrientation}
                    options={[
                        { label: 'Portrait', value: 'portrait' },
                        { label: 'Landscape', value: 'landscape' },
                    ]}
                />
            </div>

            {/* Paper Sheet Simulation */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                padding: '2px 0'
            }}>
                <div style={{
                    background: '#ffffff',
                    boxShadow: '0 8px 20px -4px rgba(0, 0, 0, 0.12), 0 6px 8px -4px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.25s ease',
                }}>
                    <canvas
                        ref={canvasRef}
                        width={previewDims.width}
                        height={previewDims.height}
                        style={{
                            display: 'block',
                            width: previewDims.width,
                            height: previewDims.height,
                        }}
                    />
                </div>
            </div>

            {/* Bottom preview metadata badges */}
            <div style={{ width: '100%', marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={formValues?.layer === 'underlay' ? 'cyan' : 'purple'} style={{ margin: 0, fontWeight: 600, fontSize: 11 }}>
                    {formValues?.layer === 'underlay' ? 'UNDERLAY' : 'OVERLAY'}
                </Tag>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                    {formValues?.font_family || 'Helvetica'} · {formValues?.font_size || 48}px · {formValues?.angle || 0}° · {Math.round((formValues?.opacity || 0.35) * 100)}%
                    {formValues?.position_preset && formValues?.position_preset !== 'center' && formValues?.position_preset !== 'diagonal' && !formValues?.repeat_mode && (
                        <> · Edge: {formValues?.margin_offset ?? 1.5}{formValues?.margin_unit || 'cm'}</>
                    )}
                </span>
            </div>
        </div>
    );
};

// ── Main WatermarkManagerModal Component ──
const WatermarkManagerModal = ({
    open, onClose, fabricCanvasRefs, totalPages, pushHistory,
    pdfFile, currentPage, pdfDoc, pageAnnotations, setPageAnnotations,
    logPdfUsage, zoom = 1.0
}) => {
    const empNo = useAuthStore(state => state.empNo);
    const userName = useAuthStore(state => state.userName);
    const userRole = useAuthStore(state => state.userRole);
    const userDepartment = useAuthStore(state => state.userDepartment);

    const [watermarks, setWatermarks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('templates'); // 'templates' | 'history'
    const [categoryFilter, setCategoryFilter] = useState('my'); // Default to 'my' as requested
    const [searchQuery, setSearchQuery] = useState('');

    const [isCreate, setIsCreate] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form] = Form.useForm();

    // Live preview state with margin support
    const [previewValues, setPreviewValues] = useState({
        text: '', opacity: 0.35, font_size: 48, angle: 45, color: '#D32F2F',
        repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
        font_weight: 'bold', font_style: 'normal', position_preset: 'center',
        margin_unit: 'cm', margin_offset: 1.50,
        layer: 'overlay', category: 'General'
    });

    // Apply-time options
    const [pageRangeMode, setPageRangeMode] = useState('all');
    const [customPageRange, setCustomPageRange] = useState('');

    // Audit History state
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Sharing modal
    const [shareOpen, setShareOpen] = useState(false);
    const [shareWmId, setShareWmId] = useState(null);
    const [shareEmpno, setShareEmpno] = useState('');

    // Fetch watermarks unconditionally whenever modal is opened
    useEffect(() => {
        if (open) {
            loadWatermarkData();
        } else {
            setIsCreate(false);
            setEditingId(null);
            form.resetFields();
            setSearchQuery('');
            setViewMode('templates');
            setCategoryFilter('my');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const loadWatermarkData = async () => {
        setLoading(true);
        try {
            const data = await watermarkApi.fetchWatermarks();
            setWatermarks(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('[WatermarkManager] fetch failed, fallback gracefully:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryData = async () => {
        setHistoryLoading(true);
        try {
            const data = await watermarkApi.fetchWatermarkHistory();
            setHistoryLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('[WatermarkManager] history fetch failed:', err.message);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Filtered templates
    const filteredWatermarks = useMemo(() => {
        return watermarks.filter(wm => {
            // Category filter
            if (categoryFilter === 'system' && !wm.is_system) return false;
            if (categoryFilter === 'my' && (wm.is_system || (wm.owner_empno !== empNo && userRole !== 'AD'))) return false;
            if (categoryFilter === 'shared' && (wm.is_system || wm.owner_empno === empNo)) return false;

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const displayName = getDisplayName(wm.name).toLowerCase();
                const matchName = displayName.includes(q) || wm.name?.toLowerCase().includes(q);
                const matchText = wm.text?.toLowerCase().includes(q);
                const matchCat = wm.category?.toLowerCase().includes(q);
                if (!matchName && !matchText && !matchCat) return false;
            }
            return true;
        });
    }, [watermarks, categoryFilter, searchQuery, empNo, userRole]);

    // Counts for Category Tabs
    const categoryCounts = useMemo(() => {
        return {
            my: watermarks.filter(w => !w.is_system && (w.owner_empno === empNo || userRole === 'AD')).length,
            all: watermarks.length,
            system: watermarks.filter(w => w.is_system).length,
            shared: watermarks.filter(w => !w.is_system && w.owner_empno !== empNo).length,
        };
    }, [watermarks, empNo, userRole]);

    // Sync form changes to preview
    const updatePreview = useCallback(() => {
        const vals = form.getFieldsValue();
        setPreviewValues(prev => ({
            ...prev,
            ...vals,
            color: safeColorToHex(vals.color, prev.color),
        }));
    }, [form]);

    const handleSave = async (values) => {
        setLoading(true);
        try {
            const payload = {
                ...values,
                owner_empno: empNo || 'GUEST',
                color: safeColorToHex(values.color, '#000000'),
                font_family: values.font_family || 'Helvetica',
                font_weight: values.font_weight || 'normal',
                font_style: values.font_style || 'normal',
                position_preset: values.position_preset || 'center',
                margin_unit: values.margin_unit || 'cm',
                margin_offset: Number(values.margin_offset ?? 1.50),
                repeat_mode: values.repeat_mode || false,
                repeat_style: values.repeat_style || 'full',
                repeat_gap: values.repeat_gap || 100,
                layer: values.layer || 'overlay',
                category: values.category || 'General',
                is_public: true
            };

            if (editingId) {
                await watermarkApi.updateWatermark(editingId, payload);
                message.success('Watermark template updated');
            } else {
                await watermarkApi.createWatermark(payload);
                message.success('Watermark template created');
            }

            setIsCreate(false);
            setEditingId(null);
            form.resetFields();
            loadWatermarkData();
        } catch (err) {
            message.error(err.response?.data?.message || err.message || 'Failed to save watermark');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (wm) => {
        if (wm.is_system) {
            message.warning('System standard watermarks cannot be deleted');
            return;
        }
        try {
            await watermarkApi.deleteWatermark(wm.id, empNo);
            message.success('Watermark deleted');
            loadWatermarkData();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to delete watermark');
        }
    };

    const handleShare = async () => {
        if (!shareEmpno.trim()) return;
        try {
            await watermarkApi.shareWatermark(shareWmId, shareEmpno.trim());
            message.success(`Watermark shared with ${shareEmpno.trim()}`);
            setShareOpen(false);
            setShareEmpno('');
            loadWatermarkData();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to share watermark');
        }
    };

    const handleEdit = (wm) => {
        if (wm.is_system && userRole !== 'AD') {
            message.info('System standard watermarks cannot be edited. You can create a copy.');
            return;
        }
        setEditingId(wm.id);
        setIsCreate(true);
        form.resetFields();
        setTimeout(() => {
            form.setFieldsValue({
                name: getDisplayName(wm.name),
                text: wm.text,
                color: wm.color,
                opacity: wm.opacity,
                font_size: wm.font_size,
                angle: wm.angle,
                repeat_mode: wm.repeat_mode,
                repeat_style: wm.repeat_style || 'full',
                repeat_gap: wm.repeat_gap,
                font_family: wm.font_family || 'Helvetica',
                font_weight: wm.font_weight || 'normal',
                font_style: wm.font_style || 'normal',
                position_preset: wm.position_preset || 'center',
                margin_unit: wm.margin_unit || 'cm',
                margin_offset: Number(wm.margin_offset ?? 1.50),
                layer: wm.layer || 'overlay',
                category: wm.category || 'General',
                is_public: wm.is_public ?? true
            });
            updatePreview();
        }, 0);
    };

    const handleDuplicate = (wm) => {
        setIsCreate(true);
        setEditingId(null);
        form.resetFields();
        setTimeout(() => {
            form.setFieldsValue({
                name: `${getDisplayName(wm.name)} (Copy)`,
                text: wm.text,
                color: wm.color,
                opacity: wm.opacity,
                font_size: wm.font_size,
                angle: wm.angle,
                repeat_mode: wm.repeat_mode,
                repeat_style: wm.repeat_style || 'full',
                repeat_gap: wm.repeat_gap,
                font_family: wm.font_family || 'Helvetica',
                font_weight: wm.font_weight || 'normal',
                font_style: wm.font_style || 'normal',
                position_preset: wm.position_preset || 'center',
                margin_unit: wm.margin_unit || 'cm',
                margin_offset: Number(wm.margin_offset ?? 1.50),
                layer: wm.layer || 'overlay',
                category: wm.category || 'General',
                is_public: true
            });
            updatePreview();
        }, 0);
    };

    const insertPlaceholder = (placeholder) => {
        const current = form.getFieldValue('text') || '';
        form.setFieldsValue({ text: current + placeholder });
        updatePreview();
    };

    // ── Apply Watermark ──
    const getTargetPages = () => {
        const total = totalPages || 1;
        const allPageNums = Array.from({ length: total }, (_, i) => i + 1);
        switch (pageRangeMode) {
            case 'current':
                return [currentPage || 1];
            case 'custom':
                return Array.from(parsePageRange(customPageRange, total));
            case 'odd':
                return allPageNums.filter(p => p % 2 !== 0);
            case 'even':
                return allPageNums.filter(p => p % 2 === 0);
            case 'all':
            default:
                return allPageNums;
        }
    };

    const handleClearWatermarks = () => {
        const targetPages = getTargetPages();
        if (targetPages.length === 0) {
            message.warning('No pages matched the selected range');
            return;
        }
        pushHistory?.();

        // 1. Remove from active fabric canvases
        targetPages.forEach(pageNum => {
            const fc = fabricCanvasRefs?.current?.[pageNum];
            if (fc) {
                const wmObjs = fc.getObjects().filter(o => o.customData?.type === 'watermark');
                wmObjs.forEach(o => fc.remove(o));
                fc.renderAll();
            }
        });

        // 2. Remove from pageAnnotations
        if (setPageAnnotations) {
            setPageAnnotations(prev => {
                const next = { ...prev };
                targetPages.forEach(pageNum => {
                    const fc = fabricCanvasRefs?.current?.[pageNum];
                    if (fc) {
                        const snap = fc.toObject ? fc.toObject(['id', 'customData', 'textLines']) : fc.toJSON(['id', 'customData', 'textLines']);
                        snap._canvasWidth = fc.width;
                        snap._canvasHeight = fc.height;
                        next[pageNum] = snap;
                    } else if (next[pageNum]?.objects) {
                        next[pageNum] = {
                            ...next[pageNum],
                            objects: next[pageNum].objects.filter(o => o.customData?.type !== 'watermark')
                        };
                    }
                });
                return next;
            });
        }

        message.success(`Watermarks cleared from ${targetPages.length} page(s)`);
    };

    const applyWatermark = async (wm) => {
        const targetPages = getTargetPages();
        if (targetPages.length === 0) {
            message.warning('No pages matched the selected range');
            return;
        }

        const resolvedText = resolvePlaceholders(wm.text, userName, pdfFile?.name, userDepartment);
        const isRepeat = wm.repeat_mode;
        const currentZoom = zoom || 1.0;
        const wmLayer = wm.layer || 'overlay';

        const buildWatermarkObjects = (width, height, isCanvas = false) => {
            const objs = [];
            const angleRad = -(wm.angle || 0);
            const targetFontSize = wm.font_size || 48;
            const scale = isCanvas ? currentZoom : 1;

            const charWidth = targetFontSize * 0.6;
            const approxTextWidth = resolvedText.length * charWidth;
            const approxTextHeight = targetFontSize * 1.2;

            if (isRepeat) {
                const gap = (wm.repeat_gap || 100) * scale;
                const rStyle = wm.repeat_style || 'full';
                const textW = (approxTextWidth * scale) + gap;
                const textH = (targetFontSize * scale) + gap;
                const diagonal = Math.sqrt(width * width + height * height);

                if (rStyle === 'line') {
                    const cols = Math.ceil(diagonal / textW) * 2 + 2;
                    const startX = width / 2;
                    const startY = height / 2;
                    for (let col = -cols / 2; col < cols / 2; col++) {
                        const rad = angleRad * Math.PI / 180;
                        const dist = col * textW;
                        const x = startX + dist * Math.cos(rad);
                        const y = startY + dist * Math.sin(rad);
                        objs.push({
                            type: 'text',
                            text: resolvedText,
                            width: approxTextWidth,
                            height: approxTextHeight,
                            left: x,
                            top: y,
                            fill: wm.color,
                            opacity: wm.opacity,
                            fontSize: targetFontSize,
                            scaleX: scale,
                            scaleY: scale,
                            fontFamily: wm.font_family || 'Helvetica',
                            fontWeight: wm.font_weight || 'normal',
                            fontStyle: wm.font_style || 'normal',
                            angle: angleRad,
                            originX: 'center',
                            originY: 'center',
                            selectable: false,
                            evented: false,
                            customData: { type: 'watermark', tiled: true, layer: wmLayer },
                            id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                        });
                    }
                } else {
                    const cols = Math.ceil(diagonal / textW) + 2;
                    const rows = Math.ceil(diagonal / textH) + 2;
                    const startX = -(diagonal - width) / 2;
                    const startY = -(diagonal - height) / 2;
                    for (let row = 0; row < rows; row++) {
                        for (let col = 0; col < cols; col++) {
                            const offsetX = (row % 2 === 0) ? 0 : textW / 2;
                            const x = startX + col * textW + offsetX;
                            const y = startY + row * textH;
                            objs.push({
                                type: 'text',
                                text: resolvedText,
                                width: approxTextWidth,
                                height: approxTextHeight,
                                left: x,
                                top: y,
                                fill: wm.color,
                                opacity: wm.opacity,
                                fontSize: targetFontSize,
                                scaleX: scale,
                                scaleY: scale,
                                fontFamily: wm.font_family || 'Helvetica',
                                fontWeight: wm.font_weight || 'normal',
                                fontStyle: wm.font_style || 'normal',
                                angle: angleRad,
                                originX: 'center',
                                originY: 'center',
                                selectable: false,
                                evented: false,
                                customData: { type: 'watermark', tiled: true, layer: wmLayer },
                                id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                            });
                        }
                    }
                }
            } else {
                const preset = wm.position_preset || 'center';
                let left = width / 2;
                let top = height / 2;
                let angle = -(wm.angle || 0);

                // Calculate edge distance in PDF points (1 inch = 72 pt, 1 cm = 28.3465 pt)
                const unit = wm.margin_unit || 'cm';
                const offsetVal = Number(wm.margin_offset ?? (unit === 'in' ? 0.6 : 1.5));
                const ptsPerUnit = unit === 'in' ? 72 : 28.3465;
                const offsetPts = offsetVal * ptsPerUnit * scale;

                const halfTextW = (approxTextWidth / 2) * scale;
                const halfTextH = (targetFontSize / 2) * scale;

                if (preset === 'header') {
                    top = Math.max(halfTextH, offsetPts + halfTextH);
                } else if (preset === 'footer') {
                    top = Math.min(height - halfTextH, height - offsetPts - halfTextH);
                } else if (preset === 'top-left') {
                    left = Math.max(halfTextW, offsetPts + halfTextW);
                    top = Math.max(halfTextH, offsetPts + halfTextH);
                } else if (preset === 'top-right') {
                    left = Math.min(width - halfTextW, width - offsetPts - halfTextW);
                    top = Math.max(halfTextH, offsetPts + halfTextH);
                } else if (preset === 'bottom-left') {
                    left = Math.max(halfTextW, offsetPts + halfTextW);
                    top = Math.min(height - halfTextH, height - offsetPts - halfTextH);
                } else if (preset === 'bottom-right') {
                    left = Math.min(width - halfTextW, width - offsetPts - halfTextW);
                    top = Math.min(height - halfTextH, height - offsetPts - halfTextH);
                } else if (preset === 'diagonal') {
                    angle = -45;
                }

                objs.push({
                    type: 'text',
                    text: resolvedText,
                    width: approxTextWidth,
                    height: approxTextHeight,
                    left,
                    top,
                    fill: wm.color,
                    opacity: wm.opacity,
                    fontSize: targetFontSize,
                    scaleX: scale,
                    scaleY: scale,
                    fontFamily: wm.font_family || 'Helvetica',
                    fontWeight: wm.font_weight || 'normal',
                    fontStyle: wm.font_style || 'normal',
                    angle,
                    originX: 'center',
                    originY: 'center',
                    selectable: true,
                    customData: { type: 'watermark', layer: wmLayer },
                    id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                });
            }
            return objs;
        };

        const addTextToCanvas = (fc) => {
            if (!fc) return;
            const objs = buildWatermarkObjects(fc.width, fc.height, true);
            objs.forEach(objData => {
                const textObj = new fabric.Text(objData.text, {
                    left: objData.left,
                    top: objData.top,
                    width: objData.width,
                    height: objData.height,
                    scaleX: objData.scaleX,
                    scaleY: objData.scaleY,
                    fill: objData.fill,
                    opacity: objData.opacity,
                    fontSize: objData.fontSize,
                    fontFamily: objData.fontFamily,
                    fontWeight: objData.fontWeight,
                    fontStyle: objData.fontStyle,
                    angle: objData.angle,
                    originX: objData.originX,
                    originY: objData.originY,
                    selectable: objData.selectable,
                    evented: objData.evented,
                    customData: objData.customData,
                    id: objData.id,
                });
                fc.add(textObj);
                if (wmLayer === 'underlay' && typeof fc.sendObjectToBack === 'function') {
                    fc.sendObjectToBack(textObj);
                }
            });
            fc.renderAll();
        };

        // Fast Parallel Pre-query for true page dimensions on unrendered pages
        const unrenderedPages = targetPages.filter(p => !fabricCanvasRefs?.current?.[p]);
        const unrenderedPageDims = {};

        if (unrenderedPages.length > 0 && pdfDoc) {
            await Promise.all(
                unrenderedPages.map(async (pageNum) => {
                    try {
                        const p = await pdfDoc.getPage(pageNum);
                        const vp = p.getViewport({ scale: 1.0 });
                        unrenderedPageDims[pageNum] = { width: vp.width, height: vp.height };
                    } catch {
                        const existing = pageAnnotations?.[pageNum];
                        unrenderedPageDims[pageNum] = {
                            width: existing?._canvasWidth || 595.28,
                            height: existing?._canvasHeight || 841.89
                        };
                    }
                })
            );
        }

        pushHistory?.();

        targetPages.forEach(pageNum => {
            const fc = fabricCanvasRefs?.current?.[pageNum];
            if (fc) {
                addTextToCanvas(fc);
            }
        });

        if (setPageAnnotations) {
            setPageAnnotations(prev => {
                const next = { ...prev };
                targetPages.forEach(pageNum => {
                    const fc = fabricCanvasRefs?.current?.[pageNum];
                    if (fc) {
                        const snap = fc.toObject ? fc.toObject(['id', 'customData', 'textLines']) : fc.toJSON(['id', 'customData', 'textLines']);
                        snap._canvasWidth = fc.width;
                        snap._canvasHeight = fc.height;
                        next[pageNum] = snap;
                    } else {
                        const existingPage = next[pageNum] || {};
                        const dims = unrenderedPageDims[pageNum] || { width: 595.28, height: 841.89 };
                        const pW = dims.width;
                        const pH = dims.height;
                        const wmObjects = buildWatermarkObjects(pW, pH, false);
                        const existingObjects = existingPage.objects ? [...existingPage.objects] : [];
                        next[pageNum] = {
                            ...existingPage,
                            _canvasWidth: pW,
                            _canvasHeight: pH,
                            objects: wmLayer === 'underlay' ? [...wmObjects, ...existingObjects] : [...existingObjects, ...wmObjects],
                        };
                    }
                });
                return next;
            });
        }

        // Automatic Audit Logging
        watermarkApi.logWatermarkUsage({
            watermark_id: wm.id,
            watermark_name: getDisplayName(wm.name),
            filename: pdfFile?.name || 'document.pdf',
            empno: empNo || 'GUEST',
            user_name: userName || 'Guest User'
        });

        const rangeLabel = pageRangeMode === 'all' ? 'all pages'
            : pageRangeMode === 'current' ? `page ${currentPage}`
            : pageRangeMode === 'odd' ? 'odd pages'
            : pageRangeMode === 'even' ? 'even pages'
            : `pages: ${customPageRange}`;
        message.success(`Applied "${getDisplayName(wm.name)}" to ${rangeLabel} (${targetPages.length} page${targetPages.length > 1 ? 's' : ''})`);
        onClose();
    };

    const isAdmin = userRole === 'AD';

    // ── Render Modal ──
    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FormatPainterOutlined style={{ color: '#2563eb', fontSize: 18 }} />
                        <span style={{ fontWeight: 600, fontSize: 16 }}>PDF Hub Watermark Manager</span>
                    </div>
                    {isAdmin && (
                        <Segmented
                            size="middle"
                            value={viewMode}
                            onChange={val => {
                                setViewMode(val);
                                if (val === 'history') loadHistoryData();
                            }}
                            options={[
                                { label: 'Templates Library', value: 'templates', icon: <FormatPainterOutlined /> },
                                { label: 'Audit History', value: 'history', icon: <HistoryOutlined /> }
                            ]}
                        />
                    )}
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={1160}
            style={{ top: 20, maxWidth: '96vw' }}
            styles={{
                body: {
                    padding: '16px 20px',
                    maxHeight: isCreate ? 'calc(92vh - 50px)' : 'calc(90vh - 70px)',
                    overflowY: isCreate ? 'hidden' : 'auto',
                    overflowX: 'hidden'
                }
            }}
            destroyOnHidden
        >
            <Spin spinning={loading}>
                {viewMode === 'templates' && (
                    <>
                        {/* ════════════════════════════════════════════════
                            VIEW 1: TEMPLATE LIST & MANAGEMENT
                            ════════════════════════════════════════════════ */}
                        {!isCreate ? (
                            <div style={{ overflowX: 'hidden' }}>
                                {/* Row 1: Search, Categories & Action Icons (Strictly Single Row) */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    marginBottom: 14,
                                    flexWrap: 'nowrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                        <Input
                                            placeholder="Search template name or text..."
                                            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            style={{ width: 230, borderRadius: 8 }}
                                            allowClear
                                        />
                                        <Segmented
                                            value={categoryFilter}
                                            onChange={setCategoryFilter}
                                            options={[
                                                { label: `My (${categoryCounts.my})`, value: 'my' },
                                                { label: `All (${categoryCounts.all})`, value: 'all' },
                                                { label: `System (${categoryCounts.system})`, value: 'system' },
                                                { label: `Shared (${categoryCounts.shared})`, value: 'shared' }
                                            ]}
                                        />
                                    </div>
                                    <Space size={8} style={{ flexShrink: 0 }}>
                                        <Tooltip title="Clear Watermarks from selected pages">
                                            <Popconfirm
                                                title="Clear watermarks from selected pages?"
                                                onConfirm={handleClearWatermarks}
                                                okText="Clear"
                                                cancelText="Cancel"
                                            >
                                                <Button danger icon={<ClearOutlined />} style={{ borderRadius: 8 }} />
                                            </Popconfirm>
                                        </Tooltip>
                                        <Tooltip title="Create New Watermark Template">
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                style={{ borderRadius: 8, background: '#2563eb' }}
                                                onClick={() => {
                                                    setIsCreate(true);
                                                    setEditingId(null);
                                                    form.resetFields();
                                                    updatePreview();
                                                }}
                                            />
                                        </Tooltip>
                                    </Space>
                                </div>

                                {/* Row 2: Target Page Range (Compact Bar) */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 14px',
                                    background: '#f8fafc',
                                    borderRadius: 8,
                                    border: '1px solid #e2e8f0',
                                    marginBottom: 16,
                                    gap: 8
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#475569' }}>
                                        <span>Target Pages:</span>
                                    </div>
                                    <Space size={8}>
                                        <Radio.Group
                                            value={pageRangeMode}
                                            onChange={e => setPageRangeMode(e.target.value)}
                                            size="small"
                                            optionType="button"
                                            buttonStyle="solid"
                                        >
                                            {PAGE_RANGE_OPTIONS.map(o => (
                                                <Radio.Button key={o.value} value={o.value}>
                                                    {o.label}
                                                </Radio.Button>
                                            ))}
                                        </Radio.Group>
                                        {pageRangeMode === 'custom' && (
                                            <Input
                                                size="small"
                                                placeholder="e.g. 1, 3, 5-10"
                                                value={customPageRange}
                                                onChange={e => setCustomPageRange(e.target.value)}
                                                style={{ width: 130, borderRadius: 4 }}
                                            />
                                        )}
                                    </Space>
                                </div>

                                {/* Template Cards List */}
                                <List
                                    grid={{ gutter: 12, xs: 1, sm: 1, md: 2, lg: 2, xl: 2, xxl: 2 }}
                                    dataSource={filteredWatermarks}
                                    style={{ maxHeight: 440, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}
                                    locale={{
                                        emptyText: (
                                            <Empty
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                                description="No matching watermark templates found."
                                            />
                                        )
                                    }}
                                    renderItem={(wm) => (
                                        <List.Item style={{ marginBottom: 12 }}>
                                            <Card
                                                size="small"
                                                hoverable
                                                style={{
                                                    borderRadius: 10,
                                                    border: '1px solid #e2e8f0',
                                                    height: '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justifyContent: 'space-between',
                                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                                                }}
                                                styles={{ body: { padding: '12px 14px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
                                            >
                                                <div>
                                                    {/* Header: Title & Badges */}
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: wm.color, flexShrink: 0, border: '1px solid #cbd5e1' }} />
                                                            <strong style={{ fontSize: 13, color: '#1e293b' }}>{getDisplayName(wm.name)}</strong>
                                                        </div>
                                                        <Space size={4} style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                            {wm.is_system && (
                                                                <Tag color="volcano" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                                                                    SYSTEM
                                                                </Tag>
                                                            )}
                                                            {!wm.is_system && wm.owner_empno === empNo && (
                                                                <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                                                                    MINE
                                                                </Tag>
                                                            )}
                                                            {!wm.is_system && wm.owner_empno !== empNo && (
                                                                <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                                                                    SHARED
                                                                </Tag>
                                                            )}
                                                            {wm.layer === 'underlay' ? (
                                                                <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>UNDERLAY</Tag>
                                                            ) : (
                                                                <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>OVERLAY</Tag>
                                                            )}
                                                            {wm.repeat_mode && <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>TILE</Tag>}
                                                        </Space>
                                                    </div>

                                                    {/* Watermark Text Content */}
                                                    <div style={{
                                                        background: '#f8fafc',
                                                        border: '1px dashed #cbd5e1',
                                                        borderRadius: 6,
                                                        padding: '6px 10px',
                                                        fontSize: 12,
                                                        color: '#334155',
                                                        fontWeight: 500,
                                                        marginBottom: 8,
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        "{wm.text}"
                                                    </div>

                                                    {/* Attributes info */}
                                                    <div style={{ color: '#64748b', fontSize: 11, marginBottom: 10 }}>
                                                        {wm.font_family || 'Helvetica'} · {wm.font_size}px · {wm.angle}° · {Math.round((wm.opacity || 0.35) * 100)}%
                                                        {wm.position_preset && wm.position_preset !== 'center' && wm.position_preset !== 'diagonal' && !wm.repeat_mode && (
                                                            <> · Edge: {wm.margin_offset ?? 1.5}{wm.margin_unit || 'cm'}</>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Toolbar */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        icon={<CheckOutlined />}
                                                        style={{ borderRadius: 6, background: '#2563eb' }}
                                                        onClick={() => applyWatermark(wm)}
                                                    >
                                                        Apply to PDF
                                                    </Button>

                                                    <Space size={4}>
                                                        <Tooltip title="Duplicate as new template">
                                                            <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => handleDuplicate(wm)} />
                                                        </Tooltip>
                                                        {(!wm.is_system && (wm.owner_empno === empNo || userRole === 'AD')) && (
                                                            <Tooltip title="Edit template">
                                                                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => handleEdit(wm)} />
                                                            </Tooltip>
                                                        )}
                                                        {(!wm.is_system && wm.owner_empno === empNo) && (
                                                            <Tooltip title="Share template">
                                                                <Button size="small" type="text" icon={<ShareAltOutlined />} onClick={() => {
                                                                    setShareWmId(wm.id);
                                                                    setShareOpen(true);
                                                                }} />
                                                            </Tooltip>
                                                        )}
                                                        {(!wm.is_system && (wm.owner_empno === empNo || userRole === 'AD')) && (
                                                            <Popconfirm title="Delete watermark?" onConfirm={() => handleDelete(wm)}>
                                                                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                                            </Popconfirm>
                                                        )}
                                                    </Space>
                                                </div>
                                            </Card>
                                        </List.Item>
                                    )}
                                />
                            </div>
                        ) : (
                            /* ════════════════════════════════════════════════
                                VIEW 2: TWO-COLUMN DESIGNER & PREVIEW PANE
                                Left: True A4 Aspect Preview | Right: Controls
                                ════════════════════════════════════════════════ */
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <Button
                                        icon={<ArrowLeftOutlined />}
                                        onClick={() => {
                                            setIsCreate(false);
                                            setEditingId(null);
                                        }}
                                        style={{ borderRadius: 8 }}
                                    >
                                        Back to Templates
                                    </Button>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                                        {editingId ? 'Edit Watermark Template' : 'Create New Watermark Template'}
                                    </span>
                                    <div style={{ width: 120 }} />
                                </div>

                                <Row gutter={20} align="top">
                                    {/* ── LEFT COLUMN: REALISTIC PAPER PREVIEW ── */}
                                    <Col xs={24} md={9} lg={9}>
                                        <RealisticPaperPreview
                                            formValues={previewValues}
                                            pdfFileName={pdfFile?.name}
                                            userName={userName}
                                        />
                                    </Col>

                                    {/* ── RIGHT COLUMN: SETTINGS FORM ── */}
                                    <Col xs={24} md={15} lg={15}>
                                        <div style={{
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 10,
                                            padding: '16px 20px',
                                            height: 560,
                                            maxHeight: 560,
                                            overflowY: 'auto'
                                        }}>
                                            <Form
                                                form={form}
                                                layout="vertical"
                                                onFinish={handleSave}
                                                onValuesChange={() => updatePreview()}
                                                initialValues={{
                                                    opacity: 0.35, font_size: 48, angle: 45, color: '#D32F2F',
                                                    repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
                                                    font_weight: 'bold', font_style: 'normal', position_preset: 'center',
                                                    margin_unit: 'cm', margin_offset: 1.50,
                                                    layer: 'overlay', category: 'General', is_public: true
                                                }}
                                            >
                                                {/* 1. Name & Layer */}
                                                <Row gutter={12}>
                                                    <Col span={14}>
                                                        <Form.Item
                                                            name="name"
                                                            label={<span style={{ fontSize: 12, fontWeight: 600 }}>Template Name</span>}
                                                            rules={[{ required: true, message: 'Please enter template name' }]}
                                                            style={{ marginBottom: 12 }}
                                                        >
                                                            <Input placeholder="e.g. CONFIDENTIAL PRODUCTION" style={{ borderRadius: 6 }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={10}>
                                                        <Form.Item
                                                            name="layer"
                                                            label={<span style={{ fontSize: 12, fontWeight: 600 }}>Layer</span>}
                                                            style={{ marginBottom: 12 }}
                                                        >
                                                            <Tooltip title="Underlay = Behind CAD geometry (never obscures lines) | Overlay = On top of drawing">
                                                                <Radio.Group buttonStyle="solid" style={{ display: 'flex', width: '100%' }}>
                                                                    <Radio.Button value="underlay" style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>Underlay</Radio.Button>
                                                                    <Radio.Button value="overlay" style={{ flex: 1, textAlign: 'center', fontSize: 12 }}>Overlay</Radio.Button>
                                                                </Radio.Group>
                                                            </Tooltip>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                {/* 2. Text & Placeholders */}
                                                <Form.Item
                                                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Watermark Text</span>}
                                                    required
                                                    style={{ marginBottom: 12 }}
                                                >
                                                    <Form.Item name="text" noStyle rules={[{ required: true, message: 'Please enter watermark text' }]}>
                                                        <Input.TextArea
                                                            placeholder="e.g. CONFIDENTIAL - DO NOT COPY"
                                                            autoSize={{ minRows: 2, maxRows: 3 }}
                                                            style={{ borderRadius: 6 }}
                                                        />
                                                    </Form.Item>
                                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                                        <span style={{ fontSize: 11, color: '#64748b', marginRight: 4 }}>Quick Tags:</span>
                                                        {PLACEHOLDER_TAGS.map(p => (
                                                            <Tag
                                                                key={p.key}
                                                                color={p.color}
                                                                style={{ cursor: 'pointer', fontSize: 11, margin: '2px 0', borderRadius: 4 }}
                                                                onClick={() => insertPlaceholder(p.key)}
                                                            >
                                                                {p.label}
                                                            </Tag>
                                                        ))}
                                                    </div>
                                                </Form.Item>

                                                {/* 3. Typography & Appearance */}
                                                <Row gutter={12} align="middle">
                                                    <Col span={7}>
                                                        <Form.Item name="color" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Color</span>} style={{ marginBottom: 12 }}>
                                                            <ColorPicker format="hex" showText presets={COLOR_PRESETS} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={10}>
                                                        <Form.Item name="font_family" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Font Family</span>} style={{ marginBottom: 12 }}>
                                                            <Select options={FONT_OPTIONS} style={{ borderRadius: 6 }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={7}>
                                                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 600 }}>Font Style</span>} style={{ marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                <Form.Item name="font_weight" noStyle>
                                                                    <Segmented
                                                                        size="small"
                                                                        options={[
                                                                            { value: 'normal', label: 'Regular' },
                                                                            { value: 'bold', label: <BoldOutlined /> },
                                                                        ]}
                                                                    />
                                                                </Form.Item>
                                                                <Form.Item name="font_style" noStyle>
                                                                    <Segmented
                                                                        size="small"
                                                                        options={[
                                                                            { value: 'normal', label: 'Upright' },
                                                                            { value: 'italic', label: <ItalicOutlined /> },
                                                                        ]}
                                                                    />
                                                                </Form.Item>
                                                            </div>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                {/* 4. Font Size & Opacity */}
                                                <Row gutter={12}>
                                                    <Col span={12}>
                                                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 600 }}>Font Size</span>} style={{ marginBottom: 12 }}>
                                                            <Row gutter={8} align="middle">
                                                                <Col flex="1">
                                                                    <Form.Item name="font_size" noStyle>
                                                                        <Slider min={8} max={200} />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col flex="68px">
                                                                    <Form.Item name="font_size" noStyle>
                                                                        <InputNumber min={8} max={200} style={{ width: 68 }} addonAfter="px" />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={12}>
                                                        <Form.Item label={<span style={{ fontSize: 12, fontWeight: 600 }}>Opacity</span>} style={{ marginBottom: 12 }}>
                                                            <Row gutter={8} align="middle">
                                                                <Col flex="1">
                                                                    <Form.Item name="opacity" noStyle>
                                                                        <Slider min={0.05} max={1} step={0.05} />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col flex="64px">
                                                                    <Form.Item name="opacity" noStyle>
                                                                        <InputNumber min={0.05} max={1} step={0.05} style={{ width: 64 }} />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                {/* 5. Angle */}
                                                <Form.Item label={<span style={{ fontSize: 12, fontWeight: 600 }}>Angle</span>} style={{ marginBottom: 12 }}>
                                                    <Row gutter={8} align="middle">
                                                        <Col flex="1">
                                                            <Form.Item name="angle" noStyle>
                                                                <Slider min={-90} max={90} marks={{ '-45': '-45°', 0: '0°', 45: '45°' }} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col flex="72px">
                                                            <Form.Item name="angle" noStyle>
                                                                <InputNumber min={-90} max={90} style={{ width: 72 }} addonAfter="°" />
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                </Form.Item>

                                                {/* 6. Position Preset & Margin from Paper Edge */}
                                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repeat_mode !== cur.repeat_mode || prev.position_preset !== cur.position_preset || prev.margin_unit !== cur.margin_unit}>
                                                    {({ getFieldValue }) => {
                                                        const isRepeat = getFieldValue('repeat_mode');
                                                        if (isRepeat) return null;
                                                        const currentPreset = getFieldValue('position_preset') || 'center';
                                                        const hasEdgeMargin = currentPreset !== 'center' && currentPreset !== 'diagonal';
                                                        const unit = getFieldValue('margin_unit') || 'cm';

                                                        return (
                                                            <div style={{
                                                                padding: '10px 12px',
                                                                background: '#f8fafc',
                                                                borderRadius: 8,
                                                                border: '1px solid #e2e8f0',
                                                                marginBottom: 12
                                                            }}>
                                                                <Row gutter={12} align="middle">
                                                                    <Col span={hasEdgeMargin ? 13 : 24}>
                                                                        <Form.Item
                                                                            name="position_preset"
                                                                            label={<span style={{ fontSize: 12, fontWeight: 600 }}>Position Preset</span>}
                                                                            style={{ marginBottom: 0 }}
                                                                        >
                                                                            <Select
                                                                                style={{ width: '100%' }}
                                                                                options={POSITION_PRESETS.map(p => ({
                                                                                    value: p.key,
                                                                                    label: (
                                                                                        <Space size={6}>
                                                                                            {p.icon}
                                                                                            <span>{p.label}</span>
                                                                                        </Space>
                                                                                    )
                                                                                }))}
                                                                            />
                                                                        </Form.Item>
                                                                    </Col>
                                                                    {hasEdgeMargin && (
                                                                        <Col span={11}>
                                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                                                                                    Edge Distance
                                                                                </span>
                                                                                <Space.Compact style={{ width: '100%' }}>
                                                                                    <Form.Item name="margin_offset" noStyle>
                                                                                        <InputNumber
                                                                                            min={0}
                                                                                            max={unit === 'in' ? 4 : 10}
                                                                                            step={unit === 'in' ? 0.05 : 0.1}
                                                                                            style={{ flex: 1 }}
                                                                                        />
                                                                                    </Form.Item>
                                                                                    <Form.Item name="margin_unit" noStyle>
                                                                                        <Select
                                                                                            style={{ width: 70 }}
                                                                                            options={[
                                                                                                { value: 'cm', label: 'cm' },
                                                                                                { value: 'in', label: 'inch' }
                                                                                            ]}
                                                                                        />
                                                                                    </Form.Item>
                                                                                </Space.Compact>
                                                                            </div>
                                                                        </Col>
                                                                    )}
                                                                </Row>
                                                            </div>
                                                        );
                                                    }}
                                                </Form.Item>

                                                {/* 7. Tile (Repeat Mode) */}
                                                <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 14 }}>
                                                    <Row gutter={12} align="middle">
                                                        <Col span={10}>
                                                            <Form.Item name="repeat_mode" label={<span style={{ fontSize: 12, fontWeight: 600 }}>Tile Mode (Repeat)</span>} valuePropName="checked" style={{ marginBottom: 0 }}>
                                                                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                              </Form.Item>
                                                        </Col>
                                                        <Col span={14}>
                                                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repeat_mode !== cur.repeat_mode}>
                                                                {({ getFieldValue }) => getFieldValue('repeat_mode') ? (
                                                                    <Row gutter={8}>
                                                                        <Col span={12}>
                                                                            <Form.Item name="repeat_style" style={{ marginBottom: 0 }}>
                                                                                <Segmented options={[
                                                                                    { label: 'Full Page', value: 'full' },
                                                                                    { label: 'Line', value: 'line' }
                                                                                ]} block size="small" />
                                                                            </Form.Item>
                                                                        </Col>
                                                                        <Col span={12}>
                                                                            <Form.Item name="repeat_gap" style={{ marginBottom: 0 }}>
                                                                                <InputNumber min={10} max={500} step={10} addonBefore="Gap" style={{ width: '100%' }} size="small" />
                                                                            </Form.Item>
                                                                        </Col>
                                                                    </Row>
                                                                ) : null}
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                </div>

                                                {/* Form Footer Action Buttons */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                                                    <Button onClick={() => {
                                                        setIsCreate(false);
                                                        setEditingId(null);
                                                    }} style={{ borderRadius: 6 }}>
                                                        Cancel
                                                    </Button>
                                                    <Button type="primary" htmlType="submit" style={{ borderRadius: 6, background: '#2563eb' }}>
                                                        {editingId ? 'Update Template' : 'Save Template'}
                                                    </Button>
                                                </div>
                                            </Form>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </>
                )}

                {/* ════════════════════════════════════════════════
                    VIEW 3: AUDIT HISTORY RECORDS
                    ════════════════════════════════════════════════ */}
                {viewMode === 'history' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <span style={{ color: '#475569', fontSize: 13 }}>
                                Historical audit trail of watermark applications across all documents.
                            </span>
                            <Button size="small" onClick={loadHistoryData} loading={historyLoading} style={{ borderRadius: 6 }}>
                                Refresh History
                            </Button>
                        </div>
                        <Table
                            size="small"
                            loading={historyLoading}
                            dataSource={historyLogs}
                            rowKey="id"
                            pagination={{ pageSize: 8, showSizeChanger: false }}
                            columns={[
                                { title: 'File Name', dataIndex: 'filename', key: 'filename', ellipsis: true },
                                { title: 'Watermark', dataIndex: 'watermark_name', key: 'watermark_name', render: text => <Tag color="blue">{text}</Tag> },
                                { title: 'Applied By', dataIndex: 'user_name', key: 'user_name', render: (val, r) => `${val} (${r.empno})` },
                                { title: 'Timestamp', dataIndex: 'created_at', key: 'created_at', render: d => new Date(d).toLocaleString() }
                            ]}
                        />
                    </div>
                )}

                {/* ════════ Share Modal ════════ */}
                <Modal
                    title="Share Watermark Template"
                    open={shareOpen}
                    onCancel={() => setShareOpen(false)}
                    onOk={handleShare}
                    okText="Share"
                >
                    <p>Enter the Employee ID to share this watermark with:</p>
                    <Input
                        placeholder="e.g. LE131 or LB371"
                        value={shareEmpno}
                        onChange={(e) => setShareEmpno(e.target.value)}
                    />
                </Modal>
            </Spin>
        </Modal>
    );
};

export default WatermarkManagerModal;
