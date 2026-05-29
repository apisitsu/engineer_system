import React, { useState, useEffect } from 'react';
import {
    Layout, Spin, Typography, Card, Table, Input, Button, Select, Space, Radio, Tag, Row, Col, Modal, App, Collapse
} from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    PlusOutlined, SyncOutlined, ClockCircleOutlined, UnorderedListOutlined, CheckCircleOutlined,
    StopOutlined, SettingOutlined
} from '@ant-design/icons';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import { useTheme } from '../../../../theme';
import { httpClient as axios } from '../../../../utils/HttpClient';
import moment from 'moment';
import RequestDetailsModal from './RequestDetailsModal';
import { 
    WORKFLOW_STATUS, 
    STATUS_COLORS, 
    FILTER_TYPES, 
    FILTER_TYPE_LABELS,
    isDoneStatus,
    isDeniedStatus,
} from './workflowConstants';

const { Content } = Layout;
const { Title, Text } = Typography;

const ToolRequestContent = () => {
    const { message, modal } = App.useApp();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const userName = useAuthStore(state => state.userName);
    const userSection = useAuthStore(state => state.userSection);
    const userDepartment = useAuthStore(state => state.userDepartment);
    const userInfo = useAuthStore(state => state.userInfo);
    const userRole = useAuthStore(state => state.userRole);
    const isAdmin = userRole === 'AD' || userDepartment === 'AD';

    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Modal states
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchRequests();
    }, []);

    useEffect(() => {
        if (searchParams.get('action') === 'create') {
            handleCreateNew();
        }
    }, [searchParams]);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(server.MTC_TOOL_REQUESTS, { params: { limit: 200 } });
            setRequests(data.data || []);
        } catch (error) {
            console.error('Error fetching tool requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        setSelectedRequest({
            requester: userName,
            requester_email: userInfo?.gmail_email || '',
            department: userDepartment || '',
            work_center: '',
            work_center_name: '',
            type_of_request: '',
            category: '',
            drawing_required: '',
            type_of_drawing: '',
            title: '',
            detail: '',
            machine_no: '',
            machine_name: ''
        });
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleViewRequest = async (record) => {
        try {
            const { data } = await axios.get(`${server.MTC_TOOL_REQUESTS}/${record.id}`);
            setSelectedRequest(data.data);
            setIsEditing(false);
            setModalVisible(true);
        } catch (error) {
            console.error('Error fetching request details:', error);
            message.error('Failed to fetch request details');
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        setSelectedRequest(null);
        setIsEditing(false);
    };

    const handleSave = async (values) => {
        try {
            // Use FormData for file upload support
            const formData = new FormData();
            Object.keys(values).forEach(key => {
                if (key === 'attachment') {
                    const fileObj = values[key]?.[0]?.originFileObj;
                    if (fileObj) {
                        formData.append('attachment', fileObj);
                    }
                } else if (values[key] !== undefined && values[key] !== null) {
                    formData.append(key, values[key]);
                }
            });

            const config = {
                headers: { 'Content-Type': 'multipart/form-data' }
            };

            if (selectedRequest?.id) {
                await axios.put(`${server.MTC_TOOL_REQUESTS}/${selectedRequest.id}`, formData, config);
            } else {
                await axios.post(server.MTC_TOOL_REQUESTS, formData, config);
            }
            message.success(selectedRequest?.id ? 'Request updated' : 'Request created');
            handleModalClose();
            fetchRequests();
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || 'Failed to save request';
            message.error(errorMsg);
            console.error('Error saving request:', error);
        }
    };

    const handleDelete = async (id) => {
        modal.confirm({
            title: 'Confirm deletion',
            content: 'Are you sure you want to delete this request?',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await axios.delete(`${server.MTC_TOOL_REQUESTS}/${id}`);
                    handleModalClose();
                    fetchRequests();
                    message.success('Request deleted');
                } catch (error) {
                    console.error('Error deleting request:', error);
                    message.error('Failed to delete request');
                }
            }
        });
    };

    const handleFilterChange = (type) => {
        setFilterType(type);
    };

    // Group requests by Year → Month (year ascending, month ascending within year)
    const groupByYearMonth = (items) => {
        const yearMap = {};
        items.forEach(item => {
            const date = item.created_at ? moment(item.created_at) : moment();
            const year = date.format('YYYY');
            const monthKey = date.format('YYYY-MM');
            if (!yearMap[year]) yearMap[year] = {};
            if (!yearMap[year][monthKey]) yearMap[year][monthKey] = [];
            yearMap[year][monthKey].push(item);
        });
        return Object.entries(yearMap)
            .sort(([a], [b]) => a.localeCompare(b)) // year ascending (oldest on top)
            .map(([year, monthMap]) => ({
                year,
                totalCount: Object.values(monthMap).reduce((s, r) => s + r.length, 0),
                months: Object.entries(monthMap)
                    .sort(([a], [b]) => a.localeCompare(b)) // month ascending Jan→Dec
                    .map(([monthKey, rows]) => ({
                        key: monthKey,
                        label: moment(monthKey, 'YYYY-MM').format('MMMM'),
                        rows
                    }))
            }));
    };

    // Filter data based on search and filter type
    const filteredRequests = requests.filter(item => {
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            const matchesSearch =
                item.request_item?.toLowerCase().includes(lowerSearch) ||
                item.req_no?.toLowerCase().includes(lowerSearch) ||
                item.title?.toLowerCase().includes(lowerSearch) ||
                item.requester?.toLowerCase().includes(lowerSearch) ||
                item.department?.toLowerCase().includes(lowerSearch);
            if (!matchesSearch) return false;
        }

        if (filterType === FILTER_TYPES.PENDING) {
            return item.status === WORKFLOW_STATUS.PENDING_ENG_CHECK;
        } else if (filterType === FILTER_TYPES.IN_PROGRESS) {
            return item.status?.startsWith('Pending') && item.status !== WORKFLOW_STATUS.PENDING_ENG_CHECK;
        } else if (filterType === FILTER_TYPES.COMPLETE) {
            return isDoneStatus(item.status) && !isDeniedStatus(item.status);
        } else if (filterType === FILTER_TYPES.DENIED) {
            return isDeniedStatus(item.status);
        }

        return true; // 'all'
    });

    const getStatusColor = (status) => STATUS_COLORS[status] || 'default';

    const columns = [
        {
            title: 'Request Item',
            dataIndex: 'request_item',
            key: 'request_item',
            width: 160,
            fixed: 'left',
            render: (text, record) => <strong style={{ color: theme.colors.primary }}>{text || record.req_no || '-'}</strong>
        },
        {
            title: 'Request No.',
            dataIndex: 'req_no',
            key: 'req_no',
            width: 130,
            render: (text, record) => {
                const display = text && text !== record.request_item ? text : null;
                return display ? <Text style={{ color: '#1890ff', fontWeight: 600 }}>{display}</Text> : '-';
            }
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 110,
            render: (date) => moment(date).format('DD-MMM-YYYY')
        },
        {
            title: 'Requester',
            dataIndex: 'requester',
            key: 'requester',
            width: 120
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
            width: 110
        },
        {
            title: 'Type',
            dataIndex: 'type_of_request',
            key: 'type_of_request',
            width: 130
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 110
        },
        {
            title: 'Title',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            width: 250
        },
        {
            title: 'Due Date',
            dataIndex: 'req_due_date',
            key: 'req_due_date',
            width: 110,
            render: (date, record) => {
                if (!date) return '-';
                const isOverdue = moment(date).isBefore(moment(), 'day') &&
                    !['Completed & Informed', 'Denied', 'Denied by Approve'].includes(record.status);
                return (
                    <Text type={isOverdue ? 'danger' : undefined} style={isOverdue ? { fontWeight: 600 } : {}}>
                        {moment(date).format('DD-MMM-YY')}
                    </Text>
                );
            }
        },
        {
            title: 'Perf.',
            dataIndex: 'completion_status',
            key: 'completion_status',
            width: 100,
            render: (status, record) => {
                if (!status || status === 'Pending') return '-';
                const color = status === 'On time' ? 'success' : 'error';
                return (
                    <Space direction="vertical" size={0}>
                        <Tag color={color} style={{ margin: 0 }}>{status}</Tag>
                        {record.diff_days > 0 && (
                            <Text type="secondary" style={{ fontSize: '10px' }}>
                                ({record.diff_days} day{record.diff_days > 1 ? 's' : ''})
                            </Text>
                        )}
                    </Space>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 150,
            render: (status) => (
                <Tag color={getStatusColor(status)}>{status}</Tag>
            )
        },
        {
            title: 'Stage',
            dataIndex: 'current_stage',
            key: 'current_stage',
            width: 120,
            render: (stage) => stage ? <Tag color="blue">{stage}</Tag> : '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            fixed: 'right',
            render: (_, record) => (
                <Button
                    size="small"
                    type="primary"
                    onClick={() => handleViewRequest(record)}
                >
                    View
                </Button>
            )
        }
    ];

    return (
        <Layout style={{ height: '100%' }}>
            <MenuTemplate type="MTC" defaultSelectedKeys="3" defaultOpenKeys="sub1" />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Spin tip="Loading" size="large" spinning={loading}>
                    <Content style={{
                        height: 'calc(100vh - 64px)',
                        overflowY: 'auto',
                        padding: '15px'
                    }}>
                        <div style={{ padding: '24px', background: theme.colors.background }}>

                            {/* Header Section */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'Left', alignItems: 'center' }}>
                                    <AssessmentRoundedIcon sx={{ color: theme.colors.success, fontSize: 60 }} />
                                    <div style={{ padding: '16px 16px' }}>
                                        <Title level={2} style={{ marginBottom: 0 }}>
                                            General DWG Request
                                        </Title>
                                        <Text type="secondary">Manage and track tool & drawing requests</Text>
                                    </div>
                                </div>
                                <Space>
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        size="large"
                                        onClick={handleCreateNew}
                                    >
                                        Create New Request
                                    </Button>
                                    {isAdmin && (
                                        <Button
                                            icon={<SettingOutlined />}
                                            size="large"
                                            onClick={() => navigate('/eng/mtc/email-config')}
                                        >
                                            Setting
                                        </Button>
                                    )}
                                </Space>
                            </div>

                            {/* Filter Section */}
                            <Card style={{ marginTop: 16 }}>
                                <Row gutter={[16, 16]} align="middle">
                                    <Col xs={24} md={8}>
                                        <Space.Compact style={{ width: 300 }}>
                                            <Input
                                                placeholder="Search item, title, requester..."
                                                allowClear
                                                onChange={(e) => setSearchText(e.target.value)}
                                            />
                                            <Button type="primary">Search</Button>
                                        </Space.Compact>
                                    </Col>

                                    <Col xs={24} md={16} style={{ textAlign: 'right' }}>
                                        <Space wrap>
                                            <Button icon={<SyncOutlined />} onClick={fetchRequests}>
                                                Refresh
                                            </Button>

                                            <Radio.Group
                                                value={filterType}
                                                buttonStyle="solid"
                                                onChange={(e) => handleFilterChange(e.target.value)}
                                            >
                                                <Radio.Button value={FILTER_TYPES.PENDING}>
                                                    <ClockCircleOutlined /> Eng Check
                                                </Radio.Button>
                                                <Radio.Button value={FILTER_TYPES.IN_PROGRESS}>
                                                    <SyncOutlined spin /> In Progress
                                                </Radio.Button>
                                                <Radio.Button value={FILTER_TYPES.COMPLETE}>
                                                    <CheckCircleOutlined /> Complete
                                                </Radio.Button>
                                                <Radio.Button value={FILTER_TYPES.DENIED}>
                                                    <StopOutlined /> Denied
                                                </Radio.Button>
                                                <Radio.Button value={FILTER_TYPES.ALL}>
                                                    <UnorderedListOutlined /> All
                                                </Radio.Button>
                                            </Radio.Group>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>

                            {/* Table Section — grouped by Year → Month (collapsed by default) */}
                            <div style={{ marginTop: 16 }}>
                                <Collapse
                                    ghost
                                    items={groupByYearMonth(filteredRequests).map(yearGroup => ({
                                        key: yearGroup.year,
                                        label: (
                                            <Space>
                                                <Text strong style={{ fontSize: 15 }}>{yearGroup.year}</Text>
                                                <Tag color="geekblue">{yearGroup.totalCount} requests</Tag>
                                            </Space>
                                        ),
                                        children: (
                                            <Collapse
                                                ghost
                                                items={yearGroup.months.map(monthGroup => ({
                                                    key: monthGroup.key,
                                                    label: (
                                                        <Space>
                                                            <Text style={{ fontSize: 13 }}>{monthGroup.label}</Text>
                                                            <Tag color="blue">{monthGroup.rows.length} request{monthGroup.rows.length !== 1 ? 's' : ''}</Tag>
                                                        </Space>
                                                    ),
                                                    children: (
                                                        <Table
                                                            dataSource={monthGroup.rows}
                                                            columns={columns}
                                                            rowKey="id"
                                                            pagination={false}
                                                            scroll={{ x: 'max-content' }}
                                                            size="small"
                                                            onRow={(record) => ({
                                                                onDoubleClick: () => handleViewRequest(record),
                                                                style: { cursor: 'pointer' }
                                                            })}
                                                        />
                                                    )
                                                }))}
                                                style={{ marginLeft: 8 }}
                                            />
                                        )
                                    }))}
                                    style={{ background: theme.colors.surface, borderRadius: 8 }}
                                />
                            </div>
                        </div>

                        {/* Request Details Modal */}
                        <RequestDetailsModal
                            visible={modalVisible}
                            onClose={handleModalClose}
                            request={selectedRequest}
                            isEditing={isEditing}
                            onSave={handleSave}
                            onDelete={handleDelete}
                            onEdit={() => setIsEditing(true)}
                            onActionDone={() => { fetchRequests(); handleModalClose(); }}
                        />
                    </Content>
                </Spin>
            </Layout>
        </Layout>
    );
};

const ToolRequest = () => (
    <App>
        <ToolRequestContent />
    </App>
);

export default ToolRequest;
