import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Badge, Button, Checkbox, Upload, Typography, Spin } from 'antd';
import { PlusOutlined, InboxOutlined, FileOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../theme';
import { usePdfEditorStore } from '../../../../../stores/usePdfEditorStore';
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as pdfjsLib from 'pdfjs-dist';

const { Text } = Typography;
const { Dragger } = Upload;

// ── Sortable merge file item with preview ──
const SortableMergeItem = ({ id, file, preview, onRemove, theme }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const sizeMB = ((file.size || 0) / 1024 / 1024).toFixed(1);

    return (
        <div ref={setNodeRef} style={style} className="pdf-ws-merge-item">
            <div {...attributes} {...listeners} className="pdf-ws-merge-drag-handle">⠿</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {preview && (
                    <img
                        src={preview}
                        alt={file.name}
                        style={{
                            width: '100%', display: 'block',
                            borderRadius: 6, marginBottom: 6,
                            border: `1px solid ${theme.colors.border}`,
                        }}
                    />
                )}
                <Text ellipsis strong style={{ display: 'block', fontSize: 11, color: theme.colors.textPrimary }}>
                    {file.name}
                </Text>
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                    {sizeMB} MB {file._pageCount ? `• ${file._pageCount} pages` : ''}
                </Text>
            </div>
            <Button type="text" size="small" danger onClick={() => onRemove(id)}
                style={{ fontSize: 14, padding: 2, alignSelf: 'flex-start' }}>✕</Button>
        </div>
    );
};

/**
 * ThumbnailPanel — Multi-purpose left sidebar.
 *
 * Adapts based on activeMode:
 *   - View/Annotate/Shapes/Edit/Sign: Page thumbnails with annotation badges
 *   - Merge: File list with previews and drag-to-reorder
 *   - Export: Page thumbnails with selection checkboxes
 */
const ThumbnailPanel = ({
    pdfDoc,
    totalPages,
    currentPage,
    goToPage,
    getAnnotationCount,
    thumbnails,
    setThumbnails,
    // Merge mode
    mergeFiles,
    setMergeFiles,
    onMergeFilesAdd,
    // Export mode
    exportSelectedPages,
    setExportSelectedPages,
}) => {
    const { theme } = useTheme();
    const store = usePdfEditorStore();
    const thumbRefs = useRef({});
    const observerRef = useRef(null);
    const panelRef = useRef(null);

    // Merge file previews (first page thumbnail of each file)
    const [mergePreviews, setMergePreviews] = useState({});

    const sensors = useSensors(useSensor(PointerSensor));

    // ══════════════════════════════════════════════════════════════════
    // Thumbnail Rendering (lazy via IntersectionObserver)
    // ══════════════════════════════════════════════════════════════════
    const renderThumbnail = useCallback(async (pageNum) => {
        if (!pdfDoc || thumbnails[pageNum]) return;

        try {
            const page = await pdfDoc.getPage(pageNum);
            // Calculate scale to fit panel width
            const nativeVp = page.getViewport({ scale: 1.0 });
            const panelW = panelRef.current
                ? panelRef.current.clientWidth - 24  // subtract padding (10px*2 + borders)
                : 196; // fallback: 220 - 24
            const fitScale = panelW / nativeVp.width;
            const viewport = page.getViewport({ scale: fitScale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setThumbnails(prev => ({ ...prev, [pageNum]: dataUrl }));
        } catch (err) {
            console.error(`Thumbnail render error (page ${pageNum}):`, err);
        }
    }, [pdfDoc, thumbnails, setThumbnails]);

    // Setup IntersectionObserver for lazy loading
    useEffect(() => {
        if (store.activeMode === 'merge') return;

        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const pageNum = parseInt(entry.target.dataset.page);
                        if (pageNum) renderThumbnail(pageNum);
                    }
                });
            },
            { rootMargin: '200px', threshold: 0.1 }
        );

        // Observe all thumb placeholders
        Object.values(thumbRefs.current).forEach(el => {
            if (el) observerRef.current.observe(el);
        });

        return () => observerRef.current?.disconnect();
    }, [pdfDoc, totalPages, store.activeMode, renderThumbnail]);

    // ══════════════════════════════════════════════════════════════════
    // Merge Mode: Generate first-page previews for each file
    // ══════════════════════════════════════════════════════════════════
    useEffect(() => {
        if (store.activeMode !== 'merge') return;

        const generatePreviews = async () => {
            for (const file of mergeFiles) {
                if (mergePreviews[file.uid]) continue;
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    // Store page count on the file object for display
                    file._pageCount = doc.numPages;
                    const page = await doc.getPage(1);
                    const nativeVp = page.getViewport({ scale: 1.0 });
                    const panelW = panelRef.current
                        ? panelRef.current.clientWidth - 48
                        : 172;
                    const fitScale = panelW / nativeVp.width;
                    const viewport = page.getViewport({ scale: fitScale });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext('2d');
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    setMergePreviews(prev => ({ ...prev, [file.uid]: dataUrl }));
                } catch (err) {
                    console.error(`Preview error for ${file.name}:`, err);
                }
            }
        };

        generatePreviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mergeFiles, store.activeMode]);

    // ══════════════════════════════════════════════════════════════════
    // Merge Mode: Drag-to-Reorder
    // ══════════════════════════════════════════════════════════════════
    const handleMergeDragEnd = (event) => {
        const { active, over } = event;
        if (active.id !== over.id) {
            setMergeFiles((items) => {
                const oldIdx = items.findIndex(i => i.uid === active.id);
                const newIdx = items.findIndex(i => i.uid === over.id);
                return arrayMove(items, oldIdx, newIdx);
            });
        }
    };

    const handleMergeFileRemove = (uid) => {
        setMergeFiles(prev => prev.filter(f => f.uid !== uid));
        setMergePreviews(prev => {
            const next = { ...prev };
            delete next[uid];
            return next;
        });
    };

    // ══════════════════════════════════════════════════════════════════
    // Export Mode: Page Selection
    // ══════════════════════════════════════════════════════════════════
    const toggleExportPage = (pageNum) => {
        setExportSelectedPages(prev => {
            const set = new Set(prev);
            if (set.has(pageNum)) set.delete(pageNum);
            else set.add(pageNum);
            return [...set].sort((a, b) => a - b);
        });
    };

    const selectAllExport = () => {
        setExportSelectedPages(Array.from({ length: totalPages }, (_, i) => i + 1));
    };

    const deselectAllExport = () => {
        setExportSelectedPages([]);
    };

    // ── Placeholder height based on typical A4 aspect ratio ──
    const placeholderH = 220;

    // ══════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════

    // ── Merge Mode ──
    if (store.activeMode === 'merge') {
        return (
            <div ref={panelRef} className="pdf-ws-left-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-left-header">
                    <h4 style={{ color: theme.colors.textSecondary }}>Files</h4>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>
                        {mergeFiles.length} file(s)
                    </Text>
                </div>
                <div className="pdf-ws-thumbnails kb-vscroll">
                    {mergeFiles.length > 0 ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleMergeDragEnd}>
                            <SortableContext items={mergeFiles.map(f => f.uid)} strategy={verticalListSortingStrategy}>
                                {mergeFiles.map((file, idx) => (
                                    <div key={file.uid}>
                                        {idx > 0 && (
                                            <div style={{
                                                textAlign: 'center', fontSize: 9,
                                                color: theme.colors.textSecondary,
                                                padding: '2px 0', opacity: 0.5,
                                            }}>
                                                ▼ merged below ▼
                                            </div>
                                        )}
                                        <SortableMergeItem
                                            id={file.uid}
                                            file={file}
                                            preview={mergePreviews[file.uid]}
                                            onRemove={handleMergeFileRemove}
                                            theme={theme}
                                        />
                                    </div>
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 8px', opacity: 0.5 }}>
                            <FileOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block' }} />
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                                Add PDF files to merge
                            </Text>
                        </div>
                    )}
                </div>
                <div style={{ padding: 8, borderTop: `1px solid ${theme.colors.border}` }}>
                    <Upload
                        accept=".pdf,application/pdf"
                        multiple
                        showUploadList={false}
                        beforeUpload={(file) => {
                            if (file.type !== 'application/pdf') return Upload.LIST_IGNORE;
                            return false;
                        }}
                        onChange={(info) => {
                            if (onMergeFilesAdd) {
                                const files = info.fileList
                                    .filter(f => f.originFileObj)
                                    .map(f => {
                                        const obj = f.originFileObj;
                                        obj.uid = obj.uid || Math.random().toString(36).substring(2, 9);
                                        return obj;
                                    });
                                onMergeFilesAdd(files);
                            }
                        }}
                    >
                        <Button icon={<PlusOutlined />} block size="small"
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
                            Add PDFs
                        </Button>
                    </Upload>
                </div>
            </div>
        );
    }

    // ── Export Mode ──
    if (store.activeMode === 'export') {
        const allSelected = exportSelectedPages?.length === totalPages;

        return (
            <div ref={panelRef} className="pdf-ws-left-panel" style={{
                '--ws-border': theme.colors.border,
                '--ws-surface': theme.colors.surface,
            }}>
                <div className="pdf-ws-left-header">
                    <h4 style={{ color: theme.colors.textSecondary }}>Pages</h4>
                    <Button type="link" size="small" onClick={allSelected ? deselectAllExport : selectAllExport}
                        style={{ padding: 0, fontSize: 10 }}>
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                </div>
                <div className="pdf-ws-thumbnails kb-vscroll">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                        const isSelected = exportSelectedPages?.includes(pageNum);
                        return (
                            <div
                                key={pageNum}
                                className={`pdf-ws-thumb-item ${isSelected ? 'active' : ''}`}
                                onClick={() => toggleExportPage(pageNum)}
                                style={{ '--ws-primary': theme.colors.primary }}
                            >
                                <div style={{ position: 'relative' }}>
                                    {thumbnails[pageNum] ? (
                                        <img src={thumbnails[pageNum]} alt={`Page ${pageNum}`}
                                            style={{ width: '100%', display: 'block' }} />
                                    ) : (
                                        <div ref={el => { thumbRefs.current[pageNum] = el; }}
                                            data-page={pageNum}
                                            style={{
                                                height: placeholderH,
                                                background: '#f0f0f0',
                                                borderRadius: 4,
                                            }} />
                                    )}
                                    <Checkbox
                                        checked={isSelected}
                                        style={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => toggleExportPage(pageNum)}
                                    />
                                </div>
                                <div className="pdf-ws-thumb-label" style={{ color: theme.colors.textSecondary }}>
                                    {pageNum}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Default: Page Thumbnails ──
    return (
        <div ref={panelRef} className="pdf-ws-left-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-left-header">
                <h4 style={{ color: theme.colors.textSecondary }}>Pages</h4>
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary }}>{totalPages}</Text>
            </div>
            <div className="pdf-ws-thumbnails kb-vscroll">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                    const annotCount = getAnnotationCount(pageNum);
                    const isActive = pageNum === currentPage;

                    return (
                        <div
                            key={pageNum}
                            className={`pdf-ws-thumb-item ${isActive ? 'active' : ''}`}
                            onClick={() => goToPage(pageNum)}
                            style={{
                                '--ws-primary': theme.colors.primary,
                                '--ws-primary-light': `${theme.colors.primary}44`,
                            }}
                        >
                            {thumbnails[pageNum] ? (
                                <img src={thumbnails[pageNum]} alt={`Page ${pageNum}`}
                                    style={{ width: '100%', display: 'block' }} />
                            ) : (
                                <div
                                    ref={el => { thumbRefs.current[pageNum] = el; }}
                                    data-page={pageNum}
                                    style={{
                                        height: placeholderH,
                                        background: '#f5f5f5',
                                        borderRadius: 4,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Spin size="small" />
                                </div>
                            )}
                            {annotCount > 0 && (
                                <div className="pdf-ws-thumb-badge"
                                    style={{ background: theme.colors.primary }}>
                                    {annotCount}
                                </div>
                            )}
                            <div className="pdf-ws-thumb-label"
                                style={{
                                    color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                                    fontWeight: isActive ? 700 : 500,
                                }}>
                                {pageNum}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ThumbnailPanel;
