import React, { useState, useEffect, useMemo } from 'react';
import { 
    Card, Collapse, Typography, Row, Col, Tag, Space, Button, 
    Spin, Checkbox, Table, Alert, Radio 
} from 'antd';
import { App } from 'antd';
import { 
    ArrowLeftOutlined, MessageOutlined, CalendarOutlined, FilePdfOutlined, 
    EditOutlined, PlusCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
    CopyOutlined, DiffOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import StageStepper from '../components/StageStepper';
import WorkflowActionCard from '../components/WorkflowActionCard';
import WorkflowStageFlowPanel from '../components/WorkflowStageFlowPanel';
import RevisionDiffModal from '../components/RevisionDiffModal';
import FieldAttachmentDisplay from '../components/FieldAttachmentDisplay';
import StatusBadge from '../components/StatusBadge';
import { generateEcnPdf } from '../utils/pdfGenerator';
import CreateECNModal from '../CreateECNModal';

const { Title, Text, Paragraph } = Typography;

export default function EcntWorkspaceView({ 
    documentType, 
    documentId, 
    systemConfig = {},
    onBack, 
    onOpenInvestigation, 
    onOpenGantt, 
    onEditEcr 
}) {
    const { message: antdMessage } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [docData, setDocData] = useState(null);
    const [linkedEcr, setLinkedEcr] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [stageHistory, setStageHistory] = useState([]);
    const [fieldAudits, setFieldAudits] = useState([]);

    const [impactData, setImpactData] = useState(null);
    const [qcData, setQcData] = useState([]);
    const [faiData, setFaiData] = useState(null);
    const [tasksData, setTasksData] = useState([]);

    const [isCreateEcnOpen, setIsCreateEcnOpen] = useState(false);
    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
    const [viewRevision, setViewRevision] = useState('LATEST'); // 'LATEST' | 'PREVIOUS'

    const { empNo, userName, userRole, userDepartment } = useAuthStore();

    const fetchDetail = async () => {
        if (!documentId) return;
        setLoading(true);
        try {
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem("token");
            const authConfig = {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            };
            const endpoint = documentType === 'ECR' ? `/api/ecnt/ecr/${documentId}` : `/api/ecnt/ecn/${documentId}`;
            const res = await axios.get(`${baseUrl}${endpoint}`, authConfig);

            const mainDoc = res.data.data;
            setDocData(mainDoc);
            setAttachments(res.data.attachments || []);
            setStageHistory(res.data.stageHistory || []);
            setFieldAudits(res.data.fieldAudits || []);

            if (documentType === 'ECN') {
                setImpactData(res.data.impact);
                setQcData(res.data.qc || []);
                setFaiData(res.data.fai || null);
                setTasksData(res.data.tasks || []);

                if (mainDoc.ecr_id) {
                    try {
                        const ecrRes = await axios.get(`${baseUrl}/api/ecnt/ecr/${mainDoc.ecr_id}`, authConfig);
                        setLinkedEcr(ecrRes.data.data);
                    } catch (e) {
                        console.warn("Linked ECR fetch failed:", e);
                    }
                }
            } else {
                setLinkedEcr(mainDoc);
            }
        } catch (err) {
            console.error("Fetch Workspace Detail Error:", err);
            antdMessage.error("Failed to load document details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentType, documentId]);

    const handleDownloadPdf = async () => {
        try {
            await generateEcnPdf(docData, linkedEcr, impactData, qcData, tasksData);
            antdMessage.success("Official ECN PDF Generated and Downloaded Successfully!");
        } catch (error) {
            console.error(error);
            antdMessage.error("Failed to generate PDF: " + (error.message || "Unknown error"));
        }
    };

    const handleCopyLink = () => {
        const directUrl = `${window.location.origin}/eng/process_eng/ecnt_v2?docType=${documentType}&id=${documentId}&view=workspace`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(directUrl).then(() => {
                antdMessage.success(`Direct Link copied to clipboard! Ready to share via email or chat.`);
            }).catch(() => fallbackCopy(directUrl));
        } else {
            fallbackCopy(directUrl);
        }
    };

    const fallbackCopy = (text) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            antdMessage.success(`Direct Link copied to clipboard! Ready to share via email or chat.`);
        } catch(err) {
            antdMessage.info(`URL: ${text}`);
        }
    };

    const cleanEmpNo = (empNo || localStorage.getItem('u_code') || '').toLowerCase();
    const cleanRole = (userRole || localStorage.getItem('role') || '').toUpperCase();
    const cleanDept = (userDepartment || localStorage.getItem('u_department') || '').toUpperCase();
    const cleanName = (userName || localStorage.getItem('u_name') || '').toLowerCase();
    const isAdmin = cleanRole === 'AD' || cleanDept === 'AD' || (systemConfig?.system_admins || ['admin', 'eng_mgr']).some(a => String(a).toLowerCase() === cleanEmpNo);

    const isRequester = (docData?.request_by && docData.request_by.toLowerCase() === cleanEmpNo) || 
                        (docData?.request_by_name && docData.request_by_name.toLowerCase() === cleanName) || 
                        isAdmin;

    const isAssignedEngineer = (docData?.assigned_to && (
        docData.assigned_to.toLowerCase() === cleanEmpNo ||
        docData.assigned_to.toLowerCase() === cleanName
    )) || cleanDept === 'ENG' || isAdmin;

    const isReworkActive = (docData?.process_status || '').toLowerCase() === 'require more detail' || (docData?.current_stage_code || '').includes('_R');
    const canResubmit = isRequester;
    const canCreateEcn = isAssignedEngineer;

    // Compute displayed document values: latest by default (รอบล่าสุด), or original previous values if toggled
    const displayedDocData = useMemo(() => {
        if (!docData) return null;
        if (viewRevision === 'LATEST' || !fieldAudits || fieldAudits.length === 0) return docData;

        // Apply fieldAudits in reverse to recreate original pre-revision values
        const prev = { ...docData };
        fieldAudits.forEach(audit => {
            if (audit.field_name && audit.old_value !== undefined) {
                if (typeof prev[audit.field_name] === 'boolean') {
                    prev[audit.field_name] = audit.old_value === 'true';
                } else {
                    prev[audit.field_name] = audit.old_value;
                }
            }
        });
        return prev;
    }, [docData, viewRevision, fieldAudits]);

    const currentDisplayDoc = displayedDocData || docData;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Top Workspace Bar */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <Space size="middle">
                        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                            Back to Dashboard
                        </Button>
                        <Space>
                            <Tag color={documentType === 'ECR' ? 'blue' : 'purple'} style={{ fontSize: 13, padding: '2px 8px' }}>
                                {documentType}
                            </Tag>
                            <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                                {docData?.ecr_no || docData?.ecn_no || `#${docData?.id}`}
                            </Title>
                            <StatusBadge status={docData?.process_status} />
                        </Space>
                    </Space>

                    <Space size="middle">
                        <Button 
                            icon={<CopyOutlined />} 
                            onClick={handleCopyLink}
                            style={{ borderColor: '#1890ff', color: '#1890ff' }}
                        >
                            Share Link
                        </Button>

                        <Button 
                            icon={<CalendarOutlined />} 
                            onClick={() => onOpenGantt({ id: documentId, type: documentType })}
                        >
                            Gantt Chart
                        </Button>

                        <Button 
                            icon={<MessageOutlined />} 
                            onClick={() => onOpenInvestigation(docData)}
                        >
                            Discussions & Problem Hub
                        </Button>

                        {documentType === 'ECR' && isReworkActive && (
                            canResubmit ? (
                                <Button 
                                    type="primary" 
                                    icon={<EditOutlined />} 
                                    onClick={() => onEditEcr(docData)}
                                    style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                                >
                                    Edit & Resubmit ECR
                                </Button>
                            ) : (
                                <Tag color="orange" style={{ fontSize: 13, padding: '4px 10px' }}>
                                    ⏳ รอผู้ยื่นคำขอ ({docData?.request_by_name || docData?.request_by || 'Requester'}) แก้ไขข้อมูล
                                </Tag>
                            )
                        )}

                        {documentType === 'ECR' && docData?.process_status === 'Issued ECN' && !docData?.linked_ecn_id && (
                            canCreateEcn ? (
                                <Button 
                                    type="primary" 
                                    icon={<PlusCircleOutlined />} 
                                    onClick={() => setIsCreateEcnOpen(true)}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                    Issue ECN (Block 5)
                                </Button>
                            ) : (
                                <Tag color="cyan" style={{ fontSize: 13, padding: '4px 10px' }}>
                                    ⏳ รอวิศวกรที่ได้รับมอบหมาย ({docData?.assigned_to || 'Assigned Engineer'}) ออก ECN
                                </Tag>
                            )
                        )}

                        {docData?.process_status === 'ECN Effective' && (
                            <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDownloadPdf}>
                                Download Official PDF
                            </Button>
                        )}
                    </Space>
                </div>
            </Card>

            {/* Stage Progress Stepper */}
            <StageStepper 
                currentStageCode={docData?.current_stage_code} 
                stageHistory={stageHistory} 
            />

            {/* Revision Switcher & History Bar */}
            {docData && (docData.revision_count > 0 || fieldAudits.length > 0) && (
                <div style={{
                    background: viewRevision === 'LATEST' ? '#f6ffed' : '#fffbe6',
                    border: viewRevision === 'LATEST' ? '1px solid #b7eb8f' : '1px solid #ffe58f',
                    borderRadius: 10,
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <Space size="middle" wrap>
                        <Tag color={viewRevision === 'LATEST' ? 'green' : 'orange'} style={{ fontSize: 13, padding: '2px 8px', fontWeight: 600 }}>
                            {viewRevision === 'LATEST' 
                                ? `📌 กำลังแสดงข้อมูล: รอบล่าสุด (Rev ${Number(docData?.revision_count || 0) + 1})` 
                                : '⏳ กำลังแสดงข้อมูล: ฉบับเดิมก่อนแก้ไข (Original Before Revision)'}
                        </Tag>
                        <Text style={{ fontSize: 12, color: '#595959' }}>
                            {viewRevision === 'LATEST' 
                                ? 'แสดงรายละเอียดที่อัปเดตชี้แจงตามคำขอของผู้จัดการ (ค่าเริ่มต้น)' 
                                : 'แสดงค่าเดิมก่อนการแก้ไข เพื่อให้เปรียบเทียบดูความเปลี่ยนแปลงได้ง่าย'}
                        </Text>
                    </Space>

                    <Space size="middle">
                        <Radio.Group 
                            value={viewRevision} 
                            onChange={e => setViewRevision(e.target.value)}
                            size="small"
                            buttonStyle="solid"
                        >
                            <Radio.Button value="LATEST">รอบล่าสุด (ค่าเริ่มต้น)</Radio.Button>
                            <Radio.Button value="PREVIOUS">รอบเดิมก่อนแก้ไข</Radio.Button>
                        </Radio.Group>
                        <Button 
                            size="small" 
                            icon={<DiffOutlined />} 
                            onClick={() => setIsDiffModalOpen(true)}
                            style={{ borderColor: '#1890ff', color: '#1890ff', fontWeight: 600 }}
                        >
                            🆚 ดูข้อมูลเปรียบเทียบก่อน-หลังแก้ไข (Diff Viewer)
                        </Button>
                    </Space>
                </div>
            )}

            {/* Main Content Body */}
            <Spin spinning={loading}>
                {docData && (
                    <Row gutter={[16, 16]}>
                        {/* Left Column: Vertical Linear Accordion Sections */}
                        <Col xs={24} lg={16}>
                            <Collapse 
                                defaultActiveKey={[
                                    'overview_section', 
                                    'tech_section', 
                                    'ecn_section', 
                                    'impact_section', 
                                    'qc_section', 
                                    'fai_section', 
                                    'concern_section'
                                ]}
                                style={{ background: '#ffffff', borderRadius: 12 }}
                            >
                                {/* Section 1: Document Overview */}
                                <Collapse.Panel 
                                    header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>1. Document Overview & Origins</Text>} 
                                    key="overview_section"
                                >
                                    <Row gutter={[16, 10]}>
                                        <Col span={8}><Text type="secondary">Document Type:</Text> <Tag color="blue">{documentType}</Tag></Col>
                                        <Col span={8}><Text type="secondary">Number:</Text> <Text strong>{docData.ecr_no || docData.ecn_no || 'Pending'}</Text></Col>
                                        <Col span={8}><Text type="secondary">Status:</Text> <StatusBadge status={docData.process_status} /></Col>
                                        
                                        <Col span={8}><Text type="secondary">Requester:</Text> <Text strong>{docData.request_by_name || docData.request_by}</Text></Col>
                                        <Col span={8}><Text type="secondary">Department:</Text> <Text>{docData.department}</Text></Col>
                                        <Col span={8}><Text type="secondary">Date:</Text> <Text>{moment(docData.created_at).format('DD-MMM-YYYY HH:mm')}</Text></Col>

                                        {docData.customer_name && (
                                            <Col span={8}><Text type="secondary">Customer:</Text> <Text strong>{docData.customer_name}</Text></Col>
                                        )}
                                        {docData.project_code && (
                                            <Col span={8}><Text type="secondary">Project / Model:</Text> <Text strong>{docData.project_code}</Text></Col>
                                        )}
                                        {docData.ref_coc_no && (
                                            <Col span={8}><Text type="secondary">Ref COC No:</Text> <Text>{docData.ref_coc_no}</Text></Col>
                                        )}
                                    </Row>
                                </Collapse.Panel>

                                {/* Section 2: ECR Technical Details (Blocks 1-2) */}
                                <Collapse.Panel 
                                    header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>2. ECR Technical Details (Blocks 1-2)</Text>} 
                                    key="tech_section"
                                >
                                    <Row gutter={[16, 12]}>
                                        <Col span={12}><Text type="secondary">Status:</Text> <Tag color="purple">{currentDisplayDoc.status_type || 'PERMANENT'}</Tag></Col>
                                        <Col span={12}><Text type="secondary">Objective:</Text> <Tag color="cyan">{currentDisplayDoc.objective} {currentDisplayDoc.objective_other ? `(${currentDisplayDoc.objective_other})` : ''}</Tag></Col>
                                        
                                        <Col span={24}>
                                            <Text type="secondary">Change Categories:</Text>{' '}
                                            <Space size={4}>
                                                {currentDisplayDoc.is_drawing && <Tag color="blue">Product/Process Drawing</Tag>}
                                                {currentDisplayDoc.is_tooling && <Tag color="green">Tooling</Tag>}
                                                {currentDisplayDoc.is_program && <Tag color="orange">Cutting Program</Tag>}
                                                {currentDisplayDoc.is_usage && <Tag color="magenta">Usage / Setup</Tag>}
                                            </Space>
                                        </Col>

                                        <Col span={24}>
                                            <Text strong>Title of Change:</Text>
                                            <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                                                {currentDisplayDoc.title_of_change}
                                            </Paragraph>
                                        </Col>

                                        <Col span={24}>
                                            <Text strong>Reason of Change:</Text>
                                            <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 6, border: '1px solid #f0f0f0' }}>
                                                {currentDisplayDoc.reason_of_change}
                                            </Paragraph>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="reason_of_change" />
                                        </Col>
                                    </Row>

                                    {/* Drawing Details */}
                                    {currentDisplayDoc.is_drawing && (
                                        <div style={{ marginTop: 14, padding: 12, background: '#f5f9ff', borderRadius: 8, border: '1px solid #d6e4ff' }}>
                                            <Text strong style={{ color: '#1890ff' }}>📐 Drawing Specifications</Text>
                                            <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                <Col span={8}><Text type="secondary">Part No:</Text> {currentDisplayDoc.dwg_part_no || '-'}</Col>
                                                <Col span={8}><Text type="secondary">C/N:</Text> {currentDisplayDoc.dwg_cn || '-'}</Col>
                                                <Col span={8}><Text type="secondary">Revision:</Text> {currentDisplayDoc.dwg_revision || '-'}</Col>
                                                <Col span={12}>
                                                    <Text type="secondary">Before Change:</Text>
                                                    <Paragraph style={{ marginTop: 4 }}>{currentDisplayDoc.dwg_before_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_before_change" />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary">After Change:</Text>
                                                    <Paragraph style={{ marginTop: 4 }}>{currentDisplayDoc.dwg_after_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_after_change" />
                                                </Col>
                                            </Row>
                                        </div>
                                    )}

                                    {/* Tooling Details */}
                                    {currentDisplayDoc.is_tooling && (
                                        <div style={{ marginTop: 14, padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #d9f7be' }}>
                                            <Text strong style={{ color: '#52c41a' }}>🔧 Tooling Specifications</Text>
                                            <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                <Col span={12}><Text type="secondary">Current Tool No:</Text> {currentDisplayDoc.tool_current_no || '-'} ({currentDisplayDoc.tool_current_usage} K/pc)</Col>
                                                <Col span={12}><Text type="secondary">New Tool No:</Text> {currentDisplayDoc.tool_new_no || '-'} ({currentDisplayDoc.tool_new_usage} K/pc)</Col>
                                            </Row>
                                        </div>
                                    )}

                                    {/* Program Details */}
                                    {currentDisplayDoc.is_program && (
                                        <div style={{ marginTop: 14, padding: 12, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
                                            <Text strong style={{ color: '#fa8c16' }}>💻 Program & Conditions</Text>
                                            <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                <Col span={12}>
                                                    <Text type="secondary">Program Before:</Text>
                                                    <Paragraph>{currentDisplayDoc.prog_before_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="prog_before_change" />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary">Program After:</Text>
                                                    <Paragraph>{currentDisplayDoc.prog_after_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="prog_after_change" />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary">Condition Before:</Text>
                                                    <Paragraph>{currentDisplayDoc.prog_condition_before || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_before" />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary">Condition After:</Text>
                                                    <Paragraph>{currentDisplayDoc.prog_condition_after || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_after" />
                                                </Col>
                                            </Row>
                                        </div>
                                    )}

                                    {/* Usage Details */}
                                    {currentDisplayDoc.is_usage && (
                                        <div style={{ marginTop: 14, padding: 12, background: '#fff0f6', borderRadius: 8, border: '1px solid #ffd6e7' }}>
                                            <Text strong style={{ color: '#eb2f96' }}>⚙️ Usage & Setup Sheet</Text>
                                            <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                <Col span={8}><Text type="secondary">Setup Sheet No:</Text> {currentDisplayDoc.usage_setup_no || '-'}</Col>
                                                <Col span={8}><Text type="secondary">Part No:</Text> {currentDisplayDoc.usage_part_no || '-'}</Col>
                                                <Col span={8}><Text type="secondary">M/C No:</Text> {currentDisplayDoc.usage_mc_no || '-'}</Col>
                                                <Col span={8}><Text type="secondary">Process:</Text> {currentDisplayDoc.usage_process || '-'}</Col>
                                                <Col span={8}><Text type="secondary">Program No:</Text> {currentDisplayDoc.usage_program_no || '-'}</Col>
                                                <Col span={8}><Text type="secondary">Cycle Time:</Text> {currentDisplayDoc.usage_cycle_time_before || '-'} → {currentDisplayDoc.usage_cycle_time_after || '-'}</Col>
                                                <Col span={12}>
                                                    <Text type="secondary">Before Setup:</Text>
                                                    <Paragraph>{currentDisplayDoc.usage_before_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="usage_before_change" />
                                                </Col>
                                                <Col span={12}>
                                                    <Text type="secondary">After Setup:</Text>
                                                    <Paragraph>{currentDisplayDoc.usage_after_change || '-'}</Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="usage_after_change" />
                                                </Col>
                                            </Row>
                                        </div>
                                    )}
                                </Collapse.Panel>

                                {/* Section 3: ECN Execution Scope (Block 5) */}
                                {documentType === 'ECN' && (
                                    <Collapse.Panel 
                                        header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>3. ECN Execution Scope (Block 5)</Text>} 
                                        key="ecn_section"
                                    >
                                        <Row gutter={[16, 10]}>
                                            <Col span={12}>
                                                <Text type="secondary">DWG Suspended in Innovator:</Text>{' '}
                                                {docData.dwg_suspended ? <Tag color="error">CONFIRMED SUSPENDED</Tag> : <Tag>NO</Tag>}
                                            </Col>
                                            <Col span={12}>
                                                <Text type="secondary">DWG Enabled in Innovator:</Text>{' '}
                                                {docData.dwg_enabled ? <Tag color="success">CONFIRMED ACTIVE</Tag> : <Tag color="warning">PENDING</Tag>}
                                            </Col>
                                            <Col span={24}>
                                                <Text strong>Scope of Implementation:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                                                    {docData.scope_of_implementation || 'N/A'}
                                                </Paragraph>
                                            </Col>
                                            <Col span={12}>
                                                <Text strong>Before Change:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                                                    {docData.before_change || 'N/A'}
                                                </Paragraph>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="before_change" />
                                            </Col>
                                            <Col span={12}>
                                                <Text strong>After Change:</Text>
                                                <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 6 }}>
                                                    {docData.after_change || 'N/A'}
                                                </Paragraph>
                                                <FieldAttachmentDisplay attachments={attachments} fieldName="after_change" />
                                            </Col>
                                        </Row>
                                    </Collapse.Panel>
                                )}

                                {/* Section 4: 8-Dimension Impact Assessment Checklist */}
                                {documentType === 'ECN' && (
                                    <Collapse.Panel 
                                        header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>4. Impact Assessment Matrix (Block 5)</Text>} 
                                        key="impact_section"
                                    >
                                        {impactData ? (
                                            <Row gutter={[16, 12]}>
                                                <Col span={8}><Checkbox checked={impactData.has_customer_impact} disabled>Customer Impact (4M)</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_kzw_fjsw_impact} disabled>KZW/FJSW Impact</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_sale_drawing_impact} disabled>Sale Drawing</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_traceability} disabled>Traceability</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_wip_stock} disabled>WIP / Stock</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_outsourcing} disabled>Outsourcing</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_unit_price} disabled>Unit Price</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_manufacturing} disabled>Manufacturing Process</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_product_quality} disabled>Product Quality</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_safety} disabled>Safety</Checkbox></Col>
                                                <Col span={8}><Checkbox checked={impactData.has_otd} disabled>On-Time Delivery</Checkbox></Col>
                                            </Row>
                                        ) : (
                                            <Text type="secondary">No impact assessment recorded.</Text>
                                        )}
                                    </Collapse.Panel>
                                )}

                                {/* Section 5: QC Decisions MSA & FAI */}
                                {documentType === 'ECN' && (
                                    <Collapse.Panel 
                                        header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>5. QC Decisions: MSA & FAI (Blocks 7-8)</Text>} 
                                        key="qc_section"
                                    >
                                        {qcData.length > 0 ? (
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
                                )}

                                {/* Section 6: FAI Summary & Results */}
                                {documentType === 'ECN' && (
                                    <Collapse.Panel 
                                        header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>6. FAI Results Summary (Block 9)</Text>} 
                                        key="fai_section"
                                    >
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
                                )}

                                {/* Section 7: Multi-Department Concern Approvals */}
                                {documentType === 'ECN' && (
                                    <Collapse.Panel 
                                        header={<Text strong style={{ color: '#1890ff', fontSize: 13 }}>7. Multi-Department Concern Approvals (Block 10)</Text>} 
                                        key="concern_section"
                                    >
                                        {tasksData.length > 0 ? (
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
                                            <Text type="secondary">Department tasks have not been configured yet (Block 9).</Text>
                                        )}
                                    </Collapse.Panel>
                                )}
                            </Collapse>
                        </Col>

                        {/* Right Column: Workflow Action Panel & Responsibility Card */}
                        <Col xs={24} lg={8}>
                            <WorkflowActionCard 
                                documentId={docData.id} 
                                documentType={documentType} 
                                currentBlock={docData.current_block} 
                                processStatus={docData.process_status} 
                                tasksData={tasksData}
                                systemConfig={systemConfig}
                                docData={docData}
                                onSuccess={fetchDetail} 
                            />

                            {/* Workflow Stage Flow Stepper matching reference image */}
                            <WorkflowStageFlowPanel
                                documentType={documentType}
                                documentId={docData.id}
                                docData={docData}
                                tasksData={tasksData}
                                systemConfig={systemConfig}
                                onStageFlowUpdated={fetchDetail}
                            />
                        </Col>
                    </Row>
                )}
            </Spin>

            {/* Sub-modal: Create ECN (Block 5) */}
            <CreateECNModal 
                open={isCreateEcnOpen}
                linkedEcr={docData}
                systemConfig={systemConfig}
                onClose={() => setIsCreateEcnOpen(false)}
                onSuccess={() => {
                    setIsCreateEcnOpen(false);
                    fetchDetail();
                }}
            />

            {/* Revision Diff Comparison Modal */}
            <RevisionDiffModal
                open={isDiffModalOpen}
                onClose={() => setIsDiffModalOpen(false)}
                docData={docData}
                fieldAudits={fieldAudits}
                stageHistory={stageHistory}
            />
        </div>
    );
}
