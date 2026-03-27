import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Row, Col, Descriptions, Tag, Divider, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import moment from 'moment';

const { Option } = Select;
const { TextArea } = Input;

const RequestDetailsModal = ({ visible, onClose, request, isEditing, onSave, onDelete, onEdit }) => {
    const [form] = Form.useForm();
    const [localIsEditing, setLocalIsEditing] = useState(isEditing);

    useEffect(() => {
        setLocalIsEditing(isEditing);
    }, [isEditing]);

    useEffect(() => {
        if (request && visible) {
            form.setFieldsValue({
                ...request,
                req_due_date: request.req_due_date ? moment(request.req_due_date).format('YYYY-MM-DD') : null
            });
        }
    }, [request, visible, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            onSave(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const handleCancel = () => {
        if (localIsEditing && request && !request.id) {
            // New request being created, just close
            onClose();
        } else {
            // Existing request, revert to view mode
            setLocalIsEditing(false);
            form.setFieldsValue(request);
        }
    };

    if (!request) return null;

    const isNewRequest = !request.id;

    return (
        <Modal
            title={
                <span style={{ fontSize: '18px', fontWeight: 600 }}>
                    {isNewRequest ? '📝 Create New Tool Request' : `🔍 Request Details: ${request.request_item}`}
                </span>
            }
            open={visible}
            onCancel={onClose}
            width={900}
            footer={
                <Space>
                    {!isNewRequest && !localIsEditing && (
                        <>
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setLocalIsEditing(true);
                                    onEdit();
                                }}
                            >
                                Edit
                            </Button>
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => onDelete(request.id)}
                            >
                                Delete
                            </Button>
                        </>
                    )}
                    {localIsEditing && (
                        <>
                            <Button icon={<CloseOutlined />} onClick={handleCancel}>
                                Cancel
                            </Button>
                            <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit}>
                                Save
                            </Button>
                        </>
                    )}
                    {!localIsEditing && (
                        <Button onClick={onClose}>Close</Button>
                    )}
                </Space>
            }
        >
            {!localIsEditing && !isNewRequest ? (
                // View Mode
                <div>
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Request Item" span={1}>
                            <strong>{request.request_item}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Request No." span={1}>
                            {request.request_no || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Status" span={1}>
                            <Tag color={request.status === 'Complete' ? 'green' : 'orange'}>
                                {request.status}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Current Stage" span={1}>
                            <Tag color="blue">{request.current_stage}</Tag>
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Requester Information</Divider>
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Requester">{request.requester}</Descriptions.Item>
                        <Descriptions.Item label="Email">{request.requester_email || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Department">{request.department}</Descriptions.Item>
                        <Descriptions.Item label="Work Center">
                            {request.work_center} {request.work_center_name ? `(${request.work_center_name})` : ''}
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Request Details</Divider>
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Type of Request">{request.type_of_request || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Category">{request.category || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Drawing Required">{request.drawing_required || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Type of Drawing">{request.type_of_drawing || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Title" span={2}>{request.title || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Detail" span={2}>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{request.detail}</div>
                        </Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Machine Information</Divider>
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Machine No.">{request.machine_no || '-'}</Descriptions.Item>
                        <Descriptions.Item label="Machine Name">{request.machine_name || '-'}</Descriptions.Item>
                    </Descriptions>

                    <Divider orientation="left">Timeline</Divider>
                    <Descriptions bordered column={2} size="small">
                        <Descriptions.Item label="Created">
                            {moment(request.created_at).format('DD/MM/YYYY HH:mm')}
                        </Descriptions.Item>
                        <Descriptions.Item label="Due Date">
                            {request.req_due_date ? moment(request.req_due_date).format('DD/MM/YYYY') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Last Updated">
                            {request.updated_at ? moment(request.updated_at).format('DD/MM/YYYY HH:mm') : '-'}
                        </Descriptions.Item>
                    </Descriptions>
                </div>
            ) : (
                // Edit/Create Mode
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={request}
                >
                    <Divider orientation="left">Requester Information</Divider>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Requester"
                                name="requester"
                                rules={[{ required: true, message: 'Please input requester name' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Email"
                                name="requester_email"
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Department"
                                name="department"
                                rules={[{ required: true, message: 'Please input department' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Work Center"
                                name="work_center"
                                rules={[{ required: true, message: 'Please input work center' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item label="Work Center Name" name="work_center_name">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">Request Details</Divider>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Type of Request"
                                name="type_of_request"
                                rules={[{ required: true, message: 'Please select type' }]}
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
                                rules={[{ required: true, message: 'Please select category' }]}
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
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                label="Title"
                                name="title"
                                rules={[{ required: true, message: 'Please input title' }]}
                            >
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item
                                label="Detail"
                                name="detail"
                                rules={[{ required: true, message: 'Please input detail' }]}
                            >
                                <TextArea rows={4} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">Machine Information (Optional)</Divider>
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
            )}
        </Modal>
    );
};

export default RequestDetailsModal;
