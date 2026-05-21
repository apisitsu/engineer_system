import React, { useEffect, useState } from 'react';
import { Layout, Segmented, Typography, Button } from 'antd';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import useEngRecordStore from '../../../../stores/engRecordStore';
import EngRecordDashboard from './EngRecordDashboard';
import EngRecordTable from './EngRecordTable';
import EngRecordDetailDrawer from './EngRecordDetailDrawer';
import { DashboardOutlined, TableOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './eng_record.css';

const { Content, Header } = Layout;
const { Title } = Typography;

function EngRecordViewerLayout() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const { theme } = useTheme();
    const navigate = useNavigate();
    
    // We still fetch records and initialize store
    const fetchRecords = useEngRecordStore(s => s.fetchRecords);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const tabOptions = [
        { label: 'Dashboard', value: 'dashboard', icon: <DashboardOutlined /> },
        { label: 'Records', value: 'table', icon: <TableOutlined /> },
    ];

    return (
        <Layout style={{ minHeight: '100vh', backgroundColor: theme.colors.background }}>
            <ScrollbarStyle primary={theme.colors.primary} />
            <Header style={{ 
                background: theme.colors.surface, 
                padding: '0 24px', 
                display: 'flex', 
                alignItems: 'center', 
                borderBottom: `1px solid ${theme.colors.border}`,
                boxShadow: theme.shadows.sm
            }}>
                <Button 
                    type="text" 
                    icon={<ArrowLeftOutlined />} 
                    onClick={() => navigate(-1)}
                    style={{ marginRight: 16 }}
                />
                <Title level={4} style={{ margin: 0, color: theme.colors.textPrimary }}>
                    Engineering Record (Viewer)
                </Title>
            </Header>
            <Content
                className="kb-vscroll"
                style={{
                    height: 'calc(100vh - 64px)',
                    overflowY: 'auto',
                    padding: '24px',
                }}
            >
                <div style={{ maxWidth: 1400, margin: '0 auto' }}>
                    <div className="engr-page-header">
                        <div>
                            <Segmented
                                options={tabOptions}
                                value={activeTab}
                                onChange={setActiveTab}
                                size="large"
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                        {activeTab === 'dashboard' && <EngRecordDashboard />}
                        {activeTab === 'table' && <EngRecordTable isViewer={true} />}
                    </div>
                </div>

                <EngRecordDetailDrawer isViewer={true} />
            </Content>
        </Layout>
    );
}

export default EngRecordViewerLayout;
