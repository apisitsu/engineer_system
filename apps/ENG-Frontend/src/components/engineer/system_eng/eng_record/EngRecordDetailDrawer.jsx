import React from 'react';
import { Drawer, Typography, Tag, Divider, Descriptions, Space, Button, App } from 'antd';
import { EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTheme } from '../../../../theme';
import useEngRecordStore from '../../../../stores/engRecordStore';

const { Title, Text, Paragraph } = Typography;

const CASE_TAG_MAP = {
    'Request Drawing': { color: 'blue' },
    'Judgment Spec': { color: 'purple' },
    'Request change DWG/Traveler': { color: 'orange' },
    'DWG/Traveler Problem': { color: 'red' },
    'Special': { color: 'cyan' },
};

function EngRecordDetailDrawer() {
    const { theme } = useTheme();
    const { modal, message } = App.useApp();
    const {
        selectedRecord: record,
        drawerOpen,
        closeDrawer,
        openFormModal,
        deleteRecord,
        finishRecord,
        permissions,
    } = useEngRecordStore();

    if (!record) return null;

    const formatDate = (val) => val ? dayjs(val).format('DD MMM YYYY') : '—';

    const handleDelete = () => {
        modal.confirm({
            title: 'Delete Record',
            content: `Are you sure you want to delete record #${record.record_no}?`,
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await deleteRecord(record.id);
                    message.success('Record deleted');
                    closeDrawer();
                } catch (err) {
                    message.error('Delete failed: ' + (err.response?.data?.error || err.message));
                }
            },
        });
    };

    return (
        <Drawer
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
                    <Title level={5} style={{ margin: 0, color: theme.colors.textPrimary, whiteSpace: 'nowrap' }}>
                        Record #{record.record_no}
                    </Title>
                    <Tag color={CASE_TAG_MAP[record.case_type]?.color || 'default'} style={{ whiteSpace: 'nowrap' }}>
                        {record.case_type}
                    </Tag>
                </div>
            }
            placement="right"
            width={520}
            open={drawerOpen}
            onClose={closeDrawer}
            footer={
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    {permissions?.canDelete && (
                        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                            Delete
                        </Button>
                    )}
                    {permissions?.canUpdate && (
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => { closeDrawer(); openFormModal(record); }}
                        >
                            Edit
                        </Button>
                    )}
                    {permissions?.canFinish && !record.finish_date && (
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={() => {
                                modal.confirm({
                                    title: 'Mark as Finished?',
                                    content: 'This will set the finish date to today and calculate the due status.',
                                    onOk: async () => {
                                        try {
                                            await finishRecord(record.id);
                                            message.success('Record finished');
                                            closeDrawer();
                                        } catch (err) {
                                            message.error('Operation failed: ' + (err.response?.data?.error || err.message));
                                        }
                                    }
                                });
                            }}
                        >
                            Finish
                        </Button>
                    )}
                </div>
            }
        >
            {/* ─── Request Info ──────────────────────────────── */}
            <div className="engr-detail-section">
                <div className="engr-detail-section-title" style={{ color: theme.colors.primary }}>
                    Request Information
                </div>
                <Descriptions column={2} size="small" colon={false}>
                    <Descriptions.Item label="Date">{formatDate(record.request_date)}</Descriptions.Item>
                    <Descriptions.Item label="Request By">{record.request_by || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Lot No.">{record.lot_no || '—'}</Descriptions.Item>
                    <Descriptions.Item label="CN">{record.cn || '—'}</Descriptions.Item>
                    <Descriptions.Item label="PN" span={2}>{record.pn || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Plant">{record.plant || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Case Type">
                        <Tag color={CASE_TAG_MAP[record.case_type]?.color}>{record.case_type}</Tag>
                    </Descriptions.Item>
                </Descriptions>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* ─── Problem & Judgment ───────────────────────── */}
            <div className="engr-detail-section">
                <div className="engr-detail-section-title" style={{ color: '#722ed1' }}>
                    Specification / Judgment
                </div>
                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Spec / Problem</Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.spec_problem || '—'}
                    </Paragraph>
                </div>
                <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Judge / Revise</Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.judge_revise || '—'}
                    </Paragraph>
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Reason</Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.reason || '—'}
                    </Paragraph>
                </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* ─── Assignment & Timeline ────────────────────── */}
            <div className="engr-detail-section">
                <div className="engr-detail-section-title" style={{ color: '#fa8c16' }}>
                    Assignment & Timeline
                </div>
                <Descriptions column={2} size="small" colon={false}>
                    <Descriptions.Item label="Judgment By">{record.judgment_by || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Responsible">{record.responsible || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Finish Date">
                        {record.finish_date ? (
                            <Text style={{ color: '#52c41a' }}>{formatDate(record.finish_date)}</Text>
                        ) : (
                            <Tag color="warning">Pending</Tag>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Plan Start">{formatDate(record.plan_start_date)}</Descriptions.Item>
                    <Descriptions.Item label="Waiting (days)">
                        {record.waiting_time_days != null ? (
                            <Text strong style={{
                                color: record.waiting_time_days > 30 ? '#f5222d'
                                    : record.waiting_time_days > 14 ? '#fa8c16'
                                        : theme.colors.textPrimary
                            }}>
                                {record.waiting_time_days}
                            </Text>
                        ) : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Finished (days)">
                        {record.finished_time_days != null ? record.finished_time_days : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Overtime">
                        {record.overtime_from_plan != null ? (
                            <Text style={{ color: record.overtime_from_plan > 0 ? '#f5222d' : '#52c41a' }}>
                                {record.overtime_from_plan > 0 ? '+' : ''}{record.overtime_from_plan}
                            </Text>
                        ) : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Confirm (Codi)">{record.confirm_codi || '—'}</Descriptions.Item>
                    <Descriptions.Item label="T/S Flag">
                        {record.ts_flag ? (
                            <Tag color={
                                ['ALRD PASS DUE', 'PASS DUE', 'Too sad :('].includes(record.ts_flag) ? 'error'
                                    : record.ts_flag === 'ON DUE' ? 'success'
                                        : record.ts_flag === "You're so fast! :D" ? 'processing'
                                            : 'default'
                            }>
                                {record.ts_flag}
                            </Tag>
                        ) : '—'}
                    </Descriptions.Item>
                </Descriptions>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* ─── Notes ────────────────────────────────────── */}
            <div className="engr-detail-section">
                <div className="engr-detail-section-title" style={{ color: '#13c2c2' }}>
                    Notes
                </div>
                <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Remark</Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.remark || '—'}
                    </Paragraph>
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Comment</Text>
                    <Paragraph style={{ color: theme.colors.textPrimary, margin: '4px 0 0' }}>
                        {record.comment || '—'}
                    </Paragraph>
                </div>
            </div>

            {/* ─── Audit Footer ─────────────────────────────── */}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ opacity: 0.6, fontSize: 11 }}>
                <Text type="secondary">Created: {formatDate(record.created_at)} by {record.created_by || '—'}</Text>
                <br />
                <Text type="secondary">Updated: {formatDate(record.updated_at)} by {record.updated_by || '—'}</Text>
            </div>
        </Drawer>
    );
}

export default EngRecordDetailDrawer;
