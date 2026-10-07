import React, { useState, useEffect, useMemo } from 'react';
import { 
    Card, Collapse, Typography, Row, Col, Tag, Space, Button, 
    Spin, Checkbox, Table, Alert, Select, Tooltip, Dropdown,
    Modal, Descriptions
} from 'antd';
import { App } from 'antd';
import { 
    ArrowLeftOutlined, MessageOutlined, CalendarOutlined, FilePdfOutlined, 
    EditOutlined, PlusCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
    CopyOutlined, DiffOutlined, MoreOutlined, ArrowRightOutlined,
    EyeOutlined
} from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import StageStepper from '../components/StageStepper';
import WorkflowActionCard from '../components/WorkflowActionCard';
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
    onEditEcr,
    onOpenDoc
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
    const [isEditEcnOpen, setIsEditEcnOpen] = useState(false);
    const [activeDetailSection, setActiveDetailSection] = useState(null);
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

    // Compute displayed document values: latest by default (Rev Latest), or original baseline values if toggled
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <Space size="middle" wrap>
                        <Tooltip title="Back to Pipeline Dashboard">
                            <Button icon={<ArrowLeftOutlined />} onClick={onBack} style={{ borderRadius: 8 }}>
                                Back
                            </Button>
                        </Tooltip>
                        <Space>
                            <Tag color={documentType === 'ECR' ? 'blue' : 'purple'} style={{ fontSize: 13, padding: '2px 8px', fontWeight: 600 }}>
                                {documentType}
                            </Tag>
                            <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                                {documentType === 'ECR' 
                                    ? (docData?.ecr_no || `#${docData?.id}`) 
                                    : (docData?.ecn_no || `#${docData?.id}`)}
                            </Title>
                            {documentType === 'ECN' && docData?.ecr_no && (
                                <Tag color="blue" style={{ fontSize: 12, padding: '1px 8px', borderRadius: 4 }}>
                                    Ref ECR: {docData.ecr_no}
                                </Tag>
                            )}
                            <StatusBadge status={docData?.process_status} />
                        </Space>
                    </Space>

                    <Space size="small" wrap>
                        {/* Quick Action Icons with Tooltips */}
                        <Tooltip title="Copy Direct Link to share">
                            <Button 
                                icon={<CopyOutlined />} 
                                onClick={handleCopyLink}
                                style={{ borderRadius: 8 }}
                            />
                        </Tooltip>

                        <Tooltip title="Timeline & Gantt Chart">
                            <Button 
                                icon={<CalendarOutlined />} 
                                onClick={() => onOpenGantt({ id: documentId, type: documentType })}
                                style={{ borderRadius: 8 }}
                            />
                        </Tooltip>

                        <Tooltip title="Problem Hub & Discussions">
                            <Button 
                                icon={<MessageOutlined />} 
                                onClick={() => onOpenInvestigation(docData)}
                                style={{ borderRadius: 8 }}
                            />
                        </Tooltip>

                        {/* More Document Tools Dropdown */}
                        <Dropdown 
                            menu={{
                                items: [
                                    { key: 'share', label: 'Copy Direct Share Link', icon: <CopyOutlined />, onClick: handleCopyLink },
                                    { key: 'gantt', label: 'Gantt Timeline Chart', icon: <CalendarOutlined />, onClick: () => onOpenGantt({ id: documentId, type: documentType }) },
                                    { key: 'discuss', label: 'Problem Hub & Discussions', icon: <MessageOutlined />, onClick: () => onOpenInvestigation(docData) },
                                    { key: 'diff', label: `Revision Diff Viewer ${docData?.revision_count > 0 ? `(Rev ${docData.revision_count})` : ''}`, icon: <DiffOutlined />, onClick: () => setIsDiffModalOpen(true) },
                                    ...(docData?.process_status === 'ECN Effective' ? [{ key: 'pdf', label: 'Download Official PDF', icon: <FilePdfOutlined />, onClick: handleDownloadPdf }] : [])
                                ]
                            }}
                            placement="bottomRight"
                        >
                            <Tooltip title="More Document Tools">
                                <Button icon={<MoreOutlined style={{ fontSize: 16 }} />} style={{ borderRadius: 8 }} />
                            </Tooltip>
                        </Dropdown>

                        {/* Primary Workflow Actions */}
                        {documentType === 'ECR' && isReworkActive && (
                            canResubmit ? (
                                <Tooltip title="Edit and Resubmit ECR with revisions">
                                    <Button 
                                        type="primary" 
                                        icon={<EditOutlined />} 
                                        onClick={() => onEditEcr && onEditEcr({ ...docData, attachments })}
                                        style={{ background: '#fa8c16', borderColor: '#fa8c16', borderRadius: 8, fontWeight: 600 }}
                                    >
                                        Edit & Resubmit ECR
                                    </Button>
                                </Tooltip>
                            ) : (
                                <Tag color="orange" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                    ⏳ Awaiting requester ({docData?.request_by_name || docData?.request_by || 'Requester'}) to revise and resubmit
                                </Tag>
                            )
                        )}

                        {documentType === 'ECN' && isReworkActive && (
                            <Tooltip title="Edit and Resubmit ECN with revisions (Block 5)">
                                <Button 
                                    type="primary" 
                                    icon={<EditOutlined />} 
                                    onClick={() => setIsEditEcnOpen(true)}
                                    style={{ background: '#fa8c16', borderColor: '#fa8c16', borderRadius: 8, fontWeight: 600 }}
                                >
                                    Edit & Resubmit ECN (Block 5)
                                </Button>
                            </Tooltip>
                        )}

                        {documentType === 'ECR' && docData?.linked_ecn_id && (
                            <Tooltip title={`Open linked official ECN (${docData?.linked_ecn_no || `ECN #${docData?.linked_ecn_id}`})`}>
                                <Button 
                                    type="primary" 
                                    icon={<ArrowRightOutlined />} 
                                    onClick={() => onOpenDoc && onOpenDoc(docData.linked_ecn_id, 'ECN')}
                                    style={{ background: '#722ed1', borderColor: '#722ed1', borderRadius: 8, fontWeight: 600 }}
                                >
                                    Open {docData?.linked_ecn_no || `ECN #${docData?.linked_ecn_id}`}
                                </Button>
                            </Tooltip>
                        )}

                        {documentType === 'ECR' && docData?.process_status === 'Issued ECN' && !docData?.linked_ecn_id && (
                            canCreateEcn ? (
                                <Tooltip title="Formulate and Issue Official ECN (Block 5)">
                                    <Button 
                                        type="primary" 
                                        icon={<PlusCircleOutlined />} 
                                        onClick={() => setIsCreateEcnOpen(true)}
                                        style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 8, fontWeight: 600 }}
                                    >
                                        Issue ECN (Block 5)
                                    </Button>
                                </Tooltip>
                            ) : (
                                <Tag color="cyan" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6 }}>
                                    ⏳ Awaiting assigned engineer ({docData?.assigned_to || 'Assigned Engineer'}) to issue ECN
                                </Tag>
                            )
                        )}

                        {docData?.process_status === 'ECN Effective' && (
                            <Tooltip title="Download Official Notice PDF">
                                <Button type="primary" icon={<FilePdfOutlined />} onClick={handleDownloadPdf} style={{ borderRadius: 8, background: '#52c41a' }}>
                                    PDF
                                </Button>
                            </Tooltip>
                        )}
                    </Space>
                </div>
            </Card>

            {/* Stage Progress Stepper with Integrated Stage PICs & Delegation Flow */}
            <StageStepper 
                documentType={documentType}
                documentId={documentId}
                docData={docData}
                currentStageCode={docData?.current_stage_code} 
                stageHistory={stageHistory} 
                tasksData={tasksData}
                systemConfig={systemConfig}
                onStageFlowUpdated={fetchDetail}
            />

            {/* Revision Switcher & History Bar */}
            {docData && (docData.revision_count > 0 || fieldAudits.length > 0) && (
                <div style={{
                    background: viewRevision === 'LATEST' ? '#f6ffed' : '#fffbe6',
                    border: viewRevision === 'LATEST' ? '1px solid #b7eb8f' : '1px solid #ffe58f',
                    borderRadius: 10,
                    padding: '8px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <Space size="middle" wrap>
                        <Tag color={viewRevision === 'LATEST' ? 'green' : 'orange'} style={{ fontSize: 12, padding: '2px 8px', fontWeight: 600 }}>
                            {viewRevision === 'LATEST' ? 'Active Revision' : 'Historical Baseline'}
                        </Tag>
                        <Text style={{ fontSize: 12, color: '#595959' }}>
                            {viewRevision === 'LATEST' 
                                ? 'Displaying latest clarified/revised technical data' 
                                : 'Displaying original baseline values prior to rework/revision'}
                        </Text>
                    </Space>

                    <Space size="middle">
                        <Select 
                            value={viewRevision} 
                            onChange={setViewRevision}
                            size="small"
                            style={{ width: 230 }}
                        >
                            <Select.Option value="LATEST">
                                Rev {Number(docData?.revision_count || 0) + 1} (Latest - Active)
                            </Select.Option>
                            <Select.Option value="PREVIOUS">
                                Rev 1 (Original Baseline)
                            </Select.Option>
                        </Select>
                        <Button 
                            size="small" 
                            icon={<DiffOutlined />} 
                            onClick={() => setIsDiffModalOpen(true)}
                            style={{ borderColor: '#1890ff', color: '#1890ff', fontWeight: 600 }}
                        >
                            🆚 Compare Diffs
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
                                    extra={
                                        <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<EyeOutlined />} 
                                            onClick={(e) => { e.stopPropagation(); setActiveDetailSection('overview'); }}
                                            style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                        >
                                            ดูรายละเอียดฉบับเต็ม
                                        </Button>
                                    }
                                >
                                    <Row gutter={[16, 10]}>
                                        <Col span={8}><Text type="secondary">Document Type:</Text> <Tag color={documentType === 'ECR' ? 'blue' : 'purple'}>{documentType}</Tag></Col>
                                        <Col span={8}>
                                            <Text type="secondary">{documentType === 'ECN' ? 'ECN Number:' : 'ECR Number:'}</Text>{' '}
                                            <Text strong>{documentType === 'ECR' ? (docData.ecr_no || 'Pending') : (docData.ecn_no || 'Pending')}</Text>
                                            {documentType === 'ECN' && docData.ecr_no && (
                                                <span style={{ marginLeft: 8 }}>
                                                    (<Text type="secondary">Ref ECR: </Text><Text strong>{docData.ecr_no}</Text>)
                                                </span>
                                            )}
                                        </Col>
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
                                    extra={
                                        <Button 
                                            size="small" 
                                            type="link" 
                                            icon={<EyeOutlined />} 
                                            onClick={(e) => { e.stopPropagation(); setActiveDetailSection('tech'); }}
                                            style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                        >
                                            ดูรายละเอียดฉบับเต็ม
                                        </Button>
                                    }
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
                                        extra={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                icon={<EyeOutlined />} 
                                                onClick={(e) => { e.stopPropagation(); setActiveDetailSection('ecn_scope'); }}
                                                style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                            >
                                                ดูรายละเอียดฉบับเต็ม
                                            </Button>
                                        }
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
                                        extra={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                icon={<EyeOutlined />} 
                                                onClick={(e) => { e.stopPropagation(); setActiveDetailSection('impact'); }}
                                                style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                            >
                                                ดูรายละเอียดฉบับเต็ม
                                            </Button>
                                        }
                                    >
                                        {impactData ? (
                                            <div>
                                                <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
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

                                                {/* Detailed cards for active items */}
                                                {impactData.has_traceability && (
                                                    <div style={{ marginTop: 10, padding: 12, background: '#f5f9ff', borderRadius: 8, border: '1px solid #d6e4ff' }}>
                                                        <Text strong style={{ color: '#1890ff' }}>📌 1. Traceability Details</Text>
                                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                            <Col span={12}><Text type="secondary">Recalled Lot No:</Text> <Text strong>{impactData.traceability_details?.lot_no || 'N/A'}</Text></Col>
                                                            <Col span={12}><Text type="secondary">Confirm Finish Date:</Text> <Text>{impactData.traceability_details?.finish_date ? moment(impactData.traceability_details.finish_date).format('DD-MMM-YYYY') : 'N/A'}</Text></Col>
                                                            {impactData.traceability_details?.google_sheet_url && (
                                                                <Col span={24}>
                                                                    <Text type="secondary">Google Sheet Link: </Text>
                                                                    <a href={impactData.traceability_details.google_sheet_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                                                                        {impactData.traceability_details.google_sheet_url} 🔗
                                                                    </a>
                                                                </Col>
                                                            )}
                                                            <Col span={24}>
                                                                <FieldAttachmentDisplay attachments={attachments} fieldName="traceability" />
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                )}

                                                {impactData.has_wip_stock && (
                                                    <div style={{ marginTop: 10, padding: 12, background: '#f6ffed', borderRadius: 8, border: '1px solid #d9f7be' }}>
                                                        <Text strong style={{ color: '#52c41a' }}>📦 2. WIP, Stock, Backlog Details</Text>
                                                        <Row gutter={[12, 8]} style={{ marginTop: 6 }}>
                                                            <Col span={12}><Text type="secondary">Target Models / Disposition:</Text> <Text strong>{impactData.wip_stock_details?.models || 'N/A'}</Text></Col>
                                                            <Col span={12}><Text type="secondary">Confirm Finish Date:</Text> <Text>{impactData.wip_stock_details?.finish_date ? moment(impactData.wip_stock_details.finish_date).format('DD-MMM-YYYY') : 'N/A'}</Text></Col>
                                                            {impactData.wip_stock_details?.google_sheet_url && (
                                                                <Col span={24}>
                                                                    <Text type="secondary">Google Sheet Link: </Text>
                                                                    <a href={impactData.wip_stock_details.google_sheet_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                                                                        {impactData.wip_stock_details.google_sheet_url} 🔗
                                                                    </a>
                                                                </Col>
                                                            )}
                                                            <Col span={24}>
                                                                <FieldAttachmentDisplay attachments={attachments} fieldName="wip_stock" />
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                )}
                                            </div>
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
                                        extra={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                icon={<EyeOutlined />} 
                                                onClick={(e) => { e.stopPropagation(); setActiveDetailSection('qc'); }}
                                                style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                            >
                                                ดูรายละเอียดฉบับเต็ม
                                            </Button>
                                        }
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
                                        extra={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                icon={<EyeOutlined />} 
                                                onClick={(e) => { e.stopPropagation(); setActiveDetailSection('fai'); }}
                                                style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                            >
                                                ดูรายละเอียดฉบับเต็ม
                                            </Button>
                                        }
                                    >
                                        {faiData ? (
                                            <Row gutter={[16, 10]}>
                                                <Col span={12}>
                                                    <Text type="secondary">FAI Approved Confirmation:</Text>{' '}
                                                    {faiData.fai_approved_confirmed ? <Tag color="success">CONFIRMED</Tag> : <Tag>NOT REQUIRED</Tag>}
                                                </Col>
                                                <Col span={12}><Text type="secondary">FAI Lot No:</Text> <Text strong>{faiData.fai_lot_no || 'N/A'}</Text></Col>
                                                {faiData.google_sheet_url && (
                                                    <Col span={24}>
                                                        <Text type="secondary">Google Sheet Link: </Text>
                                                        <a href={faiData.google_sheet_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                                                            {faiData.google_sheet_url} 🔗
                                                        </a>
                                                    </Col>
                                                )}
                                                <Col span={24}>
                                                    <Text strong>Summary Result:</Text>
                                                    <Paragraph style={{ marginTop: 4, background: '#fafafa', padding: 8, borderRadius: 4 }}>
                                                        {faiData.summary_result || 'N/A'}
                                                    </Paragraph>
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="fai_summary" />
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
                                        extra={
                                            <Button 
                                                size="small" 
                                                type="link" 
                                                icon={<EyeOutlined />} 
                                                onClick={(e) => { e.stopPropagation(); setActiveDetailSection('concern'); }}
                                                style={{ fontWeight: 600, fontSize: 12, padding: 0 }}
                                            >
                                                ดูรายละเอียดฉบับเต็ม
                                            </Button>
                                        }
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
                                onSuccess={(opts) => {
                                    fetchDetail();
                                    if (opts?.openCreateEcn) {
                                        setIsCreateEcnOpen(true);
                                    }
                                }}
                                onOpenCreateEcn={() => setIsCreateEcnOpen(true)}
                                onOpenEditEcn={() => setIsEditEcnOpen(true)}
                                onOpenResubmit={() => onEditEcr && onEditEcr({ ...docData, attachments })}
                                onNavigateToEcn={(ecnId) => onOpenDoc && onOpenDoc({ id: ecnId, doc_type: 'ECN' })}
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

            {/* Sub-modal: Edit & Resubmit ECN (Block 5 Rework) */}
            <CreateECNModal 
                open={isEditEcnOpen}
                linkedEcr={linkedEcr || docData}
                initialEcnData={{ ...docData, attachments, impact: impactData }}
                isEditMode={true}
                systemConfig={systemConfig}
                onClose={() => setIsEditEcnOpen(false)}
                onSuccess={() => {
                    setIsEditEcnOpen(false);
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

            {/* View Full Details Modal */}
            <Modal
                title={
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
                        {activeDetailSection === 'overview' && '1. Document Overview & Origins - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'tech' && '2. ECR Technical Details (Blocks 1-2) - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'ecn_scope' && '3. ECN Execution Scope (Block 5) - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'impact' && '4. 8-Dimension Impact Assessment Matrix (Block 5) - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'qc' && '5. QC Decisions: MSA & FAI (Blocks 7-8) - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'fai' && '6. FAI Results Summary (Block 9) - ดูรายละเอียดฉบับเต็ม'}
                        {activeDetailSection === 'concern' && '7. Multi-Department Concern Approvals (Block 10) - ดูรายละเอียดฉบับเต็ม'}
                    </span>
                }
                open={!!activeDetailSection}
                onCancel={() => setActiveDetailSection(null)}
                footer={[
                    <Button key="close" type="primary" onClick={() => setActiveDetailSection(null)}>
                        ปิด (Close)
                    </Button>
                ]}
                width={920}
                destroyOnClose
            >
                <div style={{ maxHeight: '72vh', overflowY: 'auto', paddingRight: 8, marginTop: 12 }}>
                    {activeDetailSection === 'overview' && docData && (
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
                            <Descriptions.Item label="Document Type"><Tag color={documentType === 'ECR' ? 'blue' : 'purple'}>{documentType}</Tag></Descriptions.Item>
                            <Descriptions.Item label="Doc Number"><Text strong>{documentType === 'ECR' ? (docData.ecr_no || 'Pending') : (docData.ecn_no || 'Pending')}</Text></Descriptions.Item>
                            <Descriptions.Item label="Status"><StatusBadge status={docData.process_status} /></Descriptions.Item>
                            <Descriptions.Item label="Requester">{docData.request_by_name || docData.request_by} ({docData.request_by || ''})</Descriptions.Item>
                            <Descriptions.Item label="Department">{docData.department}</Descriptions.Item>
                            <Descriptions.Item label="Created At">{moment(docData.created_at).format('DD-MMM-YYYY HH:mm:ss')}</Descriptions.Item>
                            <Descriptions.Item label="Customer">{docData.customer_name || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Project / Model">{docData.project_code || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Ref COC No">{docData.ref_coc_no || 'N/A'}</Descriptions.Item>
                            {docData.risk_assessment_notes && (
                                <Descriptions.Item label="Risk Assessment Notes" span={3}>
                                    <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                                        <div>{docData.risk_assessment_notes}</div>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                                            By: {docData.risk_assessment_by_name || docData.risk_assessment_by} on {docData.risk_assessment_date ? moment(docData.risk_assessment_date).format('DD-MMM-YYYY HH:mm') : ''}
                                        </Text>
                                    </div>
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    )}

                    {activeDetailSection === 'tech' && currentDisplayDoc && (
                        <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                <Descriptions.Item label="Status Type"><Tag color="purple">{currentDisplayDoc.status_type || 'PERMANENT'}</Tag></Descriptions.Item>
                                <Descriptions.Item label="Objective"><Tag color="cyan">{currentDisplayDoc.objective} {currentDisplayDoc.objective_other ? `(${currentDisplayDoc.objective_other})` : ''}</Tag></Descriptions.Item>
                                <Descriptions.Item label="Change Categories" span={2}>
                                    <Space size={4}>
                                        {currentDisplayDoc.is_drawing && <Tag color="blue">Product/Process Drawing</Tag>}
                                        {currentDisplayDoc.is_tooling && <Tag color="green">Tooling</Tag>}
                                        {currentDisplayDoc.is_program && <Tag color="orange">Cutting Program</Tag>}
                                        {currentDisplayDoc.is_usage && <Tag color="magenta">Usage / Setup</Tag>}
                                    </Space>
                                </Descriptions.Item>
                                <Descriptions.Item label="Title of Change" span={2}>
                                    <Text strong style={{ fontSize: 14 }}>{currentDisplayDoc.title_of_change}</Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Reason of Change" span={2}>
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{currentDisplayDoc.reason_of_change}</div>
                                    <FieldAttachmentDisplay attachments={attachments} fieldName="reason_of_change" />
                                </Descriptions.Item>
                            </Descriptions>

                            {currentDisplayDoc.is_drawing && (
                                <Card size="small" title={<Text strong style={{ color: '#1890ff' }}>📐 Drawing Specifications</Text>}>
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }}>
                                        <Descriptions.Item label="Part No">{currentDisplayDoc.dwg_part_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="C/N">{currentDisplayDoc.dwg_cn || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Revision">{currentDisplayDoc.dwg_revision || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Before Change" span={3}>
                                            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>{currentDisplayDoc.dwg_before_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_before_change" />
                                        </Descriptions.Item>
                                        <Descriptions.Item label="After Change" span={3}>
                                            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 6 }}>{currentDisplayDoc.dwg_after_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="dwg_after_change" />
                                        </Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            )}

                            {currentDisplayDoc.is_tooling && (
                                <Card size="small" title={<Text strong style={{ color: '#52c41a' }}>🔧 Tooling Specifications</Text>}>
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                        <Descriptions.Item label="Current Tool No">{currentDisplayDoc.tool_current_no || '-'} ({currentDisplayDoc.tool_current_usage} K/pc)</Descriptions.Item>
                                        <Descriptions.Item label="New Tool No">{currentDisplayDoc.tool_new_no || '-'} ({currentDisplayDoc.tool_new_usage} K/pc)</Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            )}

                            {currentDisplayDoc.is_program && (
                                <Card size="small" title={<Text strong style={{ color: '#fa8c16' }}>💻 Program & Conditions</Text>}>
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                        <Descriptions.Item label="Program Before" span={2}>
                                            <div>{currentDisplayDoc.prog_before_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="prog_before_change" />
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Program After" span={2}>
                                            <div>{currentDisplayDoc.prog_after_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="prog_after_change" />
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Condition Before" span={2}>
                                            <div>{currentDisplayDoc.prog_condition_before || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_before" />
                                        </Descriptions.Item>
                                        <Descriptions.Item label="Condition After" span={2}>
                                            <div>{currentDisplayDoc.prog_condition_after || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="prog_condition_after" />
                                        </Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            )}

                            {currentDisplayDoc.is_usage && (
                                <Card size="small" title={<Text strong style={{ color: '#eb2f96' }}>⚙️ Usage & Setup Sheet</Text>}>
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 3 }}>
                                        <Descriptions.Item label="Setup Sheet No">{currentDisplayDoc.usage_setup_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Part No">{currentDisplayDoc.usage_part_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="M/C No">{currentDisplayDoc.usage_mc_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Process">{currentDisplayDoc.usage_process || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Program No">{currentDisplayDoc.usage_program_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Cycle Time">{currentDisplayDoc.usage_cycle_time_before || '-'} → {currentDisplayDoc.usage_cycle_time_after || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Before Setup" span={3}>
                                            <div>{currentDisplayDoc.usage_before_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="usage_before_change" />
                                        </Descriptions.Item>
                                        <Descriptions.Item label="After Setup" span={3}>
                                            <div>{currentDisplayDoc.usage_after_change || '-'}</div>
                                            <FieldAttachmentDisplay attachments={attachments} fieldName="usage_after_change" />
                                        </Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            )}
                        </Space>
                    )}

                    {activeDetailSection === 'ecn_scope' && docData && (
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                            <Descriptions.Item label="DWG Suspended in Innovator">{docData.dwg_suspended ? <Tag color="error">CONFIRMED SUSPENDED</Tag> : <Tag>NO</Tag>}</Descriptions.Item>
                            <Descriptions.Item label="DWG Enabled in Innovator">{docData.dwg_enabled ? <Tag color="success">CONFIRMED ACTIVE</Tag> : <Tag color="warning">PENDING</Tag>}</Descriptions.Item>
                            <Descriptions.Item label="Scope of Implementation" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{docData.scope_of_implementation || 'N/A'}</div>
                            </Descriptions.Item>
                            <Descriptions.Item label="Before Change Description" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 6 }}>{docData.before_change || 'N/A'}</div>
                                <FieldAttachmentDisplay attachments={attachments} fieldName="before_change" />
                            </Descriptions.Item>
                            <Descriptions.Item label="After Change Description" span={2}>
                                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 6 }}>{docData.after_change || 'N/A'}</div>
                                <FieldAttachmentDisplay attachments={attachments} fieldName="after_change" />
                            </Descriptions.Item>
                        </Descriptions>
                    )}

                    {activeDetailSection === 'impact' && (
                        impactData ? (
                            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                                <Card size="small" title="1. Customer, Overseas & Sale Drawing Impact">
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                        <Descriptions.Item label="Customer Impact">{impactData.has_customer_impact ? <Tag color="red">YES</Tag> : <Tag>NO</Tag>}</Descriptions.Item>
                                        <Descriptions.Item label="Customer Name">{impactData.customer_name || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="4M Request Doc No">{impactData.m4_request_doc_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Notification Date">{impactData.customer_notification_date ? moment(impactData.customer_notification_date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Change Notice Date">{impactData.customer_change_notice_date ? moment(impactData.customer_change_notice_date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Cust Approved Date">{impactData.customer_approved_date ? moment(impactData.customer_approved_date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
                                        
                                        <Descriptions.Item label="KZW/FJSW Impact">{impactData.has_kzw_fjsw_impact ? <Tag color="volcano">YES</Tag> : <Tag>NO</Tag>}</Descriptions.Item>
                                        <Descriptions.Item label="Operation Type">{impactData.operation_type || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="KZW DCN/ECN Doc No">{impactData.kzw_dcn_ecn_doc_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Confirm Received Date">{impactData.kzw_doc_received_date ? moment(impactData.kzw_doc_received_date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>

                                        <Descriptions.Item label="Sale Drawing Impact">{impactData.has_sale_drawing_impact ? <Tag color="blue">YES</Tag> : <Tag>NO</Tag>}</Descriptions.Item>
                                        <Descriptions.Item label="Revision No">{impactData.sale_drawing_revision_no || '-'}</Descriptions.Item>
                                        <Descriptions.Item label="Confirm Finish Date" span={2}>{impactData.sale_drawing_finish_date ? moment(impactData.sale_drawing_finish_date).format('DD-MMM-YYYY') : '-'}</Descriptions.Item>
                                    </Descriptions>
                                </Card>

                                <Card size="small" title="2. 8 Affected Areas Checklist">
                                    <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                        <Descriptions.Item label="1. Traceability (Lot Recall)" span={2}>
                                            {impactData.has_traceability ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_traceability && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Recalled Lot No: <Text strong>{impactData.traceability_details?.lot_no || '-'}</Text></div>
                                                    <div>Confirm Finish Date: <Text>{impactData.traceability_details?.finish_date ? moment(impactData.traceability_details.finish_date).format('DD-MMM-YYYY') : '-'}</Text></div>
                                                    {impactData.traceability_details?.google_sheet_url && (
                                                        <div style={{ marginTop: 4 }}>
                                                            Google Sheet Link: <a href={impactData.traceability_details.google_sheet_url} target="_blank" rel="noopener noreferrer">{impactData.traceability_details.google_sheet_url} 🔗</a>
                                                        </div>
                                                    )}
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="traceability" />
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="2. WIP, Stock, Backlog" span={2}>
                                            {impactData.has_wip_stock ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_wip_stock && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Target Models / Disposition: <Text strong>{impactData.wip_stock_details?.models || '-'}</Text></div>
                                                    <div>Confirm Finish Date: <Text>{impactData.wip_stock_details?.finish_date ? moment(impactData.wip_stock_details.finish_date).format('DD-MMM-YYYY') : '-'}</Text></div>
                                                    {impactData.wip_stock_details?.google_sheet_url && (
                                                        <div style={{ marginTop: 4 }}>
                                                            Google Sheet Link: <a href={impactData.wip_stock_details.google_sheet_url} target="_blank" rel="noopener noreferrer">{impactData.wip_stock_details.google_sheet_url} 🔗</a>
                                                        </div>
                                                    )}
                                                    <FieldAttachmentDisplay attachments={attachments} fieldName="wip_stock" />
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="3. Outsourcing Process" span={2}>
                                            {impactData.has_outsourcing ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_outsourcing && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Method / Doc No: {impactData.outsourcing_details?.by_method || '-'}</div>
                                                    <div>Lots in Outsourcing: {impactData.outsourcing_details?.lots || '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="4. Unit Price" span={2}>
                                            {impactData.has_unit_price ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_unit_price && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Stakeholder Info: {impactData.unit_price_details?.stakeholder_info || '-'}</div>
                                                    <div>Cost Factors: {impactData.unit_price_details?.cost_factors || '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="5. Manufacturing Process" span={2}>
                                            {impactData.has_manufacturing ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_manufacturing && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>WI Doc No: {impactData.manufacturing_details?.production_methods_doc || '-'}</div>
                                                    <div>Tooling Data Sheet No: {impactData.manufacturing_details?.tooling_doc || '-'}</div>
                                                    <div>Program Machine No: {impactData.manufacturing_details?.program_doc || '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="6. Product Quality" span={2}>
                                            {impactData.has_product_quality ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_product_quality && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Inspection Methods / WI No: {impactData.product_quality_details?.inspection_methods_doc || '-'}</div>
                                                    <div>Additional Items: {impactData.product_quality_details?.additional_items || '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="7. Safety" span={2}>
                                            {impactData.has_safety ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_safety && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Risk Assessment Doc No: {impactData.safety_details?.risk_assessment_doc || '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>

                                        <Descriptions.Item label="8. On-Time Delivery" span={2}>
                                            {impactData.has_otd ? <Tag color="purple">YES</Tag> : <Tag>NO</Tag>}
                                            {impactData.has_otd && (
                                                <div style={{ marginTop: 6 }}>
                                                    <div>Increased Approx Time: {impactData.otd_details?.increase_time || '-'}</div>
                                                    <div>Est Completion Date: {impactData.otd_details?.estimated_completion_date ? moment(impactData.otd_details.estimated_completion_date).format('DD-MMM-YYYY') : '-'}</div>
                                                </div>
                                            )}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            </Space>
                        ) : <Text type="secondary">No impact assessment recorded.</Text>
                    )}

                    {activeDetailSection === 'qc' && (
                        <Space direction="vertical" style={{ width: '100%' }}>
                            {qcData.map(qc => (
                                <Card key={qc.id} size="small" title={`${qc.decision_type} Decision: ${qc.decision} ${qc.fai_type ? `(${qc.fai_type})` : ''}`}>
                                    <Descriptions bordered size="small" column={1}>
                                        <Descriptions.Item label="Decision Reason"><div style={{ whiteSpace: 'pre-wrap' }}>{qc.reason || 'None'}</div></Descriptions.Item>
                                        <Descriptions.Item label="Evaluator">{qc.confirmed_by_name} ({qc.confirmed_by})</Descriptions.Item>
                                        <Descriptions.Item label="Confirmed Date">{moment(qc.confirmed_date).format('DD-MMM-YYYY HH:mm:ss')}</Descriptions.Item>
                                    </Descriptions>
                                </Card>
                            ))}
                        </Space>
                    )}

                    {activeDetailSection === 'fai' && (
                        faiData ? (
                            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                                <Descriptions.Item label="FAI Lot No">{faiData.fai_lot_no || 'N/A'}</Descriptions.Item>
                                <Descriptions.Item label="FAI Approved Status">{faiData.fai_approved_confirmed ? <Tag color="success">CONFIRMED</Tag> : <Tag>NOT REQUIRED</Tag>}</Descriptions.Item>
                                {faiData.google_sheet_url && (
                                    <Descriptions.Item label="Google Sheet Report Link" span={2}>
                                        <a href={faiData.google_sheet_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>
                                            {faiData.google_sheet_url} 🔗
                                        </a>
                                    </Descriptions.Item>
                                )}
                                <Descriptions.Item label="Summary Result" span={2}>
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, marginBottom: 8 }}>{faiData.summary_result || 'N/A'}</div>
                                    <FieldAttachmentDisplay attachments={attachments} fieldName="fai_summary" />
                                </Descriptions.Item>
                                <Descriptions.Item label="Stakeholder Comment" span={2}>
                                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{faiData.stakeholder_comment || 'N/A'}</div>
                                </Descriptions.Item>
                            </Descriptions>
                        ) : <Text type="secondary">Pending FAI Summary.</Text>
                    )}

                    {activeDetailSection === 'concern' && (
                        <Table 
                            dataSource={tasksData} 
                            rowKey="id" 
                            pagination={false} 
                            size="middle"
                            columns={[
                                { title: 'Dept', dataIndex: 'dept_code', width: 90, render: c => <Tag color="blue">{c}</Tag> },
                                { title: 'Department Name', dataIndex: 'dept_label' },
                                { title: 'Involvement', dataIndex: 'is_needed', render: v => v ? <Tag color="blue">NEED</Tag> : <Tag>NO NEED</Tag> },
                                { title: 'Status', dataIndex: 'status', render: st => st === 'ACKNOWLEDGED' ? <Tag color="success" icon={<CheckCircleOutlined />}>ACKNOWLEDGED</Tag> : <Tag color="warning" icon={<ClockCircleOutlined />}>PENDING</Tag> },
                                { title: 'Sign-off PIC', render: (_, r) => r.approved_by_name ? `${r.approved_by_name} (${r.approved_by || ''})` : '-' },
                                { title: 'Signed Date', render: (_, r) => r.approved_date ? moment(r.approved_date).format('DD-MMM-YYYY HH:mm') : '-' }
                            ]}
                        />
                    )}
                </div>
            </Modal>
        </div>
    );
}
