import React, { useState } from 'react';
import { Card, Button, Input, Form, Space, Divider, Select } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

const { TextArea } = Input;
const { Option } = Select;

export default function Step3_1({ onNext }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();

    const handleAction = (action) => {
        form.validateFields().then(values => {
            Swal.fire('Success', `Action [${action}] submitted!`, 'success')
                .then(() => onNext(3.2, action, values.comment));
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
        <Card title="Step 3.1: Requester's Dept. Manager Approval"
            style={{ borderColor: theme.colors.primary, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Form.Item label="Comment / Remark" name="comment" rules={[{ required: true }]}>
                    <TextArea rows={4} placeholder="Please provide any comments or reasons" />
                </Form.Item>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Button type="primary" danger onClick={() => handleAction('Deny')}>Deny</Button>
                    <Button onClick={() => handleAction('Request More Detail')}>Request More Detail</Button>
                    <Button type="primary" onClick={() => handleAction('Approve')}>Approve</Button>
                </div>
            </Form>
        </Card>
    );
}
