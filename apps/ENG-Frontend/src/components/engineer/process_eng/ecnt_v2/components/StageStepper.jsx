import React from 'react';
import { Space, Typography, Tag, Tooltip } from 'antd';
import { CheckCircleFilled, ClockCircleFilled, SyncOutlined } from '@ant-design/icons';
import { ECNT_STAGES } from '../utils/ecntConstants';

const { Text } = Typography;

export default function StageStepper({ currentStageCode, stageHistory = [], onSelectStage }) {
    // Standard linear stages without rework sub-stages
    const standardStages = ECNT_STAGES.filter(s => s.type !== 'RETURN_LOOP');

    // Find any active return loops
    const activeReturnStage = stageHistory.find(h => h.status === 'ACTIVE' && h.stage_type === 'RETURN_LOOP');
    const hasReturnLoop = !!activeReturnStage;

    const currentStageIndex = standardStages.findIndex(s => s.code === currentStageCode);

    return (
        <div style={{ 
            background: '#ffffff', 
            borderRadius: 12, 
            padding: '16px 20px', 
            border: '1px solid #e8e8e8',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflowX: 'auto', paddingBottom: 6 }}>
                {standardStages.map((stage, idx) => {
                    const isPassed = currentStageIndex > idx;
                    const isCurrent = currentStageIndex === idx && !hasReturnLoop;

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
                            <Tooltip title={stage.description}>
                                <div 
                                    onClick={() => onSelectStage && onSelectStage(stage.code)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        minWidth: 74,
                                        textAlign: 'center',
                                        padding: '4px 6px',
                                        borderRadius: 8,
                                        border: `1px solid ${borderColor}`,
                                        background: bgColor,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ marginBottom: 4 }}>{icon}</div>
                                    <Text style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 500, color: textColor }}>
                                        {stage.shortTitle}
                                    </Text>
                                </div>
                            </Tooltip>

                            {idx < standardStages.length - 1 && (
                                <div style={{ 
                                    flex: 1, 
                                    height: 2, 
                                    background: isPassed ? '#52c41a' : '#e8e8e8', 
                                    margin: '0 4px',
                                    minWidth: 10
                                }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
}
