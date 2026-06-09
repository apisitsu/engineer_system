import React from 'react';
import { Typography, Divider, Button, Upload, Slider, Select } from 'antd';
import { InfoCircleOutlined, SwapOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../../theme';
import { usePdfEditorStore } from '../../../../../../../stores/usePdfEditorStore';
import { SectionTitle, PropRow } from './SharedProperties';

const { Text } = Typography;

export default function ViewPanel({
    pdfFile,
    totalPages,
    totalAnnotations,
    overlayFile,
    onLoadOverlay,
    onClearOverlay,
}) {
    const { theme } = useTheme();
    const store = usePdfEditorStore();

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
