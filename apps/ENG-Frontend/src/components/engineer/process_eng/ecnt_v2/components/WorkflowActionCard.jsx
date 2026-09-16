import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Form, Alert, Select, Radio, Checkbox, Row, Col, Table, Tag, Typography } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { dispatchStageWorkflowEmail } from '../../../../../services/ecntEmailService';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const DEFAULT_DEPARTMENTS = [
    { dept_code: 'PC', dept_label: 'PC (Production Control)', default_pic: 'TASANEE CHUDUANG' },
    { dept_code: 'QA', dept_label: 'QA (Quality Assurance)', default_pic: 'CHUANPIT KHATTIYA' },
    { dept_code: 'QC', dept_label: 'QC (Quality Control)', default_pic: 'SUPARAT KATSANUK' },
    { dept_code: 'PD1', dept_label: 'Production #1', default_pic: 'CHANASORN MEEPRO' },
    { dept_code: 'PD2', dept_label: 'Production #2', default_pic: 'WATCHARIYA ROEKARAM' },
    { dept_code: 'MC', dept_label: 'MC (Machining)', default_pic: 'PUSSADEE ROIKEAW' },
    { dept_code: 'MM', dept_label: 'MM (Materials)', default_pic: 'Sarunyu Chokchaikasemsuk' },
];

export default function WorkflowActionCard({ 
    documentId, 
    documentType, 
    currentBlock, 
    processStatus, 
    tasksData = [], 
    systemConfig = {},
    docData = null,
    onSuccess 
}) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { userName, empNo, userRole, userDepartment } = useAuthStore();

    // Dynamically derive active concern departments from systemConfig
    const getActiveDepartments = React.useCallback(() => {
        if (systemConfig?.concern_depts && Array.isArray(systemConfig.concern_depts) && systemConfig.concern_depts.length > 0) {
            return systemConfig.concern_depts
                .filter(d => d.enabled !== false)
                .map(d => ({
                    dept_code: d.dept_code,
                    dept_label: d.dept_name ? `${d.dept_code} (${d.dept_name})` : d.dept_code,
                    default_pic: d.default_pic || ''
                }));
        }
        return DEFAULT_DEPARTMENTS;
    }, [systemConfig]);

    const [deptTasks, setDeptTasks] = useState(
        getActiveDepartments().map(d => ({ ...d, is_needed: true }))
    );
    const [engineerCandidates, setEngineerCandidates] = useState([]);

    useEffect(() => {
        setDeptTasks(getActiveDepartments().map(d => ({ ...d, is_needed: true })));
    }, [getActiveDepartments]);

    useEffect(() => {
        if (currentBlock === 4) {
            axios.get(`${server.URL}/api/ecnt/user-candidates`, { withCredentials: true })
                .then(res => {
                    const list = (res.data?.data || []).filter(u => (u.u_nickname || '').toLowerCase() !== 'admin');
                    setEngineerCandidates(list);
                })
                .catch(err => console.warn("Fetch candidates error:", err));
        }
    }, [currentBlock]);

    const isIssueEcn = Form.useWatch(['details', 'is_issue_ecn'], form);
    const faiDecision = Form.useWatch(['details', 'decision'], form);

    useEffect(() => {
        form.resetFields();
        if (currentBlock === 4) {
            const defaultEng = systemConfig?.stage_assignees?.default_assigned_engineer?.name || 'NATHAPORN YAMMANUS';
            form.setFieldsValue({
                details: { is_issue_ecn: true },
                assigned_to: defaultEng
            });
        } else if (currentBlock === 7) {
            form.setFieldsValue({ details: { decision: 'NOT_REQUIRE' } });
        } else if (currentBlock === 8) {
            form.setFieldsValue({ details: { decision: 'NOT_REQUIRE', fai_type: 'DELTA' } });
        } else if (currentBlock === 9) {
            form.setFieldsValue({ details: { fai_approved_confirmed: true } });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentBlock, documentId, form]);

    if (processStatus === 'Draft' || processStatus === 'ECR Only Closed' || processStatus === 'ECN Effective' || processStatus === 'Denied') {
        return null;
    }

    const handleSubmit = async (selectedAction, extraDetails = {}) => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                block_number: currentBlock,
                action: selectedAction,
                action_by: empNo || localStorage.getItem('u_code') || 'EMP123',
                action_by_name: userName || localStorage.getItem('u_name') || 'User',
                action_role: userRole || userDepartment || 'Approver',
                comment: values.comment || '',
                deny_reason: selectedAction === 'DENY' ? values.deny_reason : null,
                request_to_requester: selectedAction === 'REQUEST_MORE_DETAIL' ? values.request_to_requester : null,
                assigned_to: values.assigned_to || null,
                details: {
                    ...(values.details || {}),
                    ...extraDetails
                }
            };

            // For Block 9, include tasks setup
            if (currentBlock === 9 && selectedAction === 'APPROVE') {
                payload.details.tasks = deptTasks;
            }

            const endpoint = documentType === 'ECR' 
                ? `/api/ecnt/ecr/${documentId}/action` 
                : `/api/ecnt/ecn/${documentId}/action`;

            await axios.put(`${server.URL}${endpoint}`, payload, { withCredentials: true });

            antdMessage.success(`Action '${selectedAction}' completed successfully.`);

            // Trigger Google Apps Script Email Notification asynchronously
            try {
                let nextStage = '';
                if (selectedAction === 'REQUEST_MORE_DETAIL') {
                    nextStage = currentBlock === 3 ? 'STAGE_2_R1' : (currentBlock === 4 ? 'STAGE_3_R1' : 'STAGE_5_R1');
                } else if (selectedAction === 'APPROVE') {
                    if (documentType === 'ECR') {
                        nextStage = currentBlock === 3 ? 'STAGE_3' : 'STAGE_4';
                    } else {
                        const nextMap = { 6: 'STAGE_7', 7: 'STAGE_7', 8: 'STAGE_9', 9: 'STAGE_9', 10: 'STAGE_10', 11: 'STAGE_10' };
                        nextStage = nextMap[currentBlock] || 'STAGE_10';
                    }
                }

                if (nextStage) {
                    dispatchStageWorkflowEmail({
                        stageCode: nextStage,
                        docData: docData || { id: documentId },
                        documentType,
                        actionTaken: selectedAction,
                        comment: values.comment || values.request_to_requester || values.deny_reason || '',
                        assignedPicName: values.assigned_to || '',
                        systemConfig
                    }).catch(emailErr => console.warn("[WorkflowActionCard] Email dispatch background error:", emailErr));
                }
            } catch (notifyErr) {
                console.warn("[WorkflowActionCard] Notification trigger failed:", notifyErr);
            }

            form.resetFields();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Action Error:", error);
            antdMessage.error(error?.response?.data?.error || "Action Failed. Please verify input fields.");
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledgeTask = (taskId) => {
        handleSubmit('ACKNOWLEDGE', { 
            task_id: taskId,
            dwg_enabled: form.getFieldValue(['details', 'dwg_enabled']) 
        });
    };

    // Render Forms per block
    const renderBlockContent = () => {
        // Block 3: Dept Mgr
        if (documentType === 'ECR' && currentBlock === 3) {
            return (
                <Alert 
                    message="Action Required: Requester's Department Manager Approval" 
                    description="Please review technical changes and approve, deny, or request more information." 
                    type="info" 
                    showIcon 
                    style={{ marginBottom: 16 }}
                />
            );
        }

        // Block 4: Eng Dept Mgr
        if (documentType === 'ECR' && currentBlock === 4) {
            const engMgrName = systemConfig?.stage_assignees?.eng_mgr?.name || 'TEERAPOL KANTAPOOM';
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message={`Block 4: Engineer Department Manager Decision (${engMgrName})`}
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name={['details', 'is_issue_ecn']} label="Action Decision" rules={[{ required: true }]}>
                                <Select>
                                    <Option value={true}>Option A: Issue ECN (Proceed to Block 5)</Option>
                                    <Option value={false}>Option B: ECR Only (Close and Categorize)</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        {isIssueEcn ? (
                            <Col span={12}>
                                <Form.Item name="assigned_to" label="Assign Engineer (Eng. Assigned)" rules={[{ required: true }]}>
                                    <Select 
                                        placeholder="Select registered engineer..." 
                                        showSearch 
                                        allowClear
                                        filterOption={(input, option) =>
                                            (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                    >
                                        {engineerCandidates.length > 0 ? (
                                            engineerCandidates.map(u => (
                                                <Option key={u.u_code} value={u.u_name}>
                                                    {u.u_name} ({u.u_code}{u.u_nickname ? ` "${u.u_nickname}"` : ''}) - {u.u_department} [{u.position || u.role}]
                                                </Option>
                                            ))
                                        ) : (
                                            <>
                                                <Option value="NATHAPORN YAMMANUS">NATHAPORN YAMMANUS (ENG)</Option>
                                                <Option value="TEERAPOL KANTAPOOM">TEERAPOL KANTAPOOM (ENG MGR)</Option>
                                                <Option value="TASANEE CHUDUANG">TASANEE CHUDUANG (PC)</Option>
                                            </>
                                        )}
                                    </Select>
                                </Form.Item>
                            </Col>
                        ) : (
                            <Col span={12}>
                                <Form.Item name={['details', 'ecr_only_reason']} label="Reason for ECR Only" rules={[{ required: true }]}>
                                    <Input placeholder="Specify why no ECN is required..." />
                                </Form.Item>
                            </Col>
                        )}
                    </Row>
                </div>
            );
        }

        // Block 6: Eng Dept Mgr Approve ECN
        if (documentType === 'ECN' && currentBlock === 6) {
            const engMgrName = systemConfig?.stage_assignees?.eng_mgr?.name || 'TEERAPOL KANTAPOOM';
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message={`Block 6: Engineer Dept Manager Approve ECN (${engMgrName})`}
                        description="Approving will transition to QC evaluation and authorize starting drawing & document revisions."
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                </div>
            );
        }

        // Block 7: QC Decision for MSA
        if (documentType === 'ECN' && currentBlock === 7) {
            const qcPicName = systemConfig?.stage_assignees?.default_qc_pic?.name || 'PATCHARAYADA WAIYABOON';
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert message={`Block 7: QC Decision for MSA (${qcPicName})`} type="info" showIcon style={{ marginBottom: 16 }} />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name={['details', 'decision']} label="MSA Decision" rules={[{ required: true }]}>
                                <Radio.Group>
                                    <Radio value="REQUIRE">MSA Require</Radio>
                                    <Radio value="NOT_REQUIRE">MSA Not Require</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name={['details', 'reason']} label="Reason for MSA Decision" rules={[{ required: true }]}>
                                <TextArea rows={2} placeholder="Explain why MSA is or is not required..." />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            );
        }

        // Block 8: QC Decision for FAI
        if (documentType === 'ECN' && currentBlock === 8) {
            const qcPicName = systemConfig?.stage_assignees?.default_qc_pic?.name || 'PATCHARAYADA WAIYABOON';
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert message={`Block 8: QC Decision for FAI (${qcPicName})`} type="info" showIcon style={{ marginBottom: 16 }} />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name={['details', 'decision']} label="FAI Decision" rules={[{ required: true }]}>
                                <Radio.Group>
                                    <Radio value="REQUIRE">Require FAI</Radio>
                                    <Radio value="NOT_REQUIRE">FAI Not Require</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        {faiDecision === 'REQUIRE' && (
                            <Col span={12}>
                                <Form.Item name={['details', 'fai_type']} label="FAI Type" rules={[{ required: true }]}>
                                    <Radio.Group>
                                        <Radio value="DELTA">Require ΔFAI (Delta)</Radio>
                                        <Radio value="FULL">Require Full FAI</Radio>
                                    </Radio.Group>
                                </Form.Item>
                            </Col>
                        )}
                        <Col span={24}>
                            <Form.Item name={['details', 'reason']} label="Reason for FAI Decision" rules={[{ required: true }]}>
                                <TextArea rows={2} placeholder="Explain reason for FAI requirement..." />
                            </Form.Item>
                        </Col>
                    </Row>
                </div>
            );
        }

        // Block 9: Engineer Summary & Department Tasks Setup
        if (documentType === 'ECN' && currentBlock === 9) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert message="Block 9: Engineer Assigned Summary & Department Task Setup" type="info" showIcon style={{ marginBottom: 16 }} />
                    <Row gutter={16}>
                        <Col span={24}>
                            <Form.Item name={['details', 'fai_approved_confirmed']} valuePropName="checked">
                                <Checkbox style={{ fontWeight: 600 }}>Confirm FAI Approved if Required (ติ๊กยืนยันเมื่อได้รับผล FAI ที่ผ่านแล้ว)</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['details', 'fai_lot_no']} label="FAI Lot No.">
                                <Input placeholder="Lot number used in FAI..." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name={['details', 'summary_result']} label="Summary of FAI Result & Summarize">
                                <TextArea rows={2} placeholder="Summarize FAI inspection and measurement results..." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name={['details', 'stakeholder_comment']} label="Stakeholder Comment / Action">
                                <TextArea rows={2} placeholder="Notes or required actions for stakeholders..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <h5 style={{ marginTop: 12, marginBottom: 8, color: '#1677ff' }}>Configure Block 10 Concern Departments (NEED / NO NEED):</h5>
                    <Table 
                        dataSource={deptTasks} 
                        rowKey="dept_code" 
                        pagination={false} 
                        size="small"
                        columns={[
                            { title: 'Dept', dataIndex: 'dept_code', width: 80 },
                            { title: 'Department Name', dataIndex: 'dept_label' },
                            { title: 'Default Person In-Charge', dataIndex: 'default_pic' },
                            { 
                                title: 'Involvement', 
                                key: 'action', 
                                width: 140,
                                render: (_, record, index) => (
                                    <Radio.Group 
                                        value={record.is_needed} 
                                        onChange={e => {
                                            const updated = [...deptTasks];
                                            updated[index].is_needed = e.target.value;
                                            setDeptTasks(updated);
                                        }}
                                    >
                                        <Radio value={true}>NEED</Radio>
                                        <Radio value={false}>NO NEED</Radio>
                                    </Radio.Group>
                                )
                            }
                        ]}
                    />
                </div>
            );
        }

        // Block 10: Concern Multi-Dept Acknowledgment
        if (documentType === 'ECN' && currentBlock === 10) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message="Block 10: Multi-Department Concern Acknowledgment" 
                        description="Departments flagged as NEED must review and acknowledge before ECN can be officially closed."
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />

                    <div style={{ marginBottom: 14, background: '#e6f7ff', padding: '10px 14px', borderRadius: 6, border: '1px solid #91d5ff' }}>
                        <Form.Item name={['details', 'dwg_enabled']} valuePropName="checked" noStyle>
                            <Checkbox style={{ fontWeight: 600, color: '#096dd9' }}>
                                Confirm DWG. Enable (Engineer Assigned confirms drawing active status in Innovator)
                            </Checkbox>
                        </Form.Item>
                    </div>

                    <Table 
                        dataSource={tasksData} 
                        rowKey="id" 
                        pagination={false} 
                        size="small"
                        columns={[
                            { title: 'Department', dataIndex: 'dept_label' },
                            { 
                                title: 'Requirement', 
                                dataIndex: 'is_needed',
                                render: val => val ? <Tag color="blue">NEED</Tag> : <Tag color="default">NO NEED</Tag>
                            },
                            { 
                                title: 'Status', 
                                dataIndex: 'status',
                                render: status => status === 'ACKNOWLEDGED' 
                                    ? <Tag icon={<CheckCircleOutlined />} color="success">ACKNOWLEDGED</Tag>
                                    : <Tag icon={<ClockCircleOutlined />} color="warning">PENDING</Tag>
                            },
                            { 
                                title: 'Acknowledged By', 
                                render: (_, r) => r.approved_by_name ? `${r.approved_by_name} (${r.approved_by || ''})` : '-'
                            },
                            {
                                title: 'Action',
                                key: 'sign',
                                render: (_, record) => {
                                    if (!record.is_needed) return <Text type="secondary">Not Required</Text>;
                                    if (record.status === 'ACKNOWLEDGED') return <Text type="success">Signed</Text>;
                                    return (
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            onClick={() => handleAcknowledgeTask(record.id)}
                                            loading={loading}
                                        >
                                            Sign / Acknowledge
                                        </Button>
                                    );
                                }
                            }
                        ]}
                    />
                </div>
            );
        }

        // Block 11: Official Close
        if (documentType === 'ECN' && currentBlock === 11) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message="Block 11: Officially Close ECN (TEERAPOL KANTAPOOM)" 
                        description="Once closed, status will become ECN Effective and the official change notice PDF can be generated."
                        type="success" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                </div>
            );
        }

        return null;
    };

    return (
        <Card 
            title={<span style={{ color: '#1890ff', fontWeight: 600 }}>Workflow Action: Block {currentBlock}</span>} 
            style={{ marginTop: 20, borderColor: '#91d5ff' }} 
            headStyle={{ background: '#f0f5ff' }}
        >
            <Form form={form} layout="vertical">
                {renderBlockContent()}

                {/* Common Comment & Deny / RMD details */}
                {currentBlock !== 10 && currentBlock !== 11 && (
                    <>
                        <Form.Item name="request_to_requester" label="Detail Requested from Requester / Engineer (If requesting more detail)">
                            <TextArea rows={2} placeholder="Explain what additional info is needed..." />
                        </Form.Item>
                        {currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9 && (
                            <Form.Item name="deny_reason" label="Reason for Denial (If denying)">
                                <TextArea rows={2} placeholder="Explain reason for denial..." />
                            </Form.Item>
                        )}
                        <Form.Item name="comment" label="Optional Notes / Comments">
                            <TextArea rows={2} placeholder="Add any comments..." />
                        </Form.Item>
                    </>
                )}

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    {currentBlock === 10 ? (
                        <Text type="secondary">
                            Use the "Sign / Acknowledge" button in the table above for your department. Once all required departments sign, the ECN will advance to Block 11 automatically.
                        </Text>
                    ) : currentBlock === 11 ? (
                        <Button 
                            type="primary" 
                            size="large" 
                            style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            onClick={() => handleSubmit('CLOSE')} 
                            loading={loading}
                        >
                            Officially Close ECN (Make Effective)
                        </Button>
                    ) : (
                        <>
                            <Button 
                                type="primary" 
                                size="large"
                                onClick={() => handleSubmit('APPROVE')} 
                                loading={loading}
                            >
                                {currentBlock === 9 ? 'Submit Summary & Proceed to Block 10' : 'Approve / Proceed'}
                            </Button>
                            
                            {/* Block 6, 7, 8, 9 do NOT have Deny per requirement flowchart */}
                            {currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9 && (
                                <Button 
                                    danger 
                                    size="large"
                                    onClick={() => handleSubmit('DENY')} 
                                    loading={loading}
                                >
                                    Deny / Terminate
                                </Button>
                            )}

                            {/* Request More Detail */}
                            {(currentBlock === 3 || currentBlock === 4 || currentBlock === 6) && (
                                <Button 
                                    size="large"
                                    style={{ background: '#fff7e6', borderColor: '#fa8c16', color: '#d46b08', fontWeight: 600 }}
                                    onClick={() => {
                                        const rmdText = form.getFieldValue('request_to_requester');
                                        if (!rmdText || !rmdText.trim()) {
                                            antdMessage.warning("Please specify the required changes in 'Detail Requested from Requester / Engineer' above.");
                                            return;
                                        }
                                        handleSubmit('REQUEST_MORE_DETAIL');
                                    }} 
                                    loading={loading}
                                >
                                    Request More Detail (Return for Rework)
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </Form>
        </Card>
    );
}
