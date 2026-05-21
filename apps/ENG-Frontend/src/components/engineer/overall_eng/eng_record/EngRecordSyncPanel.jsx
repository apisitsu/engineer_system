import React, { useEffect, useState } from 'react';
import {
    Card, Upload, Button, Typography, Table, Tag, Space,
    Row, Col, App, Alert,
} from 'antd';
import {
    UploadOutlined, SyncOutlined,
    CheckCircleOutlined, CloseCircleOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTheme } from '../../../../theme';
import useEngRecordStore from '../../../../stores/engRecordStore';

const { Title, Text } = Typography;
const { Dragger } = Upload;

function EngRecordSyncPanel() {
    const { theme } = useTheme();
    const { message: msgApi } = App.useApp();
    const { syncLogs, syncLoading, syncFromExcel, fetchSyncLogs } = useEngRecordStore();
    const [lastResult, setLastResult] = useState(null);

    useEffect(() => {
        fetchSyncLogs();
    }, [fetchSyncLogs]);

    const handleUpload = async (info) => {
        const file = info.file;
        try {
            const result = await syncFromExcel(file);
            setLastResult(result);
            msgApi.success(`Sync completed: ${result.created} created, ${result.updated} updated, ${result.skipped} unchanged`);
        } catch (err) {
            msgApi.error('Sync failed: ' + (err.response?.data?.error || err.message));
        }
    };

    const uploadProps = {
        name: 'file',
        accept: '.xlsx,.xlsm,.xls',
        multiple: false,
        showUploadList: false,
        customRequest: ({ file }) => handleUpload({ file }),
        beforeUpload: (file) => {
            const isExcel = file.name.match(/\.(xlsx|xlsm|xls)$/i);
            if (!isExcel) {
                msgApi.error('Only Excel files (.xlsx, .xlsm, .xls) are accepted');
                return Upload.LIST_IGNORE;
            }
            if (file.size > 50 * 1024 * 1024) {
                msgApi.error('File must be smaller than 50MB');
                return Upload.LIST_IGNORE;
            }
            return true;
        },
    };

    const logColumns = [
        {
            title: 'Date',
            dataIndex: 'started_at',
            key: 'started_at',
            width: 160,
            render: (v) => dayjs(v).format('DD/MM/YY HH:mm'),
        },
        {
            title: 'File',
            dataIndex: 'file_name',
            key: 'file_name',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (v) => {
                const map = {
                    completed: { color: 'success', icon: <CheckCircleOutlined /> },
                    running: { color: 'processing', icon: <SyncOutlined spin /> },
                    failed: { color: 'error', icon: <CloseCircleOutlined /> },
                    pending: { color: 'default', icon: <SyncOutlined /> },
                };
                const cfg = map[v] || map.pending;
                return <Tag color={cfg.color} icon={cfg.icon}>{v}</Tag>;
            },
        },
        {
            title: 'Created',
            dataIndex: 'records_created',
            key: 'records_created',
            width: 80,
            align: 'right',
            render: (v) => <Text style={{ color: '#52c41a' }}>{v || 0}</Text>,
        },
        {
            title: 'Updated',
            dataIndex: 'records_updated',
            key: 'records_updated',
            width: 80,
            align: 'right',
            render: (v) => <Text style={{ color: '#1677ff' }}>{v || 0}</Text>,
        },
        {
            title: 'Skipped',
            dataIndex: 'records_skipped',
            key: 'records_skipped',
            width: 80,
            align: 'right',
            render: (v) => <Text type="secondary">{v || 0}</Text>,
        },
        {
            title: 'Total',
            dataIndex: 'records_total',
            key: 'records_total',
            width: 80,
            align: 'right',
            render: (v) => <Text strong>{v || 0}</Text>,
        },
    ];

    return (
        <div>
            <Title level={4} style={{ color: theme.colors.textPrimary, marginBottom: 16 }}>
                Data Synchronization
            </Title>

            <Alert
                message="Excel File Sync"
                description="Upload the Engineer Record Excel file (.xlsm/.xlsx) to synchronize data. Empty rows are automatically skipped. Existing records are updated only when data changes (hash-based dedup)."
                type="info"
                showIcon
                style={{ marginBottom: 24, borderRadius: 12 }}
            />

            {/* ─── Upload Area ──────────────────────────────── */}
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
                            <SyncOutlined spin style={{ fontSize: 48, color: theme.colors.primary }} />
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

                {/* ─── Sync Result ──────────────────────────── */}
                {lastResult && (
                    <div className="engr-sync-result" style={{ marginTop: 20 }}>
                        <div className="engr-sync-stat" style={{ background: 'rgba(82, 196, 26, 0.08)' }}>
                            <div className="value" style={{ color: '#52c41a' }}>{lastResult.created}</div>
                            <div className="label">Created</div>
                        </div>
                        <div className="engr-sync-stat" style={{ background: 'rgba(22, 119, 255, 0.08)' }}>
                            <div className="value" style={{ color: '#1677ff' }}>{lastResult.updated}</div>
                            <div className="label">Updated</div>
                        </div>
                        <div className="engr-sync-stat" style={{ background: 'rgba(140, 140, 140, 0.08)' }}>
                            <div className="value" style={{ color: '#8c8c8c' }}>{lastResult.skipped}</div>
                            <div className="label">Unchanged</div>
                        </div>
                        <div className="engr-sync-stat" style={{ background: 'rgba(114, 46, 209, 0.08)' }}>
                            <div className="value" style={{ color: '#722ed1' }}>{lastResult.total}</div>
                            <div className="label">Total Rows</div>
                        </div>
                    </div>
                )}
            </Card>

            {/* ─── Sync History ─────────────────────────────── */}
            <Card
                title={
                    <Space>
                        <SyncOutlined />
                        <span>Sync History</span>
                    </Space>
                }
                style={{
                    background: theme.colors.card,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: 16,
                }}
            >
                <Table
                    dataSource={syncLogs}
                    columns={logColumns}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10, size: 'small' }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>
        </div>
    );
}

export default EngRecordSyncPanel;
