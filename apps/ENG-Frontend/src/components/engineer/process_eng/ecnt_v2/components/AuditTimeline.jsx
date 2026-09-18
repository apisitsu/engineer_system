import React from 'react';
import { Timeline, Tag, Typography, Card, Space, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, EditOutlined, SyncOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Text, Paragraph } = Typography;

export default function AuditTimeline({ logs = [], fieldAudits = [] }) {
    if ((!logs || logs.length === 0) && (!fieldAudits || fieldAudits.length === 0)) {
        return <Empty description="No audit records yet." />;
    }

    // Merge logs and fieldAudits into a unified chronological stream
    const events = [];

    logs.forEach(l => {
        events.push({
            id: `log_${l.id}`,
            time: new Date(l.created_at),
            type: 'ACTION',
            data: l
        });
    });

    fieldAudits.forEach(a => {
        events.push({
            id: `audit_${a.id}`,
            time: new Date(a.modified_at),
            type: 'DIFF',
            data: a
        });
    });

    events.sort((a, b) => b.time - a.time); // Newest first

    const getActionTag = (action) => {
        switch (action) {
            case 'APPROVE':
            case 'CLOSE':
                return <Tag color="success" icon={<CheckCircleOutlined />}>{action}</Tag>;
            case 'DENY':
                return <Tag color="error" icon={<CloseCircleOutlined />}>{action}</Tag>;
            case 'REQUEST_MORE_DETAIL':
                return <Tag color="warning" icon={<ExclamationCircleOutlined />}>CLARIFICATION REQUESTED</Tag>;
            case 'RESUBMIT':
                return <Tag color="orange" icon={<SyncOutlined />}>RESUBMITTED</Tag>;
            case 'SUBMIT':
                return <Tag color="blue" icon={<CheckCircleOutlined />}>SUBMITTED</Tag>;
            default:
                return <Tag color="default">{action}</Tag>;
        }
    };

    return (
        <div style={{ padding: '12px 16px 12px 4px', maxWidth: 1200 }}>
            <Timeline style={{ marginLeft: 8 }}>
                {events.map(ev => {
                    if (ev.type === 'ACTION') {
                        const log = ev.data;
                        const isRmd = log.action === 'REQUEST_MORE_DETAIL';

                        return (
                            <Timeline.Item 
                                key={ev.id}
                                color={log.action === 'DENY' ? 'red' : (isRmd ? 'orange' : (log.action === 'APPROVE' ? 'green' : 'blue'))}
                            >
                                <Card 
                                    size="small" 
                                    style={{ 
                                        borderRadius: 8, 
                                        border: isRmd ? '1px solid #ffd591' : '1px solid #f0f0f0',
                                        background: isRmd ? '#fffbe6' : '#ffffff',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                                        marginBottom: 4
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                        <Space size={8} wrap>
                                            <Text strong style={{ color: '#1890ff', fontSize: 13 }}>{log.step_label || 'Workflow Action'}</Text>
                                            {getActionTag(log.action)}
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                by <Text strong>{log.action_by_name}</Text> ({log.action_role || 'Staff'})
                                            </Text>
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            📅 {moment(ev.time).format('DD-MMM-YYYY HH:mm:ss')}
                                        </Text>
                                    </div>

                                    {log.comment && (
                                        <Paragraph style={{ marginTop: 8, marginBottom: 4, color: '#595959', fontSize: 12 }}>
                                            "{log.comment}"
                                        </Paragraph>
                                    )}

                                    {log.request_to_requester && (
                                        <div style={{ marginTop: 8, padding: 8, background: '#fff2e8', borderRadius: 6, border: '1px solid #ffbb96' }}>
                                            <Text type="warning" strong style={{ fontSize: 12 }}>
                                                ⚠️ Clarification Request:
                                            </Text>
                                            <div style={{ marginTop: 4, fontSize: 12, color: '#d4380d' }}>
                                                {log.request_to_requester}
                                            </div>
                                        </div>
                                    )}

                                    {log.deny_reason && (
                                        <div style={{ marginTop: 8, padding: 8, background: '#fff1f0', borderRadius: 6, border: '1px solid #ffa39e' }}>
                                            <Text type="danger" strong style={{ fontSize: 12 }}>
                                                ❌ Denial Justification:
                                            </Text>
                                            <div style={{ marginTop: 4, fontSize: 12, color: '#cf1322' }}>
                                                {log.deny_reason}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            </Timeline.Item>
                        );
                    } else if (ev.type === 'DIFF') {
                        const diff = ev.data;
                        return (
                            <Timeline.Item 
                                key={ev.id}
                                color="purple"
                            >
                                <Card size="small" style={{ borderRadius: 8, background: '#f9f0ff', border: '1px solid #d3adf7', marginBottom: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                        <Space size={8}>
                                            <EditOutlined style={{ color: '#722ed1' }} />
                                            <Text strong style={{ color: '#722ed1', fontSize: 13 }}>Field Modified: <Tag color="purple">{diff.field_name}</Tag></Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>by {diff.modified_by_name}</Text>
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            📅 {moment(ev.time).format('DD-MMM-YYYY HH:mm:ss')}
                                        </Text>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 12, background: '#ffffff', padding: '8px 12px', borderRadius: 6, border: '1px solid #efdbff' }}>
                                        <div style={{ textDecoration: 'line-through', color: '#ff4d4f', marginBottom: 4 }}>
                                            Old: {diff.old_value || 'None'}
                                        </div>
                                        <div style={{ color: '#52c41a', fontWeight: 600 }}>
                                            New: {diff.new_value || 'Empty'}
                                        </div>
                                    </div>
                                </Card>
                            </Timeline.Item>
                        );
                    }
                    return null;
                })}
            </Timeline>
        </div>
    );
}
