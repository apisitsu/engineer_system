import React from 'react';
import { Card, Button, Input, Form, Radio } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

export default function Step3_3({ onNext }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const topMgmtNeed = Form.useWatch('top_mgmt', form);

    const handleAction = (action) => {
        form.validateFields().then(values => {
            Swal.fire('Success', `Action [${action}] taken.`, 'success')
                .then(() => {
                    if (topMgmtNeed === 'Need') onNext(3.4, action, values.comment);
                    else onNext(3.45, action, values.comment); // Go to 3.4.5 directly
                });
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
        <Card title="Step 3.3: ECR Approval / ECN Issuance (Eng. Dept. Manager)"
            style={{ borderColor: theme.colors.primary, marginTop: 20 }}>
            <Form form={form} layout="vertical">
                <Form.Item label="Top Management Approval Requirement" name="top_mgmt" rules={[{ required: true }]}>
                    <Radio.Group>
                        <Radio value="Need">Need (Impacts Cost/Major)</Radio>
                        <Radio value="No Need">No Need</Radio>
                    </Radio.Group>
                </Form.Item>
                <Form.Item label="Comment" name="comment">
                    <Input.TextArea rows={3} />
                </Form.Item>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Button type="primary" danger onClick={() => handleAction('Deny')}>Deny</Button>
                    <Button onClick={() => handleAction('ECR Only')}>Approve ECR Only</Button>
                    <Button type="primary" onClick={() => handleAction('Issue ECN')}>Issue ECN</Button>
                </div>
            </Form>
        </Card>
    );
}
