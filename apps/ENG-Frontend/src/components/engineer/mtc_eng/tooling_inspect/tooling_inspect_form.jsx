import React, { useState } from "react";
import { Modal, Form, Input, DatePicker, Select, Row, Col, Button, Alert, Space, InputNumber } from "antd";
import { SaveOutlined, InfoCircleOutlined } from '@ant-design/icons';
import moment from "moment";
import dayjs from "dayjs";
import axios from "axios";
import Swal from 'sweetalert2';
import { server } from "../../../../constance/constance";
import { useTheme } from "../../../../theme";

import { MEASURING_TOOL_OPTIONS } from './options_measuring';

const { TextArea } = Input;
const { Option } = Select;

const ToolingReturnForm = ({ open, onCancel, onSuccess }) => {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            const payload = {
                date_return: values.date_return
                    ? dayjs(values.date_return).format('YYYY-MM-DD')
                    : dayjs().format('YYYY-MM-DD'),
                wc_code: values.wc_code ? values.wc_code.toString().replace(/\D/g, '') : null,
                qty: values.qty,
                measuring_tool: values.measuring_tool,
                remark: values.remark,
            };

            const res = await axios.post(`${server.TOOLING_RETURN_ADD}`, payload);

            if (res.data.result === "true" || res.data === "OK") {
                await Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ',
                    text: 'ข้อมูลถูกบันทึกเรียบร้อยแล้ว',
                    showConfirmButton: false,
                    timer: 1500
                });

                form.resetFields();
                // Call onSuccess to close modal AND refresh dashboard stats
                if (onSuccess) onSuccess();
                else onCancel();
            } else {
                console.error("API Error:", res.data);
                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง',
                });
            }
        } catch (error) {
            if (error.errorFields) {
                console.log('Validate Failed:', error);
            } else {
                console.error("API Error:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Connection Error',
                    text: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
                    footer: error.message
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    const formFields = [
        { name: 'date_return', label: 'Date Return', type: 'date', required: true, span: 12, placeholder: 'Select date' },
        { name: 'wc_code', label: 'W/C Code', type: 'input', required: true, span: 12, placeholder: 'e.g., WC001' },
        { name: 'qty', label: 'Quantity', type: 'number', required: false, span: 12, placeholder: 'e.g., 10' },
        {
            name: 'measuring_tool', label: 'Measuring Tools', type: 'select', span: 12, required: false, placeholder: '-- Select --',
            options: MEASURING_TOOL_OPTIONS
        },
        { name: 'remark', label: 'Remark', type: 'textarea', span: 24, required: false, placeholder: 'Additional notes...' },
    ];

    const renderComponent = (field) => {
        switch (field.type) {
            case 'textarea':
                return <TextArea rows={4} placeholder={field.placeholder} />;
            case 'date':
                return <DatePicker style={{ width: '100%' }} format="MM/DD/YYYY" placeholder={field.placeholder} />;
            case 'select':
                return (
                    <Select placeholder={field.placeholder}>
                        {field.options.map((opt) => (
                            <Option key={opt.key} value={opt.value}>{opt.label}</Option>
                        ))}
                    </Select>
                );
            case 'number':
                return <InputNumber style={{ width: '100%' }} placeholder={field.placeholder} />;
            case 'input':
            default:
                return <Input placeholder={field.placeholder} />;
        }
    };

    const modalFooter = (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
                <Button onClick={handleCancel} style={{ borderRadius: '4px' }}>
                    Cancel
                </Button>
                <Button
                    type="primary"
                    onClick={handleSave}
                    loading={loading}
                    icon={<SaveOutlined />}
                    style={{
                        backgroundColor: theme.colors.success,
                        borderColor: theme.colors.success,
                        borderRadius: '4px',
                        fontWeight: 'bold'
                    }}
                >
                    Save Tooling Return
                </Button>
            </Space>
        </div>
    );

    return (
        <Modal
            title={<div style={{ fontSize: '20px', fontWeight: 'bold' }}><i className="fas fa-undo-alt" style={{ marginRight: '10px' }}></i>Tooling Return Form</div>} // ใส่ไอคอนที่ title (ถ้ามี fontawesome)
            open={open}
            onCancel={handleCancel}
            footer={modalFooter}
            width={800}
            centered
            maskClosable={false}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
                requiredMark={true}
            >
                <Row gutter={[24, 16]}>
                    {formFields.map((field, index) => (
                        <Col key={field.name || index} span={field.span}>
                            <Form.Item
                                name={field.name}
                                label={
                                    <span>
                                        {field.label}
                                        {!field.required && (
                                            <span style={{ color: theme.colors.textTertiary, marginLeft: '8px', fontWeight: 'normal', fontSize: '12px' }}>
                                                (Optional)
                                            </span>
                                        )}
                                    </span>
                                }
                                rules={field.required ? [{ required: true, message: `Please input ${field.label}!` }] : []}
                                style={{ marginBottom: 0 }}
                            >
                                {renderComponent(field)}
                            </Form.Item>
                        </Col>
                    ))}
                </Row>
            </Form>

            {/* Alert Box ด้านล่าง */}
            <Alert
                message={
                    <span>
                        <InfoCircleOutlined style={{ marginRight: '8px' }} />
                        <b>Note:</b> Fields marked with <span style={{ color: theme.colors.error }}>*</span> are required.
                    </span>
                }
                type="info"
                showIcon={false}
                style={{
                    marginTop: '24px',
                    backgroundColor: `${theme.colors.info}20`,
                    borderColor: theme.colors.info,
                    color: theme.colors.textPrimary,
                    borderRadius: '4px'
                }}
            />
        </Modal>
    );
};

export default ToolingReturnForm;