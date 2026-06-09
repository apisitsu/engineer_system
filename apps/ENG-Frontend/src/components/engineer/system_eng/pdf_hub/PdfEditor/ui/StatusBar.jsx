import React from 'react';
import { Tag } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../stores/usePdfEditorStore';

export default function StatusBar({
    pdfFile,
    currentPage,
    totalPages,
    zoom,
    totalAnnotations,
}) {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

    return (
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
    );
}
