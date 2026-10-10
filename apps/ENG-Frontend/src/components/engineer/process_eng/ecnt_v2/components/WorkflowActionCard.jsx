import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Form, Alert, Select, Radio, Checkbox, Row, Col, Table, Tag, Typography, Tooltip, Space, Modal } from 'antd';
import { App } from 'antd';
import axios from 'axios';
import moment from 'moment';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { 
    CheckCircleOutlined, ClockCircleOutlined, LockOutlined, 
    RollbackOutlined, CloseCircleOutlined, PlusCircleOutlined,
    ArrowRightOutlined, EditOutlined, ExclamationCircleOutlined,
    LinkOutlined
} from '@ant-design/icons';
import { dispatchStageWorkflowEmail } from '../../../../../services/ecntEmailService';
import AttachableField from './AttachableField';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const DEFAULT_DEPARTMENTS = [
    { dept_code: 'PC', dept_label: 'PC (Production Control)', default_pic: 'TASANEE CHUDUANG' },
    { dept_code: 'QA', dept_label: 'QA (Quality Assurance)', default_pic: 'CHUANPIT KHATTIYA' },
    { dept_code: 'QC', dept_label: 'QC (Quality Control)', default_pic: 'SUPARAT KATSANUK' },
    { dept_code: 'PD1', dept_label: 'Production #1', default_pic: 'CHANASORN MEEPRO' },
    { dept_code: 'PD2', dept_label: 'Production #2', default_pic: 'WATCHARIYA ROEKARAM' },
    { dept_code: 'MC', dept_label: 'MC (Material Control)', default_pic: 'PUSSADEE ROIKEAW' },
    { dept_code: 'MM', dept_label: 'MM (Maintenance)', default_pic: 'Sarunyu Chokchaikasemsuk' },
];

export default function WorkflowActionCard({ 
    documentId, 
    documentType, 
    currentBlock, 
    processStatus, 
    tasksData = [], 
    systemConfig = {}, 
    docData = null, 
    onSuccess,
    onOpenCreateEcn,
    onOpenEditEcn,
    onOpenResubmit,
    onNavigateToEcn
}) {
    const { message: antdMessage } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const { userName, empNo, userRole, userDepartment, userInfo } = useAuthStore();
    const position = userInfo?.position || localStorage.getItem('position') || '';

    const cleanEmpNo = (empNo || localStorage.getItem('u_code') || '').toLowerCase();
    const cleanRole = (userRole || localStorage.getItem('role') || '').toUpperCase();
    const cleanDept = (userDepartment || localStorage.getItem('u_department') || '').toUpperCase();
    const cleanName = (userName || localStorage.getItem('u_name') || '').toLowerCase();
    const activeEcrNo = docData?.ecr_no || (documentType === 'ECR' ? docData?.doc_no : '') || '';
    const activeEcnNo = docData?.ecn_no || (documentType === 'ECN' ? docData?.doc_no : '') || '';

    // 1. Super Admin / System Admin check
    const systemAdmins = (systemConfig?.system_admins || ['admin', 'eng_mgr']).map(a => String(a).toLowerCase());
    const isAdmin = cleanRole === 'AD' || cleanDept === 'AD' || systemAdmins.includes(cleanEmpNo);

    // 2. Stage Ownership & Authorization Calculation
    let isAuthorized = false;
    let responsibleRoleLabel = '';
    let responsiblePersonName = '';

    if (documentType === 'ECR') {
        if (processStatus === 'Issued ECN' || currentBlock === 5) {
            responsibleRoleLabel = 'Assigned Lead Engineer';
            responsiblePersonName = docData?.assigned_to || 'Assigned Engineer';

            const isAssignedEng = (docData?.assigned_to && (
                docData.assigned_to.toLowerCase() === cleanEmpNo ||
                docData.assigned_to.toLowerCase() === cleanName
            )) || cleanDept === 'ENG';

            isAuthorized = isAdmin || isAssignedEng;
        } else if (processStatus === 'Require More Detail' || currentBlock === 1) {
            responsibleRoleLabel = 'Requester';
            responsiblePersonName = docData?.request_by_name || docData?.request_by || 'Requester';

            const isRequester = (docData?.request_by && docData.request_by.toLowerCase() === cleanEmpNo) ||
                                (docData?.request_by_name && docData.request_by_name.toLowerCase() === cleanName);

            isAuthorized = isAdmin || isRequester;
        } else if (currentBlock === 3) {
            const isRiskAssessment = processStatus === 'Pending Risk Assessment' || docData?.current_stage_code === 'STAGE_2_RISK';
            if (isRiskAssessment) {
                responsibleRoleLabel = 'Assigned Lead Engineer (Risk Assessment)';
                responsiblePersonName = docData?.assigned_to || 'NATHAPORN YAMMANUS (พี่โอ)';
                const isRiskPic = cleanDept === 'ENG' || cleanName.includes('nathaporn') || (docData?.assigned_to && (
                    docData.assigned_to.toLowerCase() === cleanEmpNo ||
                    docData.assigned_to.toLowerCase() === cleanName
                ));
                isAuthorized = isAdmin || isRiskPic;
            } else {
                const configuredDeptMgr = systemConfig?.stage_assignees?.dept_mgr_mapping?.[docData?.department];
                responsibleRoleLabel = `Department Manager (${docData?.department || 'Concerned Dept'})`;
                responsiblePersonName = configuredDeptMgr?.name || `${docData?.department || ''} Manager`;

                const isConfiguredMgr = configuredDeptMgr && (
                    (configuredDeptMgr.emp_no || '').toLowerCase() === cleanEmpNo ||
                    (configuredDeptMgr.name || '').toLowerCase() === cleanName
                );
                const isDeptMgrRole = cleanDept === (docData?.department || '').toUpperCase() && 
                    (cleanRole === 'MGR' || cleanRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')));

                isAuthorized = isAdmin || isConfiguredMgr || isDeptMgrRole;
            }
        } else if (currentBlock === 4) {
            const configuredEngMgr = systemConfig?.stage_assignees?.eng_mgr;
            responsibleRoleLabel = 'Engineering Department Manager';
            responsiblePersonName = configuredEngMgr?.name || 'TEERAPOL KANTAPOOM';

            const isConfiguredEngMgr = configuredEngMgr && (
                (configuredEngMgr.emp_no || '').toLowerCase() === cleanEmpNo ||
                (configuredEngMgr.name || '').toLowerCase() === cleanName
            );
            const isEngMgrRole = cleanDept === 'ENG' && 
                (cleanRole === 'MGR' || cleanRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')));

            isAuthorized = isAdmin || isConfiguredEngMgr || isEngMgrRole;
        }
    } else if (documentType === 'ECN') {
        if (currentBlock === 5) {
            responsibleRoleLabel = 'Assigned Lead Engineer';
            responsiblePersonName = docData?.engineer_assigned || 'Assigned Engineer';

            const isAssignedEng = (docData?.engineer_assigned && (
                docData.engineer_assigned.toLowerCase() === cleanEmpNo ||
                docData.engineer_assigned.toLowerCase() === cleanName
            )) || cleanDept === 'ENG';

            isAuthorized = isAdmin || isAssignedEng;
        } else if (currentBlock === 6) {
            const configuredEngMgr = systemConfig?.stage_assignees?.eng_mgr;
            responsibleRoleLabel = 'Engineering Department Manager';
            responsiblePersonName = configuredEngMgr?.name || 'TEERAPOL KANTAPOOM';

            const isConfiguredEngMgr = configuredEngMgr && (
                (configuredEngMgr.emp_no || '').toLowerCase() === cleanEmpNo ||
                (configuredEngMgr.name || '').toLowerCase() === cleanName
            );
            const isEngMgrRole = cleanDept === 'ENG' && 
                (cleanRole === 'MGR' || cleanRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')));

            isAuthorized = isAdmin || isConfiguredEngMgr || isEngMgrRole;
        } else if (currentBlock === 7 || currentBlock === 8) {
            const configuredQcPic = systemConfig?.stage_assignees?.default_qc_pic;
            responsibleRoleLabel = 'Quality Control (QC) Evaluator';
            responsiblePersonName = configuredQcPic?.name || 'PATCHARAYADA WAIYABOON';

            const isConfiguredQc = configuredQcPic && (configuredQcPic.emp_no || '').toLowerCase() === cleanEmpNo;
            const isQcRole = cleanDept === 'QC' || cleanRole === 'QC';

            isAuthorized = isAdmin || isConfiguredQc || isQcRole;
        } else if (currentBlock === 9) {
            responsibleRoleLabel = 'Assigned Lead Engineer';
            responsiblePersonName = docData?.engineer_assigned || 'Assigned Engineer';

            const isAssignedEng = (docData?.engineer_assigned && (
                docData.engineer_assigned.toLowerCase() === cleanEmpNo ||
                docData.engineer_assigned.toLowerCase() === cleanName
            )) || cleanDept === 'ENG';

            isAuthorized = isAdmin || isAssignedEng;
        } else if (currentBlock === 10) {
            responsibleRoleLabel = 'Concern Department Representatives (PC, QA, QC, PD1, PD2, MC, MM)';
            responsiblePersonName = 'Concern Department PICs';
            isAuthorized = true;
        } else if (currentBlock === 11) {
            const configuredEngMgr = systemConfig?.stage_assignees?.eng_mgr;
            responsibleRoleLabel = 'Plant Executive / Engineering Manager';
            responsiblePersonName = configuredEngMgr?.name || 'TEERAPOL KANTAPOOM';

            const isConfiguredEngMgr = configuredEngMgr && (configuredEngMgr.emp_no || '').toLowerCase() === cleanEmpNo;
            const isEngMgrRole = cleanDept === 'ENG' && 
                (cleanRole === 'MGR' || cleanRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')));
            const isTop = cleanRole === 'TOP' || cleanRole === 'EXECUTIVE';

            isAuthorized = isAdmin || isConfiguredEngMgr || isEngMgrRole || isTop;
        }
    }

    const isTaskSignAuthorized = (task) => {
        if (isAdmin) return true;
        const taskDept = (task.dept_code || '').toUpperCase();
        const isDeptMatch = cleanDept === taskDept || cleanRole === taskDept;
        const isPicMatch = task.pic_emp_no && task.pic_emp_no.toLowerCase() === cleanEmpNo;
        return isDeptMatch || isPicMatch;
    };

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
    const [commentAttachments, setCommentAttachments] = useState([]);
    const [rmdAttachments, setRmdAttachments] = useState([]);
    const [faiSummaryAttachments, setFaiSummaryAttachments] = useState([]);
    const [riskAttachments, setRiskAttachments] = useState([]);

    useEffect(() => {
        setDeptTasks(getActiveDepartments().map(d => ({ ...d, is_needed: true })));
    }, [getActiveDepartments]);

    useEffect(() => {
        if (currentBlock === 4) {
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem("token");
            axios.get(`${baseUrl}/api/ecnt/user-candidates`, {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            })
                .then(res => {
                    const rawList = res.data?.data || (Array.isArray(res.data) ? res.data : []);
                    const list = rawList.filter(u => (u.u_nickname || '').toLowerCase() !== 'admin');
                    setEngineerCandidates(list);
                })
                .catch(err => console.warn("Fetch candidates error:", err));
        }
    }, [currentBlock]);

    const isIssueEcn = Form.useWatch(['details', 'is_issue_ecn'], form);
    const faiDecision = Form.useWatch(['details', 'decision'], form);

    const isEcrRiskAssessment = documentType === 'ECR' && currentBlock === 3 && (processStatus === 'Pending Risk Assessment' || docData?.current_stage_code === 'STAGE_2_RISK');
    const isEcrIssuedEcn = documentType === 'ECR' && (processStatus === 'Issued ECN' || currentBlock === 5);
    const isEcrRework = documentType === 'ECR' && (processStatus === 'Require More Detail' || currentBlock === 1);
    const isCustomActionStage = isEcrIssuedEcn || isEcrRework || isEcrRiskAssessment;

    useEffect(() => {
        form.resetFields();
        setCommentAttachments([]);
        setRmdAttachments([]);
        setFaiSummaryAttachments([]);
        setRiskAttachments([]);
        if (currentBlock === 4 && !isEcrIssuedEcn) {
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
    }, [currentBlock, documentId, form, isEcrIssuedEcn]);

    if (processStatus === 'Draft' || processStatus === 'ECR Only Closed' || processStatus === 'ECN Effective' || processStatus === 'Denied') {
        return null;
    }

    const handleSubmit = async (selectedAction, extraDetails = {}) => {
        try {
            const values = await form.validateFields();

            // Block 9 submission guard: DWG Enable confirmation check
            if (currentBlock === 9 && selectedAction === 'APPROVE') {
                const isDwgConfirmed = docData?.dwg_enabled || values.details?.dwg_enabled || extraDetails?.dwg_enabled;
                if (!isDwgConfirmed) {
                    Modal.confirm({
                        title: 'Confirm DWG. Enable in Innovator',
                        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
                        content: 'Drawing active status has not been confirmed in Aras Innovator. To ensure drawing readiness before multi-department review, would you like to confirm DWG Enable now and submit to Concern Approvals?',
                        okText: 'Confirm DWG & Submit',
                        cancelText: 'Cancel',
                        onOk: () => {
                            form.setFieldsValue({ details: { ...(form.getFieldValue('details') || {}), dwg_enabled: true } });
                            handleSubmit('APPROVE', { ...extraDetails, dwg_enabled: true });
                        }
                    });
                    return;
                }
            }

            setLoading(true);

            const allAttachments = [...commentAttachments, ...rmdAttachments, ...faiSummaryAttachments, ...riskAttachments];

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
                attachments: allAttachments,
                details: {
                    ...(values.details || {}),
                    ...extraDetails
                }
            };

            // For Block 9, include tasks setup and dwg_enabled
            if (currentBlock === 9 && selectedAction === 'APPROVE') {
                payload.details.tasks = deptTasks;
                payload.details.dwg_enabled = docData?.dwg_enabled || values.details?.dwg_enabled || extraDetails?.dwg_enabled || true;
            }

            const endpoint = documentType === 'ECR' 
                ? `/api/ecnt/ecr/${documentId}/action` 
                : `/api/ecnt/ecn/${documentId}/action`;

            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem("token");
            await axios.put(`${baseUrl}${endpoint}`, payload, { 
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

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
            setCommentAttachments([]);
            setRmdAttachments([]);
            setFaiSummaryAttachments([]);
            setRiskAttachments([]);
            if (onSuccess) {
                const openModal = documentType === 'ECR' && currentBlock === 4 && selectedAction === 'APPROVE' && values.details?.is_issue_ecn !== false;
                onSuccess({ openCreateEcn: openModal });
            }
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
            dwg_enabled: docData?.dwg_enabled || form.getFieldValue(['details', 'dwg_enabled']) 
        });
    };

    const handleConfirmDwgEnable = async () => {
        try {
            setLoading(true);
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem("token");
            await axios.put(`${baseUrl}/api/ecnt/ecn/${documentId}/action`, {
                block_number: currentBlock || 9,
                action: 'CONFIRM_DWG_ENABLE',
                details: { dwg_enabled: true }
            }, { 
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                withCredentials: true 
            });
            antdMessage.success("DWG. Enable status confirmed and saved in Innovator!");
            if (docData) docData.dwg_enabled = true;
            form.setFieldsValue({ details: { ...(form.getFieldValue('details') || {}), dwg_enabled: true } });
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error("Failed to confirm DWG enable:", err);
            antdMessage.error(err?.response?.data?.error || "Failed to save DWG Enable status");
        } finally {
            setLoading(false);
        }
    };

    // Render Forms per block
    const renderBlockContent = () => {
        // ECR Block 5: ECN Formulation (After Block 4 Approved)
        if (isEcrIssuedEcn) {
            if (docData?.linked_ecn_id) {
                return (
                    <div style={{ marginBottom: 16 }}>
                        <Alert 
                            message={`ECR Approved & Official ECN Issued (${docData.linked_ecn_no || `ECN #${docData.linked_ecn_id}`})`}
                            description="This change request has successfully completed Block 4 and transferred to the official ECN workflow."
                            type="success" 
                            showIcon 
                            style={{ marginBottom: 16 }}
                        />
                        <Button 
                            type="primary" 
                            size="large" 
                            icon={<ArrowRightOutlined />} 
                            onClick={() => onNavigateToEcn && onNavigateToEcn(docData.linked_ecn_id)}
                            style={{ width: '100%', height: 42, borderRadius: 8, fontWeight: 600, background: '#1677ff' }}
                        >
                            Open Linked ECN Workspace ({docData.linked_ecn_no || `ECN #${docData.linked_ecn_id}`})
                        </Button>
                    </div>
                );
            }

            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message={`Block 4 Complete: ECR Approved for ECN Issuance (${docData?.ecr_no || `ECR #${documentId}`})`}
                        description={
                            <div style={{ fontSize: 13 }}>
                                <div>Decision: <strong style={{ color: '#52c41a' }}>Option A: Issue ECN</strong></div>
                                <div>Assigned Lead Engineer: <strong style={{ color: '#1677ff' }}>{docData?.assigned_to || 'Assigned Engineer'}</strong></div>
                                <div style={{ marginTop: 6, color: '#595959' }}>
                                    Next Action: The designated lead engineer must formulate the official ECN and complete the Impact Assessment (Block 5).
                                </div>
                            </div>
                        }
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                    {isAuthorized ? (
                        <Tooltip title="Formulate and Issue Official ECN (Block 5)">
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<PlusCircleOutlined />} 
                                onClick={onOpenCreateEcn}
                                style={{ width: '100%', height: 42, background: '#52c41a', borderColor: '#52c41a', borderRadius: 8, fontWeight: 600, fontSize: 14 }}
                            >
                                🚀 Formulate & Issue ECN (Block 5)
                            </Button>
                        </Tooltip>
                    ) : (
                        <div style={{ width: '100%', padding: '12px 14px', background: '#fffbe6', borderRadius: 8, border: '1px dashed #ffe58f', textAlign: 'center' }}>
                            <Space>
                                <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                                <Text style={{ fontSize: 13 }}>
                                    Awaiting assigned engineer <strong>({docData?.assigned_to || 'Assigned PIC'})</strong> to formulate ECN
                                </Text>
                            </Space>
                        </div>
                    )}
                </div>
            );
        }

        // ECR Block 1 & 2 / Rework (Require More Detail)
        if (isEcrRework) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message="⚠️ Clarification / Revision Requested (Rework Stage)"
                        description={
                            <div style={{ fontSize: 13 }}>
                                <div>This ECR has been returned to the requester for clarification or required document modifications.</div>
                                {docData?.last_rmd_comment && (
                                    <div style={{ marginTop: 6, color: '#d46b08', background: '#fff7e6', padding: '6px 10px', borderRadius: 6, border: '1px solid #ffd591' }}>
                                        <strong>Requested Details:</strong> {docData.last_rmd_comment}
                                    </div>
                                )}
                            </div>
                        }
                        type="warning" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                    {isAuthorized ? (
                        <Tooltip title="Edit ECR with revisions and resubmit to Department Manager">
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<EditOutlined />} 
                                onClick={onOpenResubmit}
                                style={{ width: '100%', height: 42, background: '#fa8c16', borderColor: '#fa8c16', borderRadius: 8, fontWeight: 600 }}
                            >
                                ✏️ Edit & Resubmit ECR
                            </Button>
                        </Tooltip>
                    ) : (
                        <div style={{ width: '100%', padding: '12px 14px', background: '#fffbe6', borderRadius: 8, border: '1px dashed #ffe58f', textAlign: 'center' }}>
                            <Space>
                                <LockOutlined style={{ color: '#fa8c16' }} />
                                <Text style={{ fontSize: 13 }}>
                                    Awaiting requester <strong>({docData?.request_by_name || docData?.request_by || 'Requester'})</strong> to revise and resubmit
                                </Text>
                            </Space>
                        </div>
                    )}
                </div>
            );
        }

        // ECN Block 5: ECN Clarification / Rework
        if (documentType === 'ECN' && currentBlock === 5) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message="⚠️ ECN Clarification Requested by Eng Dept Manager (Block 5 Rework)"
                        description={
                            <div style={{ fontSize: 13 }}>
                                <div>Please review the clarification notes below, provide explanations or updated attachments, and resubmit to the Engineering Department Manager.</div>
                                {docData?.last_rmd_comment && (
                                    <div style={{ marginTop: 8, color: '#d46b08', background: '#fff7e6', padding: '8px 12px', borderRadius: 6, border: '1px solid #ffd591' }}>
                                        <div style={{ fontWeight: 600, marginBottom: 2 }}>⚠️ Eng Mgr Clarification Request:</div>
                                        <div>{docData.last_rmd_comment}</div>
                                    </div>
                                )}
                            </div>
                        }
                        type="warning" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                    {isAuthorized && onOpenEditEcn && (
                        <div style={{ marginBottom: 16 }}>
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<EditOutlined />} 
                                onClick={onOpenEditEcn}
                                style={{ width: '100%', height: 42, background: '#fa8c16', borderColor: '#fa8c16', borderRadius: 8, fontWeight: 600 }}
                            >
                                ✏️ Edit & Revise ECN (Block 5)
                            </Button>
                        </div>
                    )}
                </div>
            );
        }

        // ECR Block 3: Risk Assessment (Lead Engineer: พี่โอ - Nathaporn)
        if (isEcrRiskAssessment) {
            return (
                <div style={{ marginBottom: 16 }}>
                    <Alert 
                        message={`ECR Risk Assessment (Assigned Lead Engineer: ${docData?.assigned_to || 'NATHAPORN YAMMANUS'})`}
                        description="Please review the change request, conduct technical risk and feasibility assessment, and submit findings to Engineering Department Manager."
                        type="info" 
                        showIcon 
                        style={{ marginBottom: 16 }}
                    />
                    <Row gutter={[16, 12]}>
                        <Col span={24}>
                            <AttachableField
                                name={['details', 'risk_notes']}
                                fieldName="risk_assessment"
                                label="Risk Assessment Analysis & Findings"
                                placeholder="Detail safety, production, and quality risks or mitigation measures (press Ctrl+V to paste screenshot)..."
                                rows={3}
                                rules={[{ required: true, message: 'Please provide risk assessment findings' }]}
                                attachments={riskAttachments}
                                onAttachmentsChange={setRiskAttachments}
                                blockNumber={3}
                                ecrNo={activeEcrNo}
                                ecnNo={activeEcnNo}
                            />
                        </Col>
                    </Row>
                    {isAuthorized ? (
                        <Button 
                            type="primary" 
                            size="large" 
                            icon={<CheckCircleOutlined />} 
                            onClick={() => handleSubmit('SUBMIT_RISK')}
                            loading={loading}
                            style={{ width: '100%', height: 42, background: '#1677ff', borderRadius: 8, fontWeight: 600, marginTop: 8 }}
                        >
                            Submit Risk Assessment to Eng Dept Manager
                        </Button>
                    ) : (
                        <div style={{ width: '100%', padding: '12px 14px', background: '#fffbe6', borderRadius: 8, border: '1px dashed #ffe58f', textAlign: 'center', marginTop: 8 }}>
                            <Space>
                                <LockOutlined style={{ color: '#fa8c16' }} />
                                <Text style={{ fontSize: 13 }}>
                                    Awaiting Assigned Engineer <strong>({docData?.assigned_to || 'NATHAPORN YAMMANUS'})</strong> to conduct Risk Assessment
                                </Text>
                            </Space>
                        </div>
                    )}
                </div>
            );
        }

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
                    <Row gutter={[12, 12]}>
                        <Col span={24}>
                            <Form.Item name={['details', 'is_issue_ecn']} label="Action Decision" rules={[{ required: true }]}>
                                <Select>
                                    <Option value={true}>Option A: Issue ECN (Proceed to Block 5)</Option>
                                    <Option value={false}>Option B: ECR Only (Close and Categorize)</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        {isIssueEcn ? (
                            <Col span={24}>
                                <Form.Item name="assigned_to" label="Assign Engineer (Eng. Assigned)" rules={[{ required: true }]}>
                                    <Select 
                                        placeholder="Select registered engineer..." 
                                        showSearch 
                                        allowClear
                                        filterOption={(input, option) => {
                                            const searchStr = (option?.label ?? '').toLowerCase();
                                            return searchStr.includes(input.toLowerCase());
                                        }}
                                        options={engineerCandidates.length > 0 ? (
                                            engineerCandidates.map(u => ({
                                                key: u.u_code,
                                                value: u.u_name,
                                                label: `${u.u_name} (${u.u_code}${u.u_nickname ? ` "${u.u_nickname}"` : ''}) - ${u.u_department} [${u.position || u.role}]`
                                            }))
                                        ) : ([
                                            { value: 'NATHAPORN YAMMANUS', label: 'NATHAPORN YAMMANUS (ENG)' },
                                            { value: 'TEERAPOL KANTAPOOM', label: 'TEERAPOL KANTAPOOM (ENG MGR)' },
                                            { value: 'TASANEE CHUDUANG', label: 'TASANEE CHUDUANG (PC)' }
                                        ])}
                                    />
                                </Form.Item>
                            </Col>
                        ) : (
                            <Col span={24}>
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
                                <Checkbox style={{ fontWeight: 600 }}>Confirm FAI Approved if Required (Check to confirm upon receiving passing FAI results)</Checkbox>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <div style={{ 
                                marginBottom: 14, 
                                background: (docData?.dwg_enabled || form.getFieldValue(['details', 'dwg_enabled'])) ? '#f6ffed' : '#e6f7ff', 
                                padding: '12px 16px', 
                                borderRadius: 8, 
                                border: `1px solid ${(docData?.dwg_enabled || form.getFieldValue(['details', 'dwg_enabled'])) ? '#b7eb8f' : '#91d5ff'}` 
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Form.Item name={['details', 'dwg_enabled']} valuePropName="checked" noStyle initialValue={docData?.dwg_enabled || false}>
                                                <Checkbox 
                                                    style={{ fontWeight: 600, color: '#096dd9', fontSize: 13 }}
                                                    onChange={e => {
                                                        form.setFieldsValue({ details: { ...(form.getFieldValue('details') || {}), dwg_enabled: e.target.checked } });
                                                    }}
                                                >
                                                    Confirm DWG. Enable (Engineer Assigned confirms drawing active status in Innovator)
                                                </Checkbox>
                                            </Form.Item>
                                            {(docData?.dwg_enabled || form.getFieldValue(['details', 'dwg_enabled'])) ? (
                                                <Tag color="success" icon={<CheckCircleOutlined />}>CONFIRMED</Tag>
                                            ) : (
                                                <Tag color="warning" icon={<ClockCircleOutlined />}>ACTION REQUIRED</Tag>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#595959', marginTop: 4, paddingLeft: 24 }}>
                                            Confirm that drawing has been enabled and activated in Aras Innovator PLM before releasing to Multi-Department Concern Approvals.
                                        </div>
                                    </div>

                                    {/* Direct Action Button to Confirm & Save immediately */}
                                    {!(docData?.dwg_enabled) && (
                                        <Button 
                                            type="primary"
                                            size="middle"
                                            icon={<CheckCircleOutlined />}
                                            loading={loading}
                                            onClick={handleConfirmDwgEnable}
                                            style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 6, fontWeight: 600 }}
                                        >
                                            Confirm & Save DWG. Enable
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </Col>
                        <Col span={12}>
                            <Form.Item name={['details', 'fai_lot_no']} label="FAI Lot No.">
                                <Input placeholder="Lot number used in FAI..." />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name={['details', 'google_sheet_url']} label="Google Sheet / Link (FAI Measurement & Summary Report)">
                                <Input 
                                    prefix={<LinkOutlined />} 
                                    placeholder="https://docs.google.com/spreadsheets/d/..." 
                                    addonAfter={
                                        form.getFieldValue(['details', 'google_sheet_url']) ? (
                                            <a href={form.getFieldValue(['details', 'google_sheet_url'])} target="_blank" rel="noopener noreferrer">
                                                Open 🔗
                                            </a>
                                        ) : null
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <AttachableField
                                name={['details', 'summary_result']}
                                fieldName="fai_summary"
                                label="Summary of FAI Result & Summarize"
                                placeholder="Summarize FAI inspection and measurement results (press Ctrl+V to paste screenshot)..."
                                rows={3}
                                attachments={faiSummaryAttachments}
                                onAttachmentsChange={setFaiSummaryAttachments}
                                blockNumber={9}
                                ecrNo={activeEcrNo}
                                ecnNo={activeEcnNo}
                            />
                        </Col>
                        <Col span={24}>
                            <Form.Item name={['details', 'stakeholder_comment']} label="Stakeholder Comment / Action">
                                <TextArea rows={2} placeholder="Notes or required actions for stakeholders..." />
                            </Form.Item>
                        </Col>
                    </Row>

                    <h5 style={{ marginTop: 12, marginBottom: 8, color: '#1677ff' }}>Configure Block 10 Concern Departments (NEED / NO NEED):</h5>
                    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 12 }}>
                        <Table 
                            dataSource={deptTasks} 
                            rowKey="dept_code" 
                            pagination={false} 
                            size="small"
                            scroll={{ x: 380 }}
                            columns={[
                                { title: 'Dept', dataIndex: 'dept_code', width: 70, align: 'center', render: c => <Tag color="blue">{c}</Tag> },
                                { title: 'Department Name', dataIndex: 'dept_label', ellipsis: true },
                                { title: 'Default PIC', dataIndex: 'default_pic', ellipsis: true },
                                { 
                                    title: 'Involvement', 
                                    key: 'action', 
                                    width: 140,
                                    render: (_, record, index) => (
                                        <Radio.Group 
                                            size="small"
                                            value={record.is_needed} 
                                            onChange={e => {
                                                const updated = [...deptTasks];
                                                updated[index].is_needed = e.target.value;
                                                setDeptTasks(updated);
                                            }}
                                        >
                                            <Radio.Button value={true}>NEED</Radio.Button>
                                            <Radio.Button value={false}>NO</Radio.Button>
                                        </Radio.Group>
                                    )
                                }
                            ]}
                        />
                    </div>
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

                    {/* DWG Enable Confirmation Status in Block 10 */}
                    {docData?.dwg_enabled ? (
                        <div style={{ marginBottom: 14, background: '#f6ffed', padding: '10px 14px', borderRadius: 6, border: '1px solid #b7eb8f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                                <div>
                                    <Text strong style={{ color: '#389e0d', fontSize: 13, display: 'block' }}>
                                        DWG. Enable Confirmed in Innovator
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        Lead Engineer has confirmed active drawing status in PLM before department review.
                                    </Text>
                                </div>
                            </Space>
                            <Tag color="success">VERIFIED</Tag>
                        </div>
                    ) : (
                        <div style={{ marginBottom: 14, background: '#fffbe6', padding: '10px 14px', borderRadius: 6, border: '1px solid #ffe58f', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <Space>
                                <ClockCircleOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                                <div>
                                    <Text strong style={{ color: '#d46b08', fontSize: 13, display: 'block' }}>
                                        Pending DWG. Enable Confirmation
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        Engineer Assigned confirms drawing active status in Innovator.
                                    </Text>
                                </div>
                            </Space>
                            {(userDepartment === 'ENG' || userRole === 'AD' || docData?.engineer_assigned === empNo || !docData?.engineer_assigned) && (
                                <Button 
                                    type="primary"
                                    size="small"
                                    icon={<CheckCircleOutlined />}
                                    loading={loading}
                                    onClick={handleConfirmDwgEnable}
                                    style={{ background: '#52c41a', borderColor: '#52c41a', borderRadius: 6, fontWeight: 600, fontSize: 12 }}
                                >
                                    Confirm & Save DWG. Enable
                                </Button>
                            )}
                        </div>
                    )}

                    <div style={{ width: '100%', overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 14 }}>
                        <Table 
                            dataSource={tasksData} 
                            rowKey="id" 
                            pagination={false} 
                            size="small"
                            scroll={{ x: 320 }}
                            columns={[
                                { 
                                    title: 'Dept', 
                                    dataIndex: 'dept_code', 
                                    width: 65,
                                    align: 'center',
                                    render: (code, record) => (
                                        <Tooltip title={record.dept_label}>
                                            <Tag color="blue" style={{ fontWeight: 700, margin: 0, padding: '0 6px' }}>
                                                {code || record.dept_label}
                                            </Tag>
                                        </Tooltip>
                                    )
                                },
                                { 
                                    title: 'Status / Signer', 
                                    key: 'status_col',
                                    width: 160,
                                    render: (_, record) => {
                                        if (!record.is_needed) {
                                            return <Tag color="default" style={{ margin: 0, fontSize: 11 }}>NO NEED</Tag>;
                                        }
                                        if (record.status === 'ACKNOWLEDGED') {
                                            return (
                                                <Tooltip title={`Signed by ${record.approved_by_name} (${record.approved_by || ''}) on ${record.approved_date ? moment(record.approved_date).format('DD-MMM-YYYY HH:mm') : '-'}`}>
                                                    <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0, fontSize: 11, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {record.approved_by_name || 'Signed'}
                                                    </Tag>
                                                </Tooltip>
                                            );
                                        }
                                        return (
                                            <Tag icon={<ClockCircleOutlined />} color="warning" style={{ margin: 0, fontSize: 11 }}>
                                                PENDING
                                            </Tag>
                                        );
                                    }
                                },
                                {
                                    title: 'Action',
                                    key: 'sign',
                                    width: 95,
                                    align: 'center',
                                    render: (_, record) => {
                                        if (!record.is_needed) return <Text type="secondary" style={{ fontSize: 11 }}>-</Text>;
                                        if (record.status === 'ACKNOWLEDGED') return <Tag color="success" style={{ margin: 0, fontSize: 11 }}>Signed</Tag>;
                                        
                                        const canSign = isTaskSignAuthorized(record);
                                        if (canSign) {
                                            return (
                                                <Button 
                                                    size="small" 
                                                    type="primary" 
                                                    icon={<CheckCircleOutlined />}
                                                    onClick={() => handleAcknowledgeTask(record.id)}
                                                    loading={loading}
                                                    style={{ 
                                                        background: '#52c41a', 
                                                        borderColor: '#52c41a', 
                                                        borderRadius: 6,
                                                        height: 28,
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        padding: '0 10px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                >
                                                    Sign
                                                </Button>
                                            );
                                        }

                                        return (
                                            <Tooltip title={`Signing requires ${record.dept_code} or Admin`}>
                                                <Button 
                                                    size="small" 
                                                    disabled 
                                                    style={{ 
                                                        opacity: 0.5, 
                                                        borderRadius: 6,
                                                        height: 28,
                                                        fontSize: 11,
                                                        padding: '0 6px'
                                                    }}
                                                >
                                                    🔒 Sign
                                                </Button>
                                            </Tooltip>
                                        );
                                    }
                                }
                            ]}
                        />
                    </div>
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
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#1890ff', fontWeight: 600 }}>
                        {isEcrIssuedEcn
                            ? 'Workflow Action: Block 5 (Issue ECN)'
                            : isEcrRework
                                ? 'Workflow Action: ECR Revision (Rework)'
                                : `Workflow Action: Block ${currentBlock}`}
                    </span>
                    {!isAuthorized && currentBlock !== 10 && !isCustomActionStage && (
                        <Tag icon={<LockOutlined />} color="warning">
                            Viewer Mode (Read-Only)
                        </Tag>
                    )}
                </div>
            } 
            style={{ marginTop: 20, borderColor: isAuthorized ? '#91d5ff' : '#d9d9d9', overflow: 'hidden' }} 
            headStyle={{ background: isAuthorized ? '#f0f5ff' : '#fafafa' }}
        >
            {!isAuthorized && currentBlock !== 10 && !isCustomActionStage && (
                <Alert 
                    message="🔒 Read-Only Viewer Mode" 
                    description={
                        <div>
                            <div>
                                This workflow stage is under the responsibility of: <strong style={{ color: '#1890ff' }}>{responsibleRoleLabel}</strong> {responsiblePersonName ? `(${responsiblePersonName})` : ''}
                            </div>
                            <div style={{ marginTop: 4, color: '#595959', fontSize: 13 }}>
                                All team members can view technical details and audit history. Editing and approving are restricted to designated stage owners.
                            </div>
                        </div>
                    }
                    type="warning" 
                    showIcon 
                    style={{ marginBottom: 16, borderRadius: 8, background: '#fffbe6', border: '1px solid #ffe58f' }}
                />
            )}

            <Form form={form} layout="vertical" disabled={!isAuthorized}>
                {renderBlockContent()}

                {/* Common Comment & Deny / RMD details */}
                {!isCustomActionStage && currentBlock !== 10 && currentBlock !== 11 && (
                    <>
                        {/* Only show RMD field for Block 3, 4, 6 where clarification is supported */}
                        {(currentBlock === 3 || currentBlock === 4 || currentBlock === 6) && (
                            <AttachableField
                                name="request_to_requester"
                                label={currentBlock === 3 ? "Detail request to requester" : "Detail Requested from Requester / Engineer (If requiring more detail)"}
                                placeholder="Explain what additional info is needed (press Ctrl+V to paste screenshot)..."
                                rows={2}
                                attachments={rmdAttachments}
                                onAttachmentsChange={setRmdAttachments}
                                blockNumber={currentBlock}
                                ecrNo={activeEcrNo}
                                ecnNo={activeEcnNo}
                            />
                        )}
                        {currentBlock !== 5 && currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9 && (
                            <Form.Item name="deny_reason" label="Reason for Denial (If denying)">
                                <TextArea rows={2} placeholder="Explain reason for denial..." />
                            </Form.Item>
                        )}
                        <AttachableField
                            name="comment"
                            label={documentType === 'ECN' && currentBlock === 5 ? "Explanation / Resubmit Notes" : "Optional Notes / Comments"}
                            placeholder={documentType === 'ECN' && currentBlock === 5 ? "Explain revisions or clarifications made (press Ctrl+V to paste screenshot)..." : "Add any notes or comments (press Ctrl+V to paste screenshot)..."}
                            rows={2}
                            attachments={commentAttachments}
                            onAttachmentsChange={setCommentAttachments}
                            blockNumber={currentBlock}
                            ecrNo={activeEcrNo}
                            ecnNo={activeEcnNo}
                        />
                    </>
                )}

                {/* Action Buttons */}
                {!isCustomActionStage && (
                    <div style={{ marginTop: 16 }}>
                        {!isAuthorized && currentBlock !== 10 ? (
                            <div style={{ width: '100%', padding: '12px 14px', background: '#f5f5f5', borderRadius: 8, border: '1px dashed #d9d9d9', textAlign: 'center' }}>
                                <Space>
                                    <LockOutlined style={{ color: '#fa8c16' }} />
                                    <Text type="secondary" style={{ fontSize: 13 }}>
                                        <strong>Viewer Mode</strong>: Action buttons restricted to ({responsibleRoleLabel})
                                    </Text>
                                </Space>
                            </div>
                        ) : currentBlock === 10 ? (
                            <Text type="secondary">
                                Use the "Sign / Acknowledge" button in the table above for your department. Once all required departments sign, the ECN will advance to Block 11 automatically.
                            </Text>
                        ) : currentBlock === 11 ? (
                            <Tooltip title="Officially Close ECN (Make Effective) and authorize production release">
                                <Button 
                                    type="primary" 
                                    size="large" 
                                    icon={<CheckCircleOutlined />}
                                    style={{ width: '100%', height: 38, background: '#52c41a', borderColor: '#52c41a', borderRadius: 8, fontWeight: 600 }}
                                    onClick={() => handleSubmit('CLOSE')} 
                                    loading={loading}
                                >
                                    Close
                                </Button>
                            </Tooltip>
                        ) : documentType === 'ECN' && currentBlock === 5 ? (
                            <Tooltip title="Resubmit ECN with revisions to Engineering Department Manager">
                                <Button 
                                    type="primary" 
                                    size="large" 
                                    icon={<CheckCircleOutlined />}
                                    onClick={() => handleSubmit('RESUBMIT')} 
                                    loading={loading}
                                    style={{ width: '100%', height: 38, borderRadius: 8, fontWeight: 600, background: '#1677ff' }}
                                >
                                    Resubmit ECN to Eng Dept Manager
                                </Button>
                            </Tooltip>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                                {/* Primary Action Button (Approve / Submit) */}
                                <Tooltip title={currentBlock === 9 ? "Submit Summary & Open Block 10 Tasks" : "Approve this stage and proceed to next stage"}>
                                    <Button 
                                        type="primary" 
                                        size="large" 
                                        icon={<CheckCircleOutlined />}
                                        onClick={() => handleSubmit('APPROVE')} 
                                        loading={loading}
                                        style={{ width: '100%', height: 38, borderRadius: 8, fontWeight: 600, background: '#1677ff' }}
                                    >
                                        {currentBlock === 9 ? 'Submit' : 'Approve'}
                                    </Button>
                                </Tooltip>
                                
                                {/* Secondary Actions Row: Deny and Require more Detail */}
                                {((currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9) || 
                                  (currentBlock === 3 || currentBlock === 4 || currentBlock === 6)) && (
                                    <Row gutter={[8, 8]} style={{ width: '100%', margin: 0 }}>
                                        {/* Require More Detail */}
                                        {(currentBlock === 3 || currentBlock === 4 || currentBlock === 6) && (
                                            <Col 
                                                span={(currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9) ? 14 : 24} 
                                                style={{ padding: 0, paddingRight: (currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9) ? 4 : 0 }}
                                            >
                                                <Tooltip title="Require more detail or revision from requester / engineer (Clarification)">
                                                    <Button 
                                                        icon={<RollbackOutlined />}
                                                        style={{ 
                                                            width: '100%', 
                                                            height: 38, 
                                                            borderRadius: 8, 
                                                            background: '#fffbe6', 
                                                            borderColor: '#fa8c16', 
                                                            color: '#d46b08', 
                                                            fontWeight: 600,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
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
                                                        Require more Detail
                                                    </Button>
                                                </Tooltip>
                                            </Col>
                                        )}

                                        {/* Deny / Terminate */}
                                        {currentBlock !== 6 && currentBlock !== 7 && currentBlock !== 8 && currentBlock !== 9 && (
                                            <Col 
                                                span={(currentBlock === 3 || currentBlock === 4 || currentBlock === 6) ? 10 : 24} 
                                                style={{ padding: 0, paddingLeft: (currentBlock === 3 || currentBlock === 4 || currentBlock === 6) ? 4 : 0 }}
                                            >
                                                <Tooltip title="Reject and terminate this change request">
                                                    <Button 
                                                        danger 
                                                        icon={<CloseCircleOutlined />}
                                                        onClick={() => handleSubmit('DENY')} 
                                                        loading={loading}
                                                        style={{ 
                                                            width: '100%', 
                                                            height: 38, 
                                                            borderRadius: 8, 
                                                            fontWeight: 500,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        Deny
                                                    </Button>
                                                </Tooltip>
                                            </Col>
                                        )}
                                    </Row>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Form>
        </Card>
    );
}

