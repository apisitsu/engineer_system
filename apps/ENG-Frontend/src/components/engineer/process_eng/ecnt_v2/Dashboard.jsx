import React, { useState, useEffect } from 'react';
import { Layout, Spin, Button, Typography, Space, Tag, Segmented } from 'antd';
import { 
    AppstoreOutlined, CalendarOutlined, PlusCircleOutlined, 
    FileTextOutlined, MessageOutlined, SyncOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';

// 4 Dedicated Core Views
import EcntDashboardView from './views/EcntDashboardView';
import EcntGanttChartView from './views/EcntGanttChartView';
import EcrRequireView from './views/EcrRequireView';
import EcntWorkspaceView from './views/EcntWorkspaceView';
import EcntInvestigationHub from './views/EcntInvestigationHub';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function Dashboard() {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [ecrData, setEcrData] = useState([]);
    const [ecnData, setEcnData] = useState([]);
    const [myTasks, setMyTasks] = useState({ ecrTasks: [], ecnTasks: [] });

    // Active View Mode: 'dashboard' | 'gantt' | 'require' | 'workspace' | 'investigation'
    const [currentView, setCurrentView] = useState('dashboard');
    
    // Active Document Context
    const [activeDocId, setActiveDocId] = useState(null);
    const [activeDocType, setActiveDocType] = useState('ECR');
    const [activeDocData, setActiveDocData] = useState(null);

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
            console.error("Fetch ECNT Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenDoc = (id, type) => {
        setActiveDocId(id);
        setActiveDocType(type);
        const list = type === 'ECR' ? ecrData : ecnData;
        const found = list.find(d => d.id === id);
        setActiveDocData(found || null);
        setCurrentView('workspace');
    };

    const handleOpenInvestigation = (doc) => {
        if (doc) {
            setActiveDocId(doc.id);
            setActiveDocType(doc.doc_type || activeDocType);
            setActiveDocData(doc);
        }
        setCurrentView('investigation');
    };

    const handleOpenGantt = (doc) => {
        if (doc) {
            setActiveDocId(doc.id);
            setActiveDocType(doc.doc_type || doc.type || activeDocType);
        }
        setCurrentView('gantt');
    };

    const handleRequireNew = () => {
        setActiveDocData(null);
        setCurrentView('require');
    };

    const handleEditEcr = (doc) => {
        setActiveDocData(doc);
        setCurrentView('require');
    };

    return (
        <Layout hasSider style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}>
            <MenuTemplate type="Process" selectedKeys={["ecnt_v2"]} defaultSelectedKeys={["ecnt_v2"]} />
            <Layout style={{
                backgroundColor: theme?.colors?.background || '#f5f7fa',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden'
            }}>
                <ScrollbarStyle primary={theme?.colors?.primary || '#1890ff'} />
                <Content 
                    className="kb-vscroll"
                    style={{
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        overflowY: 'auto'
                    }}
                >

            {/* Master Header & View Navigation */}
            <div style={{ 
                background: '#ffffff', 
                borderRadius: 14, 
                padding: '16px 24px', 
                border: '1px solid #e8e8e8',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                            ECNT V2
                        </Title>
                        <Tag color="blue" style={{ borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
                            11-BLOCK WORKFLOW
                        </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Engineering Change Request & Notice Management Platform
                    </Text>
                </div>

                {/* Segmented View Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Segmented
                        value={currentView}
                        onChange={setCurrentView}
                        size="large"
                        options={[
                            {
                                label: (
                                    <Space>
                                        <AppstoreOutlined />
                                        <span>Dashboard</span>
                                    </Space>
                                ),
                                value: 'dashboard'
                            },
                            {
                                label: (
                                    <Space>
                                        <CalendarOutlined />
                                        <span>Gantt Chart</span>
                                    </Space>
                                ),
                                value: 'gantt'
                            },
                            {
                                label: (
                                    <Space>
                                        <PlusCircleOutlined />
                                        <span>Require ECR</span>
                                    </Space>
                                ),
                                value: 'require'
                            },
                            ...(activeDocId ? [
                                {
                                    label: (
                                        <Space>
                                            <FileTextOutlined />
                                            <span>Workspace</span>
                                        </Space>
                                    ),
                                    value: 'workspace'
                                },
                                {
                                    label: (
                                        <Space>
                                            <MessageOutlined />
                                            <span>Problem Hub</span>
                                        </Space>
                                    ),
                                    value: 'investigation'
                                }
                            ] : [])
                        ]}
                    />

                    <Button 
                        icon={<SyncOutlined spin={loading} />} 
                        onClick={fetchData}
                        style={{ borderRadius: 8 }}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* View Body */}
            <Spin spinning={loading}>
                {currentView === 'dashboard' && (
                    <EcntDashboardView 
                        ecrData={ecrData} 
                        ecnData={ecnData} 
                        myTasks={myTasks}
                        onOpenDoc={handleOpenDoc}
                        onNavigateToRequire={handleRequireNew}
                        onNavigateToGantt={() => setCurrentView('gantt')}
                    />
                )}

                {currentView === 'gantt' && (
                    <EcntGanttChartView 
                        ecrData={ecrData} 
                        ecnData={ecnData} 
                        selectedDocInitial={activeDocId ? { id: activeDocId, type: activeDocType } : null}
                        onBackToDashboard={() => setCurrentView('dashboard')}
                        onOpenDoc={handleOpenDoc}
                    />
                )}

                {currentView === 'require' && (
                    <EcrRequireView 
                        initialData={activeDocData}
                        onBack={() => setCurrentView('dashboard')}
                        onSuccess={() => {
                            fetchData();
                            setCurrentView('dashboard');
                        }}
                    />
                )}

                {currentView === 'workspace' && activeDocId && (
                    <EcntWorkspaceView 
                        documentType={activeDocType}
                        documentId={activeDocId}
                        onBack={() => setCurrentView('dashboard')}
                        onOpenInvestigation={handleOpenInvestigation}
                        onOpenGantt={handleOpenGantt}
                        onEditEcr={handleEditEcr}
                    />
                )}

                {currentView === 'investigation' && activeDocId && (
                    <EcntInvestigationHub 
                        documentType={activeDocType}
                        documentId={activeDocId}
                        docData={activeDocData}
                        onBack={() => setCurrentView('workspace')}
                        onOpenWorkspace={() => setCurrentView('workspace')}
                    />
                )}
            </Spin>
            </Content>
        </Layout>
    </Layout>
    );
}
