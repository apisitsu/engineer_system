import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Table, Button, Input, Tag, Space, Typography, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { revLabel } from './RecordSheet';
import RecordEditor, { emptyRecord } from './RecordEditor';
import { recordFormApi, errMsg } from './recordFormApi';

const { Content } = Layout;
const STATUS = { draft: ['default', 'Draft'], printed: ['blue', 'Printed'], recorded: ['green', 'Recorded'] };

export default function RecordFormPage() {
  const { theme } = useTheme();
  const [templates, setTemplates] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const loadTemplates = useCallback(async () => {
    try { setTemplates(await recordFormApi.listTemplates()); } catch (e) { message.error(errMsg(e)); }
  }, []);
  const loadRows = useCallback(async () => {
    setLoading(true);
    try { setRows(await recordFormApi.listRecords({ q: q || undefined })); }
    catch (e) { message.error(errMsg(e)); } finally { setLoading(false); }
  }, [q]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);
  useEffect(() => { loadRows(); }, [loadRows]);

  const open = async id => {
    try { setEditing(await recordFormApi.getRecord(id)); } catch (e) { message.error(errMsg(e)); }
  };
  const remove = async id => {
    try { await recordFormApi.deleteRecord(id); message.success('Deleted'); loadRows(); } catch (e) { message.error(errMsg(e)); }
  };

  // Sorting happens in the browser (the whole list is loaded). Blanks always sort last.
  const by = key => (x, y) => {
    const a = x[key], b = y[key];
    if (a == null || a === '') return b == null || b === '' ? 0 : 1;
    if (b == null || b === '') return -1;
    return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
  };
  const sortable = key => ({ sorter: by(key), sortDirections: ['ascend', 'descend'] });
  const columns = [
    { title: 'Lot No.', dataIndex: 'lot_no', ...sortable('lot_no'), render: (v, r) => <Button type="link" style={{ padding: 0 }} onClick={() => open(r.id)}>{v || '-'}</Button> },
    { title: 'C/N', dataIndex: 'control_no', ...sortable('control_no') },
    { title: 'P/N', dataIndex: 'parts_no', ...sortable('parts_no') },
    { title: 'Drawing Rev.', dataIndex: 'drawing_rev', ...sortable('drawing_rev') },
    { title: 'Rev.', dataIndex: 'record_rev', width: 70, ...sortable('record_rev'), render: v => revLabel(v) },
    { title: 'Status', dataIndex: 'status', ...sortable('status'), render: s => <Tag color={STATUS[s][0]}>{STATUS[s][1]}</Tag> },
    { title: 'Established', dataIndex: 'established_date', defaultSortOrder: 'descend', ...sortable('established_date'), render: v => String(v || '').slice(0, 10) },
    { title: 'Created by', dataIndex: 'created_by_name', ...sortable('created_by_name') },
    { title: 'Updated', dataIndex: 'updated_at', ...sortable('updated_at'), render: v => String(v || '').replace('T', ' ').slice(0, 16) },
    { title: '', width: 50, render: (_, r) => (
      <Popconfirm title="Delete this record?" onConfirm={() => remove(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>) },
  ];

  const list = (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input.Search allowClear style={{ width: 260 }} placeholder="Search Lot / C/N / P/N" onSearch={setQ} />
        <Button type="primary" icon={<PlusOutlined />} disabled={!templates.length}
          onClick={() => setEditing(emptyRecord((templates.find(t => t.is_default) || templates[0]).id))}>New Record</Button>
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 20 }} />
    </>
  );

  return (
    <Layout style={{ overflow: 'hidden' }}>
      <MenuTemplate type="Process" />
      <Layout style={{ backgroundColor: theme.colors.background, height: 'calc(100vh - 64px)' }}>
        <Content style={{ padding: 24, overflow: 'auto' }}>
          <Typography.Title level={2} style={{ marginTop: 0 }}>Record for New Model / Item</Typography.Title>
          {editing ? (
            <RecordEditor key={editing.id ?? 'new'} initial={editing} templates={templates}
              onBack={() => { setEditing(null); loadRows(); }} onSaved={loadRows} />
          ) : (
            list
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
