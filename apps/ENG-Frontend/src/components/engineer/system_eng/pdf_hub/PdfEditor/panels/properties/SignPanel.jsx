import React from 'react';
import { Button, Divider } from 'antd';
import { EditOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../../theme';
import { SectionTitle } from './SharedProperties';

export default function SignPanel({ stampData, onOpenSignaturePad, onPlaceStamp }) {
    const { theme } = useTheme();

    return (
        <div className="pdf-ws-right-panel" style={{
            '--ws-border': theme.colors.border,
            '--ws-surface': theme.colors.surface,
        }}>
            <div className="pdf-ws-right-header">
                <h4 style={{ color: theme.colors.textPrimary }}>Fill & Sign</h4>
            </div>
            <div className="pdf-ws-right-body kb-vscroll">
                <div className="pdf-ws-prop-section">
                    <SectionTitle>Signature</SectionTitle>
                    <Button
                        block
                        icon={<EditOutlined />}
                        onClick={onOpenSignaturePad}
                        style={{ borderRadius: 10, marginBottom: 8, fontWeight: 600 }}
                    >
                        Create Signature
                    </Button>
                </div>

                {stampData && (
                    <>
                        {stampData.stamp_image && (
                            <div className="pdf-ws-prop-section">
                                <SectionTitle>
                                    <SafetyCertificateOutlined style={{ marginRight: 4 }} />
                                    Company Stamp
                                </SectionTitle>
                                <div
                                    onClick={() => onPlaceStamp?.('stamp')}
                                    style={{
                                        padding: 8, borderRadius: 10, cursor: 'pointer',
                                        border: `1px solid ${theme.colors.border}`,
                                        background: '#fff', textAlign: 'center',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <img
                                        src={`data:image/png;base64,${stampData.stamp_image}`}
                                        alt="Stamp"
                                        style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain' }}
                                    />
                                    <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                                        Click to place • {stampData.stamp_width_mm}×{stampData.stamp_height_mm}mm
                                    </div>
                                </div>
                            </div>
                        )}

                        {stampData.signature_image && (
                            <div className="pdf-ws-prop-section">
                                <SectionTitle>
                                    <EditOutlined style={{ marginRight: 4 }} />
                                    Saved Signature
                                </SectionTitle>
                                <div
                                    onClick={() => onPlaceStamp?.('signature')}
                                    style={{
                                        padding: 8, borderRadius: 10, cursor: 'pointer',
                                        border: `1px solid ${theme.colors.border}`,
                                        background: '#fff', textAlign: 'center',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <img
                                        src={`data:image/png;base64,${stampData.signature_image}`}
                                        alt="Signature"
                                        style={{ maxWidth: '100%', maxHeight: 40, objectFit: 'contain' }}
                                    />
                                    <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                                        Click to place • {stampData.sig_width_mm}×{stampData.sig_height_mm}mm
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <Divider style={{ margin: '12px 0 8px' }} />

                {/* Draw new signature */}
                <div className="pdf-ws-prop-section">
                    <SectionTitle>
                        <EditOutlined style={{ marginRight: 4 }} />
                        Draw New Signature
                    </SectionTitle>
                    <Button
                        icon={<EditOutlined />}
                        block
                        onClick={onOpenSignaturePad}
                        style={{ borderRadius: 8 }}
                    >
                        Create Signature
                    </Button>
                </div>
            </div>
        </div>
    );
}
