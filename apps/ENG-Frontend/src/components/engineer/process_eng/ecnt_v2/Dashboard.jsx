import React, { useState, useEffect } from "react";
import { Layout, Spin, Table, Button, Tooltip, Tabs, Segmented, Card, Tag, Badge, Row, Col, Typography, Space } from 'antd';
import { EyeOutlined, PlusOutlined, AppstoreOutlined, TableOutlined, CheckCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import StatusBadge from './components/StatusBadge';
import CreateECRModal from './CreateECRModal';
import CreateECNModal from './CreateECNModal';
import ECNDetailModal from './ECNDetailModal';
import { useAuthStore } from '../../../../stores/authStore';

const { Content } = Layout;
const { Text, Title } = Typography;

const KANBAN_STAGES = [
    { key: 'draft_rmd', title: '1. Draft / Re-work', color: '#faad14' },
    { key: 'dept_mgr', title: '2. Dept Mgr Review', color: '#1890ff' },
    { key: 'eng_mgr_ecr', title: '3. Eng Mgr ECR', color: '#722ed1' },
    { key: 'ecn_review', title: '4. ECN In Progress', color: '#13c2c2' },
    { key: 'qc_eval', title: '5. QC MSA & FAI', color: '#eb2f96' },
    { key: 'concern_ack', title: '6. Concern Ack', color: '#fa8c16' },
    { key: 'effective', title: '7. Effective / Closed', color: '#52c41a' },
];

export default function Dashboard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [ecrData, setEcrData] = useState([]);
    const [ecnData, setEcnData] = useState([]);
    const [myTasks, setMyTasks] = useState({ ecrTasks: [], ecnTasks: [] });
    
    const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isCreateEcnOpen, setIsCreateEcnOpen] = useState(false);
    const [selectedEcrForEcn, setSelectedEcrForEcn] = useState(null);
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [selectedDocType, setSelectedDocType] = useState('ECR');

    const { userName } = useAuthStore();

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resEcr, resEcn, resMyTasks] = await Promise.all([
                axios.get(`${server.URL}/api/ecnt/ecr`, { withCredentials: true }),
                axios.get(`${server.URL}/api/ecnt/ecn`, { withCredentials: true }),
                axios.get(`${server.URL}/api/ecnt/my-tasks`, { withCredentials: true })
            ]);
            setEcrData(resEcr.data.data || []);
            setEcnData(resEcn.data.data || []);
            setMyTasks(resMyTasks.data || { ecrTasks: [], ecnTasks: [] });
        } catch (error) {
            console.error("Fetch Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openDetail = (id, type) => {
        setSelectedDocId(id);
        setSelectedDocType(type);
        setIsDetailOpen(true);
    };

    const openCreateEcn = (ecr) => {
        setSelectedEcrForEcn(ecr);
        setIsCreateEcnOpen(true);
    };

    // Classify document into a Kanban stage
    const getDocStage = (doc, type) => {
        const st = (doc.process_status || '').toLowerCase();
        const blk = doc.current_block || 1;

        if (st.includes('effective') || st.includes('closed') || st === 'denied') return 'effective';
        if (st === 'require more detail' || st === 'draft') return 'draft_rmd';
        if (type === 'ECR' && blk === 3) return 'dept_mgr';
        if (type === 'ECR' && (blk === 4 || st === 'issued ecn')) return 'eng_mgr_ecr';
        if (type === 'ECN' && (blk === 5 || blk === 6)) return 'ecn_review';
        if (type === 'ECN' && (blk === 7 || blk === 8)) return 'qc_eval';
        if (type === 'ECN' && (blk === 9 || blk === 10 || blk === 11)) return 'concern_ack';
        return 'draft_rmd';
    };

    const combinedDocs = [
        ...ecrData.map(d => ({ ...d, doc_type: 'ECR' })),
        ...ecnData.map(d => ({ ...d, doc_type: 'ECN' }))
    ];

    const ecrColumns = [
        {
            title: 'ECR No.',
            dataIndex: 'ecr_no',
            key: 'ecr_no',
            render: text => <strong>{text || '-'}</strong>
        },
        {
            title: 'Title',
            dataIndex: 'title_of_change',
            key: 'title',
            ellipsis: true
        },
        {
            title: 'Customer / Project',
            key: 'cust',
            render: (_, r) => (
                <span>{r.customer_name || '-'}{r.project_code ? ` / ${r.project_code}` : ''}</span>
            )
        },
        {
            title: 'Objective',
            dataIndex: 'objective',
            key: 'objective',
            render: text => <Tag>{text}</Tag>
        },
        {
            title: 'Status',
            dataIndex: 'process_status',
            key: 'status',
            render: text => <StatusBadge status={text} />
        },
        {
            title: 'Requester',
            dataIndex: 'request_by_name',
            key: 'request_by',
            render: (text, r) => `${text || r.request_by} (${r.department || ''})`
        },
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'date',
            render: text => moment(text).format('DD-MMM-YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Space>
                    <Tooltip title="View & Act">
                        <Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => openDetail(record.id, 'ECR')} />
                    </Tooltip>
                    {record.process_status === 'Issued ECN' && !record.linked_ecn_id && (
                        <Tooltip title="Create ECN">
                            <Button size="small" type="primary" style={{ background: '#52c41a' }} onClick={() => openCreateEcn(record)}>
                                + ECN
                            </Button>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];
    
    const ecnColumns = [
        {
            title: 'ECN No.',
            dataIndex: 'ecn_no',
            key: 'ecn_no',
            render: text => <strong>{text || '-'}</strong>
        },
        {
            title: 'Linked ECR',
            dataIndex: 'ecr_no',
            key: 'ecr_no',
            render: (text, r) => text || `ECR #${r.ecr_id}`
        },
        {
            title: 'Title of Change',
            dataIndex: 'title_of_change',
            key: 'title',
            ellipsis: true
        },
        {
            title: 'Eng. Assigned',
            dataIndex: 'engineer_assigned',
            key: 'eng',
            render: text => <Tag color="purple">{text}</Tag>
        },
        {
            title: 'Status',
            dataIndex: 'process_status',
            key: 'status',
            render: text => <StatusBadge status={text} />
        },
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'date',
            render: text => moment(text).format('DD-MMM-YYYY')
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View & Act">
                    <Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => openDetail(record.id, 'ECN')} />
                </Tooltip>
            ),
        },
    ];

    const totalMyTasks = (myTasks.ecrTasks?.length || 0) + (myTasks.ecnTasks?.length || 0);

    return (
        <Spin tip="Loading ECNT V2 Data..." size="large" spinning={loading}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '20px' }}>
                <div style={{ background: theme.colors.surface, borderRadius: '8px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    
                    {/* Top Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 38 }} />
                            <div>
                                <h1 style={{ margin: 0, color: theme.colors.text, fontSize: '22px' }}>
                                    Engineering Change System V2 (11-Block Approval)
                                </h1>
                                <span style={{ color: theme.colors.textSecondary, fontSize: 13 }}>
                                    Welcome, {userName || 'Engineer'} | Track and process ECRs & ECNs across all 11 workflow stages
                                </span>
                            </div>
                        </div>

                        <Space size="middle">
                            <Segmented
                                options={[
                                    { label: 'Kanban Board', value: 'kanban', icon: <AppstoreOutlined /> },
                                    { label: 'Table Overview', value: 'table', icon: <TableOutlined /> }
                                ]}
                                value={viewMode}
                                onChange={setViewMode}
                            />
                            <Button 
                                type="primary" 
                                size="large" 
                                icon={<PlusOutlined />} 
                                onClick={() => setIsCreateOpen(true)} 
                                style={{ borderRadius: '6px' }}
                            >
                                Create New ECR (Block 1)
                            </Button>
                        </Space>
                    </div>

                    {/* View Mode: Kanban Task Board */}
                    {viewMode === 'kanban' ? (
                        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16 }}>
                            {KANBAN_STAGES.map(col => {
                                const colDocs = combinedDocs.filter(d => getDocStage(d, d.doc_type) === col.key);
                                return (
                                    <div 
                                        key={col.key} 
                                        style={{ 
                                            minWidth: 260, 
                                            maxWidth: 290, 
                                            background: '#f8f9fa', 
                                            borderRadius: 8, 
                                            padding: 12,
                                            borderTop: `4px solid ${col.color}` 
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <Text strong style={{ fontSize: 14 }}>{col.title}</Text>
                                            <Badge count={colDocs.length} overflowCount={99} style={{ backgroundColor: col.color }} />
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 300 }}>
                                            {colDocs.length === 0 ? (
                                                <div style={{ padding: 24, textAlign: 'center', color: '#bfbfbf', fontSize: 12 }}>
                                                    No documents
                                                </div>
                                            ) : (
                                                colDocs.map(doc => (
                                                    <Card 
                                                        key={`${doc.doc_type}_${doc.id}`}
                                                        size="small" 
                                                        hoverable
                                                        style={{ borderRadius: 6, borderColor: '#e8e8e8' }}
                                                        onClick={() => openDetail(doc.id, doc.doc_type)}
                                                    >
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                            <Tag color={doc.doc_type === 'ECR' ? 'blue' : 'purple'}>
                                                                {doc.doc_type}
                                                            </Tag>
                                                            <Text strong style={{ fontSize: 12 }}>
                                                                {doc.ecr_no || doc.ecn_no || `#${doc.id}`}
                                                            </Text>
                                                        </div>

                                                        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, lineHeight: 1.3 }}>
                                                            {doc.title_of_change || 'Untitled Change'}
                                                        </div>

                                                        <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 8 }}>
                                                            <UserOutlined style={{ marginRight: 4 }} />
                                                            {doc.request_by_name || doc.engineer_assigned || 'N/A'} ({doc.department || ''})
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 6 }}>
                                                            <StatusBadge status={doc.process_status} />
                                                            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                                {moment(doc.created_at).format('DD-MMM')}
                                                            </span>
                                                        </div>
                                                    </Card>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* View Mode: Table Overview with Tabs */
                        <Tabs defaultActiveKey="my_tasks" items={[
                            {
                                key: 'my_tasks',
                                label: (
                                    <span>
                                        My Action Items <Badge count={totalMyTasks} style={{ marginLeft: 6, backgroundColor: '#f5222d' }} />
                                    </span>
                                ),
                                children: (
                                    <div style={{ marginTop: 8 }}>
                                        <h4 style={{ color: '#1890ff', marginBottom: 12 }}>Pending ECR Actions ({myTasks.ecrTasks?.length || 0})</h4>
                                        <Table 
                                            dataSource={myTasks.ecrTasks || []} 
                                            columns={ecrColumns} 
                                            rowKey="id" 
                                            pagination={{ pageSize: 5 }}
                                            locale={{ emptyText: 'No pending ECR actions assigned to you.' }}
                                            style={{ marginBottom: 24 }}
                                        />

                                        <h4 style={{ color: '#722ed1', marginBottom: 12 }}>Pending ECN Actions ({myTasks.ecnTasks?.length || 0})</h4>
                                        <Table 
                                            dataSource={myTasks.ecnTasks || []} 
                                            columns={ecnColumns} 
                                            rowKey="id" 
                                            pagination={{ pageSize: 5 }}
                                            locale={{ emptyText: 'No pending ECN actions assigned to you.' }}
                                        />
                                    </div>
                                )
                            },
                            {
                                key: 'all_ecr',
                                label: `All ECRs (${ecrData.length})`,
                                children: <Table dataSource={ecrData} columns={ecrColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                            },
                            {
                                key: 'all_ecn',
                                label: `All ECNs (${ecnData.length})`,
                                children: <Table dataSource={ecnData} columns={ecnColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                            }
                        ]} />
                    )}

                </div>
            </Content>

            <CreateECRModal 
                open={isCreateOpen} 
                onClose={() => setIsCreateOpen(false)} 
                onSuccess={() => {
                    setIsCreateOpen(false);
                    fetchData();
                }}
            />

            <CreateECNModal
                open={isCreateEcnOpen}
                linkedEcr={selectedEcrForEcn}
                onClose={() => setIsCreateEcnOpen(false)}
                onSuccess={() => {
                    setIsCreateEcnOpen(false);
                    fetchData();
                }}
            />

            <ECNDetailModal
                open={isDetailOpen}
                documentId={selectedDocId}
                documentType={selectedDocType}
                onClose={() => {
                    setIsDetailOpen(false);
                    fetchData();
                }}
            />
        </Spin>
    );
}
