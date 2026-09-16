import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Checkbox, Row, Col, Button, Typography, Space } from 'antd';
import { App } from 'antd';
import { 
    SendOutlined, ArrowLeftOutlined, FileTextOutlined, 
    ToolOutlined, CodeOutlined, SettingOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import AttachableField from '../components/AttachableField';
import { dispatchStageWorkflowEmail } from '../../../../../services/ecntEmailService';

const { Title, Text } = Typography;
const { Option } = Select;

export default function EcrRequireView({ initialData = null, systemConfig = {}, onBack, onSuccess }) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { userName, empNo, userDepartment } = useAuthStore();
    
    // Field-specific attachments state
    const [fieldAttachments, setFieldAttachments] = useState({});

    // Watchers for conditional sub-forms
    const isDrawing = Form.useWatch('is_drawing', form);
    const isTooling = Form.useWatch('is_tooling', form);
    const isProgram = Form.useWatch('is_program', form);
    const isUsage = Form.useWatch('is_usage', form);

    const isEditMode = !!initialData;

    useEffect(() => {
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
            }
        } else {
            form.resetFields();
            form.setFieldsValue({ 
                status_type: 'PERMANENT',
                objective: 'IMPROVE_YIELD'
            });
            setFieldAttachments({});
        }
    }, [initialData, form]);

    const handleAttachmentsChange = (fieldName, newAttachments) => {
        setFieldAttachments(prev => ({
            ...prev,
            [fieldName]: newAttachments
        }));
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (!values.is_drawing && !values.is_tooling && !values.is_program && !values.is_usage) {
                antdMessage.error("Please select at least one Change Type (Drawing, Tooling, Program, or Usage).");
                return;
            }

            setLoading(true);

            // Flatten attachments
            const allFieldAttachments = Object.values(fieldAttachments).flat();

            const payload = {
                ...values,
                attachments: allFieldAttachments,
                request_by: empNo || localStorage.getItem('u_code') || 'EMP123',
                request_by_name: userName || localStorage.getItem('u_name') || 'Requester',
                department: userDepartment || localStorage.getItem('u_department') || 'ENG'
            };

            let createdId = null;
            let createdNo = null;

            if (isEditMode) {
                await axios.put(`${server.URL}/api/ecnt/ecr/${initialData.id}/resubmit`, payload, { withCredentials: true });
                antdMessage.success("ECR Details Successfully Resubmitted to Department Manager");
                createdId = initialData.id;
                createdNo = initialData.ecr_no;
            } else {
                const res = await axios.post(`${server.URL}/api/ecnt/ecr`, payload, { withCredentials: true });
                createdId = res.data?.id || res.data?.data?.id;
                createdNo = res.data?.ecr_no || res.data?.data?.ecr_no || 'Assigned';
                antdMessage.success(`ECR Initiated Successfully: ${createdNo} (Forwarded to Dept Manager)`);
            }

            // Fire-and-forget email dispatch via Google Apps Script
            try {
                dispatchStageWorkflowEmail({
                    stageCode: 'STAGE_2',
                    docData: {
                        id: createdId,
                        ecr_no: createdNo,
                        title_of_change: values.title_of_change,
                        customer_name: values.customer_name,
                        department: payload.department,
                        request_by_name: payload.request_by_name
                    },
                    documentType: 'ECR',
                    actionTaken: isEditMode ? 'RESUBMIT' : 'CREATE',
                    systemConfig
                }).catch(e => console.warn("[EcrRequireView] Email dispatch background error:", e));
            } catch (notifyErr) {
                console.warn("[EcrRequireView] Email notify failed:", notifyErr);
            }

            form.resetFields();
            setFieldAttachments({});
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            antdMessage.error(err?.response?.data?.error || "Validation Failed. Please complete all required fields.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Bar */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                            Back to Dashboard
                        </Button>
                        <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                            {isEditMode ? `✏️ Revise ECR #${initialData?.ecr_no || initialData?.id}` : '📝 Initiate Engineering Change Request (Block 1 & 2)'}
                        </Title>
                    </Space>

                    <Button 
                        type="primary" 
                        icon={<SendOutlined />} 
                        onClick={handleSubmit} 
                        loading={loading}
                        style={{ borderRadius: 8, background: isEditMode ? '#fa8c16' : '#1890ff' }}
                    >
                        {isEditMode ? "Resubmit to Dept Manager" : "Submit ECR to Dept Manager"}
                    </Button>
                </div>
            </Card>

            {/* Main Form Formatter */}
            <Form form={form} layout="vertical">
                
                {/* 1. Block 1: Header & Initiation */}
                <Card 
                    title={<Text strong style={{ color: '#1890ff', fontSize: 14 }}>1. Block 1: Request Information & Objectives</Text>}
                    style={{ borderRadius: 12, border: '1px solid #e8e8e8', marginBottom: 16 }}
                >
                    <Row gutter={16}>
                        <Col xs={24} md={8}>
                            <Form.Item name="customer_name" label="Customer Name">
                                <Input placeholder="e.g. MinebeaMitsumi, Seagate, Nidec" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item name="project_code" label="Project / Model Code">
                                <Input placeholder="e.g. HDD 2.5 Hub, Pivot, Bracket" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item name="ref_coc_no" label="Ref. Control of Change System No.">
                                <Input placeholder="e.g. PD-DV-QC-000069 (if applicable)" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item name="status_type" label="Status" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="PERMANENT">PERMANENT (ถาวร)</Option>
                                    <Option value="TEMPORARY">TEMPORARY (ชั่วคราว)</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item name="objective" label="Objective" rules={[{ required: true }]}>
                                <Select>
                                    <Option value="REDUCE_CYCLE">Reduce Cycle Time</Option>
                                    <Option value="COST_REDUCTION">Cost Reduction</Option>
                                    <Option value="INCREASE_USAGE_TOOLING">Increase Tooling Usage</Option>
                                    <Option value="IMPROVE_YIELD">Improve Yield</Option>
                                    <Option value="OTHER">Other</Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item name="objective_other" label="Objective Specification (if Other)">
                                <Input placeholder="Specify if objective is other..." />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <Form.Item 
                                name="title_of_change" 
                                label="Title of Change" 
                                rules={[{ required: true, message: 'Please specify title of change' }]}
                            >
                                <Input placeholder="Brief descriptive summary of change..." />
                            </Form.Item>
                        </Col>

                        <Col span={24}>
                            <AttachableField
                                name="reason_of_change"
                                label="Reason of Change (Supports Ctrl+V image paste)"
                                placeholder="Explain why this change is necessary and attach supporting photos or documents..."
                                rows={3}
                                rules={[{ required: true, message: 'Please provide reason of change' }]}
                                attachments={fieldAttachments['reason_of_change'] || []}
                                onAttachmentsChange={(newAtt) => handleAttachmentsChange('reason_of_change', newAtt)}
                                blockNumber={1}
                            />
                        </Col>
                    </Row>
                </Card>

                {/* 2. Change Category Selection */}
                <Card 
                    title={<Text strong style={{ color: '#1890ff', fontSize: 14 }}>2. Select Change Categories (Block 1 Checklist)</Text>}
                    style={{ borderRadius: 12, border: '1px solid #e8e8e8', marginBottom: 16 }}
                >
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <Card 
                                size="small" 
                                style={{ 
                                    borderRadius: 8, 
                                    border: isDrawing ? '2px solid #1890ff' : '1px solid #e8e8e8',
                                    background: isDrawing ? '#e6f7ff' : '#fff' 
                                }}
                            >
                                <Form.Item name="is_drawing" valuePropName="checked" noStyle>
                                    <Checkbox style={{ width: '100%', fontWeight: 600 }}>
                                        <FileTextOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                                        Product / Process Drawing
                                    </Checkbox>
                                </Form.Item>
                            </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <Card 
                                size="small" 
                                style={{ 
                                    borderRadius: 8, 
                                    border: isTooling ? '2px solid #52c41a' : '1px solid #e8e8e8',
                                    background: isTooling ? '#f6ffed' : '#fff' 
                                }}
                            >
                                <Form.Item name="is_tooling" valuePropName="checked" noStyle>
                                    <Checkbox style={{ width: '100%', fontWeight: 600 }}>
                                        <ToolOutlined style={{ marginRight: 6, color: '#52c41a' }} />
                                        Tooling Change
                                    </Checkbox>
                                </Form.Item>
                            </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <Card 
                                size="small" 
                                style={{ 
                                    borderRadius: 8, 
                                    border: isProgram ? '2px solid #fa8c16' : '1px solid #e8e8e8',
                                    background: isProgram ? '#fff7e6' : '#fff' 
                                }}
                            >
                                <Form.Item name="is_program" valuePropName="checked" noStyle>
                                    <Checkbox style={{ width: '100%', fontWeight: 600 }}>
                                        <CodeOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
                                        Cutting Program
                                    </Checkbox>
                                </Form.Item>
                            </Card>
                        </Col>

                        <Col xs={24} sm={12} md={6}>
                            <Card 
                                size="small" 
                                style={{ 
                                    borderRadius: 8, 
                                    border: isUsage ? '2px solid #eb2f96' : '1px solid #e8e8e8',
                                    background: isUsage ? '#fff0f6' : '#fff' 
                                }}
                            >
                                <Form.Item name="is_usage" valuePropName="checked" noStyle>
                                    <Checkbox style={{ width: '100%', fontWeight: 600 }}>
                                        <SettingOutlined style={{ marginRight: 6, color: '#eb2f96' }} />
                                        Usage / Setup Change
                                    </Checkbox>
                                </Form.Item>
                            </Card>
                        </Col>
                    </Row>
                </Card>

                {/* 3. Block 2: Technical Specifications Sub-forms */}
                {isDrawing && (
                    <Card 
                        title={<Text strong style={{ color: '#1890ff' }}>A. Product / Process Drawing Details (Block 2)</Text>}
                        style={{ borderRadius: 12, border: '1px solid #91d5ff', background: '#fafcff', marginBottom: 16 }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item name="dwg_part_no" label="Part No." rules={[{ required: isDrawing }]}>
                                    <Input placeholder="e.g. 100-XYZ-01" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="dwg_cn" label="C/N">
                                    <Input placeholder="e.g. CN-9021" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="dwg_revision" label="Revision" rules={[{ required: isDrawing }]}>
                                    <Input placeholder="e.g. Rev. A -> Rev. B" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <AttachableField
                                    name="dwg_before_change"
                                    label="Before Change Details (Paste image Ctrl+V)"
                                    placeholder="Dimension or spec before change..."
                                    rows={4}
                                    attachments={fieldAttachments['dwg_before_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('dwg_before_change', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <AttachableField
                                    name="dwg_after_change"
                                    label="After Change Details (Paste image Ctrl+V)"
                                    placeholder="Dimension or spec after change..."
                                    rows={4}
                                    attachments={fieldAttachments['dwg_after_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('dwg_after_change', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </Card>
                )}

                {isTooling && (
                    <Card 
                        title={<Text strong style={{ color: '#52c41a' }}>B. Tooling Details (Block 2)</Text>}
                        style={{ borderRadius: 12, border: '1px solid #b7eb8f', background: '#fcfffa', marginBottom: 16 }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <Form.Item name="tool_current_no" label="Current Tooling No." rules={[{ required: isTooling }]}>
                                    <Input placeholder="e.g. TL-001A" />
                                </Form.Item>
                                <Form.Item name="tool_current_usage" label="Current Usage (K/pc)">
                                    <Input placeholder="e.g. 15 K/pc" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="tool_new_no" label="New Tooling No." rules={[{ required: isTooling }]}>
                                    <Input placeholder="e.g. TL-002B" />
                                </Form.Item>
                                <Form.Item name="tool_new_usage" label="New Usage (K/pc)">
                                    <Input placeholder="e.g. 25 K/pc" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                )}

                {isProgram && (
                    <Card 
                        title={<Text strong style={{ color: '#fa8c16' }}>C. Cutting Program & Conditions (Block 2)</Text>}
                        style={{ borderRadius: 12, border: '1px solid #ffd591', background: '#fffdfa', marginBottom: 16 }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={12}>
                                <AttachableField
                                    name="prog_before_change"
                                    label="Program Code Before Change"
                                    placeholder="Cutting program code before change..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_before_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('prog_before_change', newAtt)}
                                    blockNumber={2}
                                />
                                <AttachableField
                                    name="prog_condition_before"
                                    label="Cutting Condition Before Change (RPM, Feed, etc.)"
                                    placeholder="Condition parameters before change..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_condition_before'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('prog_condition_before', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <AttachableField
                                    name="prog_after_change"
                                    label="Program Code After Change"
                                    placeholder="Cutting program code after change..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_after_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('prog_after_change', newAtt)}
                                    blockNumber={2}
                                />
                                <AttachableField
                                    name="prog_condition_after"
                                    label="Cutting Condition After Change (RPM, Feed, etc.)"
                                    placeholder="Condition parameters after change..."
                                    rows={3}
                                    attachments={fieldAttachments['prog_condition_after'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('prog_condition_after', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </Card>
                )}

                {isUsage && (
                    <Card 
                        title={<Text strong style={{ color: '#eb2f96' }}>D. Usage & Setup Sheet Details (Block 2)</Text>}
                        style={{ borderRadius: 12, border: '1px solid #ffadd2', background: '#fffafc', marginBottom: 16 }}
                    >
                        <Row gutter={16}>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_setup_no" label="Setup Data Sheet No." rules={[{ required: isUsage }]}>
                                    <Input placeholder="e.g. SDS-2026-09" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_part_no" label="Part No.">
                                    <Input placeholder="e.g. 100-XYZ-01" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_cn" label="C/N">
                                    <Input placeholder="e.g. CN-9021" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_process" label="Process Name">
                                    <Input placeholder="e.g. Turning, Grinding" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_program_no" label="Program No.">
                                    <Input placeholder="e.g. PRG-001" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item name="usage_mc_no" label="M/C No.">
                                    <Input placeholder="e.g. MC-04" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="usage_cycle_time_before" label="Cycle Time Before Change">
                                    <Input placeholder="e.g. 45 sec" />
                                </Form.Item>
                                <AttachableField
                                    name="usage_before_change"
                                    label="Setup Detail Before Change"
                                    placeholder="Machine setup before change..."
                                    rows={3}
                                    attachments={fieldAttachments['usage_before_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('usage_before_change', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="usage_cycle_time_after" label="Cycle Time After Change">
                                    <Input placeholder="e.g. 38 sec" />
                                </Form.Item>
                                <AttachableField
                                    name="usage_after_change"
                                    label="Setup Detail After Change"
                                    placeholder="Machine setup after change..."
                                    rows={3}
                                    attachments={fieldAttachments['usage_after_change'] || []}
                                    onAttachmentsChange={(newAtt) => handleAttachmentsChange('usage_after_change', newAtt)}
                                    blockNumber={2}
                                />
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* Submit Action Bar */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                    <Button onClick={onBack} size="large" style={{ borderRadius: 8 }}>
                        Cancel
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<SendOutlined />} 
                        size="large"
                        onClick={handleSubmit} 
                        loading={loading}
                        style={{ borderRadius: 8, background: isEditMode ? '#fa8c16' : '#1890ff', padding: '0 32px' }}
                    >
                        {isEditMode ? "Resubmit ECR" : "Submit ECR"}
                    </Button>
                </div>

            </Form>
        </div>
    );
}
