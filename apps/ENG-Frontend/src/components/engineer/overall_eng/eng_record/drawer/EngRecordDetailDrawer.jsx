import React from 'react';
import { Drawer, Typography, Tag, Divider, Button, App } from 'antd';
import { EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTheme } from '../../../../../theme';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import { CASE_TAG_MAP } from '../constants/caseTypes';
import { RequestInfoSection } from './components/RequestInfoSection';
import { SpecJudgmentSection } from './components/SpecJudgmentSection';
import { TimelineSection } from './components/TimelineSection';
import { NotesSection } from './components/NotesSection';

const { Title } = Typography;

export function EngRecordDetailDrawer({ isViewer = false }) {
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

    const formatDate = (val) => (val ? dayjs(val).format('DD MMM YYYY') : '—');

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

    const handleFinish = () => {
        modal.confirm({
            title: 'Mark as Finished?',
            content: 'This will set the finish date to today and calculate the due status.',
            onOk: async () => {
                try {
                    await finishRecord(record.id);
                    message.success('Record finished');
                    closeDrawer();
                } catch (err) {
                    message.error(
                        'Operation failed: ' + (err.response?.data?.error || err.message)
                    );
                }
            },
        });
    };

    return (
        <Drawer
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'nowrap' }}>
                    <Title
                        level={5}
                        style={{ margin: 0, color: theme.colors.textPrimary, whiteSpace: 'nowrap' }}
                    >
                        Record #{record.record_no}
                    </Title>
                    <Tag
                        color={CASE_TAG_MAP[record.case_type]?.color || 'default'}
                        style={{ whiteSpace: 'nowrap' }}
                    >
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
                    {!isViewer && permissions?.canDelete && (
                        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                            Delete
                        </Button>
                    )}
                    {!isViewer && permissions?.canUpdate && (
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => {
                                closeDrawer();
                                openFormModal(record);
                            }}
                        >
                            Edit
                        </Button>
                    )}
                    {!isViewer && permissions?.canFinish && !record.finish_date && (
                        <Button type="primary" icon={<CheckOutlined />} onClick={handleFinish}>
                            Finish
                        </Button>
                    )}
                </div>
            }
        >
            {/* Request Info */}
            <RequestInfoSection record={record} formatDate={formatDate} />

            <Divider style={{ margin: '12px 0' }} />

            {/* Problem & Judgment */}
            <SpecJudgmentSection record={record} />

            <Divider style={{ margin: '12px 0' }} />

            {/* Assignment & Timeline */}
            <TimelineSection record={record} formatDate={formatDate} />

            <Divider style={{ margin: '12px 0' }} />

            {/* Notes & Audit */}
            <NotesSection record={record} formatDate={formatDate} />
        </Drawer>
    );
}

export default EngRecordDetailDrawer;
