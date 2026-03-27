import React, { useState, useEffect } from "react";
import { Layout, Spin, Card, Table, Tag, Input, Select, Empty, Tooltip, Button } from 'antd';
import axios from "axios";
import moment from "moment";
import SearchIcon from '@mui/icons-material/Search';
import { EyeOutlined } from '@ant-design/icons';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import StatusBadge from './components/StatusBadge';
import ECRDetailModal from './ECRDetailModal';

const { Content } = Layout;
const { Search } = Input;
const { Option } = Select;

export default function History() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [dataSource, setDataSource] = useState([]);
    const [searchText, setSearchText] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
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

    useEffect(() => {
        fetchECRData();
    }, []);

    const filteredData = dataSource.filter(item => {
        const matchSearch = item.ecr_no?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.objective?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.request_by?.toLowerCase().includes(searchText.toLowerCase());
        const matchStatus = statusFilter === "All" || item.process_status === statusFilter || item.status === statusFilter;
        return matchSearch && matchStatus;
    });

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
            title: 'Due Date',
            dataIndex: 'due_date',
            key: 'due_date',
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
                            setSelectedEcrId(record.id);
                            setIsDetailOpen(true);
                        }}
                    />
                </Tooltip>
            ),
        },
    ];

    return (
        <Spin tip="Loading" size="large" spinning={loading}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Content className="kb-vscroll" style={{ height: '100vh', overflowY: 'auto', padding: '15px' }}>
                <div style={{ padding: '24px', background: theme.colors.surface, borderRadius: '8px' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <SearchIcon sx={{ color: theme.colors.info, fontSize: 32 }} />
                            <h2 style={{ margin: 0, color: theme.colors.info }}>History & Search</h2>
                        </div>
                    </div>

                    <Card style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                            <div style={{ width: '300px' }}>
                                <Search
                                    placeholder="Search ECR No, Title, Requester..."
                                    onSearch={(value) => setSearchText(value)}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    enterButton
                                />
                            </div>
                            <Select defaultValue="All" style={{ width: 150 }} onChange={setStatusFilter}>
                                <Option value="All">All Status</Option>
                                <Option value="Draft">Draft</Option>
                                <Option value="Pending Dept Mgr">Pending Dept Mgr</Option>
                                <Option value="Impact Assessment">Impact Assessment</Option>
                                <Option value="Pending ECN Approval">Pending ECN Approval</Option>
                                <Option value="FAI Process">FAI Process</Option>
                                <Option value="Effective">Effective</Option>
                                <Option value="Closed">Closed</Option>
                            </Select>
                        </div>
                    </Card>

                    {/* Table */}
                    <Card title="Past ECR / ECN Records">
                        <Table
                            className="kb-vscroll"
                            dataSource={filteredData}
                            columns={columns}
                            rowKey={(record) => record.id}
                            loading={loading}
                            locale={{ emptyText: <Empty description="No records match your search" /> }}
                            pagination={{
                                defaultPageSize: 10,
                                pageSizeOptions: ['10', '20', '50', '100'],
                                position: ['bottomRight'],
                                showSizeChanger: true,
                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                            }}
                            scroll={{ x: 900 }}
                            onRow={(record) => ({
                                onClick: () => { setSelectedEcrId(record.id); setIsDetailOpen(true); },
                                style: { cursor: 'pointer' }
                            })}
                            size="middle"
                        />
                    </Card>
                </div>
            </Content>

            <ECRDetailModal
                open={isDetailOpen}
                ecrId={selectedEcrId}
                onClose={() => { setIsDetailOpen(false); setSelectedEcrId(null); }}
                onActionComplete={fetchECRData}
            />
        </Spin>
    );
}
