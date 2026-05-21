import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button, Tooltip, Typography, Spin, Divider, Empty } from 'antd';
import {
    RotateRightOutlined, RotateLeftOutlined, FileOutlined,
    SwapOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../../theme';
import * as pdfjsLib from 'pdfjs-dist';

const { Text } = Typography;

/**
 * MergePreview — Full page preview for Merge mode.
 *
 * Renders all pages from all merge files in a scrollable vertical list.
 * Each page can be rotated 90° in either direction.
 * Files are separated by visual dividers showing file name.
 */
const MergePreview = ({ mergeFiles }) => {
    const { theme } = useTheme();
    const [pages, setPages] = useState([]); // [{ fileIdx, fileUid, fileName, pageNum, totalPages, dataUrl, rotation }]
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);

    // ── Render all pages from all files ──
    const renderAllPages = useCallback(async () => {
        if (!mergeFiles || mergeFiles.length === 0) {
            setPages([]);
            return;
        }

        setLoading(true);
        const allPages = [];

        // Measure available width (container - padding - border)
        const containerW = containerRef.current
            ? containerRef.current.clientWidth - 48 // subtract padding (24px * 2)
            : 560; // fallback

        // Cap at 600px max render width for performance
        const maxRenderW = Math.min(containerW, 600);

        try {
            for (let fileIdx = 0; fileIdx < mergeFiles.length; fileIdx++) {
                const file = mergeFiles[fileIdx];
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
                        const page = await doc.getPage(pageNum);
                        // Get native page dimensions (1:1 scale)
                        const nativeVp = page.getViewport({ scale: 1.0 });
                        // Calculate scale to fit container width
                        const fitScale = maxRenderW / nativeVp.width;
                        const viewport = page.getViewport({ scale: fitScale });

                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        const ctx = canvas.getContext('2d');
                        await page.render({ canvasContext: ctx, viewport }).promise;

                        allPages.push({
                            id: `${file.uid}_${pageNum}`,
                            fileIdx,
                            fileUid: file.uid,
                            fileName: file.name,
                            pageNum,
                            totalPages: doc.numPages,
                            dataUrl: canvas.toDataURL('image/jpeg', 0.75),
                            rotation: 0,
                        });
                    }
                } catch (err) {
                    console.error(`Error rendering ${file.name}:`, err);
                    allPages.push({
                        id: `${file.uid}_error`,
                        fileIdx,
                        fileUid: file.uid,
                        fileName: file.name,
                        pageNum: 0,
                        totalPages: 0,
                        dataUrl: null,
                        rotation: 0,
                        error: true,
                    });
                }
            }
        } finally {
            setPages(allPages);
            setLoading(false);
        }
    }, [mergeFiles]);

    useEffect(() => {
        renderAllPages();
    }, [renderAllPages]);

    // ── Rotate a page ──
    const rotatePage = useCallback((pageId, direction) => {
        setPages(prev => prev.map(p => {
            if (p.id !== pageId) return p;
            const newRotation = (p.rotation + (direction === 'cw' ? 90 : -90) + 360) % 360;
            return { ...p, rotation: newRotation };
        }));
    }, []);

    if (!mergeFiles || mergeFiles.length === 0) {
        return (
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 48, flexDirection: 'column', gap: 16, opacity: 0.5,
            }}>
                <FileOutlined style={{ fontSize: 48, color: theme.colors.textSecondary }} />
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
                    Add PDF files from the left panel to preview
                </Text>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 48, flexDirection: 'column', gap: 16,
            }}>
                <Spin size="large" />
                <Text style={{ color: theme.colors.textSecondary }}>
                    Rendering pages...
                </Text>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="kb-vscroll"
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                background: theme.colors.background,
            }}
        >
            {pages.map((page, idx) => {
                // Show file header at the start of each file's pages
                const showFileHeader = idx === 0 || pages[idx - 1]?.fileUid !== page.fileUid;

                return (
                    <React.Fragment key={page.id}>
                        {showFileHeader && (
                            <>
                                {idx > 0 && (
                                    <Divider style={{ margin: '8px 0', borderColor: theme.colors.border }}>
                                        <SwapOutlined style={{ marginRight: 6 }} />
                                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                            ↓ Next File ↓
                                        </Text>
                                    </Divider>
                                )}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '6px 16px', borderRadius: 8,
                                    background: `${theme.colors.primary}0a`,
                                    border: `1px solid ${theme.colors.border}`,
                                    width: '100%', maxWidth: 600,
                                }}>
                                    <FileOutlined style={{ color: theme.colors.primary }} />
                                    <Text strong style={{ fontSize: 12, flex: 1 }} ellipsis>
                                        {page.fileName}
                                    </Text>
                                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                                        {page.totalPages} page{page.totalPages !== 1 ? 's' : ''}
                                    </Text>
                                </div>
                            </>
                        )}

                        {page.error ? (
                            <div style={{
                                padding: 24, textAlign: 'center',
                                color: theme.colors.textSecondary,
                                border: `1px dashed ${theme.colors.border}`,
                                borderRadius: 8, width: '100%', maxWidth: 600,
                            }}>
                                Failed to load this file
                            </div>
                        ) : (
                            <div style={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: 600,
                                borderRadius: 8,
                                overflow: 'hidden',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                                background: '#fff',
                                border: `1px solid ${theme.colors.border}`,
                            }}>
                                {/* Page label */}
                                <div style={{
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 10px',
                                    background: `${theme.colors.surface}`,
                                    borderBottom: `1px solid ${theme.colors.border}`,
                                }}>
                                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                                        Page {page.pageNum}
                                        {page.rotation !== 0 && ` • Rotated ${page.rotation}°`}
                                    </Text>
                                    <div style={{ display: 'flex', gap: 2 }}>
                                        <Tooltip title="Rotate left">
                                            <Button
                                                type="text" size="small"
                                                icon={<RotateLeftOutlined />}
                                                onClick={() => rotatePage(page.id, 'ccw')}
                                                style={{ fontSize: 12, padding: '0 4px' }}
                                            />
                                        </Tooltip>
                                        <Tooltip title="Rotate right">
                                            <Button
                                                type="text" size="small"
                                                icon={<RotateRightOutlined />}
                                                onClick={() => rotatePage(page.id, 'cw')}
                                                style={{ fontSize: 12, padding: '0 4px' }}
                                            />
                                        </Tooltip>
                                    </div>
                                </div>

                                {/* Page image */}
                                <img
                                    src={page.dataUrl}
                                    alt={`${page.fileName} p${page.pageNum}`}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        transform: `rotate(${page.rotation}deg)`,
                                        transition: 'transform 0.3s ease',
                                    }}
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}

            {/* Summary footer */}
            <div style={{
                padding: '12px 16px', textAlign: 'center',
                color: theme.colors.textSecondary, fontSize: 11,
                marginTop: 8,
            }}>
                Total: {mergeFiles.length} files, {pages.filter(p => !p.error).length} pages
            </div>
        </div>
    );
};

export default MergePreview;
