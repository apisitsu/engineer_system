import React, { useEffect, useState } from 'react';
import { Form, Switch, InputNumber, Button, Tabs, Spin, Typography, Modal, App as AntdApp } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useAuthStore } from '../../../../stores/authStore';
import { server } from '../../../../constance/constance';

const { Title, Text } = Typography;

const KanbanAdminSettings = ({ open, onClose }) => {
    const { message } = AntdApp.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rawSettings, setRawSettings] = useState([]);
    
    const { userRole, userDepartment } = useAuthStore();
    const isAdmin = userRole === 'admin' || userRole === 'system_admin' || userDepartment === 'AD';

    useEffect(() => {
        if (open && isAdmin) {
            fetchSettings();
        }
    }, [open, isAdmin]);

    if (!isAdmin) {
        return null;
    }

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await axios.get(server.KANBAN_SETTINGS);
            setRawSettings(res.data.data);
            
            // แปลงข้อมูลจาก DB ลง Form
            const formValues = {};
            res.data.data.forEach(item => {
                formValues[item.setting_key] = item.value_type === 'boolean' 
                    ? item.setting_value === 'true' 
                    : Number(item.setting_value);
            });
            form.setFieldsValue(formValues);
        } catch (error) {
            message.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values) => {
        try {
            setSaving(true);
            // แปลง Form กลับเป็น Array สำหรับส่งให้ API
            const payload = Object.keys(values).map(key => ({
                key,
                value: String(values[key]) // API รับเป็น String
            }));

            await axios.patch(server.KANBAN_SETTINGS, { settings: payload });
            message.success('System settings saved successfully!');
        } catch (error) {
            message.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Helper function สำหรับสร้าง Form.Item
    const renderSettingItem = (item) => (
        <Form.Item 
            key={item.setting_key}
            name={item.setting_key}
            label={
                <div style={{ whiteSpace: 'normal', lineHeight: '1.4', padding: '4px 0' }}>
                    <div style={{ fontWeight: 600, color: '#333' }}>{item.setting_key.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: 12, color: 'gray', fontWeight: 'normal', marginTop: 4 }}>{item.description}</div>
                </div>
            }
            valuePropName={item.value_type === 'boolean' ? 'checked' : 'value'}
            style={{ marginBottom: 24 }}
        >
            {item.value_type === 'boolean' ? <Switch /> : <InputNumber min={1} style={{ width: 120 }} />}
        </Form.Item>
    );

    const getItemsByCategory = (categoryName) => 
        rawSettings.filter(s => s.category === categoryName).map(renderSettingItem);


    const tabItems = [
        { key: 'features', label: 'UI Features', children: getItemsByCategory('features') },
        { key: 'storage', label: 'Storage & Files', children: getItemsByCategory('storage') },
        { key: 'limits', label: 'System Limits', children: getItemsByCategory('limits') },
    ];

    return (
        <Modal
            title={
                <div style={{ marginBottom: 16 }}>
                    <Title level={4} style={{ margin: 0 }}>Kanban Global Settings</Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>Manage system-wide toggles and limits (Admin Only)</Text>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={700}
            footer={null}
            destroyOnClose
        >
            <Spin spinning={loading}>
                <Form 
                    form={form} 
                    layout="horizontal" 
                    labelCol={{ span: 16 }} 
                    wrapperCol={{ span: 8 }}
                    labelAlign="left"
                    labelWrap
                    colon={false}
                    onFinish={async (values) => {
                        await handleSave(values);
                        onClose();
                    }}
                >
                    <Tabs items={tabItems} />
                    <div style={{ marginTop: 24, textAlign: 'right' }}>
                        <Button onClick={onClose} style={{ marginRight: 8 }}>Cancel</Button>
                        <Button type="primary" icon={<SaveOutlined />} loading={saving} htmlType="submit">
                            Save Changes
                        </Button>
                    </div>
                </Form>
            </Spin>
        </Modal>
    );
};

export default KanbanAdminSettings;
