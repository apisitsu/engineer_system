import React from 'react';
import { Tag } from 'antd';
import {
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    ExclamationCircleOutlined,
    FileProtectOutlined,
} from '@ant-design/icons';

const statusConfig = {
    'Draft': { color: 'default', icon: <ClockCircleOutlined /> },
    'Pending Dept Mgr': { color: 'orange', icon: <SyncOutlined spin /> },
    'Impact Assessment': { color: 'blue', icon: <FileProtectOutlined /> },
    'Pending ECN Approval': { color: 'purple', icon: <SyncOutlined spin /> },
    'Top Mgmt Approval': { color: 'gold', icon: <ExclamationCircleOutlined /> },
    'DWG Suspension': { color: 'volcano', icon: <ExclamationCircleOutlined /> },
    'ECN Execution': { color: 'geekblue', icon: <SyncOutlined spin /> },
    'FAI Process': { color: 'geekblue', icon: <FileProtectOutlined /> },
    'Closed': { color: 'green', icon: <CheckCircleOutlined /> },
    'Effective': { color: 'green', icon: <CheckCircleOutlined /> },
    'Rejected': { color: 'red', icon: <CloseCircleOutlined /> },
    'Denied': { color: 'red', icon: <CloseCircleOutlined /> },
};

export default function StatusBadge({ status }) {
    if (!status) return <Tag color="default" icon={<ClockCircleOutlined />}>Unknown</Tag>;

    const config = statusConfig[status] || { color: 'cyan', icon: <SyncOutlined /> };

    return (
        <Tag color={config.color} icon={config.icon}>
            {status}
        </Tag>
    );
}
