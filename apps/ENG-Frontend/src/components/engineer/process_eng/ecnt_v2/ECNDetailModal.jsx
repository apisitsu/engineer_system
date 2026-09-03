import React, { useState, useEffect } from 'react';
import { Modal, Spin, Button, Typography, Divider, Row, Col, Alert, Checkbox, Collapse, Steps, Tag, Table, Space, Card } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../constance/constance';
import WorkflowActionCard from './components/WorkflowActionCard';
import AttachmentManager from './components/AttachmentManager';
import CreateECRModal from './CreateECRModal';
import CreateECNModal from './CreateECNModal';
import StatusBadge from './components/StatusBadge';
import FieldAttachmentDisplay from './components/FieldAttachmentDisplay';
import { generateEcnPdf } from './utils/pdfGenerator';
import { FilePdfOutlined, EditOutlined, PlusCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../../../stores/authStore';

const { Text, Title, Paragraph } = Typography;

const WORKFLOW_STEPS = [
    { title: 'B1-2', description: 'ECR Request' },
    { title: 'B3', description: 'Dept Mgr' },
    { title: 'B4', description: 'Eng Mgr' },
    { title: 'B5', description: 'ECN Create' },
    { title: 'B6', description: 'Eng Mgr ECN' },
    { title: 'B7', description: 'QC MSA' },
    { title: 'B8', description: 'QC FAI' },
    { title: 'B9', description: 'Eng Summary' },
    { title: 'B10', description: 'Concerns' },
    { title: 'B11', description: 'Effective' },
];

export default function ECNDetailModal({ open, documentId, documentType, onClose }) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [docData, setDocData] = useState(null);
    const [linkedEcr, setLinkedEcr] = useState(null);
    const [logs, setLogs] = useState([]);
    const [attachments, setAttachments] = useState([]);

    const [impactData, setImpactData] = useState(null);
    const [qcData, setQcData] = useState([]);
    const [faiData, setFaiData] = useState(null);
    const [tasksData, setTasksData] = useState([]);

    // Sub-modals for workflow progression
    const [isResubmitOpen, setIsResubmitOpen] = useState(false);
    const [isCreateEcnOpen, setIsCreateEcnOpen] = useState(false);

    const { empNo, userName } = useAuthStore();

    useEffect(() => {
        if (open && documentId) {
            fetchDetail();
        }
    }, [open, documentId, documentType]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const endpoint = documentType === 'ECR' ? `/api/ecnt/ecr/${documentId}` : `/api/ecnt/ecn/${documentId}`;
            const response = await axios.get(`${server.URL}${endpoint}`, { withCredentials: true });
            
            const mainDoc = response.data.data;
            setDocData(mainDoc);
            setLogs(response.data.logs || []);
            setAttachments(response.data.attachments || []);
            
            if (documentType === 'ECN') {
                setImpactData(response.data.impact);
                setQcData(response.data.qc || []);
                setFaiData(response.data.fai || null);
                setTasksData(response.data.tasks || []);

                // Fetch linked ECR for full data
                if (mainDoc.ecr_id) {
                    try {
                        const ecrRes = await axios.get(`${server.URL}/api/ecnt/ecr/${mainDoc.ecr_id}`, { withCredentials: true });
                        setLinkedEcr(ecrRes.data.data);
                    } catch (e) {
                        console.warn("Linked ECR fetch failed:", e);
                    }
                }
            } else {
                setLinkedEcr(mainDoc);
            }
        } catch (error) {
            console.error("Fetch Detail Error:", error);
            antdMessage.error("Failed to load document details");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        try {
            await generateEcnPdf(docData, linkedEcr, impactData, qcData, tasksData);
            antdMessage.success("Official ECN PDF Generated and Downloaded Successfully!");
        } catch (error) {
            console.error(error);
            antdMessage.error("Failed to generate PDF: " + (error.message || "Unknown error"));
        }
    };

    // Calculate active Step in Steps component
    const getActiveStepIndex = () => {
        if (!docData) return 0;
        const block = docData.current_block || 1;
        if (block <= 2) return 0;
        if (block === 3) return 1;
        if (block === 4) return 2;
        if (block === 5) return 3;
        if (block === 6) return 4;
        if (block === 7) return 5;
        if (block === 8) return 6;
        if (block === 9) return 7;
        if (block === 10) return 8;
        if (block === 11) return docData.process_status === 'ECN Effective' ? 10 : 9;
        return 0;
    };

    const isRequester = docData?.request_by === empNo || !docData?.request_by;
    const canResubmit = documentType === 'ECR' && docData?.process_status === 'Require More Detail' && isRequester;
    const canCreateEcn = documentType === 'ECR' && docData?.process_status === 'Issued ECN' && !docData?.linked_ecn_id;

    return (
        <Modal
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                    <Space size="middle">
                        <span style={{ fontSize: '18px', fontWeight: 600 }}>
                            {documentType === 'ECR' ? `ECR: ${docData?.ecr_no || '#' + docData?.id}` : `ECN: ${docData?.ecn_no || '#' + docData?.id}`}
                        </span>
                        <StatusBadge status={docData?.process_status} />
                    </Space>
                    <Space>
                        {canResubmit && (
                            <Button 
                                type="primary" 
                                icon={<EditOutlined />} 
                                onClick={() => setIsResubmitOpen(true)}
                                style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                            >
                                Edit & Resubmit ECR
                            </Button>
                        )}
                        {canCreateEcn && (
                            <Button 
                                type="primary" 
                                icon={<PlusCircleOutlined />} 
                                onClick={() => setIsCreateEcnOpen(true)}
                                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                            >
                                Proceed to Issue ECN (Block 5)
                            </Button>
                        )}
                        {docData?.process_status === 'ECN Effective' && (
                            <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>
                                Download Official ECN PDF
                            </Button>
                        )}
                    </Space>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={[<Button key="close" onClick={onClose}>Close</Button>]}
            width={1050}
            bodyStyle={{ padding: '16px 24px', maxHeight: '80vh', overflowY: 'auto' }}
            destroyOnClose
        >
            <Spin spinning={loading}>
                {docData && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        
                        {/* 1. Workflow Progress Indicator */}
                        <Card size="small" style={{ background: '#fafafa' }}>
                            <Steps 
                                current={getActiveStepIndex()} 
                                size="small"
                                items={WORKFLOW_STEPS.map(s => ({ title: s.title, description: s.description }))}
                            />
                        </Card>

                        {/* 2. Vertical Presentation with Accordion (Ant Design Collapse) */}
                        <Collapse 
                            defaultActiveKey={[
                                'overview_section', 
                                'action_section', 
                                'block1_section', 
                                'block2_section', 
                                'ecn_section',
                                'impact_section'
                            ]}
                            style={{ background: '#ffffff' }}
                        >
                            {/* Panel 1: Document Overview */}
                            <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>1. Document Overview & Header</Text>} key="overview_section">
                                <Row gutter={[16, 12]}>
                                    <Col span={8}><Text type="secondary">Document Type:</Text> <Tag color="blue">{documentType}</Tag></Col>
                                    <Col span={8}><Text type="secondary">Number:</Text> <Text strong>{docData.ecr_no || docData.ecn_no || 'Pending'}</Text></Col>
                                    <Col span={8}><Text type="secondary">Current Status:</Text> <StatusBadge status={docData.process_status} /></Col>
                                    
                                    <Col span={8}><Text type="secondary">Requester:</Text> <Text strong>{docData.request_by_name || docData.request_by}</Text></Col>
                                    <Col span={8}><Text type="secondary">Department:</Text> <Text>{docData.department}</Text></Col>
                                    <Col span={8}><Text type="secondary">Date:</Text> <Text>{moment(docData.created_at).format('DD-MMM-YYYY HH:mm')}</Text></Col>

                                    {docData.customer_name && (
                                        <Col span={8}><Text type="secondary">Customer Name:</Text> <Text strong>{docData.customer_name}</Text></Col>
                                    )}
                                    {docData.project_code && (
                                        <Col span={8}><Text type="secondary">Project Code:</Text> <Text strong>{docData.project_code}</Text></Col>
                                    )}
                                    {docData.ref_coc_no && (
                                        <Col span={8}><Text type="secondary">Ref COC No:</Text> <Text>{docData.ref_coc_no}</Text></Col>
                                    )}
                                    {docData.assigned_to && (
                                        <Col span={8}><Text type="secondary">Assigned Engineer:</Text> <Text strong style={{ color: '#722ed1' }}>{docData.assigned_to}</Text></Col>
                                    )}
                                </Row>
                            </Collapse.Panel>

                            {/* Panel 2: ECR Block 1 Request Details */}
                            <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>2. ECR Request Details (Block 1)</Text>} key="block1_section">
                                <Row gutter={[16, 12]}>
                                    <Col span={12}>
                                        <Text type="secondary">Status Type:</Text> <Tag color="purple">{docData.status_type || 'PERMANENT'}</Tag>
                                    </Col>
                                    <Col span={12}>
                                        <Text type="secondary">Objective:</Text> <Tag color="cyan">{docData.objective} {docData.objective_other ? `(${docData.objective_other})` : ''}</Tag>
                                    </Col>
                                    <Col span={24}>
                                        <Text type="secondary">Selected Changes:</Text>{' '}
                                        <Space size={4}>
                                            {docData.is_drawing && <Tag color="blue">Product/Process Drawing</Tag>}
                                            {docData.is_tooling && <Tag color="green">Tooling</Tag>}
                                            {docData.is_program && <Tag color="orange">Program</Tag>}
                                            {docData.is_usage && <Tag color="magenta">Usage / Setup</Tag>}
                                        </Space>
                                    </Col>
                                    <Col span={24}>
                                        <Text strong>Title of Change:</Text>
                                        <Paragraph style={{ marginTop: 4, background: '#fcfcfc', padding: 8, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                                            {docData.title_of_change}
                                        </Paragraph>
                                    </Col>
                                    <Col span={24}>
                                        <Text strong>Reason of Change:</Text>
                                        <Paragraph style={{ marginTop: 4, background: '#fcfcfc', padding: 8, borderRadius: 4, border: '1px solid #f0f0f0' }}>
                                            {docData.reason_of_change}
                                        </Paragraph>
                                        <FieldAttachmentDisplay attachments={attachments} fieldName="reason_of_change" />
                                    </Col>
                                </Row>
                            </Collapse.Panel>

                            {/* Panel 3: Technical Details (Block 2) */}
                            <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>3. Technical Details (Block 2)</Text>} key="block2_section">
                                {docData.is_drawing && (
                                    <div style={{ marginBottom: 14, padding: 10, background: '#fafafa', borderRadius: 6 }}>
                                        <Text strong style={{ color: '#1890ff' }}>A. Product / Process Drawing Change</Text>
                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                            <Col span={8}><Text type="secondary">Part No:</Text> {docData.dwg_part_no || '-'}</Col>
                                            <Col span={8}><Text type="secondary">C/N:</Text> {docData.dwg_cn || '-'}</Col>
                                            <Col span={8}><Text type="secondary">Revision:</Text> {docData.dwg_revision || '-'}</Col>
                                            <Col span={12}>
                                                <Text type="secondary">Before:</Text> 
                                                <div>{docData.dwg_before_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_before_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">After:</Text> 
                                                <div>{docData.dwg_after_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_after_change" />
                                            </Col>
                                        </Row>
                                    </div>
                                )}

                                {docData.is_tooling && (
                                    <div style={{ marginBottom: 14, padding: 10, background: '#fafafa', borderRadius: 6 }}>
                                        <Text strong style={{ color: '#1890ff' }}>B. Tooling Change</Text>
                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                            <Col span={12}><Text type="secondary">Current Tooling No:</Text> {docData.tool_current_no || '-'} ({docData.tool_current_usage} K/pc)</Col>
                                            <Col span={12}><Text type="secondary">New Tooling No:</Text> {docData.tool_new_no || '-'} ({docData.tool_new_usage} K/pc)</Col>
                                        </Row>
                                    </div>
                                )}

                                {docData.is_program && (
                                    <div style={{ marginBottom: 14, padding: 10, background: '#fafafa', borderRadius: 6 }}>
                                        <Text strong style={{ color: '#1890ff' }}>C. Cutting Program Change</Text>
                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                            <Col span={12}>
                                                <Text type="secondary">Program Before:</Text> 
                                                <div>{docData.prog_before_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="prog_before_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">Program After:</Text> 
                                                <div>{docData.prog_after_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="prog_after_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">Condition Before:</Text> 
                                                <div>{docData.prog_condition_before || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_before" />
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">Condition After:</Text> 
                                                <div>{docData.prog_condition_after || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_after" />
                                            </Col>
                                        </Row>
                                    </div>
                                )}

                                {docData.is_usage && (
                                    <div style={{ padding: 10, background: '#fafafa', borderRadius: 6 }}>
                                        <Text strong style={{ color: '#1890ff' }}>D. Setup / Usage Change</Text>
                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                            <Col span={8}><Text type="secondary">Setup Sheet No:</Text> {docData.usage_setup_no || '-'}</Col>
                                            <Col span={8}><Text type="secondary">Part No:</Text> {docData.usage_part_no || '-'}</Col>
                                            <Col span={8}><Text type="secondary">M/C No:</Text> {docData.usage_mc_no || '-'}</Col>
                                            <Col span={8}><Text type="secondary">Process:</Text> {docData.usage_process || '-'}</Col>
                                            <Col span={8}><Text type="secondary">Program No:</Text> {docData.usage_program_no || '-'}</Col>
                                            <Col span={8}><Text type="secondary">Cycle Time:</Text> {docData.usage_cycle_time_before || '-'} → {docData.usage_cycle_time_after || '-'}</Col>
                                            <Col span={12}>
                                                <Text type="secondary">Before Setup:</Text> 
                                                <div>{docData.usage_before_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="usage_before_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">After Setup:</Text> 
                                                <div>{docData.usage_after_change || '-'}</div>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="usage_after_change" />
                                            </Col>
                                        </Row>
                                    </div>
                                )}
                            </Collapse.Panel>

                            {/* Panel 4: Attachments */}
                            <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>4. File Attachments & Documentation</Text>} key="attachments_section">
                                <AttachmentManager documentId={docData.id} documentType={documentType} />
                            </Collapse.Panel>

                            {/* ECN Sections (If documentType === 'ECN') */}
                            {documentType === 'ECN' && (
                                <>
                                    {/* Panel 5: ECN Scope & Details (Block 5) */}
                                    <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>5. ECN Scope & Execution Details (Block 5)</Text>} key="ecn_section">
                                        <Row gutter={[16, 12]}>
                                            <Col span={12}>
                                                <Text type="secondary">DWG Suspended:</Text>{' '}
                                                {docData.dwg_suspended ? <Tag color="error">CONFIRMED SUSPENDED</Tag> : <Tag>NO</Tag>}
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">DWG Enabled in Innovator:</Text>{' '}
                                                {docData.dwg_enabled ? <Tag color="success">CONFIRMED ACTIVE</Tag> : <Tag color="warning">PENDING</Tag>}
                                            </Col>
                                            <Col span={24}>
                                                <Text strong>Scope of Implementation:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fcfcfc', padding: 8, borderRadius: 4 }}>
                                                    {docData.scope_of_implementation || 'N/A'}
                                                </Paragraph>
                                            </Col>
                                            <Col span={12}>
                                                <Text strong>Before Change:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fcfcfc', padding: 8, borderRadius: 4 }}>
                                                    {docData.before_change || 'N/A'}
                                                </Paragraph>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="before_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text strong>After Change:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fcfcfc', padding: 8, borderRadius: 4 }}>
                                                    {docData.after_change || 'N/A'}
                                                </Paragraph>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="after_change" />
                                            </Col>
                                        </Row>
                                    </Collapse.Panel>

                                    {/* Panel 6: Impact Assessment */}
                                    <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>6. Impact Assessment (Block 5 Checklist)</Text>} key="impact_section">
                                        {impactData ? (
                                            <Row gutter={[16, 10]}>
                                                <Col span={8}><Checkbox checked={impactData.has_customer_impact}>Customer Impact</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_kzw_fjsw_impact}>KZW/FJSW Impact</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_sale_drawing_impact}>Sale Drawing</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_traceability}>Traceability</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_wip_stock}>WIP / Stock</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_outsourcing}>Outsourcing</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_unit_price}>Unit Price</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_manufacturing}>Manufacturing</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_product_quality}>Product Quality</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_safety}>Safety</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_otd}>On-Time Delivery</Checkbox></Col>
                                            </Row>
                                        ) : (
                                            <Text type="secondary">No impact data recorded.</Text>
                                        )}
                                    </Collapse.Panel>

                                    {/* Panel 7: QC Evaluations */}
                                    <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>7. QC Decisions: MSA & FAI (Blocks 7-8)</Text>} key="qc_section">
                                        {qcData && qcData.length > 0 ? (
                                            <Space direction="vertical" style={{ width: '100%' }}>
                                                {qcData.map(qc => (
                                                    <Alert 
                                                        key={qc.id} 
                                                        type={qc.decision === 'REQUIRE' ? 'warning' : 'success'} 
                                                        message={<Text strong>{qc.decision_type}: {qc.decision} {qc.fai_type ? `(${qc.fai_type})` : ''}</Text>} 
                                                        description={
                                                            <div>
                                                                <div>{qc.reason || 'No reason provided.'}</div>
                                                                <Text type="secondary" style={{ fontSize: 11 }}>
                                                                    Confirmed by {qc.confirmed_by_name} on {moment(qc.confirmed_date).format('DD-MMM-YYYY HH:mm')}
                                                                </Text>
                                                            </div>
                                                        }
                                                    />
                                                ))}
                                            </Space>
                                        ) : (
                                            <Text type="secondary">Pending QC Decisions.</Text>
                                        )}
                                    </Collapse.Panel>

                                    {/* Panel 8: FAI Summary (Block 9) */}
                                    <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>8. FAI Summary & Results (Block 9)</Text>} key="fai_section">
                                        {faiData ? (
                                            <Row gutter={[16, 10]}>
                                                <Col span={12}>
                                                    <Text type="secondary">FAI Approved Confirmation:</Text>{' '}
                                                    {faiData.fai_approved_confirmed ? <Tag color="success">CONFIRMED</Tag> : <Tag>NOT REQUIRED</Tag>}
                                                </Col>
                                                <Col span={12}><Text type="secondary">FAI Lot No:</Text> <Text strong>{faiData.fai_lot_no || 'N/A'}</Text></Col>
                                                <Col span={24}>
                                                    <Text strong>Summary Result:</Text>
                                                    <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                                                        {faiData.summary_result || 'N/A'}
                                                    </Paragraph>
                                                </Col>
                                                <Col span={24}>
                                                    <Text strong>Stakeholder Comment / Action:</Text>
                                                    <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                                                        {faiData.stakeholder_comment || 'N/A'}
                                                    </Paragraph>
                                                </Col>
                                            </Row>
                                        ) : (
                                            <Text type="secondary">Pending FAI Summary.</Text>
                                        )}
                                    </Collapse.Panel>

                                    {/* Panel 9: Multi-Department Concerns (Block 10) */}
                                    <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>9. Multi-Department Concern Approvals (Block 10)</Text>} key="concern_section">
                                        {tasksData && tasksData.length > 0 ? (
                                            <Table 
                                                dataSource={tasksData} 
                                                rowKey="id" 
                                                pagination={false} 
                                                size="small"
                                                columns={[
                                                    { title: 'Department', dataIndex: 'dept_label' },
                                                    { 
                                                        title: 'Needed', 
                                                        dataIndex: 'is_needed',
                                                        render: val => val ? <Tag color="blue">NEED</Tag> : <Tag color="default">NO NEED</Tag>
                                                    },
                                                    { 
                                                        title: 'Status', 
                                                        dataIndex: 'status',
                                                        render: st => st === 'ACKNOWLEDGED' 
                                                            ? <Tag icon={<CheckCircleOutlined />} color="success">ACKNOWLEDGED</Tag> 
                                                            : <Tag icon={<ClockCircleOutlined />} color="warning">PENDING</Tag>
                                                    },
                                                    { 
                                                        title: 'Sign-off', 
                                                        render: (_, r) => r.approved_by_name ? `${r.approved_by_name} (${moment(r.approved_date).format('DD-MMM-YYYY')})` : '-'
                                                    }
                                                ]}
                                            />
                                        ) : (
                                            <Text type="secondary">Department tasks have not been configured yet (configured in Block 9).</Text>
                                        )}
                                    </Collapse.Panel>
                                </>
                            )}

                            {/* Panel 10: History Timeline */}
                            <Collapse.Panel header={<Text strong style={{ color: '#1890ff' }}>10. Approval & Audit History</Text>} key="history_section">
                                {logs.length === 0 ? <Text type="secondary">No actions taken yet.</Text> : (
                                    logs.map(log => (
                                        <div key={log.id} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f0f0f0' }}>
                                            <Space>
                                                <Text strong>{log.step_label}</Text>
                                                <Tag color={log.action === 'APPROVE' || log.action === 'CLOSE' ? 'success' : log.action === 'DENY' ? 'error' : 'warning'}>
                                                    {log.action}
                                                </Tag>
                                            </Space>
                                            <div style={{ marginTop: 4 }}>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    By {log.action_by_name} ({log.action_role}) on {moment(log.created_at).format('DD-MMM-YYYY HH:mm')}
                                                </Text>
                                            </div>
                                            {log.comment && <div style={{ marginTop: 4 }}><Text italic>"{log.comment}"</Text></div>}
                                            {log.deny_reason && <div style={{ marginTop: 4 }}><Text type="danger">Denial Reason: {log.deny_reason}</Text></div>}
                                            {log.request_to_requester && <div style={{ marginTop: 4 }}><Text type="warning">Detail Requested: {log.request_to_requester}</Text></div>}
                                        </div>
                                    ))
                                )}
                            </Collapse.Panel>
                        </Collapse>

                        {/* 3. Action Card for Active Stage */}
                        <WorkflowActionCard 
                            documentId={docData.id} 
                            documentType={documentType} 
                            currentBlock={docData.current_block} 
                            processStatus={docData.process_status} 
                            tasksData={tasksData}
                            onSuccess={fetchDetail} 
                        />

                    </div>
                )}
            </Spin>

            {/* Sub-modal: Edit & Resubmit ECR */}
            <CreateECRModal 
                open={isResubmitOpen}
                initialData={{ ...docData, attachments }}
                onClose={() => setIsResubmitOpen(false)}
                onSuccess={() => {
                    setIsResubmitOpen(false);
                    fetchDetail();
                }}
            />

            {/* Sub-modal: Create ECN (Block 5) */}
            <CreateECNModal 
                open={isCreateEcnOpen}
                linkedEcr={docData}
                onClose={() => setIsCreateEcnOpen(false)}
                onSuccess={() => {
                    setIsCreateEcnOpen(false);
                    fetchDetail();
                }}
            />
        </Modal>
    );
}
