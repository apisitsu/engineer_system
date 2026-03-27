import React, { useState, useEffect, useMemo } from "react";
import { Layout, Spin, Card, Row, Col, Table, Tag, Progress, Button, Select, Empty, Tooltip } from 'antd';
import { PlusCircleOutlined, EyeOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import StatusBadge from './components/StatusBadge';
import CreateECRModal from './CreateECRModal';
import ECRDetailModal from './ECRDetailModal';

const { Content } = Layout;

export default function Dashboard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [dataSource, setDataSource] = useState([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedEcrId, setSelectedEcrId] = useState(null);

    const fetchECRData = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${server.ECR_REQUIRE_GETLIST}`);
            setDataSource(response.data.data);
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const dashboardStats = useMemo(() => {
        const totalJobs = dataSource.length;
        const onTimeCount = dataSource.filter(item => {
            if (!item.due_date) return false;
            return moment().isSameOrBefore(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
        }).length;
        const delayCount = dataSource.filter(item => {
            if (!item.due_date) return false;
            return moment().isAfter(moment(item.due_date), 'day') && item.process_status?.toLowerCase() !== 'pending';
        }).length;
        const pendingCount = dataSource.filter(item => item.process_status?.toLowerCase() === 'pending').length;

        return {
            totalJobs,
            onTimeCount,
            delayCount,
            pendingCount,
            onTimePercent: totalJobs > 0 ? Number(((onTimeCount / totalJobs) * 100).toFixed(1)) : 0,
            delayPercent: totalJobs > 0 ? Number(((delayCount / totalJobs) * 100).toFixed(1)) : 0,
            pendingPercent: totalJobs > 0 ? Number(((pendingCount / totalJobs) * 100).toFixed(1)) : 0,
        };
    }, [dataSource]);

    useEffect(() => {
        fetchECRData();
    }, []);

    const openDetail = (id) => {
        setSelectedEcrId(id);
        setIsDetailOpen(true);
    };

    const columns = [
        {
            title: 'Document No.',
            dataIndex: 'ecr_no',
            key: 'ecr_no',
        },
        {
            title: 'Title',
            key: 'title',
            render: (_, record) => (
                <span>{record.objective || 'N/A'}</span>
            ),
        },
        {
            title: 'Change Type',
            key: 'change_type',
            width: 200,
            render: (_, record) => (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {record.is_drawing && <Tag color="blue">Drawing</Tag>}
                    {record.is_tooling && <Tag color="orange">Tooling</Tag>}
                    {record.is_program && <Tag color="purple">Program</Tag>}
                    {record.is_usage && <Tag color="cyan">Usage</Tag>}
                </div>
            ),
        },
        {
            title: 'Status',
            key: 'process_status',
            dataIndex: 'process_status',
            width: 160,
            render: (text) => <StatusBadge status={text || 'Pending Dept Mgr'} />,
        },
        {
            title: 'Requester',
            dataIndex: 'request_by',
            key: 'request_by',
            width: 120,
        },
        {
            title: 'Require Date',
            dataIndex: 'require_date',
            key: 'require_date',
            width: 130,
            render: (text) => text ? moment(text).format('DD-MMM-YYYY') : '-'
        },
        {
            title: 'Action',
            key: 'action',
            width: 80,
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View Details">
                    <Button
                        type="link"
                        icon={<EyeOutlined style={{ fontSize: 18 }} />}
                        onClick={(e) => {
                            e.stopPropagation();
                            openDetail(record.id);
                        }}
                    />
                </Tooltip>
            ),
        },
    ];

    return (
        <Spin tip="Loading" size="large" spinning={loading}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Content className="kb-vscroll" style={{
                height: 'calc(100vh - 64px)',
                overflowY: 'auto',
                padding: '15px'
            }}>
                <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: '8px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 32 }} />
                            <h2 style={{ margin: 0, color: theme.colors.primary }}>ECR / ECN Dashboard</h2>
                        </div>
                        <Button type="primary" size="large" onClick={() => setIsCreateOpen(true)}>
                            + Create New ECR
                        </Button>
                    </div>

                    {/* Stats Cards */}
                    <Row gutter={[16, 16]} style={{ marginTop: 20 }}>
                        <Col span={16}>
                            <Row padding={8} gutter={[16, 16]}>
                                <Col span={12}>
                                    <Card size="small" title="Total Jobs">
                                        <h2 style={{ color: theme.colors.primary }}>{dashboardStats.totalJobs}</h2>
                                    </Card>
                                    <Card size="small" title="Delay" style={{ marginTop: 10 }}>
                                        <h2 style={{ color: theme.colors.error }}>{dashboardStats.delayCount}</h2>
                                    </Card>
                                </Col>
                                <Col span={12}>
                                    <Card size="small" title="On Time">
                                        <h2 style={{ color: theme.colors.success }}>{dashboardStats.onTimeCount}</h2>
                                    </Card>
                                    <Card size="small" title="Pending" style={{ marginTop: 10 }}>
                                        <h2 style={{ color: theme.colors.warning }}>{dashboardStats.pendingCount}</h2>
                                    </Card>
                                </Col>
                            </Row>
                        </Col>
                        <Col span={8}>
                            <Card size="small" title="Performance Overview" style={{ height: '100%' }}>
                                On Time <Progress percent={dashboardStats.onTimePercent} strokeColor={theme.colors.success} size="small" />
                                Pending <Progress percent={dashboardStats.pendingPercent} strokeColor={theme.colors.warning} size="small" />
                                Delay <Progress percent={dashboardStats.delayPercent} strokeColor={theme.colors.error} size="small" />
                            </Card>
                        </Col>
                    </Row>

                    {/* Table */}
                    <Card title={
                        <div style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                            <div>Recent Engineering Change Requests</div>
                        </div>
                    }
                        style={{ marginTop: 20 }}
                    >
                        <Table
                            className="kb-vscroll"
                            dataSource={dataSource}
                            columns={columns}
                            rowKey={(record) => record.id}
                            loading={loading}
                            locale={{ emptyText: <Empty description="No ECR records found" /> }}
                            pagination={{
                                defaultPageSize: 10,
                                pageSizeOptions: ['5', '10', '20', '50'],
                                position: ['bottomRight'],
                                showSizeChanger: true,
                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                            }}
                            scroll={{ x: 900 }}
                            onRow={(record) => ({
                                onClick: () => openDetail(record.id),
                                style: { cursor: 'pointer' }
                            })}
                            size="middle"
                        />
                    </Card>
                </div>
            </Content>

            <CreateECRModal
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={() => {
                    setIsCreateOpen(false);
                    fetchECRData();
                }}
            />

            <ECRDetailModal
                open={isDetailOpen}
                ecrId={selectedEcrId}
                onClose={() => { setIsDetailOpen(false); setSelectedEcrId(null); }}
                onActionComplete={fetchECRData}
            />
        </Spin>
    );
}
