import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, Row, Col } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import AttachableField from './components/AttachableField';

const { Option } = Select;
const { TextArea } = Input;

export default function CreateECRModal({ open, onClose, onSuccess, initialData = null }) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { userName, empNo, userDepartment } = useAuthStore();
    
    // Field-specific attachments state
    const [fieldAttachments, setFieldAttachments] = useState({});

    // Watch for conditional rendering
    const isDrawing = Form.useWatch('is_drawing', form);
    const isTooling = Form.useWatch('is_tooling', form);
    const isProgram = Form.useWatch('is_program', form);
    const isUsage = Form.useWatch('is_usage', form);

    const isEditMode = !!initialData;

    useEffect(() => {
        if (open) {
            if (initialData) {
                form.setFieldsValue({
                    ...initialData,
                    is_drawing: !!initialData.is_drawing,
                    is_tooling: !!initialData.is_tooling,
                    is_program: !!initialData.is_program,
                    is_usage: !!initialData.is_usage,
                });

                if (initialData.attachments && Array.isArray(initialData.attachments)) {
                    const grouped = {};
                    initialData.attachments.forEach(a => {
                        if (a.field_name) {
                            if (!grouped[a.field_name]) grouped[a.field_name] = [];
                            grouped[a.field_name].push(a);
                        }
                    });
                    setFieldAttachments(grouped);
                } else {
                    setFieldAttachments({});
                }
            } else {
                form.resetFields();
                form.setFieldsValue({ status_type: 'PERMANENT' });
                setFieldAttachments({});
            }
        }
    }, [open, initialData, form]);

    const handleAttachmentsChange = (fieldName, newAttachments) => {
        setFieldAttachments(prev => ({
            ...prev,
            [fieldName]: newAttachments
        }));
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Flatten all field attachments
            const allFieldAttachments = Object.values(fieldAttachments).flat();

            const payload = {
                ...values,
                attachments: allFieldAttachments,
                request_by: empNo || localStorage.getItem('u_code') || 'EMP123',
                request_by_name: userName || localStorage.getItem('u_name') || 'Requester',
                department: userDepartment || localStorage.getItem('u_department') || 'ENG'
            };

            if (isEditMode) {
                await axios.put(`${server.URL}/api/ecnt/ecr/${initialData.id}/resubmit`, payload, { withCredentials: true });
                antdMessage.success("ECR Details Resubmitted to Department Manager");
            } else {
                const res = await axios.post(`${server.URL}/api/ecnt/ecr`, payload, { withCredentials: true });
                antdMessage.success(`ECR Created Successfully: ${res.data.ecr_no || 'Assigned'} (Block 1 & 2 completed)`);
            }
            
            form.resetFields();
            setFieldAttachments({});
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            antdMessage.error(error?.response?.data?.error || "Validation Failed. Please check required fields.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<span style={{ fontSize: '18px', fontWeight: 600 }}>{isEditMode ? `Resubmit ECR #${initialData?.ecr_no || initialData?.id}` : 'Block 1 & 2: Initiate ECR Request'}</span>}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            width={950}
            okText={isEditMode ? "Resubmit to Manager" : "Submit ECR to Manager"}
            destroyOnClose
        >
            <Form form={form} layout="vertical" initialValues={{ status_type: 'PERMANENT' }}>
                
                <h4 style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 6 }}>Block 1: Request Detail</h4>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="ref_coc_no" label="Reference Information from Control of Change System No.">
                            <Input placeholder="e.g. PD-DV-QC-000069 (if applicable)" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="status_type" label="Status" rules={[{ required: true }]}>
                            <Select>
                                <Option value="PERMANENT">PERMANENT (เปลี่ยนถาวร)</Option>
                                <Option value="TEMPORARY">TEMPORARY (เปลี่ยนชั่วคราว/ทดสอบ)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    
                    <Col span={12}>
                        <Form.Item name="objective" label="Objective" rules={[{ required: true }]}>
                            <Select placeholder="Select objective...">
                                <Option value="REDUCE_CYCLE">REDUCE CYCLE (ลดรอบเวลา)</Option>
                                <Option value="COST_REDUCTION">COST REDUCTION (ลดต้นทุน)</Option>
                                <Option value="INCREASE_USAGE_TOOLING">INCREASE USAGE TOOLING (ยืดอายุทูล)</Option>
                                <Option value="IMPROVE_YIELD">IMPROVE YIELD (เพิ่มผลผลิต/ลดของเสีย)</Option>
                                <Option value="OTHER">OTHER (อื่นๆ)</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="objective_other" label="Objective (Specify if Other)">
                            <Input placeholder="Specify if other..." />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item label="Types of Change (Select all that apply)">
                            <div style={{ display: 'flex', gap: '20px', background: '#fafafa', padding: '10px 14px', borderRadius: 6 }}>
                                <Form.Item name="is_drawing" valuePropName="checked" noStyle>
                                    <Checkbox>Product / Process Drawing</Checkbox>
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
                            <Input placeholder="Enter customer name..." />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="project_code" label="Project Code">
                            <Input placeholder="Enter project code..." />
                        </Form.Item>
                    </Col>
                    
                    <Col span={24}>
                        <Form.Item name="title_of_change" label="Title of Change" rules={[{ required: true }]}>
                            <Input placeholder="Enter title of change..." />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <AttachableField
                            name="reason_of_change"
                            label="Reason of Change (เหตุผลการเปลี่ยนแปลง)"
                            placeholder="ระบุเหตุผลการเปลี่ยนแปลง (สามารถกด Ctrl+V เพื่อวางรูปภาพ หรือกดปุ่มแนบไฟล์)..."
                            rules={[{ required: true }]}
                            rows={3}
                            attachments={fieldAttachments['reason_of_change'] || []}
                            onAttachmentsChange={(atts) => handleAttachmentsChange('reason_of_change', atts)}
                            blockNumber={1}
                        />
                    </Col>
                </Row>

                {/* Conditional rendering for Block 2 */}
                {(isDrawing || isTooling || isProgram || isUsage) && (
                    <h4 style={{ color: '#1677ff', borderBottom: '1px solid #f0f0f0', paddingBottom: 6, marginTop: 20 }}>
                        Block 2: Technical Details
                    </h4>
                )}

                {/* A. Drawing Change */}
                {isDrawing && (
                    <div style={{ background: '#f5f7fa', padding: 14, borderRadius: 6, marginBottom: 14 }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#1890ff' }}>A. Product / Process Drawing Change</h5>
                        <Row gutter={12}>
                            <Col span={8}><Form.Item name="dwg_part_no" label="Part No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="dwg_cn" label="C/N No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="dwg_revision" label="Revision (ล่าสุด)"><Input /></Form.Item></Col>
                            <Col span={24}><Form.Item name="dwg_reason_of_change" label="Reason for Drawing Change"><Input /></Form.Item></Col>
                            
                            <Col span={12}>
                                <AttachableField
                                    name="dwg_before_change"
                                    label="Before Change (Drawing Detail)"
                                    placeholder="รายละเอียด Drawing ก่อนเปลี่ยน (แนบรูป Drawing/สเก็ตช์ได้)..."
                                    rows={3}
                                    attachments={fieldAttachments['dwg_before_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('dwg_before_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col span={12}>
                                <AttachableField
                                    name="dwg_after_change"
                                    label="After Change (Drawing Detail)"
                                    placeholder="รายละเอียด Drawing หลังเปลี่ยน (แนบรูป Drawing/สเก็ตช์ได้)..."
                                    rows={3}
                                    attachments={fieldAttachments['dwg_after_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('dwg_after_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </div>
                )}

                {/* B. Tooling Change */}
                {isTooling && (
                    <div style={{ background: '#f5f7fa', padding: 14, borderRadius: 6, marginBottom: 14 }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#1890ff' }}>B. Tooling Change</h5>
                        <Row gutter={12}>
                            <Col span={12}><Form.Item name="tool_current_no" label="Current Tooling No."><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_current_usage" label="Current Usage (K/pc)"><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_new_no" label="New Tooling No."><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="tool_new_usage" label="New Usage (K/pc)"><Input /></Form.Item></Col>
                        </Row>
                    </div>
                )}

                {/* C. Program Change */}
                {isProgram && (
                    <div style={{ background: '#f5f7fa', padding: 14, borderRadius: 6, marginBottom: 14 }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#1890ff' }}>C. Cutting Program & Condition Change</h5>
                        <Row gutter={12}>
                            <Col span={12}>
                                <AttachableField
                                    name="prog_before_change"
                                    label="Cutting Program Before Change"
                                    placeholder="Program code/ภาพโปรแกรมก่อนเปลี่ยน..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_before_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('prog_before_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col span={12}>
                                <AttachableField
                                    name="prog_after_change"
                                    label="Cutting Program After Change"
                                    placeholder="Program code/ภาพโปรแกรมหลังเปลี่ยน..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_after_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('prog_after_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col span={12}>
                                <AttachableField
                                    name="prog_condition_before"
                                    label="Condition Before (Spindle, Feed, Depth)"
                                    placeholder="Condition ก่อนเปลี่ยน (รอบ/ฟีด/ลึก)..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_condition_before'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('prog_condition_before', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col span={12}>
                                <AttachableField
                                    name="prog_condition_after"
                                    label="Condition After (Spindle, Feed, Depth)"
                                    placeholder="Condition หลังเปลี่ยน (รอบ/ฟีด/ลึก)..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_condition_after'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('prog_condition_after', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </div>
                )}

                {/* D. Usage / Setup Change */}
                {isUsage && (
                    <div style={{ background: '#f5f7fa', padding: 14, borderRadius: 6, marginBottom: 14 }}>
                        <h5 style={{ margin: '0 0 10px 0', color: '#1890ff' }}>D. Setup / Usage Change</h5>
                        <Row gutter={12}>
                            <Col span={8}><Form.Item name="usage_setup_no" label="Setup Data Sheet No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_part_no" label="Part No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_cn" label="C/N No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_process" label="Process"><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_program_no" label="Program No."><Input /></Form.Item></Col>
                            <Col span={8}><Form.Item name="usage_mc_no" label="M/C No."><Input /></Form.Item></Col>
                            <Col span={12}><Form.Item name="usage_cycle_time_before" label="Cycle Time Before Change"><Input placeholder="e.g. 15 sec/pc" /></Form.Item></Col>
                            <Col span={12}><Form.Item name="usage_cycle_time_after" label="Cycle Time After Change"><Input placeholder="e.g. 12 sec/pc" /></Form.Item></Col>
                            
                            <Col span={12}>
                                <AttachableField
                                    name="usage_before_change"
                                    label="Before Setup Change"
                                    placeholder="สภาพ Setup ก่อนเปลี่ยน (แนบภาพถ่ายหน้างาน/หน้าเครื่องได้)..."
                                    rows={3}
                                    attachments={fieldAttachments['usage_before_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('usage_before_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col span={12}>
                                <AttachableField
                                    name="usage_after_change"
                                    label="After Setup Change"
                                    placeholder="สภาพ Setup หลังเปลี่ยน (แนบภาพถ่ายหน้างาน/หน้าเครื่องได้)..."
                                    rows={3}
                                    attachments={fieldAttachments['usage_after_change'] || []}
                                    onAttachmentsChange={(atts) => handleAttachmentsChange('usage_after_change', atts)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </div>
                )}

            </Form>
        </Modal>
    );
}
