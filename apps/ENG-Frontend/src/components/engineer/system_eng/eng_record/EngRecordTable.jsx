import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Table, Input, Button, Tag, Space, Typography, DatePicker, Checkbox,
    Select, InputNumber, Tooltip, Row, Col, App, Dropdown, Menu, Modal
} from 'antd';
import {
    SearchOutlined, FilterOutlined, PlusOutlined,
    ReloadOutlined, ClearOutlined, ThunderboltOutlined,
    CheckOutlined, MailOutlined, DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTheme } from '../../../../theme';
import useEngRecordStore from '../../../../stores/engRecordStore';
import engRecordApi from '../../../../api/engRecordApi';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// ─── Case Type Tag Colors ──────────────────────────────────

const CASE_TAG_MAP = {
    'Request Drawing': { color: 'blue', short: 'Drawing' },
    'Judgment Spec': { color: 'purple', short: 'Judgment' },
    'Request change DWG/Traveler': { color: 'orange', short: 'Change DWG' },
    'DWG/Traveler Problem': { color: 'red', short: 'Problem' },
    'Special': { color: 'cyan', short: 'Special' },
};

// ─── Custom Filter Dropdown Component ──────────────────────

function MultiSelectFilterDropdown({ column, setSelectedKeys, selectedKeys, confirm, clearFilters }) {
    const [options, setOptions] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        engRecordApi.getFilterOptions(column)
            .then(res => {
                if (mounted) setOptions(res.data || []);
            })
            .catch(() => { })
            .finally(() => { if (mounted) setLoading(false); });
        return () => { mounted = false; };
    }, [column]);

    const filtered = options.filter(o =>
        String(o.value).toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="engr-filter-dropdown" onKeyDown={e => e.stopPropagation()}>
            <Input
                placeholder="Search..."
                size="small"
                value={search}
                onChange={e => setSearch(e.target.value)}
                prefix={<SearchOutlined />}
                style={{ marginBottom: 8 }}
                allowClear
            />
            <Checkbox.Group
                value={selectedKeys}
                onChange={vals => setSelectedKeys(vals)}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}
            >
                {loading ? (
                    <Text type="secondary" style={{ fontSize: 12, padding: 4 }}>Loading...</Text>
                ) : filtered.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12, padding: 4 }}>No options</Text>
                ) : (
                    filtered.map(o => (
                        <Checkbox key={o.value} value={o.value} style={{ fontSize: 12 }}>
                            {o.value} <Text type="secondary">({o.count})</Text>
                        </Checkbox>
                    ))
                )}
            </Checkbox.Group>
            <div className="engr-filter-actions">
                <Button type="link" size="small" onClick={() => { clearFilters?.(); confirm(); }}>
                    Reset
                </Button>
                <Button type="primary" size="small" onClick={() => confirm()}>
                    OK
                </Button>
            </div>
        </div>
    );
}

// ─── Date Range Filter ─────────────────────────────────────

function DateRangeFilterDropdown({ setSelectedKeys, selectedKeys, confirm, clearFilters }) {
    const value = selectedKeys?.[0] && selectedKeys?.[1]
        ? [dayjs(selectedKeys[0]), dayjs(selectedKeys[1])]
        : null;

    return (
        <div className="engr-filter-dropdown" onKeyDown={e => e.stopPropagation()}>
            <RangePicker
                size="small"
                value={value}
                onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                        setSelectedKeys([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                    } else {
                        setSelectedKeys([]);
                    }
                }}
                style={{ width: '100%', marginBottom: 8 }}
            />
            <div className="engr-filter-actions">
                <Button type="link" size="small" onClick={() => { clearFilters?.(); confirm(); }}>
                    Reset
                </Button>
                <Button type="primary" size="small" onClick={() => confirm()}>
                    OK
                </Button>
            </div>
        </div>
    );
}

// ─── Conditional Number Filter ─────────────────────────────

function ConditionalFilterDropdown({ setSelectedKeys, selectedKeys, confirm, clearFilters }) {
    const [op, setOp] = useState(selectedKeys?.[0] || '>');
    const [val, setVal] = useState(selectedKeys?.[1] ?? '');

    return (
        <div className="engr-filter-dropdown" onKeyDown={e => e.stopPropagation()}>
            <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
                <Select
                    size="small"
                    value={op}
                    onChange={setOp}
                    style={{ width: 70 }}
                    options={[
                        { value: '>', label: '>' },
                        { value: '<', label: '<' },
                        { value: '=', label: '=' },
                        { value: '>=', label: '≥' },
                        { value: '<=', label: '≤' },
                    ]}
                />
                <InputNumber
                    size="small"
                    value={val}
                    onChange={setVal}
                    placeholder="Value"
                    style={{ flex: 1 }}
                />
            </Space.Compact>
            <div className="engr-filter-actions">
                <Button type="link" size="small" onClick={() => { clearFilters?.(); confirm(); }}>
                    Reset
                </Button>
                <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                        setSelectedKeys(val !== '' && val !== null ? [op, val] : []);
                        confirm();
                    }}
                >
                    OK
                </Button>
            </div>
        </div>
    );
}

// ─── Main Table Component ──────────────────────────────────

function EngRecordTable() {
    const { theme } = useTheme();
    const { message } = App.useApp();
    const globalSearch = useRef('');

    const {
        records, total, page, pageSize, loading, filters, sorter,
        fetchRecords, setPage, setPageSize, setFilters, setSorter,
        openDrawer, openFormModal, openQuickCreate, finishRecord, permissions,
    } = useEngRecordStore();

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords, page, pageSize, filters, sorter]);

    // const [pageSize, setPageSize] = useState(10);

    // ─── Build filter into API payload ─────────────────────

    const handleTableChange = useCallback((pagination, tableFilters, tableSorter) => {
        // Build structured filters
        const newFilters = {};

        for (const [key, values] of Object.entries(tableFilters)) {
            if (!values || values.length === 0) continue;

            // Date range columns
            if (['request_date', 'finish_date', 'plan_start_date'].includes(key)) {
                newFilters[key] = { type: 'daterange', dateRange: values };
            }
            // Conditional columns (waiting/finished time)
            else if (['waiting_time_days', 'finished_time_days'].includes(key)) {
                newFilters[key] = { type: 'conditional', operator: values[0], value: values[1] };
            }
            // Multi-select columns
            else {
                newFilters[key] = { type: 'multiselect', values };
            }
        }

        // Global text search
        if (globalSearch.current) {
            newFilters['spec_problem'] = { type: 'text', text: globalSearch.current };
        }

        setFilters(newFilters);

        if (tableSorter && tableSorter.field) {
            setSorter({ field: tableSorter.field, order: tableSorter.order });
        } else {
            setSorter(null);
        }

        if (pagination) {
            setPage(pagination.current);
            setPageSize(pagination.pageSize);
        }
    }, [setFilters, setSorter, setPage, setPageSize]);

    const handleGlobalSearch = (value) => {
        globalSearch.current = value;
        const newFilters = { ...filters };
        if (value) {
            newFilters['spec_problem'] = { type: 'text', text: value };
        } else {
            delete newFilters['spec_problem'];
        }
        setFilters(newFilters);
    };

    const handleClearFilters = () => {
        globalSearch.current = '';
        setFilters({});
        setSorter(null);
    };

    const handleMailView = () => {
        globalSearch.current = '';
        setFilters({
            case_type: { type: 'multiselect', values: ['Request Drawing'] },
            responsible: { type: 'conditional', operator: 'IS NULL' },
            finish_date: { type: 'conditional', operator: 'IS NULL' },
        });
        setPage(1);
    };

    const handleExportCSV = async () => {
        try {
            message.loading({ content: 'Preparing CSV...', key: 'csv-export' });
            
            // Fetch all matching records without pagination limit
            const res = await engRecordApi.getRecords({
                page: 1,
                pageSize: 100000,
                sortField: sorter?.field,
                sortOrder: sorter?.order,
                filters,
            });
            
            const exportData = res.data?.data || [];
            if (exportData.length === 0) {
                message.warning({ content: 'No records to export', key: 'csv-export' });
                return;
            }

            const headers = ['Record No', 'Date', 'Request By', 'Lot No', 'CN', 'PN', 'Case Type', 'Spec/Problem', 'Judge/Revise', 'Responsible', 'Wait (days)', 'Plan Start'];
            const csvContent = exportData.map(r => [
                r.record_no,
                r.request_date ? dayjs(r.request_date).format('DD/MM/YYYY') : '',
                r.request_by,
                r.lot_no,
                r.cn,
                r.pn,
                r.case_type,
                `"${(r.spec_problem || '').replace(/"/g, '""')}"`,
                `"${(r.judge_revise || '').replace(/"/g, '""')}"`,
                r.responsible,
                r.waiting_time_days || '',
                r.plan_start_date ? dayjs(r.plan_start_date).format('DD/MM/YYYY') : ''
            ].join(','));

            const csvText = [headers.join(','), ...csvContent].join('\n');

            // Export logic
            const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Engineer_Record_${dayjs().format('YYYYMMDD')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            message.success({ content: 'Export successful', key: 'csv-export' });
        } catch (err) {
            console.error('CSV Export Error:', err);
            message.error({ content: 'Export failed', key: 'csv-export' });
        }
    };

    // ─── Column Definitions ────────────────────────────────

    const columns = [
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
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
            render: (val) => val ? dayjs(val).format('DD/MM/YY') : '—',
        },
        {
            title: 'Lot No.',
            dataIndex: 'lot_no',
            key: 'lot_no',
            width: 110,
            sorter: true,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="lot_no" {...props} />,
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
            render: (val) => <Text copyable={{ text: val }} style={{ fontSize: 12 }}>{val || '—'}</Text>,
        },
        {
            title: 'CN',
            dataIndex: 'cn',
            key: 'cn',
            width: 90,
            sorter: true,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="cn" {...props} />,
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
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
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
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
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{val || '—'}</Text>
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
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
            render: (val) => <Text style={{ fontSize: 12 }}>{val || '—'}</Text>,
        },
        {
            title: 'Judgment By',
            dataIndex: 'judgment_by',
            key: 'judgment_by',
            width: 100,
            filterDropdown: (props) => <MultiSelectFilterDropdown column="judgment_by" {...props} />,
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
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
                const color = val > 30 ? '#f5222d' : val > 14 ? '#fa8c16' : theme.colors.textPrimary;
                return <Text strong style={{ color, fontSize: 12 }}>{val}</Text>;
            },
        },
        {
            title: 'Finish',
            dataIndex: 'finish_date',
            key: 'finish_date',
            width: 100,
            sorter: true,
            filterDropdown: (props) => <DateRangeFilterDropdown {...props} />,
            filterIcon: (filtered) => <FilterOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
            render: (val, record) => val ? (
                <Text style={{ color: '#52c41a', fontSize: 12 }}>{dayjs(val).format('DD/MM/YY')}</Text>
            ) : (
                <Space>
                    <Tag color="warning" style={{ fontSize: 10 }}>Pending</Tag>
                    {permissions?.canFinish && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<CheckOutlined />}
                            onClick={(e) => {
                                e.stopPropagation();
                                Modal.confirm({
                                    title: 'Mark as Finished?',
                                    content: 'This will set the finish date to today and calculate the due status.',
                                    onOk: () => finishRecord(record.id).then(() => message.success('Finished')),
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
                if (val === 'ALRD PASS DUE' || val === 'PASS DUE' || val === 'Too sad :(') color = 'error';
                else if (val === 'ON DUE') color = 'success';
                else if (val === "You're so fast! :D") color = 'processing';

                return <Tag color={color} style={{ fontSize: 10 }}>{val}</Tag>;
            }
        },
        {
            title: 'Plan Start',
            dataIndex: 'plan_start_date',
            key: 'plan_start_date',
            width: 100,
            render: (val) => val ? dayjs(val).format('DD/MM/YY') : '—',
        },
        {
            title: 'Remark',
            dataIndex: 'remark',
            key: 'remark',
            width: 140,
            ellipsis: true,
            render: (val) => (
                <Tooltip title={val}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{val || ''}</Text>
                </Tooltip>
            ),
        },
    ];

    return (
        <div>
            {/* ─── Toolbar ──────────────────────────────────── */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
                <Col flex="auto">
                    <Input.Search
                        placeholder="Search spec/problem, remark, comment..."
                        allowClear
                        onSearch={handleGlobalSearch}
                        prefix={<SearchOutlined />}
                        style={{ maxWidth: 400 }}
                    />
                </Col>
                <Col>
                    <Space>
                        <Tooltip title="Clear all filters">
                            <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                                Clear
                            </Button>
                        </Tooltip>
                        <Tooltip title="Refresh">
                            <Button icon={<ReloadOutlined />} onClick={fetchRecords} />
                        </Tooltip>
                        <Tooltip title="Mail View (Pending Requests)">
                            <Button icon={<MailOutlined />} onClick={handleMailView}>
                                Mail View
                            </Button>
                        </Tooltip>
                        <Tooltip title="Export to CSV">
                            <Button icon={<DownloadOutlined />} onClick={handleExportCSV} />
                        </Tooltip>
                        {permissions?.canCreate && (
                            <>
                                <Button
                                    type="dashed"
                                    icon={<ThunderboltOutlined style={{ color: '#fa8c16' }} />}
                                    onClick={openQuickCreate}
                                >
                                    Quick Create
                                </Button>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => openFormModal(null)}
                                >
                                    New Record
                                </Button>
                            </>
                        )}
                    </Space>
                </Col>
            </Row>

            {/* ─── Data Table ───────────────────────────────── */}
            <div className="engr-table-wrapper">
                <Table
                    dataSource={records}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    size="small"
                    bordered
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        pageSizeOptions: ['5', '10', '25', '50', '100', '200'],
                        showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} records`,
                        size: 'small',
                    }}
                    onChange={handleTableChange}
                    onRow={(record) => ({
                        onClick: () => openDrawer(record),
                    })}
                    rowClassName={(record) => record.finish_date ? 'engr-row-finished' : ''}
                    style={{
                        background: theme.colors.card,
                        borderRadius: 12,
                    }}
                />
            </div>
        </div>
    );
}

export default EngRecordTable;
