import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout, Spin, Button, Typography, Space, Tag, Segmented, Tooltip } from 'antd';
import { 
    AppstoreOutlined, CalendarOutlined, PlusCircleOutlined, 
    FileTextOutlined, MessageOutlined, SyncOutlined, SettingOutlined 
} from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';
import ScrollbarStyle from '../../../common/scrollbar';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import EcntSettingsModal from './components/EcntSettingsModal';

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
    const [searchParams, setSearchParams] = useSearchParams();
    const { userRole, userDepartment, empNo, position } = useAuthStore();

    const [loading, setLoading] = useState(false);
    const [ecrData, setEcrData] = useState([]);
    const [ecnData, setEcnData] = useState([]);
    const [myTasks, setMyTasks] = useState({ ecrTasks: [], ecnTasks: [] });
    const [systemConfig, setSystemConfig] = useState({});
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    // Active View Mode: 'dashboard' | 'gantt' | 'require' | 'workspace' | 'investigation'
    const [currentView, setCurrentView] = useState('dashboard');
    
    // Active Document Context
    const [activeDocId, setActiveDocId] = useState(null);
    const [activeDocType, setActiveDocType] = useState('ECR');
    const [activeDocData, setActiveDocData] = useState(null);
    const [editEcrData, setEditEcrData] = useState(null);

    const getAuthConfig = () => {
        const token = localStorage.getItem("token");
        return {
            withCredentials: true,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        };
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const authConfig = getAuthConfig();
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const [resEcr, resEcn, resMyTasks] = await Promise.all([
                axios.get(`${baseUrl}/api/ecnt/ecr`, authConfig),
                axios.get(`${baseUrl}/api/ecnt/ecn`, authConfig),
                axios.get(`${baseUrl}/api/ecnt/my-tasks`, authConfig)
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

    const fetchConfig = async () => {
        try {
            const authConfig = getAuthConfig();
            const baseUrl = (server.URL || server.API_URL || '').replace(/\/$/, '');
            const res = await axios.get(`${baseUrl}/api/ecnt/config`, authConfig);
            if (res.data?.data) {
                setSystemConfig(res.data.data);
            }
        } catch (err) {
            console.error("Fetch Config Error:", err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // URL Deep Linking: Read params from URL and navigate automatically
    useEffect(() => {
        const urlDocType = searchParams.get('docType');
        const urlId = searchParams.get('id');
        const urlView = searchParams.get('view');

        if (urlId) {
            const numId = Number(urlId);
            setActiveDocId(numId);
            const type = urlDocType || 'ECR';
            setActiveDocType(type);
            const list = type === 'ECR' ? ecrData : ecnData;
            const found = list.find(d => d.id === numId);
            if (found) setActiveDocData(found);
            if (urlView) {
                setCurrentView(urlView);
            } else {
                setCurrentView('workspace');
            }
        }
    }, [searchParams, ecrData, ecnData]);

    const updateUrl = (type, id, view) => {
        const p = new URLSearchParams();
        if (type && id) {
            p.set('docType', type);
            p.set('id', String(id));
        }
        if (view && view !== 'dashboard') {
            p.set('view', view);
        }
        setSearchParams(p, { replace: true });
    };

    const handleOpenDoc = (id, type) => {
        setActiveDocId(id);
        setActiveDocType(type);
        const list = type === 'ECR' ? ecrData : ecnData;
        const found = list.find(d => d.id === id);
        setActiveDocData(found || null);
        setCurrentView('workspace');
        updateUrl(type, id, 'workspace');
    };

    const handleOpenInvestigation = (doc) => {
        if (doc) {
            setActiveDocId(doc.id);
            const type = doc.doc_type || activeDocType;
            setActiveDocType(type);
            setActiveDocData(doc);
            setCurrentView('investigation');
            updateUrl(type, doc.id, 'investigation');
        } else {
            setCurrentView('investigation');
            updateUrl(activeDocType, activeDocId, 'investigation');
        }
    };

    const handleOpenGantt = (doc) => {
        if (doc) {
            setActiveDocId(doc.id);
            const type = doc.doc_type || doc.type || activeDocType;
            setActiveDocType(type);
            updateUrl(type, doc.id, 'gantt');
        } else {
            updateUrl(null, null, 'gantt');
        }
        setCurrentView('gantt');
    };

    const handleRequireNew = () => {
        setEditEcrData(null);
        setCurrentView('require');
        updateUrl(null, null, 'require');
    };

    const handleEditEcr = (doc) => {
        setEditEcrData(doc);
        setCurrentView('require');
        updateUrl('ECR', doc.id, 'require');
    };

    const handleBackToDashboard = () => {
        setEditEcrData(null);
        setCurrentView('dashboard');
        updateUrl(null, null, 'dashboard');
    };

    // RBAC check for System Settings button
    const isSettingsAuthorized = 
        userRole === 'AD' || 
        userDepartment === 'AD' || 
        (userDepartment === 'ENG' && (userRole === 'MGR' || (position && position.toLowerCase().includes('coord')))) ||
        (systemConfig.system_admins && Array.isArray(systemConfig.system_admins) && systemConfig.system_admins.map(String).map(s => s.toLowerCase()).includes((empNo || '').toLowerCase()));

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

                {/* Segmented View Switcher & Action Tools */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Segmented
                        value={currentView}
                        onChange={(view) => {
                            if (view === 'require') {
                                setEditEcrData(null);
                            }
                            setCurrentView(view);
                        }}
                        size="middle"
                        options={[
                            {
                                label: (
                                    <Tooltip title="Executive Pipeline Dashboard">
                                        <Space size={4} style={{ padding: '0 4px' }}>
                                            <AppstoreOutlined style={{ fontSize: 15 }} />
                                            <span style={{ fontSize: 13 }}>Dashboard</span>
                                        </Space>
                                    </Tooltip>
                                ),
                                value: 'dashboard'
                            },
                            {
                                label: (
                                    <Tooltip title="Timeline & Gantt Chart">
                                        <Space size={4} style={{ padding: '0 4px' }}>
                                            <CalendarOutlined style={{ fontSize: 15 }} />
                                            <span style={{ fontSize: 13 }}>Gantt</span>
                                        </Space>
                                    </Tooltip>
                                ),
                                value: 'gantt'
                            },
                            {
                                label: (
                                    <Tooltip title="Initiate New ECR Request">
                                        <Space size={4} style={{ padding: '0 4px' }}>
                                            <PlusCircleOutlined style={{ fontSize: 15, color: '#1677ff' }} />
                                            <span style={{ fontSize: 13 }}>Require ECR</span>
                                        </Space>
                                    </Tooltip>
                                ),
                                value: 'require'
                            },
                            ...(activeDocId ? [
                                {
                                    label: (
                                        <Tooltip title={`Active Doc: ${activeDocType} #${activeDocId} Workspace`}>
                                            <Space size={4} style={{ padding: '0 4px' }}>
                                                <FileTextOutlined style={{ fontSize: 15, color: '#722ed1' }} />
                                                <span style={{ fontSize: 13 }}>Workspace</span>
                                            </Space>
                                        </Tooltip>
                                    ),
                                    value: 'workspace'
                                },
                                {
                                    label: (
                                        <Tooltip title="Investigation, Discussions & Problem Hub">
                                            <Space size={4} style={{ padding: '0 4px' }}>
                                                <MessageOutlined style={{ fontSize: 15, color: '#fa8c16' }} />
                                                <span style={{ fontSize: 13 }}>Problem Hub</span>
                                            </Space>
                                        </Tooltip>
                                    ),
                                    value: 'investigation'
                                }
                            ] : [])
                        ]}
                    />

                    {/* Action Tools: Icon-First with Tooltips */}
                    <Tooltip title="Refresh Workflow Data">
                        <Button 
                            icon={<SyncOutlined spin={loading} />} 
                            onClick={() => { fetchData(); fetchConfig(); }}
                            style={{ borderRadius: 8 }}
                        />
                    </Tooltip>

                    {isSettingsAuthorized && (
                        <Tooltip title="System Configuration & Stage Flow Settings">
                            <Button 
                                icon={<SettingOutlined />} 
                                onClick={() => setIsSettingsModalOpen(true)}
                                style={{ borderRadius: 8, borderColor: '#1890ff', color: '#1890ff' }}
                            />
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* View Body */}
            <Spin spinning={loading}>
                {currentView === 'dashboard' && (
                    <EcntDashboardView 
                        ecrData={ecrData} 
                        ecnData={ecnData} 
                        myTasks={myTasks}
                        systemConfig={systemConfig}
                        onOpenDoc={handleOpenDoc}
                        onNavigateToRequire={handleRequireNew}
                        onNavigateToGantt={() => handleOpenGantt(null)}
                    />
                )}

                {currentView === 'gantt' && (
                    <EcntGanttChartView 
                        ecrData={ecrData} 
                        ecnData={ecnData} 
                        selectedDocInitial={activeDocId ? { id: activeDocId, type: activeDocType } : null}
                        onBackToDashboard={handleBackToDashboard}
                        onOpenDoc={handleOpenDoc}
                    />
                )}

                {currentView === 'require' && (
                    <EcrRequireView 
                        initialData={editEcrData}
                        systemConfig={systemConfig}
                        onBack={handleBackToDashboard}
                        onSuccess={() => {
                            fetchData();
                            handleBackToDashboard();
                        }}
                    />
                )}

                {currentView === 'workspace' && activeDocId && (
                    <EcntWorkspaceView 
                        documentType={activeDocType}
                        documentId={activeDocId}
                        systemConfig={systemConfig}
                        onBack={handleBackToDashboard}
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
                        onBack={() => handleOpenDoc(activeDocId, activeDocType)}
                        onOpenWorkspace={() => handleOpenDoc(activeDocId, activeDocType)}
                    />
                )}
            </Spin>

            <EcntSettingsModal
                open={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                currentConfig={systemConfig}
                onConfigUpdated={(cfg) => {
                    setSystemConfig(cfg);
                    fetchConfig();
                }}
            />
            </Content>
        </Layout>
    </Layout>
    );
}
