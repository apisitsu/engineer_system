import React, { useState, useEffect } from 'react';
import { 
    Modal, Tabs, Form, Input, Button, Switch, Table, Space, 
    Typography, Tag, Select, App, Card, Row, Col, Alert 
} from 'antd';
import { 
    SettingOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, 
    SafetyCertificateOutlined, MailOutlined, TeamOutlined, ControlOutlined,
    UserOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const ALL_DEPTS = ['ENG', 'QA', 'QC', 'PD1', 'PD2', 'MC', 'MM', 'PC', 'TOP'];

export default function EcntSettingsModal({ open, onClose, currentConfig = {}, onConfigUpdated }) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();

    const [concernDepts, setConcernDepts] = useState([]);
    const [systemAdmins, setSystemAdmins] = useState([]);
    const [userCandidates, setUserCandidates] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Fetch registered users from backend (excluding users with nickname 'Admin')
    const fetchUserCandidates = async () => {
        setLoadingUsers(true);
        try {
            const res = await axios.get(`${server.URL}/api/ecnt/user-candidates`, { withCredentials: true });
            const list = (res.data?.data || []).filter(u => (u.u_nickname || '').toLowerCase() !== 'admin');
            setUserCandidates(list);
        } catch (err) {
            console.error("Fetch user candidates error:", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchUserCandidates();

            const assignees = currentConfig.stage_assignees || {};
            const email = currentConfig.email_settings || {};
            const depts = currentConfig.concern_depts || [];
            const admins = currentConfig.system_admins || ['admin', 'eng_mgr'];

            setConcernDepts(depts);
            setSystemAdmins(admins);

            form.setFieldsValue({
                // Eng Mgr
                eng_mgr_select: assignees.eng_mgr?.emp_no || undefined,
                eng_mgr_emp: assignees.eng_mgr?.emp_no || 'LB371',
                eng_mgr_name: assignees.eng_mgr?.name || 'Teerapol Kantapoom',
                eng_mgr_email: assignees.eng_mgr?.email || 'teerapol.k@minebea.co.th',

                // QC PIC
                qc_pic_select: assignees.default_qc_pic?.emp_no || undefined,
                qc_pic_emp: assignees.default_qc_pic?.emp_no || 'qc_admin',
                qc_pic_name: assignees.default_qc_pic?.name || 'QC User',
                qc_pic_email: assignees.default_qc_pic?.email || 'qc.pic@minebea.co.th',

                // Dept Mgr mappings
                ...ALL_DEPTS.reduce((acc, d) => {
                    const mapped = assignees.dept_mgr_mapping?.[d] || {};
                    acc[`dept_mgr_${d}_select`] = mapped.emp_no || undefined;
                    acc[`dept_mgr_${d}_emp`] = mapped.emp_no || '';
                    acc[`dept_mgr_${d}_name`] = mapped.name || '';
                    acc[`dept_mgr_${d}_email`] = mapped.email || '';
                    return acc;
                }, {}),

                // Email settings
                gas_webapp_url: email.gas_webapp_url || '',
                email_enabled: email.enabled !== false,
                notify_stages: email.notify_on_stages || [
                    'STAGE_2', 'STAGE_2_R1', 'STAGE_3', 'STAGE_4', 'STAGE_5_R1', 'STAGE_7', 'STAGE_9', 'STAGE_10'
                ]
            });
        }
    }, [open, currentConfig, form]);

    const handleSelectCandidate = (uCode, fieldPrefix) => {
        if (!uCode) {
            form.setFieldsValue({
                [`${fieldPrefix}_select`]: undefined,
                [`${fieldPrefix}_name`]: '',
                [`${fieldPrefix}_emp`]: '',
                [`${fieldPrefix}_email`]: ''
            });
            return;
        }

        const user = userCandidates.find(u => u.u_code === uCode);
        if (user) {
            const defaultEmail = user.gmail_email || `${user.u_code.toLowerCase()}@minebea.co.th`;
            form.setFieldsValue({
                [`${fieldPrefix}_select`]: user.u_code,
                [`${fieldPrefix}_name`]: user.u_name,
                [`${fieldPrefix}_emp`]: user.u_code,
                [`${fieldPrefix}_email`]: defaultEmail
            });
        }
    };

    const formatUserOptionLabel = (u) => {
        const nicknamePart = u.u_nickname ? ` "${u.u_nickname}",` : '';
        const deptPart = u.u_department ? ` - ${u.u_department}` : '';
        const rolePart = u.position || u.role ? ` [${u.position || u.role}]` : '';
        return `${u.u_name} (${u.u_code}${nicknamePart})${deptPart}${rolePart}`;
    };


    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // 1. Prepare stage_assignees payload
            const dept_mgr_mapping = {};
            ALL_DEPTS.forEach(d => {
                dept_mgr_mapping[d] = {
                    emp_no: values[`dept_mgr_${d}_emp`] || '',
                    name: values[`dept_mgr_${d}_name`] || '',
                    email: values[`dept_mgr_${d}_email`] || ''
                };
            });

            const stage_assignees = {
                dept_mgr_mapping,
                eng_mgr: {
                    emp_no: values.eng_mgr_emp,
                    name: values.eng_mgr_name,
                    email: values.eng_mgr_email
                },
                default_qc_pic: {
                    emp_no: values.qc_pic_emp,
                    name: values.qc_pic_name,
                    email: values.qc_pic_email
                }
            };

            // 2. Prepare email_settings payload
            const email_settings = {
                gas_webapp_url: values.gas_webapp_url,
                enabled: values.email_enabled,
                notify_on_stages: values.notify_stages
            };

            // Save all to backend
            await Promise.all([
                axios.post(`${server.URL}/api/ecnt/config`, {
                    key: 'stage_assignees',
                    value: stage_assignees,
                    description: 'Mapping of department managers and primary stage PICs'
                }, { withCredentials: true }),

                axios.post(`${server.URL}/api/ecnt/config`, {
                    key: 'concern_depts',
                    value: concernDepts,
                    description: 'List of concern departments and PICs for Block 9 evaluation'
                }, { withCredentials: true }),

                axios.post(`${server.URL}/api/ecnt/config`, {
                    key: 'email_settings',
                    value: email_settings,
                    description: 'Google Apps Script Web App email notification parameters'
                }, { withCredentials: true }),

                axios.post(`${server.URL}/api/ecnt/config`, {
                    key: 'system_admins',
                    value: systemAdmins,
                    description: 'Employee IDs granted administrative control over ECNT settings'
                }, { withCredentials: true })
            ]);

            antdMessage.success("ECNT System Settings saved successfully!");
            if (onConfigUpdated) {
                onConfigUpdated({
                    stage_assignees,
                    concern_depts: concernDepts,
                    email_settings,
                    system_admins: systemAdmins
                });
            }
            onClose();
        } catch (err) {
            console.error("Save config error:", err);
            antdMessage.error(err.response?.data?.error || "Failed to save settings.");
        } finally {
            setLoading(false);
        }
    };

    const handleAddConcernDept = () => {
        setConcernDepts(prev => [
            ...prev,
            { dept_code: 'NEW', dept_label: 'New Department', default_pic: '', emp_no: '', email: '', is_needed: true }
        ]);
    };

    const handleUpdateConcernDept = (index, field, value) => {
        setConcernDepts(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleDeleteConcernDept = (index) => {
        setConcernDepts(prev => prev.filter((_, i) => i !== index));
    };

    const concernDeptColumns = [
        {
            title: 'Dept Code',
            dataIndex: 'dept_code',
            width: 90,
            render: (val, record, idx) => (
                <Input 
                    value={val} 
                    onChange={e => handleUpdateConcernDept(idx, 'dept_code', e.target.value.toUpperCase())}
                    style={{ fontWeight: 600 }}
                />
            )
        },
        {
            title: 'Department Name / Label',
            dataIndex: 'dept_label',
            width: 170,
            render: (val, record, idx) => (
                <Input 
                    value={val} 
                    onChange={e => handleUpdateConcernDept(idx, 'dept_label', e.target.value)}
                />
            )
        },
        {
            title: 'Select PIC (Registered User)',
            dataIndex: 'emp_no',
            width: 220,
            render: (val, record, idx) => (
                <Select
                    size="small"
                    showSearch
                    placeholder="Choose PIC..."
                    value={val || undefined}
                    style={{ width: '100%' }}
                    allowClear
                    loading={loadingUsers}
                    onChange={(selectedEmp) => {
                        if (!selectedEmp) {
                            handleUpdateConcernDept(idx, 'emp_no', '');
                            handleUpdateConcernDept(idx, 'default_pic', '');
                            return;
                        }
                        const user = userCandidates.find(u => u.u_code === selectedEmp);
                        if (user) {
                            handleUpdateConcernDept(idx, 'emp_no', user.u_code);
                            handleUpdateConcernDept(idx, 'default_pic', user.u_name);
                            handleUpdateConcernDept(idx, 'email', user.gmail_email || `${user.u_code.toLowerCase()}@minebea.co.th`);
                        }
                    }}
                    filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={userCandidates.map(u => ({
                        value: u.u_code,
                        label: formatUserOptionLabel(u)
                    }))}
                />
            )
        },
        {
            title: 'Default PIC Name',
            dataIndex: 'default_pic',
            width: 150,
            render: (val, record, idx) => (
                <Input 
                    value={val} 
                    onChange={e => handleUpdateConcernDept(idx, 'default_pic', e.target.value)}
                />
            )
        },
        {
            title: 'Email',
            dataIndex: 'email',
            width: 180,
            render: (val, record, idx) => (
                <Input 
                    value={val} 
                    onChange={e => handleUpdateConcernDept(idx, 'email', e.target.value)}
                />
            )
        },
        {
            title: 'Needed',
            dataIndex: 'is_needed',
            width: 75,
            align: 'center',
            render: (val, record, idx) => (
                <Switch 
                    checked={!!val} 
                    onChange={checked => handleUpdateConcernDept(idx, 'is_needed', checked)} 
                    size="small" 
                />
            )
        },
        {
            title: 'Action',
            width: 60,
            align: 'center',
            render: (_, record, idx) => (
                <Button 
                    danger 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    onClick={() => handleDeleteConcernDept(idx)} 
                />
            )
        }
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={
                <Space>
                    <SettingOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>ECNT V2 System Settings & Dynamic Stage Configuration</span>
                </Space>
            }
            width={960}
            footer={[
                <Button key="cancel" onClick={onClose}>
                    Cancel
                </Button>,
                <Button 
                    key="save" 
                    type="primary" 
                    icon={<SaveOutlined />} 
                    loading={loading} 
                    onClick={handleSave}
                    style={{ background: '#1890ff', borderRadius: 6 }}
                >
                    Save System Settings
                </Button>
            ]}
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                <Tabs
                    defaultActiveKey="stage_pics"
                    items={[
                        {
                            key: 'stage_pics',
                            label: <span><TeamOutlined /> Stage PICs & Managers</span>,
                            children: (
                                <div style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: 8 }}>
                                    <Alert
                                        message="Registered Personnel Selection"
                                        description="You can select personnel directly from registered company users (test accounts with nickname 'Admin' are automatically filtered out). Selecting a user automatically populates Name, Emp No, and Email."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />

                                    {/* 1. Global Engineering & QC Assignees */}
                                    <Card 
                                        size="small" 
                                        title={<Space><UserOutlined style={{ color: '#1890ff' }} /><Text strong>Global Engineering & QC Assignees</Text></Space>} 
                                        style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        {/* Engineering Manager */}
                                        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
                                            <Row gutter={12} align="bottom">
                                                <Col xs={24} md={10}>
                                                    <Form.Item 
                                                        name="eng_mgr_select" 
                                                        label={<Text strong>Select Engineering Manager</Text>}
                                                        style={{ marginBottom: 4 }}
                                                    >
                                                        <Select
                                                            showSearch
                                                            placeholder="🔍 Pick from registered users..."
                                                            allowClear
                                                            loading={loadingUsers}
                                                            onChange={(val) => handleSelectCandidate(val, 'eng_mgr')}
                                                            filterOption={(input, option) =>
                                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                            }
                                                            options={userCandidates.map(u => ({
                                                                value: u.u_code,
                                                                label: formatUserOptionLabel(u)
                                                            }))}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={5}>
                                                    <Form.Item name="eng_mgr_name" label="Manager Name" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Full Name" />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={4}>
                                                    <Form.Item name="eng_mgr_emp" label="Emp ID" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Emp No" />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={5}>
                                                    <Form.Item name="eng_mgr_email" label="Email" rules={[{ required: true, type: 'email' }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Email" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </div>

                                        {/* Default QC PIC */}
                                        <div>
                                            <Row gutter={12} align="bottom">
                                                <Col xs={24} md={10}>
                                                    <Form.Item 
                                                        name="qc_pic_select" 
                                                        label={<Text strong>Select Default QC MSA/FAI PIC</Text>}
                                                        style={{ marginBottom: 4 }}
                                                    >
                                                        <Select
                                                            showSearch
                                                            placeholder="🔍 Pick from registered users..."
                                                            allowClear
                                                            loading={loadingUsers}
                                                            onChange={(val) => handleSelectCandidate(val, 'qc_pic')}
                                                            filterOption={(input, option) =>
                                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                            }
                                                            options={userCandidates.map(u => ({
                                                                value: u.u_code,
                                                                label: formatUserOptionLabel(u)
                                                            }))}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={5}>
                                                    <Form.Item name="qc_pic_name" label="QC PIC Name" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Full Name" />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={4}>
                                                    <Form.Item name="qc_pic_emp" label="Emp ID" rules={[{ required: true }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Emp No" />
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} md={5}>
                                                    <Form.Item name="qc_pic_email" label="Email" rules={[{ required: true, type: 'email' }]} style={{ marginBottom: 4 }}>
                                                        <Input placeholder="Email" />
                                                    </Form.Item>
                                                </Col>
                                            </Row>
                                        </div>
                                    </Card>

                                    {/* 2. Department Managers Mapping */}
                                    <Card 
                                        size="small" 
                                        title={<Space><TeamOutlined style={{ color: '#52c41a' }} /><Text strong>Department Managers Mapping (Block 3 Approval Routing)</Text></Space>} 
                                        style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                                            When an ECR is created for a specific department, its Block 3 approval request is dispatched to the manager configured below.
                                        </Paragraph>

                                        {ALL_DEPTS.map(dept => {
                                            // Pre-sort candidates so users of this department appear first
                                            const deptSortedCandidates = [...userCandidates].sort((a, b) => {
                                                const aMatch = a.u_department === dept ? -1 : 1;
                                                const bMatch = b.u_department === dept ? -1 : 1;
                                                return aMatch - bMatch;
                                            });

                                            return (
                                                <div 
                                                    key={dept} 
                                                    style={{ 
                                                        borderBottom: '1px solid #f0f0f0', 
                                                        paddingBottom: 8, 
                                                        marginBottom: 8,
                                                        background: '#fafafa',
                                                        borderRadius: 6,
                                                        padding: '8px 12px'
                                                    }}
                                                >
                                                    <Row gutter={10} align="middle">
                                                        <Col xs={24} md={3}>
                                                            <div style={{ fontWeight: 700, color: '#1890ff' }}>
                                                                <Tag color="blue" style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px' }}>
                                                                    {dept}
                                                                </Tag>
                                                            </div>
                                                        </Col>
                                                        <Col xs={24} md={8}>
                                                            <Form.Item name={`dept_mgr_${dept}_select`} label="Select Manager" style={{ marginBottom: 4 }}>
                                                                <Select
                                                                    size="small"
                                                                    showSearch
                                                                    placeholder={`Pick ${dept} Manager...`}
                                                                    allowClear
                                                                    loading={loadingUsers}
                                                                    onChange={(val) => handleSelectCandidate(val, `dept_mgr_${dept}`)}
                                                                    filterOption={(input, option) =>
                                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                    }
                                                                    options={deptSortedCandidates.map(u => ({
                                                                        value: u.u_code,
                                                                        label: formatUserOptionLabel(u)
                                                                    }))}
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={24} md={5}>
                                                            <Form.Item name={`dept_mgr_${dept}_name`} label="Manager Name" style={{ marginBottom: 4 }}>
                                                                <Input size="small" placeholder="Manager Name" />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={24} md={3}>
                                                            <Form.Item name={`dept_mgr_${dept}_emp`} label="Emp ID" style={{ marginBottom: 4 }}>
                                                                <Input size="small" placeholder="Emp ID" />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={24} md={5}>
                                                            <Form.Item name={`dept_mgr_${dept}_email`} label="Email" style={{ marginBottom: 4 }}>
                                                                <Input size="small" placeholder="Email" />
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                </div>
                                            );
                                        })}
                                    </Card>
                                </div>
                            )
                        },
                        {
                            key: 'concern_depts',
                            label: <span><ControlOutlined /> Concerned Depts (Block 9)</span>,
                            children: (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            Configure the departments required to review and sign off on change notices in Block 9.
                                        </Text>
                                        <Button 
                                            icon={<PlusOutlined />} 
                                            size="small" 
                                            onClick={handleAddConcernDept}
                                            style={{ borderRadius: 6 }}
                                        >
                                            Add Department
                                        </Button>
                                    </div>
                                    <Table 
                                        dataSource={concernDepts}
                                        columns={concernDeptColumns}
                                        rowKey={(r, idx) => `${r.dept_code}_${idx}`}
                                        pagination={false}
                                        size="small"
                                        scroll={{ x: 920 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'email_settings',
                            label: <span><MailOutlined /> GAS & Email Notifications</span>,
                            children: (
                                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                    <Card size="small" style={{ borderRadius: 8, marginBottom: 16 }}>
                                        <Form.Item 
                                            name="email_enabled" 
                                            label={<Text strong>Enable Automated Email Notifications</Text>} 
                                            valuePropName="checked"
                                        >
                                            <Switch checkedChildren="ENABLED" unCheckedChildren="DISABLED" />
                                        </Form.Item>

                                        <Form.Item 
                                            name="gas_webapp_url" 
                                            label="Google Apps Script Web App Deployment URL" 
                                            rules={[{ required: true, message: 'Please provide the GAS WebApp URL' }]}
                                            extra="The client-side email service sends requests directly to this URL to bypass the company firewall."
                                        >
                                            <Input placeholder="https://script.google.com/a/macros/minebea.co.th/s/.../exec" />
                                        </Form.Item>

                                        <Form.Item 
                                            name="notify_stages" 
                                            label="Send Email Notifications on These Workflow Stages"
                                        >
                                            <Select mode="multiple" placeholder="Select workflow stages" style={{ width: '100%' }}>
                                                <Option value="STAGE_2">Stage 2: Dept Manager Review</Option>
                                                <Option value="STAGE_2_R1">Stage 2-R1: Dept Mgr Clarification (Rework)</Option>
                                                <Option value="STAGE_3">Stage 3: Eng Dept Manager Review</Option>
                                                <Option value="STAGE_3_R1">Stage 3-R1: Eng Mgr Clarification (Rework)</Option>
                                                <Option value="STAGE_4">Stage 4: Assigned Engineer ECN Creation</Option>
                                                <Option value="STAGE_5_R1">Stage 5-R1: ECN Formulation Revision</Option>
                                                <Option value="STAGE_7">Stage 7: QC MSA & FAI Evaluation</Option>
                                                <Option value="STAGE_9">Stage 9: Concern Department Sign-offs</Option>
                                                <Option value="STAGE_10">Stage 10: Final Close & Release</Option>
                                            </Select>
                                        </Form.Item>
                                    </Card>

                                    <Card size="small" title={<Text strong>Google Apps Script Deployment Quick Reference</Text>} style={{ borderRadius: 8, background: '#fafafa' }}>
                                        <Paragraph style={{ fontSize: 12, margin: 0, color: '#595959' }}>
                                            The standalone Google Apps Script file is located at <code>src/utils/gas_enterprise_email_engine.gs</code>.<br />
                                            1. Paste that code into Google Apps Script at script.google.com<br />
                                            2. Deploy as Web App with <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>.<br />
                                            3. Paste the generated deployment URL above.
                                        </Paragraph>
                                    </Card>
                                </div>
                            )
                        },
                        {
                            key: 'system_admins',
                            label: <span><SafetyCertificateOutlined /> Authorized Admins</span>,
                            children: (
                                <div>
                                    <Paragraph type="secondary" style={{ fontSize: 12 }}>
                                        Users listed below (along with System Admins and Engineering Managers/Coordinators) have full access to modify these system settings.
                                    </Paragraph>
                                    <Select 
                                        mode="tags" 
                                        style={{ width: '100%', marginBottom: 16 }}
                                        value={systemAdmins}
                                        onChange={setSystemAdmins}
                                        placeholder="Select or enter employee IDs (e.g. admin, eng_mgr)"
                                        options={userCandidates.map(u => ({
                                            value: u.u_code,
                                            label: `${u.u_name} (${u.u_code}) - ${u.u_department}`
                                        }))}
                                    />
                                    <Card size="small" style={{ borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                        <Text strong style={{ color: '#389e0d' }}>🛡️ Built-in RBAC Protection:</Text>
                                        <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 12, color: '#595959' }}>
                                            <li>Users with role or department <strong>AD</strong> always have administrative access.</li>
                                            <li>Users with department <strong>ENG</strong> and role <strong>MGR</strong> or position <strong>Coordinator</strong> have administrative access.</li>
                                            <li>Any specific employee code added above is granted administrative control.</li>
                                        </ul>
                                    </Card>
                                </div>
                            )
                        }
                    ]}
                />
            </Form>
        </Modal>
    );
}
