import React from 'react';
import { Card, Button, Input, Form, Row, Col } from 'antd';
import { useTheme } from '../../../../../../theme';
import Swal from 'sweetalert2';

export default function Step3_4({ onNext }) {
    const { theme } = useTheme();

    const handleApprove = (role) => {
        Swal.fire('Approved', `${role} approved!`, 'success')
            .then(() => {
                onNext(3.45, 'Approve', '', { manager_role: role });
            });
    };

    const handleDeny = (role) => {
        Swal.fire('Denied', `${role} denied!`, 'error')
            .then(() => {
                onNext(3.4, 'Deny', '', { manager_role: role });
            });
    };

    return (
        <Card title="Step 3.4: Top Management Approval"
            style={{ borderColor: theme.colors.warning, marginTop: 20 }}>
            <Row gutter={16}>
                <Col span={12}>
                    <Card type="inner" title="Thai Manager / Division Head">
                        <Input.TextArea placeholder="Comments..." rows={2} style={{ marginBottom: 10 }} />
                        <Button type="primary" onClick={() => handleApprove('Thai Manager')}>Approve</Button>
                        <Button type="primary" danger style={{ marginLeft: 8 }} onClick={() => handleDeny('Thai Manager')}>Deny</Button>
                    </Card>
                </Col>
                <Col span={12}>
                    <Card type="inner" title="Japanese Manager">
                        <Input.TextArea placeholder="Comments..." rows={2} style={{ marginBottom: 10 }} />
                        <Button type="primary" onClick={() => handleApprove('Japanese Manager')}>Approve</Button>
                        <Button type="primary" danger style={{ marginLeft: 8 }} onClick={() => handleDeny('Japanese Manager')}>Deny</Button>
                    </Card>
                </Col>
            </Row>
        </Card>
    );
}
