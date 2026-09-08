import React, { useEffect, useState } from 'react';
import { Layout, Segmented, Button } from 'antd';
import { MenuTemplate } from '../../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../../theme';
import ScrollbarStyle from '../../../../common/scrollbar';
import useEngRecordStore from '../../../../../stores/engRecordStore';
import { EngRecordDashboard } from '../dashboard';
import { EngRecordTable } from '../table';
import { EngRecordSyncPanel } from '../sync';
import { EngRecordDetailDrawer } from '../drawer';
import { EngRecordFormModal } from '../form';
import { EngRecordQuickCreate } from '../quick_create';
import '../styles/eng_record.css';

import {
    DashboardOutlined,
    TableOutlined,
    SyncOutlined,
    LinkOutlined,
} from '@ant-design/icons';

const { Content } = Layout;

export function EngRecordLayout() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const { theme } = useTheme();
    const fetchPermissions = useEngRecordStore((s) => s.fetchPermissions);
    const permissions = useEngRecordStore((s) => s.permissions);

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
        <Layout style={{ height: '100%', overflow: 'hidden', display: 'flex' }}>
            <MenuTemplate type="ALL" defaultSelectedKeys={['3']} />
            <Layout
                style={{
                    height: '100%',
                    backgroundColor: theme.colors.background,
                    overflow: 'hidden',
                }}
            >
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content
                    className="kb-vscroll"
                    style={{
                        height: '100%',
                        overflowY: 'auto',
                        padding: '24px 24px 80px 24px',
                    }}
                >
                    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                        {/* Tab Navigation */}
                        <div
                            style={{
                                marginBottom: 24,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}
                        >
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
                            <Button
                                type="dashed"
                                icon={<LinkOutlined />}
                                onClick={() =>
                                    window.open('/eng/viewer/eng-record', '_blank')
                                }
                            >
                                Open Viewer Page
                            </Button>
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
