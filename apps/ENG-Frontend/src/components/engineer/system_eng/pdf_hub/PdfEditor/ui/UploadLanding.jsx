import React from 'react';
import { Spin, Typography, Upload } from 'antd';
import { FilePdfOutlined, InboxOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function UploadLanding({ pdfLoading, onFileUpload }) {
    const { theme } = useTheme();

    return (
        <Spin spinning={pdfLoading} tip="Loading PDF..." size="large">
            <div className="pdf-ws-upload-landing" style={{ background: theme.colors.background }}>
                <div className="pdf-ws-upload-card">
                    <div className="pdf-ws-upload-icon" style={{
                        background: `linear-gradient(135deg, ${theme.colors.primary}22, ${theme.colors.primary}08)`,
                        color: theme.colors.primary,
                    }}>
                        <FilePdfOutlined />
                    </div>
                    <Title level={3} style={{ margin: '0 0 8px', color: theme.colors.textPrimary }}>
                        PDF Workstation
                    </Title>
                    <Text style={{ color: theme.colors.textSecondary, fontSize: 14, display: 'block', marginBottom: 32 }}>
                        View, annotate, edit, sign, merge, and export — all in one place
                    </Text>
                    <Dragger
                        accept=".pdf,application/pdf"
                        showUploadList={false}
                        beforeUpload={onFileUpload}
                        style={{
                            borderRadius: 16, padding: '40px 24px',
                            border: `2px dashed ${theme.colors.primary}55`,
                            background: `${theme.colors.primary}04`,
                        }}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: theme.colors.primary, fontSize: 48 }} />
                        </p>
                        <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600 }}>
                            Click or drag a PDF file here
                        </p>
                        <p className="ant-upload-hint" style={{ fontSize: 13 }}>
                            Open a document to start editing, annotating, or converting
                        </p>
                    </Dragger>
                </div>
            </div>
        </Spin>
    );
}
