import React, { useState } from 'react';
import { Card, Button, Input, Form, Row, Col, Radio, Divider, Upload, Checkbox } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';
import axios from 'axios';
import { server } from '../../../../../../constance/constance';

const { TextArea } = Input;
const DEPARTMENTS = ['PC', 'QA', 'QC', 'PD1', 'PD2', 'MC', 'MM', 'PU'];

export default function Step3_5({ onNext, ecrData }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [selectedDepts, setSelectedDepts] = useState([]);

    // Watchers for conditional rendering
    const needHold = Form.useWatch('need_hold', form);

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

    const handleDeptToggle = (dept, checked) => {
        if (checked) {
            setSelectedDepts([...selectedDepts, dept]);
        } else {
            setSelectedDepts(selectedDepts.filter(d => d !== dept));
            form.setFieldValue(`task_detail_${dept}`, undefined); // Clear input
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            Swal.fire({
                title: 'Saving execution plan...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            // Upload files concurrently
            const upload_disposition_sheet = await uploadFileToServer(values.upload_disposition_sheet);
            const upload_exec_before = await uploadFileToServer(values.upload_exec_before);
            const upload_exec_after = await uploadFileToServer(values.upload_exec_after);

            // Construct tasks array from checkboxes
            const assigned_tasks = selectedDepts.map(dept => ({
                dept_name: dept,
                task_detail: values[`task_detail_${dept}`]
            }));

            // Save Dynamic Tasks to ecnt_tasks
            if (assigned_tasks.length > 0) {
                await axios.post(`${server.ECR_REQUIRE_TASKS}${ecrData.id}/tasks`, {
                    tasks: assigned_tasks
                });
            }

            // Clean up details payload
            const detailsPayload = { ...values, upload_disposition_sheet, upload_exec_before, upload_exec_after };
            // Remove prefixed task values from the main details JSON
            DEPARTMENTS.forEach(dept => delete detailsPayload[`task_detail_${dept}`]);

            Swal.fire('Complete', 'Execution & Plan details saved.', 'success')
                .then(() => onNext(3.6, 'Approve', 'Execution Plan Saved', detailsPayload));
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

    return (
        <Card title="Step 3.5: ECN Execution & Plan"
            style={{ borderColor: theme.colors.info, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Row gutter={24}>
                    {/* Schedule */}
                    <Col span={24}>
                        <Divider orientation="left">Target Schedule</Divider>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Target ECN Close Date" name="target_ecn_close_date" rules={[{ required: true }]}>
                            <Input type="date" />
                        </Form.Item>
                    </Col>

                    {/* Engineer Scope */}
                    <Col span={24}>
                        <Divider orientation="left">Engineer Assigned Scope</Divider>
                    </Col>
                    <Col span={24} md={8}>
                        <Form.Item label="Scope of Implementation" name="scope_implementation" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Describe the scope" />
                        </Form.Item>
                    </Col>
                    <Col span={24} md={8}>
                        <Form.Item label="Before Change" name="exec_before_change" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Current State" />
                        </Form.Item>
                        <Form.Item name="upload_exec_before" valuePropName="fileList" getValueFromEvent={normFile}>
                            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
                                <Button icon={<UploadOutlined />}>Attach Reference</Button>
                            </Upload>
                        </Form.Item>
                    </Col>
                    <Col span={24} md={8}>
                        <Form.Item label="After Change" name="exec_after_change" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Future State" />
                        </Form.Item>
                        <Form.Item name="upload_exec_after" valuePropName="fileList" getValueFromEvent={normFile}>
                            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
                                <Button icon={<UploadOutlined />}>Attach Reference</Button>
                            </Upload>
                        </Form.Item>
                    </Col>

                    {/* Production Control (PC) Scope */}
                    <Col span={24}>
                        <Divider orientation="left">Production Control (PC) Scope</Divider>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="need_hold" valuePropName="checked">
                            <Checkbox>Require Target Lots to Hold</Checkbox>
                        </Form.Item>
                        {needHold && (
                            <Form.Item label="Target Lots" name="target_lots" rules={[{ required: true, message: 'Please specify the target lots' }]}>
                                <Input placeholder="E.g., Lot #12345, #12346" />
                            </Form.Item>
                        )}
                    </Col>
                    <Col span={12}>
                        <Form.Item label="Upload Disposition Sheet" name="upload_disposition_sheet" valuePropName="fileList" getValueFromEvent={normFile}>
                            <Upload beforeUpload={() => false} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
                                <Button icon={<UploadOutlined />}>Upload File</Button>
                            </Upload>
                        </Form.Item>
                    </Col>

                    {/* Quality Control (QC) Scope */}
                    <Col span={24}>
                        <Divider orientation="left">Quality Control (QC) Scope</Divider>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="MSA Requirement" name="msa_requirement" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value="Require">Require</Radio>
                                <Radio value="Not Require">Not Require</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item label="FAI Requirement" name="fai_requirement" rules={[{ required: true }]}>
                            <Radio.Group>
                                <Radio value="Require">Require</Radio>
                                <Radio value="Full">Full</Radio>
                                <Radio value="Not Require">Not Require</Radio>
                            </Radio.Group>
                        </Form.Item>
                    </Col>

                    {/* Department Task Acknowledgement */}
                    <Col span={24}>
                        <Divider orientation="left">Department Tasks Acknowledgement (Optional)</Divider>
                        <div style={{ marginBottom: 16 }}>
                            <span style={{ color: '#888' }}>Check the departments that need to perform actions and specify the details.</span>
                        </div>
                    </Col>
                    <Col span={24}>
                        {DEPARTMENTS.map(dept => {
                            const isSelected = selectedDepts.includes(dept);
                            return (
                                <Row key={dept} align="middle" style={{ marginBottom: 8 }}>
                                    <Col span={4}>
                                        <Checkbox
                                            onChange={(e) => handleDeptToggle(dept, e.target.checked)}
                                        >
                                            {dept}
                                        </Checkbox>
                                    </Col>
                                    <Col span={20}>
                                        {isSelected && (
                                            <Form.Item
                                                style={{ marginBottom: 0 }}
                                                name={`task_detail_${dept}`}
                                                rules={[{ required: true, message: `Please describe the task for ${dept}` }]}
                                            >
                                                <Input placeholder={`Task description for ${dept} Mgr`} />
                                            </Form.Item>
                                        )}
                                    </Col>
                                </Row>
                            );
                        })}
                    </Col>
                </Row>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 30 }}>
                    <Button type="primary" onClick={handleSubmit}>Save Execution Plan</Button>
                </div>
            </Form>
        </Card>
    );
}
