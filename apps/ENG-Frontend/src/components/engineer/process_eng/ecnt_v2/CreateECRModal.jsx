import React, { useState } from 'react';
import { Modal, Form, Input, Select, Checkbox, Row, Col } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Option } = Select;
const { TextArea } = Input;

export default function CreateECRModal({ open, onClose, onSuccess }) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // Watch for conditional rendering
    const isDrawing = Form.useWatch('is_drawing', form);
    const isTooling = Form.useWatch('is_tooling', form);
    const isProgram = Form.useWatch('is_program', form);
    const isUsage = Form.useWatch('is_usage', form);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // We mock the logged in user here since we are not extracting it from context in this demo component
            const payload = {
                ...values,
                request_by: localStorage.getItem('u_code') || 'EMP123',
                request_by_name: localStorage.getItem('u_name') || 'Test User',
                department: localStorage.getItem('u_department') || 'ENG'
            };

            await axios.post(`${server.URL}/api/ecnt/ecr`, payload, { withCredentials: true });
            
            antdMessage.success("ECR Created Successfully (Block 1 & 2 completed)");
            form.resetFields();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            antdMessage.error(error?.response?.data?.error || "Validation Failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<span style={{ fontSize: '20px', fontWeight: 600 }}>Block 1 & 2: Initiate ECR</span>}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            width={900}
            okText="Submit ECR to Manager"
        >
            <Form form={form} layout="vertical" initialValues={{ status_type: 'PERMANENT' }}>
                
                <h3 style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>Block 1: Request Detail</h3>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="ref_coc_no" label="Reference COC No.">
                            <Input placeholder="Enter reference..." />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="status_type" label="Status" rules={[{ required: true }]}>
                            <Select>
                                <Option value="PERMANENT">Permanent</Option>
                                <Option value="TEMPORARY">Temporary</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    
                    <Col span={12}>
                        <Form.Item name="objective" label="Objective" rules={[{ required: true }]}>
                            <Select>
                                <Option value="REDUCE_CYCLE">Reduce Cycle</Option>
                                <Option value="COST_REDUCTION">Cost Reduction</Option>
                                <Option value="INCREASE_USAGE_TOOLING">Increase Usage Tooling</Option>
                                <Option value="IMPROVE_YIELD">Improve Yield</Option>
                                <Option value="OTHER">Other</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="objective_other" label="Objective (Other Detail)">
                            <Input placeholder="Specify if other..." />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item label="Types of Change (Select all that apply)">
                            <div style={{ display: 'flex', gap: '20px' }}>
                                <Form.Item name="is_drawing" valuePropName="checked" noStyle>
                                    <Checkbox>Product/Process Drawing</Checkbox>
                                </Form.Item>
                                <Form.Item name="is_tooling" valuePropName="checked" noStyle>
                                    <Checkbox>Tooling</Checkbox>
                                </Form.Item>
                                <Form.Item name="is_program" valuePropName="checked" noStyle>
                                    <Checkbox>Program</Checkbox>
                                </Form.Item>
                                <Form.Item name="is_usage" valuePropName="checked" noStyle>
                                    <Checkbox>Usage / Setup</Checkbox>
                                </Form.Item>
                            </div>
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item name="customer_name" label="Customer Name">
                            <Input />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="project_code" label="Project Code">
                            <Input />
                        </Form.Item>
                    </Col>
                    
                    <Col span={24}>
                        <Form.Item name="title_of_change" label="Title of Change" rules={[{ required: true }]}>
                            <ReactQuill theme="snow" />
                        </Form.Item>
                        <Form.Item name="reason_of_change" label="Reason of Change" rules={[{ required: true }]}>
                            <ReactQuill theme="snow" />
                        </Form.Item>
                    </Col>
                </Row>

                {/* Conditional rendering for Block 2 */}
                {(isDrawing || isTooling || isProgram || isUsage) && (
                    <h3 style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 8, marginTop: 24 }}>Block 2: Technical Details</h3>
                )}

                {isDrawing && (
                    <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4>A. Product / Process Drawing Change</h4>
                        <Row gutter={16}>
                            <Col span={8}><Form.Item name="dwg_part_no" label="Part No"><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="dwg_cn" label="C/N"><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="dwg_revision" label="Revision"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="dwg_before_change" label="Before Change"><TextArea rows={3}/></Form.Item></Col>
                            <Col span={12}><Form.Item name="dwg_after_change" label="After Change"><TextArea rows={3}/></Form.Item></Col>
                        </Row>
                    </div>
                )}

                {isTooling && (
                    <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4>B. Current / New Tooling Usage</h4>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="tool_current_no" label="Current Tooling No"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_current_usage" label="Usage (K/pc)"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_new_no" label="New Tooling No"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_new_usage" label="New Usage (K/pc)"><Input /></Form.Item></Col>
                        </Row>
                    </div>
                )}

                {isProgram && (
                    <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4>C. Cutting Program Change</h4>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item name="prog_before_change" label="Program Before"><TextArea rows={2}/></Form.Item></Col>
                            <Col span={12}><Form.Item name="prog_after_change" label="Program After"><TextArea rows={2}/></Form.Item></Col>
                            <Col span={12}><Form.Item name="prog_condition_before" label="Condition Before"><TextArea rows={2}/></Form.Item></Col>
                            <Col span={12}><Form.Item name="prog_condition_after" label="Condition After"><TextArea rows={2}/></Form.Item></Col>
                        </Row>
                    </div>
                )}

                {isUsage && (
                    <div style={{ background: '#f5f7fa', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                        <h4>D. Setup / Usage Change</h4>
                        <Row gutter={16}>
                            <Col span={8}><Form.Item name="usage_setup_no" label="Setup Data Sheet No"><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_part_no" label="Part No"><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_mc_no" label="M/C No"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="usage_before_change" label="Before Setup"><TextArea rows={2}/></Form.Item></Col>
                            <Col span={12}><Form.Item name="usage_after_change" label="After Setup"><TextArea rows={2}/></Form.Item></Col>
                        </Row>
                    </div>
                )}

            </Form>
        </Modal>
    );
}
