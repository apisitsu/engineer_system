import React, { useState, useEffect } from 'react';
import {
<<<<<<< HEAD
    Layout, Spin, Typography, Card, Table, Input, Button, Select, Space, Radio, Tag, Row, Col, Modal, Form
} from 'antd';
import {
    PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined,
    SyncOutlined, ClockCircleOutlined, UnorderedListOutlined, CalendarOutlined, CheckCircleOutlined
=======
    Layout, Spin, Typography, Card, Table, Input, Button, Select, Space, Radio, Tag, Row, Col, Modal, App, Collapse
} from 'antd';
import {
    PlusOutlined, SyncOutlined, ClockCircleOutlined, UnorderedListOutlined, CheckCircleOutlined,
    StopOutlined
>>>>>>> old-work-backup
} from '@ant-design/icons';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import { useTheme } from '../../../../theme';
<<<<<<< HEAD
import axios from 'axios';
import moment from 'moment';

const { Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ToolRequest = () => {
=======
import { httpClient as axios } from '../../../../utils/HttpClient';
import moment from 'moment';
import RequestDetailsModal from './components/RequestDetailsModal';
import { 
    WORKFLOW_STATUS, 
    STATUS_COLORS, 
    FILTER_TYPES, 
    FILTER_TYPE_LABELS,
    isDoneStatus,
    isDeniedStatus,
} from '../../../../constants/workflowConstants';

const { Content } = Layout;
const { Title, Text } = Typography;

const ToolRequestContent = () => {
    const { message, modal } = App.useApp();
>>>>>>> old-work-backup
    const { theme } = useTheme();
    const userName = useAuthStore(state => state.userName);
    const userSection = useAuthStore(state => state.userSection);
    const userDepartment = useAuthStore(state => state.userDepartment);
<<<<<<< HEAD
=======
    const userInfo = useAuthStore(state => state.userInfo);
>>>>>>> old-work-backup

    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filterType, setFilterType] = useState('all');

    // Modal states
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
<<<<<<< HEAD
    const [form] = Form.useForm();
=======
>>>>>>> old-work-backup

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
<<<<<<< HEAD
            const { data } = await axios.get(server.MTC_TOOL_REQUESTS);
=======
            const { data } = await axios.get(server.MTC_TOOL_REQUESTS, { params: { limit: 200 } });
>>>>>>> old-work-backup
            setRequests(data.data || []);
        } catch (error) {
            console.error('Error fetching tool requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
<<<<<<< HEAD
        const newRequestData = {
            requester: userName,
            requester_email: userName ? `${userName}@company.com` : '',
=======
        setSelectedRequest({
            requester: userName,
            requester_email: userInfo?.gmail_email || '',
>>>>>>> old-work-backup
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
<<<<<<< HEAD
        };

        setSelectedRequest(newRequestData);
        form.resetFields();
        form.setFieldsValue(newRequestData);
=======
        });
>>>>>>> old-work-backup
        setIsEditing(true);
        setModalVisible(true);
    };

    const handleViewRequest = async (record) => {
        try {
<<<<<<< HEAD
            const { data } = await axios.get(`${server.MTC_TOOL_REQUEST_DETAIL}/${record.id}`);
            setSelectedRequest(data.data);
            form.setFieldsValue(data.data);
=======
            const { data } = await axios.get(`${server.MTC_TOOL_REQUESTS}/${record.id}`);
            setSelectedRequest(data.data);
>>>>>>> old-work-backup
            setIsEditing(false);
            setModalVisible(true);
        } catch (error) {
            console.error('Error fetching request details:', error);
<<<<<<< HEAD
=======
            message.error('Failed to fetch request details');
>>>>>>> old-work-backup
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        setSelectedRequest(null);
        setIsEditing(false);
<<<<<<< HEAD
        form.resetFields();
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            if (selectedRequest?.id) {
                // Update existing
                await axios.put(`${server.MTC_TOOL_REQUEST_DETAIL}/${selectedRequest.id}`, values);
            } else {
                // Create new
                await axios.post(server.MTC_TOOL_REQUESTS, values);
            }

            handleModalClose();
            fetchRequests();
        } catch (error) {
=======
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
>>>>>>> old-work-backup
            console.error('Error saving request:', error);
        }
    };

    const handleDelete = async (id) => {
<<<<<<< HEAD
        Modal.confirm({
=======
        modal.confirm({
>>>>>>> old-work-backup
            title: 'Confirm deletion',
            content: 'Are you sure you want to delete this request?',
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
<<<<<<< HEAD
                    await axios.delete(`${server.MTC_TOOL_REQUEST_DETAIL}/${id}`);
                    handleModalClose();
                    fetchRequests();
                } catch (error) {
                    console.error('Error deleting request:', error);
=======
                    await axios.delete(`${server.MTC_TOOL_REQUESTS}/${id}`);
                    handleModalClose();
                    fetchRequests();
                    message.success('Request deleted');
                } catch (error) {
                    console.error('Error deleting request:', error);
                    message.error('Failed to delete request');
>>>>>>> old-work-backup
                }
            }
        });
    };

    const handleFilterChange = (type) => {
        setFilterType(type);
    };

<<<<<<< HEAD
    // Filter data based on search and filter type
    const filteredRequests = requests.filter(item => {
        // Search filter
=======
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
>>>>>>> old-work-backup
        if (searchText) {
            const lowerSearch = searchText.toLowerCase();
            const matchesSearch =
                item.request_item?.toLowerCase().includes(lowerSearch) ||
<<<<<<< HEAD
=======
                item.req_no?.toLowerCase().includes(lowerSearch) ||
>>>>>>> old-work-backup
                item.title?.toLowerCase().includes(lowerSearch) ||
                item.requester?.toLowerCase().includes(lowerSearch) ||
                item.department?.toLowerCase().includes(lowerSearch);
            if (!matchesSearch) return false;
        }

<<<<<<< HEAD
        // Status filter
        if (filterType === 'pending') {
            return item.status === 'Pending';
        } else if (filterType === 'inProgress') {
            return item.status === 'In Progress';
        } else if (filterType === 'complete') {
            return item.status === 'Complete';
=======
        if (filterType === FILTER_TYPES.PENDING) {
            return item.status === WORKFLOW_STATUS.PENDING_ENG_CHECK;
        } else if (filterType === FILTER_TYPES.IN_PROGRESS) {
            return item.status?.startsWith('Pending') && item.status !== WORKFLOW_STATUS.PENDING_ENG_CHECK;
        } else if (filterType === FILTER_TYPES.COMPLETE) {
            return isDoneStatus(item.status) && !isDeniedStatus(item.status);
        } else if (filterType === FILTER_TYPES.DENIED) {
            return isDeniedStatus(item.status);
>>>>>>> old-work-backup
        }

        return true; // 'all'
    });

<<<<<<< HEAD
    const getStatusColor = (status) => {
        const colors = {
            'Pending': theme.colors.warning,
            'In Progress': theme.colors.info,
            'Complete': theme.colors.success,
            'Denied': theme.colors.error
        };
        return colors[status] || theme.colors.textTertiary;
    };
=======
    const getStatusColor = (status) => STATUS_COLORS[status] || 'default';
>>>>>>> old-work-backup

    const columns = [
        {
            title: 'Request Item',
            dataIndex: 'request_item',
            key: 'request_item',
            width: 160,
            fixed: 'left',
<<<<<<< HEAD
            render: (text) => <strong style={{ color: theme.colors.primary }}>{text}</strong>
        },
        {
            title: 'Request No.',
            dataIndex: 'request_no',
            key: 'request_no',
            width: 120,
            render: (text) => text || '-'
=======
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
>>>>>>> old-work-backup
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
<<<<<<< HEAD
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 110,
=======
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
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 150,
>>>>>>> old-work-backup
            render: (status) => (
                <Tag color={getStatusColor(status)}>{status}</Tag>
            )
        },
        {
            title: 'Stage',
            dataIndex: 'current_stage',
            key: 'current_stage',
            width: 120,
<<<<<<< HEAD
            render: (stage) => <Tag color={theme.colors.info}>{stage}</Tag>
=======
            render: (stage) => stage ? <Tag color="blue">{stage}</Tag> : '-'
>>>>>>> old-work-backup
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
        <Layout style={{ minHeight: '100vh' }}>
            <MenuTemplate type="MTC" defaultSelectedKeys="3" defaultOpenKeys="sub1" />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <Spin tip="Loading" size="large" spinning={loading}>
                    <Content style={{
                        height: '90vh',
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
<<<<<<< HEAD
                                            Tool Drawing Request System
=======
                                            General DWG Request
>>>>>>> old-work-backup
                                        </Title>
                                        <Text type="secondary">Manage and track tool & drawing requests</Text>
                                    </div>
                                </div>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    size="large"
                                    onClick={handleCreateNew}
                                >
                                    Create New Request
                                </Button>
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
<<<<<<< HEAD
                                                <Radio.Button value="pending">
                                                    <ClockCircleOutlined /> Pending
                                                </Radio.Button>
                                                <Radio.Button value="inProgress">
                                                    <SyncOutlined spin /> In Progress
                                                </Radio.Button>
                                                <Radio.Button value="complete">
                                                    <CheckCircleOutlined /> Complete
                                                </Radio.Button>
                                                <Radio.Button value="all">
=======
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
>>>>>>> old-work-backup
                                                    <UnorderedListOutlined /> All
                                                </Radio.Button>
                                            </Radio.Group>
                                        </Space>
                                    </Col>
                                </Row>
                            </Card>

<<<<<<< HEAD
                            {/* Table Section */}
                            <Card
                                title={
                                    <div style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                                        <Space wrap>
                                            <Text style={{ fontSize: 16 }}>Request List</Text>
                                            <Text style={{ color: theme.colors.textTertiary }}>
                                                ({filterType === 'pending' ? 'Pending' :
                                                    filterType === 'inProgress' ? 'In Progress' :
                                                        filterType === 'complete' ? 'Complete' : 'All'})
                                            </Text>
                                        </Space>
                                        <Text style={{ color: theme.colors.textTertiary, paddingRight: 8 }}>
                                            {filteredRequests.length} Requests
                                        </Text>
                                    </div>
                                }
                                style={{ marginTop: 16 }}
                            >
                                <Table
                                    dataSource={filteredRequests}
                                    columns={columns}
                                    rowKey="id"
                                    loading={loading}
                                    pagination={{ pageSize: 5 }}
                                    scroll={{ x: 'max-content' }}
                                />
                            </Card>
                        </div>

                        {/* Request Details Modal */}
                        <Modal
                            title={
                                selectedRequest?.id
                                    ? `Request Details: ${selectedRequest.request_item}`
                                    : 'Create New Request'
                            }
                            open={modalVisible}
                            onCancel={handleModalClose}
                            width={900}
                            footer={
                                isEditing ? (
                                    <Space>
                                        <Button onClick={handleModalClose}>Cancel</Button>
                                        <Button type="primary" onClick={handleSave}>Save</Button>
                                    </Space>
                                ) : (
                                    <Space>
                                        <Button onClick={() => setIsEditing(true)} icon={<EditOutlined />}>
                                            Edit
                                        </Button>
                                        {selectedRequest?.id && (
                                            <Button
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleDelete(selectedRequest.id)}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                        <Button onClick={handleModalClose}>Close</Button>
                                    </Space>
                                )
                            }
                        >
                            <Form
                                form={form}
                                layout="vertical"
                                initialValues={selectedRequest}
                                disabled={!isEditing}
                            >
                                <Title level={5}>Requester Information</Title>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Requester"
                                            name="requester"
                                            rules={[{ required: true }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Email" name="requester_email">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Department"
                                            name="department"
                                            rules={[{ required: true }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Work Center"
                                            name="work_center"
                                            rules={[{ required: true }]}
                                        >
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                <Title level={5} style={{ marginTop: 16 }}>Request Details</Title>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Type of Request"
                                            name="type_of_request"
                                            rules={[{ required: true }]}
                                        >
                                            <Select>
                                                <Option value="Regist Drawing">Regist Drawing</Option>
                                                <Option value="Draft Drawing">Draft Drawing</Option>
                                                <Option value="3D Print">3D Print</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item
                                            label="Category"
                                            name="category"
                                            rules={[{ required: true }]}
                                        >
                                            <Select>
                                                <Option value="Machine part">Machine part</Option>
                                                <Option value="Gauge">Gauge</Option>
                                                <Option value="Other">Other</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Drawing Required" name="drawing_required">
                                            <Select>
                                                <Option value="With Drawing">With Drawing</Option>
                                                <Option value="Without Drawing">Without Drawing</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Type of Drawing" name="type_of_drawing">
                                            <Select>
                                                <Option value="Copy">Copy</Option>
                                                <Option value="Remake">Remake</Option>
                                                <Option value="New Design">New Design</Option>
                                                <Option value="Modify">Modify</Option>
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                </Row>
                                <Form.Item
                                    label="Title"
                                    name="title"
                                    rules={[{ required: true }]}
                                >
                                    <Input />
                                </Form.Item>
                                <Form.Item
                                    label="Detail"
                                    name="detail"
                                    rules={[{ required: true }]}
                                >
                                    <TextArea rows={4} />
                                </Form.Item>

                                <Title level={5} style={{ marginTop: 16 }}>Machine Information (Optional)</Title>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <Form.Item label="Machine No." name="machine_no">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item label="Machine Name" name="machine_name">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form>
                        </Modal>
=======
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
>>>>>>> old-work-backup
                    </Content>
                </Spin>
            </Layout>
        </Layout>
    );
};

<<<<<<< HEAD
=======
const ToolRequest = () => (
    <App>
        <ToolRequestContent />
    </App>
);

>>>>>>> old-work-backup
export default ToolRequest;
