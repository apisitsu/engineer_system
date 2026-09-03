import React, { useState, useEffect } from "react";
import { Layout, Spin, Table, Button, Tooltip, Tabs } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import axios from "axios";
import moment from "moment";
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import StatusBadge from './components/StatusBadge';
import CreateECRModal from './CreateECRModal';
import ECNDetailModal from './ECNDetailModal'; // This handles viewing ECRs and ECNs

const { Content } = Layout;

export default function Dashboard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [ecrData, setEcrData] = useState([]);
    const [ecnData, setEcnData] = useState([]);
    
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState(null);
    const [selectedDocType, setSelectedDocType] = useState('ECR');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [resEcr, resEcn] = await Promise.all([
                axios.get(`${server.URL}/api/ecnt/ecr`, { withCredentials: true }),
                axios.get(`${server.URL}/api/ecnt/ecn`, { withCredentials: true })
            ]);
            setEcrData(resEcr.data.data);
            setEcnData(resEcn.data.data);
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
        },
        {
            title: 'Objective',
            dataIndex: 'objective',
            key: 'objective',
        },
        {
            title: 'Status',
            dataIndex: 'process_status',
            key: 'status',
            render: (text) => <StatusBadge status={text} />,
        },
        {
            title: 'Requester',
            dataIndex: 'request_by_name',
            key: 'request_by',
        },
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'date',
            render: (text) => moment(text).format('DD-MMM-YYYY HH:mm')
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View ECR">
                    <Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => openDetail(record.id, 'ECR')} />
                </Tooltip>
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
            title: 'Title',
            dataIndex: 'title_of_change',
            key: 'title',
        },
        {
            title: 'Eng Assigned',
            dataIndex: 'engineer_assigned',
            key: 'eng',
        },
        {
            title: 'Status',
            dataIndex: 'process_status',
            key: 'status',
            render: (text) => <StatusBadge status={text} />,
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Tooltip title="View ECN">
                    <Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => openDetail(record.id, 'ECN')} />
                </Tooltip>
            ),
        },
    ];

    return (
        <Spin tip="Loading ECNT V2 Data..." size="large" spinning={loading}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '20px' }}>
                <div style={{ background: theme.colors.surface, borderRadius: '8px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <AssessmentRoundedIcon sx={{ color: theme.colors.primary, fontSize: 36 }} />
                            <div>
                                <h1 style={{ margin: 0, color: theme.colors.text, fontSize: '24px' }}>Engineering Change System (V2)</h1>
                                <span style={{ color: theme.colors.textSecondary }}>Manage ECR and ECN workflows across all 11 stages</span>
                            </div>
                        </div>
                        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setIsCreateOpen(true)} style={{ borderRadius: '6px' }}>
                            Create New ECR (Block 1)
                        </Button>
                    </div>

                    <Tabs defaultActiveKey="1" items={[
                        {
                            key: '1',
                            label: `Pending ECRs (${ecrData.filter(e => !e.process_status.includes('Closed') && !e.process_status.includes('Issued ECN')).length})`,
                            children: <Table dataSource={ecrData} columns={ecrColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                        },
                        {
                            key: '2',
                            label: `Active ECNs (${ecnData.filter(e => e.process_status !== 'ECN Effective').length})`,
                            children: <Table dataSource={ecnData} columns={ecnColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                        }
                    ]} />

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

            <ECNDetailModal
                open={isDetailOpen}
                documentId={selectedDocId}
                documentType={selectedDocType}
                onClose={() => {
                    setIsDetailOpen(false);
                    fetchData(); // Refresh in case actions were taken
                }}
            />
        </Spin>
    );
}
