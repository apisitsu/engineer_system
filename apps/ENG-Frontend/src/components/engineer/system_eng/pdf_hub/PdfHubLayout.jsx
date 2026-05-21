import React, { useState } from 'react';
import { Layout, Menu } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    EditOutlined,
    MergeCellsOutlined,
    FileImageOutlined,
    FileSearchOutlined,
    FilePdfOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../../theme';
import ScrollbarStyle from '../../../common/scrollbar';
import './PdfHubLayout.css';

const { Sider, Content } = Layout;

const menuItems = [
    {
        key: 'sign-stamp',
        icon: <EditOutlined />,
        label: 'Sign & Stamp',
        badge: 'NEW',
    },
    {
        key: 'merge',
        icon: <MergeCellsOutlined />,
        label: 'PDF Merger',
    },
    {
        key: 'to-image',
        icon: <FileImageOutlined />,
        label: 'PDF to Image',
    },
    {
        key: 'dwg-check',
        icon: <FileSearchOutlined />,
        label: 'DWG Check',
    },
];

export default function PdfHubLayout() {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);

    // Derive active key from the current path
    const pathSegments = location.pathname.split('/');
    const activeKey = pathSegments[pathSegments.length - 1] || 'sign-stamp';

    const handleMenuClick = ({ key }) => {
        navigate(`/eng/pdf-hub/tools/${key}`);
    };

    // Dynamic colors based on theme
    const siderBg = theme.colors.surface;
    const siderText = theme.colors.textPrimary;
    const activeBg = `${theme.colors.primary}18`;
    const activeColor = theme.colors.primary;

    const antdMenuItems = menuItems.map(item => ({
        key: item.key,
        icon: item.icon,
        label: (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span>{item.label}</span>
                {item.badge && !collapsed && (
                    <span
                        className="pdf-hub-menu-badge"
                        style={{
                            background: `${theme.colors.primary}22`,
                            color: theme.colors.primary,
                        }}
                    >
                        {item.badge}
                    </span>
                )}
            </span>
        ),
    }));

    return (
        <Layout className="pdf-hub-layout">
            <Sider
                className="pdf-hub-sider"
                theme="light"
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                width={240}
                collapsedWidth={64}
                style={{
                    background: siderBg,
                    borderRight: `1px solid ${theme.colors.border}`,
                    boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
                }}
            >
                {/* Header */}
                <div className="pdf-hub-sider-header">
                    <div
                        className="pdf-hub-sider-logo"
                        style={{
                            background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primary}cc)`,
                            color: '#fff',
                        }}
                    >
                        <FilePdfOutlined />
                    </div>
                    {!collapsed && (
                        <div className="pdf-hub-sider-title">
                            <h3 style={{ color: siderText }}>PDF Hub</h3>
                            <span style={{ color: theme.colors.textSecondary }}>Management Tools</span>
                        </div>
                    )}
                </div>

                {/* Menu */}
                <Menu
                    className="pdf-hub-menu"
                    mode="inline"
                    selectedKeys={[activeKey]}
                    onClick={handleMenuClick}
                    items={antdMenuItems}
                    style={{
                        background: 'transparent',
                        borderInlineEnd: 'none',
                        color: siderText,
                        '--ant-menu-item-selected-bg': activeBg,
                        '--ant-menu-item-selected-color': activeColor,
                    }}
                />

                {/* Footer */}
                {!collapsed && (
                    <div className="pdf-hub-sider-footer">
                        <span style={{ color: theme.colors.textSecondary }}>
                            Engineer System v2.0
                        </span>
                    </div>
                )}
            </Sider>

            <Layout style={{ backgroundColor: theme.colors.background }}>
                <ScrollbarStyle primary={theme.colors.primary} />
                <Content className="pdf-hub-content kb-vscroll">
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}
