import React, { useState } from 'react';
import { 
    Row, Col, Card, Typography, Input, Select, Button, Tag, Space, 
    Badge, Tooltip, App, Table, Segmented, Avatar, Dropdown 
} from 'antd';
import { 
    PlusOutlined, SearchOutlined, ClockCircleOutlined, CheckCircleOutlined, 
    ExclamationCircleOutlined, SyncOutlined, CopyOutlined, FireOutlined,
    TableOutlined, AppstoreOutlined, ArrowRightOutlined, UserOutlined,
    FilterOutlined, DownOutlined, CalendarOutlined, TeamOutlined,
    ApartmentOutlined, CheckCircleFilled, FileTextOutlined,
    BankOutlined, ToolOutlined, CodeOutlined, SettingOutlined
} from '@ant-design/icons';
import moment from 'moment';
import StatusBadge from '../components/StatusBadge';
import { useAuthStore } from '../../../../../stores/authStore';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const KANBAN_COLS = [
    { key: 'draft_rmd', title: '1. Rework / Clarification', color: '#fa8c16', bg: '#fffbe6' },
    { key: 'dept_mgr', title: '2. Dept Mgr Review', color: '#722ed1', bg: '#f9f0ff' },
    { key: 'eng_mgr', title: '3. Eng Mgr Review', color: '#13c2c2', bg: '#e6fffb' },
    { key: 'ecn_prep', title: '4. ECN Formulation', color: '#2f54eb', bg: '#f0f5ff' },
    { key: 'qc_eval', title: '5. QC MSA & FAI', color: '#eb2f96', bg: '#fff0f6' },
    { key: 'concern_ack', title: '6. Concern Sign-off', color: '#faad14', bg: '#fffbe6' },
    { key: 'effective', title: '7. Effective / Closed', color: '#52c41a', bg: '#f6ffed' },
];

export default function EcntDashboardView({ 
    ecrData = [], 
    ecnData = [], 
    myTasks = { ecrTasks: [], ecnTasks: [] },
    systemConfig = {},
    onOpenDoc,
    onNavigateToRequire,
    onNavigateToGantt
}) {
    const { message: antdMessage } = App.useApp();
    const { empNo, userName, userRole, userDepartment, position } = useAuthStore();

    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState('ALL');
    const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'MY_ACTIONS'
    const [viewMode, setViewMode] = useState('pipeline'); // 'pipeline' (Default) | 'kanban'
    const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'ECR' | 'ECN' | 'REWORK' | 'EFFECTIVE'
    const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

    const combinedDocs = [
        ...ecrData.map(d => ({ ...d, doc_type: 'ECR' })),
        ...ecnData.map(d => ({ ...d, doc_type: 'ECN' }))
    ];

    // Helper: Determine current stage and assigned PIC info for display
    const getStageAndPicInfo = (doc, cfg) => {
        const isEcr = doc.doc_type === 'ECR';
        const blk = doc.current_block || 1;
        const st = (doc.process_status || '').toLowerCase();
        const stage = doc.current_stage_code || '';
        const isRework = st === 'require more detail' || stage.includes('_R');

        if (st.includes('effective') || st.includes('closed')) {
            return {
                stageTag: 'Closed / Effective',
                color: 'green',
                pics: [{ name: 'Completed' }]
            };
        }
        if (st === 'denied') {
            return {
                stageTag: 'Denied / Rejected',
                color: 'red',
                pics: [{ name: 'Closed' }]
            };
        }
        if (isRework) {
            return {
                stageTag: 'Rework / Clarification',
                color: 'volcano',
                pics: [{ name: doc.request_by_name || doc.request_by || 'Requester' }]
            };
        }

        // Check stage_flow
        const flow = doc.stage_flow || {};
        let stageKey = 'STAGE_1';
        if (isEcr) {
            if (blk === 1 || blk === 2) stageKey = 'STAGE_1';
            else if (blk === 3) stageKey = 'STAGE_2';
            else if (blk === 4) stageKey = 'STAGE_3';
        } else {
            if (blk === 5) stageKey = 'STAGE_4';
            else if (blk === 6) stageKey = 'STAGE_5';
            else if (blk === 7) stageKey = 'STAGE_6';
            else if (blk === 8) stageKey = 'STAGE_7';
            else if (blk === 9) stageKey = 'STAGE_8';
            else if (blk === 10) stageKey = 'STAGE_9';
            else if (blk === 11) stageKey = 'STAGE_10';
        }

        const flowData = flow[stageKey];
        if (flowData?.assignees && flowData.assignees.length > 0) {
            return {
                stageTag: `Block ${blk}`,
                color: 'blue',
                pics: flowData.assignees,
                rule: flowData.approval_rule || 'ANY'
            };
        }

        // Standard fallbacks based on Block
        if (isEcr) {
            if (blk <= 2) {
                return {
                    stageTag: `Block 1-2: ECR Draft`,
                    color: 'default',
                    pics: [{ name: doc.request_by_name || doc.request_by || 'Requester' }]
                };
            }
            if (blk === 3) {
                const deptMgr = cfg?.stage_assignees?.dept_mgr_mapping?.[doc.department];
                return {
                    stageTag: `Block 3: Dept Mgr Review`,
                    color: 'purple',
                    pics: [{ name: deptMgr?.name || `Manager (${doc.department})` }]
                };
            }
            if (blk === 4) {
                const engMgr = cfg?.stage_assignees?.eng_mgr;
                return {
                    stageTag: `Block 4: Eng Mgr Assignment`,
                    color: 'cyan',
                    pics: [{ name: engMgr?.name || 'Engineering Manager' }]
                };
            }
        } else {
            if (blk === 5) {
                return {
                    stageTag: `Block 5: ECN Formulation`,
                    color: 'blue',
                    pics: [{ name: doc.engineer_assigned_name || doc.assigned_to || doc.engineer_assigned || 'Lead Engineer' }]
                };
            }
            if (blk === 6) {
                const engMgr = cfg?.stage_assignees?.eng_mgr;
                return {
                    stageTag: `Block 6: Eng Mgr ECN Review`,
                    color: 'cyan',
                    pics: [{ name: engMgr?.name || 'Engineering Manager' }]
                };
            }
            if (blk === 7) {
                const qcPIC = cfg?.stage_assignees?.default_qc_pic;
                return {
                    stageTag: `Block 7: QC MSA Evaluation`,
                    color: 'magenta',
                    pics: [{ name: qcPIC?.name || 'QC Evaluator' }]
                };
            }
            if (blk === 8) {
                const qcPIC = cfg?.stage_assignees?.default_qc_pic;
                return {
                    stageTag: `Block 8: QC FAI Evaluation`,
                    color: 'magenta',
                    pics: [{ name: qcPIC?.name || 'QC Evaluator' }]
                };
            }
            if (blk === 9) {
                return {
                    stageTag: `Block 9: Tasks Setup`,
                    color: 'blue',
                    pics: [{ name: doc.engineer_assigned_name || doc.assigned_to || 'Lead Engineer' }]
                };
            }
            if (blk === 10) {
                return {
                    stageTag: `Block 10: Concern Sign-offs`,
                    color: 'orange',
                    pics: [{ name: 'Multi-Dept (QA, QC, PC, PD, MC, MM)' }],
                    rule: 'ALL'
                };
            }
            if (blk === 11) {
                return {
                    stageTag: `Block 11: Official Close`,
                    color: 'green',
                    pics: [{ name: 'Plant Executive / Eng Mgr' }]
                };
            }
        }

        return {
            stageTag: `Block ${blk}`,
            color: 'default',
            pics: [{ name: doc.assigned_to || 'Pending' }]
        };
    };

    // Determine why a task is pending for the logged-in user
    const getMyActionReason = (doc) => {
        const isEcr = doc.doc_type === 'ECR';
        const isEcn = doc.doc_type === 'ECN';
        const blk = doc.current_block || 1;
        const st = (doc.process_status || '').toLowerCase();
        const stage = doc.current_stage_code || '';
        const isRework = st === 'require more detail' || stage.includes('_R');

        // 1. Rework / Clarification -> Requester is responsible
        if (isRework) {
            if (doc.request_by === empNo || doc.request_by_name === userName || (!doc.request_by && userRole === 'AD')) {
                return 'Revision Required (Requester)';
            }
            if (isEcn && (doc.engineer_assigned === empNo || userDepartment === 'ENG' || userRole === 'AD')) {
                return 'ECN Revision Required';
            }
        }

        // 2. ECR Block 3: Dept Mgr Review
        if (isEcr && blk === 3 && (st.includes('dept mgr') || stage === 'STAGE_2')) {
            const deptMgrAssignee = systemConfig?.stage_assignees?.dept_mgr_mapping?.[doc.department];
            if (
                (deptMgrAssignee && deptMgrAssignee.emp_no === empNo) ||
                (userDepartment === doc.department && (userRole === 'MGR' || userRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')))) ||
                userRole === 'AD'
            ) {
                return 'Dept Mgr Approval Required';
            }
        }

        // 3. ECR Block 4: Eng Mgr Review & Assignment
        if (isEcr && blk === 4 && (st.includes('eng mgr') || stage === 'STAGE_3')) {
            const engMgrAssignee = systemConfig?.stage_assignees?.eng_mgr;
            if (
                (engMgrAssignee && engMgrAssignee.emp_no === empNo) ||
                (userDepartment === 'ENG' && (userRole === 'MGR' || userRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')))) ||
                userRole === 'AD'
            ) {
                return 'Eng Mgr Assignment Required';
            }
        }

        // 4. ECR Block 4 approved -> Issue ECN (Block 5)
        if (isEcr && (st === 'issued ecn' || stage === 'STAGE_4') && !doc.linked_ecn_id) {
            if (doc.engineer_assigned === empNo || userDepartment === 'ENG' || userRole === 'AD') {
                return 'ECN Formulation Required';
            }
        }

        // 5. ECN Block 5: Formulation
        if (isEcn && blk === 5 && (doc.engineer_assigned === empNo || userDepartment === 'ENG' || userRole === 'AD')) {
            return 'ECN Formulation Required';
        }

        // 6. ECN Block 6: Eng Mgr ECN Review
        if (isEcn && blk === 6) {
            if (
                (userDepartment === 'ENG' && (userRole === 'MGR' || userRole === 'MANAGER' || (position && position.toLowerCase().includes('mgr')))) ||
                userRole === 'AD'
            ) {
                return 'Eng Mgr ECN Review Required';
            }
        }

        // 7. ECN Block 7 & 8: QC MSA & FAI
        if (isEcn && (blk === 7 || blk === 8)) {
            if (
                userDepartment === 'QC' ||
                userRole === 'QC' ||
                (systemConfig?.stage_assignees?.default_qc_pic?.emp_no === empNo) ||
                userRole === 'AD'
            ) {
                return 'QC MSA/FAI Evaluation Required';
            }
        }

        // 8. ECN Block 9: Concern setup
        if (isEcn && blk === 9) {
            if (doc.engineer_assigned === empNo || userDepartment === 'ENG' || userRole === 'AD') {
                return 'Concern Setup Required';
            }
        }

        // 9. ECN Block 10: Concern Acknowledgements
        if (isEcn && blk === 10) {
            const inMyTasks = (myTasks?.ecnTasks || []).some(t => t.id === doc.id);
            if (inMyTasks || userRole === 'AD') {
                return 'Concern Sign-off Required';
            }
        }

        // 10. ECN Block 11: Official Close
        if (isEcn && blk === 11 && (st.includes('close') || stage === 'STAGE_10')) {
            if (userDepartment === 'ENG' || userRole === 'AD') {
                return 'Final Release & Close Required';
            }
        }

        // Check backend myTasks queue
        if (isEcr && (myTasks?.ecrTasks || []).some(t => t.id === doc.id)) {
            return 'Action Pending';
        }
        if (isEcn && (myTasks?.ecnTasks || []).some(t => t.id === doc.id)) {
            return 'Action Pending';
        }

        return null;
    };

    // Filter documents
    const filteredDocs = combinedDocs.filter(d => {
        const textMatch = !searchText || 
            (d.ecr_no && d.ecr_no.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.ecn_no && d.ecn_no.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.title_of_change && d.title_of_change.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.request_by_name && d.request_by_name.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.customer_name && d.customer_name.toLowerCase().includes(searchText.toLowerCase()));

        const deptMatch = filterDept === 'ALL' || d.department === filterDept;
        const myActionMatch = scopeFilter === 'ALL' || getMyActionReason(d) !== null;

        const isRework = (d.process_status || '').toLowerCase() === 'require more detail' || (d.current_stage_code || '').includes('_R');
        const isEffective = d.process_status === 'ECN Effective' || d.process_status === 'ECR Only Closed' || d.process_status === 'Denied';
        const isEcrPhase = d.doc_type === 'ECR' && (d.current_block || 1) <= 4 && !isEffective;
        const isEcnPhase = (d.doc_type === 'ECN' || d.process_status === 'Issued ECN') && !isEffective;

        const categoryMatch = 
            categoryFilter === 'ALL' ||
            (categoryFilter === 'ECR_PHASE' && isEcrPhase) ||
            (categoryFilter === 'ECN_PHASE' && isEcnPhase) ||
            (categoryFilter === 'REWORK' && isRework) ||
            (categoryFilter === 'EFFECTIVE' && isEffective);

        return textMatch && deptMatch && myActionMatch && categoryMatch;
    });

    // Classify into Kanban columns
    const getDocColumn = (doc) => {
        const st = (doc.process_status || '').toLowerCase();
        const stage = doc.current_stage_code || '';
        const blk = doc.current_block || 1;

        if (st.includes('effective') || st.includes('closed') || st === 'denied') return 'effective';
        if (st === 'require more detail' || stage.includes('_R')) return 'draft_rmd';
        if (doc.doc_type === 'ECR' && blk === 3) return 'dept_mgr';
        if (doc.doc_type === 'ECR' && blk === 4) return 'eng_mgr';
        if (doc.doc_type === 'ECN' && (blk === 5 || blk === 6)) return 'ecn_prep';
        if (doc.doc_type === 'ECN' && (blk === 7 || blk === 8)) return 'qc_eval';
        if (doc.doc_type === 'ECN' && (blk === 9 || blk === 10 || blk === 11)) return 'concern_ack';
        return 'draft_rmd';
    };

    // Metrics
    const totalActive = combinedDocs.filter(d => !['ECR Only Closed', 'ECN Effective', 'Denied'].includes(d.process_status)).length;
    const myActionableCount = combinedDocs.filter(d => !['ECR Only Closed', 'ECN Effective', 'Denied'].includes(d.process_status) && getMyActionReason(d) !== null).length;
    const inClarification = combinedDocs.filter(d => (d.process_status || '').toLowerCase() === 'require more detail' || (d.current_stage_code || '').includes('_R')).length;
    const totalEffective = combinedDocs.filter(d => d.process_status === 'ECN Effective' || d.process_status === 'ECR Only Closed').length;

    const countAll = combinedDocs.length;
    const countEcrPhase = combinedDocs.filter(d => d.doc_type === 'ECR' && (d.current_block || 1) <= 4 && !['ECR Only Closed', 'Denied'].includes(d.process_status)).length;
    const countEcnPhase = combinedDocs.filter(d => (d.doc_type === 'ECN' || d.process_status === 'Issued ECN') && !['ECN Effective', 'Denied'].includes(d.process_status)).length;

    // Unique departments
    const departments = Array.from(new Set(combinedDocs.map(d => d.department).filter(Boolean)));

    const handleCopyLink = (e, doc) => {
        e.stopPropagation();
        const directUrl = `${window.location.origin}/eng/process_eng/ecnt_v2?docType=${doc.doc_type}&id=${doc.id}&view=workspace`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(directUrl).then(() => {
                antdMessage.success(`Link for ${doc.ecr_no || doc.ecn_no || doc.doc_type + ' #' + doc.id} copied! Ready to share.`);
            }).catch(() => fallbackCopy(directUrl, doc));
        } else {
            fallbackCopy(directUrl, doc);
        }
    };

    const fallbackCopy = (text, doc) => {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            antdMessage.success(`Link for ${doc.ecr_no || doc.ecn_no || doc.doc_type + ' #' + doc.id} copied! Ready to share.`);
        } catch(err) {
            antdMessage.info(`URL: ${text}`);
        }
    };

    // Executive Pipeline Table Columns (Strict Max 3 lines per row per user requirement)
    const pipelineColumns = [
        {
            title: 'Document No. / Type',
            key: 'doc_no',
            width: 170,
            fixed: 'left',
            render: (_, record) => {
                const isEcr = record.doc_type === 'ECR';
                const docNo = record.ecr_no || record.ecn_no || `${record.doc_type} #${record.id}`;
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Line 1: Type Badge & Clickable Doc No */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <Tag color={isEcr ? 'blue' : 'purple'} style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4, padding: '0 5px' }}>
                                {record.doc_type}
                            </Tag>
                            <Text strong style={{ color: '#1677ff', fontSize: 13, cursor: 'pointer' }} onClick={() => onOpenDoc(record.id, record.doc_type)}>
                                {docNo}
                            </Text>
                        </div>
                        {/* Line 2: Date & Optional Linked Reference */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, color: '#8c8c8c' }}>
                            <span>📅 {moment(record.created_at).format('DD-MMM-YYYY')}</span>
                            {record.linked_ecn_id && (
                                <Tag color="geekblue" style={{ margin: 0, fontSize: 10, borderRadius: 4, padding: '0 4px' }}>
                                    🔗 ECN #{record.linked_ecn_id}
                                </Tag>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Title of Change & Technical Details',
            dataIndex: 'title_of_change',
            key: 'title_of_change',
            render: (text, record) => {
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {/* Line 1: Title (single line with ellipsis) */}
                        <Text 
                            strong 
                            ellipsis 
                            style={{ fontSize: 13, color: '#1f1f1f', maxWidth: 360, display: 'block' }} 
                            title={text}
                        >
                            {text || 'No title specified'}
                        </Text>
                        {/* Line 2: Customer & Project with Icons & Tooltips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {record.customer_name && (
                                <Tooltip title={`Customer: ${record.customer_name}`}>
                                    <Tag color="cyan" icon={<BankOutlined />} style={{ margin: 0, fontSize: 11, borderRadius: 4, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {record.customer_name}
                                    </Tag>
                                </Tooltip>
                            )}
                            {record.project_code && (
                                <Tooltip title={`Project / Model: ${record.project_code}`}>
                                    <Tag color="geekblue" icon={<AppstoreOutlined />} style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>
                                        {record.project_code}
                                    </Tag>
                                </Tooltip>
                            )}
                        </div>
                        {/* Line 3: Category Icons with Tooltips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {record.status_type && (
                                <Tooltip title={`Lifecycle: ${record.status_type}`}>
                                    <Tag color={record.status_type === 'TEMPORARY' ? 'orange' : 'default'} style={{ margin: 0, fontSize: 10, borderRadius: 4 }}>
                                        {record.status_type === 'TEMPORARY' ? 'Temp' : 'Perm'}
                                    </Tag>
                                </Tooltip>
                            )}
                            {record.is_drawing && (
                                <Tooltip title="Drawing Modification (DWG)">
                                    <Tag color="blue" icon={<FileTextOutlined />} style={{ margin: 0, fontSize: 10, borderRadius: 4, cursor: 'help' }}>DWG</Tag>
                                </Tooltip>
                            )}
                            {record.is_tooling && (
                                <Tooltip title="Tooling Modification (Tool)">
                                    <Tag color="green" icon={<ToolOutlined />} style={{ margin: 0, fontSize: 10, borderRadius: 4, cursor: 'help' }}>Tool</Tag>
                                </Tooltip>
                            )}
                            {record.is_program && (
                                <Tooltip title="CNC Program Modification (Prog)">
                                    <Tag color="orange" icon={<CodeOutlined />} style={{ margin: 0, fontSize: 10, borderRadius: 4, cursor: 'help' }}>Prog</Tag>
                                </Tooltip>
                            )}
                            {record.is_usage && (
                                <Tooltip title="Usage & Setup Sheet Modification (Usage)">
                                    <Tag color="magenta" icon={<SettingOutlined />} style={{ margin: 0, fontSize: 10, borderRadius: 4, cursor: 'help' }}>Usage</Tag>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Requester & Dept',
            dataIndex: 'request_by_name',
            key: 'request_by_name',
            width: 150,
            render: (text, record) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Line 1: Avatar + Requester Name */}
                    <Space size={6}>
                        <Avatar size={20} style={{ backgroundColor: '#1677ff', fontSize: 11, flexShrink: 0 }}>
                            {(text || record.request_by || 'U')[0]?.toUpperCase()}
                        </Avatar>
                        <Text strong ellipsis style={{ fontSize: 12, maxWidth: 110 }}>
                            {text || record.request_by || 'Requester'}
                        </Text>
                    </Space>
                    {/* Line 2: Department Tag */}
                    <div>
                        <Tag color="blue" style={{ margin: 0, fontSize: 10, borderRadius: 4, padding: '0 6px' }}>
                            {record.department || 'ENG'}
                        </Tag>
                    </div>
                </div>
            )
        },
        {
            title: 'Current Stage & PIC Responsibility',
            key: 'current_stage',
            width: 230,
            render: (_, record) => {
                const stageInfo = getStageAndPicInfo(record, systemConfig);
                const actionReason = getMyActionReason(record);
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {/* Line 1: Stage Tag */}
                        <div>
                            <Tag color={stageInfo.color} style={{ margin: 0, fontSize: 11, borderRadius: 4, fontWeight: 600 }}>
                                {stageInfo.stageTag}
                            </Tag>
                        </div>

                        {/* Line 2: PIC Responsibility Pills */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            {(stageInfo.pics || []).slice(0, 2).map((p, idx) => (
                                <Tag 
                                    key={idx} 
                                    icon={<UserOutlined />} 
                                    color="default" 
                                    style={{ margin: 0, fontSize: 11, background: '#fafafa', border: '1px solid #e8e8e8', borderRadius: 4, padding: '0 5px' }}
                                >
                                    {p.name || p.emp_no}
                                </Tag>
                            ))}
                            {stageInfo.rule && (stageInfo.pics || []).length > 1 && (
                                <Tag color={stageInfo.rule === 'ALL' ? 'purple' : 'blue'} style={{ margin: 0, fontSize: 10, borderRadius: 10 }}>
                                    {stageInfo.rule}
                                </Tag>
                            )}
                        </div>

                        {/* Line 3: Pending Action Callout if applicable */}
                        {actionReason && (
                            <div style={{
                                background: '#fff2e8',
                                border: '1px solid #ffbb96',
                                color: '#d4380d',
                                padding: '1px 6px',
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                width: 'fit-content'
                            }}>
                                <FireOutlined style={{ color: '#fa541c', fontSize: 11 }} />
                                <span>{actionReason}</span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Status',
            dataIndex: 'process_status',
            key: 'process_status',
            width: 120,
            render: (status) => <StatusBadge status={status} />
        },
        {
            title: 'Action',
            key: 'action',
            width: 80,
            fixed: 'right',
            align: 'center',
            render: (_, record) => {
                const actionReason = getMyActionReason(record);
                return (
                    <Space size={4} style={{ padding: '0 4px' }}>
                        <Tooltip title={actionReason ? `Action Required: ${actionReason}` : 'Open Workspace'}>
                            <Button 
                                type={actionReason ? "primary" : "default"}
                                shape="circle"
                                size="small"
                                icon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenDoc(record.id, record.doc_type);
                                }}
                                style={{ 
                                    width: 28,
                                    height: 28,
                                    minWidth: 28,
                                    background: actionReason ? '#fa8c16' : '#1677ff',
                                    borderColor: actionReason ? '#fa8c16' : '#1677ff',
                                    color: '#ffffff',
                                    boxShadow: actionReason ? '0 1px 4px rgba(250, 140, 22, 0.35)' : '0 1px 4px rgba(22, 119, 255, 0.25)'
                                }}
                            />
                        </Tooltip>
                        <Tooltip title="Share Direct Link">
                            <Button 
                                shape="circle"
                                size="small"
                                icon={<CopyOutlined style={{ fontSize: 11 }} />}
                                onClick={(e) => handleCopyLink(e, record)}
                                style={{ width: 28, height: 28, minWidth: 28 }}
                            />
                        </Tooltip>
                    </Space>
                );
            }
        }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* 1. Executive Metrics & KPI Bar */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Card 
                        hoverable 
                        onClick={() => setScopeFilter('ALL')}
                        style={{ 
                            borderRadius: 12, 
                            border: scopeFilter === 'ALL' ? '2px solid #1890ff' : '1px solid #e8e8e8', 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 13 }}>Active Workflows</Text>
                                <Title level={2} style={{ margin: 0, color: '#1890ff' }}>{totalActive}</Title>
                            </div>
                            <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 12 }}>
                                <SyncOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <Card 
                        hoverable 
                        onClick={() => setScopeFilter('MY_ACTIONS')}
                        style={{ 
                            borderRadius: 12, 
                            border: scopeFilter === 'MY_ACTIONS' ? '2px solid #fa8c16' : '1px solid #ffd591', 
                            background: myActionableCount > 0 ? '#fffbe6' : '#fff', 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Space size={4}>
                                    <Text type="secondary" style={{ fontSize: 13 }}>Pending My Action</Text>
                                    {myActionableCount > 0 && <Badge count="Action" style={{ backgroundColor: '#fa8c16', fontSize: 10 }} />}
                                </Space>
                                <Title level={2} style={{ margin: 0, color: '#fa8c16' }}>{myActionableCount}</Title>
                            </div>
                            <div style={{ background: '#fff7e6', padding: 12, borderRadius: 12 }}>
                                <ClockCircleOutlined style={{ fontSize: 24, color: '#fa8c16' }} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 13 }}>In Clarification / Rework</Text>
                                <Title level={2} style={{ margin: 0, color: '#fa541c' }}>{inClarification}</Title>
                            </div>
                            <div style={{ background: '#fff2e8', padding: 12, borderRadius: 12 }}>
                                <ExclamationCircleOutlined style={{ fontSize: 24, color: '#fa541c' }} />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 13 }}>Closed & Effective</Text>
                                <Title level={2} style={{ margin: 0, color: '#52c41a' }}>{totalEffective}</Title>
                            </div>
                            <div style={{ background: '#f6ffed', padding: 12, borderRadius: 12 }}>
                                <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* 2. Compact Control Toolbar with Icon Dropdowns & Tooltips */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#ffffff', 
                padding: '10px 16px', 
                borderRadius: 12, 
                border: '1px solid #e8e8e8',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                flexWrap: 'wrap',
                gap: 10
            }}>
                {/* Left: Scope, Search, Dept & Category Dropdown */}
                <Space size="small" wrap align="center">
                    {/* View Scope Toggle: All vs My Actions */}
                    <Segmented
                        value={scopeFilter}
                        onChange={(val) => {
                            setScopeFilter(val);
                            setPagination(prev => ({ ...prev, current: 1 }));
                        }}
                        options={[
                            {
                                value: 'ALL',
                                label: (
                                    <Tooltip title={`All Workflows in system (${combinedDocs.length})`}>
                                        <Space size={4}>
                                            <TeamOutlined />
                                            <span>All ({combinedDocs.length})</span>
                                        </Space>
                                    </Tooltip>
                                )
                            },
                            {
                                value: 'MY_ACTIONS',
                                label: (
                                    <Tooltip title="Tasks pending my personal action or department review">
                                        <Space size={4}>
                                            <FireOutlined style={{ color: '#fa8c16' }} />
                                            <span>My Tasks</span>
                                            {myActionableCount > 0 && (
                                                <Badge count={myActionableCount} size="small" style={{ backgroundColor: '#fa8c16' }} />
                                            )}
                                        </Space>
                                    </Tooltip>
                                )
                            }
                        ]}
                    />

                    {/* Category Filter Dropdown (Icon Dropdown per User Request) */}
                    <Dropdown
                        menu={{
                            items: [
                                { key: 'ALL', label: `All Active Workflows (${countAll})`, icon: <CheckCircleOutlined /> },
                                { key: 'ECR_PHASE', label: `ECR Evaluation Phase (${countEcrPhase})`, icon: <FileTextOutlined style={{ color: '#1677ff' }} /> },
                                { key: 'ECN_PHASE', label: `ECN Execution Phase (${countEcnPhase})`, icon: <FileTextOutlined style={{ color: '#722ed1' }} /> },
                                { key: 'REWORK', label: `Clarification & Rework (${inClarification})`, icon: <ExclamationCircleOutlined style={{ color: '#fa8c16' }} /> },
                                { key: 'EFFECTIVE', label: `Completed & Effective (${totalEffective})`, icon: <CheckCircleFilled style={{ color: '#52c41a' }} /> },
                            ],
                            onClick: (e) => {
                                setCategoryFilter(e.key);
                                setPagination(prev => ({ ...prev, current: 1 }));
                            },
                            selectedKeys: [categoryFilter]
                        }}
                    >
                        <Tooltip title="Filter documents by Category or Lifecycle Phase">
                            <Button icon={<FilterOutlined style={{ color: categoryFilter !== 'ALL' ? '#1677ff' : undefined }} />}>
                                <Space size={4}>
                                    <span>
                                        {categoryFilter === 'ALL' && `All Workflows (${countAll})`}
                                        {categoryFilter === 'ECR_PHASE' && `ECR Phase (${countEcrPhase})`}
                                        {categoryFilter === 'ECN_PHASE' && `ECN Phase (${countEcnPhase})`}
                                        {categoryFilter === 'REWORK' && `Rework (${inClarification})`}
                                        {categoryFilter === 'EFFECTIVE' && `Effective (${totalEffective})`}
                                    </span>
                                    <DownOutlined style={{ fontSize: 10, color: '#8c8c8c' }} />
                                </Space>
                            </Button>
                        </Tooltip>
                    </Dropdown>

                    {/* Search Input */}
                    <Input 
                        placeholder="Search no, title, customer..." 
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchText}
                        onChange={e => {
                            setSearchText(e.target.value);
                            setPagination(prev => ({ ...prev, current: 1 }));
                        }}
                        style={{ width: 220, borderRadius: 8 }}
                        allowClear
                    />

                    {/* Department Filter */}
                    <Select 
                        value={filterDept} 
                        onChange={(val) => {
                            setFilterDept(val);
                            setPagination(prev => ({ ...prev, current: 1 }));
                        }} 
                        style={{ width: 150, borderRadius: 8 }}
                        suffixIcon={<ApartmentOutlined />}
                    >
                        <Option value="ALL">All Depts</Option>
                        {departments.map(d => (
                            <Option key={d} value={d}>{d}</Option>
                        ))}
                    </Select>
                </Space>

                {/* Right: View Switcher, Timeline & New ECR Action */}
                <Space size="small" wrap align="center">
                    {/* View Mode Switcher: Pipeline Table vs Kanban (Icons with Tooltips) */}
                    <Segmented
                        value={viewMode}
                        onChange={setViewMode}
                        options={[
                            {
                                value: 'pipeline',
                                label: (
                                    <Tooltip title="Executive Pipeline Table View (Default)">
                                        <Space size={4} style={{ padding: '0 4px' }}>
                                            <TableOutlined style={{ fontSize: 15 }} />
                                            <span style={{ fontSize: 12 }}>Table</span>
                                        </Space>
                                    </Tooltip>
                                )
                            },
                            {
                                value: 'kanban',
                                label: (
                                    <Tooltip title="7-Stage Kanban Board View">
                                        <Space size={4} style={{ padding: '0 4px' }}>
                                            <AppstoreOutlined style={{ fontSize: 15 }} />
                                            <span style={{ fontSize: 12 }}>Kanban</span>
                                        </Space>
                                    </Tooltip>
                                )
                            }
                        ]}
                    />

                    {/* Timeline & Gantt Tool */}
                    <Tooltip title="Timeline & Projected Gantt Chart">
                        <Button 
                            icon={<CalendarOutlined />}
                            onClick={onNavigateToGantt}
                            style={{ borderRadius: 8 }}
                        />
                    </Tooltip>

                    {/* Initiate New ECR */}
                    <Tooltip title="Initiate New Engineering Change Request (ECR)">
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={onNavigateToRequire}
                            style={{ borderRadius: 8, background: '#1677ff' }}
                        >
                            New ECR
                        </Button>
                    </Tooltip>
                </Space>
            </div>

            {/* Notification Banner when My Actions is selected */}
            {scopeFilter === 'MY_ACTIONS' && (
                <div style={{ 
                    background: '#fffbe6', 
                    border: '1px solid #ffe58f', 
                    borderRadius: 10, 
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Space>
                        <FireOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                        <Text strong style={{ color: '#d46b08', fontSize: 13 }}>
                            Showing {filteredDocs.length} task(s) currently awaiting your action or department review.
                        </Text>
                    </Space>
                    <Button size="small" type="link" onClick={() => setScopeFilter('ALL')}>
                        Show All Tasks
                    </Button>
                </div>
            )}

            {/* 3A. Executive Pipeline Table View (Default View) */}
            {viewMode === 'pipeline' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Header info bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Showing <strong>{filteredDocs.length}</strong> of {combinedDocs.length} documents
                        </Text>
                    </div>

                    {/* Responsive Pipeline Table */}
                    <Card 
                        bodyStyle={{ padding: 0 }}
                        style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
                    >
                        <Table 
                            columns={pipelineColumns} 
                            dataSource={filteredDocs} 
                            rowKey={r => `${r.doc_type}_${r.id}`}
                            scroll={{ x: 1080 }}
                            pagination={{ 
                                current: pagination.current,
                                pageSize: pagination.pageSize,
                                showSizeChanger: true, 
                                pageSizeOptions: ['10', '20', '50', '100'],
                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} documents`,
                                onChange: (page, pageSize) => {
                                    setPagination({ current: page, pageSize });
                                }
                            }}
                            onRow={(record) => {
                                const actionReason = getMyActionReason(record);
                                return {
                                    onClick: () => onOpenDoc(record.id, record.doc_type),
                                    style: { 
                                        cursor: 'pointer',
                                        background: actionReason ? '#fffdfa' : undefined,
                                        transition: 'background 0.2s ease'
                                    }
                                };
                            }}
                            locale={{
                                emptyText: (
                                    <div style={{ padding: '40px 0', textAlign: 'center' }}>
                                        <Text type="secondary">No documents matching your search or filters.</Text>
                                    </div>
                                )
                            }}
                        />
                    </Card>
                </div>
            )}

            {/* 3B. Stage Kanban Board (Secondary View) */}
            {viewMode === 'kanban' && (
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(7, minmax(250px, 1fr))', 
                    gap: 14, 
                    overflowX: 'auto', 
                    paddingBottom: 16 
                }}>
                {KANBAN_COLS.map(col => {
                    const cards = filteredDocs.filter(d => getDocColumn(d) === col.key);

                    return (
                        <div 
                            key={col.key}
                            style={{ 
                                background: '#f8f9fa', 
                                borderRadius: 12, 
                                border: '1px solid #e8e8e8', 
                                padding: 12,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 480
                            }}
                        >
                            {/* Column Header */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                marginBottom: 12, 
                                paddingBottom: 8, 
                                borderBottom: `2px solid ${col.color}` 
                            }}>
                                <Text strong style={{ fontSize: 13, color: '#262626' }}>{col.title}</Text>
                                <Tag color={col.color} style={{ borderRadius: 10, margin: 0 }}>{cards.length}</Tag>
                            </div>

                            {/* Cards Stream */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto' }}>
                                {cards.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#bfbfbf', fontSize: 12 }}>
                                        No documents
                                    </div>
                                ) : (
                                    cards.map(doc => {
                                        const isRework = (doc.process_status || '').toLowerCase() === 'require more detail' || (doc.current_stage_code || '').includes('_R');
                                        const actionReason = getMyActionReason(doc);

                                        return (
                                            <Card 
                                                key={`${doc.doc_type}_${doc.id}`}
                                                size="small"
                                                hoverable
                                                onClick={() => onOpenDoc(doc.id, doc.doc_type)}
                                                style={{ 
                                                    borderRadius: 8, 
                                                    border: actionReason ? '1.5px solid #fa8c16' : (isRework ? '1px solid #ffd591' : '1px solid #e8e8e8'),
                                                    background: actionReason ? '#fffdfa' : (isRework ? '#fffbe6' : '#ffffff'),
                                                    boxShadow: actionReason ? '0 2px 8px rgba(250, 140, 22, 0.12)' : '0 1px 4px rgba(0,0,0,0.03)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {/* Top Tag & Status */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                    <Space size={4}>
                                                        <Tag color={doc.doc_type === 'ECR' ? 'blue' : 'purple'} style={{ margin: 0, fontSize: 10 }}>
                                                            {doc.doc_type}
                                                        </Tag>
                                                        <Text strong style={{ fontSize: 13, color: '#1890ff' }}>
                                                            {doc.ecr_no || doc.ecn_no || `#${doc.id}`}
                                                        </Text>
                                                    </Space>
                                                    <StatusBadge status={doc.process_status} />
                                                </div>

                                                {/* Personal Action Highlight Banner */}
                                                {actionReason && (
                                                    <div style={{ 
                                                        background: '#fff2e8', 
                                                        border: '1px solid #ffbb96', 
                                                        color: '#d4380d', 
                                                        padding: '3px 8px', 
                                                        borderRadius: 6, 
                                                        fontSize: 11, 
                                                        fontWeight: 600,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        margin: '6px 0'
                                                    }}>
                                                        <FireOutlined style={{ color: '#fa541c' }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {actionReason}
                                                        </span>
                                                    </div>
                                                )}

                                                <Paragraph 
                                                    ellipsis={{ rows: 2 }} 
                                                    style={{ fontSize: 12, margin: '6px 0', color: '#434343', fontWeight: 500 }}
                                                >
                                                    {doc.title_of_change || 'No title specified'}
                                                </Paragraph>

                                                {/* Requester & Date */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#8c8c8c' }}>
                                                    <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {doc.request_by_name || 'Requester'} ({doc.department})
                                                    </span>
                                                    <span>{moment(doc.created_at).format('DD-MMM')}</span>
                                                </div>

                                                {/* Direct Link Share Footer */}
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, paddingTop: 4 }}>
                                                    <Tooltip title="Copy Direct URL Link to share via email/chat">
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            icon={<CopyOutlined />} 
                                                            onClick={(e) => handleCopyLink(e, doc)}
                                                            style={{ fontSize: 11, color: '#1890ff', padding: '0 4px', height: 22 }}
                                                        >
                                                            Copy Link
                                                        </Button>
                                                    </Tooltip>
                                                </div>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
            )}

        </div>
    );
}

