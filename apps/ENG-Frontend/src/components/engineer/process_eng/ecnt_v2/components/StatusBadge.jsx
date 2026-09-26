import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, SyncOutlined, ClockCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons';

const StatusBadge = ({ status }) => {
    let color = 'default';
    let icon = null;

    switch (status?.toLowerCase()) {
        case 'draft':
            color = 'default';
            break;
        case 'pending dept mgr':
        case 'pending eng mgr':
        case 'pending eng mgr ecn':
        case 'pending qc msa':
        case 'pending qc fai':
        case 'pending eng summary':
        case 'pending concern approval':
        case 'pending official close':
            color = 'processing';
            icon = <SyncOutlined spin />;
            break;
        case 'ecr only closed':
        case 'issued ecn':
        case 'transferred to ecn':
        case 'ecn effective':
            color = 'success';
            icon = <CheckCircleOutlined />;
            break;
        case 'denied':
            color = 'error';
            icon = <CloseCircleOutlined />;
            break;
        case 'require more detail':
            color = 'warning';
            icon = <WarningOutlined />;
            break;
        default:
            color = 'default';
            icon = <ClockCircleOutlined />;
    }

    return (
        <Tag 
            color={color} 
            icon={icon} 
            style={{ 
                padding: '2px 8px', 
                fontSize: '11px', 
                fontWeight: 600,
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                margin: 0
            }}
        >
            {status?.toUpperCase() || 'UNKNOWN'}
        </Tag>
    );
};

export default StatusBadge;
