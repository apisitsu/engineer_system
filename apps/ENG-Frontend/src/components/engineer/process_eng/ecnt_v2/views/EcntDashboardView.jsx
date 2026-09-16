import React, { useState } from 'react';
import { Row, Col, Card, Typography, Input, Select, Button, Tag, Space } from 'antd';
import { 
    PlusOutlined, SearchOutlined, ClockCircleOutlined, CheckCircleOutlined, 
    ExclamationCircleOutlined, SyncOutlined 
} from '@ant-design/icons';
import moment from 'moment';
import StatusBadge from '../components/StatusBadge';

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
    onOpenDoc,
    onNavigateToRequire,
    onNavigateToGantt
}) {
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState('ALL');

    const combinedDocs = [
        ...ecrData.map(d => ({ ...d, doc_type: 'ECR' })),
        ...ecnData.map(d => ({ ...d, doc_type: 'ECN' }))
    ];

    // Filter documents
    const filteredDocs = combinedDocs.filter(d => {
        const textMatch = !searchText || 
            (d.ecr_no && d.ecr_no.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.ecn_no && d.ecn_no.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.title_of_change && d.title_of_change.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.request_by_name && d.request_by_name.toLowerCase().includes(searchText.toLowerCase())) ||
            (d.customer_name && d.customer_name.toLowerCase().includes(searchText.toLowerCase()));

        const deptMatch = filterDept === 'ALL' || d.department === filterDept;
        return textMatch && deptMatch;
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
    const pendingMyAction = (myTasks.ecrTasks?.length || 0) + (myTasks.ecnTasks?.length || 0);
    const inClarification = combinedDocs.filter(d => (d.process_status || '').toLowerCase() === 'require more detail' || (d.current_stage_code || '').includes('_R')).length;
    const totalEffective = combinedDocs.filter(d => d.process_status === 'ECN Effective' || d.process_status === 'ECR Only Closed').length;

    // Unique departments
    const departments = Array.from(new Set(combinedDocs.map(d => d.department).filter(Boolean)));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* 1. Executive Metrics & KPI Bar */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Card style={{ borderRadius: 12, border: '1px solid #e8e8e8', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
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
                    <Card style={{ borderRadius: 12, border: '1px solid #ffd591', background: pendingMyAction > 0 ? '#fffbe6' : '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 13 }}>Awaiting My Action</Text>
                                <Title level={2} style={{ margin: 0, color: '#fa8c16' }}>{pendingMyAction}</Title>
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

            {/* 2. Control Toolbar */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                background: '#ffffff', 
                padding: '12px 18px', 
                borderRadius: 12, 
                border: '1px solid #e8e8e8' 
            }}>
                <Space size="middle" wrap>
                    <Input 
                        placeholder="Search document no, customer, part, title..." 
                        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{ width: 280, borderRadius: 8 }}
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
                        📅 View Gantt Chart Timeline
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

            {/* 3. Stage Kanban Board */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, minmax(240px, 1fr))', 
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

                                        return (
                                            <Card 
                                                key={`${doc.doc_type}_${doc.id}`}
                                                size="small"
                                                hoverable
                                                onClick={() => onOpenDoc(doc.id, doc.doc_type)}
                                                style={{ 
                                                    borderRadius: 8, 
                                                    border: isRework ? '1px solid #ffd591' : '1px solid #e8e8e8',
                                                    background: isRework ? '#fffbe6' : '#ffffff',
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                                                    cursor: 'pointer'
                                                }}
                                            >
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

                                                <Paragraph 
                                                    ellipsis={{ rows: 2 }} 
                                                    style={{ fontSize: 12, margin: '6px 0', color: '#434343', fontWeight: 500 }}
                                                >
                                                    {doc.title_of_change || 'No title specified'}
                                                </Paragraph>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px solid #f0f0f0', fontSize: 11, color: '#8c8c8c' }}>
                                                    <span>{doc.request_by_name || 'Requester'} ({doc.department})</span>
                                                    <span>{moment(doc.created_at).format('DD-MMM')}</span>
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
