import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Upload, message, Tooltip, Spin, Typography, Layout } from 'antd';
import { ReloadOutlined, UploadOutlined, DownloadOutlined, UserOutlined, FilePdfOutlined, Html5Outlined } from '@ant-design/icons';
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
    const { empNo } = useAuthStore();
    const { theme } = useTheme();
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
            case 'Failed': return <Text type="danger">Failed</Text>;
            default: return <Text>{status}</Text>;
        }
    };

    const getConditionTag = (condition) => {
        if (condition === 'Revised') {
            return <Tag color="success" style={{ borderRadius: '12px', padding: '0 10px' }}>Revised</Tag>;
        }
        if (condition === 'Failed') {
            return <Tag color="error" style={{ borderRadius: '12px', padding: '0 10px' }}>Failed</Tag>;
        }
        return <Tag color="default" style={{ borderRadius: '12px', padding: '0 10px', backgroundColor: '#e6f7ff', borderColor: '#e6f7ff', color: '#1890ff' }}>—</Tag>;
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
        },
        {
            title: 'CONDITION',
            dataIndex: 'condition',
            key: 'condition',
            align: 'center',
            render: text => getConditionTag(text)
        }
    ];

    if (true) {
        columns.push({
            title: 'DOWNLOAD',
            key: 'download',
            align: 'center',
            render: (text, record) => {
                const displayName = record.rev && record.rev !== '---' && record.rev !== '-'
                    ? `${record.cn}_${record.rev}.pdf`
                    : `${record.cn}_DRS01_---.pdf`;

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
