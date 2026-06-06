import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Upload, Tooltip, Spin, Typography, Layout, App, Popconfirm } from 'antd';
import { ReloadOutlined, UploadOutlined, DownloadOutlined, UserOutlined, FilePdfOutlined, Html5Outlined, DeleteOutlined, RetweetOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { MenuTemplate } from '../../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../../theme';
import ScrollbarStyle from '../../../../common/scrollbar';
import './HtmlToPdfDashboard.css';

const { Title, Text } = Typography;
const { Content } = Layout;

const HtmlToPdfDashboard = () => {
    const { empNo, userDepartment } = useAuthStore();
    const { theme } = useTheme();
    const { message } = App.useApp();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [myJobOnly, setMyJobOnly] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const url = myJobOnly
                ? `${server.HTML_TO_PDF_JOBS}?user_id=${empNo}`
                : server.HTML_TO_PDF_JOBS;

            const token = localStorage.getItem('token');
            const response = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setJobs(response.data.jobs || []);
            setLastUpdated(moment().format('h:mm:ss A'));
        } catch (error) {
            console.error('Error fetching HTML to PDF jobs:', error);
            message.error('Failed to fetch jobs.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${server.HTML_TO_PDF_DELETE_JOB}${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Job deleted successfully');
            fetchJobs();
        } catch (error) {
            console.error('Error deleting job:', error);
            message.error('Failed to delete job');
        }
    };

    const handleDeleteAll = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.delete(server.HTML_TO_PDF_DELETE_ALL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('All jobs deleted successfully');
            fetchJobs();
        } catch (error) {
            console.error('Error deleting all jobs:', error);
            message.error('Failed to delete all jobs');
        }
    };

    const handleRework = async (id) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${server.HTML_TO_PDF_REWORK}${id}/rework`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            message.success('Job rework started');
            fetchJobs();
        } catch (error) {
            console.error('Error starting rework:', error);
            message.error('Failed to start rework');
        }
    };

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(() => {
            fetchJobs();
        }, 10000); // Auto-refresh every 10s

        return () => clearInterval(interval);
    }, [myJobOnly, empNo]);

    const handleUpload = async (options) => {
        const { file, onSuccess, onError } = options;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('empno', empNo);

        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            await axios.post(server.HTML_TO_PDF_UPLOAD, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            message.success(`${file.name} uploaded successfully.`);
            onSuccess("ok");
            fetchJobs();
            // Automatically switch to My Jobs view after upload
            if (!myJobOnly) {
                setMyJobOnly(true);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            message.error(`${file.name} upload failed.`);
            onError(error);
        } finally {
            setUploading(false);
        }
    };

    const handleDownload = (id, type, filename) => {
        const url = type === 'pdf'
            ? `${server.HTML_TO_PDF_DOWNLOAD_PDF}${id}`
            : `${server.HTML_TO_PDF_DOWNLOAD_HTML}${id}`;

        const token = localStorage.getItem('token');

        // Fetch via axios to pass token, then trigger download
        axios.get(url, {
            responseType: 'blob',
            headers: { Authorization: `Bearer ${token}` }
        }).then(response => {
            const href = window.URL.createObjectURL(response.data);
            const link = document.createElement('a');
            link.href = href;
            link.setAttribute('download', `${filename}.${type}`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }).catch(err => {
            console.error('Download error:', err);
            message.error('File not available or an error occurred.');
        });
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'Done': return <Text type="secondary">Done</Text>;
            case 'Running Playwright':
            case 'Running SmartExchange': return <Text>Running SmartExchange</Text>;
            case 'Fetching SQL Data': return <Text>Fetching SQL Data</Text>;
            case 'Exporting PDF': return <Text>Exporting PDF</Text>;
            case 'Error':
            case 'Failed': return <Text type="danger">ERROR</Text>;
            default: return <Text>{status}</Text>;
        }
    };

    const columns = [
        {
            title: '#',
            key: 'index',
            width: 60,
            align: 'center',
            render: (text, record, index) => <Text type="secondary">{index + 1}</Text>
        },
        {
            title: 'DATE (ICT)',
            dataIndex: 'created_at',
            key: 'created_at',
            align: 'center',
            render: text => <Text type="secondary">{moment(text).format('YYYY-MM-DD HH:mm')}</Text>
        },
        {
            title: 'USER',
            dataIndex: 'user_id',
            key: 'user_id',
            align: 'center',
            render: text => <Text type="secondary">{text}</Text>
        },
        {
            title: 'CN',
            dataIndex: 'cn',
            key: 'cn',
            align: 'center',
            render: text => <Text strong>{text}</Text>
        },
        {
            title: 'STATUS',
            dataIndex: 'status',
            key: 'status',
            align: 'center',
            render: text => getStatusTag(text)
        }
    ];

    if (true) {
        columns.push({
            title: 'DOWNLOAD',
            key: 'download',
            align: 'center',
            render: (text, record) => {
                if (record.condition === 'Expired') {
                    return <Text type="secondary" italic>File Expired</Text>;
                }

                const displayName = `${record.cn}_${record.rev}.pdf`;

                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <Tooltip title="Download original HTML">
                            <Button
                                type="text"
                                size="small"
                                icon={<Html5Outlined style={{ color: '#e34f26', fontSize: '18px' }} />}
                                onClick={() => handleDownload(record.id, 'html', record.cn)}
                            />
                        </Tooltip>
                        {record.status === 'Done' && (
                            <Button
                                type="link"
                                size="small"
                                icon={<FilePdfOutlined />}
                                onClick={() => handleDownload(record.id, 'pdf', displayName.replace('.pdf', ''))}
                                style={{ padding: 0, color: '#595959', fontWeight: 500 }}
                            >
                                {displayName}
                            </Button>
                        )}
                    </div>
                );
            }
        });
    }

    columns.push({
        title: 'ERROR',
        dataIndex: 'error',
        key: 'error',
        align: 'center',
        render: text => text ? <Text type="danger">⚠ {text}</Text> : <Text type="secondary">—</Text>
    });

    columns.push({
        title: 'ACTION',
        key: 'action',
        align: 'center',
        render: (text, record) => (
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                {(record.status === 'Failed' || record.status === 'Error') && (
                    <Tooltip title="Rework Job">
                        <Button size="small" type="primary" icon={<RetweetOutlined />} onClick={() => handleRework(record.id)}>Rework</Button>
                    </Tooltip>
                )}
                {userDepartment === 'AD' && (
                    <Popconfirm
                        title="Delete Job"
                        description="Are you sure to delete this job?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Tooltip title="Delete Job">
                            <Button size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                    </Popconfirm>
                )}
            </div>
        )
    });

    return (
        <Layout style={{ minHeight: '100vh', display: 'flex' }}>
            <MenuTemplate type={"NewProd"} defaultSelectedKeys={"2"} />
            <Layout style={{ backgroundColor: theme?.colors?.background || '#f5f5f5' }}>
                <ScrollbarStyle primary={theme?.colors?.primary || '#1890ff'} />
                <Content className="kb-vscroll" style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '24px'
                }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto', background: '#fff', borderRadius: '16px', boxShadow: theme?.shadows?.sm || '0 2px 8px rgba(0,0,0,0.06)', padding: '24px' }}>
                        <div className="dashboard-header">
                            <Title level={4} style={{ margin: 0, color: '#1a1a1a' }}>
                                {myJobOnly ? 'My Jobs (Last 1 Month)' : 'Recent Jobs (All Users)'}
                            </Title>
                            <div className="header-actions">
                                <Upload
                                    customRequest={handleUpload}
                                    showUploadList={false}
                                    accept=".html,.HTML"
                                >
                                    <Button
                                        type="primary"
                                        icon={<UploadOutlined />}
                                        loading={uploading}
                                        style={{ marginRight: '8px', backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                                    >
                                        Upload HTML
                                    </Button>
                                </Upload>
                                <Button
                                    type={myJobOnly ? 'primary' : 'default'}
                                    icon={<UserOutlined />}
                                    onClick={() => setMyJobOnly(!myJobOnly)}
                                    style={{ marginRight: '8px' }}
                                >
                                    MyJob
                                </Button>
                                <div className="refresh-status">
                                    {userDepartment === 'AD' && (
                                        <Popconfirm
                                            title="Delete All Jobs"
                                            description="Are you sure you want to delete ALL jobs and files? This cannot be undone."
                                            onConfirm={handleDeleteAll}
                                            okText="Yes"
                                            cancelText="No"
                                            okButtonProps={{ danger: true }}
                                        >
                                            <Button
                                                danger
                                                icon={<DeleteOutlined />}
                                                style={{ marginRight: '12px' }}
                                            >
                                                Clear All Data
                                            </Button>
                                        </Popconfirm>
                                    )}
                                    <Button
                                        type="default"
                                        icon={<ReloadOutlined />}
                                        onClick={fetchJobs}
                                        loading={loading}
                                    >
                                        Loading...
                                    </Button>
                                    <Text type="secondary" style={{ marginLeft: '12px', fontSize: '12px' }}>
                                        Updated {lastUpdated}
                                    </Text>
                                </div>
                            </div>
                        </div>

                        <Table
                            columns={columns}
                            dataSource={jobs}
                            rowKey="id"
                            pagination={{ pageSize: 20 }}
                            size="middle"
                            className="jobs-table"
                            loading={{ indicator: <Spin />, spinning: loading && jobs.length === 0 }}
                        />

                        <div className="dashboard-footer">
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                Auto-refreshes every 10s • 3D HTML Generator — RD Portal
                            </Text>
                        </div>
                    </div>
                </Content>
            </Layout>
        </Layout>
    );
};

export default HtmlToPdfDashboard;
