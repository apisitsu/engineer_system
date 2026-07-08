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

    // If an object is selected, determine the best panel for it
    if (store.selectedObjectId && store.selectedObjectProps) {
        const type = store.selectedObjectProps.type;
        const customType = store.selectedObjectProps.customData?.type;
        
        const annotateTools = ['highlight', 'underline', 'strikethrough', 'sticky', 'maskReplace'];
        const isText = type === 'i-text' || type === 'textbox' || type === 'text';
        
        if (annotateTools.includes(customType) || isText) {
            return <AnnotatePanel fabricCanvasRefs={fabricCanvasRefs} currentPage={currentPage} />;
        }
        
        const signTools = ['stampCheckmark', 'stampCross', 'stampCircle', 'stampOk', 'stampUserDate', 'stamp', 'signature', 'date', 'formFill'];
        if (signTools.includes(customType)) {
            return (
                <SignPanel
                    stampData={stampData}
                    onOpenSignaturePad={onOpenSignaturePad}
                    onPlaceStamp={onPlaceStamp}
                />
            );
        }
        
        // Default for rect, circle, arrow, line, freehand, ruler
        return <ShapesPanel fabricCanvasRefs={fabricCanvasRefs} currentPage={currentPage} />;
    }

    // Otherwise, fall back to current activeMode
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
        return <AnnotatePanel fabricCanvasRefs={fabricCanvasRefs} currentPage={currentPage} />;
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
