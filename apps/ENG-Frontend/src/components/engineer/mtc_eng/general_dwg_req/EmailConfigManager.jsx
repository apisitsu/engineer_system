import React, { useState, useEffect } from 'react';
import {
    Table, Card, Typography, Button, Space, Tag, Modal, Form, Input, Select, Alert, message, Layout
} from 'antd';
import {
    MailOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
    SettingOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import { useTheme } from '../../../../theme';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';

const { Title, Text } = Typography;
const { Content } = Layout;

// Stage keys exactly as stored in tr_email_config and read by toolRequestController.js
// (getEmailRecipients upper-cases and looks up both <STAGE> and CC_<STAGE>).
const MAIN_STAGES = ['ENG_CHECK', 'DRAFTMAN', 'DWG_CHECK', 'ENG_REVIEW', 'ENG_APPROVE', 'ENG_INFORM'];
const STAGE_KEYS = [...MAIN_STAGES, 'ADMIN', ...MAIN_STAGES.map(s => `CC_${s}`)];

const splitEmails = (v) => (v ? v.split(',').map(e => e.trim()).filter(Boolean) : []);

const EmailConfigManager = () => {
    const { theme } = useTheme();
    const userDepartment = useAuthStore(state => state.userDepartment);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [users, setUsers] = useState([]);
    const [memberCode, setMemberCode] = useState(null);
    const [memberEmail, setMemberEmail] = useState('');
    const [savingMember, setSavingMember] = useState(false);
    const [form] = Form.useForm();

    const fetchUsers = async () => {
        try {
            const res = await axios.get(server.MTC_EMAIL_CONFIG_USERS);
            setUsers(res.data.data || []);
        } catch (error) {
            message.error('Failed to load user list');
        }
    };

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await axios.get(server.MTC_EMAIL_CONFIG);
            setData(res.data.data || []);
        } catch (error) {
            message.error('Failed to fetch email configurations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userDepartment === 'AD') {
            fetchConfigs();
            fetchUsers();
        }
    }, [userDepartment]);

    // Check permissions
    if (userDepartment !== 'AD') {
        return (
            <div style={{ padding: 50, textAlign: 'center' }}>
                <Title level={3} type="danger">Access Denied</Title>
                <Text>Admin only can access this page</Text>
            </div>
        );
    }

    const handleEdit = (record) => {
        setEditingItem(record);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    const handleCreate = () => {
        setEditingItem(null);
        form.resetFields();
        setModalVisible(true);
    };

    const handleDelete = async (id) => {
        Modal.confirm({
            title: 'Confirm to delete',
            content: 'Delete this email configuration?',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await axios.delete(`${server.MTC_EMAIL_CONFIG}/${id}`);
                    message.success('Delete successful');
                    fetchConfigs();
                } catch (error) {
                    message.error('Failed to delete config');
                }
            }
        });
    };

    const onFinish = async (values) => {
        try {
            if (editingItem) {
                await axios.put(`${server.MTC_EMAIL_CONFIG}/${editingItem.id}`, values);
                message.success('Update successful');
            } else {
                await axios.post(server.MTC_EMAIL_CONFIG, values);
                message.success('Create new item successful');
            }
            setModalVisible(false);
            fetchConfigs();
        } catch (error) {
            message.error('Error saving configuration');
        }
    };

    // Recipients picker. Only people whose profile has an email can be chosen: the
    // stage permission check matches the address, so picking someone without one
    // would silently lock them out (the LE403 / T1460 / L6121 bug).
    const usersWithoutEmail = users.filter(u => !u.email);
    const userLabel = (u) => `${u.u_name || u.u_code} (${u.u_code}${u.u_department ? `, ${u.u_department}` : ''})`;
    const recipientOptions = users.map(u => (
        u.email
            ? { value: u.email, label: `${userLabel(u)} — ${u.email}` }
            : { value: `nomail:${u.u_code}`, label: `${userLabel(u)} — no email set`, disabled: true }
    ));
    const memberOptions = users.map(u => ({ value: u.u_code, label: `${userLabel(u)}${u.email ? ` — ${u.email}` : ''}` }));

    const saveMemberEmail = async () => {
        if (!memberCode || !memberEmail.trim()) return;
        setSavingMember(true);
        try {
            await axios.put(`${server.MTC_EMAIL_CONFIG_MEMBERS}/${encodeURIComponent(memberCode)}`, { email: memberEmail.trim() });
            message.success('Email saved');
            setMemberCode(null);
            setMemberEmail('');
            fetchUsers();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to save email');
        } finally {
            setSavingMember(false);
        }
    };

    // Stage picker: fixed keys; on create, hide the ones already configured; when
    // editing, keep the row's own stage even if it is not in the standard list.
    const usedStages = new Set(data.map(d => (d.stage || '').toUpperCase()));
    const stageOptions = STAGE_KEYS
        .filter(s => editingItem ? true : !usedStages.has(s))
        .map(s => ({ value: s, label: s }));
    if (editingItem && !STAGE_KEYS.includes(editingItem.stage)) {
        stageOptions.unshift({ value: editingItem.stage, label: editingItem.stage });
    }

    const columns = [
        {
            title: 'Stage / Category',
            dataIndex: 'stage',
            key: 'stage',
            width: 250,
            render: (text) => (
                <Space>
                    {text.startsWith('CC_') ? <Tag color="orange">CC</Tag> : <Tag color="blue">Main</Tag>}
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: 'Email Recipients',
            dataIndex: 'emails',
            key: 'emails',
            render: (emails) => (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {emails?.split(',').map((email, idx) => (
                        <Tag key={idx} icon={<MailOutlined />} color="cyan">
                            {email.trim()}
                        </Tag>
                    ))}
                </div>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        size="small"
                    >
                        Edit
                    </Button>
                    <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleDelete(record.id)}
                        size="small"
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <Layout style={{ height: '100%' }}>
            <MenuTemplate type="MTC" defaultSelectedKeys="admin-email" defaultOpenKeys="admin-config" />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="kb-vscroll" style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '15px'
                }}>
                    <Card
                        title={
                            <Space>
                                <SettingOutlined />
                                <span>Email Notification Settings (General DWG Request)</span>
                            </Space>
                        }
                        extra={
                            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                                Add New Stage/CC
                            </Button>
                        }
                        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">
                                <InfoCircleOutlined /> Manage who is notified and who may act on each Workflow stage
                            </Text>
                        </div>

                        <Table
                            columns={columns}
                            dataSource={data}
                            rowKey="id"
                            loading={loading}
                            pagination={false}
                            bordered
                        />

                        <Modal
                            title={editingItem ? 'Edit Email Config' : 'Add New Email Config'}
                            open={modalVisible}
                            onCancel={() => setModalVisible(false)}
                            onOk={() => form.submit()}
                            destroyOnHidden
                            okText="Save"
                        >
                            <Form form={form} layout="vertical" onFinish={onFinish}>
                                <Form.Item
                                    name="stage"
                                    label="Workflow Stage"
                                    rules={[{ required: true, message: 'Please select a stage!' }]}
                                    help="CC_ rows are copied on the stage's notifications and may also act on it"
                                >
                                    <Select
                                        showSearch
                                        placeholder="Select stage"
                                        options={stageOptions}
                                    />
                                </Form.Item>
                                <Form.Item
                                    name="emails"
                                    label="Recipients"
                                    rules={[{ required: true, message: 'Please select at least one person!' }]}
                                    getValueProps={(v) => ({ value: splitEmails(v) })}
                                    normalize={(arr) => (arr || []).join(', ')}
                                >
                                    <Select
                                        mode="multiple"
                                        showSearch
                                        placeholder="Search by name, code or email"
                                        options={recipientOptions}
                                        optionFilterProp="label"
                                        style={{ width: '100%' }}
                                    />
                                </Form.Item>
                                <Alert
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 8 }}
                                    message={
                                        usersWithoutEmail.length > 0
                                            ? `${usersWithoutEmail.length} of ${users.length} people have no email set for this system yet and cannot be selected above. Set it below.`
                                            : 'Set or change the email this system uses for a person:'
                                    }
                                    description="Saved for General DWG Request only; user profiles are not changed."
                                />
                                <Space.Compact style={{ width: '100%' }}>
                                    <Select
                                        showSearch
                                        placeholder="Person"
                                        style={{ width: '45%' }}
                                        options={memberOptions}
                                        optionFilterProp="label"
                                        value={memberCode}
                                        onChange={(code) => {
                                            setMemberCode(code);
                                            setMemberEmail(users.find(u => u.u_code === code)?.email || '');
                                        }}
                                    />
                                    <Input
                                        placeholder="name@minebea.co.th"
                                        style={{ width: '40%' }}
                                        value={memberEmail}
                                        onChange={(e) => setMemberEmail(e.target.value)}
                                        onPressEnter={saveMemberEmail}
                                    />
                                    <Button
                                        type="primary"
                                        style={{ width: '15%' }}
                                        loading={savingMember}
                                        disabled={!memberCode || !memberEmail.trim()}
                                        onClick={saveMemberEmail}
                                    >
                                        Save
                                    </Button>
                                </Space.Compact>
                            </Form>
                        </Modal>
                    </Card>
                </Content>
            </Layout>
        </Layout>
    );
};

export default EmailConfigManager;
