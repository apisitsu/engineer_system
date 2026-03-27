import React, { useState } from 'react';
import { Layout, Card, Button, Form, Checkbox, Result } from 'antd';
import { useParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import { server, key_constance } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import Swal from 'sweetalert2';

const { Content } = Layout;

export default function CloseECN() {
    const { theme } = useTheme();
    const { id } = useParams();
    const navigate = useNavigate();
    const [form] = Form.useForm();

    const handleClose = () => {
        form.validateFields().then(async (values) => {
            const confirmResult = await Swal.fire({
                title: 'Confirm Close ECN?',
                text: "This action will officially close the ECN.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, Close it!'
            });

            if (confirmResult.isConfirmed) {
                try {
                    const userName = localStorage.getItem(key_constance.USER_NAME) || "Admin ECR";
                    const userRole = localStorage.getItem(key_constance.ROLE) || "AD";

                    const payload = {
                        step_number: "4.0",
                        action_by: userName,
                        action_role: userRole,
                        action_status: "Close",
                        comments: "Workflow Officially Closed",
                        details: values
                    };

                    await axios.put(`${server.ECR_REQUIRE_STATUS}${id}/status`, payload);

                    Swal.fire('Closed!', 'The ECN is now Closed / Effective.', 'success')
                        .then(() => navigate('/eng/process_eng/ecnt/dashboard'));
                } catch (err) {
                    console.error("Close ECN error:", err);
                    Swal.fire('Error', 'Failed to close ECN.', 'error');
                }
            }
        });
    };

    return (
        <Content style={{ height: '100vh', padding: '24px', backgroundColor: theme.colors.background }}>
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <Card title={<span style={{ color: theme.colors.success }}>Officially Close ECN (Step 4)</span>}
                    style={{ borderColor: theme.colors.success }}>
                    <Result
                        status="success"
                        title={`All steps for ECR/ECN ${id} are complete!`}
                        subTitle="Please confirm the drawing availability to finalize and close."
                    />

                    <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                        <Card type="inner" style={{ backgroundColor: theme.colors.surface }}>
                            <Form.Item
                                name="confirm_dwg"
                                valuePropName="checked"
                                rules={[
                                    { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('You must confirm drawing enabled.')) }
                                ]}
                            >
                                <Checkbox style={{ fontWeight: 'bold' }}>
                                    Confirm DWG. Enable (The drawing is updated and can now be used for production)
                                </Checkbox>
                            </Form.Item>
                        </Card>

                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30, gap: 16 }}>
                            <Button onClick={() => navigate(-1)}>Back</Button>
                            <Button type="primary" size="large" onClick={handleClose}>
                                Officially Close the ECN
                            </Button>
                        </div>
                    </Form>
                </Card>
            </div>
        </Content>
    );
}
