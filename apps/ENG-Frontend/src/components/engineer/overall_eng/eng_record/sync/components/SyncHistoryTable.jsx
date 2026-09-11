import React from 'react';
import { Card, Table, Tag, Typography, Space } from 'antd';
import {
    SyncOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTheme } from '../../../../../../theme';

const { Text } = Typography;

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
            return (
                <Tag color={cfg.color} icon={cfg.icon}>
                    {v}
                </Tag>
            );
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

export function SyncHistoryTable({ syncLogs = [] }) {
    const { theme } = useTheme();

    return (
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
    );
}

export default SyncHistoryTable;
