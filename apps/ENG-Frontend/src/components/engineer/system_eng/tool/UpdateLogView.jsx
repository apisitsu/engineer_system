import React, { useEffect, useState, useRef } from 'react';
import { Table, Typography, Card, Spin, message, Tag, Layout, Button, Popconfirm, Alert, Badge, Row, Col } from 'antd';
import { SyncOutlined, CheckCircleOutlined, InfoCircleOutlined, ExclamationCircleOutlined, CodeOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { apiUrl } from '../../../../constance/constance';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import ScrollbarStyle from '../../../common/scrollbar';
import { useTheme } from '../../../../theme';
import { sendEmailSilent } from '../../../../services/centralEmailService';

const { Title, Paragraph } = Typography;
const { Content } = Layout;

const UpdateLogView = () => {
    const { theme } = useTheme();
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [checkingUpdates, setCheckingUpdates] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [staleUpdate, setStaleUpdate] = useState(false);
    const pollIntervalRef = useRef(null);
    const pollCountRef = useRef(0);

    const MAX_POLL_ATTEMPTS = 60; // 60 x 5s = 5 minutes
    const STALE_TRIGGER_MS = 5 * 60 * 1000; // 5 minutes

    const fetchLogs = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${apiUrl}api/system/update-logs`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setLogs(response.data.data);
                
                if (response.data.data.length > 0) {
                    const latestLog = response.data.data[0];
                    if (latestLog.action_type === 'TRIGGERED') {
                        // Check if this trigger is stale (older than 5 minutes)
                        const triggerAge = Date.now() - new Date(latestLog.executed_at).getTime();
                        if (triggerAge > STALE_TRIGGER_MS) {
                            setIsUpdating(false);
                            setStaleUpdate(true);
                            stopPolling();
                        } else {
                            setStaleUpdate(false);
                            setIsUpdating(true);
                            startPolling();
                        }
                    } else {
                        setIsUpdating(false);
                        setStaleUpdate(false);
                        stopPolling();

                        // Trigger email alert if update failed
                        if (['ERROR', 'CRITICAL', 'ROLLBACK_SUCCESS'].includes(latestLog.action_type)) {
                            const lastAlertedId = localStorage.getItem('last_update_alert_id');
                            if (lastAlertedId !== String(latestLog.id)) {
                                localStorage.setItem('last_update_alert_id', String(latestLog.id));
                                sendEmailSilent({
                                    funct: 'sendSystemUpdateAlert',
                                    alert_type: latestLog.action_type,
                                    previous_hash: latestLog.local_hash || '',
                                    attempted_hash: latestLog.remote_hash || '',
                                    error_msg: latestLog.description || '',
                                    body: `Triggered by: ${latestLog.triggered_by || 'System'}\nCommit: ${latestLog.commit_message || 'N/A'}`
                                });
                            }
                        }
                    }
                }
            } else {
                message.error('Failed to fetch update logs.');
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
            message.error('Error fetching update logs.');
        } finally {
            setLoadingLogs(false);
        }
    };

    const checkForUpdates = async () => {
        try {
            setCheckingUpdates(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(`${apiUrl}api/system/check-updates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                setUpdateStatus(response.data);
                if (response.data.hasUpdate) {
                    message.info(`Update available! ${response.data.commitsBehind} new commits.`);
                } else {
                    message.success('System is up to date.');
                }
            }
        } catch (error) {
            console.error('Error checking updates:', error);
            message.error('Failed to check for updates.');
        } finally {
            setCheckingUpdates(false);
        }
    };

    const startPolling = () => {
        if (!pollIntervalRef.current) {
            pollCountRef.current = 0;
            pollIntervalRef.current = setInterval(() => {
                pollCountRef.current += 1;
                if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
                    // Polling timed out — stop and show stale warning
                    stopPolling();
                    setIsUpdating(false);
                    setStaleUpdate(true);
                    message.warning('Update polling timed out. The update may have stalled or completed outside this session.');
                    // Fetch one more time to pick up any auto-expired record from the backend
                    fetchLogs();
                    return;
                }
                fetchLogs();
            }, 5000);
        }
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        pollCountRef.current = 0;
    };

    useEffect(() => {
        fetchLogs();
        checkForUpdates();
        return () => stopPolling();
    }, []);

    const triggerUpdate = async () => {
        try {
            const token = localStorage.getItem('token');
            message.loading({ content: 'Initiating server update...', key: 'update' });
            setIsUpdating(true);
            const response = await axios.post(`${apiUrl}api/system/trigger-update`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data.success) {
                message.success({ content: response.data.message, key: 'update', duration: 5 });
                setTimeout(() => fetchLogs(), 2000); 
            } else {
                setIsUpdating(false);
                message.error({ content: 'Failed to trigger update.', key: 'update', duration: 3 });
            }
        } catch (error) {
            console.error('Error triggering update:', error);
            setIsUpdating(false);
            const detail = error.response?.data?.message || error.message || 'Unknown error';
            message.error({ content: `Error: ${detail}`, key: 'update', duration: 5 });
        }
    };

    const columns = [
        {
            title: 'Time',
            dataIndex: 'executed_at',
            key: 'executed_at',
            width: 160,
            render: (text) => new Date(text).toLocaleString('en-GB'),
        },
        {
            title: 'Action',
            dataIndex: 'action_type',
            key: 'action_type',
            width: 150,
            render: (text) => {
                let color = 'blue';
                let icon = <InfoCircleOutlined />;
                if (text === 'UPDATE_SUCCESS') { color = 'green'; icon = <CheckCircleOutlined />; }
                if (text === 'ERROR' || text === 'CRITICAL') { color = 'red'; icon = <ExclamationCircleOutlined />; }
                if (text === 'NO_UPDATE') { color = 'gray'; icon = <CheckCircleOutlined />; }
                if (text === 'TRIGGERED') { color = 'orange'; icon = <SyncOutlined spin />; }
                if (text === 'ROLLBACK_SUCCESS') { color = 'volcano'; icon = <ExclamationCircleOutlined />; }
                return <Tag color={color} icon={icon}>{text}</Tag>;
            },
        },
        {
            title: 'Triggered By',
            dataIndex: 'triggered_by',
            key: 'triggered_by',
            width: 120,
            render: (text) => text || 'System',
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Commit / Version',
            key: 'commit_message',
            width: 250,
            render: (_, record) => {
                return (
                    <div>
                        {record.local_hash && <Tag color="blue">{record.local_hash.substring(0, 7)}</Tag>}
                        {record.commit_message && <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>{record.commit_message}</div>}
                    </div>
                );
            }
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
                        
                        {/* HERO DASHBOARD CARD */}
                        <Card 
                            bordered={false} 
                            style={{ 
                                marginBottom: 24, 
                                borderRadius: 16, 
                                backgroundColor: theme?.colors?.primary || '#1890ff',
                                color: 'white',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Row gutter={24} align="middle">
                                <Col xs={24} md={16}>
                                    <Title level={2} style={{ color: 'white', margin: 0 }}>
                                        <CloudDownloadOutlined style={{ marginRight: 16 }} />
                                        System Update Manager
                                    </Title>
                                    <Paragraph style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8, fontSize: 16 }}>
                                        Monitor system version, check for upstream commits, and deploy updates securely.
                                    </Paragraph>
                                    
                                    <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '8px' }}>
                                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textTransform: 'uppercase' }}>Current Version (Local)</div>
                                            <div style={{ fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <CodeOutlined />
                                                {updateStatus ? updateStatus.localHash.substring(0, 7) : <Spin size="small" />}
                                            </div>
                                        </div>
                                        {updateStatus && updateStatus.hasUpdate && (
                                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px 20px', borderRadius: '8px' }}>
                                                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textTransform: 'uppercase' }}>Upstream Version (Remote)</div>
                                                <div style={{ fontSize: 18, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <CloudDownloadOutlined />
                                                    {updateStatus.remoteHash.substring(0, 7)}
                                                </div>
                                            </div>
                                        )}
                                        {updateStatus && !updateStatus.hasUpdate && (
                                            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20, marginRight: 8 }} />
                                                <span style={{ fontSize: 16, fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>System is up to date</span>
                                            </div>
                                        )}
                                    </div>
                                </Col>
                                <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                                    <Button 
                                        type="default" 
                                        size="large" 
                                        icon={<SyncOutlined spin={checkingUpdates} />} 
                                        onClick={checkForUpdates}
                                        loading={checkingUpdates}
                                        style={{ background: 'transparent', color: 'white', borderColor: 'rgba(255,255,255,0.5)', borderRadius: 8 }}
                                    >
                                        Check for Updates
                                    </Button>
                                </Col>
                            </Row>
                        </Card>

                        {/* UPDATE BANNER */}
                        {updateStatus && updateStatus.hasUpdate && !isUpdating && (
                            <Alert
                                message={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: 16 }}>
                                            <Badge count={updateStatus.commitsBehind} style={{ backgroundColor: '#52c41a', marginRight: 12 }} />
                                            New Updates Available!
                                        </span>
                                        <Popconfirm
                                            title="Deploy Server Update"
                                            description="This will pull the latest code and restart the server. Operations may be interrupted for a few minutes."
                                            onConfirm={triggerUpdate}
                                            okText="Yes, Update Now"
                                            cancelText="Cancel"
                                            placement="bottomRight"
                                        >
                                            <Button type="primary" style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 8 }}>
                                                Deploy Update Now
                                            </Button>
                                        </Popconfirm>
                                    </div>
                                }
                                description={
                                    <div style={{ marginTop: 8 }}>
                                        <div><strong>Latest Commit:</strong> {updateStatus.latestCommitMessage}</div>
                                        <div><strong>Author:</strong> {updateStatus.latestCommitAuthor} 
                                             <span style={{ marginLeft: 16, color: '#888' }}>
                                                 {new Date(updateStatus.latestCommitDate).toLocaleString()}
                                             </span>
                                        </div>
                                    </div>
                                }
                                type="success"
                                showIcon
                                style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #b7eb8f' }}
                            />
                        )}

                        {/* IN PROGRESS BANNER */}
                        {isUpdating && (
                            <Alert
                                message={<span style={{ fontWeight: 'bold', fontSize: 16 }}>System Update in Progress</span>}
                                description="The server is currently pulling code and restarting. Please wait..."
                                type="warning"
                                showIcon
                                icon={<SyncOutlined spin />}
                                style={{ marginBottom: 24, borderRadius: 12 }}
                            />
                        )}

                        {/* STALE UPDATE BANNER */}
                        {staleUpdate && (
                            <Alert
                                message={<span style={{ fontWeight: 'bold', fontSize: 16 }}>Update May Have Stalled</span>}
                                description="A previous update trigger was detected but did not complete within the expected time. The update script may not have executed properly, or it completed while the server was restarting. Check the server console for details."
                                type="error"
                                showIcon
                                icon={<ExclamationCircleOutlined />}
                                style={{ marginBottom: 24, borderRadius: 12 }}
                            />
                        )}

                        {/* HISTORY TABLE */}
                        <Card 
                            title={<Title level={4} style={{ margin: 0 }}>Update History Log</Title>} 
                            bordered={false}
                            style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                        >
                            <Table
                                columns={columns}
                                dataSource={logs}
                                rowKey="id"
                                loading={loadingLogs}
                                pagination={{ pageSize: 15 }}
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
