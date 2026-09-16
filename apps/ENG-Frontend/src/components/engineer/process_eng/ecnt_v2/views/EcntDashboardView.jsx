import React, { useState } from 'react';
import { Row, Col, Card, Typography, Input, Select, Button, Tag, Space, Radio, Badge, Tooltip, App } from 'antd';
import { 
    PlusOutlined, SearchOutlined, ClockCircleOutlined, CheckCircleOutlined, 
    ExclamationCircleOutlined, SyncOutlined, CopyOutlined, FireOutlined
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

    const combinedDocs = [
        ...ecrData.map(d => ({ ...d, doc_type: 'ECR' })),
        ...ecnData.map(d => ({ ...d, doc_type: 'ECN' }))
    ];

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

        return textMatch && deptMatch && myActionMatch;
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

            {/* 2. Control Toolbar & Responsibility Switcher */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#ffffff', 
                padding: '14px 20px', 
                borderRadius: 12, 
                border: '1px solid #e8e8e8',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                flexWrap: 'wrap',
                gap: 12
            }}>
                <Space size="middle" wrap>
                    {/* View Scope Toggle: All vs My Actions */}
                    <Radio.Group 
                        value={scopeFilter} 
                        onChange={e => setScopeFilter(e.target.value)}
                        buttonStyle="solid"
                    >
                        <Radio.Button value="ALL">
                            All Workflows ({combinedDocs.length})
                        </Radio.Button>
                        <Radio.Button value="MY_ACTIONS" style={{ fontWeight: 600 }}>
                            <Space size={4}>
                                <FireOutlined style={{ color: scopeFilter === 'MY_ACTIONS' ? '#fff' : '#fa8c16' }} />
                                <span>My Responsible Tasks</span>
                                {myActionableCount > 0 && (
                                    <Tag color={scopeFilter === 'MY_ACTIONS' ? 'orange' : 'volcano'} style={{ borderRadius: 10, margin: 0, fontSize: 10 }}>
                                        {myActionableCount}
                                    </Tag>
                                )}
                            </Space>
                        </Radio.Button>
                    </Radio.Group>

                    <Input 
                        placeholder="Search document no, customer, part, title..." 
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 260, borderRadius: 8 }}
                        allowClear
                    />
                    <Select 
                        value={filterDept} 
                        onChange={setFilterDept} 
                        style={{ width: 160, borderRadius: 8 }}
                    >
                        <Option value="ALL">All Departments</Option>
                        {departments.map(d => (
                            <Option key={d} value={d}>{d}</Option>
                        ))}
                    </Select>
                </Space>

                <Space size="middle">
                    <Button 
                        onClick={onNavigateToGantt}
                        style={{ borderRadius: 8 }}
                    >
                        📅 Timeline & Gantt
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={onNavigateToRequire}
                        style={{ borderRadius: 8, background: '#1890ff' }}
                    >
                        Initiate New ECR
                    </Button>
                </Space>
            </div>

            {/* Notification Banner when My Actions is selected */}
            {scopeFilter === 'MY_ACTIONS' && (
                <div style={{ 
                    background: '#fffbe6', 
                    border: '1px solid #ffe58f', 
                    borderRadius: 10, 
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Space>
                        <FireOutlined style={{ color: '#fa8c16', fontSize: 16 }} />
                        <Text strong style={{ color: '#d46b08' }}>
                            Showing {filteredDocs.length} task(s) currently awaiting your action or department review.
                        </Text>
                    </Space>
                    <Button size="small" type="link" onClick={() => setScopeFilter('ALL')}>
                        Show All Tasks
                    </Button>
                </div>
            )}

            {/* 3. Stage Kanban Board */}
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

        </div>
    );
}

