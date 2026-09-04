import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Checkbox, Row, Col, Collapse, Radio, DatePicker, Button, Typography, Tag, Space, Alert } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';
import AttachableField from './components/AttachableField';

const { TextArea } = Input;
const { Text } = Typography;

export default function CreateECNModal({ open, linkedEcr, onClose, onSuccess }) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { userName, empNo } = useAuthStore();
    const [fieldAttachments, setFieldAttachments] = useState({});

    // Watchers for conditional impact fields
    const hasCustomerImpact = Form.useWatch(['impact', 'has_customer_impact'], form);
    const hasKzwImpact = Form.useWatch(['impact', 'has_kzw_fjsw_impact'], form);
    const hasSaleDwgImpact = Form.useWatch(['impact', 'has_sale_drawing_impact'], form);

    const hasTraceability = Form.useWatch(['impact', 'has_traceability'], form);
    const hasWipStock = Form.useWatch(['impact', 'has_wip_stock'], form);
    const hasOutsourcing = Form.useWatch(['impact', 'has_outsourcing'], form);
    const hasUnitPrice = Form.useWatch(['impact', 'has_unit_price'], form);
    const hasManufacturing = Form.useWatch(['impact', 'has_manufacturing'], form);
    const hasProductQuality = Form.useWatch(['impact', 'has_product_quality'], form);
    const hasSafety = Form.useWatch(['impact', 'has_safety'], form);
    const hasOtd = Form.useWatch(['impact', 'has_otd'], form);

    useEffect(() => {
        if (open && linkedEcr) {
            form.setFieldsValue({
                ecr_id: linkedEcr.id,
                title_of_change: linkedEcr.title_of_change || '',
                reason_of_change: linkedEcr.reason_of_change || '',
                before_change: linkedEcr.dwg_before_change || linkedEcr.usage_before_change || linkedEcr.prog_before_change || '',
                after_change: linkedEcr.dwg_after_change || linkedEcr.usage_after_change || linkedEcr.prog_after_change || '',
                dwg_suspended: true,
                impact: {
                    customer_name: linkedEcr.customer_name || '',
                }
            });
        }
    }, [open, linkedEcr, form]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const allFieldAttachments = Object.values(fieldAttachments).flat();
            const payload = {
                ...values,
                attachments: allFieldAttachments,
                ecr_id: linkedEcr.id,
                engineer_assigned: empNo || userName || 'NATHAPORN YAMMANUS',
                request_by: linkedEcr.request_by,
                department: linkedEcr.department
            };

            await axios.post(`${server.URL}/api/ecnt/ecn`, payload, { withCredentials: true });
            
            antdMessage.success("ECN Created Successfully (Block 5 Complete -> Pending Eng Mgr ECN)");
            form.resetFields();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Create ECN Error:", error);
            antdMessage.error(error?.response?.data?.error || "Validation Failed. Please check required fields.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={<span style={{ fontSize: '18px', fontWeight: 600 }}>Block 5: Create Engineering Change Notice (ECN)</span>}
            open={open}
            onCancel={onClose}
            onOk={handleSubmit}
            confirmLoading={loading}
            width={950}
            okText="Submit ECN to Eng Mgr"
            destroyOnClose
        >
            <Form form={form} layout="vertical">
                {/* Header Information */}
                <Alert 
                    message={
                        <Space direction="vertical" size={2}>
                            <Text strong>Linked Reference: {linkedEcr?.ecr_no || 'ECR #' + linkedEcr?.id}</Text>
                            <Text type="secondary">
                                Requester: {linkedEcr?.request_by_name} ({linkedEcr?.department}) | 
                                Customer: {linkedEcr?.customer_name || 'N/A'} | 
                                Project: {linkedEcr?.project_code || 'N/A'}
                            </Text>
                        </Space>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item 
                            name="ecn_no" 
                            label="ECN No. (Generated from Innovator)" 
                            rules={[{ required: true, message: 'Please input ECN No. from Innovator' }]}
                        >
                            <Input placeholder="e.g. ECN260901 or Innovator doc no." />
                        </Form.Item>
                    </Col>
                    <Col span={12} style={{ display: 'flex', alignItems: 'center' }}>
                        <Form.Item 
                            name="dwg_suspended" 
                            valuePropName="checked" 
                            noStyle
                        >
                            <Checkbox style={{ fontWeight: 600, color: '#cf1322' }}>
                                Confirm DWG. Suspend (Drawing cannot be used until revision completed)
                            </Checkbox>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="title_of_change" label="Title of Change" rules={[{ required: true }]}>
                            <Input placeholder="Enter title..." />
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <AttachableField
                            name="reason_of_change"
                            label="Reason of Change"
                            placeholder="ระบุเหตุผลการเปลี่ยนแปลง (กด Ctrl+V เพื่อวางรูปภาพ หรือแนบไฟล์)..."
                            rules={[{ required: true }]}
                            rows={2}
                            attachments={fieldAttachments['reason_of_change'] || []}
                            onAttachmentsChange={(atts) => setFieldAttachments(p => ({ ...p, reason_of_change: atts }))}
                            blockNumber={5}
                        />
                    </Col>
                    <Col span={24}>
                        <Form.Item name="scope_of_implementation" label="Scope of Implementation (ขอบเขตการดำเนินการ)">
                            <TextArea rows={2} placeholder="Specify scope of application/implementation..." />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <AttachableField
                            name="before_change"
                            label="Before Change Description"
                            placeholder="Technical state before change (กด Ctrl+V เพื่อวางรูปภาพ หรือแนบไฟล์)..."
                            rows={3}
                            attachments={fieldAttachments['before_change'] || []}
                            onAttachmentsChange={(atts) => setFieldAttachments(p => ({ ...p, before_change: atts }))}
                            blockNumber={5}
                        />
                    </Col>
                    <Col span={12}>
                        <AttachableField
                            name="after_change"
                            label="After Change Description"
                            placeholder="Technical state after change (กด Ctrl+V เพื่อวางรูปภาพ หรือแนบไฟล์)..."
                            rows={3}
                            attachments={fieldAttachments['after_change'] || []}
                            onAttachmentsChange={(atts) => setFieldAttachments(p => ({ ...p, after_change: atts }))}
                            blockNumber={5}
                        />
                    </Col>
                </Row>

                {/* Impact Assessment Section */}
                <h4 style={{ marginTop: 16, marginBottom: 8, color: '#1677ff', borderBottom: '1px solid #e8e8e8', paddingBottom: 6 }}>
                    Impact Assessment (การประเมินผลกระทบ)
                </h4>

                <Collapse defaultActiveKey={['customer_section', 'affected_areas']} style={{ marginBottom: 16 }}>
                    {/* Customer & KZW & Sale Drawing */}
                    <Collapse.Panel header="1. Customer, Overseas & Sale Drawing Impact" key="customer_section">
                        {/* Customer Impact */}
                        <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                            <Form.Item name={['impact', 'has_customer_impact']} valuePropName="checked" noStyle>
                                <Checkbox style={{ fontWeight: 600 }}>Customer Impact (มีผลกระทบต่อ Customer)</Checkbox>
                            </Form.Item>
                            {hasCustomerImpact && (
                                <Row gutter={12} style={{ marginTop: 12 }}>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'customer_name']} label="Customer Name">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'm4_request_doc_no']} label="4M Request Doc No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'customer_notification_date']} label="Notification Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'customer_change_notice_date']} label="Change Notice Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'customer_approved_date']} label="Cust. Approved Received Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* KZW/FJSW Impact */}
                        <div style={{ marginBottom: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                            <Form.Item name={['impact', 'has_kzw_fjsw_impact']} valuePropName="checked" noStyle>
                                <Checkbox style={{ fontWeight: 600 }}>KZW, FJSW Impact (มีผลกระทบต่อ KZW / FJSW)</Checkbox>
                            </Form.Item>
                            {hasKzwImpact && (
                                <Row gutter={12} style={{ marginTop: 12 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'operation_type']} label="Operation Type">
                                            <Radio.Group>
                                                <Radio value="Operation by customer">Operation by customer</Radio>
                                                <Radio value="Operation by Thai">Operation by Thai</Radio>
                                            </Radio.Group>
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'kzw_notification_date']} label="Notification Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'kzw_dcn_ecn_doc_no']} label="Customer DCN / ECN Doc No.">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'kzw_doc_received_date']} label="Confirm DCN/ECN Received Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* Sale Drawing Impact */}
                        <div style={{ padding: 12, background: '#fafafa', borderRadius: 6 }}>
                            <Form.Item name={['impact', 'has_sale_drawing_impact']} valuePropName="checked" noStyle>
                                <Checkbox style={{ fontWeight: 600 }}>Sale Drawing Impact (มีผลกระทบต่อ Sale Drawing)</Checkbox>
                            </Form.Item>
                            {hasSaleDwgImpact && (
                                <Row gutter={12} style={{ marginTop: 12 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'sale_drawing_revision_no']} label="Update Revision of Sale Drawing No.">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'sale_drawing_finish_date']} label="Confirm Finish Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </Collapse.Panel>

                    {/* 8 Affected Areas Checklist */}
                    <Collapse.Panel header="2. 8 Affected Areas Checklist (พื้นที่ที่ได้รับผลกระทบ)" key="affected_areas">
                        {/* 1. Traceability */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_traceability']} valuePropName="checked" noStyle>
                                <Checkbox strong>1. Traceability (track production history / Lot recall)</Checkbox>
                            </Form.Item>
                            {hasTraceability && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={16}>
                                        <Form.Item name={['impact', 'traceability_details', 'lot_no']} label="Recalled Lot No. (Contact PC)">
                                            <Input placeholder="Lot No. to recall..." />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'traceability_details', 'finish_date']} label="Confirm Finish Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 2. WIP / Stock */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_wip_stock']} valuePropName="checked" noStyle>
                                <Checkbox strong>2. WIP, Stock, Back log (All target model list)</Checkbox>
                            </Form.Item>
                            {hasWipStock && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={16}>
                                        <Form.Item name={['impact', 'wip_stock_details', 'models']} label="Target Models / Disposition Detail">
                                            <Input placeholder="Specify affected models / disposition..." />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'wip_stock_details', 'finish_date']} label="Confirm Finish Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 3. Outsourcing */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_outsourcing']} valuePropName="checked" noStyle>
                                <Checkbox strong>3. Outsourcing Process (Notify service provider)</Checkbox>
                            </Form.Item>
                            {hasOutsourcing && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'outsourcing_details', 'by_method']} label="Notification Method / Doc No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'outsourcing_details', 'lots']} label="Ongoing Lots in Outsourcing">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 4. Unit Price */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_unit_price']} valuePropName="checked" noStyle>
                                <Checkbox strong>4. Unit Price (Inform Purchase / factors contributing to cost)</Checkbox>
                            </Form.Item>
                            {hasUnitPrice && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'unit_price_details', 'stakeholder_info']} label="Purchasing Notification Detail">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'unit_price_details', 'cost_factors']} label="Cost Factors">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 5. Manufacturing Process */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_manufacturing']} valuePropName="checked" noStyle>
                                <Checkbox strong>5. Manufacturing Process (WI, Tooling, Program)</Checkbox>
                            </Form.Item>
                            {hasManufacturing && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'manufacturing_details', 'production_methods_doc']} label="Procedure/WI Doc No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'manufacturing_details', 'tooling_doc']} label="Tooling Data Sheet No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item name={['impact', 'manufacturing_details', 'program_doc']} label="Program Machine No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 6. Product Quality */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_product_quality']} valuePropName="checked" noStyle>
                                <Checkbox strong>6. Product Quality & Inspection Ability</Checkbox>
                            </Form.Item>
                            {hasProductQuality && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'product_quality_details', 'inspection_methods_doc']} label="Inspection Methods / WI No">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'product_quality_details', 'additional_items']} label="Additional Items to Order">
                                            <Input />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>

                        {/* 7. Safety */}
                        <div style={{ marginBottom: 10, padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_safety']} valuePropName="checked" noStyle>
                                <Checkbox strong>7. Safety (Risk Assessment Doc)</Checkbox>
                            </Form.Item>
                            {hasSafety && (
                                <Form.Item name={['impact', 'safety_details', 'risk_assessment_doc']} label="Risk Assessment Doc No" style={{ marginTop: 8 }}>
                                    <Input />
                                </Form.Item>
                            )}
                        </div>

                        {/* 8. On-Time Delivery */}
                        <div style={{ padding: 8, background: '#fcfcfc', border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Form.Item name={['impact', 'has_otd']} valuePropName="checked" noStyle>
                                <Checkbox strong>8. On-Time Delivery (OTD Impact)</Checkbox>
                            </Form.Item>
                            {hasOtd && (
                                <Row gutter={8} style={{ marginTop: 8 }}>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'otd_details', 'increase_time']} label="Increased Approx. Time">
                                            <Input placeholder="e.g. +2 days, +5 hrs" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={12}>
                                        <Form.Item name={['impact', 'otd_details', 'estimated_completion_date']} label="Assessment Completion Date">
                                            <DatePicker style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            )}
                        </div>
                    </Collapse.Panel>
                </Collapse>
            </Form>
        </Modal>
    );
}
