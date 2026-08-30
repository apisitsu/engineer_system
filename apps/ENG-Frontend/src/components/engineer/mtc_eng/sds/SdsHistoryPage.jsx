import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Table, Tag, Input, Select, DatePicker, Button, Space, Tabs, Tooltip, Typography, App } from 'antd';
import { ReloadOutlined, PrinterOutlined, SafetyCertificateOutlined, UndoOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';

const { Content } = Layout;
const { Text } = Typography;
const { RangePicker } = DatePicker;

// Colours come from the active theme rather than a fixed dark palette — the app ships nine
// of them and a page that hardcodes #0f1419 is unreadable in every light one. The mapping
// below is the only place that decides how this page uses them, so a theme change needs no
// edit here.
//
// `textSecondary` carries real content on this page (timestamps, part names, departments),
// not hints, so it is used where a lesser tone would fail to read; `textTertiary` is kept
// for the genuinely incidental — hashes, byte counts, empty markers.
const useColors = () => {
  const { theme } = useTheme();
  const c = theme?.colors || {};
  return {
    bg: c.background || '#0f1419',
    panel: c.surface || '#161b22',
    border: c.border || '#22303c',
    textPri: c.textPrimary || '#f0f6fc',
    textSec: c.textSecondary || '#c9d1d9',
    textDim: c.textTertiary || '#9aa5b1',
    accent: c.primary || '#39d9f0',
  };
};

// Full date AND time everywhere: an evidentiary log is read by someone reconstructing a
// day, so "13:19" alone is useless a week later.
const stamp = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const StampCell = ({ value }) => {
  const C = useColors();
  const s = stamp(value);
  if (!s) return <Text style={{ color: C.textDim }}>—</Text>;
  const [day, time] = s.split(' ');
  return (
    <div style={{ lineHeight: 1.3 }}>
      <div style={{ color: C.textPri, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{day}</div>
      <div style={{ color: C.textSec, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{time}</div>
    </div>
  );
};

const PAGE_SIZES = ['25', '50', '100', '200'];

// ── Tab 1 · print history ─────────────────────────────────────────────────────
function PrintHistoryTab() {
  const C = useColors();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [f, setF] = useState({ cn: '', machine: '', process: '', lot: '', range: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      ['cn', 'machine', 'process', 'lot'].forEach((k) => { if (f[k]) params[k] = f[k]; });
      if (f.range?.[0]) params.from = f.range[0].format('YYYY-MM-DD');
      if (f.range?.[1]) params.to = f.range[1].format('YYYY-MM-DD');
      const { data } = await axios.get(server.MTC_SDS_V2_PRINT_LOG, { params });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, [page, limit, f, message]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(server.MTC_SDS_V2_PRINT_LOG_FACETS).then(({ data }) => setFacets(data)).catch(() => {});
  }, []);

  const set = (k) => (v) => { setPage(1); setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v })); };
  const resetFilters = () => { setPage(1); setF({ cn: '', machine: '', process: '', lot: '', range: null }); };

  const columns = [
    { title: 'CN', dataIndex: 'cn', width: 115, fixed: 'left',
      render: (v, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ color: C.accent, fontWeight: 700 }}>{v}</div>
          <div style={{ color: C.textSec, fontSize: 11 }}>{r.item_no}</div>
        </div>) },
    { title: 'Part No', dataIndex: 'parts_no', width: 175,
      render: (v, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ color: C.textPri, fontSize: 12 }}>{v || '—'}</div>
          <div style={{ color: C.textSec, fontSize: 11 }}>{r.parts_name || ''}</div>
        </div>) },
    { title: 'Lot', dataIndex: 'lot_no', width: 125,
      // The three states stay distinct: "not supplied" is a different fact from "supplied
      // and not found in the plan", and collapsing them would hide the doubtful rows.
      render: (v, r) => {
        if (!v) return <Tag color="default">Not supplied</Tag>;
        return r.lot_verified
          ? <Tooltip title="Matches the production plan"><Tag color="green">{v}</Tag></Tooltip>
          : <Tooltip title="Supplied but not found in the production plan"><Tag color="orange">{v} ⚠</Tag></Tooltip>;
      } },
    { title: 'Machine', dataIndex: 'machine_type_name', width: 150,
      // The model is what the sheet was rendered for; the floor code is the machine that
      // will actually run it. One model covers up to nine machines, so the code cannot be
      // recovered from the model — it shows only when the caller named one.
      render: (v, r) => (
        <div style={{ lineHeight: 1.3 }}>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{v}</Tag>
          {r.machine_code && (
            <div style={{ color: C.textSec, fontSize: 11, marginTop: 2 }}>{r.machine_code}</div>
          )}
        </div>) },
    { title: 'Process', dataIndex: 'process_code', width: 85,
      render: (v) => <Tag>{v || '—'}</Tag> },
    { title: 'Date / Time', dataIndex: 'printed_at', width: 125,
      render: (v) => <StampCell value={v} /> },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear placeholder="CN or item no." style={{ width: 180 }} value={f.cn} onChange={set('cn')} onPressEnter={load} />
        <Input allowClear placeholder="Lot" style={{ width: 140 }} value={f.lot} onChange={set('lot')} onPressEnter={load} />
        <Select allowClear showSearch placeholder="Machine or code" style={{ width: 185 }}
          value={f.machine || undefined} onChange={set('machine')}
          // Models and floor codes in one list: a user knows the sheet by whichever they
          // have in front of them, and the backend matches the box against both columns.
          options={[
            ...(facets.machines || []).map((m) => ({ value: m, label: m })),
            ...(facets.machine_codes || []).map((m) => ({ value: m, label: m })),
          ]} />
        <Select allowClear placeholder="Process" style={{ width: 120 }} value={f.process || undefined} onChange={set('process')}
          options={(facets.processes || []).map((p) => ({ value: p, label: p }))} showSearch />
        <RangePicker value={f.range} onChange={set('range')} />
        <Button icon={<ReloadOutlined />} onClick={load}>Search</Button>
        <Button icon={<UndoOutlined />} onClick={resetFilters}>Reset filters</Button>
      </Space>

      <Table
        size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns}
        scroll={{ x: 870 }}
        expandable={{
          // The fixture list AS PRINTED. This is the field that answers "was that sheet the
          // same as this one" — pdf_sha256 cannot, because Chrome stamps a generation
          // timestamp into every PDF, so two renders one second apart already differ.
          expandedRowRender: (r) => (
            <div style={{ padding: '4px 8px' }}>
              <Space wrap size={[6, 6]}>
                {(r.tooling_snapshot || []).map((t) => (
                  <Tag key={t.slot} color="purple" style={{ margin: 0 }}>
                    <b>{t.slot}</b> {t.name}{t.dwg ? ` · ${t.dwg}` : ''}
                  </Tag>
                ))}
                {!r.tooling_snapshot?.length && <Text style={{ color: C.textSec }}>No tooling on this sheet</Text>}
              </Space>
              <div style={{ marginTop: 6, color: C.textDim, fontSize: 11 }}>
                SHA-256 <code style={{ color: C.textSec }}>{r.pdf_sha256 || '—'}</code>
                {r.pdf_bytes ? ` · ${Number(r.pdf_bytes).toLocaleString()} bytes` : ''}
                {r.client_ip ? ` · IP ${r.client_ip}` : ''}
              </div>
            </div>
          ),
        }}
        pagination={{
          current: page, pageSize: limit, total, showSizeChanger: true, pageSizeOptions: PAGE_SIZES,
          showTotal: (t) => `${t.toLocaleString()} records`,
          onChange: (p, s) => { setPage(p); setLimit(s); },
        }}
      />
    </>
  );
}

// ── Tab 2 · approval history ──────────────────────────────────────────────────
const STATUS_META = {
  complete:          { color: 'green',   label: 'Fully signed' },
  awaiting_approved: { color: 'gold',    label: 'Awaiting Approved' },
  awaiting_checked:  { color: 'orange',  label: 'Awaiting Checked' },
  unsigned:          { color: 'default', label: 'Unsigned' },
};

const SignCell = ({ name, emId, dept, at }) => {
  const C = useColors();
  if (!at) return <Text style={{ color: C.textDim }}>—</Text>;
  return (
    <div style={{ lineHeight: 1.3 }}>
      <div style={{ color: C.textPri, fontSize: 12, fontWeight: 600 }}>{name || emId || '—'}</div>
      {dept && <div style={{ color: C.textSec, fontSize: 11 }}>{dept}</div>}
      <div style={{ color: C.textSec, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{stamp(at)}</div>
    </div>
  );
};

function ApprovalHistoryTab() {
  const C = useColors();
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [facets, setFacets] = useState({});
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [f, setF] = useState({ cn: '', machine: '', process: '', role: '', signer: '', status: '', range: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      ['cn', 'machine', 'process', 'role', 'signer', 'status'].forEach((k) => { if (f[k]) params[k] = f[k]; });
      if (f.range?.[0]) params.from = f.range[0].format('YYYY-MM-DD');
      if (f.range?.[1]) params.to = f.range[1].format('YYYY-MM-DD');
      const { data } = await axios.get(server.MTC_SDS_V2_APPROVAL_HISTORY, { params });
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }, [page, limit, f, message]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    axios.get(server.MTC_SDS_V2_APPROVAL_HISTORY_FACETS).then(({ data }) => setFacets(data)).catch(() => {});
  }, []);

  const set = (k) => (v) => { setPage(1); setF((p) => ({ ...p, [k]: v?.target ? v.target.value : v })); };
  const resetFilters = () => { setPage(1); setF({ cn: '', machine: '', process: '', role: '', signer: '', status: '', range: null }); };

  const columns = [
    { title: 'CN', dataIndex: 'cn', width: 115, fixed: 'left',
      render: (v) => <span style={{ color: C.accent, fontWeight: 700 }}>{v}</span> },
    { title: 'Machine', dataIndex: 'machine_type_name', width: 135,
      render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Process', dataIndex: 'process_code', width: 85, render: (v) => <Tag>{v || '—'}</Tag> },
    { title: 'Rev', dataIndex: 'sds_rev', width: 70,
      render: (v) => <Text style={{ color: C.textSec, fontSize: 12 }}>{v || '—'}</Text> },
    { title: 'Prepared', width: 160,
      render: (_, r) => <SignCell name={r.prepared_name} emId={r.prepared_em_id} dept={r.prepared_dept} at={r.prepared_at} /> },
    { title: 'Checked', width: 160,
      render: (_, r) => <SignCell name={r.checked_name} emId={r.checked_em_id} dept={r.checked_dept} at={r.checked_at} /> },
    { title: 'Approved', width: 160,
      render: (_, r) => <SignCell name={r.approved_name} emId={r.approved_em_id} dept={r.approved_dept} at={r.approved_at} /> },
    { title: 'Status', dataIndex: 'status', width: 155,
      render: (v) => <Tag color={(STATUS_META[v] || {}).color}>{(STATUS_META[v] || {}).label || v}</Tag> },
    { title: 'Last signed', dataIndex: 'last_signed_at', width: 125,
      render: (v) => <StampCell value={v} /> },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input allowClear placeholder="CN" style={{ width: 160 }} value={f.cn} onChange={set('cn')} onPressEnter={load} />
        <Input allowClear placeholder="Signer name or ID" style={{ width: 200 }} value={f.signer} onChange={set('signer')} onPressEnter={load} />
        <Select allowClear placeholder="Machine" style={{ width: 165 }} value={f.machine || undefined} onChange={set('machine')}
          options={(facets.machines || []).map((m) => ({ value: m, label: m }))} showSearch />
        <Select allowClear placeholder="Process" style={{ width: 120 }} value={f.process || undefined} onChange={set('process')}
          options={(facets.processes || []).map((p) => ({ value: p, label: p }))} showSearch />
        <Select allowClear placeholder="Signed stage" style={{ width: 145 }} value={f.role || undefined} onChange={set('role')}
          options={[{ value: 'prepared', label: 'Prepared' }, { value: 'checked', label: 'Checked' }, { value: 'approved', label: 'Approved' }]} />
        <Select allowClear placeholder="Status" style={{ width: 180 }} value={f.status || undefined} onChange={set('status')}
          options={Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))} />
        <RangePicker value={f.range} onChange={set('range')} />
        <Button icon={<ReloadOutlined />} onClick={load}>Search</Button>
        <Button icon={<UndoOutlined />} onClick={resetFilters}>Reset filters</Button>
      </Space>

      <Table
        size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns}
        scroll={{ x: 1165 }}
        pagination={{
          current: page, pageSize: limit, total, showSizeChanger: true, pageSizeOptions: PAGE_SIZES,
          showTotal: (t) => `${t.toLocaleString()} records`,
          onChange: (p, s) => { setPage(p); setLimit(s); },
        }}
      />
    </>
  );
}

/**
 * SDS History — two read-only views of what actually happened to a Setup Data Sheet.
 *
 * They sit on one page because they answer halves of the same question. The print log says
 * a sheet left the system: for which part and lot, from which computer, with which fixtures
 * on it. The approval log says who put their name to it. An auditor holding a printed sheet
 * needs both, and previously neither was visible anywhere.
 */
export default function SdsHistoryPage() {
  const C = useColors();
  const [tab, setTab] = useState('print');
  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-history" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: C.accent, fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>
              SDS History
              <SystemVersionBadge system="sds-history" dark />
            </div>
            <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
              Setup Data Sheet print and approval records
            </div>
          </div>

          <Tabs
            activeKey={tab} onChange={setTab}
            items={[
              { key: 'print', label: <span><PrinterOutlined /> Print History</span>, children: <PrintHistoryTab /> },
              { key: 'approval', label: <span><SafetyCertificateOutlined /> Approval History</span>, children: <ApprovalHistoryTab /> },
            ]}
            // Both tabs page independently and refetch on every filter change, so keeping the
            // inactive one mounted would leave a stale table in memory for no benefit.
            destroyOnHidden
          />
        </Content>
      </Layout>
    </Layout>
  );
}
