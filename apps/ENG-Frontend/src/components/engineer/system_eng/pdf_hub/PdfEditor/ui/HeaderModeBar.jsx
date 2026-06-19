import React from 'react';
import { Button, Segmented, Space, Tooltip, Select, Upload } from 'antd';
import {
    ToolOutlined, DashboardOutlined, AppstoreOutlined, InsertRowAboveOutlined,
    LeftOutlined, RightOutlined, ZoomOutOutlined, ZoomInOutlined,
    UndoOutlined, RedoOutlined, DeleteOutlined, MenuUnfoldOutlined, MenuFoldOutlined,
    DownloadOutlined, FilePdfOutlined, ClearOutlined, SaveOutlined, CloseOutlined
} from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';
import { MODE_OPTIONS, ZOOM_OPTIONS } from '../constants';

export default function HeaderModeBar({
    onOpenDashboard,
    onOpenWatermark,
    onSavePageState,
    onPrevPage,
    onNextPage,
    onClosePdf,
    currentPage,
    totalPages,
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    zoomTo,
    canUndo,
    canRedo,
    undo,
    redo,
    onDeleteSelected,
    leftCollapsed,
    setLeftCollapsed,
    onApplyAndDownload,
    onSaveEditable,
    onClearPage,
    totalAnnotations,
    fabricCanvasRefs,
    onFileUpload,
    usedToolsRef,
    canvasWrapperRef,
    pdfDoc
}) {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    return (
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
                        onOpenWatermark();
                        return;
                    }
                    onSavePageState();
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
                        onClick={onOpenDashboard}
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
                        disabled={currentPage <= 1} onClick={onPrevPage}
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
                        disabled={currentPage >= totalPages} onClick={onNextPage}
                        style={{ borderRadius: 7 }} />
                </Tooltip>

                <div style={{ width: 1, height: 20, background: theme.colors.border, margin: '0 4px' }} />

                {/* Zoom */}
                <Tooltip title="Zoom out">
                    <Button size="small" icon={<ZoomOutOutlined />} onClick={() => { onSavePageState(); zoomOut(); }}
                        style={{ borderRadius: 7 }} />
                </Tooltip>
                <Select
                    size="small"
                    value={ZOOM_OPTIONS.some(o => o.value === zoom) ? zoom : undefined}
                    placeholder={`${Math.round(zoom * 100)}%`}
                    onChange={(val) => {
                        onSavePageState();
                        if (val === 'fit') {
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
                    <Button size="small" icon={<ZoomInOutlined />} onClick={() => { onSavePageState(); zoomIn(); }}
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
                <Tooltip title="Clear Page">
                    <Button size="small" icon={<ClearOutlined />}
                        onClick={onClearPage}
                        style={{ borderRadius: 7 }} />
                </Tooltip>

                {/* Delete selected */}
                {store.selectedObjectId && (
                    <Tooltip title="Delete selected (Del)">
                        <Button size="small" danger icon={<DeleteOutlined />}
                            onClick={onDeleteSelected}
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
                <Tooltip title="Save Editable PDF">
                    <Button size="small" icon={<SaveOutlined />}
                        onClick={onSaveEditable}
                        style={{ borderRadius: 7 }} />
                </Tooltip>
                <Tooltip title="Apply & Download PDF">
                    <Button size="small" type="primary" icon={<DownloadOutlined />}
                        onClick={onApplyAndDownload}
                        disabled={(totalAnnotations === 0 && !canUndo && Object.values(fabricCanvasRefs?.current || {}).every(fc => !fc || fc.getObjects().length === 0)) && store.activeMode !== 'merge'}
                        style={{ borderRadius: 7, fontWeight: 600 }}>
                        Save
                    </Button>
                </Tooltip>

                {/* Change PDF */}
                <Upload
                    accept=".pdf,application/pdf"
                    showUploadList={false}
                    beforeUpload={onFileUpload}
                >
                    <Tooltip title="Open another PDF">
                        <Button size="small" style={{ borderRadius: 7 }}>
                            <FilePdfOutlined />
                        </Button>
                    </Tooltip>
                </Upload>
                
                {/* Close PDF */}
                <Tooltip title="Close PDF">
                    <Button size="small" danger style={{ borderRadius: 7 }} onClick={onClosePdf}>
                        <CloseOutlined />
                    </Button>
                </Tooltip>
            </Space>
        </div>
    );
}
