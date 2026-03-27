import React, { useState, useEffect } from 'react';
import { Card, Button, Form, Row, Col, Radio, Divider, Input, Upload, List, Tag, Spin, Space } from 'antd';
import { useTheme } from '../../../../../../theme';
import { UploadOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server, key_constance } from '../../../../../../constance/constance';

const { TextArea } = Input;

export default function Step3_6({ onNext, ecrData }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [tasks, setTasks] = useState([]);
    const [loadingTasks, setLoadingTasks] = useState(false);

    const userDept = localStorage.getItem("USER_DEPARTMENT") || "AD";
    const userName = localStorage.getItem(key_constance.USER_NAME) || "Admin ECR";

    useEffect(() => {
        if (ecrData?.id) {
            fetchTasks();
        }
    }, [ecrData?.id]);

    const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
            const res = await axios.get(`${server.ECR_REQUIRE_TASKS}${ecrData.id}/tasks`);
            if (res.data.data) {
                setTasks(res.data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingTasks(false);
        }
    };

    const handleAcknowledge = async (taskId) => {
        try {
            await axios.put(`${server.ECR_REQUIRE_ACK_TASK}${taskId}/ack`, { user_name: userName });
            Swal.fire("Acknowledged", "Task has been acknowledged.", "success");
            fetchTasks(); // Refresh tasks
        } catch (error) {
            Swal.fire("Error", "Failed to acknowledge task.", "error");
        }
    };

    const normFile = (e) => {
        if (Array.isArray(e)) return e;
        return e?.fileList;
    };

    const uploadFileToServer = async (fileList) => {
        if (fileList && fileList.length > 0 && fileList[0].originFileObj) {
            const formData = new FormData();
            formData.append('file', fileList[0].originFileObj);
            try {
                const res = await axios.post(server.UPLOAD_API, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.success) {
                    return res.data.file_url;
                }
            } catch (error) {
                console.error("File upload error", error);
            }
        }
        return null;
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // Validate all tasks are checked
            const uncompletedTasks = tasks.filter(t => !t.is_checked);
            if (uncompletedTasks.length > 0) {
                Swal.fire('Warning', `Waiting for ${uncompletedTasks.length} task(s) to be acknowledged.`, 'warning');
                return;
            }

            const fai_file = await uploadFileToServer(values.fai_file);

            Swal.fire('Success', 'FAI Summary submitted and ECN moving to Close.', 'success')
                .then(() => onNext(4.0, 'Approve', 'FAI Summary Submitted', { ...values, fai_file, actionTasks: tasks }));
        } catch (err) {
            console.error("Validation Failed:", err);
            if (err.errorFields) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Missing Required Fields',
                    text: 'Please fill in all required fields before submitting.'
                });
            }
        }
    };

    const allTasksAcknowledged = tasks.length > 0 && tasks.every(task => task.is_checked);

    return (
        <Card title="Step 3.6: FAI Summary & Cross-functional Approval"
            style={{ borderColor: theme.colors.success, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Row gutter={24}>
                    <Col span={24}>
                        <Divider orientation="left">Engineer FAI Summary</Divider>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="FAI Lot No." name="fai_lot" rules={[{ required: true }]}>
                            <Input placeholder="Enter Lot No. applied" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="FAI Result Details" name="fai_details">
                            <TextArea rows={2} />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item label="Attach FAI Result File" name="fai_file" valuePropName="fileList" getValueFromEvent={normFile}>
                            <Upload maxCount={1} beforeUpload={() => false}>
                                <Button icon={<UploadOutlined />}>Upload Summary</Button>
                            </Upload>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Target ECN Close Date" name="ecn_close_date" rules={[{ required: true }]}>
                            <Input type="date" />
                        </Form.Item>
                    </Col>

                    {/* Department Task Acknowledgement Section */}
                    {tasks.length > 0 && (
                        <>
                            <Col span={24}>
                                <Divider orientation="left">Department Tasks Acknowledgement</Divider>
                            </Col>
                            <Col span={24}>
                                {loadingTasks ? <Spin /> : (
                                    <List
                                        bordered
                                        dataSource={tasks}
                                        renderItem={(task) => {
                                            const isMyDept = userDept === task.dept_name || userDept === 'AD';
                                            return (
                                                <List.Item
                                                    actions={[
                                                        task.is_checked ? (
                                                            <Tag color="green" icon={<CheckCircleOutlined />}>
                                                                Acknowledged by {task.checked_by}
                                                            </Tag>
                                                        ) : (
                                                            <Button
                                                                type="primary"
                                                                size="small"
                                                                disabled={!isMyDept}
                                                                onClick={() => handleAcknowledge(task.id)}
                                                            >
                                                                Acknowledge
                                                            </Button>
                                                        )
                                                    ]}
                                                >
                                                    <List.Item.Meta
                                                        title={
                                                            <Space>
                                                                <Tag color="blue">{task.dept_name}</Tag>
                                                                {task.task_detail}
                                                            </Space>
                                                        }
                                                    />
                                                </List.Item>
                                            );
                                        }}
                                    />
                                )}
                            </Col>
                        </>
                    )}

                    <Col span={24}>
                        <Divider orientation="left">Final Submission</Divider>
                    </Col>
                </Row>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 30 }}>
                    <Button type="primary" onClick={handleSubmit} disabled={!allTasksAcknowledged}>
                        Submit Workflow
                    </Button>
                </div>
            </Form>
        </Card>
    );
}
