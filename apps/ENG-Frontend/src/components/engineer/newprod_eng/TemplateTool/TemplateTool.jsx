import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Select, Tag, Input, message, Card, Space, Typography, Empty, Layout, Divider } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, SearchOutlined, DeleteOutlined, ExclamationCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import { useNavigate } from 'react-router-dom';

import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text } = Typography;
const { confirm } = Modal;
const { Content } = Layout;

const FORM_TYPES = [
    { value: 'pid', label: 'Project Initiation Document (PID)', color: '#722ed1', icon: '📄', desc: 'A4 Portrait — APQP phase checklist' },
    { value: 'pdr', label: 'Product Design Review (PDR)', color: '#13c2c2', icon: '🔍', desc: 'A4 Landscape — Specification applicability review' },
    { value: 'pfd', label: 'Process Flow Diagram (PFD)', color: '#52c41a', icon: '🔀', desc: 'A4 Landscape — Process flow with KC/SP characteristics' },
    { value: 'pfmea', label: 'Process FMEA (PFMEA)', color: '#fa8c16', icon: '⚠️', desc: 'A2 Landscape — Risk analysis with AIAG-VDA RPN' },
    { value: 'control_plan', label: 'Control Plan', color: '#1677ff', icon: '📋', desc: 'A3 Landscape — Process control specifications' },
];

export default function TemplateTool({ onBack }) {
    const { empNo } = useAuthStore();
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedFormType, setSelectedFormType] = useState('');

    const navigate = useNavigate();
    const { theme } = useTheme();

    const loadForms = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = {};
            if (filterType) params.form_type = filterType;
            if (filterStatus) params.status = filterStatus;
            if (search) params.search = search;

            const res = await axios.get(server.TT_FORMS, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            if (res.data.result === 'true') setForms(res.data.data || []);
        } catch (err) {
            console.error('Load forms error:', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadForms(); }, [filterType, filterStatus, search]);

    const handleCreate = async () => {
        if (!selectedFormType) return message.warning('Please select a form type');
        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(server.TT_FORMS, {
                form_type: selectedFormType,
                created_by: empNo,
            }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.result === 'true') {
                message.success('Form created');
                setCreateModalOpen(false);
                setSelectedFormType('');
                navigate(`/eng/template_tool/${selectedFormType}/${res.data.data.id}`);
            }
        } catch (err) {
            message.error('Failed to create form');
        }
    };

    const handleDelete = (record) => {
        confirm({
            title: 'Delete this form?',
            icon: <ExclamationCircleOutlined />,
            content: `This will soft-delete "${record.form_type}" form #${record.id}.`,
            okText: 'Delete',
            okType: 'danger',
            async onOk() {
                try {
                    const token = localStorage.getItem('token');
                    await axios.delete(`${server.TT_FORMS}/${record.id}`, { headers: { Authorization: `Bearer ${token}` } });
                    message.success('Form deleted');
                    loadForms();
                } catch (err) { message.error('Delete failed'); }
            }
        });
    };

    const columns = [
        {
            title: 'ID', dataIndex: 'id', width: 60, sorter: (a, b) => a.id - b.id, fixed: 'left'
        },
        {
            title: 'Form No.', dataIndex: 'form_number', width: 140, fixed: 'left'
        },
        { title: 'PID Number', dataIndex: 'pid_number', width: 140 },
        {
            title: 'Form Type', dataIndex: 'form_type', width: 220,
            render: (v) => {
                const ft = FORM_TYPES.find(t => t.value === v);
                return ft ? <span>{ft.icon} {ft.label}</span> : v;
            },
            filters: FORM_TYPES.map(t => ({ text: t.label, value: t.value })),
            onFilter: (value, record) => record.form_type === value,
        },
        { title: 'Customer P/N', dataIndex: 'customer_pn', width: 140 },
        {
            title: 'Status', dataIndex: 'status', width: 120,
            render: (v) => <Tag color={v === 'Approved' ? 'green' : 'blue'}>{v}</Tag>,
        },
        { title: 'Created By', dataIndex: 'created_by', width: 130 },
        {
            title: 'Last Modified', dataIndex: 'updated_at', width: 180,
            render: (v) => v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            sorter: (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
            defaultSortOrder: 'descend',
        },
        {
            title: 'Action', width: 90, fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Button size="small" type="primary" icon={<FolderOpenOutlined />} onClick={() => navigate(`/eng/template_tool/${record.form_type}/${record.id}`)} title="Open Form" />
                    {record.status !== 'Approved' && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} title="Delete Form" />}
                </Space>
            ),
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex' }}>
            <style>{`
                #template-tool-table .ant-table-cell-fix-left,
                #template-tool-table .ant-table-cell-fix-right {
                    background-color: ${theme.colors.surface} !important;
                }
                #template-tool-table .ant-table-thead > tr > th.ant-table-cell-fix-left,
                #template-tool-table .ant-table-thead > tr > th.ant-table-cell-fix-right {
                    background-color: ${theme.colors.hover} !important;
                }
                #template-tool-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-left,
                #template-tool-table .ant-table-tbody > tr:hover > td.ant-table-cell-fix-right {
                    background-color: ${theme.colors.surfaceHover || '#fafafa'} !important;
                }
            `}</style>
            <MenuTemplate type={"NewProd"} defaultSelectedKeys={"1"} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="kb-vscroll" style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '24px',
                    position: 'relative'
                }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        <div style={{ background: theme.colors.surface, borderRadius: '16px', padding: '24px', boxShadow: theme.shadows.sm }}>

                            {/* Header Section */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: '24px',
                                marginBottom: '24px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack} />}
                                    <div>
                                        <Title level={3} style={{ margin: 0, color: theme.colors.textPrimary }}>📋 Template Tool</Title>
                                        <Text style={{ color: theme.colors.textSecondary }}>Manage APQP documents — PID, PDR, PFD, PFMEA, Control Plans</Text>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreateModalOpen(true)}>
                                        Create New Form
                                    </Button>
                                </div>
                            </div>

                            <div style={{ height: 1, background: '#f0f0f0', margin: '0 0 24px 0' }} />

                            {/* Filters */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                                <Input placeholder="Search PID, Customer P/N, NMB P/N..." prefix={<SearchOutlined />} style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
                                <Select placeholder="Form Type" style={{ width: 200 }} value={filterType || undefined} onChange={v => setFilterType(v || '')} allowClear options={FORM_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))} />
                                <Select placeholder="Status" style={{ width: 140 }} value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')} allowClear options={[{ value: 'In Progress', label: '🔵 In Progress' }, { value: 'Approved', label: '🟢 Approved' }]} />
                            </div>

                            {/* Table */}
                            <Table
                                id="template-tool-table"
                                columns={columns.map(col => ({ ...col, align: 'center' }))}
                                dataSource={forms}
                                rowKey="id"
                                loading={loading}
                                scroll={{ x: 'max-content' }}
                                pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `Total ${t} forms` }}
                                locale={{ emptyText: <Empty description="No forms yet. Click 'Create New Form' to start." /> }}
                                onRow={(record) => ({
                                    onDoubleClick: () => navigate(`/eng/template_tool/${record.form_type}/${record.id}`),
                                    style: { cursor: 'pointer' },
                                })}
                            />
                        </div>
                    </div>
                </Content>
            </Layout>

            {/* Create Modal */}
            <Modal title="Create New Form" open={createModalOpen} onCancel={() => { setCreateModalOpen(false); setSelectedFormType(''); }} onOk={handleCreate} okText="Create" width={600}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                    {FORM_TYPES.map(ft => (
                        <Card key={ft.value} size="small" hoverable
                            onClick={() => setSelectedFormType(ft.value)}
                            style={{ border: selectedFormType === ft.value ? `2px solid ${ft.color}` : '1px solid #d9d9d9', background: selectedFormType === ft.value ? `${ft.color}08` : '#fff', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 28 }}>{ft.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>{ft.label}</div>
                                    <div style={{ color: '#888', fontSize: 12 }}>{ft.desc}</div>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </Modal>
        </Layout>
    );
}
