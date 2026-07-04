import React, { useEffect, useState } from 'react';
import { Table, Typography, Card, Spin, message, Tag, Layout, Button, Popconfirm } from 'antd';
import axios from 'axios';
import { apiUrl } from '../../../../constance/constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';
import { useTheme } from '../../../../theme';

const { Title, Text } = Typography;
const { Content } = Layout;

const UpdateLogView = () => {
    const { theme } = useTheme();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${apiUrl}api/system/update-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setLogs(response.data.data);
            } else {
                message.error('Failed to fetch update logs.');
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            message.error('Error fetching update logs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const triggerUpdate = async () => {
        try {
            const token = localStorage.getItem('token');
            message.loading({ content: 'Initiating server update...', key: 'update' });
            const response = await axios.post(`${apiUrl}api/system/trigger-update`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                message.success({ content: response.data.message, key: 'update', duration: 5 });
            } else {
                message.error({ content: 'Failed to trigger update.', key: 'update', duration: 3 });
            }
        } catch (error) {
            console.error('Error triggering update:', error);
            message.error({ content: 'Error triggering update.', key: 'update', duration: 3 });
        }
    };

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 80,
            align: 'center',
        },
        {
            title: 'Executed At',
            dataIndex: 'executed_at',
            key: 'executed_at',
            width: 200,
            render: (text) => new Date(text).toLocaleString('en-GB'),
        },
        {
            title: 'Action',
            dataIndex: 'action_type',
            key: 'action_type',
            width: 150,
            render: (text) => {
                let color = 'blue';
                if (text === 'UPDATE_SUCCESS') color = 'green';
                if (text === 'ERROR') color = 'red';
                if (text === 'NO_UPDATE') color = 'gray';
                return <Tag color={color}>{text}</Tag>;
            },
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Local Hash',
            dataIndex: 'local_hash',
            key: 'local_hash',
            width: 150,
            render: (text) => text ? <Text copyable>{text.substring(0, 7)}</Text> : '-',
        },
        {
            title: 'Remote Hash',
            dataIndex: 'remote_hash',
            key: 'remote_hash',
            width: 150,
            render: (text) => text ? <Text copyable>{text.substring(0, 7)}</Text> : '-',
        },
    ];

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex' }}>
            <MenuTemplate type={"System"} defaultSelectedKeys={"4"} />
            <Layout style={{ backgroundColor: theme?.colors?.background || '#f0f2f5' }}>
                <ScrollbarStyle primary={theme?.colors?.primary || '#1890ff'} />
                <Content className="kb-vscroll" style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '24px'
                }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        <Card 
                            title={<Title level={3} style={{ margin: 0 }}>System Update Logs</Title>} 
                            extra={
                                <Popconfirm
                                    title="Run Server Update"
                                    description="Are you sure you want to run the auto-update script on the server? This will pull latest code and restart the server."
                                    onConfirm={triggerUpdate}
                                    okText="Yes, Run Update"
                                    cancelText="Cancel"
                                    placement="bottomRight"
                                >
                                    <Button type="primary" danger>Run Server Update</Button>
                                </Popconfirm>
                            }
                            bordered={false}
                        >
                            <Table
                                columns={columns}
                                dataSource={logs}
                                rowKey="id"
                                loading={loading}
                                pagination={{ pageSize: 20 }}
                                size="middle"
                            />
                        </Card>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default UpdateLogView;
