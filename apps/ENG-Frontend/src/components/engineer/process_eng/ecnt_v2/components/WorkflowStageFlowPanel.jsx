import React, { useState, useEffect } from 'react';
import { 
    Card, Typography, Space, Tag, Button, Modal, Select, 
    Radio, Tooltip, Popconfirm, Row, Col 
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
const { Option } = Select;

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
                name: 'Teerapol Kantapoom ธีระพล ขันธภูมิ',
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
                name: 'Patcharayada Waiyaboon พัชรญาดา ไวยบุญ',
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
            antdMessage.warning("กรุณาเลือกผู้รับผิดชอบที่ต้องการเพิ่ม");
            return;
        }

        const candidate = userCandidates.find(u => u.u_code === selectedUserEmpNo);
        if (!candidate) return;

        const { assignees } = getStageAssignees(activeStageKey);

        // Check if already in list
        if (assignees.some(a => (a.emp_no || '').toLowerCase() === candidate.u_code.toLowerCase())) {
            antdMessage.info("ผู้ใช้งานนี้ได้รับมอบหมายในสเตจนี้อยู่แล้ว");
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
            antdMessage.warning("ไม่สามารถลบผู้รับผิดชอบทั้งหมดได้ ต้องมีอย่างน้อย 1 ท่าน");
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

            antdMessage.success("บันทึกการมอบหมายผู้รับผิดชอบเรียบร้อยแล้ว");
            if (onStageFlowUpdated) onStageFlowUpdated();
        } catch (err) {
            console.error("Save stage flow error:", err);
            antdMessage.error(err.response?.data?.error || "Failed to update stage assignees");
        } finally {
            setSaving(false);
        }
    };

    const renderStageCards = () => {
        if (layoutMode === 'grid') {
            return (
                <Row gutter={[12, 12]}>
                    {STAGES_CONFIG.map((stage) => {
                        const isCurrent = stage.key === currentStageKey;
                        const isAuthorized = isAuthorizedToEditStage(stage.key);
                        const { assignees, approvalRule: rule, approvedBy } = getStageAssignees(stage.key);

                        return (
                            <Col xs={24} sm={12} md={12} lg={8} xl={6} key={stage.key}>
                                <div 
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: 10,
                                        border: isCurrent ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                        boxShadow: isCurrent ? '0 4px 14px rgba(24, 144, 255, 0.15)' : 'none',
                                        padding: '10px 12px',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        height: '100%'
                                    }}
                                >
                                    {/* Stage Header: Number and Title */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Space size="small" align="center">
                                            <div style={{ 
                                                fontSize: 15, 
                                                fontWeight: 700, 
                                                color: isCurrent ? '#1890ff' : '#595959',
                                                minWidth: 18
                                            }}>
                                                {stage.number}
                                            </div>
                                            <div>
                                                <Text strong style={{ fontSize: 12, color: isCurrent ? '#1890ff' : '#262626' }}>
                                                    {stage.title}
                                                </Text>
                                            </div>
                                        </Space>

                                        {isCurrent && (
                                            <Tag color="processing" style={{ borderRadius: 10, margin: 0, fontSize: 10 }}>
                                                Active
                                            </Tag>
                                        )}
                                    </div>

                                    {/* Inner Box: Matching reference UI */}
                                    <div style={{
                                        background: '#fafafa',
                                        border: '1px solid #e8e8e8',
                                        borderRadius: 8,
                                        padding: '8px 10px',
                                        flex: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}>
                                        {/* Action Bar inside Box */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            marginBottom: 6,
                                            borderBottom: '1px solid #f0f0f0',
                                            paddingBottom: 4
                                        }}>
                                            {/* Approval Rule Tag / Pill */}
                                            {stage.isConcernMultiDept ? (
                                                <Tooltip title="Multi-Department Concern: ต้องได้รับการอนุมัติจากตัวแทนทุกแผนก (ALL) เท่านั้น">
                                                    <Tag color="purple" style={{ borderRadius: 8, margin: 0, fontSize: 10 }}>
                                                        <LockOutlined style={{ marginRight: 4 }} />
                                                        ทุกคน (ALL)
                                                    </Tag>
                                                </Tooltip>
                                            ) : (
                                                assignees.length > 1 ? (
                                                    <Tooltip title={isAuthorized ? "คลิกเพื่อสลับเกณฑ์การอนุมัติ (ANY vs ALL)" : `เกณฑ์การอนุมัติ: ${rule === 'ALL' ? 'ต้องอนุมัติครบทุกคน' : 'คนใดคนหนึ่งอนุมัติ'}`}>
                                                        <Tag 
                                                            color={rule === 'ALL' ? 'volcano' : 'blue'} 
                                                            style={{ 
                                                                borderRadius: 8, 
                                                                margin: 0, 
                                                                fontSize: 10, 
                                                                cursor: isAuthorized ? 'pointer' : 'default' 
                                                            }}
                                                            onClick={() => isAuthorized && handleToggleRule(stage.key, rule === 'ALL' ? 'ANY' : 'ALL')}
                                                        >
                                                            {rule === 'ALL' ? 'ทุกคน (ALL)' : 'คนใดคนหนึ่ง (ANY)'}
                                                            {isAuthorized && <SwapOutlined style={{ marginLeft: 4 }} />}
                                                        </Tag>
                                                    </Tooltip>
                                                ) : (
                                                    <Tag color="default" style={{ borderRadius: 8, margin: 0, fontSize: 10 }}>
                                                        คนเดียว (Single)
                                                    </Tag>
                                                )
                                            )}

                                            {/* Add Target Button */}
                                            {!stage.isConcernMultiDept && (
                                                isAuthorized ? (
                                                    <Tooltip title="เพิ่มผู้รับผิดชอบร่วมในสเตจนี้">
                                                        <Button 
                                                            type="link" 
                                                            size="small" 
                                                            icon={<PlusCircleOutlined />} 
                                                            style={{ padding: 0, fontSize: 11, height: 'auto', color: '#1890ff', fontWeight: 600 }}
                                                            onClick={() => handleOpenAddModal(stage.key)}
                                                        >
                                                            Add target
                                                        </Button>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title="เฉพาะผู้รับผิดชอบในสเตจนี้หรือ Admin เท่านั้น">
                                                        <span style={{ fontSize: 11, color: '#bfbfbf', cursor: 'not-allowed' }}>
                                                            <LockOutlined />
                                                        </span>
                                                    </Tooltip>
                                                )
                                            )}
                                        </div>

                                        {/* List of Persons */}
                                        {stage.isConcernMultiDept ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {tasksData.length > 0 ? (
                                                    tasksData.map(task => {
                                                        const isAck = task.status === 'ACKNOWLEDGED';
                                                        return (
                                                            <div 
                                                                key={task.id} 
                                                                style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'space-between',
                                                                    fontSize: 11,
                                                                    padding: '2px 0',
                                                                    borderBottom: '1px dashed #f0f0f0'
                                                                }}
                                                            >
                                                                <Space size={4}>
                                                                    <Tag color="geekblue" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>{task.dept_code}</Tag>
                                                                    <span style={{ fontSize: 11 }}>{task.approved_by_name || task.pic_name || task.dept_label}</span>
                                                                </Space>
                                                                {isAck ? (
                                                                    <Tag icon={<CheckCircleFilled />} color="success" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>
                                                                        ACK
                                                                    </Tag>
                                                                ) : (
                                                                    <Tag icon={<ClockCircleOutlined />} color="warning" style={{ margin: 0, fontSize: 9, padding: '0 3px' }}>
                                                                        PEND
                                                                    </Tag>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                                        รอการตั้งค่าแผนกใน Block 9
                                                    </Text>
                                                )}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {assignees.map((person, idx) => {
                                                    const hasApproved = approvedBy.some(ap => 
                                                        (ap.emp_no && ap.emp_no.toLowerCase() === (person.emp_no || '').toLowerCase())
                                                    );

                                                    return (
                                                        <div 
                                                            key={idx} 
                                                            style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                justifyContent: 'space-between',
                                                                fontSize: 11,
                                                                padding: '2px 0'
                                                            }}
                                                        >
                                                            <Space size={4} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                <UserOutlined style={{ color: '#595959', fontSize: 11 }} />
                                                                <span style={{ color: '#262626', fontWeight: 500, fontSize: 11 }}>
                                                                    {person.name || person.emp_no}
                                                                </span>
                                                                {person.dept && (
                                                                    <Tag color="cyan" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>
                                                                        {person.dept}
                                                                    </Tag>
                                                                )}
                                                                {rule === 'ALL' && (
                                                                    hasApproved ? (
                                                                        <Tag color="success" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>✓</Tag>
                                                                    ) : (
                                                                        <Tag color="default" style={{ fontSize: 9, margin: 0, padding: '0 3px' }}>รอ</Tag>
                                                                    )
                                                                )}
                                                            </Space>

                                                            {isAuthorized && assignees.length > 1 && (
                                                                <Popconfirm
                                                                    title="ยืนยันการนำผู้รับผิดชอบท่านนี้ออกจากสเตจ?"
                                                                    onConfirm={() => handleRemoveAssignee(stage.key, person.emp_no)}
                                                                    okText="นำออก"
                                                                    cancelText="ยกเลิก"
                                                                >
                                                                    <DeleteOutlined 
                                                                        style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 12, marginLeft: 4 }} 
                                                                        title="Remove target"
                                                                    />
                                                                </Popconfirm>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        );
                    })}
                </Row>
            );
        }

        // Vertical Layout (Sidebar mode)
        return (
            <div style={{ position: 'relative', paddingLeft: 12 }}>
                <div style={{
                    position: 'absolute',
                    top: 20,
                    bottom: 30,
                    left: 20,
                    width: 2,
                    borderLeft: '2px dashed #d9d9d9',
                    zIndex: 0
                }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', zIndex: 1 }}>
                    {STAGES_CONFIG.map((stage) => {
                        const isCurrent = stage.key === currentStageKey;
                        const isAuthorized = isAuthorizedToEditStage(stage.key);
                        const { assignees, approvalRule: rule } = getStageAssignees(stage.key);

                        return (
                            <div 
                                key={stage.key}
                                style={{
                                    background: '#ffffff',
                                    borderRadius: 10,
                                    border: isCurrent ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                    boxShadow: isCurrent ? '0 4px 14px rgba(24, 144, 255, 0.15)' : 'none',
                                    padding: '10px 14px',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Space size="middle" align="center">
                                        <div style={{ 
                                            fontSize: 18, 
                                            fontWeight: 700, 
                                            color: isCurrent ? '#1890ff' : '#262626',
                                            minWidth: 22
                                        }}>
                                            {stage.number}
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: 13, color: isCurrent ? '#1890ff' : '#262626' }}>
                                                {stage.title}
                                            </Text>
                                        </div>
                                    </Space>

                                    {isCurrent && (
                                        <Tag color="processing" style={{ borderRadius: 10, margin: 0, fontSize: 11 }}>
                                            Active Stage
                                        </Tag>
                                    )}
                                </div>

                                <div style={{
                                    background: '#fafafa',
                                    border: '1px solid #e8e8e8',
                                    borderRadius: 8,
                                    padding: '8px 12px'
                                }}>
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center', 
                                        marginBottom: 8,
                                        borderBottom: '1px solid #f0f0f0',
                                        paddingBottom: 6
                                    }}>
                                        {stage.isConcernMultiDept ? (
                                            <Tooltip title="Multi-Department Concern: ต้องได้รับการอนุมัติจากตัวแทนทุกแผนก (ALL)">
                                                <Tag color="purple" style={{ borderRadius: 8, margin: 0, fontSize: 11 }}>
                                                    <LockOutlined style={{ marginRight: 4 }} />
                                                    ทุกคน (ALL)
                                                </Tag>
                                            </Tooltip>
                                        ) : (
                                            assignees.length > 1 ? (
                                                <Tooltip title={isAuthorized ? "คลิกเพื่อสลับเกณฑ์การอนุมัติ" : `เกณฑ์การอนุมัติ: ${rule}`}>
                                                    <Tag 
                                                        color={rule === 'ALL' ? 'volcano' : 'blue'} 
                                                        style={{ borderRadius: 8, margin: 0, fontSize: 11, cursor: isAuthorized ? 'pointer' : 'default' }}
                                                        onClick={() => isAuthorized && handleToggleRule(stage.key, rule === 'ALL' ? 'ANY' : 'ALL')}
                                                    >
                                                        {rule === 'ALL' ? 'ทุกคน (ALL)' : 'คนใดคนหนึ่ง (ANY)'}
                                                        {isAuthorized && <SwapOutlined style={{ marginLeft: 4 }} />}
                                                    </Tag>
                                                </Tooltip>
                                            ) : (
                                                <Tag color="default" style={{ borderRadius: 8, margin: 0, fontSize: 11 }}>
                                                    คนเดียว (Single)
                                                </Tag>
                                            )
                                        )}

                                        {!stage.isConcernMultiDept && (
                                            isAuthorized ? (
                                                <Tooltip title="เพิ่มผู้รับผิดชอบร่วมในสเตจนี้">
                                                    <Button 
                                                        type="link" 
                                                        size="small" 
                                                        icon={<PlusCircleOutlined />} 
                                                        style={{ padding: 0, fontSize: 11, height: 'auto', color: '#1890ff', fontWeight: 600 }}
                                                        onClick={() => handleOpenAddModal(stage.key)}
                                                    >
                                                        Add target
                                                    </Button>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title="เฉพาะผู้รับผิดชอบในสเตจนี้หรือ Admin เท่านั้น">
                                                    <span style={{ fontSize: 11, color: '#bfbfbf', cursor: 'not-allowed' }}>
                                                        <LockOutlined />
                                                    </span>
                                                </Tooltip>
                                            )
                                        )}
                                    </div>

                                    {stage.isConcernMultiDept ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {tasksData.length > 0 ? (
                                                tasksData.map(task => (
                                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px dashed #f0f0f0' }}>
                                                        <Space size={6}>
                                                            <Tag color="geekblue" style={{ margin: 0, fontSize: 10 }}>{task.dept_code}</Tag>
                                                            <UserOutlined style={{ color: '#8c8c8c' }} />
                                                            <span>{task.approved_by_name || task.pic_name || task.dept_label}</span>
                                                        </Space>
                                                        {task.status === 'ACKNOWLEDGED' ? (
                                                            <Tag icon={<CheckCircleFilled />} color="success" style={{ margin: 0, fontSize: 10 }}>ACK</Tag>
                                                        ) : (
                                                            <Tag icon={<ClockCircleOutlined />} color="warning" style={{ margin: 0, fontSize: 10 }}>PENDING</Tag>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <Text type="secondary" style={{ fontSize: 12 }}>รอการตั้งค่าแผนกใน Block 9</Text>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {assignees.map((person, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                                                    <Space size={6}>
                                                        <UserOutlined style={{ color: '#595959' }} />
                                                        <span style={{ color: '#262626', fontWeight: 500 }}>{person.name || person.emp_no}</span>
                                                        {person.dept && <Tag color="cyan" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{person.dept}</Tag>}
                                                    </Space>
                                                    {isAuthorized && assignees.length > 1 && (
                                                        <Popconfirm
                                                            title="ยืนยันการนำผู้รับผิดชอบท่านนี้ออกจากสเตจ?"
                                                            onConfirm={() => handleRemoveAssignee(stage.key, person.emp_no)}
                                                            okText="นำออก"
                                                            cancelText="ยกเลิก"
                                                        >
                                                            <DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 13 }} />
                                                        </Popconfirm>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const mainContent = (
        <div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 14 }}>
                ขั้นตอนการอนุมัติและผู้รับผิดชอบในแต่ละสเตจ สามารถเพิ่มผู้รับผิดชอบร่วมและกำหนดเกณฑ์การอนุมัติได้
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
                        <span>เพิ่มผู้รับผิดชอบในสเตจ</span>
                    </Space>
                }
                open={isAddModalOpen}
                onCancel={() => setIsAddModalOpen(false)}
                onOk={handleSaveAddTarget}
                confirmLoading={saving}
                okText="บันทึกผู้รับผิดชอบ"
                cancelText="ยกเลิก"
                destroyOnClose
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 10 }}>
                    <div>
                        <Text strong>เลือกพนักงานที่ต้องการเพิ่ม:</Text>
                        <Select
                            showSearch
                            placeholder="ค้นหาด้วยรหัสพนักงาน ชื่อ หรือแผนก..."
                            style={{ width: '100%', marginTop: 8 }}
                            loading={loadingCandidates}
                            value={selectedUserEmpNo}
                            onChange={setSelectedUserEmpNo}
                            filterOption={(input, option) =>
                                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        >
                            {userCandidates.map(u => (
                                <Option key={u.u_code} value={u.u_code}>
                                    [{u.u_code}] {u.u_name} {u.u_nickname ? `(${u.u_nickname})` : ''} - {u.u_department} / {u.role || u.position}
                                </Option>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <Text strong>เกณฑ์การอนุมัติในสเตจนี้ (เมื่อมีผู้รับผิดชอบมากกว่า 1 ท่าน):</Text>
                        <div style={{ marginTop: 8 }}>
                            <Radio.Group 
                                value={approvalRule} 
                                onChange={e => setApprovalRule(e.target.value)}
                            >
                                <Space direction="vertical">
                                    <Radio value="ANY">
                                        <Text strong>คนใดคนหนึ่ง (ANY) - [ค่าเริ่มต้น]</Text>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 24 }}>
                                            หากมีผู้รับผิดชอบคนใดคนหนึ่งในสเตจนี้กดอนุมัติ ระบบจะถือว่าผ่านขั้นตอนทันที
                                        </div>
                                    </Radio>
                                    <Radio value="ALL">
                                        <Text strong>ทุกคนต้องอนุมัติ (ALL)</Text>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 24 }}>
                                            ผู้รับผิดชอบทุกคนที่กำหนดในสเตจนี้ต้องกดอนุมัติครบทุกคน ระบบจึงจะเลื่อนไปยังขั้นตอนถัดไป
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
