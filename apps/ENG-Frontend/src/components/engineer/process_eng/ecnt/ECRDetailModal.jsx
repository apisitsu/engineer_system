import React, { useState, useEffect, useCallback } from "react";
import { Modal, Spin, Card, Row, Col, Divider, Tag, Button, Typography, Space } from 'antd';
import { FilePdfOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import { useReactToPrint } from 'react-to-print';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ActionCard from './components/WorkflowActions/ActionCard';
import StatusBadge from './components/StatusBadge';
import { Image } from 'antd';

// Deterministic status-to-step map for UI
const getStepFromStatus = (status) => {
    switch (status) {
        case 'Pending Dept Mgr': return 3.1;
        case 'Impact Assessment': return 3.2;
        case 'Pending ECN Approval': return 3.3;
        case 'Top Mgmt Approval': return 3.4;
        case 'DWG Suspension': return 3.45;
        case 'ECN Execution': return 3.5;
        case 'FAI Process': return 3.6;
        case 'Closed': return 4.0;
        case 'Denied': return 'denied';
        case 'Require More Detail': return 'rmd';
        default: return 3.1;
    }
};

export default function ECRDetailModal({ open, ecrId, onClose, onActionComplete }) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [ecrData, setEcrData] = useState(null);
    const [actionLogs, setActionLogs] = useState([]);
    const [currentStep, setCurrentStep] = useState(3.1);

    // For PDF Export
    const componentRef = React.useRef(null);
    const handlePrint = useReactToPrint({
        content: () => componentRef.current,
        documentTitle: ecrData ? `ECR_${ecrData.ecr_no}` : 'ECR_Document',
    });

    const fetchDetails = useCallback(async () => {
        if (!ecrId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${server.ECR_REQUIRE_GET_BY_ID}${ecrId}`);
            const data = res.data.data;
            const logs = res.data.logs;

            // Format changelist
            const changes = [];
            if (data.is_drawing) changes.push("Drawing");
            if (data.is_tooling) changes.push("Tooling");
            if (data.is_program) changes.push("Program");
            if (data.is_usage) changes.push("Usage");
            data.changeList = changes;

            setEcrData(data);
            setActionLogs(logs);

            // Phase 8: Determine workflow step purely from current status
            if (logs.length > 0 && logs[logs.length - 1].action_status === 'Resubmit') {
                setCurrentStep(3.1); // Force back to 3.1 if just resubmitted
            } else {
                setCurrentStep(getStepFromStatus(data.process_status));
            }
        } catch (err) {
            console.error("Fetch detail err:", err);
        } finally {
            setLoading(false);
        }
    }, [ecrId]);

    useEffect(() => {
        if (open && ecrId) {
            fetchDetails();
        }
        if (!open) {
            setEcrData(null);
            setActionLogs([]);
            setCurrentStep(3.1);
        }
    }, [open, ecrId, fetchDetails]);

    const handleNextStep = (nextStep) => {
        setCurrentStep(nextStep);
        fetchDetails(); // Reload data after action
        if (onActionComplete) onActionComplete(); // Tell parent to refresh table
    };

    const changeTypeColor = { Drawing: 'blue', Tooling: 'orange', Program: 'purple', Usage: 'cyan' };

    const renderAttachedFile = (fileUrl, label) => {
        if (!fileUrl) return null;

        // Handle both older base64 string data and new URL data
        const isBase64 = fileUrl.startsWith('data:image/');
        const isImage = fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null || isBase64;

        const fileSrc = isBase64 ? fileUrl :
            (fileUrl.startsWith('http') ? fileUrl : server.API_URL?.replace('/api', '') + fileUrl);

        return (
            <div style={{ marginTop: 8 }}>
                <b>{label}:</b><br />
                {isImage ? (
                    <Image src={fileSrc} alt={label} style={{ maxWidth: '100%', maxHeight: 100, marginTop: 5, borderRadius: 4, border: '1px solid #d9d9d9' }} />
                ) : (
                    <a href={fileSrc} target="_blank" rel="noopener noreferrer">
                        <Button size="small" icon={<FilePdfOutlined />} style={{ marginTop: 5 }}>View Linked File</Button>
                    </a>
                )}
            </div>
        );
    };

    return (
        <Modal
            title={
                ecrData ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                        <span style={{ color: theme.colors.primary, fontSize: '1.1em', fontWeight: 600 }}>
                            ECR Details: {ecrData.ecr_no}
                        </span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <StatusBadge status={ecrData.process_status || "Pending Dept Mgr"} />
                            <Button size="small" icon={<FilePdfOutlined />} onClick={handlePrint} style={{ color: theme.colors.error, borderColor: theme.colors.error }}>
                                PDF
                            </Button>
                        </div>
                    </div>
                ) : 'ECR Details'
            }
            width={900}
            open={open}
            onCancel={onClose}
            centered
            destroyOnClose
            footer={null}
            styles={{
                body: {
                    maxHeight: 'calc(100vh - 200px)',
                    overflowY: 'auto',
                    paddingRight: 8,
                },
            }}
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                    <Spin tip="Loading Details..." size="large" />
                </div>
            ) : !ecrData ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>ECR Not found.</div>
            ) : (
                <>
                    <div ref={componentRef} style={{ padding: '10px' }}>
                        {/* ECR Information */}
                        <Card title={"ECR Information: " + ecrData.ecr_no} size="small" style={{ marginBottom: 16 }}>
                            <Row gutter={[16, 12]}>
                                <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>General Information</Divider></Col>
                                <Col xs={12} md={6}><b>Request By:</b><br />{ecrData.request_by}</Col>
                                <Col xs={12} md={6}><b>Department:</b><br />{ecrData.department}</Col>
                                <Col xs={12} md={6}><b>Require Date:</b><br />{ecrData.require_date ? moment(ecrData.require_date).format('DD-MMM-YYYY') : '-'}</Col>
                                <Col xs={12} md={6}><b>Due Date:</b><br />{ecrData.due_date ? moment(ecrData.due_date).format('DD-MMM-YYYY') : '-'}</Col>
                                {ecrData.assigned_to && (
                                    <Col xs={12} md={6}><b>Assigned To (ENG):</b><br /><Tag color="geekblue">{ecrData.assigned_to}</Tag></Col>
                                )}

                                <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>Objective & Change Type</Divider></Col>
                                <Col xs={12} md={6}><b>Status Type:</b><br />{ecrData.status_type || ecrData.status}</Col>
                                <Col xs={12} md={6}><b>Objective:</b><br />{ecrData.objective}</Col>
                                <Col xs={24} md={12}>
                                    <b>Change Required:</b><br />
                                    {ecrData.changeList?.map(c => (
                                        <Tag key={c} color={changeTypeColor[c] || 'default'}>{c}</Tag>
                                    ))}
                                </Col>

                                {ecrData.changeList?.includes("Drawing") && (
                                    <>
                                        <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>Drawing Details</Divider></Col>
                                        <Col xs={8}><b>Part No:</b><br />{ecrData.part_no_drawing || '-'}</Col>
                                        <Col xs={8}><b>C/N:</b><br />{ecrData.cn_drawing || '-'}</Col>
                                        <Col xs={8}><b>Revision:</b><br />{ecrData.rev_drawing || '-'}</Col>
                                        <Col xs={12}>
                                            <b>Before Change:</b><br />{ecrData.drawing_before_change || '-'}
                                            {renderAttachedFile(ecrData.upload_drawing_before, "Attached Image (Before)")}
                                        </Col>
                                        <Col xs={12}>
                                            <b>After Change:</b><br />{ecrData.drawing_after_change || '-'}
                                            {renderAttachedFile(ecrData.upload_drawing_after, "Attached Image (After)")}
                                        </Col>
                                    </>
                                )}

                                {(ecrData.changeList?.includes("Tooling") || ecrData.changeList?.includes("Program") || ecrData.changeList?.includes("Usage")) && (
                                    <>
                                        <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>General Details</Divider></Col>
                                        <Col xs={6}><b>Setup Data Sheet No:</b><br />{ecrData.setup_data_sheet_no || '-'}</Col>
                                        <Col xs={6}><b>Part No:</b><br />{ecrData.part_no_tooling || '-'}</Col>
                                        <Col xs={6}><b>C/N:</b><br />{ecrData.cn_tooling || '-'}</Col>
                                        <Col xs={6}><b>Cycle Time:</b><br />{ecrData.cycle_time || '-'}</Col>
                                    </>
                                )}

                                {(ecrData.changeList?.includes("Tooling") || ecrData.changeList?.includes("Program") || ecrData.changeList?.includes("Usage")) && (
                                    <>
                                        <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>Setup Data Sheet</Divider></Col>
                                        <Col xs={12}>
                                            <b>Before Change:</b><br />{ecrData.setup_desc_before || '-'}
                                            {renderAttachedFile(ecrData.upload_setup_before, "Attached Image (Before)")}
                                        </Col>
                                        <Col xs={12}>
                                            <b>After Change:</b><br />{ecrData.setup_desc_after || '-'}
                                            {renderAttachedFile(ecrData.upload_setup_after, "Attached Image (After)")}
                                        </Col>
                                    </>
                                )}

                                {(ecrData.changeList?.includes("Program") || ecrData.changeList?.includes("Tooling")) && (
                                    <>
                                        <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>Cutting Program</Divider></Col>
                                        <Col xs={12}>
                                            <b>Before Change:</b><br />{ecrData.cutting_desc_before || '-'}
                                            {renderAttachedFile(ecrData.upload_cutting_before, "Attached Image (Before)")}
                                        </Col>
                                        <Col xs={12}>
                                            <b>After Change:</b><br />{ecrData.cutting_desc_after || '-'}
                                            {renderAttachedFile(ecrData.upload_cutting_after, "Attached Image (After)")}
                                        </Col>
                                    </>
                                )}

                                {(ecrData.changeList?.includes("Usage") || ecrData.changeList?.includes("Tooling")) && (
                                    <>
                                        <Col span={24}><Divider orientation="left" style={{ margin: 0, fontSize: 13 }}>Tooling / Usage</Divider></Col>
                                        <Col xs={12}><b>Current Tooling No:</b><br />{ecrData.current_tooling_no || '-'}</Col>
                                        <Col xs={12}><b>Current Usage:</b><br />{ecrData.current_tooling_usage || '-'}</Col>
                                        <Col xs={12}><b>New Tooling No:</b><br />{ecrData.new_tooling_no || '-'}</Col>
                                        <Col xs={12}><b>New Usage:</b><br />{ecrData.new_tooling_usage || '-'}</Col>
                                    </>
                                )}
                            </Row>
                        </Card>

                        {/* Print Header (Only visible when printing) */}
                        <style type="text/css" media="print">
                            {`
                                @page { size: A4; margin: 10mm; }
                                .ant-card-body { padding: 12px; }
                                .ant-divider-horizontal.ant-divider-with-text-left { margin: 8px 0; }
                                .no-print { display: none !important; }
                            `}
                        </style>

                        {/* Completed Workflow History */}
                        {actionLogs && actionLogs.length > 0 && (
                            <Card title="Completed Workflow History" size="small" style={{ marginBottom: 16, borderColor: '#e8e8e8' }}>
                                {actionLogs.map((log, index) => {
                                    let details = {};
                                    if (log.details) {
                                        try {
                                            details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                                        } catch (e) { }
                                    }
                                    return (
                                        <div key={log.id} style={{ marginBottom: index === actionLogs.length - 1 ? 0 : 16, paddingBottom: index === actionLogs.length - 1 ? 0 : 16, borderBottom: index === actionLogs.length - 1 ? 'none' : '1px solid #f0f0f0' }}>
                                            <Row gutter={[16, 8]}>
                                                <Col span={24}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography.Text strong style={{ color: theme.colors.primary }}>
                                                            Step {log.step_number}: {log.action_status}
                                                        </Typography.Text>
                                                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                            {moment(log.action_date).format('DD-MMM-YYYY HH:mm')}
                                                        </Typography.Text>
                                                    </div>
                                                </Col>
                                                <Col span={12}><b>Action By:</b> {log.action_by} ({log.action_role})</Col>
                                                <Col span={12}><b>Comments:</b> {log.comments || '-'}</Col>

                                                {/* Render specific step details if exist */}
                                                {details && Object.keys(details).length > 0 && (
                                                    <Col span={24} style={{ marginTop: 8 }}>
                                                        <div style={{ background: '#f9f9f9', padding: 8, borderRadius: 4, fontSize: 13 }}>
                                                            {details.target_ecn && <div><b>Target ECN:</b> {details.target_ecn}</div>}
                                                            {details.scope_implementation && <div><b>Scope:</b> {details.scope_implementation}</div>}
                                                            {details.msa_requirement && <div><b>MSA Requirement:</b> {details.msa_requirement}</div>}
                                                            {details.fai_requirement && <div><b>FAI Requirement:</b> {details.fai_requirement}</div>}
                                                            {details.fai_lot && <div><b>FAI Lot:</b> {details.fai_lot}</div>}
                                                            {details.fai_details && <div><b>FAI Details:</b> {details.fai_details}</div>}
                                                            {details.upload_disposition_sheet && renderAttachedFile(details.upload_disposition_sheet, "Disposition Sheet")}
                                                            {details.fai_file && renderAttachedFile(details.fai_file, "FAI File")}
                                                        </div>
                                                    </Col>
                                                )}
                                            </Row>
                                        </div>
                                    );
                                })}
                            </Card>
                        )}
                    </div>

                    <div className="no-print">
                        {/* Workflow Action Card (Steps, Timeline, Current Action) */}
                        <ActionCard
                            currentStep={currentStep}
                            onNextStep={handleNextStep}
                            ecrData={ecrData}
                            actionLogs={actionLogs}
                        />
                    </div>
                </>
            )}
        </Modal >
    );
}
