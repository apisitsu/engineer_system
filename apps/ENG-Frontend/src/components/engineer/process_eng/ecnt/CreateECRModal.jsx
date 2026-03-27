import React, { useState, useEffect } from "react";
import { Form, Input, Checkbox, Spin, Button, Row, Col, DatePicker, Space, Upload, Radio, Divider, Card, Modal } from "antd";
import { UploadOutlined, SaveOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Swal from "sweetalert2";
import moment from "moment";
import axios from "axios";
import { server, key_constance } from '../../../../constance/constance';
import imageCompression from 'browser-image-compression';
import { useTheme } from '../../../../theme';

export default function CreateECRModal({ open, onClose, onSuccess }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Watch fields for dynamic rendering
    const objective = Form.useWatch("objective", form);
    const changeList = Form.useWatch("change", form) || [];

    const isDrawing = changeList.includes("Drawing");
    const isTooling = changeList.includes("Tooling");
    const isProgram = changeList.includes("Program");
    const isUsage = changeList.includes("Usage");

    const hasToolProUsage = isTooling || isProgram || isUsage;
    const hasToolUsage = isTooling || isUsage;
    const hasToolPro = isTooling || isProgram;

    useEffect(() => {
        if (open) {
            let userName = localStorage.getItem(key_constance.USER_NAME);
            let user_role = localStorage.getItem(key_constance.ROLE);

            let roleMap = {
                "AD": "Admin",
                "ENG": "Engineer",
                "MM": "Maintenance",
                "PC": "Production Control",
                "PROD": "Production",
                "QA": "Quality Assurance",
                "QC": "Quality Control",
                "PO": "Purchasing",
                "IT": "IT Support",
            };

            const fullRoleName = roleMap[user_role] || "User";

            form.setFieldsValue({
                request_by: userName,
                require_date: moment(),
                department: fullRoleName,
                status: "Permanent",
            });
        } else {
            form.resetFields();
        }
    }, [open, form]);

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

    const onSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const requireDate = values.require_date ? values.require_date.toISOString() : null;
            const dueDate = values.due_date ? values.due_date.toISOString() : null;

            const [
                drawingBefore, drawingAfter,
                setupBefore, setupAfter,
                cuttingBefore, cuttingAfter
            ] = await Promise.all([
                uploadFileToServer(values.upload_drawing_before),
                uploadFileToServer(values.upload_drawing_after),
                uploadFileToServer(values.upload_setup_before),
                uploadFileToServer(values.upload_setup_after),
                uploadFileToServer(values.upload_cutting_before),
                uploadFileToServer(values.upload_cutting_after)
            ]);

            const payload = {
                ...values,
                require_date: requireDate,
                due_date: dueDate,
                is_drawing: changeList.includes("Drawing"),
                is_tooling: changeList.includes("Tooling"),
                is_program: changeList.includes("Program"),
                is_usage: changeList.includes("Usage"),
                upload_drawing_before: drawingBefore,
                upload_drawing_after: drawingAfter,
                upload_setup_before: setupBefore,
                upload_setup_after: setupAfter,
                upload_cutting_before: cuttingBefore,
                upload_cutting_after: cuttingAfter,
                change: undefined,
                process_status: 'Pending Dept Mgr'
            };

            await axios.post(`${server.ECR_REQUIRE_CREATE}`, payload);

            setLoading(false);
            Swal.fire({
                icon: "success",
                title: "ECR Created Successfully",
                showConfirmButton: false,
                timer: 1500,
            }).then(() => {
                if (onSuccess) onSuccess();
                onClose();
            });

        } catch (error) {
            setLoading(false);
            console.error("Submit Error:", error);
            if (error.errorFields) {
                Swal.fire({ icon: "warning", title: "Missing Fields", text: "Please check your input in the required fields." });
                return;
            }
            Swal.fire({ icon: "error", title: "Submission Failed", text: "Cannot save data to the system." });
        }
    };

    return (
        <Modal
            title={<span style={{ color: theme.colors.primary, fontSize: '1.2em', fontWeight: 600 }}>Create New ECR</span>}
            width={800}
            open={open}
            onCancel={onClose}
            centered
            destroyOnClose
            maskClosable={false}
            styles={{
                body: {
                    maxHeight: 'calc(100vh - 250px)',
                    overflowY: 'auto',
                    paddingRight: 8,
                },
            }}
            footer={
                <div style={{ textAlign: 'right', padding: '8px 0' }}>
                    <Space size="middle">
                        <Button icon={<CloseCircleOutlined />} onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="primary" icon={<SaveOutlined />} onClick={onSubmit} loading={loading}>
                            Submit Request
                        </Button>
                    </Space>
                </div>
            }
        >
            <Spin tip="Submitting ECR..." size="large" spinning={loading}>
                <Form form={form} layout="vertical" disabled={loading}>
                    <Row gutter={[24, 16]}>
                        {/* General Info */}
                        <Col span={24}><Divider orientation="left">General Information</Divider></Col>
                        <Col span={8}>
                            <Form.Item label="ECR No." name="ecr_no">
                                <Input disabled placeholder="Auto Generate" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Request By" name="request_by" rules={[{ required: true }]}>
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Department" name="department" rules={[{ required: true }]}>
                                <Input disabled />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Require Date" name="require_date" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} disabled format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Due Date" name="due_date" rules={[{ required: true }]}>
                                <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
                            </Form.Item>
                        </Col>

                        {/* Objective & Status */}
                        <Col span={24}><Divider orientation="left">Objective & Status</Divider></Col>
                        <Col span={24}>
                            <Form.Item label="Status Type" name="status" rules={[{ required: true }]}>
                                <Radio.Group>
                                    <Radio value="Permanent">Permanent</Radio>
                                    <Radio value="Temporary">Temporary</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Objective" name="objective" rules={[{ required: true }]}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Radio.Group style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        <Radio value="Reduce cycle">Reduce cycle</Radio>
                                        <Radio value="Cost reduction">Cost reduction</Radio>
                                        <Radio value="Increase usage tooling">Increase usage tooling</Radio>
                                        <Radio value="Improve yield">Improve yield</Radio>
                                        <Radio value="Other">Other</Radio>
                                    </Radio.Group>
                                </div>
                            </Form.Item>
                            {objective === "Other" && (
                                <Form.Item name="objective_others" rules={[{ required: true, message: 'Please specify other objective' }]}>
                                    <Input.TextArea placeholder="Please specify your objective" rows={2} />
                                </Form.Item>
                            )}
                        </Col>

                        {/* Change Types */}
                        <Col span={24}><Divider orientation="left">Change Type</Divider></Col>
                        <Col span={24}>
                            <Form.Item label="Select Change Types" name="change" rules={[{ required: true, message: 'Please select at least one change type' }]}>
                                <Checkbox.Group>
                                    <Space size="large" wrap>
                                        <Checkbox value="Drawing">Product/Process Drawing</Checkbox>
                                        <Checkbox value="Tooling">Tooling</Checkbox>
                                        <Checkbox value="Program">Program</Checkbox>
                                        <Checkbox value="Usage">Usage</Checkbox>
                                    </Space>
                                </Checkbox.Group>
                            </Form.Item>
                        </Col>

                        {/* Condition C: Drawing Details */}
                        {isDrawing && (
                            <Col span={24}>
                                <Card type="inner" title="Product/Process Drawing Change Details" style={{ borderColor: theme.colors.info }}>
                                    <Row gutter={[16, 16]}>
                                        <Col span={8}><Form.Item name="part_no_drawing" label="Part No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={8}><Form.Item name="cn_drawing" label="C/N" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={8}><Form.Item name="rev_drawing" label="Revision" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="drawing_before_change" label="Before Change Description" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="drawing_after_change" label="After Change Description" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_drawing_before" label="Upload Before Change Image" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture" accept="image/*"><Button icon={<UploadOutlined />}>Upload</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_drawing_after" label="Upload After Change Image" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture" accept="image/*"><Button icon={<UploadOutlined />}>Upload</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}

                        {/* Condition A: Setup Data Sheet */}
                        {hasToolProUsage && (
                            <Col span={24}>
                                <Card type="inner" title="General Details (Tooling/Program/Usage)" style={{ borderColor: theme.colors.info }}>
                                    <Row gutter={[16, 16]}>
                                        <Col span={6}><Form.Item name="setup_data_sheet_no" label="Setup Data Sheet No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={6}><Form.Item name="part_no_tooling" label="Part No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={6}><Form.Item name="cn_tooling" label="C/N" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={6}><Form.Item name="cycle_time" label="Cycle Time Before/After" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}

                        {/* Condition D: Setup Data Sheet Before/After */}
                        {hasToolProUsage && (
                            <Col span={24}>
                                <Card type="inner" title="Setup Data Sheet (Before & After)" style={{ borderColor: theme.colors.secondary }}>
                                    <Row gutter={[16, 16]}>
                                        <Col span={12}><Form.Item name="setup_desc_before" label="Setup Data Sheet Before Change" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="setup_desc_after" label="Setup Data Sheet After Change" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_setup_before" label="Upload Setup Before" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture" accept="image/*"><Button icon={<UploadOutlined />}>Upload</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_setup_after" label="Upload Setup After" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture" accept="image/*"><Button icon={<UploadOutlined />}>Upload</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}

                        {/* Condition E: Cutting Program */}
                        {hasToolPro && (
                            <Col span={24}>
                                <Card type="inner" title="Cutting Program & Condition (Before & After)" style={{ borderColor: theme.colors.success }}>
                                    <Row gutter={[16, 16]}>
                                        <Col span={12}><Form.Item name="cutting_desc_before" label="Cutting Program Before Change" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="cutting_desc_after" label="Cutting Program After Change" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item></Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_cutting_before" label="Upload Cutting Before" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture"><Button icon={<UploadOutlined />}>Upload File</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item name="upload_cutting_after" label="Upload Cutting After" valuePropName="fileList" getValueFromEvent={normFile}>
                                                <Upload beforeUpload={() => false} maxCount={1} listType="picture"><Button icon={<UploadOutlined />}>Upload File</Button></Upload>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}

                        {/* Condition B: Current/New Tooling Usage */}
                        {hasToolUsage && (
                            <Col span={24}>
                                <Card type="inner" title="Tooling / Usage Details" style={{ borderColor: theme.colors.warning }}>
                                    <Row gutter={[16, 16]}>
                                        <Col span={12}><Form.Item name="current_tooling_no" label="Current Tooling No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="current_tooling_usage" label="Current Tooling Usage" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="new_tooling_no" label="New Tooling No." rules={[{ required: true }]}><Input /></Form.Item></Col>
                                        <Col span={12}><Form.Item name="new_tooling_usage" label="New Tooling Usage" rules={[{ required: true }]}><Input /></Form.Item></Col>
                                    </Row>
                                </Card>
                            </Col>
                        )}

                    </Row>
                </Form>
            </Spin>
        </Modal>
    );
}
