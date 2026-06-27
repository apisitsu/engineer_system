import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Popconfirm,
  Space, Tag, App, Switch, Alert, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Text } = Typography;

// Who may sign each SDS approval role. Admins (dept|role 'AD') can always sign
// regardless of these rows; this table grants signing to non-admins.
const ROLE_OPTIONS = [
  { value: 'prepared', label: 'PREPARED' },
  { value: 'checked', label: 'CHECKED' },
  { value: 'approved', label: 'APPROVED' },
];
const ROLE_COLOR = { prepared: 'blue', checked: 'gold', approved: 'red' };

const MATCH_OPTIONS = [
  { value: 'any', label: 'ทุกคน (any)' },
  { value: 'department', label: 'ตามแผนก (department)' },
  { value: 'role', label: 'ตาม role' },
  { value: 'feature_perm', label: 'ตาม feature permission' },
  { value: 'em_id', label: 'รายบุคคล (employee no)' },
];
const MATCH_HINT = {
  department: 'เช่น Engineering',
  role: "เช่น AD",
  feature_perm: 'เช่น sds_admin',
  em_id: 'Employee No เช่น T1460',
};

const ApprovalRoleConfig = ({ theme }) => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const matchType = Form.useWatch('match_type', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_APPROVAL_ROLE_CONFIG);
      setRows(res.data?.config || []);
    } catch {
      message.error('Load failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { form.resetFields(); setModalOpen(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      await axios.post(server.MTC_SDS_V2_APPROVAL_ROLE_CONFIG, {
        role: vals.role,
        match_type: vals.match_type,
        match_value: vals.match_type === 'any' ? null : vals.match_value?.trim(),
        note: vals.note?.trim() || null,
      });
      message.success('Added');
      setModalOpen(false);
      load();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (row) => {
    try {
      await axios.put(`${server.MTC_SDS_V2_APPROVAL_ROLE_CONFIG}/${row.id}`, { enabled: !row.enabled });
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Update failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${server.MTC_SDS_V2_APPROVAL_ROLE_CONFIG}/${id}`);
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const columns = [
    {
      title: 'Role', dataIndex: 'role', width: 130,
      render: (r) => <Tag color={ROLE_COLOR[r]} style={{ width: 84, textAlign: 'center' }}>{r?.toUpperCase()}</Tag>,
      sorter: (a, b) => a.role.localeCompare(b.role),
    },
    {
      title: 'Match Type', dataIndex: 'match_type', width: 160,
      render: (v) => MATCH_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    {
      title: 'Match Value', dataIndex: 'match_value',
      render: (v) => v ? <code>{v}</code> : <span style={{ color: '#999' }}>— (ทุกคน)</span>,
    },
    {
      title: 'Enabled', dataIndex: 'enabled', width: 90, align: 'center',
      render: (v, row) => <Switch size="small" checked={!!v} onChange={() => toggleEnabled(row)} />,
    },
    { title: 'Note', dataIndex: 'note', render: (v) => v || '' },
    {
      title: '', width: 60, align: 'center',
      render: (_, row) => (
        <Popconfirm title="ลบ rule นี้?" onConfirm={() => handleDelete(row.id)} okText="ลบ" okType="danger">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message="กำหนดสิทธิ์การเซ็น SDS (Prepared / Checked / Approved)"
        description={
          <Text type="secondary" style={{ fontSize: 12 }}>
            แต่ละ rule ให้สิทธิ์ "ผู้ที่ตรงเงื่อนไข" เซ็น role นั้นได้ (รวมกันแบบ OR หลาย rule).
            ผู้ดูแลระบบ (department/role = AD) เซ็นได้ทุก role อยู่แล้วโดยไม่ต้องมี rule.
          </Text>
        }
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>Add Rule</Button>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Reload</Button>
        <span style={{ marginLeft: 'auto', color: theme?.colors?.textSecondary || '#666', alignSelf: 'center' }}>
          {rows.length} rules
        </span>
      </div>

      <Table
        dataSource={rows.map((r) => ({ ...r, key: r.id }))}
        columns={columns}
        loading={loading}
        size="small"
        pagination={false}
      />

      <Modal
        title="Add Approval Role Rule"
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Add"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ match_type: 'department' }}>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="เลือก role" options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="match_type" label="Match Type" rules={[{ required: true, message: 'Required' }]}>
            <Select options={MATCH_OPTIONS} />
          </Form.Item>
          {matchType !== 'any' && (
            <Form.Item name="match_value" label="Match Value" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder={MATCH_HINT[matchType] || ''} />
            </Form.Item>
          )}
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalRoleConfig;
