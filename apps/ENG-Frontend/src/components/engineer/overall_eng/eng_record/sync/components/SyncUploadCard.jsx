import React from 'react';
import { Card, Upload } from 'antd';
import { SyncOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';

const { Dragger } = Upload;

export function SyncUploadCard({
    syncLoading,
    uploadProps,
    lastResult,
}) {
    const { theme } = useTheme();

    return (
        <Card
            style={{
                background: theme.colors.card,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: 16,
                marginBottom: 24,
            }}
        >
            <Dragger
                {...uploadProps}
                className="engr-sync-dragger"
                disabled={syncLoading}
                style={{ borderRadius: 12 }}
            >
                <p className="ant-upload-drag-icon">
                    {syncLoading ? (
                        <SyncOutlined
                            spin
                            style={{ fontSize: 48, color: theme.colors.primary }}
                        />
                    ) : (
                        <FileExcelOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                    )}
                </p>
                <p className="ant-upload-text" style={{ color: theme.colors.textPrimary }}>
                    {syncLoading ? 'Syncing...' : 'Click or drag Excel file here'}
                </p>
                <p className="ant-upload-hint" style={{ color: theme.colors.textSecondary }}>
                    Supports .xlsx, .xlsm, .xls (Max 50MB)
                </p>
            </Dragger>

            {/* Sync Result */}
            {lastResult && (
                <div className="engr-sync-result" style={{ marginTop: 20 }}>
                    <div
                        className="engr-sync-stat"
                        style={{ background: 'rgba(82, 196, 26, 0.08)' }}
                    >
                        <div className="value" style={{ color: '#52c41a' }}>
                            {lastResult.created}
                        </div>
                        <div className="label">Created</div>
                    </div>
                    <div
                        className="engr-sync-stat"
                        style={{ background: 'rgba(22, 119, 255, 0.08)' }}
                    >
                        <div className="value" style={{ color: '#1677ff' }}>
                            {lastResult.updated}
                        </div>
                        <div className="label">Updated</div>
                    </div>
                    <div
                        className="engr-sync-stat"
                        style={{ background: 'rgba(140, 140, 140, 0.08)' }}
                    >
                        <div className="value" style={{ color: '#8c8c8c' }}>
                            {lastResult.skipped}
                        </div>
                        <div className="label">Unchanged</div>
                    </div>
                    <div
                        className="engr-sync-stat"
                        style={{ background: 'rgba(114, 46, 209, 0.08)' }}
                    >
                        <div className="value" style={{ color: '#722ed1' }}>
                            {lastResult.total}
                        </div>
                        <div className="label">Total Rows</div>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default SyncUploadCard;
