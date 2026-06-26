import React from 'react';
import { useTheme } from '../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';

import ViewPanel from './properties/ViewPanel';
import AnnotatePanel from './properties/AnnotatePanel';
import ShapesPanel from './properties/ShapesPanel';
import SignPanel from './properties/SignPanel';
import MergePanel from './properties/MergePanel';
import ExportPanel from './properties/ExportPanel';

/**
 * PropertiesPanel — Context-sensitive right sidebar.
 *
 * Shows different controls based on activeMode.
 * The logic is now extracted into individual panel components.
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
    fabricCanvasRefs,
    currentPage,
}) => {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    if (store.activeMode === 'view') {
        return (
            <ViewPanel
                pdfFile={pdfFile}
                totalPages={totalPages}
                totalAnnotations={totalAnnotations}
                overlayFile={overlayFile}
                onLoadOverlay={onLoadOverlay}
                onClearOverlay={onClearOverlay}
            />
        );
    }

    if (store.activeMode === 'annotate') {
        return <AnnotatePanel />;
    }

    if (store.activeMode === 'shapes' || store.activeMode === 'dwgCheck') {
        return <ShapesPanel fabricCanvasRefs={fabricCanvasRefs} currentPage={currentPage} />;
    }

    if (store.activeMode === 'sign') {
        return (
            <SignPanel
                stampData={stampData}
                onOpenSignaturePad={onOpenSignaturePad}
                onPlaceStamp={onPlaceStamp}
            />
        );
    }

    if (store.activeMode === 'merge') {
        return (
            <MergePanel
                mergeFiles={mergeFiles}
                onMerge={onMerge}
                mergeLoading={mergeLoading}
            />
        );
    }

    if (store.activeMode === 'export') {
        return (
            <ExportPanel
                exportSelectedPages={exportSelectedPages}
                totalPages={totalPages}
                onExport={onExport}
                exportLoading={exportLoading}
                exportedImages={exportedImages}
                onBatchZipDownload={onBatchZipDownload}
            />
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
