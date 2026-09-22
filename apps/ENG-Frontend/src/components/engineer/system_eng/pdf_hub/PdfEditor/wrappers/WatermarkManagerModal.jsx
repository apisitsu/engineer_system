import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Modal, Form, Input, Button, List, Spin, Space, Popconfirm, Select, Slider,
    message, ColorPicker, Row, Col, Badge, Tooltip, InputNumber, Switch,
    Segmented, Tag, Radio, Table, Empty
} from 'antd';
import {
    DeleteOutlined, ShareAltOutlined, PlusOutlined, FormatPainterOutlined,
    EditOutlined, BoldOutlined, ItalicOutlined, BorderOuterOutlined,
    VerticalAlignTopOutlined, VerticalAlignBottomOutlined, VerticalAlignMiddleOutlined,
    ColumnHeightOutlined, ClearOutlined, SearchOutlined, HistoryOutlined,
    SafetyCertificateOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined,
    GlobalOutlined, LayersOutlined, CopyOutlined
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
        label: 'Corporate Standards',
        colors: [
            '#D32F2F', '#C62828', '#B71C1C', '#F57C00', '#2E7D32', '#1976D2',
            '#0288D1', '#757575', '#000000', '#555555', '#9E9E9E', '#E91E63'
        ],
    },
];

const POSITION_PRESETS = [
    { key: 'center', label: 'Center (กึ่งกลาง)', icon: <VerticalAlignMiddleOutlined /> },
    { key: 'header', label: 'Header (หัวกระดาษ)', icon: <VerticalAlignTopOutlined /> },
    { key: 'footer', label: 'Footer (ท้ายกระดาษ)', icon: <VerticalAlignBottomOutlined /> },
    { key: 'diagonal', label: 'Diagonal (แนวทแยง)', icon: <ColumnHeightOutlined /> },
];

const PAGE_RANGE_OPTIONS = [
    { value: 'all', label: 'All Pages (ทุกหน้า)' },
    { value: 'current', label: 'Current Page (หน้านี้)' },
    { value: 'custom', label: 'Custom Range (ระบุหน้า)' },
    { value: 'odd', label: 'Odd Pages (หน้าคี่)' },
    { value: 'even', label: 'Even Pages (หน้าคู่)' },
];

const PLACEHOLDER_TAGS = [
    { key: '{DATE}', label: 'Date (วันที่)', color: 'blue' },
    { key: '{TIME}', label: 'Time (เวลา)', color: 'cyan' },
    { key: '{USER}', label: 'User (ชื่อผู้ใช้)', color: 'green' },
    { key: '{FILENAME}', label: 'Filename (ชื่อไฟล์)', color: 'orange' },
    { key: '{PAGE}', label: 'Page # (เลขหน้า)', color: 'purple' },
    { key: '{TOTAL_PAGES}', label: 'Total Pages (จำนวนหน้า)', color: 'magenta' },
    { key: '{DEPT}', label: 'Dept (แผนก)', color: 'gold' },
    { key: '{COMPANY}', label: 'Company (บริษัท)', color: 'geekblue' },
];

/** Safe Color Parser */
function safeColorToHex(c, fallback = '#000000') {
    if (!c) return fallback;
    if (typeof c === 'string') return c;
    if (typeof c.toHexString === 'function') return c.toHexString();
    if (typeof c.toRgbString === 'function') return c.toRgbString();
    return fallback;
}

/** Replace dynamic placeholders in watermark text (client-side preview and non-page placeholders) */
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

// ── Live Preview Component ──
const WatermarkPreview = ({ formValues, pdfFileName, userName }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);

        // Draw page background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Draw subtle CAD grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 0.5;
        for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

        // Mock CAD lines to visualize Underlay vs Overlay
        const isUnderlay = formValues?.layer === 'underlay';
        const drawMockCad = () => {
            ctx.save();
            ctx.strokeStyle = '#cfd8dc';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(30, 30, W - 60, H - 60);
            ctx.beginPath();
            ctx.moveTo(30, 30); ctx.lineTo(W - 30, H - 30);
            ctx.moveTo(30, H - 30); ctx.lineTo(W - 30, 30);
            ctx.stroke();
            ctx.fillStyle = '#90a4ae';
            ctx.font = '9px monospace';
            ctx.fillText('SAMPLE CAD DRAWING / GEOMETRY', 40, 45);
            ctx.fillText('Ø 25.40 ±0.05', W / 2, H / 2 - 20);
            ctx.restore();
        };

        if (!isUnderlay) {
            drawMockCad();
        }

        // Watermark text resolution
        const rawText = formValues?.text || 'WATERMARK';
        const text = resolvePlaceholders(rawText, userName, pdfFileName)
            .replace(/\{PAGE\}/g, '1')
            .replace(/\{TOTAL_PAGES\}/g, '10');

        const color = safeColorToHex(formValues?.color, '#000000');
        const opacity = formValues?.opacity ?? 0.3;
        const fontSize = Math.max(7, Math.min((formValues?.font_size || 48) * 0.36, 36));
        const angle = -(formValues?.angle || 0) * Math.PI / 180;
        const fontFamily = formValues?.font_family || 'Helvetica';
        const fontWeight = formValues?.font_weight === 'bold' ? 'bold' : 'normal';
        const fontStyle = formValues?.font_style === 'italic' ? 'italic' : 'normal';
        const repeatMode = formValues?.repeat_mode || false;
        const repeatStyle = formValues?.repeat_style || 'full';
        const repeatGap = Math.max(20, (formValues?.repeat_gap || 100) * 0.36);

        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (repeatMode) {
            const textMetrics = ctx.measureText(text);
            const textW = textMetrics.width + repeatGap;
            const textH = fontSize + repeatGap;

            if (repeatStyle === 'line') {
                for (let col = -5; col < Math.ceil(W / textW) + 5; col++) {
                    const cx = col * textW + W / 2;
                    const cy = H / 2;
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(angle);
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                }
            } else {
                for (let row = -2; row < Math.ceil(H / textH) + 2; row++) {
                    for (let col = -2; col < Math.ceil(W / textW) + 2; col++) {
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
            let cx = W / 2, cy = H / 2;
            if (preset === 'header') cy = fontSize + 12;
            else if (preset === 'footer') cy = H - fontSize - 12;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        ctx.globalAlpha = 1;

        if (isUnderlay) {
            drawMockCad();
        }
    }, [formValues, pdfFileName, userName]);

    return (
        <div style={{
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fafafa',
            marginBottom: 16,
        }}>
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#666', fontWeight: 500
            }}>
                <span><BorderOuterOutlined style={{ marginRight: 6 }} /> Live Visual Preview</span>
                <Tag color={formValues?.layer === 'underlay' ? 'cyan' : 'blue'} style={{ margin: 0, fontSize: 10 }}>
                    {formValues?.layer === 'underlay' ? 'LAYER: BACKGROUND (UNDERLAY)' : 'LAYER: FOREGROUND (OVERLAY)'}
                </Tag>
            </div>
            <canvas ref={canvasRef} width={340} height={180} style={{ display: 'block', width: '100%', height: 180 }} />
        </div>
    );
};

// ── Main Component ──
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
    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'system' | 'my' | 'shared'
    const [searchQuery, setSearchQuery] = useState('');

    const [isCreate, setIsCreate] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form] = Form.useForm();

    // Live preview state
    const [previewValues, setPreviewValues] = useState({
        text: '', opacity: 0.35, font_size: 48, angle: 45, color: '#D32F2F',
        repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
        font_weight: 'bold', font_style: 'normal', position_preset: 'center',
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
            // Non-blocking fallback: do not flood with red error toast
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
            if (categoryFilter === 'my' && (wm.is_system || wm.owner_empno !== empNo)) return false;
            if (categoryFilter === 'shared' && (wm.is_system || wm.owner_empno === empNo)) return false;

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchName = wm.name?.toLowerCase().includes(q);
                const matchText = wm.text?.toLowerCase().includes(q);
                const matchCat = wm.category?.toLowerCase().includes(q);
                if (!matchName && !matchText && !matchCat) return false;
            }
            return true;
        });
    }, [watermarks, categoryFilter, searchQuery, empNo]);

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
                repeat_mode: values.repeat_mode || false,
                repeat_style: values.repeat_style || 'full',
                repeat_gap: values.repeat_gap || 100,
                layer: values.layer || 'overlay',
                category: values.category || 'General',
                is_public: values.is_public || false
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
                name: wm.name,
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
                layer: wm.layer || 'overlay',
                category: wm.category || 'General',
                is_public: wm.is_public || false
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
                name: `${wm.name} (Copy)`,
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
                layer: wm.layer || 'overlay',
                category: wm.category || 'General',
                is_public: false
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

                if (preset === 'header') {
                    top = (targetFontSize + 20) * scale;
                } else if (preset === 'footer') {
                    top = height - ((targetFontSize + 20) * scale);
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
            watermark_name: wm.name,
            filename: pdfFile?.name || 'document.pdf',
            empno: empNo || 'GUEST',
            user_name: userName || 'Guest User'
        });

        const rangeLabel = pageRangeMode === 'all' ? 'all pages'
            : pageRangeMode === 'current' ? `page ${currentPage}`
            : pageRangeMode === 'odd' ? 'odd pages'
            : pageRangeMode === 'even' ? 'even pages'
            : `pages: ${customPageRange}`;
        message.success(`Applied "${wm.name}" to ${rangeLabel} (${targetPages.length} page${targetPages.length > 1 ? 's' : ''})`);
        onClose();
    };

    // ── Render ──
    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FormatPainterOutlined style={{ color: '#1677ff' }} />
                    <span style={{ fontWeight: 600 }}>PDF Hub Watermark Manager</span>
                    <Segmented
                        size="small"
                        value={viewMode}
                        onChange={val => {
                            setViewMode(val);
                            if (val === 'history') loadHistoryData();
                        }}
                        options={[
                            { label: 'Templates (เทมเพลต)', value: 'templates', icon: <FormatPainterOutlined /> },
                            { label: 'Audit History (ประวัติการใช้งาน)', value: 'history', icon: <HistoryOutlined /> }
                        ]}
                    />
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={780}
            destroyOnHidden
        >
            <Spin spinning={loading}>
                {viewMode === 'templates' && (
                    <>
                        {/* ════════ Template List View ════════ */}
                        <div style={{ display: !isCreate ? 'block' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Space>
                                    <Input
                                        placeholder="Search template name or text..."
                                        prefix={<SearchOutlined style={{ color: '#aaa' }} />}
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{ width: 260 }}
                                        allowClear
                                    />
                                    <Segmented
                                        value={categoryFilter}
                                        onChange={setCategoryFilter}
                                        options={[
                                            { label: `All (${watermarks.length})`, value: 'all' },
                                            { label: `System (${watermarks.filter(w => w.is_system).length})`, value: 'system' },
                                            { label: `My (${watermarks.filter(w => !w.is_system && w.owner_empno === empNo).length})`, value: 'my' },
                                            { label: `Shared (${watermarks.filter(w => !w.is_system && w.owner_empno !== empNo).length})`, value: 'shared' }
                                        ]}
                                    />
                                </Space>
                                <Space>
                                    <Popconfirm
                                        title="Clear all watermarks from selected pages?"
                                        onConfirm={handleClearWatermarks}
                                        okText="Clear"
                                        cancelText="Cancel"
                                    >
                                        <Button danger icon={<ClearOutlined />} size="middle">
                                            Clear Watermarks
                                        </Button>
                                    </Popconfirm>
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                        setIsCreate(true);
                                        setEditingId(null);
                                        form.resetFields();
                                        updatePreview();
                                    }}>
                                        Create New
                                    </Button>
                                </Space>
                            </div>

                            {/* ── Page Range Selector ── */}
                            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
                                        📄 Apply to Pages:
                                    </div>
                                    <Space wrap>
                                        <Radio.Group value={pageRangeMode} onChange={e => setPageRangeMode(e.target.value)} size="small" optionType="button" buttonStyle="solid">
                                            {PAGE_RANGE_OPTIONS.map(o => <Radio.Button key={o.value} value={o.value}>{o.label}</Radio.Button>)}
                                        </Radio.Group>
                                        {pageRangeMode === 'custom' && (
                                            <Input
                                                size="small"
                                                placeholder="e.g. 1, 3, 5-10"
                                                value={customPageRange}
                                                onChange={e => setCustomPageRange(e.target.value)}
                                                style={{ width: 130 }}
                                            />
                                        )}
                                    </Space>
                                </div>
                            </div>

                            <List
                                bordered
                                dataSource={filteredWatermarks}
                                style={{ maxHeight: 420, overflowY: 'auto' }}
                                locale={{ emptyText: <Empty description="No matching watermark templates found" /> }}
                                renderItem={(wm) => (
                                    <List.Item
                                        actions={[
                                            <Tooltip title="Duplicate as new template" key="dup">
                                                <Button type="text" icon={<CopyOutlined />} onClick={() => handleDuplicate(wm)} />
                                            </Tooltip>,
                                            (!wm.is_system && (wm.owner_empno === empNo || userRole === 'AD')) && (
                                                <Tooltip title="Edit" key="edit">
                                                    <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(wm)} />
                                                </Tooltip>
                                            ),
                                            (!wm.is_system && wm.owner_empno === empNo) && (
                                                <Tooltip title="Share" key="share">
                                                    <Button type="text" icon={<ShareAltOutlined />} onClick={() => {
                                                        setShareWmId(wm.id);
                                                        setShareOpen(true);
                                                    }} />
                                                </Tooltip>
                                            ),
                                            (!wm.is_system && (wm.owner_empno === empNo || userRole === 'AD')) && (
                                                <Popconfirm title="Delete watermark?" onConfirm={() => handleDelete(wm)} key="delete">
                                                    <Button type="text" danger icon={<DeleteOutlined />} />
                                                </Popconfirm>
                                            )
                                        ].filter(Boolean)}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <strong style={{ fontSize: 13 }}>{wm.name}</strong>
                                                {wm.is_system && (
                                                    <Tag color="volcano" icon={<SafetyCertificateOutlined />} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                        SYSTEM PRESET
                                                    </Tag>
                                                )}
                                                {!wm.is_system && wm.owner_empno === empNo && (
                                                    <Tag color="blue" icon={<UserOutlined />} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                        MINE
                                                    </Tag>
                                                )}
                                                {!wm.is_system && wm.owner_empno !== empNo && (
                                                    <Tag color="green" icon={<TeamOutlined />} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>
                                                        SHARED
                                                    </Tag>
                                                )}
                                                {wm.layer === 'underlay' ? (
                                                    <Tag color="cyan" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>UNDERLAY</Tag>
                                                ) : (
                                                    <Tag color="default" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>OVERLAY</Tag>
                                                )}
                                                {wm.repeat_mode && <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>TILE</Tag>}
                                            </div>
                                            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>
                                                Text: "{wm.text}" · {wm.font_family || 'Helvetica'} {wm.font_size}px · {wm.angle}° · {Math.round((wm.opacity || 0.3) * 100)}%
                                            </div>
                                            <Space style={{ marginTop: 2 }}>
                                                <Button size="small" type="primary" onClick={() => applyWatermark(wm)}>
                                                    Apply Watermark
                                                </Button>
                                            </Space>
                                        </div>
                                    </List.Item>
                                )}
                            />
                        </div>

                        {/* ════════ Create / Edit Form View ════════ */}
                        <div style={{ display: isCreate ? 'block' : 'none' }}>
                            <WatermarkPreview formValues={previewValues} pdfFileName={pdfFile?.name} userName={userName} />

                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleSave}
                                onValuesChange={() => updatePreview()}
                                initialValues={{
                                    opacity: 0.35, font_size: 48, angle: 45, color: '#D32F2F',
                                    repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
                                    font_weight: 'bold', font_style: 'normal', position_preset: 'center',
                                    layer: 'overlay', category: 'General', is_public: false
                                }}
                            >
                                {/* ── Row 1: Name & Layer ── */}
                                <Row gutter={16}>
                                    <Col span={14}>
                                        <Form.Item name="name" label="Template Name" rules={[{ required: true, message: 'Please enter template name' }]}>
                                            <Input placeholder="e.g. CONFIDENTIAL DRAWING" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={10}>
                                        <Form.Item name="layer" label="Watermark Layer (ลำดับชั้น)">
                                            <Segmented
                                                block
                                                options={[
                                                    { value: 'underlay', label: 'Underlay (ใต้แบบ)' },
                                                    { value: 'overlay', label: 'Overlay (ทับบน)' }
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                {/* ── Row 2: Watermark Text + Placeholders ── */}
                                <Form.Item label="Watermark Text" required style={{ marginBottom: 8 }}>
                                    <Form.Item name="text" noStyle rules={[{ required: true, message: 'Please enter watermark text' }]}>
                                        <Input.TextArea placeholder="e.g. CONFIDENTIAL - FOR INTERNAL USE ONLY" autoSize={{ minRows: 2, maxRows: 3 }} />
                                    </Form.Item>
                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                                        <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Insert Tag:</span>
                                        {PLACEHOLDER_TAGS.map(p => (
                                            <Tag
                                                key={p.key}
                                                color={p.color}
                                                style={{ cursor: 'pointer', fontSize: 11, margin: '2px 0' }}
                                                onClick={() => insertPlaceholder(p.key)}
                                            >
                                                {p.label}
                                            </Tag>
                                        ))}
                                    </div>
                                </Form.Item>

                                {/* ── Row 3: Color + Font Family + Style ── */}
                                <Row gutter={16}>
                                    <Col span={8}>
                                        <Form.Item name="color" label="Color">
                                            <ColorPicker format="hex" showText presets={COLOR_PRESETS} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name="font_family" label="Font Family">
                                            <Select options={FONT_OPTIONS} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item label="Style">
                                            <Space>
                                                <Form.Item name="font_weight" noStyle>
                                                    <Segmented
                                                        options={[
                                                            { value: 'normal', icon: <span style={{ fontWeight: 400 }}>N</span> },
                                                            { value: 'bold', icon: <BoldOutlined /> },
                                                        ]}
                                                    />
                                                </Form.Item>
                                                <Form.Item name="font_style" noStyle>
                                                    <Segmented
                                                        options={[
                                                            { value: 'normal', icon: <span>R</span> },
                                                            { value: 'italic', icon: <ItalicOutlined /> },
                                                        ]}
                                                    />
                                                </Form.Item>
                                            </Space>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                {/* ── Row 4: Opacity + Font Size ── */}
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Opacity (ความโปร่งใส)">
                                            <Space style={{ width: '100%' }}>
                                                <Form.Item name="opacity" noStyle>
                                                    <Slider min={0.05} max={1} step={0.05} style={{ flex: 1, minWidth: 120 }} />
                                                </Form.Item>
                                                <Form.Item name="opacity" noStyle>
                                                    <InputNumber min={0.05} max={1} step={0.05} style={{ width: 68 }} />
                                                </Form.Item>
                                            </Space>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Font Size (ขนาดตัวอักษร)">
                                            <Space style={{ width: '100%' }}>
                                                <Form.Item name="font_size" noStyle>
                                                    <Slider min={8} max={200} style={{ flex: 1, minWidth: 120 }} />
                                                </Form.Item>
                                                <Form.Item name="font_size" noStyle>
                                                    <InputNumber min={8} max={200} style={{ width: 68 }} />
                                                </Form.Item>
                                            </Space>
                                        </Form.Item>
                                    </Col>
                                </Row>

                                {/* ── Row 5: Angle ── */}
                                <Form.Item label="Angle (มุมเอียง)">
                                    <Space style={{ width: '100%' }}>
                                        <Form.Item name="angle" noStyle>
                                            <Slider min={-90} max={90} marks={{ '-45': '-45°', 0: '0°', 45: '45°' }} style={{ flex: 1, minWidth: 260 }} />
                                        </Form.Item>
                                        <Form.Item name="angle" noStyle>
                                            <InputNumber min={-90} max={90} style={{ width: 68 }} addonAfter="°" />
                                        </Form.Item>
                                    </Space>
                                </Form.Item>

                                {/* ── Row 6: Tile / Repeat Mode ── */}
                                <div style={{ padding: '10px 14px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
                                    <Row gutter={16} align="middle">
                                        <Col span={12}>
                                            <Form.Item name="repeat_mode" label="Tile (Repeat) Mode" valuePropName="checked" style={{ marginBottom: 0 }}>
                                                <Switch checkedChildren="ON" unCheckedChildren="OFF" />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repeat_mode !== cur.repeat_mode}>
                                                {({ getFieldValue }) => getFieldValue('repeat_mode') ? (
                                                    <Space direction="vertical" style={{ width: '100%' }}>
                                                        <Form.Item name="repeat_style" style={{ marginBottom: 0 }}>
                                                            <Segmented options={[
                                                                { label: 'Full Page', value: 'full' },
                                                                { label: 'Single Line', value: 'line' }
                                                            ]} block />
                                                        </Form.Item>
                                                        <Form.Item name="repeat_gap" label="Gap (px)" style={{ marginBottom: 0 }}>
                                                            <InputNumber min={10} max={500} step={10} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Space>
                                                ) : null}
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>

                                {/* ── Row 7: Position Presets ── */}
                                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.repeat_mode !== cur.repeat_mode}>
                                    {({ getFieldValue }) => !getFieldValue('repeat_mode') ? (
                                        <Form.Item name="position_preset" label="Position Preset">
                                            <Segmented
                                                options={POSITION_PRESETS.map(p => ({
                                                    value: p.key,
                                                    label: (
                                                        <Space size={4}>
                                                            {p.icon}
                                                            <span>{p.label}</span>
                                                        </Space>
                                                    ),
                                                }))}
                                            />
                                        </Form.Item>
                                    ) : null}
                                </Form.Item>

                                {/* ── Actions ── */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                                    <Button onClick={() => {
                                        setIsCreate(false);
                                        setEditingId(null);
                                    }}>Cancel</Button>
                                    <Button type="primary" htmlType="submit">
                                        {editingId ? 'Update Template' : 'Save Template'}
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </>
                )}

                {/* ════════ Audit History View ════════ */}
                {viewMode === 'history' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ color: '#666', fontSize: 13 }}>Recent watermark application audit records</span>
                            <Button size="small" onClick={loadHistoryData} loading={historyLoading}>Refresh History</Button>
                        </div>
                        <Table
                            size="small"
                            loading={historyLoading}
                            dataSource={historyLogs}
                            rowKey="id"
                            pagination={{ pageSize: 8 }}
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
