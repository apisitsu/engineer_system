import React, { useState, useEffect } from 'react';
import { 
    Card, Typography, Space, Tag, Button, Modal, Select, 
    Radio, Tooltip, Popconfirm
} from 'antd';
import { App } from 'antd';
import { 
    UserOutlined, PlusCircleOutlined, DeleteOutlined, 
    CheckCircleFilled, ClockCircleOutlined, LockOutlined,
    TeamOutlined, SwapOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';

const { Text } = Typography;

// Standard Stage Definitions for the Linear Stepper
const STAGES_CONFIG = [
    { key: 'STAGE_1', number: 1, title: 'Requester', block: 1, docPhase: 'ECR', defaultRole: 'Requester' },
    { key: 'STAGE_2', number: 2, title: 'Department Manager', block: 3, docPhase: 'ECR', defaultRole: 'Dept Manager' },
    { key: 'STAGE_3', number: 3, title: 'Engineering Dept Manager', block: 4, docPhase: 'ECR', defaultRole: 'Eng. Dept Manager' },
    { key: 'STAGE_4', number: 4, title: 'Person in charge (Assigned Engineer)', block: 4, docPhase: 'ECR_ECN', defaultRole: 'Eng. Assigned' },
    { key: 'STAGE_5', number: 5, title: 'Eng Dept Mgr (ECN Review)', block: 6, docPhase: 'ECN', defaultRole: 'Eng. Dept Manager' },
    { key: 'STAGE_6', number: 6, title: 'QC MSA Evaluator', block: 7, docPhase: 'ECN', defaultRole: 'QC MSA' },
    { key: 'STAGE_7', number: 7, title: 'QC FAI Evaluator', block: 8, docPhase: 'ECN', defaultRole: 'QC FAI' },
    { key: 'STAGE_8', number: 8, title: 'Lead Engineer (Summary & Tasks Setup)', block: 9, docPhase: 'ECN', defaultRole: 'Eng. Assigned' },
    { key: 'STAGE_9', number: 9, title: 'Multi-Department Concern Approvals', block: 10, docPhase: 'ECN', isConcernMultiDept: true },
    { key: 'STAGE_10', number: 10, title: 'Plant Executive / Official Close', block: 11, docPhase: 'ECN', defaultRole: 'Eng. Dept Manager / Top' }
];

export default function WorkflowStageFlowPanel({
    documentType,
    documentId,
    docData,
    tasksData = [],
    systemConfig = {},
    layoutMode = 'grid',
    bordered = true,
    onStageFlowUpdated
}) {
    const { message: antdMessage } = App.useApp();
    const { empNo, userName, userRole, userDepartment } = useAuthStore();

    const [userCandidates, setUserCandidates] = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);

    // Add Target Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeStageKey, setActiveStageKey] = useState(null);
    const [selectedUserEmpNo, setSelectedUserEmpNo] = useState(null);
    const [approvalRule, setApprovalRule] = useState('ANY'); // 'ANY' | 'ALL'
    const [saving, setSaving] = useState(false);

    const cleanEmpNo = (empNo || localStorage.getItem('u_code') || '').toLowerCase();
    const cleanRole = (userRole || localStorage.getItem('role') || '').toUpperCase();
    const cleanDept = (userDepartment || localStorage.getItem('u_department') || '').toUpperCase();
    const cleanName = (userName || localStorage.getItem('u_name') || '').toLowerCase();

    // Admin Check
    const systemAdmins = (systemConfig?.system_admins || ['admin', 'eng_mgr']).map(a => String(a).toLowerCase());
    const isAdmin = cleanRole === 'AD' || cleanDept === 'AD' || systemAdmins.includes(cleanEmpNo);

    // Fetch Candidates (excluding Admin nickname)
    const fetchUserCandidates = async () => {
        setLoadingCandidates(true);
        try {
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const res = await axios.get(`${baseUrl}/api/ecnt/user-candidates`);
            if (res.data?.data) {
                // Filter out any user with nickname admin
                const list = res.data.data.filter(u => (u.u_nickname || '').toLowerCase() !== 'admin');
                setUserCandidates(list);
            }
        } catch (err) {
            console.error("Fetch candidates error:", err);
        } finally {
            setLoadingCandidates(false);
        }
    };

    useEffect(() => {
        fetchUserCandidates();
    }, []);

    const stageAssigneesCfg = systemConfig?.stage_assignees || {};

    // Get assigned persons for a stage (merging docData.stage_flow with default mapping)
    const getStageAssignees = (stageKey) => {
        const saved = docData?.stage_flow?.[stageKey];
        if (saved?.assignees && saved.assignees.length > 0) {
            return {
                assignees: saved.assignees,
                approvalRule: saved.approval_rule || 'ANY',
                approvedBy: saved.approved_by || []
            };
        }

        // Default fallbacks based on stage
        let defaultList = [];
        if (stageKey === 'STAGE_1') {
            defaultList = [{
                emp_no: docData?.request_by || 'requester',
                name: docData?.request_by_name || docData?.request_by || 'Requester',
                dept: docData?.department || 'ENG',
                role: 'Requester'
            }];
        } else if (stageKey === 'STAGE_2') {
            const deptMgr = stageAssigneesCfg?.dept_mgr_mapping?.[docData?.department];
            defaultList = [deptMgr || {
                emp_no: 'dept_mgr',
                name: `${docData?.department || 'Dept'} Manager`,
                dept: docData?.department,
                role: 'MGR'
            }];
        } else if (stageKey === 'STAGE_3' || stageKey === 'STAGE_5') {
            defaultList = [stageAssigneesCfg?.eng_mgr || {
                emp_no: 'eng_mgr',
                name: 'Teerapol Kantapoom',
                dept: 'ENG',
                role: 'MGR'
            }];
        } else if (stageKey === 'STAGE_4') {
            defaultList = [{
                emp_no: docData?.assigned_to || 'eng_assigned',
                name: docData?.assigned_to || 'NATHAPORN YAMMANUS',
                dept: 'ENG',
                role: 'PE'
            }];
        } else if (stageKey === 'STAGE_6' || stageKey === 'STAGE_7') {
            defaultList = [stageAssigneesCfg?.default_qc_pic || {
                emp_no: 'qc_admin',
                name: 'Patcharayada Waiyaboon',
                dept: 'QC',
                role: 'QC'
            }];
        } else if (stageKey === 'STAGE_8') {
            defaultList = [{
                emp_no: docData?.engineer_assigned || docData?.assigned_to || 'eng_assigned',
                name: docData?.engineer_assigned || docData?.assigned_to || 'NATHAPORN YAMMANUS',
                dept: 'ENG',
                role: 'PE'
            }];
        } else if (stageKey === 'STAGE_10') {
            defaultList = [
                stageAssigneesCfg?.eng_mgr || { emp_no: 'eng_mgr', name: 'Teerapol Kantapoom', dept: 'ENG', role: 'MGR' }
            ];
        }

        return {
            assignees: defaultList,
            approvalRule: 'ANY',
            approvedBy: []
        };
    };

    // Check if logged-in user is authorized to edit a stage's PICs
    const isAuthorizedToEditStage = (stageKey) => {
        if (isAdmin) return true;
        if (stageKey === 'STAGE_9') return false; // Concern tasks cannot be customized

        const { assignees } = getStageAssignees(stageKey);
        return assignees.some(a => 
            (a.emp_no && a.emp_no.toLowerCase() === cleanEmpNo) ||
            (a.name && a.name.toLowerCase() === cleanName)
        );
    };

    // Determine current active stage index
    const getCurrentStageKey = () => {
        const code = docData?.current_stage_code || '';
        if (code.includes('STAGE_1')) return 'STAGE_1';
        if (code.includes('STAGE_2')) return 'STAGE_2';
        if (code.includes('STAGE_3')) return 'STAGE_3';
        if (code.includes('STAGE_4')) return 'STAGE_4';
        if (code.includes('STAGE_5')) return 'STAGE_5';
        if (code.includes('STAGE_6')) return 'STAGE_6';
        if (code.includes('STAGE_7')) return 'STAGE_7';
        if (code.includes('STAGE_8')) return 'STAGE_8';
        if (code.includes('STAGE_9')) return 'STAGE_9';
        if (code.includes('STAGE_10')) return 'STAGE_10';
        return 'STAGE_1';
    };

    const currentStageKey = getCurrentStageKey();

    // Open Add Target Modal
    const handleOpenAddModal = (stageKey) => {
        setActiveStageKey(stageKey);
        const { approvalRule: currentRule } = getStageAssignees(stageKey);
        setApprovalRule(currentRule);
        setSelectedUserEmpNo(null);
        setIsAddModalOpen(true);
    };

    // Save New Target Assignee
    const handleSaveAddTarget = async () => {
        if (!selectedUserEmpNo) {
            antdMessage.warning("Please select an assignee to add");
            return;
        }

        const candidate = userCandidates.find(u => u.u_code === selectedUserEmpNo);
        if (!candidate) return;

        const { assignees } = getStageAssignees(activeStageKey);

        // Check if already in list
        if (assignees.some(a => (a.emp_no || '').toLowerCase() === candidate.u_code.toLowerCase())) {
            antdMessage.info("This user is already assigned to this stage");
            return;
        }

        const newAssignee = {
            emp_no: candidate.u_code,
            name: `${candidate.u_name} ${candidate.u_nickname ? `(${candidate.u_nickname})` : ''}`,
            dept: candidate.u_department,
            role: candidate.role || candidate.position || ''
        };

        const updatedAssignees = [...assignees, newAssignee];

        await saveStageFlowUpdate(activeStageKey, updatedAssignees, approvalRule);
        setIsAddModalOpen(false);
    };

    // Remove Assignee
    const handleRemoveAssignee = async (stageKey, empNoToRemove) => {
        const { assignees, approvalRule: currentRule } = getStageAssignees(stageKey);
        if (assignees.length <= 1) {
            antdMessage.warning("Cannot remove all assignees. At least 1 assignee is required.");
            return;
        }

        const updatedAssignees = assignees.filter(a => (a.emp_no || '').toLowerCase() !== empNoToRemove.toLowerCase());
        await saveStageFlowUpdate(stageKey, updatedAssignees, currentRule);
    };

    // Toggle Approval Rule (ANY vs ALL)
    const handleToggleRule = async (stageKey, newRule) => {
        const { assignees } = getStageAssignees(stageKey);
        await saveStageFlowUpdate(stageKey, assignees, newRule);
    };

    // Dispatch API Call to Backend
    const saveStageFlowUpdate = async (stageKey, assignees, rule) => {
        setSaving(true);
        try {
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const token = localStorage.getItem("token");
            const authConfig = {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            };

            await axios.put(`${baseUrl}/api/ecnt/stage-flow/${documentType}/${documentId}`, {
                stageKey,
                assignees,
                approval_rule: rule
            }, authConfig);

            antdMessage.success("Stage assignees updated successfully");
            if (onStageFlowUpdated) onStageFlowUpdated();
        } catch (err) {
            console.error("Save stage flow error:", err);
            antdMessage.error(err.response?.data?.error || "Failed to update stage assignees");
        } finally {
            setSaving(false);
        }
    };

    const renderStageCards = () => {
        // Determine stage status for each stage
        const currentStageIndex = STAGES_CONFIG.findIndex(s => s.key === currentStageKey);
        const isCompleted = (docData?.process_status || '').toLowerCase().includes('effective') ||
                            (docData?.process_status || '').toLowerCase().includes('closed');

        if (layoutMode === 'grid') {
            return (
                <div style={{ position: 'relative', paddingLeft: 8 }}>
                    {STAGES_CONFIG.map((stage, idx) => {
                        const stageIndex = idx;
                        const isCurrent = stage.key === currentStageKey;
                        const isPast = isCompleted ? true : stageIndex < currentStageIndex;
                        const isFuture = !isPast && !isCurrent;
                        const isAuthorized = isAuthorizedToEditStage(stage.key);
                        const { assignees, approvalRule: rule, approvedBy } = getStageAssignees(stage.key);
                        const isLast = idx === STAGES_CONFIG.length - 1;

                        // Color scheme based on state
                        const nodeColor = isPast ? '#52c41a' : isCurrent ? '#1677ff' : '#d9d9d9';
                        const nodeBg = isPast ? '#f6ffed' : isCurrent ? '#e6f4ff' : '#fafafa';
                        const borderColor = isPast ? '#b7eb8f' : isCurrent ? '#91caff' : '#d9d9d9';
                        const titleColor = isPast ? '#389e0d' : isCurrent ? '#1677ff' : '#8c8c8c';

                        return (
                            <div key={stage.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                                {/* Left: Number circle + vertical connector line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                                    {/* Number Circle */}
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: nodeBg,
                                        border: `2px solid ${nodeColor}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: nodeColor,
                                        flexShrink: 0,
                                        boxShadow: isCurrent ? `0 0 0 4px rgba(22,119,255,0.12)` : 'none',
                                        zIndex: 1,
                                        position: 'relative',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {isPast ? <CheckCircleFilled style={{ fontSize: 16, color: '#52c41a' }} /> : stage.number}
                                    </div>
                                    {/* Vertical connector line */}
                                    {!isLast && (
                                        <div style={{
                                            width: 2,
                                            flex: 1,
                                            minHeight: 20,
                                            background: isPast
                                                ? 'linear-gradient(to bottom, #52c41a, #b7eb8f)'
                                                : isCurrent
                                                    ? 'linear-gradient(to bottom, #1677ff, #d9d9d9)'
                                                    : '#e8e8e8',
                                            margin: '2px 0'
                                        }} />
                                    )}
                                </div>

                                {/* Right: Stage Card */}
                                <div style={{
                                    flex: 1,
                                    marginLeft: 12,
                                    marginBottom: isLast ? 0 : 12,
                                    background: '#ffffff',
                                    borderRadius: 10,
                                    border: `1.5px solid ${borderColor}`,
                                    boxShadow: isCurrent ? '0 4px 14px rgba(22, 119, 255, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                                    padding: '10px 14px',
                                    transition: 'all 0.2s ease',
                                    opacity: isFuture ? 0.65 : 1
                                }}>
                                    {/* Stage Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <Text strong style={{ fontSize: 13, color: titleColor, display: 'block' }}>
                                                {stage.title}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>
                                                Block {stage.block} · {stage.docPhase}
                                            </Text>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {isPast && !isCurrent && (
                                                <Tag color="success" style={{ margin: 0, fontSize: 10, borderRadius: 10 }}>
                                                    ✓ Done
                                                </Tag>
                                            )}
                                            {isCurrent && (
                                                <Tag color="processing" style={{ margin: 0, fontSize: 10, borderRadius: 10 }}>
                                                    ● Active
                                                </Tag>
                                            )}
                                            {isFuture && (
                                                <Tag color="default" style={{ margin: 0, fontSize: 10, borderRadius: 10, color: '#8c8c8c' }}>
                                                    Pending
                                                </Tag>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inner assignees box */}
                                    <div style={{
                                        background: nodeBg,
                                        border: `1px solid ${borderColor}`,
                                        borderRadius: 8,
                                        padding: '8px 10px'
                                    }}>
                                        {/* Action Bar */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            marginBottom: 6,
                                            borderBottom: '1px solid rgba(0,0,0,0.06)',
                                            paddingBottom: 4
                                        }}>
                                            {/* Approval Rule Tag */}
                                            {stage.isConcernMultiDept ? (
                                                <Tooltip title="Multi-Department Concern: Requires approval from all department representatives (ALL)">
                                                    <Tag color="purple" style={{ borderRadius: 8, margin: 0, fontSize: 10 }}>
                                                        <LockOutlined style={{ marginRight: 4 }} />Everyone (ALL)
                                                    </Tag>
                                                </Tooltip>
                                            ) : (
                                                assignees.length > 1 ? (
                                                    <Tooltip title={isAuthorized ? "Click to switch approval rule (ANY vs ALL)" : `Approval Rule: ${rule === 'ALL' ? 'All must approve' : 'Any single can approve'}`}>
                                                        <Tag 
                                                            color={rule === 'ALL' ? 'volcano' : 'blue'} 
                                                            style={{ borderRadius: 8, margin: 0, fontSize: 10, cursor: isAuthorized ? 'pointer' : 'default' }}
                                                            onClick={() => isAuthorized && handleToggleRule(stage.key, rule === 'ALL' ? 'ANY' : 'ALL')}
                                                        >
                                                            {rule === 'ALL' ? 'Everyone (ALL)' : 'Any (ANY)'}
                                                            {isAuthorized && <SwapOutlined style={{ marginLeft: 4 }} />}
                                                        </Tag>
                                                    </Tooltip>
                                                ) : (
                                                    <Tag color="default" style={{ borderRadius: 8, margin: 0, fontSize: 10 }}>Single Assignee</Tag>
                                                )
                                            )}

                                            {/* Add Target Button */}
                                            {!stage.isConcernMultiDept && (
                                                isAuthorized ? (
                                                    <Tooltip title="Add co-assignee to this stage">
                                                        <Button 
                                                            type="link" 
                                                            size="small" 
                                                            icon={<PlusCircleOutlined />} 
                                                            style={{ padding: 0, fontSize: 11, height: 'auto', color: '#1677ff', fontWeight: 600 }}
                                                            onClick={() => handleOpenAddModal(stage.key)}
                                                        >
                                                            Add target
                                                        </Button>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="Only stage assignees or System Admin can modify">
                                                        <span style={{ fontSize: 11, color: '#bfbfbf', cursor: 'not-allowed' }}>
                                                            <LockOutlined />
                                                        </span>
                                                    </Tooltip>
                                                )
                                            )}
                                        </div>

                                        {/* Persons List */}
                                        {stage.isConcernMultiDept ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {tasksData.length > 0 ? (
                                                    tasksData.map(task => {
                                                        const isAck = task.status === 'ACKNOWLEDGED';
                                                        return (
                                                            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', borderBottom: '1px dashed rgba(0,0,0,0.06)' }}>
                                                                <Space size={4}>
                                                                    <Tag color="geekblue" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>{task.dept_code}</Tag>
                                                                    <span>{task.approved_by_name || task.pic_name || task.dept_label}</span>
                                                                </Space>
                                                                {isAck ? (
                                                                    <Tag icon={<CheckCircleFilled />} color="success" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>ACK</Tag>
                                                                ) : (
                                                                    <Tag icon={<ClockCircleOutlined />} color="warning" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>PEND</Tag>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        Awaiting department task configuration in Block 9
                                                    </Text>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {assignees.map((person, pidx) => {
                                                    const hasApproved = approvedBy.some(ap => 
                                                        (ap.emp_no && ap.emp_no.toLowerCase() === (person.emp_no || '').toLowerCase())
                                                    );
                                                    return (
                                                        <div key={pidx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                                                            <Space size={4} style={{ overflow: 'hidden' }}>
                                                                <UserOutlined style={{ color: titleColor, fontSize: 11 }} />
                                                                <span style={{ color: '#262626', fontWeight: 500, fontSize: 11 }}>
                                                                    {person.name || person.emp_no}
                                                                </span>
                                                                {person.dept && (
                                                                    <Tag color="cyan" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>{person.dept}</Tag>
                                                                )}
                                                                {rule === 'ALL' && (
                                                                    hasApproved
                                                                        ? <Tag color="success" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>✓ Approved</Tag>
                                                                        : <Tag color="default" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>Pending</Tag>
                                                                )}
                                                            </Space>
                                                            {isAuthorized && assignees.length > 1 && (
                                                                <Popconfirm
                                                                    title="Are you sure you want to remove this assignee from the stage?"
                                                                    onConfirm={() => handleRemoveAssignee(stage.key, person.emp_no)}
                                                                    okText="Remove"
                                                                    cancelText="Cancel"
                                                                >
                                                                    <DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 12, marginLeft: 4 }} title="Remove target" />
                                                                </Popconfirm>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }
    };

    const mainContent = (
        <div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 14 }}>
                Workflow approval stages and designated owners. You can delegate co-assignees and configure approval rules.
            </div>
            {renderStageCards()}
        </div>
    );

    return (
        <div>
            {bordered ? (
                <Card 
                    title={
                        <Space>
                            <TeamOutlined style={{ color: '#1890ff' }} />
                            <span style={{ fontWeight: 600 }}>Workflow Approval & Stage PICs</span>
                        </Space>
                    }
                    size="small"
                    style={{ 
                        borderRadius: 12, 
                        border: '1px solid #e8e8e8', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        marginBottom: 16
                    }}
                >
                    {mainContent}
                </Card>
            ) : (
                mainContent
            )}

            {/* Add Target Modal */}
            <Modal
                title={
                    <Space>
                        <PlusCircleOutlined style={{ color: '#1890ff' }} />
                        <span>Assign Co-PIC to Stage</span>
                    </Space>
                }
                open={isAddModalOpen}
                onCancel={() => setIsAddModalOpen(false)}
                onOk={handleSaveAddTarget}
                confirmLoading={saving}
                okText="Save Assignee"
                cancelText="Cancel"
                destroyOnClose
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
                    <div>
                        <Text strong>Select Personnel to Assign:</Text>
                        <Select
                            showSearch
                            placeholder="Search by Emp ID, name, or department..."
                            style={{ width: '100%', marginTop: 8 }}
                            loading={loadingCandidates}
                            value={selectedUserEmpNo}
                            onChange={setSelectedUserEmpNo}
                            filterOption={(input, option) => {
                                const searchStr = (option?.label ?? '').toLowerCase();
                                return searchStr.includes(input.toLowerCase());
                            }}
                            options={userCandidates.map(u => ({
                                key: u.u_code,
                                value: u.u_code,
                                label: `[${u.u_code}] ${u.u_name} ${u.u_nickname ? `(${u.u_nickname})` : ''} - ${u.u_department} / ${u.role || u.position}`
                            }))}
                        />
                    </div>

                    <div>
                        <Text strong>Stage Approval Rule (When multiple assignees are designated):</Text>
                        <div style={{ marginTop: 8 }}>
                            <Radio.Group 
                                value={approvalRule} 
                                onChange={e => setApprovalRule(e.target.value)}
                            >
                                <Space direction="vertical">
                                    <Radio value="ANY">
                                        <Text strong>Any Single Assignee (ANY) - [Default]</Text>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 24 }}>
                                            When any one designated assignee approves, the stage automatically advances.
                                        </div>
                                    </Radio>
                                    <Radio value="ALL">
                                        <Text strong>All Must Approve (ALL)</Text>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 24 }}>
                                            Every designated assignee must approve before advancing to the next stage.
                                        </div>
                                    </Radio>
                                </Space>
                            </Radio.Group>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
