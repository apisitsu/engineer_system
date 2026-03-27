import React from 'react';
import { Card, Button, Input, Form, Checkbox, Space } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

export default function Step3_4_5({ onNext }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();

    const handleSubmit = () => {
        form.validateFields().then(values => {
            Swal.fire('Confirmed', `Drawing Suspended. Target ECN: ${values.target_ecn}`, 'success')
                .then(() => onNext(3.5, 'Confirm DWG Suspend', `Target ECN: ${values.target_ecn}`, values));
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
        <Card title="Step 3.4.5: Drawing Suspension Confirmation (Engineer Assigned)"
            style={{ borderColor: theme.colors.error, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Form.Item
                    name="confirm_suspend"
                    valuePropName="checked"
                    rules={[
                        { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('You must confirm the suspension.')) }
                    ]}
                >
                    <Checkbox style={{ fontWeight: 'bold', color: theme.colors.error }}>
                        Confirm DWG. Suspend (Drawing no longer usable temporarily)
                    </Checkbox>
                </Form.Item>

                <Form.Item label="Target ECN Number" name="target_ecn" rules={[{ required: true }]}>
                    <Input placeholder="Enter the ECN number assigned to this change" />
                </Form.Item>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="primary" danger onClick={handleSubmit}>Confirm & Proceed to Execution</Button>
                </div>
            </Form>
        </Card>
    );
}
