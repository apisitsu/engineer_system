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
        <div style={{ padding: '8px 0' }}>
            <Timeline mode="left">
                {events.map(ev => {
                    if (ev.type === 'ACTION') {
                        const log = ev.data;
                        const isRmd = log.action === 'REQUEST_MORE_DETAIL';

                        return (
                            <Timeline.Item 
                                key={ev.id}
                                color={log.action === 'DENY' ? 'red' : (isRmd ? 'orange' : (log.action === 'APPROVE' ? 'green' : 'blue'))}
                                label={
                                    <div style={{ textAlign: 'right', paddingRight: 10 }}>
                                        <Text strong style={{ fontSize: 12 }}>{moment(ev.time).format('DD-MMM-YYYY')}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{moment(ev.time).format('HH:mm:ss')}</div>
                                    </div>
                                }
                            >
                                <Card 
                                    size="small" 
                                    style={{ 
                                        borderRadius: 8, 
                                        border: isRmd ? '1px solid #ffd591' : '1px solid #f0f0f0',
                                        background: isRmd ? '#fffbe6' : '#ffffff',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Space>
                                            <Text strong style={{ color: '#1890ff' }}>{log.step_label || 'Workflow Action'}</Text>
                                            {getActionTag(log.action)}
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            By <Text strong>{log.action_by_name}</Text> ({log.action_role || 'Staff'})
                                        </Text>
                                    </div>

                                    {log.comment && (
                                        <Paragraph style={{ marginTop: 6, marginBottom: 4, color: '#595959', fontSize: 12 }}>
                                            "{log.comment}"
                                        </Paragraph>
                                    )}

                                    {log.request_to_requester && (
                                        <div style={{ marginTop: 6, padding: 6, background: '#fff2e8', borderRadius: 4, border: '1px solid #ffbb96' }}>
                                            <Text type="warning" strong style={{ fontSize: 12 }}>
                                                ⚠️ Required Modifications: {log.request_to_requester}
                                            </Text>
                                        </div>
                                    )}

                                    {log.deny_reason && (
                                        <div style={{ marginTop: 6, padding: 6, background: '#fff1f0', borderRadius: 4, border: '1px solid #ffa39e' }}>
                                            <Text type="danger" strong style={{ fontSize: 12 }}>
                                                ❌ Denial Justification: {log.deny_reason}
                                            </Text>
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
                                label={
                                    <div style={{ textAlign: 'right', paddingRight: 10 }}>
                                        <Text strong style={{ fontSize: 12 }}>{moment(ev.time).format('DD-MMM-YYYY')}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{moment(ev.time).format('HH:mm:ss')}</div>
                                    </div>
                                }
                            >
                                <Card size="small" style={{ borderRadius: 8, background: '#f9f0ff', border: '1px solid #d3adf7' }}>
                                    <Space>
                                        <EditOutlined style={{ color: '#722ed1' }} />
                                        <Text strong style={{ color: '#722ed1' }}>Field Modified: <Tag color="purple">{diff.field_name}</Tag></Text>
                                        <Text type="secondary" style={{ fontSize: 11 }}>by {diff.modified_by_name}</Text>
                                    </Space>
                                    <div style={{ marginTop: 6, fontSize: 12 }}>
                                        <div style={{ textDecoration: 'line-through', color: '#ff4d4f' }}>
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
