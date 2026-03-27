import React from 'react';
import { Card, Button, Input, Form, Checkbox, DatePicker, Row, Col, Radio } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

export default function Step3_2({ onNext }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();

    const impactAreas = [
        "Customer", "Sale Drawing", "Traceability", "WIP/Stock",
        "Outsourcing process", "Unit Price", "Mfg Process", "Quality", "Safety", "OTD"
    ];

    const handleSubmit = () => {
        form.validateFields().then(values => {
            Swal.fire('Success', 'Impact Assessment Completed', 'success')
                .then(() => onNext(3.3, 'Approve', 'Impact Assessment Completed', values));
        }).catch(err => {
            console.error("Validation Failed:", err);
            Swal.fire({
                icon: 'warning',
                title: 'Missing Required Fields',
                text: 'Please fill in all required fields before submitting.'
            });
        });
    };

    return (
        <Card title="Step 3.2: Impact Assessment (Engineer Assigned)"
            style={{ borderColor: theme.colors.info, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Row gutter={[16, 16]}>
                    {impactAreas.map(area => (
                        <Col span={12} key={area}>
                            <Card size="small" style={{ background: theme.colors.surface }}>
                                <Form.Item name={`impact_${area}`} valuePropName="checked" style={{ marginBottom: 8 }}>
                                    <Checkbox>Impact on {area}</Checkbox>
                                </Form.Item>

                                <Form.Item
                                    noStyle
                                    shouldUpdate={(prevValues, currentValues) => prevValues[`impact_${area}`] !== currentValues[`impact_${area}`]}
                                >
                                    {({ getFieldValue }) => {
                                        const isImpacted = getFieldValue(`impact_${area}`);
                                        if (!isImpacted) return null;

                                        return (
                                            <div style={{ marginTop: 10, paddingLeft: 24, paddingBottom: 10, borderLeft: `2px solid ${theme.colors.info}` }}>
                                                <Form.Item label="Target Finish Date" name={`date_${area}`} rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                                                    <DatePicker style={{ width: '100%' }} />
                                                </Form.Item>

                                                {/* Specific fields for Customer */}
                                                {area === "Customer" && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <Form.Item name="customer_impact_type" label="Customer Impact" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <Radio.Group>
                                                                <Radio value="KZW">KZW</Radio>
                                                                <Radio value="FJSW">FJSW</Radio>
                                                                <Radio value="OTHER">OTHER</Radio>
                                                            </Radio.Group>
                                                        </Form.Item>
                                                        <Form.Item name="customer_operation_by" label="Operation By" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <Radio.Group>
                                                                <Radio value="Operation by customer">Customer</Radio>
                                                                <Radio value="Operation by Thai">Thai</Radio>
                                                            </Radio.Group>
                                                        </Form.Item>
                                                        <Form.Item name="customer_notif_date" label="Notification Date" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <DatePicker style={{ width: '100%' }} />
                                                        </Form.Item>
                                                        <Form.Item name="customer_doc_no" label="Customer Doc. No." rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <Input />
                                                        </Form.Item>
                                                        <Form.Item name="customer_confirm_date" label="Confirm Received Date" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <DatePicker style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </div>
                                                )}

                                                {/* Specific fields for Traceability */}
                                                {area === "Traceability" && (
                                                    <Form.Item name="traceability_lot_no" label="Lot no. to recall" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                        <Input placeholder="Enter Lot Nos." />
                                                    </Form.Item>
                                                )}

                                                {/* Specific fields for Outsourcing process */}
                                                {area === "Outsourcing process" && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <Form.Item name="outsource_notif_date" label="Notification Date" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <DatePicker style={{ width: '100%' }} />
                                                        </Form.Item>
                                                        <Form.Item name="outsource_notif_method" label="Notification Method" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <Radio.Group>
                                                                <Radio value="Document no.">Document no.</Radio>
                                                                <Radio value="Email">Email</Radio>
                                                            </Radio.Group>
                                                        </Form.Item>
                                                        <Form.Item name="outsource_ongoing_lots" label="Ongoing Lots (Lot no.)" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
                                                            <Input placeholder="Enter Lot Nos." />
                                                        </Form.Item>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }}
                                </Form.Item>
                            </Card>
                        </Col>
                    ))}
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <Button type="primary" onClick={handleSubmit}>Submit Assessment</Button>
                </div>
            </Form>
        </Card>
    );
}
