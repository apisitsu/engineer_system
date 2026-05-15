import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Select, Tag, Input, message, Card, Space, Typography, Empty } from 'antd';
import { PlusOutlined, FileTextOutlined, ArrowLeftOutlined, SearchOutlined, DeleteOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';

import ControlPlanForm from './forms/ControlPlanForm';
import PFDForm from './forms/PFDForm';
import PFMEAForm from './forms/PFMEAForm';
import PIDForm from './forms/PIDForm';
import PDRForm from './forms/PDRForm';

import AreaVolumeCalc from './calculators/AreaVolumeCalc';
import RPNLookupCalc from './calculators/RPNLookupCalc';

const { Title, Text } = Typography;
const { confirm } = Modal;

const FORM_TYPES = [
    { value: 'pid', label: 'Project Initiation Document (PID)', color: '#722ed1', icon: '📄', desc: 'A4 Portrait — APQP phase checklist' },
    { value: 'pdr', label: 'Product Design Review (PDR)', color: '#13c2c2', icon: '🔍', desc: 'A4 Landscape — Specification applicability review' },
    { value: 'pfd', label: 'Process Flow Diagram (PFD)', color: '#52c41a', icon: '🔀', desc: 'A4 Landscape — Process flow with KC/SP characteristics' },
    { value: 'pfmea', label: 'Process FMEA (PFMEA)', color: '#fa8c16', icon: '⚠️', desc: 'A2 Landscape — Risk analysis with AIAG-VDA RPN' },
    { value: 'control_plan', label: 'Control Plan', color: '#1677ff', icon: '📋', desc: 'A3 Landscape — Process control specifications' },
];

const FORM_COMPONENTS = {
    control_plan: ControlPlanForm,
    pfd: PFDForm,
    pfmea: PFMEAForm,
    pid: PIDForm,
    pdr: PDRForm,
};

export default function TemplateTool({ onBack }) {
    const { empNo } = useAuthStore();
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [selectedFormType, setSelectedFormType] = useState('');

    // Active form editing state
    const [activeForm, setActiveForm] = useState(null); // { type, id }
    
    // Calculators
    const [calcDrawerOpen, setCalcDrawerOpen] = useState(false);
    const [activeCalc, setActiveCalc] = useState('rpn'); // 'rpn' or 'area'

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
                setActiveForm({ type: selectedFormType, id: res.data.data.id });
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
        { title: 'ID', dataIndex: 'id', width: 60, sorter: (a, b) => a.id - b.id },
        {
            title: 'Form Type', dataIndex: 'form_type', width: 200,
            render: (v) => {
                const ft = FORM_TYPES.find(t => t.value === v);
                return ft ? <span>{ft.icon} {ft.label}</span> : v;
            },
            filters: FORM_TYPES.map(t => ({ text: t.label, value: t.value })),
            onFilter: (value, record) => record.form_type === value,
        },
        { title: 'PID Number', dataIndex: 'pid_number', width: 120 },
        { title: 'Form No.', dataIndex: 'form_number', width: 120 },
        { title: 'Customer P/N', dataIndex: 'customer_pn', width: 120 },
        {
            title: 'Status', dataIndex: 'status', width: 110,
            render: (v) => <Tag color={v === 'Approved' ? 'green' : 'blue'}>{v}</Tag>,
        },
        { title: 'Created By', dataIndex: 'created_by', width: 100 },
        {
            title: 'Last Modified', dataIndex: 'updated_at', width: 160,
            render: (v) => v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            sorter: (a, b) => new Date(a.updated_at) - new Date(b.updated_at),
            defaultSortOrder: 'descend',
        },
        {
            title: 'Action', width: 140, fixed: 'right',
            render: (_, record) => (
                <Space>
                    <Button size="small" type="primary" onClick={() => setActiveForm({ type: record.form_type, id: record.id })}>Open</Button>
                    {record.status !== 'Approved' && <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />}
                </Space>
            ),
        },
    ];

    // If editing a form, render the form component fullscreen
    if (activeForm) {
        const FormComponent = FORM_COMPONENTS[activeForm.type];
        if (FormComponent) {
            return <FormComponent formId={activeForm.id} onBack={() => { setActiveForm(null); loadForms(); }} />;
        }
    }

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack} />}
                    <div>
                        <Title level={3} style={{ margin: 0 }}>📋 Template Tool</Title>
                        <Text type="secondary">Manage APQP documents — PID, PDR, PFD, PFMEA, Control Plans</Text>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <Button icon={<FileTextOutlined />} size="large" onClick={() => setCalcDrawerOpen(true)}>
                        Calculators
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setCreateModalOpen(true)}>
                        Create New Form
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <Input placeholder="Search PID, Customer P/N, NMB P/N..." prefix={<SearchOutlined />} style={{ width: 300 }} value={search} onChange={e => setSearch(e.target.value)} allowClear />
                <Select placeholder="Form Type" style={{ width: 200 }} value={filterType || undefined} onChange={v => setFilterType(v || '')} allowClear options={FORM_TYPES.map(t => ({ value: t.value, label: `${t.icon} ${t.label}` }))} />
                <Select placeholder="Status" style={{ width: 140 }} value={filterStatus || undefined} onChange={v => setFilterStatus(v || '')} allowClear options={[{ value: 'In Progress', label: '🔵 In Progress' }, { value: 'Approved', label: '🟢 Approved' }]} />
            </div>

            {/* Table */}
            <Table
                dataSource={forms}
                columns={columns}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1100 }}
                pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `Total ${t} forms` }}
                locale={{ emptyText: <Empty description="No forms yet. Click 'Create New Form' to start." /> }}
                onRow={(record) => ({
                    onDoubleClick: () => setActiveForm({ type: record.form_type, id: record.id }),
                    style: { cursor: 'pointer' },
                })}
            />

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

            {/* Calculators Drawer */}
            <Modal title="Engineering Calculators" open={calcDrawerOpen} onCancel={() => setCalcDrawerOpen(false)} footer={null} width={1000} bodyStyle={{ padding: 0 }}>
                <div style={{ display: 'flex', height: '70vh' }}>
                    <div style={{ width: 250, borderRight: '1px solid #f0f0f0', padding: 16 }}>
                        <Button block type={activeCalc === 'rpn' ? 'primary' : 'default'} onClick={() => setActiveCalc('rpn')} style={{ marginBottom: 12, textAlign: 'left' }}>RPN Action Priority</Button>
                        <Button block type={activeCalc === 'area' ? 'primary' : 'default'} onClick={() => setActiveCalc('area')} style={{ textAlign: 'left' }}>Area & Volume</Button>
                    </div>
                    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                        {activeCalc === 'rpn' && <RPNLookupCalc />}
                        {activeCalc === 'area' && <AreaVolumeCalc />}
                    </div>
                </div>
            </Modal>
        </div>
    );
}
