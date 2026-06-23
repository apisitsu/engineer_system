import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Modal, Form, Input, Select,
  Space, Popconfirm, message, Typography, Tag,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';

const { Title, Text } = Typography;

// The rotary dresser is stored/printed in its DD#### form (e.g. DD0226). DD#### = the 4800-42
// suffix, so DD0226 ⇄ 4800-42-0226 — shown as a faint reference next to the DD value.
const dwgRefOf = (dd) => {
  const m = /^DD0*(\d+)$/i.exec(String(dd || '').trim());
  return m ? `4800-42-${m[1].padStart(4, '0')}` : '';
};

/**
 * Admin for `tooling_partno_map` — Part No → tool DWG lookup for fixtures selected by
 * workpiece part number (品番) instead of a dimensional formula (e.g. ROTARY DRESSER
 * 4800-42 on KS-400B5/B6). Used by the SDS PDF to fill that tool slot.
 */
export default function PartNoMapManager() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ machines: [], toolings: [] });
  const [filter, setFilter] = useState({ machine_name: undefined, tooling_name: undefined, parts_no: '' });
  const [modal, setModal] = useState({ open: false, record: null });
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.machine_name) params.machine_name = filter.machine_name;
      if (filter.tooling_name) params.tooling_name = filter.tooling_name;
      if (filter.parts_no?.trim()) params.parts_no = filter.parts_no.trim();
      const res = await axios.get(server.TSV2_PARTNO_MAP, { headers, params });
      setRows(res.data.rows || []);
    } catch {
      message.error('Failed to load Part No map');
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

  const loadMeta = useCallback(async () => {
    try {
      const res = await axios.get(`${server.TSV2_PARTNO_MAP}/meta`, { headers });
      setMeta({ machines: res.data.machines || [], toolings: res.data.toolings || [] });
    } catch { /* non-fatal */ }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      machine_name: filter.machine_name || 'KS-400B5',
      tooling_name: filter.tooling_name || 'ROTARY DRESSER',
    });
    setModal({ open: true, record: null });
  };

  const openEdit = (record) => {
    form.setFieldsValue(record);
    setModal({ open: true, record });
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (modal.record) {
        // is_forbidden / note / source are not on the form — carry the existing values
        // through so an edit doesn't reset them to defaults.
        const payload = {
          is_forbidden: modal.record.is_forbidden,
          note: modal.record.note,
          source: modal.record.source,
          ...values,
        };
        await axios.put(`${server.TSV2_PARTNO_MAP}/${modal.record.id}`, payload, { headers });
        message.success('Updated');
      } else {
        await axios.post(server.TSV2_PARTNO_MAP, values, { headers });
        message.success('Created');
      }
      setModal({ open: false, record: null });
      load();
      loadMeta();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to save');
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${server.TSV2_PARTNO_MAP}/${id}`, { headers });
      message.success('Deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const columns = [
    { title: 'Machine', dataIndex: 'machine_name', key: 'machine_name', width: 120,
      render: v => <Tag color="geekblue">{v}</Tag> },
    { title: 'Tooling', dataIndex: 'tooling_name', key: 'tooling_name', width: 150 },
    { title: 'Part No (品番)', dataIndex: 'parts_no', key: 'parts_no', width: 200,
      render: v => <Text strong copyable>{v}</Text> },
    { title: 'Tool No (DD)', dataIndex: 'tool_dwg_no', key: 'tool_dwg_no', width: 200,
      render: v => (
        <span>
          <Text code copyable strong>{v}</Text>
          {dwgRefOf(v) && <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>({dwgRefOf(v)})</Text>}
        </span>
      ) },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Confirm delete?" onConfirm={() => remove(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Part No → Tool Map</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Fixtures selected by workpiece part number instead of a formula (e.g. ROTARY DRESSER). Used by the SDS PDF.
          </Text>
        </div>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>Add Mapping</Button>
      </div>

      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          allowClear placeholder="Machine" style={{ width: 160 }}
          value={filter.machine_name}
          options={meta.machines.map(m => ({ value: m, label: m }))}
          onChange={v => setFilter(f => ({ ...f, machine_name: v }))}
        />
        <Select
          allowClear placeholder="Tooling" style={{ width: 180 }}
          value={filter.tooling_name}
          options={meta.toolings.map(t => ({ value: t, label: t }))}
          onChange={v => setFilter(f => ({ ...f, tooling_name: v }))}
        />
        <Input.Search
          allowClear placeholder="Part No contains…" style={{ width: 220 }}
          value={filter.parts_no}
          onChange={e => setFilter(f => ({ ...f, parts_no: e.target.value }))}
          onSearch={load}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        <Text type="secondary">{rows.length} rows</Text>
      </Space>

      <Table
        rowKey="id" dataSource={rows} columns={columns} loading={loading}
        size="small" scroll={{ x: 1000 }}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: t => `${t} mappings` }}
      />

      <Modal
        title={modal.record ? 'Edit Mapping' : 'Add Mapping'}
        open={modal.open}
        onOk={save}
        onCancel={() => setModal({ open: false, record: null })}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="machine_name" label="Machine" rules={[{ required: true }]}>
              <Select
                showSearch
                options={(meta.machines.length ? meta.machines : ['KS-400B5', 'KS-400B6']).map(m => ({ value: m, label: m }))}
                placeholder="KS-400B5"
              />
            </Form.Item>
            <Form.Item name="tooling_name" label="Tooling Name" rules={[{ required: true }]}>
              <Input placeholder="ROTARY DRESSER" />
            </Form.Item>
          </div>
          <Form.Item name="parts_no" label="Part No (品番)" rules={[{ required: true }]}>
            <Input placeholder="e.g. 3HTY6VP-60B-T" />
          </Form.Item>
          <Form.Item name="tool_dwg_no" label="Tool No (DD)" rules={[{ required: true }]}
            tooltip="Enter the DD#### form (e.g. DD0226). 4800-42-0226 is also accepted and auto-converted to DD0226. This is what prints on the SDS sheet.">
            <Input placeholder="e.g. DD0226" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
