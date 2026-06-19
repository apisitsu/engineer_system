import React, { useState } from 'react';
import { Button, Segmented, Radio, Typography, Divider } from 'antd';
import { DownloadOutlined, FileImageOutlined, FileZipOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../../theme';
import { SectionTitle } from './SharedProperties';

const { Text } = Typography;

export default function ExportPanel({
    exportSelectedPages, totalPages,
    onExport, exportLoading,
    exportedImages, onBatchZipDownload
}) {
    const { theme } = useTheme();
    
    // Export settings
    const [exportFormat, setExportFormat] = useState('pdf');
    const [exportQuality, setExportQuality] = useState('high');
    const [exportIncludeAnnot, setExportIncludeAnnot] = useState(true);
    
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
                            { value: 'pdf', label: 'PDF' },
                            { value: 'jpg', label: 'JPG' },
                            { value: 'png', label: 'PNG' },
                        ]}
                        block
                        style={{ marginBottom: 8 }}
                    />
                </div>

                <div className="pdf-ws-prop-section">
                    <SectionTitle>Quality {exportFormat === 'pdf' ? '(N/A for PDF)' : ''}</SectionTitle>
                    <Radio.Group
                        value={exportQuality}
                        onChange={(e) => setExportQuality(e.target.value)}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                        disabled={exportFormat === 'pdf'}
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
