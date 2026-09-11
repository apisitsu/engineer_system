import React from 'react';
import { Tag, Space, Typography, Tooltip, Button, Modal } from 'antd';
import { FilterOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CASE_TAG_MAP } from '../../constants/caseTypes';
import { MultiSelectFilterDropdown } from './filters/MultiSelectFilterDropdown';
import { DateRangeFilterDropdown } from './filters/DateRangeFilterDropdown';

const { Text } = Typography;

export function getTableColumns({ theme, permissions, isViewer, finishRecord, message }) {
    return [
        {
            title: 'No.',
            dataIndex: 'record_no',
            key: 'record_no',
            width: 70,
            fixed: 'left',
            sorter: true,
            render: (val) => <Text strong style={{ color: theme.colors.textPrimary }}>{val}</Text>,
        },
        {
            title: 'Date',
            dataIndex: 'request_date',
            key: 'request_date',
            width: 100,
            sorter: true,
            filterDropdown: (props) => <DateRangeFilterDropdown {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            render: (val) => (val ? dayjs(val).format('DD/MM/YY') : '—'),
        },
        {
            title: 'Lot No.',
            dataIndex: 'lot_no',
            key: 'lot_no',
            width: 110,
            sorter: true,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="lot_no" {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            render: (val) => (
                <Text copyable={{ text: val }} style={{ fontSize: 12 }}>
                    {val || '—'}
                </Text>
            ),
        },
        {
            title: 'CN',
            dataIndex: 'cn',
            key: 'cn',
            width: 90,
            sorter: true,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="cn" {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
        },
        {
            title: 'PN',
            dataIndex: 'pn',
            key: 'pn',
            width: 180,
            ellipsis: true,
            render: (val) => (
                <Tooltip title={val}>
                    <Text style={{ fontSize: 12 }}>{val || '—'}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'Case',
            dataIndex: 'case_type',
            key: 'case_type',
            width: 120,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="case_type" {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            render: (val) => {
                const cfg = CASE_TAG_MAP[val] || { color: 'default', short: val };
                return <Tag color={cfg.color} className="engr-case-tag">{cfg.short}</Tag>;
            },
        },
        {
            title: 'Spec / Problem',
            dataIndex: 'spec_problem',
            key: 'spec_problem',
            width: 200,
            ellipsis: true,
            render: (val) => (
                <Tooltip title={val}>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                        {val || '—'}
                    </Text>
                </Tooltip>
            ),
        },
        {
            title: 'Judge / Revise',
            dataIndex: 'judge_revise',
            key: 'judge_revise',
            width: 180,
            ellipsis: true,
            render: (val) => (
                <Tooltip title={val}>
                    <Text style={{ fontSize: 12 }}>{val || '—'}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'Responsible',
            dataIndex: 'responsible',
            key: 'responsible',
            width: 120,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="responsible" {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            render: (val) => <Text style={{ fontSize: 12 }}>{val || '—'}</Text>,
        },
        {
            title: 'Judgment By',
            dataIndex: 'judgment_by',
            key: 'judgment_by',
            width: 100,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="judgment_by" {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
        },
        {
            title: 'Wait (d)',
            dataIndex: 'waiting_time_days',
            key: 'waiting_time_days',
            width: 80,
            align: 'right',
            sorter: true,
            render: (val) => {
                if (val === null || val === undefined) return '—';
                const color =
                    val > 30 ? '#f5222d' : val > 14 ? '#fa8c16' : theme.colors.textPrimary;
                return (
                    <Text strong style={{ color, fontSize: 12 }}>
                        {val}
                    </Text>
                );
            },
        },
        {
            title: 'Finish',
            dataIndex: 'finish_date',
            key: 'finish_date',
            width: 100,
            sorter: true,
            filterDropdown: (props) => <DateRangeFilterDropdown {...props} />,
            filterIcon: (filtered) => (
                <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
            ),
            render: (val, record) =>
                val ? (
                    <Text style={{ color: '#52c41a', fontSize: 12 }}>
                        {dayjs(val).format('DD/MM/YY')}
                    </Text>
                ) : (
                    <Space>
                        <Tag color="warning" style={{ fontSize: 10 }}>Pending</Tag>
                        {!isViewer && permissions?.canFinish && (
                            <Button
                                size="small"
                                type="primary"
                                icon={<CheckOutlined />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    Modal.confirm({
                                        title: 'Mark as Finished?',
                                        content:
                                            'This will set the finish date to today and calculate the due status.',
                                        onOk: () =>
                                            finishRecord(record.id).then(() =>
                                                message.success('Finished')
                                            ),
                                    });
                                }}
                            />
                        )}
                    </Space>
                ),
        },
        {
            title: 'T/S Flag',
            dataIndex: 'ts_flag',
            key: 'ts_flag',
            width: 130,
            render: (val) => {
                if (!val) return '—';
                let color = 'default';
                if (val === 'ALRD PASS DUE' || val === 'PASS DUE' || val === 'Too sad :(') {
                    color = 'error';
                } else if (val === 'ON DUE') {
                    color = 'success';
                } else if (val === "You're so fast! :D") {
                    color = 'processing';
                }

                return <Tag color={color} style={{ fontSize: 10 }}>{val}</Tag>;
            },
        },
        {
            title: 'Plan Start',
            dataIndex: 'plan_start_date',
            key: 'plan_start_date',
            width: 100,
            render: (val) => (val ? dayjs(val).format('DD/MM/YY') : '—'),
        },
        {
            title: 'Remark',
            dataIndex: 'remark',
            key: 'remark',
            width: 140,
            ellipsis: true,
            render: (val) => (
                <Tooltip title={val}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>
                        {val || ''}
                    </Text>
                </Tooltip>
            ),
        },
    ];
}

export default getTableColumns;
