import { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  ToolOutlined, FileSearchOutlined, FormOutlined,
  LogoutOutlined, UserOutlined, DashboardOutlined, SettingOutlined,
} from '@ant-design/icons';
import { getUser, logout } from '../stores/authStore';
import { color } from '../constance/constance';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'MTC Home',
  },
  {
    key: '/drawing-request',
    icon: <FormOutlined />,
    label: 'Drawing Request',
  },
  {
    key: '/setup-data-sheet',
    icon: <FileSearchOutlined />,
    label: 'Setup Data Sheet',
  },
  {
    key: '/tooling-select',
    icon: <SettingOutlined />,
    label: 'Tooling Select',
  },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const userMenu = {
    items: [
      { key: 'logout', icon: <LogoutOutlined />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => { if (key === 'logout') logout(); },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{ background: color.siderBg, boxShadow: '2px 0 8px rgba(0,0,0,0.08)' }}
        theme="light"
      >
        <div style={{
          padding: collapsed ? '16px 8px' : '16px',
          background: color.headerBg,
          textAlign: 'center',
          marginBottom: 4,
        }}>
          <ToolOutlined style={{ fontSize: 24, color: '#fff' }} />
          {!collapsed && (
            <div>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 700, display: 'block' }}>
                MTC Engineer
              </Text>
            </div>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: color.headerBg,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ background: 'rgba(255,255,255,0.3)' }} />
              <Text style={{ color: '#fff', fontSize: 13 }}>
                {user?.name || user?.empno}
              </Text>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: '16px', background: '#fff', borderRadius: 8, padding: 20, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
