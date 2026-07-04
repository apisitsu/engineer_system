import React, { useState, useEffect } from 'react';
import { Modal, Row, Col, Card, Statistic, Table, DatePicker, message, Spin, Space, Tabs, Tag, Progress, Empty, Checkbox } from 'antd';
import { FilePdfOutlined, CheckCircleOutlined, InfoCircleOutlined, DollarOutlined, HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';
import { useTheme } from '../../../../../../theme';
import dayjs from 'dayjs';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip as ChartTooltip, Legend, Filler } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, Filler, ChartDataLabels);

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
    const [selectedMonthDate, setSelectedMonthDate] = useState(dayjs());
    const [activeTab, setActiveTab] = useState('1');
    const [usageHistory, setUsageHistory] = useState([]);
    const [watermarkHistory, setWatermarkHistory] = useState([]);
    const [includeSoftwareCost, setIncludeSoftwareCost] = useState(false);
    const softwareCostPerMonth = 271500 / 12;

    useEffect(() => {
        if (open) {
            fetchStats(selectedMonthDate);
            fetchUsageHistory();
            fetchWatermarkHistory();
        }
    }, [open, selectedMonthDate]);

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

    const yearStr = selectedMonthDate ? selectedMonthDate.year().toString() : dayjs().year().toString();
    const selectedMonthIndex = selectedMonthDate ? selectedMonthDate.month() : dayjs().month();
    const allMonths = Array.from({ length: 12 }, (_, i) => {
        const monthNum = (i + 1).toString().padStart(2, '0');
        return `${yearStr}-${monthNum}`;
    });

    const targetMonthStr = selectedMonthDate ? selectedMonthDate.format('YYYY-MM') : dayjs().format('YYYY-MM');
    const selectedMonthData = stats.chartData.find(d => d.month === targetMonthStr);
    const selectedMonthSavings = selectedMonthData
        ? (parseInt(selectedMonthData.view_pages || 0) * 0.25) + (parseInt(selectedMonthData.action_pages || 0) * 0.50) + (includeSoftwareCost ? softwareCostPerMonth : 0)
        : (includeSoftwareCost ? softwareCostPerMonth : 0);

    const savingsData = allMonths.map(monthLabel => {
        const found = stats.chartData.find(d => d.month === monthLabel);
        // Only apply empty month software cost if the month is past or current, and starts from 2026-06
        const monthDate = dayjs(monthLabel + '-01');
        const isEligibleMonth = monthDate.isBefore(dayjs().endOf('month')) && monthDate.isAfter(dayjs('2026-05-31'));
        if (found) {
            return (parseInt(found.view_pages || 0) * 0.25) + (parseInt(found.action_pages || 0) * 0.50) + (includeSoftwareCost ? softwareCostPerMonth : 0);
        }
        return (includeSoftwareCost && isEligibleMonth) ? softwareCostPerMonth : 0;
    });

    const lineData = {
        labels: allMonths,
        datasets: [
            {
                label: 'Cost Savings (THB)',
                data: savingsData,
                borderColor: theme.colors.success,
                backgroundColor: 'rgba(82, 196, 26, 0.4)',
                borderWidth: 2,
                pointBackgroundColor: theme.colors.success,
                tension: 0,
                fill: true,
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    formatter: (value) => value > 0 ? value.toLocaleString() : '',
                    font: { size: 11, weight: 'bold' }
                }
            }
        ]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
            padding: { top: 20 }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `฿${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: { display: true, text: 'THB' },
                suggestedMax: Math.max(...savingsData, 0) * 1.2
            },
            x: { title: { display: true, text: 'Month' } }
        }
    };

    const columns = [
        { title: 'Month', dataIndex: 'month', key: 'month' },
        {
            title: 'View Pages (0.25 THB)',
            dataIndex: 'view_pages',
            key: 'view_pages',
            render: (val) => <span style={{ color: theme.colors.primary }}>{parseInt(val || 0).toLocaleString()} Pages</span>
        },
        {
            title: 'Action Pages (0.50 THB)',
            dataIndex: 'action_pages',
            key: 'action_pages',
            render: (val) => <span style={{ color: theme.colors.success }}>{parseInt(val || 0).toLocaleString()} Pages</span>
        },
        {
            title: 'Cost Saved (THB)',
            key: 'cost_saved',
            render: (_, record) => {
                const vPages = parseInt(record.view_pages) || 0;
                const aPages = parseInt(record.action_pages) || 0;
                const total = (vPages * 0.25) + (aPages * 0.50) + (includeSoftwareCost ? softwareCostPerMonth : 0);
                return <strong style={{ color: '#52c41a' }}>฿{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>;
            }
        }
    ];

    const historyColumns = [
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
            width: 200
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
            width={1300}
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
                                    {/* Top Section */}
                                    <Row gutter={24} style={{ marginBottom: 24, marginTop: 16 }}>
                                        {/* Left Column */}
                                        <Col span={8}>
                                            <div style={{ fontWeight: 'bold', marginBottom: 8, fontSize: 16, color: theme.colors.textPrimary }}>Target ({targetMonthStr}): Not specified</div>
                                            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: theme.colors.textSecondary }}>
                                                    <span>Target ({targetMonthStr})</span>
                                                    <strong style={{ color: theme.colors.textPrimary }}>Not specified</strong>
                                                </div>
                                                <Progress percent={0} showInfo={false} strokeColor={theme.colors.success} strokeWidth={10} />
                                                <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                                                    Progress ({targetMonthStr}): ฿{selectedMonthSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                        </Col>

                                        {/* Right Column */}
                                        <Col span={16}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <div style={{ fontWeight: 'bold', fontSize: 16, color: theme.colors.textPrimary }}>Overall Performance</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                    <Checkbox checked={includeSoftwareCost} onChange={(e) => setIncludeSoftwareCost(e.target.checked)}>
                                                        Include Software Cost (271,500/Yr)
                                                    </Checkbox>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span>Select Month:</span>
                                                        <DatePicker picker="month" format="YYYY-MM" value={selectedMonthDate} onChange={(val) => setSelectedMonthDate(val)} allowClear={false} size="small" />
                                                    </div>
                                                </div>
                                            </div>
                                            <Row gutter={12}>
                                                <Col span={6}>
                                                    <Card size="small" bordered style={{ textAlign: 'center', height: '100%', borderRadius: 8 }}>
                                                        <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 }}>Digitized Documents</div>
                                                        <div style={{ fontSize: 20 }}>{(stats.totalDocs || 0).toLocaleString()}</div>
                                                    </Card>
                                                </Col>
                                                <Col span={6}>
                                                    <Card size="small" bordered style={{ textAlign: 'center', height: '100%', borderRadius: 8 }}>
                                                        <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 }}>Pages Processed</div>
                                                        <div style={{ fontSize: 20 }}>{(stats.totalPagesSaved || 0).toLocaleString()}</div>
                                                    </Card>
                                                </Col>
                                                <Col span={6}>
                                                    <Card size="small" bordered style={{ textAlign: 'center', height: '100%', borderRadius: 8 }}>
                                                        <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 }}>Savings ({targetMonthStr})</div>
                                                        <div style={{ fontSize: 20, color: theme.colors.success }}>฿{selectedMonthSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    </Card>
                                                </Col>
                                                <Col span={6}>
                                                    <Card size="small" bordered style={{ textAlign: 'center', height: '100%', borderRadius: 8 }}>
                                                        <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 8 }}>Target Progress (Month)</div>
                                                        <div style={{ fontSize: 20 }}>Not specified</div>
                                                    </Card>
                                                </Col>
                                            </Row>
                                        </Col>
                                    </Row>

                                    {/* Chart Section */}
                                    <div style={{ padding: '0 0 24px 0' }}>
                                        <h4 style={{ marginBottom: 16 }}>Cost Savings Trend</h4>
                                        <div style={{ position: 'relative', width: '100%', background: theme.colors.background, padding: '16px 16px 16px 0', borderRadius: 8, height: 350 }}>
                                            <Line data={lineData} options={lineOptions} />
                                        </div>
                                    </div>

                                    {/* Bottom Section */}
                                    <Row gutter={16}>
                                        <Col span={18}>
                                            <h4 style={{ marginBottom: 16 }}>Details by Month</h4>
                                            <Table
                                                dataSource={stats.chartData}
                                                columns={columns}
                                                rowKey="month"
                                                pagination={false}
                                                size="small"
                                                summary={() => (
                                                    <Table.Summary fixed>
                                                        <Table.Summary.Row style={{ background: theme.colors.background, fontWeight: 'bold' }}>
                                                            <Table.Summary.Cell index={0}>Total (Selected Period)</Table.Summary.Cell>
                                                            <Table.Summary.Cell index={1}>
                                                                {stats.chartData.reduce((acc, curr) => acc + (parseInt(curr.view_pages) || 0), 0).toLocaleString()} Pages
                                                            </Table.Summary.Cell>
                                                            <Table.Summary.Cell index={2}>
                                                                {stats.chartData.reduce((acc, curr) => acc + (parseInt(curr.action_pages) || 0), 0).toLocaleString()} Pages
                                                            </Table.Summary.Cell>
                                                            <Table.Summary.Cell index={3}>
                                                                <span style={{ color: '#52c41a' }}>
                                                                    ฿{stats.chartData.reduce((acc, curr) => {
                                                                        const vPages = parseInt(curr.view_pages) || 0;
                                                                        const aPages = parseInt(curr.action_pages) || 0;
                                                                        return acc + (vPages * 0.25) + (aPages * 0.50) + (includeSoftwareCost ? softwareCostPerMonth : 0);
                                                                    }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                            </Table.Summary.Cell>
                                                        </Table.Summary.Row>
                                                    </Table.Summary>
                                                )}
                                            />
                                        </Col>
                                        <Col span={6}>
                                            <h4 style={{ marginBottom: 16 }}>Action Cost Info</h4>
                                            <Card style={{ background: '#f8f9fa', borderRadius: 8, border: 'none' }} styles={{ body: { padding: 16 } }}>
                                                <p style={{ margin: '0 0 16px 0', color: theme.colors.textSecondary, fontSize: 13 }}>
                                                    Monitor and have info the action costs of action savings saved: <strong>฿{selectedMonthSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: theme.colors.textSecondary }}>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <InfoCircleOutlined style={{ color: theme.colors.primary, marginTop: 2 }} />
                                                        <span>View Action: 0.25 THB / Page</span>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <InfoCircleOutlined style={{ color: theme.colors.success, marginTop: 2 }} />
                                                        <span>Export/Merge Actions: 0.50 THB / Page</span>
                                                    </div>
                                                </div>
                                            </Card>
                                        </Col>
                                    </Row>
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
                                        locale={{ emptyText: <Empty description="No Document History" /> }}
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
                                        locale={{ emptyText: <Empty description="No Watermark Audit Data" /> }}
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
