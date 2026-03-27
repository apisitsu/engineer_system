import React from 'react';
import { Card, Result, Timeline, Steps as AntSteps } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import Step3_1 from './Step3_1';
import Step3_2 from './Step3_2';
import Step3_3 from './Step3_3';
import Step3_4 from './Step3_4';
import Step3_4_5 from './Step3_4_5';
import Step3_5 from './Step3_5';
import Step3_6 from './Step3_6';

import axios from 'axios';
import { server, key_constance } from '../../../../../../constance/constance';
import Swal from 'sweetalert2';
import { useTheme } from '../../../../../../theme';

// Step config for mapping
const STEP_CONFIG = [
    { key: '3.1', label: 'Dept. Manager', status_label: 'Pending Dept Mgr' },
    { key: '3.2', label: 'Impact Assessment', status_label: 'Impact Assessment' },
    { key: '3.3', label: 'ECR/ECN Approval', status_label: 'Pending ECN Approval' },
    { key: '3.4', label: 'Top Mgmt', status_label: 'Top Mgmt Approval' },
    { key: '3.45', label: 'DWG Suspend', status_label: 'DWG Suspension' },
    { key: '3.5', label: 'Execution Plan', status_label: 'ECN Execution' },
    { key: '3.6', label: 'FAI & Approval', status_label: 'FAI Process' },
    { key: '4.0', label: 'Close', status_label: 'Closed' },
];

export default function ActionCard({ currentStep, onNextStep, ecrData, actionLogs = [] }) {
    const { theme } = useTheme();

    // Get current user details from localStorage
    const userName = localStorage.getItem(key_constance.USER_NAME) || "Admin ECR";
    const userRole = localStorage.getItem(key_constance.ROLE) || "AD";
    const userDept = localStorage.getItem("USER_DEPARTMENT") || "AD";
    const userPos = localStorage.getItem("POSITION") || "System Administrator";

    // Permission Checking Logic
    const hasPermission = () => {
        if (userRole === 'AD') return { allowed: true }; // Admin override

        switch (currentStep) {
            case 3.1:
                const isRequesterDeptManager = (userDept === ecrData?.department) && (userPos?.includes('Manager') || userPos?.includes('Mgr'));
                return { allowed: isRequesterDeptManager, required: `${ecrData?.department} Manager` };
            case 3.2:
                return { allowed: userRole === 'ENG', required: "Engineer (ENG)" };
            case 3.3:
                const isEngManager = (userDept === 'ENG') && (userPos?.includes('Manager') || userPos?.includes('Mgr'));
                return { allowed: isEngManager, required: "Engineer Manager" };
            case 3.4:
                const isTopMgmt = userRole === 'Thai Manager/Div. Head' || userRole === 'Japanese Manager';
                return { allowed: isTopMgmt, required: "Top Management" };
            case 3.45:
            case 3.5:
            case 3.6:
                return { allowed: userRole === 'ENG', required: "Engineer (ENG)" };
            default:
                return { allowed: false, required: "System Administrator" };
        }
    };

    const handleStepSubmit = async (nextStepNum, action_status, comments = "", details = {}) => {
        try {
            const payload = {
                step_number: currentStep.toString(),
                action_by: userName,
                action_role: userRole,
                action_status,
                comments,
                details
            };

            await axios.put(`${server.ECR_REQUIRE_STATUS}${ecrData.id}/status`, payload);

            onNextStep(nextStepNum);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to save workflow action', 'error');
        }
    };

    // Determine step index for the progress indicator
    const currentStepIndex = STEP_CONFIG.findIndex(s => s.key === currentStep.toString());
    const isCompleted = currentStep >= 4.0 || ecrData?.process_status === 'Closed';

    // Render the workflow step
    const renderStepContent = () => {
        const perm = hasPermission();
        if (!perm.allowed) {
            return (
                <Card style={{ marginTop: 16, borderColor: theme.colors.warning }}>
                    <Result
                        status="warning"
                        title="Waiting for Approval"
                        subTitle={`Waiting for ${perm.required} to process this step. You do not have permission.`}
                    />
                </Card>
            );
        }

        switch (currentStep) {
            case 3.1: return <Step3_1 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.2: return <Step3_2 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.3: return <Step3_3 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.4: return <Step3_4 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.45: return <Step3_4_5 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.5: return <Step3_5 onNext={handleStepSubmit} ecrData={ecrData} />;
            case 3.6: return <Step3_6 onNext={handleStepSubmit} ecrData={ecrData} />;
            default: return null;
        }
    };

    return (
        <>
            {/* Workflow Progress Bar */}
            <Card
                size="small"
                style={{ marginBottom: 16, marginTop: 16 }}
                title={<span style={{ color: theme.colors.primary, fontWeight: 600 }}>Workflow Progress</span>}
            >
                <AntSteps
                    size="small"
                    current={isCompleted ? STEP_CONFIG.length : Math.max(0, currentStepIndex)}
                    status={isCompleted ? 'finish' : 'process'}
                    items={STEP_CONFIG.map((step, idx) => ({
                        title: step.label,
                        description: step.key,
                    }))}
                />
            </Card>

            {/* Approval History Timeline */}
            {actionLogs.length > 0 && (
                <Card
                    size="small"
                    style={{ marginBottom: 16 }}
                    title={<span style={{ color: theme.colors.info, fontWeight: 600 }}>Approval History</span>}
                >
                    <Timeline
                        items={actionLogs.map(log => ({
                            color: log.action_status === 'Approve' ? 'green'
                                : log.action_status === 'Deny' ? 'red'
                                    : 'blue',
                            children: (
                                <div>
                                    <strong>Step {log.step_number}</strong> — {log.action_status}
                                    <br />
                                    <span style={{ color: '#888', fontSize: 12 }}>
                                        by {log.action_by} ({log.action_role})
                                        {log.action_date && ` • ${new Date(log.action_date).toLocaleString()}`}
                                    </span>
                                    {log.comments && <div style={{ marginTop: 4, fontStyle: 'italic' }}>"{log.comments}"</div>}
                                </div>
                            ),
                        }))}
                    />
                </Card>
            )}

            {/* Current Step Action or Completed State */}
            {isCompleted ? (
                <Card style={{ marginTop: 16, borderColor: theme.colors.success }}>
                    <Result
                        status="success"
                        icon={<CheckCircleOutlined style={{ color: theme.colors.success }} />}
                        title="Workflow Completed"
                        subTitle={`ECR/ECN ${ecrData?.ecr_no} has been closed and is now effective.`}
                    />
                </Card>
            ) : (
                renderStepContent()
            )}
        </>
    );
}
