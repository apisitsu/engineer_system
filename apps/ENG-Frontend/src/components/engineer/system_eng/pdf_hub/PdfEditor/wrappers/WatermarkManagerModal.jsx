import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Form, Input, Button, List, Spin, Space, Popconfirm, Select, Slider, message, ColorPicker, Row, Col, Badge, Tooltip, InputNumber, Switch, Segmented, Tag, Radio } from 'antd';
import { DeleteOutlined, ShareAltOutlined, PlusOutlined, FormatPainterOutlined, EditOutlined, BoldOutlined, ItalicOutlined, BorderOuterOutlined, VerticalAlignTopOutlined, VerticalAlignBottomOutlined, VerticalAlignMiddleOutlined, ColumnHeightOutlined, ClearOutlined } from '@ant-design/icons';
import axios from 'axios';
import * as fabric from 'fabric';
import { server } from '../../../../../../constance/constance';
import { useAuthStore } from '../../../../../../stores/authStore';

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
        label: 'Presets',
        colors: [
            '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF',
            '#808080', '#C0C0C0', '#800000', '#808000', '#008000', '#800080', '#008080', '#000080'
        ],
    },
];

const POSITION_PRESETS = [
    { key: 'center', label: 'Center', icon: <VerticalAlignMiddleOutlined /> },
    { key: 'header', label: 'Header', icon: <VerticalAlignTopOutlined /> },
    { key: 'footer', label: 'Footer', icon: <VerticalAlignBottomOutlined /> },
    { key: 'diagonal', label: 'Diagonal', icon: <ColumnHeightOutlined /> },
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
];

/** Replace dynamic placeholders in watermark text */
function resolvePlaceholders(text, userName, pdfFileName) {
    const now = new Date();
    return text
        .replace(/\{DATE\}/g, now.toISOString().split('T')[0])
        .replace(/\{TIME\}/g, now.toTimeString().split(' ')[0].substring(0, 5))
        .replace(/\{USER\}/g, userName || 'Unknown')
        .replace(/\{FILENAME\}/g, pdfFileName || 'document.pdf');
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
const WatermarkPreview = ({ formValues }) => {
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

        // Draw subtle grid lines
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 0.5;
        for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }

        // Extract values
        const text = formValues?.text || 'WATERMARK';
        const color = formValues?.color || '#000000';
        const opacity = formValues?.opacity ?? 0.3;
        const fontSize = Math.max(6, Math.min((formValues?.font_size || 48) * 0.4, 40)); // Scale for preview
        const angle = -(formValues?.angle || 0) * Math.PI / 180;
        const fontFamily = formValues?.font_family || 'Helvetica';
        const fontWeight = formValues?.font_weight === 'bold' ? 'bold' : 'normal';
        const fontStyle = formValues?.font_style === 'italic' ? 'italic' : 'normal';
        const repeatMode = formValues?.repeat_mode || false;
        const repeatStyle = formValues?.repeat_style || 'full';
        const repeatGap = Math.max(20, (formValues?.repeat_gap || 100) * 0.4);

        ctx.globalAlpha = opacity;
        ctx.fillStyle = color;
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (repeatMode) {
            // Tile pattern
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
            // Single placement
            const preset = formValues?.position_preset || 'center';
            let cx = W / 2, cy = H / 2;
            if (preset === 'header') cy = fontSize + 10;
            else if (preset === 'footer') cy = H - fontSize - 10;
            else if (preset === 'diagonal') {
                // Already at center, angle should be ~45
            }

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
    }, [formValues]);

    return (
        <div style={{
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            overflow: 'hidden',
            background: '#fafafa',
            marginBottom: 16,
        }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#888', fontWeight: 500 }}>
                <BorderOuterOutlined style={{ marginRight: 6 }} />
                Live Preview
            </div>
            <canvas ref={canvasRef} width={340} height={200} style={{ display: 'block', width: '100%', height: 200 }} />
        </div>
    );
};


// ── Main Component ──
const WatermarkManagerModal = ({ open, onClose, fabricCanvasRefs, totalPages, pushHistory, pdfFile, currentPage, pdfDoc, pageAnnotations, setPageAnnotations, logPdfUsage, zoom = 1.0 }) => {
    const empNo = useAuthStore(state => state.empNo);
    const userName = useAuthStore(state => state.userName);
    const [watermarks, setWatermarks] = useState([]);
    const [loading, setLoading] = useState(false);

    const [isCreate, setIsCreate] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form] = Form.useForm();

    // Live preview state
    const [previewValues, setPreviewValues] = useState({
        text: '', opacity: 0.3, font_size: 48, angle: 45, color: '#000000',
        repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
        font_weight: 'normal', font_style: 'normal', position_preset: 'center',
    });

    // Apply-time options (not stored in template)
    const [pageRangeMode, setPageRangeMode] = useState('all');
    const [customPageRange, setCustomPageRange] = useState('');

    // Sharing modal
    const [shareOpen, setShareOpen] = useState(false);
    const [shareWmId, setShareWmId] = useState(null);
    const [shareEmpno, setShareEmpno] = useState('');

    useEffect(() => {
        if (open && empNo) {
            fetchWatermarks();
        } else if (!open) {
            setIsCreate(false);
            setEditingId(null);
            form.resetFields();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, empNo]);

    // Sync form changes to preview
    const updatePreview = useCallback(() => {
        const vals = form.getFieldsValue();
        setPreviewValues(prev => ({
            ...prev,
            ...vals,
            color: typeof vals.color === 'string' ? vals.color : vals.color?.toHexString?.() || prev.color,
        }));
    }, [form]);

    const fetchWatermarks = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(server.PDF_WATERMARKS, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.result === 'true') {
                setWatermarks(res.data.data);
            }
        } catch (err) {
            message.error('Failed to load watermarks');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const payload = {
                ...values,
                empno: empNo,
                color: typeof values.color === 'string' ? values.color : values.color.toHexString(),
                // Defaults
                font_family: values.font_family || 'Helvetica',
                font_weight: values.font_weight || 'normal',
                font_style: values.font_style || 'normal',
                position_preset: values.position_preset || 'center',
                repeat_mode: values.repeat_mode || false,
                repeat_style: values.repeat_style || 'full',
                repeat_gap: values.repeat_gap || 100,
            };

            if (editingId) {
                await axios.put(`${server.PDF_WATERMARKS}/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                message.success('Watermark updated');
            } else {
                await axios.post(server.PDF_WATERMARKS, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                message.success('Watermark created');
            }

            setIsCreate(false);
            setEditingId(null);
            form.resetFields();
            fetchWatermarks();
        } catch (err) {
            message.error('Failed to save watermark');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${server.PDF_WATERMARKS}/${id}?empno=${empNo}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Watermark deleted');
            fetchWatermarks();
        } catch (err) {
            message.error('Failed to delete watermark');
            console.error(err);
        }
    };

    const handleShare = async () => {
        if (!shareEmpno) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${server.PDF_WATERMARKS}/${shareWmId}/share`, { target_empno: shareEmpno }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Watermark shared successfully');
            setShareOpen(false);
            setShareEmpno('');
        } catch (err) {
            message.error('Failed to share watermark');
        }
    };

    const handleEdit = (wm) => {
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
            });
            updatePreview();
        }, 0);
    };

    /** Insert placeholder tag into the text field */
    const insertPlaceholder = (placeholder) => {
        const current = form.getFieldValue('text') || '';
        form.setFieldsValue({ text: current + placeholder });
        updatePreview();
    };

    // ── Apply Watermark ──
    const getTargetPages = () => {
        const allPageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
        switch (pageRangeMode) {
            case 'current':
                return [currentPage];
            case 'custom':
                return Array.from(parsePageRange(customPageRange, totalPages));
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

        const resolvedText = resolvePlaceholders(wm.text, userName, pdfFile?.name);
        const isRepeat = wm.repeat_mode;
        const currentZoom = zoom || 1.0;

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
                            customData: { type: 'watermark', tiled: true },
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
                                customData: { type: 'watermark', tiled: true },
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
                    customData: { type: 'watermark' },
                    id: `wm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
                });
            }
            return objs;
        };

        const addTextToCanvas = (fc, pageNum) => {
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
            });
            fc.renderAll();
        };

        // Pre-query true page dimensions for unrendered pages to prevent hardcoded A4 distortion
        const unrenderedPageDims = {};
        for (const pageNum of targetPages) {
            const fc = fabricCanvasRefs?.current?.[pageNum];
            if (!fc) {
                let pW = 595.28;
                let pH = 841.89;
                if (pdfDoc) {
                    try {
                        const p = await pdfDoc.getPage(pageNum);
                        const vp = p.getViewport({ scale: 1.0 });
                        pW = vp.width;
                        pH = vp.height;
                    } catch (e) {
                        const existing = pageAnnotations?.[pageNum];
                        pW = existing?._canvasWidth || 595.28;
                        pH = existing?._canvasHeight || 841.89;
                    }
                }
                unrenderedPageDims[pageNum] = { width: pW, height: pH };
            }
        }

        pushHistory?.();

        targetPages.forEach(pageNum => {
            const fc = fabricCanvasRefs?.current?.[pageNum];
            if (fc) {
                addTextToCanvas(fc, pageNum);
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
                            objects: [...existingObjects, ...wmObjects],
                        };
                    }
                });
                return next;
            });
        }

        const rangeLabel = pageRangeMode === 'all' ? 'all pages'
            : pageRangeMode === 'current' ? `page ${currentPage}`
            : pageRangeMode === 'odd' ? 'odd pages'
            : pageRangeMode === 'even' ? 'even pages'
            : `pages: ${customPageRange}`;
        message.success(`Watermark applied to ${rangeLabel} (${targetPages.length} page${targetPages.length > 1 ? 's' : ''})`);
        onClose();
    };

    // ── Render ──
    return (
        <Modal
            title={<><FormatPainterOutlined /> Watermark Manager</>}
            open={open}
            onCancel={onClose}
            footer={null}
            width={720}
            destroyOnHidden
        >
            <Spin spinning={loading}>
                {/* ════════ Template List View ════════ */}
                <div style={{ display: !isCreate ? 'block' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{ color: '#666' }}>Select a watermark to apply, or create a new one.</span>
                        <Space>
                            <Popconfirm
                                title="Clear all watermarks from selected pages?"
                                onConfirm={handleClearWatermarks}
                                okText="Clear"
                                cancelText="Cancel"
                            >
                                <Button danger icon={<ClearOutlined />}>
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

                    {/* ── Page Range Selector (Feature F) ── */}
                    <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#555' }}>📄 Apply to Pages</div>
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
                                    style={{ width: 150 }}
                                />
                            )}
                        </Space>
                    </div>

                    <List
                        bordered
                        dataSource={watermarks}
                        locale={{ emptyText: 'No watermark templates yet. Create one to get started.' }}
                        renderItem={(wm) => (
                            <List.Item
                                actions={[
                                    wm.owner_empno === empNo && (
                                        <Tooltip title="Edit" key="edit">
                                            <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(wm)} />
                                        </Tooltip>
                                    ),
                                    wm.owner_empno === empNo && (
                                        <Tooltip title="Share" key="share">
                                            <Button type="text" icon={<ShareAltOutlined />} onClick={() => {
                                                setShareWmId(wm.id);
                                                setShareOpen(true);
                                            }} />
                                        </Tooltip>
                                    ),
                                    wm.owner_empno === empNo && (
                                        <Popconfirm title="Delete watermark?" onConfirm={() => handleDelete(wm.id)} key="delete">
                                            <Button type="text" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    )
                                ].filter(Boolean)}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <strong>{wm.name}</strong>
                                        {wm.owner_empno !== empNo && <Badge count="Shared" style={{ backgroundColor: '#52c41a' }} />}
                                        {wm.repeat_mode && <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>TILE</Tag>}
                                    </div>
                                    <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>
                                        Text: "{wm.text}" · {wm.font_family || 'Helvetica'} {wm.font_size}px · {wm.angle}°
                                    </div>
                                    <Space style={{ marginTop: 4 }}>
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
                    <WatermarkPreview formValues={previewValues} />

                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSave}
                        onValuesChange={() => updatePreview()}
                        initialValues={{
                            opacity: 0.3, font_size: 48, angle: 45, color: '#000000',
                            repeat_mode: false, repeat_style: 'full', repeat_gap: 100, font_family: 'Helvetica',
                            font_weight: 'normal', font_style: 'normal', position_preset: 'center',
                        }}
                    >
                        {/* ── Row 1: Name ── */}
                        <Form.Item name="name" label="Template Name" rules={[{ required: true }]}>
                            <Input placeholder="e.g. Confidential" />
                        </Form.Item>

                        {/* ── Row 2: Watermark Text + Placeholders (Feature E) ── */}
                        <Form.Item label="Watermark Text" required style={{ marginBottom: 8 }}>
                            <Form.Item name="text" noStyle rules={[{ required: true, message: 'Please enter watermark text' }]}>
                                <Input.TextArea placeholder="e.g. CONFIDENTIAL - DO NOT COPY" autoSize={{ minRows: 2, maxRows: 4 }} />
                            </Form.Item>
                            <div style={{ marginTop: 6 }}>
                                <span style={{ fontSize: 11, color: '#999', marginRight: 8 }}>Insert:</span>
                                {PLACEHOLDER_TAGS.map(p => (
                                    <Tag
                                        key={p.key}
                                        color={p.color}
                                        style={{ cursor: 'pointer', fontSize: 11 }}
                                        onClick={() => insertPlaceholder(p.key)}
                                    >
                                        {p.label}
                                    </Tag>
                                ))}
                            </div>
                        </Form.Item>

                        {/* ── Row 3: Color + Font Family (Feature B) ── */}
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

                        {/* ── Row 4: Opacity + Font Size (Feature 1: Slider + InputNumber) ── */}
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item label="Opacity">
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
                                <Form.Item label="Font Size">
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

                        {/* ── Row 5: Angle (Feature 1) ── */}
                        <Form.Item label="Angle (Degrees)">
                            <Space style={{ width: '100%' }}>
                                <Form.Item name="angle" noStyle>
                                    <Slider min={-90} max={90} marks={{ '-45': '-45°', 0: '0°', 45: '45°' }} style={{ flex: 1, minWidth: 260 }} />
                                </Form.Item>
                                <Form.Item name="angle" noStyle>
                                    <InputNumber min={-90} max={90} style={{ width: 68 }} addonAfter="°" />
                                </Form.Item>
                            </Space>
                        </Form.Item>

                        {/* ── Row 6: Repeat / Tile Mode (Feature 2) ── */}
                        <div style={{ padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}>
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

                        {/* ── Row 7: Position Presets (Feature D) — only when NOT tile mode ── */}
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

                {/* ════════ Share Modal ════════ */}
                <Modal
                    title="Share Watermark"
                    open={shareOpen}
                    onCancel={() => setShareOpen(false)}
                    onOk={handleShare}
                    okText="Share"
                >
                    <p>Enter the Employee ID to share this watermark with:</p>
                    <Input
                        placeholder="Employee ID"
                        value={shareEmpno}
                        onChange={(e) => setShareEmpno(e.target.value)}
                    />
                </Modal>
            </Spin>
        </Modal>
    );
};

export default WatermarkManagerModal;
