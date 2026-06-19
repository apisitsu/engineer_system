import React, { useState } from 'react';
import {
    Card, Button, Typography, Row, Col, Upload, Space, message, Spin,
} from 'antd';
import {
    InboxOutlined, FilePdfOutlined, DeleteOutlined, DragOutlined,
    MergeCellsOutlined, CheckCircleOutlined, DownloadOutlined, RedoOutlined,
} from '@ant-design/icons';
import { PDFDocument } from 'pdf-lib';
import { useTheme } from '../../../../theme';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates,
    verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const SortableItem = ({ id, file, onRemove, theme }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        marginBottom: 8,
        background: theme.colors.surface,
        borderRadius: 8,
        border: `1px solid ${theme.colors.border}`,
    };
    const fileSize = (file.size / 1024 / 1024).toFixed(2);

    return (
        <div ref={setNodeRef} style={style}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
                <div {...attributes} {...listeners} style={{ cursor: 'grab', marginRight: 16, color: theme.colors.textSecondary, display: 'flex', alignItems: 'center' }}>
                    <DragOutlined style={{ fontSize: 18 }} />
                </div>
                <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f', marginRight: 16 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Text strong ellipsis style={{ display: 'block', color: theme.colors.textPrimary }}>{file.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{fileSize} MB</Text>
                </div>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onRemove(id)} />
            </div>
        </div>
    );
};

/**
 * PdfMergerWrapper — Renders the PDF Merger content
 * without its own Layout/Sidebar wrapper, for embedding inside PdfHubLayout.
 */
const PdfMergerWrapper = () => {
    const { theme } = useTheme();
    const [fileList, setFileList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mergedPdfUrl, setMergedPdfUrl] = useState(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setFileList((items) => {
                const oldIndex = items.findIndex((item) => item.uid === active.id);
                const newIndex = items.findIndex((item) => item.uid === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const props = {
        name: 'file',
        multiple: true,
        accept: '.pdf,application/pdf',
        showUploadList: false,
        beforeUpload: (file) => {
            if (file.type !== 'application/pdf') {
                message.error(`${file.name} is not a PDF file`);
                return Upload.LIST_IGNORE;
            }
            return false;
        },
        onChange(info) {
            const { fileList: newFileList } = info;
            const pdfFiles = newFileList
                .filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
                .map(f => f.originFileObj || f);
            setFileList(prev => {
                const existingNames = new Set(prev.map(p => p.name));
                const newItems = pdfFiles.filter(f => !existingNames.has(f.name));
                const withUid = newItems.map(f => {
                    f.uid = f.uid || Math.random().toString(36).substring(2, 9);
                    return f;
                });
                return [...prev, ...withUid];
            });
        },
    };

    const removeFile = (uid) => setFileList(prev => prev.filter(file => file.uid !== uid));

    const mergePdfs = async () => {
        if (fileList.length < 2) {
            message.warning('Please select at least 2 PDF files to merge.');
            return;
        }
        setLoading(true);
        try {
            const mergedPdf = await PDFDocument.create();
            for (const file of fileList) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setMergedPdfUrl(url);
            message.success('PDFs merged successfully!');
        } catch (error) {
            console.error('Error merging PDFs:', error);
            message.error('Failed to merge PDFs.');
        } finally {
            setLoading(false);
        }
    };

    const resetTool = () => {
        if (mergedPdfUrl) URL.revokeObjectURL(mergedPdfUrl);
        setMergedPdfUrl(null);
        setFileList([]);
    };

    return (
        <>
            <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
                <Spin spinning={loading} tip="Merging PDFs..." size="large">
                    <Card variant="borderless" style={{ marginBottom: 24, boxShadow: theme.shadows.sm, borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: theme.colors.surface }}>
                        <Space align="center" size="middle" style={{ marginBottom: 24 }}>
                            <div style={{ width: 4, height: 28, background: theme.colors.primary, borderRadius: 2 }} />
                            <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>PDF Merger Tool</Title>
                        </Space>

                        {!mergedPdfUrl ? (
                            <>
                                <Dragger {...props} style={{ background: `${theme.colors.primary}05`, padding: '40px 0', border: `2px dashed ${theme.colors.primary}55`, borderRadius: 12 }}>
                                    <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: theme.colors.primary }} /></p>
                                    <p className="ant-upload-text">Click or drag PDF files to this area to upload</p>
                                    <p className="ant-upload-hint">Support for single or bulk upload.</p>
                                </Dragger>
                                {fileList.length > 0 && (
                                    <div style={{ marginTop: 32 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <Title level={5} style={{ margin: 0, color: theme.colors.textPrimary }}>Selected Files ({fileList.length})</Title>
                                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Drag to reorder</Text>
                                        </div>
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={fileList.map(f => f.uid)} strategy={verticalListSortingStrategy}>
                                                {fileList.map(file => (<SortableItem key={file.uid} id={file.uid} file={file} onRemove={removeFile} theme={theme} />))}
                                            </SortableContext>
                                        </DndContext>
                                        <Button type="primary" size="large" block icon={<MergeCellsOutlined />} onClick={mergePdfs}
                                            loading={loading} disabled={fileList.length < 2}
                                            style={{ marginTop: 24, height: 48, fontSize: 16 }}>
                                            Merge PDFs
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 24, color: theme.colors.success || '#52c41a' }}>
                                    <CheckCircleOutlined style={{ fontSize: 32 }} />
                                    <Title level={3} style={{ margin: 0, color: theme.colors.success || '#52c41a' }}>Merge Successful!</Title>
                                </div>
                                <div style={{ background: theme.colors.background, padding: 16, borderRadius: 12, border: `1px solid ${theme.colors.border}`, marginBottom: 24 }}>
                                    <iframe src={mergedPdfUrl} width="100%" height="500px" style={{ border: 'none', borderRadius: 8, backgroundColor: '#fff' }} title="PDF Preview" />
                                </div>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Button type="primary" size="large" block icon={<DownloadOutlined />} href={mergedPdfUrl}
                                            download={`merged_${Date.now()}.pdf`}
                                            style={{ height: 48, fontSize: 16, background: theme.colors.success || '#52c41a', borderColor: theme.colors.success || '#52c41a' }}>
                                            Download PDF
                                        </Button>
                                    </Col>
                                    <Col span={12}>
                                        <Button size="large" block icon={<RedoOutlined />} onClick={resetTool} style={{ height: 48, fontSize: 16 }}>
                                            Merge More Files
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </Card>
                </Spin>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </>
    );
};

export default PdfMergerWrapper;
