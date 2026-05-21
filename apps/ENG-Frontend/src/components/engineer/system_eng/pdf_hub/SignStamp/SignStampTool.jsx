import React from 'react';
import {
    Upload, Button, Typography, Spin, Tooltip, Select, Tag, Space,
} from 'antd';
import {
    InboxOutlined, LeftOutlined, RightOutlined,
    ZoomInOutlined, ZoomOutOutlined, UndoOutlined, RedoOutlined,
    DownloadOutlined, DeleteOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../../theme';
import useSignStamp from './useSignStamp';
import PdfCanvas from './PdfCanvas';
import StampPalette from './StampPalette';
import './SignStampTool.css';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ZOOM_OPTIONS = [
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1.0, label: '100%' },
    { value: 1.25, label: '125%' },
    { value: 1.5, label: '150%' },
    { value: 2.0, label: '200%' },
];

/**
 * SignStampTool — Main orchestration component for the Paperless Sign & Stamp feature.
 * Three-panel layout: Upload/Toolbar | PDF Canvas | Stamp Palette
 */
const SignStampTool = () => {
    const { theme } = useTheme();
    const {
        pdfFile, pdfDoc, totalPages, currentPage, zoom, pdfLoading,
        setCurrentPage, setZoom, loadPdf,
        stampData, stampLoading, fetchStamps, uploadStamp,
        placements, activeStampType, selectedPlacementId,
        setActiveStampType, setSelectedPlacementId,
        addPlacement, updatePlacementPosition, removePlacement,
        applyAndDownload, undo, redo, canUndo, canRedo,
    } = useSignStamp();

    const handleFileUpload = (file) => {
        if (file.type !== 'application/pdf') {
            return Upload.LIST_IGNORE;
        }
        loadPdf(file);
        return false; // Prevent auto upload
    };

    // If no PDF is loaded, show the upload zone
    if (!pdfDoc) {
        return (
            <Spin spinning={pdfLoading} tip="Loading PDF..." size="large">
                <div className="sign-stamp-upload-panel" style={{ background: theme.colors.surface, borderRadius: 16, minHeight: 'calc(100vh - 64px - 48px)' }}>
                    <div style={{ marginBottom: 32 }}>
                        <div style={{
                            width: 72, height: 72, borderRadius: 20,
                            background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.primary}08)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 20px',
                        }}>
                            <FilePdfOutlined style={{ fontSize: 36, color: theme.colors.primary }} />
                        </div>
                        <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>
                            Paperless Sign & Stamp
                        </Title>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginTop: 8, display: 'block' }}>
                            Upload a PDF document to start adding your digital stamps and signatures
                        </Text>
                    </div>

                    <div className="sign-stamp-upload-zone">
                        <Dragger
                            accept=".pdf,application/pdf"
                            showUploadList={false}
                            beforeUpload={handleFileUpload}
                            style={{
                                borderRadius: 16, padding: '48px 24px',
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
                                Your stamps and signatures will be embedded at physically accurate dimensions
                            </p>
                        </Dragger>
                    </div>

                    <div style={{ marginTop: 32, opacity: 0.5 }}>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            Supported: PDF files up to 50MB • Stamps rendered at 1mm ≈ 2.835pt
                        </Text>
                    </div>
                </div>
            </Spin>
        );
    }

    // PDF loaded — show the three-panel editor
    return (
        <div
            className="sign-stamp-container"
            style={{
                border: `1px solid ${theme.colors.border}`,
                background: theme.colors.surface,
            }}
        >
            {/* ── CENTER: PDF Viewer ── */}
            <div className="sign-stamp-viewer" style={{ borderRight: `1px solid ${theme.colors.border}` }}>
                {/* Toolbar */}
                <div className="sign-stamp-toolbar" style={{
                    background: theme.colors.surface,
                    borderBottom: `1px solid ${theme.colors.border}`,
                }}>
                    <div className="sign-stamp-toolbar-group">
                        {/* File info */}
                        <Tag color="blue" style={{ borderRadius: 8, margin: 0 }}>
                            <FilePdfOutlined style={{ marginRight: 4 }} />
                            {pdfFile?.name || 'Document'}
                        </Tag>

                        {/* Page navigation */}
                        <Tooltip title="Previous page">
                            <Button
                                size="small" icon={<LeftOutlined />}
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                style={{ borderRadius: 8 }}
                            />
                        </Tooltip>
                        <span className="sign-stamp-page-indicator" style={{
                            background: `${theme.colors.primary}12`,
                            color: theme.colors.primary,
                        }}>
                            {currentPage} / {totalPages}
                        </span>
                        <Tooltip title="Next page">
                            <Button
                                size="small" icon={<RightOutlined />}
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                style={{ borderRadius: 8 }}
                            />
                        </Tooltip>
                    </div>

                    <div className="sign-stamp-toolbar-group">
                        {/* Zoom */}
                        <Tooltip title="Zoom out">
                            <Button size="small" icon={<ZoomOutOutlined />}
                                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                                className="sign-stamp-zoom-btn" />
                        </Tooltip>
                        <Select
                            size="small" value={zoom} onChange={setZoom}
                            options={ZOOM_OPTIONS}
                            style={{ width: 80 }}
                        />
                        <Tooltip title="Zoom in">
                            <Button size="small" icon={<ZoomInOutlined />}
                                onClick={() => setZoom(z => Math.min(2.0, z + 0.25))}
                                className="sign-stamp-zoom-btn" />
                        </Tooltip>

                        <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                        {/* Undo/Redo */}
                        <Tooltip title="Undo (Ctrl+Z)">
                            <Button size="small" icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} style={{ borderRadius: 8 }} />
                        </Tooltip>
                        <Tooltip title="Redo (Ctrl+Y)">
                            <Button size="small" icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} style={{ borderRadius: 8 }} />
                        </Tooltip>

                        {/* Delete selected */}
                        {selectedPlacementId && (
                            <Tooltip title="Remove selected stamp">
                                <Button size="small" danger icon={<DeleteOutlined />}
                                    onClick={() => removePlacement(selectedPlacementId)}
                                    style={{ borderRadius: 8 }} />
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* Placement mode indicator */}
                {activeStampType && (
                    <div className="sign-stamp-placing-indicator" style={{
                        textAlign: 'center', padding: '6px 12px',
                        background: `${theme.colors.primary}0c`,
                        borderBottom: `1px solid ${theme.colors.primary}22`,
                        fontSize: 12, fontWeight: 600,
                        color: theme.colors.primary,
                    }}>
                        🎯 Click anywhere on the PDF to place your {activeStampType}
                    </div>
                )}

                {/* Canvas */}
                <div
                    className="sign-stamp-canvas-wrapper kb-vscroll"
                    data-placing={!!activeStampType}
                    style={{ background: theme.colors.background }}
                    onClick={() => setSelectedPlacementId(null)}
                >
                    <PdfCanvas
                        pdfDoc={pdfDoc}
                        currentPage={currentPage}
                        zoom={zoom}
                        placements={placements}
                        activeStampType={activeStampType}
                        selectedPlacementId={selectedPlacementId}
                        stampData={stampData}
                        onCanvasClick={addPlacement}
                        onPlacementDragEnd={updatePlacementPosition}
                        onPlacementSelect={setSelectedPlacementId}
                        onPlacementRemove={removePlacement}
                    />
                </div>

                {/* Bottom action bar */}
                <div className="sign-stamp-action-bar" style={{
                    background: theme.colors.surface,
                    borderTop: `1px solid ${theme.colors.border}`,
                }}>
                    <Space>
                        <Upload
                            accept=".pdf,application/pdf"
                            showUploadList={false}
                            beforeUpload={handleFileUpload}
                        >
                            <Button style={{ borderRadius: 10 }}>
                                Change PDF
                            </Button>
                        </Upload>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                            {placements.length} stamp{placements.length !== 1 ? 's' : ''} placed
                        </Text>
                    </Space>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={applyAndDownload}
                        disabled={placements.length === 0}
                        style={{
                            borderRadius: 10, height: 40,
                            fontWeight: 600, paddingInline: 24,
                        }}
                    >
                        Apply & Download
                    </Button>
                </div>
            </div>

            {/* ── RIGHT: Stamp Palette ── */}
            <div
                className="sign-stamp-palette"
                style={{
                    borderLeft: `1px solid ${theme.colors.border}`,
                    background: theme.colors.surface,
                }}
            >
                <StampPalette
                    stampData={stampData}
                    stampLoading={stampLoading}
                    activeStampType={activeStampType}
                    onSelectStampType={setActiveStampType}
                    onUploadStamp={uploadStamp}
                />
            </div>
        </div>
    );
};

export default SignStampTool;
