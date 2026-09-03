import React, { useState } from 'react';
import { Card, Button, Input, Form, Alert, Select } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../../constance/constance';

const { TextArea } = Input;
const { Option } = Select;

export default function WorkflowActionCard({ documentId, documentType, currentBlock, processStatus, tasksData, onSuccess }) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [actionType, setActionType] = useState(null); // APPROVE, DENY, REQUEST_MORE_DETAIL

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            // Mock user
            const payload = {
                block_number: currentBlock,
                action: actionType,
                action_by: localStorage.getItem('u_code') || 'EMP123',
                action_by_name: localStorage.getItem('u_name') || 'Test User',
                action_role: 'System User', // In real app, derived from auth
                comment: values.comment,
                deny_reason: actionType === 'DENY' ? values.deny_reason : null,
                details: values.details || {}
            };

            const endpoint = documentType === 'ECR' ? `/api/ecnt/ecr/${documentId}/action` : `/api/ecnt/ecn/${documentId}/action`;
            await axios.put(`${server.URL}${endpoint}`, payload, { withCredentials: true });

            antdMessage.success(`Successfully recorded action: ${actionType}`);
            form.resetFields();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            antdMessage.error(error?.response?.data?.error || "Action Failed");
        } finally {
            setLoading(false);
        }
    };

    if (processStatus === 'Draft' || processStatus === 'Closed' || processStatus === 'ECN Effective') {
        return null;
    }

    // Determine what forms to show based on block and type
    const renderBlockSpecificForms = () => {
        if (documentType === 'ECR' && currentBlock === 4 && actionType === 'APPROVE') {
            return (
                <Form.Item name={['details', 'is_issue_ecn']} label="Action Decision" rules={[{ required: true }]}>
                    <Select placeholder="Select next step">
                        <Option value={true}>Issue ECN</Option>
                        <Option value={false}>Close as ECR Only</Option>
                    </Select>
                </Form.Item>
            );
        }
        
        if (documentType === 'ECN') {
            if (currentBlock === 7 && actionType === 'APPROVE') {
                return (
                    <>
                        <Form.Item name={['details', 'decision']} label="MSA Decision" rules={[{ required: true }]}>
                            <Select>
                                <Option value="REQUIRE">MSA Require</Option>
                                <Option value="NOT_REQUIRE">MSA Not Require</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name={['details', 'reason']} label="Reason"><TextArea rows={2}/></Form.Item>
                    </>
                );
            }
            if (currentBlock === 8 && actionType === 'APPROVE') {
                return (
                    <>
                        <Form.Item name={['details', 'decision']} label="FAI Decision" rules={[{ required: true }]}>
                            <Select>
                                <Option value="REQUIRE">Require FAI</Option>
                                <Option value="NOT_REQUIRE">FAI Not Require</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name={['details', 'fai_type']} label="FAI Type">
                            <Select>
                                <Option value="DELTA">Delta FAI</Option>
                                <Option value="FULL">Full FAI</Option>
                            </Select>
                        </Form.Item>
                        <Form.Item name={['details', 'reason']} label="Reason"><TextArea rows={2}/></Form.Item>
                    </>
                );
            }
        }
        return null;
    };

    return (
        <Card title={`Take Action: Block ${currentBlock}`} style={{ marginTop: 24, borderColor: '#1677ff' }} headStyle={{ background: '#e6f4ff', color: '#1677ff' }}>
            <Alert message={`Current Status: ${processStatus}`} type="info" showIcon style={{ marginBottom: 16 }} />
            
            <Form form={form} layout="vertical">
                {renderBlockSpecificForms()}

                {actionType === 'DENY' && (
                    <Form.Item name="deny_reason" label="Reason for Denial" rules={[{ required: true }]}>
                        <TextArea rows={2} />
                    </Form.Item>
                )}
                
                <Form.Item name="comment" label="Comment (Optional)">
                    <TextArea rows={2} placeholder="Add any notes..." />
                </Form.Item>

                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <Button 
                        type="primary" 
                        onClick={() => { setActionType('APPROVE'); setTimeout(handleSubmit, 100); }} 
                        loading={loading}
                    >
                        Approve / Proceed
                    </Button>
                    <Button 
                        type="default" 
                        danger 
                        onClick={() => { setActionType('DENY'); setTimeout(handleSubmit, 100); }} 
                        loading={loading}
                    >
                        Deny / Terminate
                    </Button>
                    <Button 
                        onClick={() => { setActionType('REQUEST_MORE_DETAIL'); setTimeout(handleSubmit, 100); }} 
                        loading={loading}
                    >
                        Request More Detail
                    </Button>
                </div>
            </Form>
        </Card>
    );
}
