import React, { useState, useEffect } from 'react';
import {
    Layout,
    Card,
    Table,
    Input,
    Button,
    Tag,
    Space,
    Typography,
    Row,
    Col,
    Segmented,
    Alert,
    Tooltip,
    ConfigProvider
} from 'antd';
import {
    SearchOutlined,
    ReloadOutlined,
    AppstoreOutlined,
    BarsOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    CloseCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { httpClient } from '../../../../utils/HttpClient';

const { Title, Text } = Typography;
const { Content } = Layout;

const JobCheckTracker = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('Table'); // 'Table' or 'Card'
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await httpClient.get('api/proxy/job_check');
            setData(response.data);
        } catch (err) {
            setError(err.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredData = data.filter(item => {
        const term = searchTerm.toLowerCase();
        return (
            (item.cn && item.cn.toLowerCase().includes(term)) ||
            (item.status && item.status.toLowerCase().includes(term)) ||
            (item.date && item.date.toLowerCase().includes(term))
        );
    });

    // Helper to get status tag
    const getStatusTag = (status) => {
        if (!status) return <Tag color="default">Unknown</Tag>;
        if (status === 'Completed') return <Tag icon={<CheckCircleOutlined />} color="success">{status}</Tag>;
        if (status.includes('Processing')) return <Tag icon={<SyncOutlined spin />} color="processing">{status}</Tag>;
        return <Tag color="warning">{status}</Tag>;
    };

    const getConditionTag = (condition) => {
        if (!condition) return <Text type="secondary" italic>-</Text>;
        if (condition === 'Failed') return <Tag icon={<CloseCircleOutlined />} color="error">{condition}</Tag>;
        return <Tag color="success">{condition}</Tag>;
    };

    const sevenHoursInMs = 7 * 60 * 60 * 1000;

    const columns = [
        {
            title: 'Date & Time',
            dataIndex: 'date',
            key: 'date',
            // ส่วนการแสดงผล (UI)
            render: (text) => {
                const date = new Date(new Date(text).getTime() + sevenHoursInMs);
                return date.toLocaleString('th-TH', {
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            },
            // ส่วนการเรียงลำดับ (Logic)
            sorter: (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        },
        {
            title: 'CN (ID)',
            dataIndex: 'cn',
            key: 'cn',
            render: (text) => <Text strong type="primary" style={{ color: '#1677ff' }}>{text}</Text>,
            sorter: (a, b) => a.cn.localeCompare(b.cn),
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => getStatusTag(status),
        },
        {
            title: 'Condition',
            dataIndex: 'condition',
            key: 'condition',
            render: (condition) => getConditionTag(condition),
        },
        {
            title: 'Error Message',
            dataIndex: 'error',
            key: 'error',
            render: (error) => error ? (
                <Tooltip title={error} overlayStyle={{ maxWidth: 400 }}>
                    <Text type="danger" ellipsis style={{ maxWidth: 250, display: 'inline-block' }}>{error}</Text>
                </Tooltip>
            ) : <Text type="secondary" italic>-</Text>,
        },
    ];

    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#1677ff',
                    borderRadius: 8,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
                },
            }}
        >
            <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
                <Content style={{ padding: '24px 48px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

                    <Card
                        variant="borderless"
                        style={{
                            marginBottom: 24,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            borderRadius: 12
                        }}
                    >
                        <Row justify="space-between" align="middle" gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                                <Space align="center" size="middle">
                                    <div style={{ width: 4, height: 28, background: '#1677ff', borderRadius: 2 }} />
                                    <Title level={3} style={{ margin: 0 }}>3D PDF Generate Tracker</Title>
                                </Space>
                            </Col>

                            <Col xs={24} md={16}>
                                <Row justify="end" gutter={[16, 16]}>
                                    <Col xs={24} sm={10} md={10}>
                                        <Input
                                            placeholder="Search by ID, Status, Date..."
                                            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            allowClear
                                            size="large"
                                            style={{ borderRadius: 8 }}
                                        />
                                    </Col>

                                    <Col>
                                        <Segmented
                                            options={[
                                                { label: 'Table', value: 'Table', icon: <BarsOutlined /> },
                                                { label: 'Card', value: 'Card', icon: <AppstoreOutlined /> },
                                            ]}
                                            value={viewMode}
                                            onChange={setViewMode}
                                            size="middle"
                                        />
                                    </Col>

                                    <Col>
                                        <Button
                                            type="primary"
                                            icon={<ReloadOutlined />}
                                            onClick={fetchData}
                                            loading={loading}
                                            size="middle"
                                            style={{ borderRadius: 8 }}
                                        >
                                            Refresh
                                        </Button>
                                    </Col>
                                </Row>
                            </Col>
                        </Row>
                    </Card>

                    {error && (
                        <Alert
                            message="Failed to fetch data"
                            description={error}
                            type="error"
                            showIcon
                            style={{ marginBottom: 24, borderRadius: 8 }}
                        />
                    )}

                    {!error && (
                        <div style={{ animation: 'fadeIn 0.5s ease' }}>
                            {viewMode === 'Table' ? (
                                <Card
                                    variant="borderless"
                                    style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}
                                    styles={{ body: { padding: 0 } }}
                                >
                                    <Table
                                        columns={columns}
                                        dataSource={filteredData.map((item, index) => ({ ...item, key: index }))}
                                        loading={loading}
                                        pagination={{
                                            // pageSize: 12,
                                            showSizeChanger: true,
                                            pageSizeOptions: ['5', '10', '15', '20',]
                                        }}
                                        rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
                                        scroll={{ x: 'max-content' }}
                                    />
                                </Card>
                            ) : (
                                <Row gutter={[24, 24]}>
                                    {filteredData.map((item, index) => (
                                        <Col xs={24} sm={12} md={8} xl={6} key={index}>
                                            <Card
                                                hoverable
                                                variant="borderless"
                                                style={{ height: '100%', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                                styles={{ body: { padding: 24, display: 'flex', flexDirection: 'column', height: '100%' } }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                    <Text strong style={{ fontSize: 18, color: '#1677ff', wordBreak: 'break-all' }}>{item.cn}</Text>
                                                    {getStatusTag(item.status)}
                                                </div>

                                                <Space direction="vertical" size={12} style={{ width: '100%', flex: 1 }}>
                                                    <div>
                                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', textTransform: 'uppercase', marginBottom: 4 }}>Date & Time</Text>
                                                        <Text>{item.date}</Text>
                                                    </div>

                                                    {(item.condition || item.error) && (
                                                        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                                                            {item.condition && (
                                                                <Row justify="space-between" align="middle" style={{ marginBottom: item.error ? 12 : 0 }}>
                                                                    <Text type="secondary" style={{ fontSize: 12, textTransform: 'uppercase' }}>Condition:</Text>
                                                                    {getConditionTag(item.condition)}
                                                                </Row>
                                                            )}

                                                            {item.error && (
                                                                <div style={{ background: '#fff2f0', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffccc7' }}>
                                                                    <Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', marginBottom: 4 }}>Error Details</Text>
                                                                    <Space align="start" size={6}>
                                                                        <InfoCircleOutlined style={{ color: '#ff4d4f', marginTop: 4 }} />
                                                                        <Text type="danger" style={{ fontSize: 12, wordBreak: 'break-word' }}>{item.error}</Text>
                                                                    </Space>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Space>
                                            </Card>
                                        </Col>
                                    ))}
                                    {filteredData.length === 0 && !loading && (
                                        <Col span={24}>
                                            <Card variant="borderless" style={{ borderRadius: 12, textAlign: 'center', padding: '60px 0' }}>
                                                <Text type="secondary" style={{ fontSize: 16 }}>No data found matching your search.</Text>
                                            </Card>
                                        </Col>
                                    )}
                                </Row>
                            )}
                        </div>
                    )}

                </Content>
            </Layout>
            <style>{`
        .table-row-light { background-color: #ffffff; }
        .table-row-dark { background-color: #fafafa; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </ConfigProvider>
    );
};

export default JobCheckTracker;
