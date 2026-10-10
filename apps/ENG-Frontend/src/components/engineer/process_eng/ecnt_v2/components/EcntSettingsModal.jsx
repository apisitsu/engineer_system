import React, { useState, useEffect } from 'react';
import { 
    Modal, Tabs, Form, Input, Button, Switch, Table, Space, 
    Typography, Tag, Select, App, Card, Row, Col, Alert, Tooltip, Checkbox 
} from 'antd';
import { 
    SettingOutlined, SaveOutlined, PlusOutlined, DeleteOutlined, 
    SafetyCertificateOutlined, MailOutlined, TeamOutlined, ControlOutlined,
    SendOutlined, ThunderboltOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server, GAS_EMAIL_WEBAPP } from '../../../../../constance/constance';
import { sendGasEmail } from '../../../../../services/ecntEmailService';

const { Text, Paragraph } = Typography;

const ALL_DEPTS = ['ENG', 'QA', 'QC', 'PD1', 'PD2', 'MC', 'MM', 'PC', 'TOP'];

export default function EcntSettingsModal({ open, onClose, currentConfig = {}, onConfigUpdated }) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [testingEmail, setTestingEmail] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState(null);
    const [form] = Form.useForm();

    const [concernDepts, setConcernDepts] = useState([]);
    const [systemAdmins, setSystemAdmins] = useState([]);
    const [customAdminCode, setCustomAdminCode] = useState('');
    const [userCandidates, setUserCandidates] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Robust base URL and auth headers
    const getBaseUrl = () => {
        if (server.URL) return server.URL.replace(/\/$/, '');
        if (server.API_URL) return server.API_URL.replace(/\/$/, '');
        return 'http://plbmp129:2005';
    };

    const getAuthConfig = () => {
        const token = localStorage.getItem("token");
        return {
            withCredentials: true,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        };
    };

    // Fetch registered users from backend (excluding users with nickname 'Admin')
    const fetchUserCandidates = async () => {
        setLoadingUsers(true);
        try {
            const baseUrl = getBaseUrl();
            const res = await axios.get(`${baseUrl}/api/ecnt/user-candidates`, getAuthConfig());
            const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);
            const list = rawList.filter(u => (u.u_nickname || '').toLowerCase() !== 'admin');
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
            setTestEmailResult(null);

            form.setFieldsValue({
                // 1. Stage 2-Risk: Lead Engineer (Risk Assessment - พี่โอ)
                lead_risk_select: assignees.lead_engineer_risk?.emp_no || undefined,
                lead_risk_emp: assignees.lead_engineer_risk?.emp_no || 'LB269',
                lead_risk_name: assignees.lead_engineer_risk?.name || 'Nathaporn Yammanus',
                lead_risk_email: assignees.lead_engineer_risk?.email || 'nathaporn.y@minebea.co.th',

                // 2. Stage 3 & 5 & 10: Eng Dept Manager (พี่แจ็ค)
                eng_mgr_select: assignees.eng_mgr?.emp_no || undefined,
                eng_mgr_emp: assignees.eng_mgr?.emp_no || 'LB371',
                eng_mgr_name: assignees.eng_mgr?.name || 'Teerapol Kantapoom',
                eng_mgr_email: assignees.eng_mgr?.email || 'teerapol.k@minebea.co.th',

                // 3. Stage 4 & 8: Default Lead Engineer (ECN Creation & Summary)
                default_lead_select: assignees.default_lead_engineer?.emp_no || undefined,
                default_lead_emp: assignees.default_lead_engineer?.emp_no || 'LB269',
                default_lead_name: assignees.default_lead_engineer?.name || 'Nathaporn Yammanus',
                default_lead_email: assignees.default_lead_engineer?.email || 'nathaporn.y@minebea.co.th',

                // 4. Stage 6: QC MSA Decision PIC
                qc_msa_select: assignees.qc_msa_pic?.emp_no || assignees.default_qc_pic?.emp_no || undefined,
                qc_msa_emp: assignees.qc_msa_pic?.emp_no || assignees.default_qc_pic?.emp_no || 'LB125',
                qc_msa_name: assignees.qc_msa_pic?.name || assignees.default_qc_pic?.name || 'Patcharayada Waiyaboon',
                qc_msa_email: assignees.qc_msa_pic?.email || assignees.default_qc_pic?.email || 'patcharayada.w@minebea.co.th',

                // 5. Stage 7: QC FAI Decision PIC
                qc_fai_select: assignees.qc_fai_pic?.emp_no || assignees.default_qc_pic?.emp_no || undefined,
                qc_fai_emp: assignees.qc_fai_pic?.emp_no || assignees.default_qc_pic?.emp_no || 'LB125',
                qc_fai_name: assignees.qc_fai_pic?.name || assignees.default_qc_pic?.name || 'Patcharayada Waiyaboon',
                qc_fai_email: assignees.qc_fai_pic?.email || assignees.default_qc_pic?.email || 'patcharayada.w@minebea.co.th',

                // 6. Dept Mgr mappings (Stage 2)
                ...ALL_DEPTS.reduce((acc, d) => {
                    const mapped = assignees.dept_mgr_mapping?.[d] || {};
                    acc[`dept_mgr_${d}_select`] = mapped.emp_no || undefined;
                    acc[`dept_mgr_${d}_emp`] = mapped.emp_no || '';
                    acc[`dept_mgr_${d}_name`] = mapped.name || '';
                    acc[`dept_mgr_${d}_email`] = mapped.email || '';
                    return acc;
                }, {}),

                // Email settings
                gas_webapp_url: email.gas_webapp_url || GAS_EMAIL_WEBAPP || 'https://script.google.com/a/macros/minebea.co.th/s/AKfycbyBwUbuPNdv9hGJd5s_SjVynpVxW5hPe4I45CtDB614JMeEzEsJTjPw_-GQv7f41o-TIQ/exec',
                email_enabled: email.enabled !== false,
                test_recipient: 'nanthiwa.k@minebea.co.th',
                notify_stages: email.notify_on_stages || [
                    'STAGE_2', 'STAGE_2_R1', 'STAGE_2_RISK', 'STAGE_3', 'STAGE_3_R1', 'STAGE_4', 'STAGE_5', 'STAGE_5_R1', 'STAGE_6', 'STAGE_7', 'STAGE_8', 'STAGE_9', 'STAGE_10'
                ]
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                lead_engineer_risk: {
                    emp_no: values.lead_risk_emp || 'LB269',
                    name: values.lead_risk_name || 'Nathaporn Yammanus',
                    email: values.lead_risk_email || 'nathaporn.y@minebea.co.th'
                },
                eng_mgr: {
                    emp_no: values.eng_mgr_emp || 'LB371',
                    name: values.eng_mgr_name || 'Teerapol Kantapoom',
                    email: values.eng_mgr_email || 'teerapol.k@minebea.co.th'
                },
                default_lead_engineer: {
                    emp_no: values.default_lead_emp || 'LB269',
                    name: values.default_lead_name || 'Nathaporn Yammanus',
                    email: values.default_lead_email || 'nathaporn.y@minebea.co.th'
                },
                qc_msa_pic: {
                    emp_no: values.qc_msa_emp || 'LB125',
                    name: values.qc_msa_name || 'Patcharayada Waiyaboon',
                    email: values.qc_msa_email || 'patcharayada.w@minebea.co.th'
                },
                qc_fai_pic: {
                    emp_no: values.qc_fai_emp || 'LB125',
                    name: values.qc_fai_name || 'Patcharayada Waiyaboon',
                    email: values.qc_fai_email || 'patcharayada.w@minebea.co.th'
                },
                default_qc_pic: {
                    emp_no: values.qc_fai_emp || values.qc_msa_emp || 'LB125',
                    name: values.qc_fai_name || values.qc_msa_name || 'Patcharayada Waiyaboon',
                    email: values.qc_fai_email || values.qc_msa_email || 'patcharayada.w@minebea.co.th'
                }
            };

            // 2. Prepare email_settings payload
            const email_settings = {
                gas_webapp_url: values.gas_webapp_url,
                enabled: values.email_enabled,
                notify_on_stages: values.notify_stages
            };

            const baseUrl = getBaseUrl();
            const authConfig = getAuthConfig();

            // Save all to backend
            await Promise.all([
                axios.post(`${baseUrl}/api/ecnt/config`, {
                    key: 'stage_assignees',
                    value: stage_assignees,
                    description: 'Stage Default Assignees and Department Manager Mappings'
                }, authConfig),

                axios.post(`${baseUrl}/api/ecnt/config`, {
                    key: 'concern_depts',
                    value: concernDepts,
                    description: 'List of concern departments and PICs for Block 9 evaluation'
                }, authConfig),

                axios.post(`${baseUrl}/api/ecnt/config`, {
                    key: 'email_settings',
                    value: email_settings,
                    description: 'Google Apps Script Web App email notification parameters'
                }, authConfig),

                axios.post(`${baseUrl}/api/ecnt/config`, {
                    key: 'system_admins',
                    value: systemAdmins,
                    description: 'Employee IDs granted administrative control over ECNT settings'
                }, authConfig)
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

    // Live Test Email via GAS
    const handleTestSendEmail = async () => {
        try {
            const values = await form.getFieldsValue();
            const gasUrl = values.gas_webapp_url || GAS_EMAIL_WEBAPP;
            const recipient = values.test_recipient || 'nanthiwa.k@minebea.co.th';

            if (!gasUrl) {
                antdMessage.error("Please enter a valid Google Apps Script Web App URL first.");
                return;
            }

            setTestingEmail(true);
            setTestEmailResult(null);

            const testPayload = {
                funct: "sendEcntEmail",
                recipients: recipient,
                doc_type: "ECR",
                doc_no: "ECR-TEST-VERIFY",
                title: "Live Email Notification Engine Verification Test",
                customer: "Minebea Internal System Test",
                requester: values.eng_mgr_name || "System Admin",
                department: "ENG",
                stage_title: "3. ECR Risk Assessment & Dept Mgr Verification",
                priority: "NORMAL",
                is_rework: false,
                action_required: "This is a live diagnostic verification email to confirm that Google Apps Script email dispatching works properly.",
                notes: `Triggered from ECNT V2 System Settings at ${new Date().toLocaleString('en-GB')}`,
                direct_url: "http://localhost:3000/eng/process_eng/ecnt_v2"
            };

            const result = await sendGasEmail(gasUrl, testPayload);
            if (result.success) {
                setTestEmailResult({
                    status: 'success',
                    message: `✅ Test email successfully dispatched to ${recipient}! Please check inbox/spam folder.`
                });
                antdMessage.success(`Test email dispatched to ${recipient}!`);
            } else {
                setTestEmailResult({
                    status: 'error',
                    message: `❌ Email test encountered an issue: ${result.error || result.reason || 'Failed'}`
                });
                antdMessage.warning("Dispatched via fallback mode. Please check recipient inbox.");
            }
        } catch (err) {
            console.error("Test email error:", err);
            setTestEmailResult({
                status: 'error',
                message: `❌ Exception: ${err.message}`
            });
            antdMessage.error(`Failed to send test email: ${err.message}`);
        } finally {
            setTestingEmail(false);
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

    const handleAddAdminUser = (uCode) => {
        if (!uCode) return;
        const cleanCode = uCode.trim();
        if (!cleanCode) return;
        if (systemAdmins.map(c => c.toLowerCase()).includes(cleanCode.toLowerCase())) {
            antdMessage.warning(`"${cleanCode}" is already an authorized administrator.`);
            return;
        }
        setSystemAdmins(prev => [...prev, cleanCode]);
        antdMessage.success(`Added "${cleanCode}" to authorized administrators.`);
    };

    const handleRemoveAdminUser = (uCode) => {
        setSystemAdmins(prev => prev.filter(c => c.toLowerCase() !== uCode.toLowerCase()));
        antdMessage.info(`Removed "${uCode}" from authorized administrators.`);
    };

    const adminTableColumns = [
        {
            title: 'Employee ID / Code',
            dataIndex: 'code',
            key: 'code',
            width: 170,
            render: (code) => (
                <Space>
                    <SafetyCertificateOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                    <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, padding: '2px 8px' }}>{code}</Tag>
                </Space>
            )
        },
        {
            title: 'Full Name & Nickname',
            key: 'name',
            render: (_, record) => {
                const user = userCandidates.find(u => u.u_code.toLowerCase() === record.code.toLowerCase());
                if (user) {
                    return (
                        <div>
                            <Text strong style={{ fontSize: 13 }}>{user.u_name}</Text>
                            {user.u_nickname && (
                                <Tag color="orange" style={{ marginLeft: 8, fontSize: 11 }}>
                                    {user.u_nickname}
                                </Tag>
                            )}
                        </div>
                    );
                }
                const isSpecial = ['admin', 'eng_mgr', 'system'].includes(record.code.toLowerCase());
                return (
                    <Text italic type="secondary">
                        {isSpecial ? 'Built-in System Account' : 'Custom Configured Employee ID'}
                    </Text>
                );
            }
        },
        {
            title: 'Department / Position',
            key: 'dept',
            width: 220,
            render: (_, record) => {
                const user = userCandidates.find(u => u.u_code.toLowerCase() === record.code.toLowerCase());
                if (user) {
                    return (
                        <Space size={4} wrap>
                            {user.u_department && <Tag color="cyan">{user.u_department}</Tag>}
                            {(user.position || user.role) && <Tag color="default">{user.position || user.role}</Tag>}
                        </Space>
                    );
                }
                return <Tag color="purple">System Rule</Tag>;
            }
        },
        {
            title: 'Action',
            key: 'action',
            width: 70,
            align: 'center',
            render: (_, record) => (
                <Tooltip title={`Remove ${record.code} from Admins`}>
                    <Button 
                        danger 
                        type="text" 
                        size="small"
                        icon={<DeleteOutlined />} 
                        onClick={() => handleRemoveAdminUser(record.code)} 
                    />
                </Tooltip>
            )
        }
    ];

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

    // Helper renderer for PIC configuration row
    const renderPicConfigRow = ({ title, tag, tagColor, prefix, required = true }) => (
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <Row gutter={12} align="bottom">
                <Col xs={24} md={10}>
                    <Form.Item 
                        name={`${prefix}_select`} 
                        label={
                            <Space size={6}>
                                <Tag color={tagColor} style={{ fontWeight: 700, margin: 0 }}>{tag}</Tag>
                                <Text strong>{title}</Text>
                            </Space>
                        }
                        style={{ marginBottom: 4 }}
                    >
                        <Select
                            showSearch
                            placeholder="🔍 Pick from registered users..."
                            allowClear
                            loading={loadingUsers}
                            onChange={(val) => handleSelectCandidate(val, prefix)}
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
                    <Form.Item name={`${prefix}_name`} label="PIC Name" rules={required ? [{ required: true }] : []} style={{ marginBottom: 4 }}>
                        <Input placeholder="Full Name" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                    <Form.Item name={`${prefix}_emp`} label="Emp ID" rules={required ? [{ required: true }] : []} style={{ marginBottom: 4 }}>
                        <Input placeholder="Emp No" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={5}>
                    <Form.Item name={`${prefix}_email`} label="Email" rules={required ? [{ required: true, type: 'email' }] : []} style={{ marginBottom: 4 }}>
                        <Input placeholder="Email" />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );

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
            width={980}
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
                            label: <span><TeamOutlined /> Stage PICs & Default Assignees</span>,
                            children: (
                                <div style={{ maxHeight: '64vh', overflowY: 'auto', paddingRight: 8 }}>
                                    <Alert
                                        message="Stage Default Assignees Configuration (การตั้งค่าผู้รับผิดชอบเริ่มต้นแต่ละขั้นตอน)"
                                        description="คุณสามารถระบุผู้รับผิดชอบเริ่มต้น (Default PIC) สำหรับแต่ละขั้นตอนที่สำคัญได้โดยเลือกจากรายชื่อพนักงานในระบบ (ระบบจะตัดบัญชีทดสอบ 'Admin' ออกอัตโนมัติ) หรือระบุข้อมูลชื่อ รหัส และอีเมลโดยตรง การตั้งค่านี้จะถูกนำไปใช้ทันทีกับ Stepper, การแจ้งเตือน Email และการตรวจสอบสิทธิ์ในระบบ"
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />

                                    {/* 1. Core Engineering & Decision Stages */}
                                    <Card 
                                        size="small" 
                                        title={
                                            <Space>
                                                <ThunderboltOutlined style={{ color: '#1890ff' }} />
                                                <Text strong>Core Stage Default Assignees (ผู้รับผิดชอบหลักประจำแต่ละ Stage)</Text>
                                            </Space>
                                        } 
                                        style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        {/* Stage 2-Risk: Lead Engineer Risk Assessment */}
                                        {renderPicConfigRow({
                                            title: 'Stage 2-Risk: Lead Engineer (Technical Risk Assessment - พี่โอ)',
                                            tag: 'STAGE 2-RISK',
                                            tagColor: 'cyan',
                                            prefix: 'lead_risk'
                                        })}

                                        {/* Stage 3 & 5 & 10: Engineering Department Manager */}
                                        {renderPicConfigRow({
                                            title: 'Stage 3, 5, 10: Engineering Department Manager (ผู้จัดการแผนกวิศวกรรม - พี่แจ็ค)',
                                            tag: 'ENG MGR',
                                            tagColor: 'blue',
                                            prefix: 'eng_mgr'
                                        })}

                                        {/* Stage 4 & 8: Default Lead Engineer for ECN Formulation */}
                                        {renderPicConfigRow({
                                            title: 'Stage 4 & 8: Default Lead Engineer (ECN Formulation & Summary - พี่โอ)',
                                            tag: 'STAGE 4 & 8',
                                            tagColor: 'geekblue',
                                            prefix: 'default_lead'
                                        })}

                                        {/* Stage 6: QC MSA Decision PIC */}
                                        {renderPicConfigRow({
                                            title: 'Stage 6: QC MSA Decision PIC (ผู้ประเมินระบบการวัด MSA)',
                                            tag: 'STAGE 6 QC',
                                            tagColor: 'gold',
                                            prefix: 'qc_msa'
                                        })}

                                        {/* Stage 7: QC FAI Decision PIC */}
                                        {renderPicConfigRow({
                                            title: 'Stage 7: QC FAI Decision PIC (ผู้ประเมินการตรวจชิ้นงาน FAI)',
                                            tag: 'STAGE 7 QC',
                                            tagColor: 'orange',
                                            prefix: 'qc_fai'
                                        })}
                                    </Card>

                                    {/* 2. Department Managers Mapping */}
                                    <Card 
                                        size="small" 
                                        title={<Space><TeamOutlined style={{ color: '#52c41a' }} /><Text strong>Department Managers Mapping (Block 3 Approval Routing ตามแผนก)</Text></Space>} 
                                        style={{ borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
                                            เมื่อมีการสร้าง ECR จากแผนกใด ระบบจะส่งคำขออนุมัติ Block 3 ไปยังผู้จัดการของแผนกนั้นตามที่กำหนดด้านล่างนี้
                                        </Paragraph>

                                        {ALL_DEPTS.map(dept => {
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
                                <div style={{ maxHeight: '64vh', overflowY: 'auto', paddingRight: 8 }}>
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
                                            label={<Text strong>Send Email Notifications on These Workflow Stages</Text>}
                                            extra="Select the workflow stages that should automatically trigger email notifications to assignees"
                                        >
                                            <div style={{ background: '#fafafa', padding: '12px 16px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                                <Checkbox.Group style={{ width: '100%' }}>
                                                    <Row gutter={[12, 12]}>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_2">
                                                                <Space size={6}>
                                                                    <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>Stage 2</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Dept Manager Review</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_2_R1">
                                                                <Space size={6}>
                                                                    <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Stage 2-R1</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Dept Mgr Clarification (Rework)</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_2_RISK">
                                                                <Space size={6}>
                                                                    <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>Stage 2-Risk</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Lead Engineer Risk Assessment</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_3">
                                                                <Space size={6}>
                                                                    <Tag color="geekblue" style={{ margin: 0, fontSize: 11 }}>Stage 3</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Eng Dept Manager ECR Review</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_3_R1">
                                                                <Space size={6}>
                                                                    <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Stage 3-R1</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Eng Mgr Clarification (Rework)</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_4">
                                                                <Space size={6}>
                                                                    <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>Stage 4</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Assigned Engineer ECN Creation</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_5">
                                                                <Space size={6}>
                                                                    <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>Stage 5</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Eng Dept Manager ECN Review</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_5_R1">
                                                                <Space size={6}>
                                                                    <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>Stage 5-R1</Tag>
                                                                    <Text style={{ fontSize: 13 }}>ECN Formulation Revision</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_6">
                                                                <Space size={6}>
                                                                    <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>Stage 6</Tag>
                                                                    <Text style={{ fontSize: 13 }}>QC MSA Decision</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_7">
                                                                <Space size={6}>
                                                                    <Tag color="volcano" style={{ margin: 0, fontSize: 11 }}>Stage 7</Tag>
                                                                    <Text style={{ fontSize: 13 }}>QC FAI Decision</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_8">
                                                                <Space size={6}>
                                                                    <Tag color="magenta" style={{ margin: 0, fontSize: 11 }}>Stage 8</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Eng Summary & Concern Dispatch</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_9">
                                                                <Space size={6}>
                                                                    <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Stage 9</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Concern Multi-Dept Sign-offs</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Checkbox value="STAGE_10">
                                                                <Space size={6}>
                                                                    <Tag color="success" style={{ margin: 0, fontSize: 11 }}>Stage 10</Tag>
                                                                    <Text style={{ fontSize: 13 }}>Final Close & ECN Release</Text>
                                                                </Space>
                                                            </Checkbox>
                                                        </Col>
                                                    </Row>
                                                </Checkbox.Group>
                                            </div>
                                        </Form.Item>
                                    </Card>

                                    {/* 3. Live Email Dispatch Verification Panel */}
                                    <Card 
                                        size="small" 
                                        title={<Space><SendOutlined style={{ color: '#52c41a' }} /><Text strong>Live Email Dispatch Verification (ทดสอบส่งอีเมลทันที)</Text></Space>} 
                                        style={{ borderRadius: 8, marginBottom: 16, border: '1px solid #b7eb8f', background: '#f6ffed' }}
                                    >
                                        <Paragraph style={{ fontSize: 12, marginBottom: 8, color: '#389e0d' }}>
                                            คุณสามารถกดส่งอีเมลทดสอบจริงจากหน้านี้ไปยัง <b>nanthiwa.k@minebea.co.th</b> หรือระบุอีเมลอื่นเพื่อทดสอบการเชื่อมต่อกับ Google Apps Script ได้ทันที
                                        </Paragraph>

                                        <Row gutter={12} align="bottom">
                                            <Col xs={24} md={15}>
                                                <Form.Item 
                                                    name="test_recipient" 
                                                    label={<Text strong>Email ผู้รับสำหรับการทดสอบ</Text>}
                                                    style={{ marginBottom: 4 }}
                                                >
                                                    <Input placeholder="nanthiwa.k@minebea.co.th" />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={9}>
                                                <Button 
                                                    type="primary" 
                                                    icon={<SendOutlined />} 
                                                    loading={testingEmail}
                                                    onClick={handleTestSendEmail}
                                                    style={{ background: '#52c41a', borderColor: '#52c41a', width: '100%', marginBottom: 4 }}
                                                >
                                                    ส่งอีเมลทดสอบหา nanthiwa.k
                                                </Button>
                                            </Col>
                                        </Row>

                                        {testEmailResult && (
                                            <Alert
                                                message={testEmailResult.message}
                                                type={testEmailResult.status === 'success' ? 'success' : 'warning'}
                                                showIcon
                                                style={{ marginTop: 12 }}
                                            />
                                        )}

                                        <div style={{ marginTop: 10, fontSize: 11, color: '#666' }}>
                                            🔗 ต้องการเปิดเครื่องมือทดสอบเต็มรูปแบบ? <a href="/test_mail.html" target="_blank" rel="noreferrer">คลิกที่นี่เพื่อเปิด test_mail.html ในแท็บใหม่</a>
                                        </div>
                                    </Card>

                                    <Card size="small" title={<Text strong>Google Apps Script Deployment Quick Reference</Text>} style={{ borderRadius: 8, background: '#fafafa' }}>
                                        <Paragraph style={{ fontSize: 12, margin: 0, color: '#595959' }}>
                                            The standalone Google Apps Script file is located at <code>apps/ENG-Frontend/src/utils/gas_enterprise_email_engine.gs</code>.<br />
                                            1. Paste that code into Google Apps Script at script.google.com<br />
                                            2. Deploy as Web App with <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong> (or Anyone within minebea.co.th).<br />
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
                                <div style={{ maxHeight: '64vh', overflowY: 'auto', paddingRight: 8 }}>
                                    <Alert
                                        message="Authorized System Administrators"
                                        description="Users configured below are granted full privileges to access and modify ECNT System Settings, regardless of standard stage ownership."
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: 16 }}
                                    />

                                    {/* 1. Search & Add Administrator */}
                                    <Card 
                                        size="small" 
                                        title={<Space><SafetyCertificateOutlined style={{ color: '#1890ff' }} /><Text strong>Add Authorized Administrator</Text></Space>}
                                        style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        <Row gutter={12} align="bottom">
                                            <Col xs={24} md={15}>
                                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                                    Pick from registered company users:
                                                </Text>
                                                <Select
                                                    showSearch
                                                    placeholder="🔍 Select user to grant admin privileges..."
                                                    style={{ width: '100%' }}
                                                    value={null}
                                                    loading={loadingUsers}
                                                    onChange={handleAddAdminUser}
                                                    filterOption={(input, option) =>
                                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                    }
                                                    options={userCandidates.map(u => ({
                                                        value: u.u_code,
                                                        label: formatUserOptionLabel(u)
                                                    }))}
                                                />
                                            </Col>
                                            <Col xs={24} md={9}>
                                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                                    Or add custom ID / system code:
                                                </Text>
                                                <Space.Compact style={{ width: '100%' }}>
                                                    <Input
                                                        placeholder="e.g. A5342 or custom_id"
                                                        value={customAdminCode}
                                                        onChange={e => setCustomAdminCode(e.target.value)}
                                                        onPressEnter={() => {
                                                            if (customAdminCode.trim()) {
                                                                handleAddAdminUser(customAdminCode.trim());
                                                                setCustomAdminCode('');
                                                            }
                                                        }}
                                                    />
                                                    <Button 
                                                        type="primary" 
                                                        icon={<PlusOutlined />}
                                                        onClick={() => {
                                                            if (customAdminCode.trim()) {
                                                                handleAddAdminUser(customAdminCode.trim());
                                                                setCustomAdminCode('');
                                                            }
                                                        }}
                                                    >
                                                        Add
                                                    </Button>
                                                </Space.Compact>
                                            </Col>
                                        </Row>
                                    </Card>

                                    {/* 2. Active Authorized Admins Table */}
                                    <Card
                                        size="small"
                                        title={
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Space>
                                                    <TeamOutlined style={{ color: '#52c41a' }} />
                                                    <Text strong>Active Authorized Administrators ({systemAdmins.length})</Text>
                                                </Space>
                                            </div>
                                        }
                                        style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                                    >
                                        <Table
                                            size="small"
                                            dataSource={systemAdmins.map(code => ({ key: code, code }))}
                                            columns={adminTableColumns}
                                            pagination={false}
                                            locale={{ emptyText: 'No specific administrators configured' }}
                                        />
                                    </Card>

                                    {/* 3. Built-in RBAC Protection Info */}
                                    <Card size="small" style={{ borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                                        <Text strong style={{ color: '#389e0d' }}>🛡️ Built-in Global RBAC Privileges:</Text>
                                        <ul style={{ margin: '8px 0 0 18px', padding: 0, fontSize: 12, color: '#595959' }}>
                                            <li>Users with role or department <strong>AD</strong> always have administrative access.</li>
                                            <li>Users with department <strong>ENG</strong> and role <strong>MGR</strong> or position <strong>Coordinator</strong> have administrative access.</li>
                                            <li>Any specific personnel added in the list above are granted administrative control.</li>
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
