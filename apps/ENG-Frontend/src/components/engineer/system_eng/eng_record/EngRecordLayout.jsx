import React, { useEffect, useState } from 'react';
import { Layout, Segmented } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import useEngRecordStore from '../../../../stores/engRecordStore';
import EngRecordDashboard from './EngRecordDashboard';
import EngRecordTable from './EngRecordTable';
import EngRecordSyncPanel from './EngRecordSyncPanel';
import EngRecordDetailDrawer from './EngRecordDetailDrawer';
import EngRecordFormModal from './EngRecordFormModal';
import EngRecordQuickCreate from './EngRecordQuickCreate';
import './eng_record.css';

import {
    DashboardOutlined,
    TableOutlined,
    SyncOutlined,
} from '@ant-design/icons';

const { Content } = Layout;

function EngRecordLayout() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const { theme } = useTheme();
    const fetchPermissions = useEngRecordStore(s => s.fetchPermissions);
    const permissions = useEngRecordStore(s => s.permissions);

    useEffect(() => {
        fetchPermissions();
    }, [fetchPermissions]);

    const tabOptions = [
        { label: 'Dashboard', value: 'dashboard', icon: <DashboardOutlined /> },
        { label: 'Records', value: 'table', icon: <TableOutlined /> },
    ];

    // Only show Sync tab for engineer/admin
    if (permissions?.canSync) {
        tabOptions.push({ label: 'Data Sync', value: 'sync', icon: <SyncOutlined /> });
    }

    return (
        <Layout style={{ minHeight: 100, display: 'flex' }}>
            <MenuTemplate type={'System'} defaultSelectedKeys={'4'} />
            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content
                    className="kb-vscroll"
                    style={{
                        height: 'calc(100vh - 64px)',
                        overflowY: 'auto',
                        padding: '24px',
                    }}
                >
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        {/* Tab Navigation */}
                        <div style={{ marginBottom: 24 }}>
                            <Segmented
                                options={tabOptions}
                                value={activeTab}
                                onChange={setActiveTab}
                                size="large"
                                style={{
                                    background: theme.colors.surface || theme.colors.card,
                                    borderRadius: 12,
                                }}
                            />
                        </div>

                        {/* Tab Content */}
                        {activeTab === 'dashboard' && <EngRecordDashboard />}
                        {activeTab === 'table' && <EngRecordTable />}
                        {activeTab === 'sync' && <EngRecordSyncPanel />}
                    </div>
                </Content>

                {/* Global Drawer & Modal */}
                <EngRecordDetailDrawer />
                <EngRecordFormModal />
                <EngRecordQuickCreate />
            </Layout>
        </Layout>
    );
}

export default EngRecordLayout;
