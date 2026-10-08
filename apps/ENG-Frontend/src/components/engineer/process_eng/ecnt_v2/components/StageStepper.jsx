import React, { useState } from 'react';
import { Space, Typography, Tag, Tooltip, Button, Modal } from 'antd';
import { 
    CheckCircleFilled, ClockCircleFilled, SyncOutlined, 
    UserOutlined, TeamOutlined 
} from '@ant-design/icons';
import { ECNT_STAGES } from '../utils/ecntConstants';
import WorkflowStageFlowPanel from './WorkflowStageFlowPanel';

const { Text } = Typography;

export default function StageStepper({ 
    documentType,
    documentId,
    docData,
    currentStageCode, 
    stageHistory = [], 
    tasksData = [],
    systemConfig = {},
    onStageFlowUpdated,
    onSelectStage 
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Standard linear stages without rework sub-stages
    const standardStages = ECNT_STAGES.filter(s => s.type !== 'RETURN_LOOP');

    // Document is officially closed & effective
    const isDocClosed = ['ECN EFFECTIVE', 'EFFECTIVE', 'CLOSED', 'ECR ONLY CLOSED'].includes((docData?.process_status || '').toUpperCase());

    // Separate pipeline stages for ECR vs ECN
    const stagesForView = documentType === 'ECR'
        ? standardStages.filter(s => ['STAGE_1', 'STAGE_2', 'STAGE_2_RISK', 'STAGE_3', 'STAGE_4'].includes(s.code))
        : standardStages.filter(s => ['STAGE_4', 'STAGE_5', 'STAGE_6', 'STAGE_7', 'STAGE_8', 'STAGE_9', 'STAGE_10'].includes(s.code));

    // Map active stage code so that currentBlock matches the active stage node:
    let resolvedStageCode = currentStageCode;
    if (documentType === 'ECN') {
        const blk = Number(docData?.current_block || 5);
        if (blk === 5) resolvedStageCode = 'STAGE_4';
        else if (blk === 6) resolvedStageCode = 'STAGE_5';
        else if (blk === 7) resolvedStageCode = 'STAGE_6';
        else if (blk === 8) resolvedStageCode = 'STAGE_7';
        else if (blk === 9) resolvedStageCode = 'STAGE_8';
        else if (blk === 10) resolvedStageCode = 'STAGE_9';
        else if (blk === 11) resolvedStageCode = 'STAGE_10';
    } else {
        if (docData?.process_status === 'Pending Risk Assessment' || docData?.current_stage_code === 'STAGE_2_RISK') resolvedStageCode = 'STAGE_2_RISK';
        else if (docData?.process_status === 'Pending Eng Mgr' || docData?.current_block === 4) resolvedStageCode = 'STAGE_3';
        else if (docData?.process_status === 'Issued ECN' || docData?.current_block === 5) resolvedStageCode = 'STAGE_4';
    }

    // Find any active return loops
    const activeReturnStage = stageHistory.find(h => h.status === 'ACTIVE' && h.stage_type === 'RETURN_LOOP');
    const hasReturnLoop = !isDocClosed && !!activeReturnStage;

    const currentStageIndex = isDocClosed ? stagesForView.length : stagesForView.findIndex(s => s.code === resolvedStageCode);

    // Helper: Determine PIC summary for each stage
    const getStagePicSummary = (stageCode) => {
        let stageKey = 'STAGE_1';
        if (stageCode === 'STAGE_1') stageKey = 'STAGE_1';
        else if (stageCode === 'STAGE_2') stageKey = 'STAGE_2';
        else if (stageCode === 'STAGE_2_RISK') stageKey = 'STAGE_2_RISK';
        else if (stageCode === 'STAGE_3') stageKey = 'STAGE_3';
        else if (stageCode === 'STAGE_4') stageKey = 'STAGE_4';
        else if (stageCode === 'STAGE_5') stageKey = 'STAGE_5';
        else if (stageCode === 'STAGE_6') stageKey = 'STAGE_6';
        else if (stageCode === 'STAGE_7') stageKey = 'STAGE_7';
        else if (stageCode === 'STAGE_8') stageKey = 'STAGE_8';
        else if (stageCode === 'STAGE_9') stageKey = 'STAGE_9';
        else if (stageCode === 'STAGE_10') stageKey = 'STAGE_10';

        const saved = docData?.stage_flow?.[stageKey];
        if (saved?.assignees && saved.assignees.length > 0) {
            return {
                primaryName: saved.assignees[0].name || saved.assignees[0].emp_no,
                extraCount: saved.assignees.length - 1,
                rule: saved.approval_rule || 'ANY'
            };
        }

        const cfg = systemConfig?.stage_assignees || {};
        if (stageKey === 'STAGE_1') {
            return { primaryName: docData?.request_by_name || docData?.request_by || 'Requester', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_2') {
            const mgr = cfg?.dept_mgr_mapping?.[docData?.department];
            return { primaryName: mgr?.name || `${docData?.department || 'Dept'} Mgr`, extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_2_RISK') {
            return { primaryName: cfg?.lead_engineer_risk?.name || 'พี่โอ (PE Assigned)', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_3') {
            return { primaryName: cfg?.eng_mgr?.name || 'พี่แจ็ค (Eng Mgr)', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_5') {
            return { primaryName: cfg?.eng_mgr?.name || 'Teerapol K.', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_4' || stageKey === 'STAGE_8') {
            return { primaryName: docData?.assigned_to || docData?.engineer_assigned || cfg?.default_lead_engineer?.name || 'PE Assigned', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_6') {
            return { primaryName: cfg?.qc_msa_pic?.name || cfg?.default_qc_pic?.name || 'Patcharayada W.', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_7') {
            return { primaryName: cfg?.qc_fai_pic?.name || cfg?.default_qc_pic?.name || 'Patcharayada W.', extraCount: 0, rule: 'ANY' };
        }
        if (stageKey === 'STAGE_9') {
            return { primaryName: 'Multi-Dept (ALL)', extraCount: 0, rule: 'ALL' };
        }
        if (stageKey === 'STAGE_10') {
            return { primaryName: cfg?.eng_mgr?.name || 'Plant Exec / Eng Mgr', extraCount: 0, rule: 'ANY' };
        }

        return { primaryName: 'Pending', extraCount: 0, rule: 'ANY' };
    };

    return (
        <div style={{ 
            background: '#ffffff', 
            borderRadius: 12, 
            padding: '16px 20px', 
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
            {/* Stepper Header with Popup Trigger Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <Space size="middle">
                    <Text strong style={{ fontSize: 13, color: '#1677ff', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TeamOutlined /> Workflow Stage Progression & PIC Responsibility
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        (Click any stage or button to manage workflow PICs and approval rules)
                    </Text>
                </Space>

                {documentId && (
                    <Button 
                        size="small" 
                        type="default"
                        icon={<TeamOutlined />} 
                        onClick={() => setIsModalOpen(true)}
                        style={{ borderRadius: 6, fontSize: 12, fontWeight: 500 }}
                    >
                        👥 Workflow PICs
                    </Button>
                )}
            </div>

            {hasReturnLoop && (
                <div style={{ 
                    background: '#fff7e6', 
                    border: '1px solid #ffd591', 
                    borderRadius: 8, 
                    padding: '8px 14px', 
                    marginBottom: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Space>
                        <SyncOutlined spin style={{ color: '#fa8c16', fontSize: 16 }} />
                        <Text strong style={{ color: '#d46b08' }}>
                            Currently in Clarification / Return Loop: {activeReturnStage.stage_title}
                        </Text>
                    </Space>
                    <Tag color="orange">ACTION REQUIRED BY {activeReturnStage.assigned_role || 'REQUESTER'}</Tag>
                </div>
            )}

            {/* Horizontal Stage Stepper Bar with PIC Pills */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', overflowX: 'auto', paddingBottom: 6 }}>
                {stagesForView.map((stage, idx) => {
                    const isPassed = isDocClosed ? true : (currentStageIndex > idx);
                    const isCurrent = !isDocClosed && (currentStageIndex === idx && !hasReturnLoop);
                    const picSummary = getStagePicSummary(stage.code);

                    let icon = null;
                    let borderColor = '#d9d9d9';
                    let bgColor = '#fafafa';
                    let textColor = '#8c8c8c';

                    if (isPassed) {
                        icon = <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />;
                        borderColor = '#b7eb8f';
                        bgColor = '#f6ffed';
                        textColor = '#389e0d';
                    } else if (isCurrent) {
                        icon = <ClockCircleFilled style={{ color: '#1890ff', fontSize: 16 }} />;
                        borderColor = '#91d5ff';
                        bgColor = '#e6f7ff';
                        textColor = '#096dd9';
                    } else {
                        icon = <span style={{ 
                            width: 16, height: 16, borderRadius: '50%', background: '#e8e8e8', 
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#595959' 
                        }}>{idx + 1}</span>;
                    }

                    return (
                        <React.Fragment key={stage.code}>
                            <Tooltip title={
                                <div>
                                    <div style={{ fontWeight: 600 }}>{stage.title}</div>
                                    <div style={{ fontSize: 11, marginTop: 2 }}>{stage.description}</div>
                                    <div style={{ fontSize: 11, marginTop: 4, color: '#91d5ff' }}>
                                        Stage Owner: {picSummary.primaryName} {picSummary.extraCount > 0 ? `(+${picSummary.extraCount})` : ''}
                                    </div>
                                    <div style={{ fontSize: 10, color: '#bfbfbf', marginTop: 2 }}>
                                        (Click to view & configure stage PICs)
                                    </div>
                                </div>
                            }>
                                <div 
                                    onClick={() => {
                                        setIsModalOpen(true);
                                        if (onSelectStage) onSelectStage(stage.code);
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        minWidth: 84,
                                        maxWidth: 108,
                                        textAlign: 'center',
                                        padding: '6px 6px',
                                        borderRadius: 8,
                                        border: `1px solid ${borderColor}`,
                                        background: bgColor,
                                        transition: 'all 0.2s',
                                        boxShadow: isCurrent ? '0 2px 8px rgba(24, 144, 255, 0.15)' : 'none'
                                    }}
                                >
                                    <div style={{ marginBottom: 3 }}>{icon}</div>
                                    <Text style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 600, color: textColor, marginBottom: 4 }}>
                                        {stage.shortTitle}
                                    </Text>

                                    {/* Assignee PIC pill right under stage title */}
                                    <Tag 
                                        icon={<UserOutlined style={{ fontSize: 9 }} />} 
                                        style={{ 
                                            fontSize: 10, 
                                            padding: '0 4px', 
                                            margin: 0, 
                                            maxWidth: 96, 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap',
                                            borderRadius: 4,
                                            background: isCurrent ? '#ffffff' : '#f5f5f5',
                                            borderColor: isCurrent ? '#91d5ff' : '#d9d9d9',
                                            color: isCurrent ? '#096dd9' : '#595959',
                                            lineHeight: '18px'
                                        }}
                                        title={picSummary.primaryName}
                                    >
                                        {picSummary.primaryName}
                                    </Tag>

                                    {picSummary.extraCount > 0 && (
                                        <Tag color="purple" style={{ fontSize: 9, padding: '0 3px', margin: '2px 0 0 0', borderRadius: 8 }}>
                                            +{picSummary.extraCount} ({picSummary.rule})
                                        </Tag>
                                    )}
                                </div>
                            </Tooltip>

                            {idx < stagesForView.length - 1 && (
                                <div style={{ 
                                    flex: 1, 
                                    height: 2, 
                                    background: isPassed ? '#52c41a' : '#e8e8e8', 
                                    margin: '18px 4px 0 4px',
                                    minWidth: 8
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Workflow Stage Flow & PIC Delegation Modal */}
            <Modal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width={1100}
                title={
                    <Space>
                        <TeamOutlined style={{ color: '#1677ff' }} />
                        <span style={{ fontWeight: 600 }}>Workflow Approval Flow & Stage PIC Delegation</span>
                    </Space>
                }
                centered
                destroyOnClose
            >
                <div style={{ maxHeight: '72vh', overflowY: 'auto', padding: '8px 12px 16px 4px' }}>
                    <WorkflowStageFlowPanel
                        documentType={documentType}
                        documentId={documentId}
                        docData={docData}
                        tasksData={tasksData}
                        systemConfig={systemConfig}
                        layoutMode="grid"
                        bordered={false}
                        onStageFlowUpdated={onStageFlowUpdated}
                    />
                </div>
            </Modal>
        </div>
    );
}
