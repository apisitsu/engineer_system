import React, { useState, useEffect } from 'react';
import { 
    Table, Card, Typography, Button, Space, Tag, Modal, Form, Input, message, Layout
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

const EmailConfigManager = () => {
    const { theme } = useTheme();
    const userDepartment = useAuthStore(state => state.userDepartment);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

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
        }
    }, [userDepartment]);

    // Check permissions
    if (userDepartment !== 'AD') {
        return (
            <div style={{ padding: 50, textAlign: 'center' }}>
                <Title level={3} type="danger">Access Denied</Title>
                <Text>เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าถึงหน้านี้ได้</Text>
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
            title: 'ยืนยันการลบ',
            content: 'คุณต้องการลบการตั้งค่าอีเมลนี้ใช่หรือไม่?',
            okText: 'ลบ',
            okType: 'danger',
            onOk: async () => {
                try {
                    await axios.delete(`${server.MTC_EMAIL_CONFIG}/${id}`);
                    message.success('ลบข้อมูลเรียบร้อยแล้ว');
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
                message.success('อัปเดตข้อมูลเรียบร้อยแล้ว');
            } else {
                await axios.post(server.MTC_EMAIL_CONFIG, values);
                message.success('สร้างรายการใหม่เรียบร้อยแล้ว');
            }
            setModalVisible(false);
            fetchConfigs();
        } catch (error) {
            message.error('Error saving configuration');
        }
    };

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
                            <InfoCircleOutlined /> จัดการรายชื่ออีเมลผู้รับแยกตามขั้นตอนของ Workflow (ระบุหลายอีเมลโดยใช้เครื่องหมาย , คั่น)
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
                                label="Workflow Stage Name" 
                                rules={[{ required: true, message: 'Please input stage name!' }]}
                                help="ตัวอย่าง: Eng Check หรือ CC_Eng Check"
                            >
                                <Input placeholder="Enter stage name" />
                            </Form.Item>
                            <Form.Item 
                                name="emails" 
                                label="Email Addresses (comma separated)" 
                                rules={[{ required: true, message: 'Please input at least one email!' }]}
                            >
                                <Input.TextArea rows={4} placeholder="email1@example.com, email2@example.com" />
                            </Form.Item>
                        </Form>
                    </Modal>
                </Card>
            </Content>
            </Layout>
        </Layout>
    );
};

export default EmailConfigManager;
