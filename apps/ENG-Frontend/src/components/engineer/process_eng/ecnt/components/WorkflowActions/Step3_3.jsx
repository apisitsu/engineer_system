import React from 'react';
import { Card, Button, Input, Form, Radio } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

export default function Step3_3({ onNext, ecrData }) {
    const { theme } = useTheme();
    const [form] = Form.useForm();
    const topMgmtNeed = Form.useWatch('top_mgmt', form);

    const handleAction = (action) => {
        form.validateFields().then(values => {
            if (action === 'Deny') {
                Swal.fire('Denied', `ECR has been denied.`, 'error')
                    .then(() => onNext(3.3, 'Deny', values.comment));
                return;
            }

            Swal.fire('Success', `Action [${action}] taken.`, 'success')
                .then(() => {
                    let nextStepNum;
                    if (topMgmtNeed === 'Need') {
                        nextStepNum = 3.4;
                    } else {
                        // Phase 8: Skip 3.4. Should we also skip 3.45?
                        if (ecrData?.is_drawing || ecrData?.is_tooling) {
                            nextStepNum = 3.45;
                        } else {
                            nextStepNum = 3.5;
                        }
                    }
                    onNext(nextStepNum, action, values.comment);
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
                    <Button type="primary" onClick={() => handleAction('Approve')}>Issue ECN</Button>
                </div>
            </Form>
        </Card>
    );
}
