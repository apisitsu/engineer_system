import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout, Tabs, Select, Button, Space, Typography, Table, Tag, Empty, Statistic,
  Row, Col, Card, Input, InputNumber, DatePicker, Checkbox, Popconfirm, App,
} from 'antd';
import {
  ClearOutlined, ReloadOutlined, EditOutlined, SaveOutlined, CloseOutlined,
  PlusOutlined, DeleteOutlined, DownloadOutlined, CheckOutlined, SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';

// Same status list as the backend's pbringConstants.STATUS — kept in sync by hand,
// same way the prototype's own STATUS array was a plain shared constant.
const STATUS_OPTIONS = [
  'Received', 'Wait Receive', 'Wait Request Quotation', 'Wait DWG Tooling (BBBU)',
  'Wait DWG Tooling (ROD THAI)', 'Wait DWG Tooling (ROD KZW)', 'UNUSED', 'Unknown',
].map((s) => ({ value: s, label: s }));

// 'cn' is edited at the Part No. group level (one CN per part, see saveGroupCn),
// not per tooling row — it's dropped from the per-row editable set here even
// though the backend's own EDITABLE_FIELDS still allows a PUT to set it.
const EDITABLE_FIELDS = ['tooling_item', 'tool_code', 'maker', 'po_no', 'order_qty', 'unit_price', 'receive_date', 'status'];

// Mirrors the backend's pbringConstants.RECEIVED_BUT_INCOMPLETE sentinel — the
// one status card shown in the Outer/Inner Ring row instead of with the rest
// of the status cards (see the render below).
const INCOMPLETE_COST = '__RU__';

// "33" / "HW33" / "hw#33" -> "HW#33" — same loose parse as the prototype's hwVal().
const hwVal = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? `HW#${digits.padStart(2, '0')}` : '';
};

// Part No. convention for PB Ring: an Outer ring's number starts with "2" or
// "K" (e.g. "2K118526-T"); an Inner ring's starts with "3" (e.g. "3L117548-T",
// which is covered by the plain "3" check — "3L" is not a separate prefix).
const guessPartName = (partNo) => {
  const p = String(partNo || '').trim().toUpperCase();
  if (p.startsWith('2') || p.startsWith('K')) return 'Outer Ring';
  if (p.startsWith('3')) return 'Inner Ring';
  return '';
};

const { Content } = Layout;
const { Text } = Typography;

/**
 * PB Ring Tooling Manager — DB-backed port of the standalone tooling_manager.html
 * prototype. Independent of the live SDS pipeline / Tooling Select: every byte
 * here comes from `pbring_*` tables via `/api/engineer/pbring/*`.
 */

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

const fmt = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const statusTagColor = (s) => (s === 'Received' ? 'success' : s === 'UNUSED' || s === 'Unknown' ? 'default' : 'warning');

/** One filter/status chip — a small bordered stat tile, not a plain Button+Tag. */
function StatCard({ label, count, selected, onClick, C, color }) {
  const accent = color || C.accent;
  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer', minWidth: 148, padding: '8px 14px', borderRadius: 8,
        border: `1px solid ${selected ? accent : (color || C.border)}`,
        background: selected ? accent : C.panel,
        transition: 'all 0.15s',
      }}
    >
      <div style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.85)' : (color || C.textDim), whiteSpace: 'nowrap', fontWeight: color ? 600 : 400 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: selected ? '#fff' : (color || C.textPri) }}>{count}</div>
    </div>
  );
}

function SearchTab({ C }) {
  const { message } = App.useApp();
  const [hw, setHw] = useState(null);
  const [pc, setPc] = useState(null);
  const [mc, setMc] = useState(null);
  const [status, setStatus] = useState(null);
  const [ring, setRing] = useState(null);
  const [alert, setAlert] = useState(null);

  const [filterOptions, setFilterOptions] = useState({ hw: [], processCode: [], machine: [], statusCards: [], ringCards: [], costAlertCard: null });
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const res = await axios.get(server.PBRING_FILTERS, { params: { hw, pc, mc, status, ring } });
      setFilterOptions(res.data || { hw: [], processCode: [], machine: [], statusCards: [], ringCards: [], costAlertCard: null });
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load filters');
    } finally {
      setLoadingFilters(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hw, pc, mc, status, ring, message]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  const runSearch = useCallback(async () => {
    if (!hw && !pc && !mc) { setResult(null); return; }
    setLoadingSearch(true);
    try {
      const res = await axios.get(server.PBRING_SEARCH, { params: { hw, pc, mc, status, ring, alert } });
      setResult(res.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Search failed');
    } finally {
      setLoadingSearch(false);
    }
  }, [hw, pc, mc, status, ring, alert, message]);

  useEffect(() => { runSearch(); }, [runSearch]);

  const clearAll = () => { setHw(null); setPc(null); setMc(null); setStatus(null); setRing(null); setAlert(null); };

  const checkCostUpdates = async () => {
    setDetecting(true);
    try {
      const res = await axios.post(server.PBRING_COST_DETECT);
      message.success(`Checked ${res.data.checked} item(s) — ${res.data.detected} new cost update(s) found`);
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(err.response?.data?.message || 'Check failed');
    } finally {
      setDetecting(false);
    }
  };

  const approveDetected = async (record) => {
    try {
      await axios.post(`${server.PBRING_COST_PENDING}/${record.detected.id}/approve`);
      message.success(`Approved — ${record.tooling_item} updated from ${record.detected.po_no}`);
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(err.response?.data?.message || 'Approve failed');
    }
  };
  const rejectDetected = async (record) => {
    try {
      await axios.post(`${server.PBRING_COST_PENDING}/${record.detected.id}/reject`);
      message.success('Rejected');
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(err.response?.data?.message || 'Reject failed');
    }
  };

  const startEdit = (record) => {
    setEditingId(record.id);
    setEditDraft(Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, record[f]])));
  };
  const cancelEdit = () => { setEditingId(null); setEditDraft({}); };

  const saveEdit = async (id) => {
    setSaving(true);
    try {
      const patch = { ...editDraft };
      // Normalize whether the user touched the date picker (a dayjs object) or
      // left it as the ISO string the row arrived with — either way, re-derive
      // the calendar date dayjs would have displayed rather than passing a raw
      // ISO datetime straight to the DATE column (which would read its UTC date
      // part and silently shift a day for anything west of UTC).
      patch.receive_date = patch.receive_date ? dayjs(patch.receive_date).format('YYYY-MM-DD') : null;
      const res = await axios.put(`${server.PBRING_TOOLING}/${id}`, patch);
      setResult((r) => (r ? { ...r, tooling: r.tooling.map((row) => (row.id === id ? res.data.tooling : row)) } : r));
      message.success('Saved');
      setEditingId(null);
      setEditDraft({});
      // status/PO/price may have moved a row in/out of a status card's count —
      // refresh the cards and KPI without losing the current filter selection.
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };
  const deleteRow = async (record) => {
    try {
      await axios.delete(`${server.PBRING_TOOLING}/${record.id}`);
      setResult((r) => (r ? { ...r, tooling: r.tooling.filter((row) => row.id !== record.id) } : r));
      message.success('Deleted');
      loadFilters();
    } catch (err) {
      // The backend refuses to delete a row from the original Excel import —
      // that 400 lands here as a normal, expected message, not a bug.
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };
  const deleteHw = async () => {
    try {
      const res = await axios.delete(`${server.PBRING_HW}/${encodeURIComponent(hw)}`);
      message.success(
        res.data.protectedCount > 0
          ? `Deleted ${res.data.deletedCount} item(s) from ${hw} (${res.data.protectedCount} item(s) imported from the original Excel file were kept)`
          : `Deleted all of ${hw} (${res.data.deletedCount} item(s))`
      );
      clearAll();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  // Editable cell: shows the input bound to `editDraft` when this row is being
  // edited, the plain formatted value otherwise. `field` must be in EDITABLE_FIELDS.
  const editCell = (field, record, input) => {
    if (editingId !== record.id) return undefined; // let the column's own `render` show the value
    return input;
  };

  const toolingColumns = useMemo(() => [
    { title: 'HW', dataIndex: 'part_group', width: 70 },
    { title: 'Process', dataIndex: 'process_code', width: 110 },
    { title: 'M/C', render: (r) => `${r.mc_type || ''} ${r.mc_no || ''}`.trim(), width: 120 },
    {
      title: 'Item', dataIndex: 'tooling_item', width: 170,
      render: (v, r) => editCell('tooling_item', r,
        <Input size="small" value={editDraft.tooling_item ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, tooling_item: e.target.value }))} />
      ) ?? v,
    },
    {
      title: 'Tool code', dataIndex: 'tool_code', width: 170,
      render: (v, r) => editCell('tool_code', r,
        <Input size="small" value={editDraft.tool_code ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, tool_code: e.target.value }))} />
      ) ?? v,
    },
    {
      title: 'Maker', dataIndex: 'maker', width: 110,
      render: (v, r) => editCell('maker', r,
        <Input size="small" value={editDraft.maker ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, maker: e.target.value }))} />
      ) ?? v,
    },
    {
      title: 'PO', dataIndex: 'po_no', width: 110,
      render: (v, r) => editCell('po_no', r,
        <Input size="small" value={editDraft.po_no ?? ''} onChange={(e) => setEditDraft((d) => ({ ...d, po_no: e.target.value }))} />
      ) ?? v,
    },
    {
      title: 'Qty', dataIndex: 'order_qty', width: 80, align: 'right',
      render: (v, r) => editCell('order_qty', r,
        <InputNumber size="small" style={{ width: '100%' }} value={editDraft.order_qty} onChange={(n) => setEditDraft((d) => ({ ...d, order_qty: n }))} />
      ) ?? fmt(v),
    },
    {
      title: 'Unit price', dataIndex: 'unit_price', width: 110, align: 'right',
      render: (v, r) => editCell('unit_price', r,
        <InputNumber size="small" style={{ width: '100%' }} value={editDraft.unit_price} onChange={(n) => setEditDraft((d) => ({ ...d, unit_price: n }))} />
      ) ?? fmt(v),
    },
    { title: 'Total', dataIndex: 'total_price', width: 100, align: 'right', render: fmt },
    {
      title: 'Receive date', dataIndex: 'receive_date', width: 140,
      render: (v, r) => editCell('receive_date', r,
        <DatePicker
          size="small" format="YYYY-MM-DD"
          value={editDraft.receive_date ? dayjs(editDraft.receive_date) : null}
          onChange={(d) => setEditDraft((dr) => ({ ...dr, receive_date: d }))}
        />
      ) ?? (v ? dayjs(v).format('YYYY-MM-DD') : ''),
    },
    {
      title: 'Status', dataIndex: 'status', width: 190,
      render: (v, r) => editCell('status', r,
        <Select
          size="small" style={{ width: '100%' }} options={STATUS_OPTIONS}
          value={editDraft.status} onChange={(s) => setEditDraft((d) => ({ ...d, status: s }))}
        />
      ) ?? <Tag color={statusTagColor(v)}>{v || 'Unknown'}</Tag>,
    },
    {
      // Set only when `pbringCostDetectService.detectMissingCost()` matched
      // this row's tool_code against lpb.pc_material_purchase and nothing has
      // decided it yet — see the "Check for cost updates" button above the
      // table. Approve/reject call pbring_cost_pending directly, never a plain
      // field edit, so cost_source ends up 'maqdb' with who approved it on record.
      title: 'Cost Update Found', key: 'detected', width: 230,
      render: (_, r) => {
        if (!r.detected) return null;
        const d = r.detected;
        return (
          <Space direction="vertical" size={2}>
            <Tag color="orange" style={{ margin: 0 }}>
              PO {d.po_no} · Qty {fmt(d.qty)} · {fmt(d.price)} ฿{d.receive_date ? ` · ${dayjs(d.receive_date).format('YYYY-MM-DD')}` : ''}
            </Tag>
            <Space size={4}>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approveDetected(r)}>Approve</Button>
              <Button size="small" icon={<CloseOutlined />} onClick={() => rejectDetected(r)}>Reject</Button>
            </Space>
          </Space>
        );
      },
    },
    {
      // Delete is refused server-side for a row from the original Excel import
      // (`created_by` starts with 'import:') — shown here, not hidden, so the
      // reason is visible instead of the button just silently not being there.
      title: '', key: 'action', width: 130, fixed: 'right',
      render: (_, r) => (editingId === r.id ? (
        <Space>
          <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => saveEdit(r.id)} />
          <Button size="small" icon={<CloseOutlined />} disabled={saving} onClick={cancelEdit} />
        </Space>
      ) : (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => startEdit(r)} disabled={editingId != null} />
          <Popconfirm title={`Delete "${r.tooling_item}" from ${r.part_group} / ${r.part_no}?`} onConfirm={() => deleteRow(r)} okText="Delete" cancelText="Cancel">
            <Button size="small" danger icon={<DeleteOutlined />} disabled={editingId != null} />
          </Popconfirm>
        </Space>
      )),
    },
    // `loadFilters`/`runSearch` are listed (not just `editingId`/`editDraft`/
    // `saving`) so every row action below that calls them afterward —
    // save/delete/approve/reject — closes over the CURRENT hw/pc/mc/status/
    // ring/alert, not whatever they were the last time this memo happened to
    // recompute. Omitting them reproduced a real bug: approving a row while
    // a HW filter was active reloaded the UNFILTERED list instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [editingId, editDraft, saving, loadFilters, runSearch]);

  // CN and Part No. are the group header (below), not columns — every row
  // under one Part No. shares the same CN by construction (lpb.eng_item
  // resolves it 1:1), so repeating both on every row was pure noise.
  const toolingByPart = useMemo(() => {
    const groups = new Map();
    (result?.tooling || []).forEach((r) => {
      const key = r.part_no || '(no Part No.)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    });
    return [...groups.entries()];
  }, [result]);

  const incompleteCostCard = filterOptions.statusCards.find((c) => c.value === INCOMPLETE_COST);
  const restStatusCards = filterOptions.statusCards.filter((c) => c.value !== INCOMPLETE_COST);

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear showSearch style={{ width: 160 }} placeholder="HW"
          loading={loadingFilters} value={hw} onChange={setHw}
          options={filterOptions.hw} optionFilterProp="label"
        />
        <Select
          allowClear showSearch style={{ width: 300 }} placeholder="Process code"
          loading={loadingFilters} value={pc} onChange={setPc}
          options={filterOptions.processCode} optionFilterProp="label"
        />
        <Select
          allowClear showSearch style={{ width: 220 }} placeholder="Machine"
          loading={loadingFilters} value={mc} onChange={setMc}
          options={filterOptions.machine} optionFilterProp="label"
        />
        <Button icon={<ClearOutlined />} onClick={clearAll}>Clear Filters</Button>
        {hw && (
          <Popconfirm
            title={`Delete all of ${hw}?`}
            description="Only deletes items added through this app — items imported from the original Excel file are kept."
            onConfirm={deleteHw} okText="Delete" cancelText="Cancel"
          >
            <Button danger icon={<DeleteOutlined />}>Delete all {hw}</Button>
          </Popconfirm>
        )}
        <Button icon={<SyncOutlined spin={detecting} />} loading={detecting} onClick={checkCostUpdates}>
          Check for cost updates
        </Button>
        <ReloadOutlined onClick={loadFilters} style={{ cursor: 'pointer', color: C.textDim }} title="Refresh" />
      </Space>

      {filterOptions.costAlertCard && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <StatCard
            label={filterOptions.costAlertCard.label} count={filterOptions.costAlertCard.count} C={C}
            color="#d4720a"
            selected={alert === filterOptions.costAlertCard.value}
            onClick={() => setAlert((s) => (s === filterOptions.costAlertCard.value ? null : filterOptions.costAlertCard.value))}
          />
        </div>
      )}

      {(filterOptions.ringCards.length > 0 || incompleteCostCard) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          {filterOptions.ringCards.map((c) => (
            <StatCard
              key={c.value} label={c.label} count={c.count} C={C}
              selected={ring === c.value}
              onClick={() => setRing((s) => (s === c.value ? null : c.value))}
            />
          ))}
          {incompleteCostCard && (
            <StatCard
              label={incompleteCostCard.label} count={incompleteCostCard.count} C={C}
              selected={status === incompleteCostCard.value}
              onClick={() => setStatus((s) => (s === incompleteCostCard.value ? null : incompleteCostCard.value))}
            />
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {restStatusCards.map((c) => (
          <StatCard
            key={c.value} label={c.label} count={c.count} C={C}
            selected={status === c.value}
            onClick={() => setStatus((s) => (s === c.value ? null : c.value))}
          />
        ))}
      </div>

      {!result || result.empty ? (
        <Empty description="Select a HW, Process code, or Machine to show data" style={{ marginTop: 40 }} />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col><Statistic title="Setup Data Sheet" value={result.kpi.sdsParamCount} /></Col>
            <Col><Statistic title="Conditions from Setup Sheet" value={result.kpi.sdsConditionCount} /></Col>
            <Col><Statistic title="Tooling in list" value={result.kpi.toolingCount} /></Col>
            <Col><Statistic title="Received" value={`${result.kpi.received}/${result.kpi.toolingCount}`} /></Col>
            <Col><Statistic title="Total value (THB)" value={fmt(result.kpi.totalPrice)} /></Col>
          </Row>
          <Text type="secondary">{result.note}</Text>

          <Card
            size="small" style={{ marginBottom: 16 }}
            title={<Text strong>1) Tooling / Price / Status — {result.tooling.length} item(s)</Text>}
          >
            <div style={{ maxHeight: 480, overflowY: 'auto' }} className="kb-vscroll">
              {toolingByPart.length === 0 ? <Empty description="No tooling found" /> : toolingByPart.map(([partNo, rows]) => {
                const groupCn = rows[0]?.cn || '';
                return (
                  <div key={partNo} style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 8,
                        padding: '6px 16px', borderRadius: 6, background: C.accent,
                      }}
                    >
                      <Text strong style={{ color: '#fff', fontSize: 18 }}>{partNo}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>CN: {groupCn || '—'}</Text>
                    </div>
                    <Table
                      size="small" rowKey="id" dataSource={rows} columns={toolingColumns}
                      loading={loadingSearch} pagination={false} scroll={{ x: 1880, y: 340 }}
                    />
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Sections 2/3 (Tool/Wheel/Insert Used, Setup Data Sheet Parameters)
              are deliberately not shown right now — the goal is to make this
              look like the real Setup Data Sheet page itself (a separate
              PB-Ring-scoped instance of it), not a styled-alike section bolted
              onto this search tab. Revisit once that's designed; the data
              (pbring_sds_condition/pbring_sds_param, still in `result.conditions`
              / `result.params`) and KPI counts above are untouched. */}
        </>
      )}
    </>
  );
}

function AddHwTab() {
  const { message } = App.useApp();

  const [hw, setHw] = useState('');
  const [partNo, setPartNo] = useState('');
  const [partName, setPartName] = useState('');
  const [partNameTouched, setPartNameTouched] = useState(false);

  const [processCodes, setProcessCodes] = useState([]);
  const [machinesByPc, setMachinesByPc] = useState({}); // pc -> [machine]
  const [prows, setProws] = useState([{ pc: null, mc: null }]);
  const [draft, setDraft] = useState([]);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  useEffect(() => {
    axios.get(server.PBRING_HISTORY_PROCESS_CODES)
      .then((res) => setProcessCodes(res.data?.processCode || []))
      .catch((err) => message.error(err.response?.data?.message || 'Failed to load process codes'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMachinesFor = async (pc) => {
    if (!pc || machinesByPc[pc]) return;
    try {
      const res = await axios.get(server.PBRING_HISTORY_MACHINES, { params: { pc } });
      setMachinesByPc((m) => ({ ...m, [pc]: res.data?.machine || [] }));
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load machines');
    }
  };

  const setProwPc = (i, pc) => {
    setProws((p) => p.map((row, idx) => (idx === i ? { pc, mc: null } : row)));
    loadMachinesFor(pc);
  };
  const setProwMc = (i, mc) => setProws((p) => p.map((row, idx) => (idx === i ? { ...row, mc } : row)));
  const addProw = () => setProws((p) => [...p, { pc: null, mc: null }]);
  const removeLastProw = () => setProws((p) => (p.length > 1 ? p.slice(0, -1) : p));

  const draftKey = (d) => `${d.process_code}|${d.mc_type}|${String(d.tooling_item).trim().toUpperCase()}`;

  const loadTemplateFor = async (row, { silent } = {}) => {
    if (!row.pc || !row.mc) {
      if (!silent) message.warning('Select a Process code and Machine first');
      return 0;
    }
    try {
      const res = await axios.get(server.PBRING_HISTORY_TEMPLATE, { params: { pc: row.pc, mc: row.mc } });
      const incoming = res.data?.rows || [];
      setDraft((d) => {
        const existingKeys = new Set(d.map(draftKey));
        const add = incoming.filter((r) => !existingKeys.has(draftKey(r)));
        return [...d, ...add.map((r) => ({ ...r, _k: draftKey(r) + '|' + d.length + Math.random() }))];
      });
      return incoming.length;
    } catch (err) {
      message.error(err.response?.data?.message || `Failed to load history for ${row.pc}/${row.mc}`);
      return 0;
    }
  };

  const loadAllTemplates = async () => {
    const ready = prows.filter((p) => p.pc && p.mc);
    if (!ready.length) { message.warning('Select a Process code and Machine for at least one row'); return; }
    setBusy(true);
    try {
      let total = 0;
      for (const row of ready) total += await loadTemplateFor(row, { silent: true });
      setInfo(`Loaded from ${ready.length} row(s): found ${total} item(s)`);
    } finally {
      setBusy(false);
    }
  };

  const updateDraft = (k, field, value) => setDraft((d) => d.map((row) => (row._k === k ? { ...row, [field]: value } : row)));
  const removeDraftRow = (k) => setDraft((d) => d.filter((row) => row._k !== k));
  const clearDraft = () => { setDraft([]); setInfo(''); };

  const resetForm = () => {
    setHw(''); setPartNo(''); setPartName(''); setPartNameTouched(false);
    setProws([{ pc: null, mc: null }]);
    clearDraft();
  };

  const onPartNoChange = (v) => {
    setPartNo(v);
    if (!partNameTouched) setPartName(guessPartName(v));
  };
  const onPartNameChange = (v) => {
    setPartName(v);
    // Same rule as the prototype's own hint: an emptied field re-enables
    // auto-detect on the next Part No. change, a non-empty one "sticks".
    setPartNameTouched(v.trim() !== '');
  };

  const submit = async (force = false) => {
    const partGroup = hwVal(hw);
    const rows = draft.filter((d) => d.use && String(d.tooling_item || '').trim());
    if (!partGroup || !partNo.trim()) { message.warning('Please enter HW and Part No.'); return; }
    if (!rows.length) { message.warning('No items selected'); return; }
    setBusy(true);
    try {
      // CN is left for the backend to resolve from Part No. (lpb.eng_item) —
      // same live auto-detect as everywhere else in this app; see
      // pbringService.createToolingFromHistory.
      const res = await axios.post(server.PBRING_TOOLING_FROM_HISTORY, {
        part_group: partGroup, part_no: partNo.trim(), part_name: partName.trim() || null,
        rows, force,
      });
      const { insertedCount, skippedCount, cn: usedCn } = res.data;
      if (skippedCount > 0 && !force) {
        message.warning(
          <span>
            Added {insertedCount} item(s) — skipped {skippedCount} duplicate(s)
            {' '}<a onClick={() => submit(true)}>Add duplicates too</a>
          </span>, 8
        );
      } else {
        message.success(`Added ${insertedCount} item(s) to ${partGroup} / ${partNo}${usedCn ? ` (CN ${usedCn})` : ''}`);
      }
      if (insertedCount > 0) resetForm();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add items');
    } finally {
      setBusy(false);
    }
  };

  const draftColumns = [
    { title: 'Use', width: 50, render: (_, r) => <Checkbox checked={r.use} onChange={(e) => updateDraft(r._k, 'use', e.target.checked)} /> },
    { title: 'Process', width: 220, render: (_, r) => <>{r.process_code} <Text type="secondary">{r.process_name}</Text></> },
    { title: 'Machine', dataIndex: 'mc_type', width: 140 },
    { title: 'M/C No.', width: 100, render: (_, r) => <Input size="small" value={r.mc_no} onChange={(e) => updateDraft(r._k, 'mc_no', e.target.value)} /> },
    { title: 'Tooling item', width: 200, render: (_, r) => <Input size="small" value={r.tooling_item} onChange={(e) => updateDraft(r._k, 'tooling_item', e.target.value)} /> },
    { title: 'Tool code', width: 160, render: (_, r) => <Input size="small" placeholder="(optional)" value={r.tool_code} onChange={(e) => updateDraft(r._k, 'tool_code', e.target.value)} /> },
    { title: 'Maker', width: 130, render: (_, r) => <Input size="small" value={r.maker} onChange={(e) => updateDraft(r._k, 'maker', e.target.value)} /> },
    { title: 'M/C Qty', width: 80, render: (_, r) => <InputNumber size="small" style={{ width: '100%' }} value={r.machine_qty} onChange={(v) => updateDraft(r._k, 'machine_qty', v)} /> },
    { title: 'Order Qty', width: 80, render: (_, r) => <InputNumber size="small" style={{ width: '100%' }} value={r.order_qty} onChange={(v) => updateDraft(r._k, 'order_qty', v)} /> },
    { title: 'Used in history', dataIndex: 'hist', width: 100 },
    { title: '', width: 50, render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeDraftRow(r._k)} /> },
  ];

  const usedCount = draft.filter((d) => d.use).length;

  return (
    <>
      <Card size="small" title="Add New HW — Build from History" style={{ marginBottom: 12 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <label>HW# <Input style={{ width: 80 }} value={hw} onChange={(e) => setHw(e.target.value)} /></label>
          <label>Part No. <Input style={{ width: 180 }} value={partNo} onChange={(e) => onPartNoChange(e.target.value)} /></label>
          <label>Part Name <Input style={{ width: 160 }} value={partName} onChange={(e) => onPartNameChange(e.target.value)} /></label>
        </Space>

        {prows.map((row, i) => (
          <Space key={i} wrap style={{ marginBottom: 8, display: 'flex' }}>
            <Text type="secondary">Row {i + 1}</Text>
            <Select
              showSearch style={{ width: 320 }} placeholder="Process code"
              options={processCodes} optionFilterProp="label" value={row.pc}
              onChange={(v) => setProwPc(i, v)}
            />
            <Select
              style={{ width: 200 }} placeholder="Machine" disabled={!row.pc}
              options={(machinesByPc[row.pc] || []).map((m) => ({ value: m, label: m }))}
              value={row.mc} onChange={(v) => setProwMc(i, v)}
            />
          </Space>
        ))}
        <Space wrap style={{ marginBottom: 12 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={addProw}>Add Process / Machine row</Button>
          <Button size="small" onClick={removeLastProw} disabled={prows.length < 2}>Remove last row</Button>
          <Button size="small" type="primary" icon={<DownloadOutlined />} loading={busy} onClick={loadAllTemplates}>Load from history</Button>
        </Space>
        {info && <div style={{ marginBottom: 8 }}><Text type="secondary">{info}</Text></div>}
      </Card>

      <Card size="small" title={`Items to add ${draft.length ? `(${usedCount} / ${draft.length} selected)` : ''}`}>
        <Table
          size="small" rowKey="_k" dataSource={draft} columns={draftColumns}
          pagination={false} scroll={{ x: 1300, y: 400 }}
          locale={{ emptyText: <Empty description='No items yet — select Process + Machine then click "Load from history"' /> }}
        />
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={busy} onClick={() => submit(false)}>Add to Tooling list</Button>
          <Button onClick={clearDraft}>Clear draft</Button>
        </Space>
      </Card>
    </>
  );
}

function SummaryTab() {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(server.PBRING_SUMMARY);
      setData(res.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const statusColumns = [
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={statusTagColor(s)}>{s}</Tag> },
    { title: 'Total', dataIndex: 'n', align: 'right' },
    { title: 'Missing PO', dataIndex: 'po', align: 'right' },
    { title: 'Missing Unit Price', dataIndex: 'price', align: 'right' },
    { title: 'Missing Receive Date', dataIndex: 'date', align: 'right' },
    { title: 'Incomplete Cost Info', dataIndex: 'incomplete', align: 'right' },
    { title: 'Value (THB)', dataIndex: 'v', align: 'right', render: fmt },
  ];
  const machineColumns = [
    { title: 'Machine', dataIndex: 'mc_type' },
    { title: 'Items', dataIndex: 'n', align: 'right' },
    { title: 'Value (THB)', dataIndex: 'v', align: 'right', render: fmt },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="Total Items" value={data?.totalRows ?? 0} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Total Value (THB)" value={fmt(data?.totalPrice)} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Received" value={data?.received?.count ?? 0} suffix={`(${fmt(data?.received?.totalPrice)})`} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Missing Price" value={data?.missingPrice ?? 0} loading={loading} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={14}>
          <Card title="Incomplete Items by Status">
            <Table size="small" rowKey="status" dataSource={data?.byStatus || []} columns={statusColumns} loading={loading} pagination={false} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="By Machine">
            <Table size="small" rowKey="mc_type" dataSource={data?.byMachine || []} columns={machineColumns} loading={loading} pagination={{ pageSize: 10, size: 'small' }} />
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default function PbRingMonitorPage() {
  const C = useColors();

  const bodyContent = (
    <Tabs
      defaultActiveKey="search"
      items={[
        { key: 'search', label: 'Search (HW / Process / Machine)', children: <SearchTab C={C} /> },
        { key: 'add-hw', label: '+ New HW', children: <AddHwTab /> },
        { key: 'summary', label: 'Summary', children: <SummaryTab /> },
      ]}
    />
  );

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="pb-ring" defaultOpenKeys="sub1" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          {bodyContent}
        </Content>
      </Layout>
    </Layout>
  );
}
