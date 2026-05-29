import React, { useState } from 'react';
import {
    Typography, ColorPicker, Slider, InputNumber, Select, Button,
    Divider, Space, message, Spin, Upload, Segmented, Radio,
} from 'antd';
import {
    DownloadOutlined, FileImageOutlined, MergeCellsOutlined,
    InfoCircleOutlined, SafetyCertificateOutlined, EditOutlined,
    FileZipOutlined, SwapOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';
import { PDFDocument } from 'pdf-lib';

const { Text, Title } = Typography;

const COLOR_PRESETS = [
    {
        label: 'Recommended',
        colors: [
            '#000000', '#F5222D', '#FA8C16', '#FADB14', 
            '#8CE600', '#52C41A', '#13A8A8', '#1677FF', 
            '#2F54EB', '#722ED1', '#EB2F96', '#FFFFFF'
        ],
    }
];

/**
 * PropertiesPanel — Context-sensitive right sidebar.
 *
 * Shows different controls based on activeMode:
 *   View:     Document info
 *   Annotate: Color, opacity
 *   Shapes:   Stroke, fill, width, ruler settings
 *   Edit:     Font, size, color
 *   Sign:     Stamp palette trigger, signature options
 *   Merge:    Merge action button
 *   Export:   Format, quality, scale, export button
 */
const PropertiesPanel = ({
    pdfFile,
    totalPages,
    totalAnnotations,
    // Merge
    mergeFiles,
    onMerge,
    mergeLoading,
    // Export
    exportSelectedPages,
    onExport,
    exportLoading,
    exportedImages,
    onBatchZipDownload,
    // Sign
    onOpenSignaturePad,
    stampData,
    onPlaceStamp,
    // Overlay
    overlayFile,
    onLoadOverlay,
    onClearOverlay,
}) => {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    // Export settings
    const [exportFormat, setExportFormat] = useState('jpg');
    const [exportQuality, setExportQuality] = useState('high');
    const [exportIncludeAnnot, setExportIncludeAnnot] = useState(true);

    const SectionTitle = ({ children }) => (
        <div className="pdf-ws-prop-section-title" style={{ color: theme.colors.textSecondary }}>
            {children}
        </div>
    );

    const PropRow = ({ label, children }) => (
        <div className="pdf-ws-prop-row">
            <label style={{ color: theme.colors.textSecondary }}>{label}</label>
            {children}
        </div>
    );

    // ══════════════════════════════════════════════════════════════════
    // View Mode — Document Info
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'view') {
        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>
                        <InfoCircleOutlined style={{ marginRight: 8 }} />
                        Document Info
                    </h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>File</SectionTitle>
                        <PropRow label="Name">
                            <Text style={{ fontSize: 12, maxWidth: 120 }} ellipsis>
                                {pdfFile?.name || '—'}
                            </Text>
                        </PropRow>
                        <PropRow label="Pages">
                            <Text style={{ fontSize: 12 }}>{totalPages || 0}</Text>
                        </PropRow>
                        <PropRow label="Size">
                            <Text style={{ fontSize: 12 }}>
                                {pdfFile?.size ? `${(pdfFile.size / 1024 / 1024).toFixed(2)} MB` : '—'}
                            </Text>
                        </PropRow>
                        <PropRow label="Annotations">
                            <Text style={{ fontSize: 12 }}>{totalAnnotations}</Text>
                        </PropRow>
                    </div>

                    <Divider style={{ margin: '12px 0 8px' }} />

                    {/* Overlay Compare */}
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>
                            <SwapOutlined style={{ marginRight: 4 }} />
                            Compare / Overlay
                        </SectionTitle>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, display: 'block', marginBottom: 8 }}>
                            Load a second PDF to overlay and compare differences.
                        </Text>

                        {overlayFile ? (
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 8px', borderRadius: 8,
                                    background: `${theme.colors.primary}08`,
                                    border: `1px solid ${theme.colors.border}`,
                                    marginBottom: 8,
                                }}>
                                    <Text style={{ fontSize: 11, maxWidth: 130 }} ellipsis>{overlayFile.name}</Text>
                                    <Button type="text" size="small" danger
                                        icon={<CloseCircleOutlined />}
                                        onClick={onClearOverlay}
                                        style={{ fontSize: 11 }}
                                    />
                                </div>

                                <PropRow label="Visible">
                                    <input
                                        type="checkbox"
                                        checked={store.overlayEnabled}
                                        onChange={(e) => store.setOverlayEnabled(e.target.checked)}
                                    />
                                </PropRow>
                                <PropRow label="Opacity">
                                    <Slider
                                        min={0} max={1} step={0.05}
                                        value={store.overlayOpacity}
                                        onChange={store.setOverlayOpacity}
                                        style={{ flex: 1, margin: '0 0 0 8px' }}
                                    />
                                </PropRow>
                                <PropRow label="Blend">
                                    <Select
                                        value={store.overlayBlend}
                                        onChange={store.setOverlayBlend}
                                        size="small"
                                        style={{ width: 110 }}
                                        options={[
                                            { value: 'difference', label: 'Difference' },
                                            { value: 'multiply', label: 'Multiply' },
                                            { value: 'normal', label: 'Normal' },
                                            { value: 'darken', label: 'Darken' },
                                            { value: 'screen', label: 'Screen' },
                                        ]}
                                    />
                                </PropRow>
                            </div>
                        ) : (
                            <Upload
                                accept=".pdf,application/pdf"
                                showUploadList={false}
                                beforeUpload={(file) => {
                                    if (file.type !== 'application/pdf') return Upload.LIST_IGNORE;
                                    onLoadOverlay?.(file);
                                    return false;
                                }}
                            >
                                <Button
                                    icon={<SwapOutlined />}
                                    block size="small"
                                    style={{ borderRadius: 8, fontSize: 11 }}
                                >
                                    Load Compare PDF
                                </Button>
                            </Upload>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Annotate Mode — Color & Opacity
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'annotate') {
        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>Annotation Properties</h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Highlight Color</SectionTitle>
                        <Space wrap>
                            {['#ffeb3b', '#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0'].map(c => (
                                <div
                                    key={c}
                                    onClick={() => store.setHighlightColor(c)}
                                    style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: c, cursor: 'pointer',
                                        border: store.highlightColor === c
                                            ? `3px solid ${theme.colors.primary}`
                                            : '2px solid #e0e0e0',
                                        transition: 'all 0.15s',
                                    }}
                                />
                            ))}
                        </Space>
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Stroke Color</SectionTitle>
                        <ColorPicker
                            value={store.strokeColor}
                            onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                            size="small"
                            presets={COLOR_PRESETS}
                        />
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Opacity</SectionTitle>
                        <Slider
                            min={0.1} max={1} step={0.05}
                            value={store.opacity}
                            onChange={store.setOpacity}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Shapes Mode — Stroke, Fill, Width, Ruler
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'shapes') {
        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>Shape Properties</h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Stroke</SectionTitle>
                        <PropRow label="Color">
                            <ColorPicker
                                value={store.strokeColor}
                                onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                                size="small"
                                presets={COLOR_PRESETS}
                            />
                        </PropRow>
                        <PropRow label="Width">
                            <InputNumber
                                min={1} max={20} value={store.strokeWidth}
                                onChange={store.setStrokeWidth}
                                size="small" style={{ width: 60 }}
                            />
                        </PropRow>
                        <PropRow label="Symbol Size">
                            <InputNumber
                                min={8} max={72} value={store.fontSize}
                                onChange={store.setFontSize}
                                size="small" style={{ width: 60 }}
                            />
                        </PropRow>
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Fill</SectionTitle>
                        <PropRow label="Color">
                            <ColorPicker
                                value={store.fillColor === 'transparent' ? '#ffffff00' : store.fillColor}
                                onChangeComplete={(color) => store.setFillColor(color.toHexString())}
                                size="small"
                                allowClear
                                presets={COLOR_PRESETS}
                            />
                        </PropRow>
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Opacity</SectionTitle>
                        <Slider
                            min={0.1} max={1} step={0.05}
                            value={store.opacity}
                            onChange={store.setOpacity}
                        />
                    </div>

                    <Divider style={{ margin: '12px 0' }} />

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>📏 Ruler Settings</SectionTitle>
                        <PropRow label="Scale">
                            <InputNumber
                                min={0.1} max={100} step={0.1}
                                value={store.rulerScale}
                                onChange={store.setRulerScale}
                                size="small" style={{ width: 70 }}
                                addonAfter="px/mm"
                            />
                        </PropRow>
                        <PropRow label="Unit">
                            <Select
                                value={store.rulerUnit}
                                onChange={store.setRulerUnit}
                                size="small"
                                style={{ width: 70 }}
                                options={[
                                    { value: 'mm', label: 'mm' },
                                    { value: 'cm', label: 'cm' },
                                    { value: 'in', label: 'in' },
                                ]}
                            />
                        </PropRow>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Edit Mode — Font Properties
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'edit') {
        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>Text Properties</h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Font</SectionTitle>
                        <PropRow label="Family">
                            <Select
                                value={store.fontFamily}
                                onChange={store.setFontFamily}
                                size="small" style={{ width: 120 }}
                                options={[
                                    { value: 'Helvetica', label: 'Helvetica' },
                                    { value: 'Times New Roman', label: 'Times' },
                                    { value: 'Courier New', label: 'Courier' },
                                    { value: 'Arial', label: 'Arial' },
                                    { value: 'Georgia', label: 'Georgia' },
                                ]}
                            />
                        </PropRow>
                        <PropRow label="Size">
                            <InputNumber
                                min={6} max={72} value={store.fontSize}
                                onChange={store.setFontSize}
                                size="small" style={{ width: 60 }}
                            />
                        </PropRow>
                        <PropRow label="Color">
                            <ColorPicker
                                value={store.strokeColor}
                                onChangeComplete={(color) => store.setStrokeColor(color.toHexString())}
                                size="small"
                                presets={COLOR_PRESETS}
                            />
                        </PropRow>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Sign Mode — Stamps & Signatures
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'sign') {
        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>Fill & Sign</h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Signature</SectionTitle>
                        <Button
                            block
                            icon={<EditOutlined />}
                            onClick={onOpenSignaturePad}
                            style={{ borderRadius: 10, marginBottom: 8, fontWeight: 600 }}
                        >
                            Create Signature
                        </Button>
                    </div>

                    {stampData && (
                        <>
                            {stampData.stamp_image && (
                                <div className="pdf-ws-prop-section">
                                    <SectionTitle>
                                        <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                                        Company Stamp
                                    </SectionTitle>
                                    <div
                                        onClick={() => onPlaceStamp?.('stamp')}
                                        style={{
                                            padding: 8, borderRadius: 10, cursor: 'pointer',
                                            border: `1px solid ${theme.colors.border}`,
                                            background: '#fff', textAlign: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <img
                                            src={`data:image/png;base64,${stampData.stamp_image}`}
                                            alt="Stamp"
                                            style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                                        />
                                        <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                                            Click to place • {stampData.stamp_width_mm}×{stampData.stamp_height_mm}mm
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stampData.signature_image && (
                                <div className="pdf-ws-prop-section">
                                    <SectionTitle>
                                        <EditOutlined style={{ marginRight: 4 }} />
                                        Saved Signature
                                    </SectionTitle>
                                    <div
                                        onClick={() => onPlaceStamp?.('signature')}
                                        style={{
                                            padding: 8, borderRadius: 10, cursor: 'pointer',
                                            border: `1px solid ${theme.colors.border}`,
                                            background: '#fff', textAlign: 'center',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <img
                                            src={`data:image/png;base64,${stampData.signature_image}`}
                                            alt="Signature"
                                            style={{ maxWidth: '100%', maxHeight: 40, objectFit: 'contain' }}
                                        />
                                        <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                                            Click to place • {stampData.sig_width_mm}×{stampData.sig_height_mm}mm
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <Divider style={{ margin: '12px 0 8px' }} />

                    {/* Draw new signature */}
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>
                            <EditOutlined style={{ marginRight: 4 }} />
                            Draw New Signature
                        </SectionTitle>
                        <Button
                            icon={<EditOutlined />}
                            block
                            onClick={onOpenSignaturePad}
                            style={{ borderRadius: 8 }}
                        >
                            Create Signature
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Merge Mode — Merge Action
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'merge') {
        const totalMergePages = mergeFiles?.length || 0;

        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>
                        <MergeCellsOutlined style={{ marginRight: 8 }} />
                        Merge Options
                    </h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Summary</SectionTitle>
                        <PropRow label="Files">
                            <Text style={{ fontSize: 12, fontWeight: 600 }}>{totalMergePages}</Text>
                        </PropRow>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, display: 'block', marginBottom: 12 }}>
                            After merging, the result will load into the editor so you can annotate, sign, or export immediately.
                        </Text>
                        <Button
                            type="primary" block size="large"
                            icon={<MergeCellsOutlined />}
                            onClick={onMerge}
                            loading={mergeLoading}
                            disabled={totalMergePages < 2}
                            style={{ borderRadius: 10, height: 44, fontWeight: 600 }}
                        >
                            Merge {totalMergePages} Files
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════════
    // Export Mode — Format, Quality, Action
    // ══════════════════════════════════════════════════════════════════
    if (store.activeMode === 'export') {
        const selectedCount = exportSelectedPages?.length || 0;

        return (
            <div className="pdf-ws-right-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-right-header">
                    <h4 style={{ color: theme.colors.textPrimary }}>
                        <FileImageOutlined style={{ marginRight: 8 }} />
                        Export Settings
                    </h4>
                </div>
                <div className="pdf-ws-right-body kb-vscroll">
                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Format</SectionTitle>
                        <Segmented
                            value={exportFormat}
                            onChange={setExportFormat}
                            options={[
                                { value: 'jpg', label: 'JPG' },
                                { value: 'png', label: 'PNG' },
                            ]}
                            block
                            style={{ marginBottom: 8 }}
                        />
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Quality</SectionTitle>
                        <Radio.Group
                            value={exportQuality}
                            onChange={(e) => setExportQuality(e.target.value)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                        >
                            <Radio value="low" style={{ fontSize: 12 }}>Low (1x — fast)</Radio>
                            <Radio value="medium" style={{ fontSize: 12 }}>Medium (1.5x)</Radio>
                            <Radio value="high" style={{ fontSize: 12 }}>High (2x — crisp)</Radio>
                        </Radio.Group>
                    </div>

                    <div className="pdf-ws-prop-section">
                        <SectionTitle>Selection</SectionTitle>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            {selectedCount} of {totalPages} pages selected
                        </Text>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <Button
                            type="primary" block size="large"
                            icon={<DownloadOutlined />}
                            onClick={() => onExport?.(exportFormat, exportQuality, exportIncludeAnnot)}
                            loading={exportLoading}
                            disabled={selectedCount === 0}
                            style={{ borderRadius: 10, height: 44, fontWeight: 600 }}
                        >
                            Export {selectedCount} Page{selectedCount !== 1 ? 's' : ''}
                        </Button>
                    </div>

                    {/* Exported images download */}
                    {exportedImages && exportedImages.length > 0 && (
                        <>
                            <Divider style={{ margin: '16px 0 8px' }} />
                            <SectionTitle>Results ({exportedImages.length})</SectionTitle>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {exportedImages.map((img, i) => (
                                    <a
                                        key={i}
                                        href={img.url}
                                        download={img.filename}
                                        style={{
                                            fontSize: 11, color: theme.colors.primary,
                                            display: 'flex', alignItems: 'center', gap: 6,
                                        }}
                                    >
                                        <DownloadOutlined /> {img.filename}
                                    </a>
                                ))}
                            </div>
                            {exportedImages.length > 1 && (
                                <Button
                                    icon={<FileZipOutlined />}
                                    block
                                    onClick={onBatchZipDownload}
                                    style={{ borderRadius: 8, marginTop: 8, fontWeight: 600 }}
                                >
                                    Download All as ZIP
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // Fallback
    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-body" />
        </div>
    );
};

export default PropertiesPanel;
