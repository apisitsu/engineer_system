import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Card, Statistic, Table, DatePicker, message, Spin, Space, Tabs, Tag } from 'antd';
import { FilePdfOutlined, CheckCircleOutlined, InfoCircleOutlined, DollarOutlined, HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useTheme } from '../../../../../theme';
import dayjs from 'dayjs';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend);

const PdfUsageDashboard = ({ open, onClose }) => {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({
        totalSavings: 0,
        totalPagesSaved: 0,
        totalDocs: 0,
        details: [],
        chartData: []
    });
    const [selectedYear, setSelectedYear] = useState(dayjs());
    const [activeTab, setActiveTab] = useState('1');
    const [usageHistory, setUsageHistory] = useState([]);
    const [watermarkHistory, setWatermarkHistory] = useState([]);

    useEffect(() => {
        if (open) {
            fetchStats(selectedYear);
            fetchUsageHistory();
            fetchWatermarkHistory();
        }
    }, [open, selectedYear]);

    const fetchUsageHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(server.PDF_USAGE_HISTORY, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.result === 'true') {
                setUsageHistory(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load usage history', err);
        }
    };

    const fetchWatermarkHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(server.PDF_WATERMARK_HISTORY, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.result === 'true') {
                setWatermarkHistory(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load watermark history', err);
        }
    };

    const fetchStats = async (date) => {
        setLoading(true);
        try {
            const year = date ? date.year() : '';
            const token = localStorage.getItem('token');
            const res = await axios.get(`${server.PDF_USAGE_STATS}?year=${year}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.result === 'true') {
                setStats(res.data.data);
            }
        } catch (err) {
            message.error('Failed to load usage statistics');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const yearStr = selectedYear ? selectedYear.year().toString() : dayjs().year().toString();
    const allMonths = Array.from({ length: 12 }, (_, i) => {
        const monthNum = (i + 1).toString().padStart(2, '0');
        return `${yearStr}-${monthNum}`;
    });

    const lineData = {
        labels: allMonths,
        datasets: [
            {
                label: 'Cost Savings (THB)',
                data: allMonths.map(monthLabel => {
                    const found = stats.chartData.find(d => d.month === monthLabel);
                    if (found) {
                        return (parseInt(found.view_pages || 0) * 0.10) + (parseInt(found.action_pages || 0) * 0.50);
                    }
                    return 0; // Show 0 for months without data
                }),
                borderColor: theme.colors.success,
                backgroundColor: 'rgba(82, 196, 26, 0.2)',
                borderWidth: 2,
                pointBackgroundColor: theme.colors.success,
                tension: 0.3,
                fill: true
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => `฿${context.raw.toFixed(2)}`
                }
            }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'THB' } },
            x: { title: { display: true, text: 'Month' } }
        }
    };

    const columns = [
        { title: 'Month', dataIndex: 'month', key: 'month' },
        {
            title: 'View Pages (0.10 THB)',
            dataIndex: 'view_pages',
            key: 'view_pages',
            render: (val) => <span style={{ color: theme.colors.primary }}>{val || 0} Pages</span>
        },
        {
            title: 'Action Pages (0.50 THB)',
            dataIndex: 'action_pages',
            key: 'action_pages',
            render: (val) => <span style={{ color: theme.colors.success }}>{val || 0} Pages</span>
        },
        {
            title: 'Cost Saved (THB)',
            key: 'cost_saved',
            render: (_, record) => {
                const vPages = parseInt(record.view_pages) || 0;
                const aPages = parseInt(record.action_pages) || 0;
                const total = (vPages * 0.10) + (aPages * 0.50);
                return <strong style={{ color: '#52c41a' }}>฿{total.toFixed(2)}</strong>;
            }
        }
    ];

    const historyColumns = [
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
            width: 160
        },
        {
            title: 'User',
            key: 'user',
            render: (_, record) => `${record.empno} - ${record.user_name || 'Unknown'}`
        },
        { title: 'Document', dataIndex: 'filename', key: 'filename' },
        {
            title: 'Save Action',
            dataIndex: 'action_type',
            key: 'action_type',
            render: (val) => <Tag color={val === 'view' ? 'blue' : 'green'}>{val}</Tag>,
            width: 120
        },
        {
            title: 'Tools Used',
            dataIndex: 'details',
            key: 'details',
            render: (val) => val || '-'
        }
    ];

    const watermarkColumns = [
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
            width: 160
        },
        {
            title: 'User',
            key: 'user',
            render: (_, record) => `${record.empno} - ${record.user_name || 'Unknown'}`
        },
        { title: 'Document', dataIndex: 'filename', key: 'filename' },
        {
            title: 'Watermark Name',
            dataIndex: 'watermark_name',
            key: 'watermark_name',
            render: (val) => <Tag color="purple">{val}</Tag>
        }
    ];

    return (
        <Modal
            title={<span style={{ color: theme.colors.textPrimary, fontSize: 18 }}><DollarOutlined /> Paper Cost Reduction Dashboard</span>}
            open={open}
            onCancel={onClose}
            footer={null}
            width={1200}
            styles={{ body: { padding: '24px 0' } }}
        >
            <Spin spinning={loading}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    style={{ padding: '0 24px' }}
                    items={[
                        {
                            key: '1',
                            label: <span><DollarOutlined /> KPI & Cost Reduction</span>,
                            children: (
                                <>
                                    <div style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0 }}>Yearly Report</h3>
                                        <DatePicker
                                            picker="year"
                                            value={selectedYear}
                                            onChange={(val) => setSelectedYear(val)}
                                            allowClear={false}
                                        />
                                    </div>
                                    <div style={{ background: theme.colors.background, padding: 24, borderRadius: 8 }}>
                                        <Row gutter={[16, 16]}>
                                            <Col span={8}>
                                                <Card bordered={false} style={{ borderRadius: 12, borderLeft: `4px solid ${theme.colors.primary}` }}>
                                                    <Statistic
                                                        title="Total Documents"
                                                        value={stats.totalDocs}
                                                        prefix={<FilePdfOutlined />}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={8}>
                                                <Card bordered={false} style={{ borderRadius: 12, borderLeft: `4px solid ${theme.colors.info}` }}>
                                                    <Statistic
                                                        title="Total Pages Digitized"
                                                        value={stats.totalPagesSaved}
                                                        prefix={<CheckCircleOutlined />}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={8}>
                                                <Card bordered={false} style={{ borderRadius: 12, borderLeft: `4px solid ${theme.colors.success}` }}>
                                                    <Statistic
                                                        title="Total Cost Savings (THB)"
                                                        value={stats.totalSavings}
                                                        precision={2}
                                                        prefix="฿"
                                                        valueStyle={{ color: theme.colors.success, fontWeight: 'bold' }}
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>
                                    </div>
                                    <div style={{ padding: '24px 0 0' }}>
                                        <h4 style={{ marginBottom: 16 }}>Cost Savings Trend</h4>
                                        <div style={{ position: 'relative', width: '100%', background: theme.colors.background, padding: 16, borderRadius: 8, marginBottom: 24, height: 300 }}>
                                            <Line data={lineData} options={lineOptions} maintainAspectRatio={false} />
                                        </div>

                                        <h4 style={{ marginBottom: 16 }}>Details by Month</h4>
                                        <Table
                                            dataSource={stats.chartData}
                                            columns={columns}
                                            rowKey="month"
                                            pagination={false}
                                            size="middle"
                                            summary={() => (
                                                <Table.Summary fixed>
                                                    <Table.Summary.Row style={{ background: theme.colors.background, fontWeight: 'bold' }}>
                                                        <Table.Summary.Cell>Total (Selected Period)</Table.Summary.Cell>
                                                        <Table.Summary.Cell>
                                                            {stats.chartData.reduce((acc, curr) => acc + (parseInt(curr.view_pages) || 0), 0)} Pages
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell>
                                                            {stats.chartData.reduce((acc, curr) => acc + (parseInt(curr.action_pages) || 0), 0)} Pages
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell>
                                                            <span style={{ color: '#52c41a' }}>฿{stats.totalSavings.toFixed(2)}</span>
                                                        </Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                </Table.Summary>
                                            )}
                                        />
                                    </div>
                                    <div style={{ padding: '16px 0 0', textAlign: 'right', fontSize: 12, color: theme.colors.textSecondary }}>
                                        <Space>
                                            <InfoCircleOutlined />
                                            <span>View Action: 0.10 THB / Page</span>
                                            <span style={{ margin: '0 8px' }}>|</span>
                                            <span>Export/Merge Actions: 0.50 THB / Page</span>
                                        </Space>
                                    </div>
                                </>
                            )
                        },
                        {
                            key: '2',
                            label: <span><HistoryOutlined /> Document History</span>,
                            children: (
                                <div style={{ paddingTop: 16 }}>
                                    <Table
                                        dataSource={usageHistory}
                                        columns={historyColumns}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 10 }}
                                    />
                                </div>
                            )
                        },
                        {
                            key: '3',
                            label: <span><SafetyCertificateOutlined /> Watermark Audit</span>,
                            children: (
                                <div style={{ paddingTop: 16 }}>
                                    <Table
                                        dataSource={watermarkHistory}
                                        columns={watermarkColumns}
                                        rowKey="id"
                                        size="small"
                                        pagination={{ pageSize: 10 }}
                                    />
                                </div>
                            )
                        }
                    ]}
                />
            </Spin>
        </Modal>
    );
};

export default PdfUsageDashboard;
