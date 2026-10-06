import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout, Typography, Table, Select, Tag, Card, App, Result } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';

const { Content } = Layout;
const { Title } = Typography;

// Keep in sync with FEATURE_KEYS in permissionsConfigController.js. Order
// matches the MTC sidebar (menu_sidebar.jsx `mtc` array) for items 1-4/7;
// "SDS Excel, Image" is split out of Setup Data Sheet Setting so it can be
// granted narrowly; "All MTC" is always last (it's a shortcut, not a sidebar
// item of its own).
const FEATURE_OPTIONS = [
  { value: 'pbring_admin', label: '1. Tooling PB Ring — + New HW / Delete all HW', color: 'magenta' },
  { value: 'general_dwg_admin', label: '2. General DWG Request — Setting', color: 'green' },
  { value: 'tooling_inspect_admin', label: '3. Tooling Inspection — Add Return / Add Request / Update Data / row Update', color: 'volcano' },
  { value: 'tooling_select_admin', label: '4. Tooling Select — Setting', color: 'blue' },
  { value: 'sds_setting_admin', label: '5. Setup Data Sheet — Setting', color: 'purple' },
  { value: 'sds_excel_image_admin', label: '6. Setup Data Sheet — SDS Excel, Image', color: 'red' },
  { value: 'sds_report_admin', label: '7. SDS Report — Scope', color: 'geekblue' },
  { value: 'master_data_admin', label: '8. Master Data (Part Management + CN Enable)', color: 'cyan' },
  { value: 'all_mtc', label: '9. All MTC (equivalent to all of the above combined)', color: 'gold' },
];
const FEATURE_LABEL = Object.fromEntries(FEATURE_OPTIONS.map(f => [f.value, f]));

// Requested row order: MGR, then COORD, then MTC ahead of everything else;
// any other group falls after these three, sorted alphabetically.
const GROUP_PRIORITY = ['MGR', 'COORD', 'MTC'];
const groupRank = (group) => {
  const i = GROUP_PRIORITY.indexOf(group || '');
  return i === -1 ? GROUP_PRIORITY.length : i;
};

// Within a group: HEAD, then STAFF, then LEADER ahead of everything else.
const ROLE_PRIORITY = ['HEAD', 'STAFF', 'LEADER'];
const roleRank = (role) => {
  const i = ROLE_PRIORITY.indexOf(role || '');
  return i === -1 ? ROLE_PRIORITY.length : i;
};

const PermissionsConfigPage = () => {
  const { theme } = useTheme();
  const { message } = App.useApp();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingCode, setSavingCode] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.PERMISSIONS_CONFIG_USERS);
      setUsers(res.data?.data || []);
    } catch (e) {
      if (e?.response?.status === 403) {
        setForbidden(true);
      } else {
        message.error('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const rankDiff = groupRank(a.user_group) - groupRank(b.user_group);
      if (rankDiff !== 0) return rankDiff;
      const groupDiff = (a.user_group || '').localeCompare(b.user_group || '');
      if (groupDiff !== 0) return groupDiff;
      const roleDiff = roleRank(a.role) - roleRank(b.role);
      if (roleDiff !== 0) return roleDiff;
      return (a.u_code || '').localeCompare(b.u_code || '');
    });
  }, [users]);

  const handleChange = async (u_code, feature_perms) => {
    setSavingCode(u_code);
    try {
      await axios.put(`${server.PERMISSIONS_CONFIG_USERS}/${encodeURIComponent(u_code)}`, { feature_perms });
      setUsers(prev => prev.map(u => u.u_code === u_code ? { ...u, feature_perms } : u));
      message.success(`Updated ${u_code}`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to update permissions');
    } finally {
      setSavingCode(null);
    }
  };

  const columns = [
    { title: 'Code', dataIndex: 'u_code', key: 'u_code', width: 90 },
    { title: 'Name', dataIndex: 'u_name', key: 'u_name' },
    { title: 'Department', dataIndex: 'u_department', key: 'u_department', width: 110 },
    { title: 'Group', dataIndex: 'user_group', key: 'user_group', width: 90 },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 100 },
    {
      title: 'Feature Permissions',
      dataIndex: 'feature_perms',
      key: 'feature_perms',
      render: (perms, record) => (
        <Select
          mode="multiple"
          style={{ minWidth: 360, width: '100%' }}
          value={perms || []}
          loading={savingCode === record.u_code}
          disabled={savingCode === record.u_code}
          options={FEATURE_OPTIONS.map(f => ({ value: f.value, label: f.label }))}
          onChange={(val) => handleChange(record.u_code, val)}
          tagRender={({ value, closable, onClose }) => (
            <Tag color={FEATURE_LABEL[value]?.color} closable={closable} onClose={onClose} style={{ marginRight: 3 }}>
              {value}
            </Tag>
          )}
        />
      ),
    },
  ];

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" />
      <Layout style={{ backgroundColor: theme.colors.background }}>
        <Content className="kb-vscroll" style={{ padding: 24, overflowY: 'auto', height: 'calc(100vh - 64px)' }}>
          {forbidden ? (
            <Result status="403" title="Access Denied" subTitle="Permission management is restricted to AD admins." />
          ) : (
            <>
              <Title level={4} style={{ color: theme.colors.text, marginBottom: 16 }}>Permissions Config</Title>
              <Card style={{ background: theme.colors.cardBackground }}>
                <Table
                  rowKey="u_code"
                  loading={loading}
                  dataSource={sortedUsers}
                  columns={columns}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  size="middle"
                />
              </Card>
            </>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default PermissionsConfigPage;
