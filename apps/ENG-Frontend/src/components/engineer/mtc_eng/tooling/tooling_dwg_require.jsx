import React, { useState, useEffect, useCallback } from "react";
import { Modal, Form, Input, DatePicker, Button, Row, Col, List, Card, Spin, Typography, Space, Tag } from "antd";
import {
    FileTextOutlined, SaveOutlined, ReloadOutlined, PlusOutlined, CalendarOutlined,
    CommentOutlined, CheckCircleOutlined, ClockCircleOutlined
} from "@ant-design/icons";
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import axios from "axios";
import moment from "moment";
import Swal from "sweetalert2";

const { TextArea } = Input;
const { Text, Title } = Typography;

const DWGRequestForm = ({ open, onCancel }) => {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [saveLoading, setSaveLoading] = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [pendingData, setPendingData] = useState([]);

    const fetchData = useCallback(async () => {
        try {
            setListLoading(true);
            const response = await axios.get(`${server.TOOLING_DWG_REQUEST_GETLIST}`);
            const listData = Array.isArray(response.data) ? response.data : (response.data.data || []);
            const filteredData = listData.filter(item => item.status === 'Pending');
            setPendingData(filteredData);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            fetchData();
        } else {
            form.resetFields();
            setPendingData([]);
        }
    }, [open, form, fetchData]);

    const handleRefresh = () => {
        fetchData();
    };

    const handleSave = () => {
        form.validateFields()
            .then(async (values) => {
                setSaveLoading(true);

                const requestdate = values.date_request ? moment(values.date_request).format('YYYY-MM-DD') : '';
                const payload = {
                    date_request: (values.date_request ? values.date_request : requestdate),
                    item: values.item,
                    remark: values.remark,
                    status: 'Pending',
                };

                try {
                    const res = await axios.post(`${server.TOOLING_DWG_REQUEST_ADD}`, payload);

                    if (res.data.result === "true" || res.data === "OK") {
                        await Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: res.data.message || 'Data saved successfully!',
                            timer: 1500,
                            showConfirmButton: false
                        });

                        form.resetFields();
                        fetchData();
                        onCancel();

                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Failed',
                            text: res.data.message || 'Something went wrong!'
                        });
                    }
                } catch (error) {
                    console.error("API Error:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Cannot connect to server.'
                    });
                } finally {
                    setSaveLoading(false);
                }
            })
            .catch((info) => {
                console.log("Validate Failed:", info);
            });
    };

    // Configuration Fields
    const formFields = [
        { name: 'date_request', label: 'Date Request', type: 'date', required: true, span: 24 },
        { name: 'item', label: 'Item', type: 'input', required: true, span: 24, placeholder: 'e.g., Bearing Shaft' },
        { name: 'remark', label: 'Remark', type: 'textarea', required: false, span: 24, placeholder: 'Additional notes...' },
    ];

    const renderComponent = (field) => {
        switch (field.type) {
            case 'textarea': return <TextArea rows={3} placeholder={field.placeholder} />;
            case 'input': return <Input placeholder={field.placeholder} />;
            case 'date': return <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />;
            default: return <Input />;
        }
    };

    const getStatusTag = (status) => {
        if (status === 'Complete') {
            return <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 4 }}>Complete</Tag>;
        }
        return <Tag icon={<ClockCircleOutlined />} color="warning" style={{ borderRadius: 4 }}>Pending</Tag>;
    };

    return (
        <Spin tip="Saving..." size="large" spinning={saveLoading}>
            <Modal
                title={<span><FileTextOutlined style={{ marginRight: 8 }} /> DWG Request Management</span>}
                open={open}
                onCancel={onCancel}
                footer={null}
                width={1100}
                centered
                forceRender
                destroyOnHidden={true}
                maskClosable={false}
            >
                <Row gutter={24} style={{ marginTop: 20 }}>

                    {/* --- Left Column: Form --- */}
                    <Col xs={24} md={9}>
                        <Card
                            title={<span><PlusOutlined /> Add New Request</span>}
                            size="small"
                            variant="borderless"
                            style={{ background: theme.colors.surfaceHover }}
                        >
                            <Form form={form} layout="vertical">
                                <Row gutter={[16, 0]}>
                                    {formFields.map((field, index) => (
                                        <Col key={field.name || index} span={field.span}>
                                            <Form.Item
                                                label={field.label}
                                                name={field.name}
                                                rules={field.required ? [{ required: true, message: `Please input ${field.label}!` }] : []}
                                                style={{ marginBottom: 16 }}
                                            >
                                                {renderComponent(field)}
                                            </Form.Item>
                                        </Col>
                                    ))}
                                </Row>

                                <Button
                                    type="primary"
                                    block
                                    icon={<SaveOutlined />}
                                    onClick={handleSave}
                                    style={{ marginTop: 8, backgroundColor: theme.colors.warning, borderColor: theme.colors.warning }}
                                    loading={saveLoading}
                                >
                                    Save DWG Request
                                </Button>
                            </Form>
                        </Card>
                    </Col>

                    {/* --- Right Column: Request List --- */}
                    <Col xs={24} md={15}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text strong style={{ fontSize: 16 }}>Request List</Text>
                            <Button
                                size="small"
                                icon={<ReloadOutlined />}
                                onClick={handleRefresh}
                                loading={listLoading}
                            >
                                Refresh
                            </Button>
                        </div>

                        <div style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: 4 }}>
                            <Spin tip="Loading data..." spinning={listLoading}>
                                <List
                                    dataSource={pendingData}
                                    renderItem={item => (
                                        <Card
                                            variant="outlined"
                                            style={{ marginBottom: 16, borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
                                        >
                                            <Row justify="space-between" align="middle">
                                                <Col>
                                                    <Space direction="vertical" size={2}>
                                                        <Space align="center">
                                                            <FileTextOutlined style={{ color: theme.colors.warning, fontSize: 18 }} />
                                                            <Title level={5} style={{ margin: 0 }}>{item.item}</Title>
                                                        </Space>

                                                        <Space align="center" style={{ color: theme.colors.textSecondary }}>
                                                            <CalendarOutlined />
                                                            <Text type="secondary">
                                                                {item.date_request
                                                                    ? moment(item.date_request, ["M/D/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).format("DD-MMM-YYYY")
                                                                    : "-"}
                                                            </Text>
                                                        </Space>

                                                        {item.remark && item.remark !== '-' && (
                                                            <Space align="start" style={{ color: theme.colors.textSecondary, marginTop: 4 }}>
                                                                <CommentOutlined style={{ marginTop: 4 }} />
                                                                <Text type="secondary" style={{ maxWidth: 300 }} ellipsis={{ tooltip: item.remark }}>
                                                                    {item.remark}
                                                                </Text>
                                                            </Space>
                                                        )}
                                                    </Space>
                                                </Col>
                                                <Col>
                                                    {getStatusTag(item.status)}
                                                </Col>
                                            </Row>
                                        </Card>
                                    )}
                                />
                            </Spin>
                        </div>
                    </Col>
                </Row>

                <div style={{ textAlign: 'right', marginTop: 24 }}>
                    <Button onClick={onCancel}>Close</Button>
                </div>
            </Modal>
        </Spin>
    );
};

export default DWGRequestForm;