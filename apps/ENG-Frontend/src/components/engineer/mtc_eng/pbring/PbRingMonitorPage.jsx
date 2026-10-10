import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layout, Tabs, Select, Button, Space, Typography, Table, Tag, Empty, Statistic,
  Row, Col, Card, Input, InputNumber, DatePicker, Checkbox, Popconfirm, App, Spin, Upload,
} from 'antd';
import {
  ClearOutlined, ReloadOutlined, EditOutlined, SaveOutlined, CloseOutlined,
  PlusOutlined, DeleteOutlined, DownloadOutlined, CheckOutlined, SyncOutlined,
  DoubleRightOutlined, DoubleLeftOutlined, DownOutlined, UpOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';
import { useAuthStore } from '../../../../stores/authStore';

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

// Shared border/highlight color for the two cost-related cards (Cost Update
// Found, Incomplete Cost Info) — same color as each other so they read as a
// matched pair, distinct from the plain-accent ring/status cards beside them.
const COST_CARD_COLOR = '#d4720a';

// Received/Waiting/UNUSED/Unknown share this row with Total/Outer/Inner Ring
// now, so they need their own border color to stay visually distinct from
// the ring cards sitting right next to them in the same row.
const STATUS_CARD_COLOR = '#4c6ef5';

// Mirrors the backend's pbringConstants.COST_ALERT sentinel — the one filter
// that deliberately works with no HW/Process/Machine selected (see the
// `runSearch` guard below): "show me everything waiting on me" is meant to
// stand on its own, not require picking a HW first.
const COST_ALERT = '__COST_FOUND__';

// Mirrors the backend's pbringConstants.NO_PO sentinel — every row missing a
// PO regardless of status, the full candidate pool "Check for cost updates"
// scans. Not the same number as Cost Update Found (that's only the subset
// which matched something in maqdb) or Incomplete Cost Info (that's scoped to
// status=Received only) — shown alongside both for that reason.
const NO_PO = '__NOPO__';

// Mirrors the backend's pbringConstants.NO_TOOL_CODE sentinel — rows with no
// tool_code entered at all, an earlier-stage gap than No PO: a row just added
// via "Add new HW" starts here, before it even has a code for cost detection
// to look up.
const NO_TOOL_CODE = '__NOTOOL__';

// These five statuses collapse into one "Waiting" card. Mirrors the backend's
// pbringConstants.WAITING sentinel — clicking the card sets `status` to this
// value, which the backend matches against any of the five, so the table
// actually filters to their union (not just expand the sub-card row below).
const WAITING = '__WAITING__';
const WAITING_GROUP = [
  'Wait Receive', 'Wait Request Quotation', 'Wait DWG Tooling (BBBU)',
  'Wait DWG Tooling (ROD THAI)', 'Wait DWG Tooling (ROD KZW)',
];

// The grouped, one-<Table>-per-Part-No view is only worth it for a HW search
// (which almost always means one Part No./CN), where the CN banner is useful
// context. Every other kind of search (ring/status/No PO/etc., often dozens
// of Part Nos at once) renders as a single flat table instead — both for
// readability (a page full of 2-row tables is harder to scan than one table)
// and for performance: "Outer Ring" alone spans ~50 groups, so the grouped
// view was mounting ~50 separate Table instances (each with its own
// header/resize-observer/sticky-header work) on every filter change, which is
// what caused the switching-filter lag. This cap is a last-resort safety net
// in case a HW ever legitimately spans an unusual number of Part Nos.
const GROUP_DISPLAY_LIMIT = 12;

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
// Currency only (always 2 decimals, even on a whole number) — kept separate
// from `fmt` since that's also used for Qty, where a trailing ".00" would be
// wrong (it's a count, not money).
const fmtMoney = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const statusTagColor = (s) => (s === 'Received' ? 'success' : s === 'UNUSED' || s === 'Unknown' ? 'default' : 'warning');

// pbring's own controllers reply `{ message }`, but a request never reaches
// them when `isEngineer`/`isAdmin` (middleware/mtcAuth.js, shared across all
// of MTC) rejects it first — that 403 body is shaped `{ error }` instead.
// Falling back to only `message` showed a generic "Failed to ___" for every
// permission-denied response instead of the real "Access denied: ..." reason,
// which is exactly the error a user in the wrong department/role hits.
const apiErrorMessage = (err, fallback) => err.response?.data?.message || err.response?.data?.error || fallback;

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
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10,
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
  const [waitingOpen, setWaitingOpen] = useState(false);
  // One-shot override for the "pick a filter first" guard below — set by the
  // Total card so it always shows the table (not just a count), even on the
  // very first click when status/ring were already null and clearing them
  // again is a no-op state change that wouldn't otherwise trigger anything.
  // Stays true until Clear Filters; harmless to leave set since it only ever
  // makes the guard MORE permissive, never blocks something that should show.
  const [showAll, setShowAll] = useState(false);

  const [filterOptions, setFilterOptions] = useState({ hw: [], processCode: [], machine: [], totalCount: 0, statusCards: [], ringCards: [], costAlertCard: null });
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // First/Last-column buttons on the result table's header. Every currently
  // mounted <Table> (one in flat view, up to GROUP_DISPLAY_LIMIT in grouped
  // view) registers itself here via its `ref` callback; React nulls an entry
  // out on unmount, so this always reflects what's actually on screen.
  //
  // Deliberately NOT `tableRef.scrollTo({ left })` (rc-table's own imperative
  // API): for a `virtual` table (added for the switching-filter lag fix) that
  // moves the body's internal offset directly but skips the library's own
  // `triggerScroll()` call — the one that notifies the header to follow along
  // — so the body jumped but the header stayed put (reported after shipping
  // the first version of this button). A real user wheel/drag DOES call
  // `triggerScroll()`, so dispatching a genuine `wheel` event on the virtual
  // body's own scroll element goes through the same path and keeps both in
  // sync. `.ant-table-tbody-virtual-holder` is rc-virtual-list's own naming
  // convention (`${prefixCls}-holder`) for that element, not a made-up guess.
  // Falls back to `.scrollTo` for a non-virtual table, where the body is a
  // plain `overflow-x` div and a native 'scroll' event (which setting
  // `scrollLeft` fires on its own) is what the header already listens for.
  const toolingTableRefs = useRef(new Map());
  const registerToolingTableRef = (key) => (el) => {
    if (el) toolingTableRefs.current.set(key, el);
    else toolingTableRefs.current.delete(key);
  };
  const scrollTableBy = (deltaX) => {
    toolingTableRefs.current.forEach((t) => {
      const holder = t.nativeElement?.querySelector(
        '.ant-table-tbody-virtual-holder, [class*="-tbody-virtual-holder"]'
      );
      if (holder) {
        holder.dispatchEvent(new WheelEvent('wheel', { deltaX, deltaY: 0, bubbles: true, cancelable: true }));
      } else {
        t.scrollTo({ left: deltaX > 0 ? Number.MAX_SAFE_INTEGER : 0 });
      }
    });
  };
  const scrollTableToEnd = () => scrollTableBy(100000);
  const scrollTableToStart = () => scrollTableBy(-100000);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const res = await axios.get(server.PBRING_FILTERS, { params: { hw, pc, mc, status, ring } });
      setFilterOptions(res.data || { hw: [], processCode: [], machine: [], totalCount: 0, statusCards: [], ringCards: [], costAlertCard: null });
    } catch (err) {
      message.error(apiErrorMessage(err, 'Failed to load filters'));
    } finally {
      setLoadingFilters(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hw, pc, mc, status, ring, message]);

  useEffect(() => { loadFilters(); }, [loadFilters]);

  const runSearch = useCallback(async () => {
    // A status or ring card is its own standalone filter too, same as the
    // alert card already was — clicking Received/UNUSED/Waiting/a ring card
    // with no HW/Process/Machine picked used to only refresh that card's own
    // count (via loadFilters) and leave the table hidden.
    if (!hw && !pc && !mc && !status && !ring && !showAll && alert !== COST_ALERT) { setResult(null); return; }
    setLoadingSearch(true);
    try {
      const res = await axios.get(server.PBRING_SEARCH, { params: { hw, pc, mc, status, ring, alert } });
      setResult(res.data);
    } catch (err) {
      message.error(apiErrorMessage(err, 'Search failed'));
    } finally {
      setLoadingSearch(false);
    }
  }, [hw, pc, mc, status, ring, showAll, alert, message]);

  useEffect(() => { runSearch(); }, [runSearch]);

  const clearAll = () => { setHw(null); setPc(null); setMc(null); setStatus(null); setRing(null); setAlert(null); setShowAll(false); };

  const checkCostUpdates = async () => {
    setDetecting(true);
    try {
      const res = await axios.post(server.PBRING_COST_DETECT);
      message.success(`Checked ${res.data.checked} item(s) — ${res.data.detected} new cost update(s) found`);
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(apiErrorMessage(err, 'Check failed'));
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
      message.error(apiErrorMessage(err, 'Approve failed'));
    }
  };
  const rejectDetected = async (record) => {
    try {
      await axios.post(`${server.PBRING_COST_PENDING}/${record.detected.id}/reject`);
      message.success('Rejected');
      loadFilters();
      runSearch();
    } catch (err) {
      message.error(apiErrorMessage(err, 'Reject failed'));
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
      message.error(apiErrorMessage(err, 'Save failed'));
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
      message.error(apiErrorMessage(err, 'Delete failed'));
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
      message.error(apiErrorMessage(err, 'Delete failed'));
    }
  };

  // Editable cell: shows the input bound to `editDraft` when this row is being
  // edited, the plain formatted value otherwise. `field` must be in EDITABLE_FIELDS.
  const editCell = (field, record, input) => {
    if (editingId !== record.id) return undefined; // let the column's own `render` show the value
    return input;
  };

  const toolingColumns = useMemo(() => [
    { title: 'HW', dataIndex: 'part_group', width: 70, fixed: 'left' },
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

  // Flat view (no Outer/Inner Ring filter picked): too many Part No. groups to
  // scan as separate mini-tables (e.g. all 149 Cost Update Found rows span
  // dozens of Part Nos.), so Part No./CN come back as plain columns instead of
  // a group header and everything renders as one continuous table.
  const flatColumns = useMemo(() => {
    const [hwCol, ...rest] = toolingColumns;
    return [
      hwCol,
      { title: 'Part No.', dataIndex: 'part_no', width: 120 },
      { title: 'CN', dataIndex: 'cn', width: 90 },
      ...rest,
    ];
  }, [toolingColumns]);

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

  // Row 1: Total, Outer Ring, Inner Ring.
  const totalCard = { label: 'Total', count: filterOptions.totalCount || 0 };

  // Row 2: Received, Waiting, UNUSED, Unknown. Every one of these counts
  // already respects the active ring filter server-side (`getFilters`'s
  // `cardBase('status')` keeps the ring filter unless ring itself is the
  // thing being counted) — combined across both rings when none is picked,
  // scoped to just that ring once one is.
  const receivedCard = filterOptions.statusCards.find((c) => c.value === 'Received');
  const waitingSubCards = filterOptions.statusCards.filter((c) => WAITING_GROUP.includes(c.value));
  const waitingTotal = waitingSubCards.reduce((sum, c) => sum + (c.count || 0), 0);
  const waitingExpanded = waitingOpen || status === WAITING || WAITING_GROUP.includes(status);
  const afterCostStatusCards = filterOptions.statusCards.filter((c) => ['UNUSED', 'Unknown'].includes(c.value));

  // Row 4 (bottom): the three cost-related cards, kept together but out of
  // the main Total/Ring/Status flow above.
  const incompleteCostCard = filterOptions.statusCards.find((c) => c.value === INCOMPLETE_COST);
  const noToolCodeCard = filterOptions.statusCards.find((c) => c.value === NO_TOOL_CODE);
  const noPoCard = filterOptions.statusCards.find((c) => c.value === NO_PO);

  const movedUp = new Set([INCOMPLETE_COST, NO_PO, NO_TOOL_CODE, ...WAITING_GROUP, 'Received', 'UNUSED', 'Unknown']);
  const restStatusCards = filterOptions.statusCards.filter((c) => !movedUp.has(c.value));

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

      {/* Row 1: Total, Outer Ring, Inner Ring, then Received/Waiting/UNUSED/
          Unknown appended onto the same row (their own border color keeps
          them visually distinct from the ring cards beside them). Counts for
          the latter four already respect the active ring filter server-side
          (combined when no ring is picked). `flexWrap` keeps the row from
          running past the toolbar above it — it wraps onto a second line
          rather than overflowing past "Check for cost updates".
          Mutually exclusive within the status group: Received/UNUSED/Unknown
          share `status`, so picking one already clears another, but Waiting
          is a separate `waitingOpen` toggle — each side has to clear the
          other's state too, or both could stay highlighted at once. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        <StatCard
          label={totalCard.label} count={totalCard.count} C={C}
          selected={!status && !ring && !waitingOpen}
          onClick={() => { setShowAll(true); setStatus(null); setRing(null); setWaitingOpen(false); }}
        />
        {filterOptions.ringCards.map((c) => (
          <StatCard
            key={c.value} label={c.label} count={c.count} C={C}
            selected={ring === c.value}
            onClick={() => { setShowAll(true); setRing((s) => (s === c.value ? null : c.value)); }}
          />
        ))}
        {receivedCard && (
          <StatCard
            label={receivedCard.label} count={receivedCard.count} C={C}
            color={STATUS_CARD_COLOR}
            selected={status === receivedCard.value}
            onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === receivedCard.value ? null : receivedCard.value)); }}
          />
        )}
        {waitingSubCards.length > 0 && (
          <StatCard
            label="Waiting" count={waitingTotal} C={C}
            color={STATUS_CARD_COLOR}
            selected={waitingExpanded}
            onClick={() => {
              setShowAll(true);
              // Collapsing (already expanded, whether on the aggregate or a
              // drilled-into sub-status) clears the filter entirely; opening
              // sets `status` to the aggregate sentinel so the table actually
              // filters to the union of all five, not just reveal row 3.
              if (waitingExpanded) { setStatus(null); setWaitingOpen(false); }
              else { setStatus(WAITING); setWaitingOpen(true); }
            }}
          />
        )}
        {afterCostStatusCards.map((c) => (
          <StatCard
            key={c.value} label={c.label} count={c.count} C={C}
            color={STATUS_CARD_COLOR}
            selected={status === c.value}
            onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === c.value ? null : c.value)); }}
          />
        ))}
      </div>

      {restStatusCards.length > 0 && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {restStatusCards.map((c) => (
          <StatCard
            key={c.value} label={c.label} count={c.count} C={C}
            selected={status === c.value}
            onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === c.value ? null : c.value)); }}
          />
        ))}
      </div>
      )}

      {/* Row 3: Waiting's own five sub-statuses, once Waiting is open. */}
      {waitingExpanded && waitingSubCards.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, paddingLeft: 16 }}>
          {waitingSubCards.map((c) => (
            <StatCard
              key={c.value} label={c.label} count={c.count} C={C}
              selected={status === c.value}
              // Deselecting a specific sub-status zooms back out to the
              // Waiting aggregate (row stays open) rather than clearing the
              // filter entirely — "Waiting" itself is what closes it.
              onClick={() => { setShowAll(true); setStatus((s) => (s === c.value ? WAITING : c.value)); }}
            />
          ))}
        </div>
      )}

      {/* Bottom row: the detection cards, kept together but out of the main
          Total/Ring/Status flow above — ordered by how far along a row is:
          No Tool Code (earliest — just added, nothing entered yet) -> No PO
          (has a code, not yet ordered) -> Cost Update Found (maqdb matched
          one) -> Incomplete Cost Info (Received but still missing a field). */}
      {(noToolCodeCard || noPoCard || filterOptions.costAlertCard || incompleteCostCard) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          {noToolCodeCard && (
            <StatCard
              label={noToolCodeCard.label} count={noToolCodeCard.count} C={C}
              color={COST_CARD_COLOR}
              selected={status === noToolCodeCard.value}
              onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === noToolCodeCard.value ? null : noToolCodeCard.value)); }}
            />
          )}
          {noPoCard && (
            <StatCard
              label={noPoCard.label} count={noPoCard.count} C={C}
              color={COST_CARD_COLOR}
              selected={status === noPoCard.value}
              onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === noPoCard.value ? null : noPoCard.value)); }}
            />
          )}
          {filterOptions.costAlertCard && (
            <StatCard
              label={filterOptions.costAlertCard.label} count={filterOptions.costAlertCard.count} C={C}
              color={COST_CARD_COLOR}
              selected={alert === filterOptions.costAlertCard.value}
              onClick={() => { setShowAll(true); setAlert((s) => (s === filterOptions.costAlertCard.value ? null : filterOptions.costAlertCard.value)); }}
            />
          )}
          {incompleteCostCard && (
            <StatCard
              label={incompleteCostCard.label} count={incompleteCostCard.count} C={C}
              color={COST_CARD_COLOR}
              selected={status === incompleteCostCard.value}
              onClick={() => { setShowAll(true); setWaitingOpen(false); setStatus((s) => (s === incompleteCostCard.value ? null : incompleteCostCard.value)); }}
            />
          )}
        </div>
      )}

      {!result || result.empty ? (
        <Empty description="Select a HW, Process code, Machine, or click a card above to show data" style={{ marginTop: 40 }} />
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col><Statistic title="Setup Data Sheet" value={result.kpi.sdsParamCount} /></Col>
            <Col><Statistic title="Tooling in list" value={result.kpi.toolingCount} /></Col>
            <Col><Statistic title="Received" value={`${result.kpi.received}/${result.kpi.toolingCount}`} /></Col>
            <Col><Statistic title="Total value (THB)" value={fmt(result.kpi.totalPrice)} /></Col>
          </Row>
          {result.note && <Text type="secondary">{result.note}</Text>}

          <Card
            size="small" style={{ marginBottom: 16 }}
            title={<Text strong>Tooling PB Ring Status — {result.tooling.length} item(s)</Text>}
            extra={result.tooling.length > 0 && (
              <Space size={4}>
                <Button size="small" icon={<DoubleLeftOutlined />} onClick={scrollTableToStart}>First</Button>
                <Button size="small" icon={<DoubleRightOutlined />} onClick={scrollTableToEnd}>Last</Button>
              </Space>
            )}
          >
            {toolingByPart.length === 0 ? (
              <Empty description="No tooling found" />
            ) : hw && toolingByPart.length <= GROUP_DISPLAY_LIMIT ? (
              <div style={{ maxHeight: 760, overflowY: 'auto' }} className="kb-vscroll">
                {toolingByPart.map(([partNo, rows]) => {
                  const groupCn = rows[0]?.cn || '';
                  // Single-group result (e.g. a HW search) gets the full height
                  // to itself; with several groups stacked in the scroller,
                  // each table keeps a shorter cap so more groups are visible
                  // at once without the page becoming one giant scroll.
                  const tableY = toolingByPart.length === 1 ? 680 : 340;
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
                        virtual ref={registerToolingTableRef(partNo)}
                        size="small" rowKey="id" dataSource={rows} columns={toolingColumns}
                        loading={loadingSearch} pagination={false} scroll={{ x: 1880, y: tableY }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <Table
                virtual ref={registerToolingTableRef('flat')}
                size="small" rowKey="id" dataSource={result.tooling} columns={flatColumns}
                loading={loadingSearch} pagination={false} scroll={{ x: 2000, y: 640 }}
              />
            )}
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
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load process codes')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMachinesFor = async (pc) => {
    if (!pc || machinesByPc[pc]) return;
    try {
      const res = await axios.get(server.PBRING_HISTORY_MACHINES, { params: { pc } });
      setMachinesByPc((m) => ({ ...m, [pc]: res.data?.machine || [] }));
    } catch (err) {
      message.error(apiErrorMessage(err, 'Failed to load machines'));
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
      message.error(apiErrorMessage(err, `Failed to load history for ${row.pc}/${row.mc}`));
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
      message.error(apiErrorMessage(err, 'Failed to add items'));
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
      message.error(apiErrorMessage(err, 'Failed to load summary'));
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const statusColumns = [
    { title: 'Status', dataIndex: 'status', sorter: (a, b) => String(a.status).localeCompare(String(b.status)), render: (s) => <Tag color={statusTagColor(s)}>{s}</Tag> },
    { title: 'Total', dataIndex: 'n', align: 'right', sorter: (a, b) => a.n - b.n },
    { title: 'Missing PO', dataIndex: 'po', align: 'right', sorter: (a, b) => a.po - b.po },
    { title: 'Missing Unit Price', dataIndex: 'price', align: 'right', sorter: (a, b) => a.price - b.price },
    { title: 'Missing Receive Date', dataIndex: 'date', align: 'right', sorter: (a, b) => a.date - b.date },
    { title: 'Incomplete Cost Info', dataIndex: 'incomplete', align: 'right', sorter: (a, b) => a.incomplete - b.incomplete },
    { title: 'Value (THB)', dataIndex: 'v', align: 'right', sorter: (a, b) => a.v - b.v, render: fmtMoney },
  ];
  const machineColumns = [
    { title: 'Machine', dataIndex: 'mc_type', sorter: (a, b) => String(a.mc_type).localeCompare(String(b.mc_type)) },
    { title: 'Items', dataIndex: 'n', align: 'right', sorter: (a, b) => a.n - b.n },
    { title: 'Value (THB)', dataIndex: 'v', align: 'right', sorter: (a, b) => a.v - b.v, render: fmtMoney },
  ];

  return (
    <>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="Total Items" value={data?.totalRows ?? 0} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Total Value (THB)" value={fmtMoney(data?.totalPrice)} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Received (THB)" value={fmtMoney(data?.received?.totalPrice)} loading={loading} /></Card></Col>
        <Col span={6}><Card><Statistic title="Waiting (THB)" value={fmtMoney(data?.waiting?.totalPrice)} loading={loading} /></Card></Col>
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

// Phase 6, problem #3 — per-machine GRIND/DRESS CONDITION + Grinding Wheel
// Config editor. Exact replica of the real SDS "Excel Parameter Config" /
// "Excel Grinding Wheel Config" admin tabs (MachineConfigTab in
// SdsV2AdminPage.jsx), by explicit user decision (2026-10-08): every cell is
// hand-typed, no automatic resolution from pbring_sds_param/condition. Same
// row numbers (16-58) and column letters (A-I, GW: AN-AV) as the real
// "Standard" template's own condition area, since PB Ring's grinding
// machines render through that same live template.
const PBRING_ROW_RANGE = Array.from({ length: 43 }, (_, i) => i + 16); // 16-58
const PBRING_COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const PBRING_GW_ROW_RANGE = [53, 54, 55, 56, 57, 58];
const PBRING_GW_COL_LETTERS = ['AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'];
// The 2 turning machines render through a fully field-mapped template with
// no free-form condition area — nothing here applies to them.
const PBRING_TURNING_MACHINES = ['QTSMART200M', 'QUICKTURN200500U'];

// Header single-cell override fields — exact replica of the real SDS
// HEADER_CELL_FIELDS. Flat param_key (no row_/gw_row_ prefix), machine-default
// or CN-override. 'ct' already auto-fills from pbring_sds_param by default; a
// value entered here overrides that, same as the real system.
const PBRING_HEADER_OVERRIDE_FIELDS = [
  { key: 'program_no', label: 'Program No', cell: 'Z4' },
  { key: 'program_name', label: 'Program Name', cell: 'Z5' },
  { key: 'ct', label: 'Cycle Time (CT)', cell: 'B4' },
  { key: 'category', label: 'Category', cell: 'B5' },
];
const PBRING_HEADER_OVERRIDE_KEYS = new Set(PBRING_HEADER_OVERRIDE_FIELDS.map((f) => f.key));

function ParamConfigTab() {
  const { message } = App.useApp();
  const [allMachines, setAllMachines] = useState([]);
  const [search, setSearch] = useState('');
  const [showMachineList, setShowMachineList] = useState(false); // table starts hidden, same as the real admin
  const [listLoading, setListLoading] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Machine-default state
  const [cellData, setCellData] = useState({});       // row_{N}_{C} -> value
  const [cellTypes, setCellTypes] = useState({});      // row_{N}_{C} -> 'value' | ''
  const [rowHeaders, setRowHeaders] = useState({});    // {N}: bool
  const [gwCellData, setGwCellData] = useState({});
  const [gwCellTypes, setGwCellTypes] = useState({});
  const [gwRowHeaders, setGwRowHeaders] = useState({});
  const [headerData, setHeaderData] = useState({}); // program_no/program_name/ct/category, machine default

  // CN override state
  const [cnInput, setCnInput] = useState('');
  const [selectedCn, setSelectedCn] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState('');
  const [cnOverrideData, setCnOverrideData] = useState({});
  const [cnGwOverrideData, setCnGwOverrideData] = useState({});

  const loadList = useCallback(() => {
    setListLoading(true);
    axios.get(server.PBRING_GRID_ADMIN_MACHINE_TYPES)
      .then((r) => setAllMachines((r.data || []).filter((m) => !PBRING_TURNING_MACHINES.includes(m.machine_type_name))))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load machine list')))
      .finally(() => setListLoading(false));
  }, [message]);

  useEffect(() => { loadList(); }, [loadList]);

  const displayedMachines = search
    ? allMachines.filter((m) => m.machine_type_name.toLowerCase().includes(search.toLowerCase()))
    : allMachines;

  const markDirty = () => setDirty(true);

  const loadConfig = useCallback((machineTypeName) => {
    setSelectedMachine(machineTypeName);
    setShowMachineList(false); // collapse list after picking a machine
    setSelectedCn(null); setCnInput(''); setCnOverrideData({}); setCnGwOverrideData({}); setSelectedProcess('');
    setConfigLoading(true);
    setDirty(false);
    setHeaderData({});
    axios.get(server.PBRING_GRID_ADMIN_PARAMETERS, { params: { machine_type_name: machineTypeName } })
      .then((r) => {
        const cd = {}, ct = {}, rh = {}, gcd = {}, gct = {}, grh = {}, hd = {};
        for (const row of r.data || []) {
          const k = row.param_key;
          if (PBRING_HEADER_OVERRIDE_KEYS.has(k)) {
            hd[k] = row.param_value;
          } else if (k.startsWith('gw_row_')) {
            const hm = /^gw_row_(\d+)_is_header$/.exec(k);
            const tm = /^gw_row_(\d+)_([A-Z]+)_type$/.exec(k);
            const vm = /^gw_row_(\d+)_([A-Z]+)$/.exec(k);
            if (hm) grh[hm[1]] = row.param_value === '1';
            else if (tm) gct[`gw_row_${tm[1]}_${tm[2]}`] = row.param_value;
            else if (vm) gcd[`gw_row_${vm[1]}_${vm[2]}`] = row.param_value;
          } else {
            const hm = /^row_(\d+)_is_header$/.exec(k);
            const tm = /^row_(\d+)_([A-Z]+)_type$/.exec(k);
            const vm = /^row_(\d+)_([A-Z]+)$/.exec(k);
            if (hm) rh[hm[1]] = row.param_value === '1';
            else if (tm) ct[`row_${tm[1]}_${tm[2]}`] = row.param_value;
            else if (vm) cd[`row_${vm[1]}_${vm[2]}`] = row.param_value;
          }
        }
        setCellData(cd); setCellTypes(ct); setRowHeaders(rh);
        setGwCellData(gcd); setGwCellTypes(gct); setGwRowHeaders(grh);
        setHeaderData(hd);
      })
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load parameters')))
      .finally(() => setConfigLoading(false));
  }, [message]);

  const loadCnConfig = useCallback((cn, processArg) => {
    if (!selectedMachine) return;
    const trimmed = cn.trim();
    const proc = processArg !== undefined ? (processArg || '') : selectedProcess;
    setSelectedCn(trimmed); setSelectedProcess(proc);
    setConfigLoading(true);
    setCnOverrideData({}); setCnGwOverrideData({});
    setDirty(false);
    axios.get(server.PBRING_GRID_ADMIN_PARAMETERS, { params: { machine_type_name: selectedMachine, cn: trimmed, process_code: proc || undefined } })
      .then((r) => {
        const cod = {}, cgd = {};
        for (const row of r.data || []) {
          if (row.param_key.startsWith('gw_row_')) cgd[row.param_key] = row.param_value;
          else cod[row.param_key] = row.param_value;
        }
        setCnOverrideData(cod); setCnGwOverrideData(cgd);
      })
      .catch((err) => { message.error(apiErrorMessage(err, 'Load CN failed')); setSelectedCn(null); })
      .finally(() => setConfigLoading(false));
  }, [selectedMachine, selectedProcess, message]);

  const exitCnMode = () => {
    setSelectedCn(null); setCnInput('');
    setCnOverrideData({}); setCnGwOverrideData({});
    setSelectedProcess('');
    setDirty(false);
  };

  const handleCellChange = (rowNum, c, val, isGw) => {
    const key = `${isGw ? 'gw_row' : 'row'}_${rowNum}_${c}`;
    if (selectedCn) {
      (isGw ? setCnGwOverrideData : setCnOverrideData)((prev) => ({ ...prev, [key]: val }));
    } else {
      (isGw ? setGwCellData : setCellData)((prev) => ({ ...prev, [key]: val }));
    }
    markDirty();
  };
  const handleTypeToggle = (rowNum, c, isGw) => {
    if (selectedCn) return; // type is machine-level only, matching the real admin
    const key = `${isGw ? 'gw_row' : 'row'}_${rowNum}_${c}`;
    (isGw ? setGwCellTypes : setCellTypes)((prev) => ({ ...prev, [key]: prev[key] === 'value' ? '' : 'value' }));
    markDirty();
  };
  const handleHeaderToggle = (rowNum, checked, isGw) => {
    if (selectedCn) return; // header is machine-level only
    (isGw ? setGwRowHeaders : setRowHeaders)((prev) => ({ ...prev, [rowNum]: checked }));
    markDirty();
  };
  const handleHeaderFieldChange = (key, val) => {
    if (selectedCn) setCnOverrideData((prev) => ({ ...prev, [key]: val }));
    else setHeaderData((prev) => ({ ...prev, [key]: val }));
    markDirty();
  };

  const save = async () => {
    if (!selectedMachine) return;
    setSaving(true);
    try {
      const params = [];
      if (selectedCn) {
        for (const r of PBRING_ROW_RANGE) for (const c of PBRING_COL_LETTERS) {
          const key = `row_${r}_${c}`;
          params.push({ param_key: key, param_value: cnOverrideData[key] || '' });
        }
        for (const r of PBRING_GW_ROW_RANGE) for (const c of PBRING_GW_COL_LETTERS) {
          const key = `gw_row_${r}_${c}`;
          params.push({ param_key: key, param_value: cnGwOverrideData[key] || '' });
        }
        for (const f of PBRING_HEADER_OVERRIDE_FIELDS) {
          params.push({ param_key: f.key, param_value: cnOverrideData[f.key] || '' });
        }
        await axios.put(server.PBRING_GRID_ADMIN_PARAMETERS_BULK, {
          machine_type_name: selectedMachine, cn: selectedCn, process_code: selectedProcess || null, params,
        });
        message.success(`Saved CN override for ${selectedCn}${selectedProcess ? ` (process ${selectedProcess})` : ''}`);
        loadCnConfig(selectedCn, selectedProcess);
      } else {
        for (const r of PBRING_ROW_RANGE) for (const c of PBRING_COL_LETTERS) {
          const key = `row_${r}_${c}`;
          params.push({ param_key: key, param_value: cellData[key] || '' });
          params.push({ param_key: `${key}_type`, param_value: cellTypes[key] || '' });
        }
        for (const r of PBRING_ROW_RANGE) params.push({ param_key: `row_${r}_is_header`, param_value: rowHeaders[r] ? '1' : '' });
        for (const r of PBRING_GW_ROW_RANGE) for (const c of PBRING_GW_COL_LETTERS) {
          const key = `gw_row_${r}_${c}`;
          params.push({ param_key: key, param_value: gwCellData[key] || '' });
          params.push({ param_key: `${key}_type`, param_value: gwCellTypes[key] || '' });
        }
        for (const r of PBRING_GW_ROW_RANGE) params.push({ param_key: `gw_row_${r}_is_header`, param_value: gwRowHeaders[r] ? '1' : '' });
        for (const f of PBRING_HEADER_OVERRIDE_FIELDS) {
          params.push({ param_key: f.key, param_value: headerData[f.key] || '' });
        }
        const r = await axios.put(server.PBRING_GRID_ADMIN_PARAMETERS_BULK, { machine_type_name: selectedMachine, params });
        message.success(`Saved ${r.data?.count ?? ''} cell(s)`);
        loadConfig(selectedMachine);
      }
    } catch (err) {
      message.error(apiErrorMessage(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // Same column shape as the real MachineConfigTab's configGridCols/gwConfigGridCols:
  // Row | Hdr | <letters>, header-row shading via onCell (not a className trick), and
  // a blue tint + border on any cell carrying a CN override.
  const buildGridCols = (headersMap, colLetters, isGw) => [
    {
      title: 'Row', dataIndex: 'rowNum', width: 50, fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: headersMap[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (v) => <Text type="secondary" style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Hdr', key: 'hdr', width: 44, fixed: 'left',
      onCell: (record) => ({ style: { backgroundColor: headersMap[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => (
        <Checkbox
          checked={!!headersMap[record.rowNum]}
          disabled={!!selectedCn}
          onChange={(e) => handleHeaderToggle(record.rowNum, e.target.checked, isGw)}
        />
      ),
    },
    ...colLetters.map((c) => ({
      title: c, key: c, width: 130,
      onCell: (record) => ({ style: { backgroundColor: headersMap[record.rowNum] ? '#d9d9d9' : undefined } }),
      render: (_, record) => {
        const prefix = isGw ? 'gw_row' : 'row';
        const cellKey = `${prefix}_${record.rowNum}_${c}`;
        const typesMap = isGw ? gwCellTypes : cellTypes;
        const dataMap = isGw ? gwCellData : cellData;
        const overrideMap = isGw ? cnGwOverrideData : cnOverrideData;
        const isValue = typesMap[cellKey] === 'value';
        const hasOverride = !!selectedCn && overrideMap[cellKey] !== undefined;
        const displayValue = selectedCn ? (overrideMap[cellKey] ?? dataMap[cellKey] ?? '') : (dataMap[cellKey] || '');
        return (
          <Input
            size="small"
            value={displayValue}
            onChange={(e) => handleCellChange(record.rowNum, c, e.target.value, isGw)}
            style={{
              fontSize: 11,
              color: isValue ? '#ff4d4f' : undefined,
              backgroundColor: hasOverride ? '#e6f4ff' : (headersMap[record.rowNum] ? '#f5f5f5' : undefined),
              borderColor: hasOverride ? '#1677ff' : undefined,
            }}
            suffix={(
              <span
                title={selectedCn ? 'Type set at machine level' : 'Toggle: Label / Value'}
                onClick={() => handleTypeToggle(record.rowNum, c, isGw)}
                style={{
                  cursor: selectedCn ? 'default' : 'pointer', fontSize: 10, fontWeight: 'bold',
                  color: isValue ? '#ff4d4f' : '#bfbfbf', userSelect: 'none', opacity: selectedCn ? 0.4 : 1,
                }}
              >V</span>
            )}
          />
        );
      },
    })),
  ];

  const configGridCols = buildGridCols(rowHeaders, PBRING_COL_LETTERS, false);
  const gwConfigGridCols = buildGridCols(gwRowHeaders, PBRING_GW_COL_LETTERS, true);

  const machineListCols = [
    { title: 'Machine Type Name', dataIndex: 'machine_type_name' },
    { title: 'Source Sheet', dataIndex: 'source_sheet_name', render: (v) => v || <Text type="secondary">-</Text> },
    {
      title: '', key: 'action', width: 120,
      render: (_, row) => (
        <Button
          size="small"
          type={selectedMachine === row.machine_type_name ? 'primary' : 'default'}
          onClick={() => loadConfig(row.machine_type_name)}
        >
          {selectedMachine === row.machine_type_name ? 'Loaded' : 'Load Config'}
        </Button>
      ),
    },
  ];

  const machineListBlock = (
    <>
      <Row gutter={8} align="middle" style={{ marginBottom: showMachineList ? 12 : 16 }}>
        <Col>
          <Button icon={showMachineList ? <UpOutlined /> : <DownOutlined />} onClick={() => setShowMachineList((s) => !s)}>
            {showMachineList ? 'Hide Machine List' : 'Show Machine List'}
          </Button>
        </Col>
        {selectedMachine && (
          <Col><Text type="secondary">Selected: <Text strong>{selectedMachine}</Text></Text></Col>
        )}
      </Row>
      {showMachineList && (
        <>
          <Row gutter={8} style={{ marginBottom: 12 }}>
            <Col>
              <Input.Search
                placeholder="Search machine"
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 280 }}
                enterButton={<SearchOutlined />}
              />
            </Col>
            <Col><Button icon={<ReloadOutlined />} onClick={loadList}>Refresh</Button></Col>
          </Row>
          <Table
            loading={listLoading}
            dataSource={displayedMachines.map((r) => ({ ...r, key: r.id ?? r.machine_type_name }))}
            columns={machineListCols}
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            rowClassName={(row) => (row.machine_type_name === selectedMachine ? 'ant-table-row-selected' : '')}
            style={{ marginBottom: 24 }}
          />
        </>
      )}
    </>
  );

  const cnModeBar = selectedMachine && (
    <Row gutter={8} align="middle" style={{ marginBottom: 12, padding: '8px 12px', background: selectedCn ? '#e6f4ff' : '#fafafa', borderRadius: 6, border: '1px solid #d9d9d9' }}>
      {selectedCn ? (
        <>
          <Col><Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>CN Override: {selectedCn}</Tag></Col>
          <Col>
            <Space size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>Process:</Text>
              <Input
                size="small" style={{ width: 120 }} value={selectedProcess} placeholder="All processes"
                onChange={(e) => setSelectedProcess(e.target.value)}
                onPressEnter={() => loadCnConfig(selectedCn, selectedProcess)}
              />
              <Button size="small" onClick={() => loadCnConfig(selectedCn, selectedProcess)}>Reload</Button>
            </Space>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedProcess ? `Overrides apply to process ${selectedProcess} only` : 'Edit any cell — blue = override, normal = machine default'}
            </Text>
          </Col>
          <Col flex="auto" />
          <Col><Button size="small" onClick={exitCnMode}>← Machine Default</Button></Col>
        </>
      ) : (
        <>
          <Col>
            <Space.Compact>
              <Input
                placeholder="CN Override e.g. C25-0190"
                value={cnInput}
                onChange={(e) => setCnInput(e.target.value)}
                onPressEnter={() => cnInput.trim() && loadCnConfig(cnInput)}
                style={{ width: 220 }}
                allowClear
              />
              <Button onClick={() => cnInput.trim() && loadCnConfig(cnInput)} disabled={!cnInput.trim()}>Load CN</Button>
            </Space.Compact>
          </Col>
          <Col><Text type="secondary" style={{ fontSize: 12 }}>Leave blank = edit machine default (all CNs)</Text></Col>
        </>
      )}
    </Row>
  );

  const saveBar = selectedMachine && (
    <Row gutter={8} align="middle" style={{ marginBottom: 12 }}>
      <Col>
        <Text strong>{selectedMachine}</Text>
        {selectedCn && <Tag color="blue" style={{ marginLeft: 8 }}>{selectedCn}</Tag>}
        {selectedCn && selectedProcess && <Tag color="geekblue">proc {selectedProcess}</Tag>}
      </Col>
      <Col flex="auto" />
      {dirty && <Col><Text type="warning" style={{ fontSize: 12 }}>Please Save</Text></Col>}
      <Col>
        <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={saving} disabled={!dirty}>
          Save{selectedCn ? ' CN Override' : ''}
        </Button>
      </Col>
    </Row>
  );

  return (
    <div>
      <style>{`.pbring-config-grid .pbring-hdr-row td { background-color: #d9d9d9 !important; }`}</style>
      {machineListBlock}
      {selectedMachine && (
        <Spin spinning={configLoading}>
          {cnModeBar}
          {saveBar}
          <Row gutter={16} style={{ marginBottom: 12 }}>
            {PBRING_HEADER_OVERRIDE_FIELDS.map((f) => {
              const hasOverride = !!selectedCn && cnOverrideData[f.key] !== undefined;
              const displayValue = selectedCn ? (cnOverrideData[f.key] ?? headerData[f.key] ?? '') : (headerData[f.key] || '');
              return (
                <Col key={f.key} span={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {f.label} <Tag color="default" style={{ marginInlineStart: 4 }}>{f.cell}</Tag>
                  </Text>
                  <Input
                    size="small"
                    value={displayValue}
                    placeholder={selectedCn ? 'CN override (blank = machine default)' : `${f.label} (machine default)`}
                    onChange={(e) => handleHeaderFieldChange(f.key, e.target.value)}
                    style={{
                      marginTop: 2,
                      backgroundColor: hasOverride ? '#e6f4ff' : undefined,
                      borderColor: hasOverride ? '#1677ff' : undefined,
                    }}
                  />
                </Col>
              );
            })}
          </Row>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Excel Parameter Config</Text>
          <Table
            className="pbring-config-grid"
            dataSource={PBRING_ROW_RANGE.map((rowNum) => ({ key: rowNum, rowNum }))}
            columns={configGridCols}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content', y: 420 }}
            bordered
            style={{ fontFamily: 'monospace', marginBottom: 24 }}
            rowClassName={(record) => (rowHeaders[record.rowNum] ? 'pbring-hdr-row' : '')}
          />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Excel Grinding Wheel Config</Text>
          <Table
            className="pbring-config-grid"
            dataSource={PBRING_GW_ROW_RANGE.map((rowNum) => ({ key: rowNum, rowNum }))}
            columns={gwConfigGridCols}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content', y: 300 }}
            bordered
            style={{ fontFamily: 'monospace' }}
            rowClassName={(record) => (gwRowHeaders[record.rowNum] ? 'pbring-hdr-row' : '')}
          />
        </Spin>
      )}
    </div>
  );
}

// Tooling + Grinding Area photos — same visual boxes as the real SDS sheet
// (T01-T20 photo boxes, the "Grinding Area" picture). Own tables. Tooling
// photos key on the DWG family (first two dash-segments of tooling_no, or
// the plain name when there's no dash) by explicit user decision
// (2026-10-08): one upload covers every tooling_no that shares a family,
// same as the real sds_tooling_image's own evolution. The family dropdown
// is populated from pbring_sds_condition history for the selected machine
// (same "look at what's actually been used" principle as +New HW), with a
// manual-entry fallback for a family that hasn't appeared in history yet.
// Grinding-area photos stay exact-match on (cn, process_code) — only the
// grinding machines use this layout; the 2 turning machines render through
// a different template with no photo boxes PB Ring has built yet.
function ImagesTab() {
  const { message } = App.useApp();
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [toolingImages, setToolingImages] = useState([]);
  const [toolingLoading, setToolingLoading] = useState(false);
  const [familyOptions, setFamilyOptions] = useState([]);
  const [newToolingNo, setNewToolingNo] = useState('');
  const [toolingUploading, setToolingUploading] = useState(false);

  const [grindingImages, setGrindingImages] = useState([]);
  const [grindingLoading, setGrindingLoading] = useState(false);
  const [newGrindCn, setNewGrindCn] = useState('');
  const [newGrindProcess, setNewGrindProcess] = useState('');
  const [grindingUploading, setGrindingUploading] = useState(false);

  // Every machine (grinding + turning) — the Tooling Images section below
  // hides itself for a turning machine (that per-slot photo box exists on
  // Turning_PB but isn't wired up yet), while the layout/area-photo section
  // applies to both: the Standard template's "Grinding Area" box and
  // Turning_PB's "TURNING CUTTING LAYOUT" box are the same
  // pbring_grinding_image mechanism, just a different box on a different
  // template, so a turning machine belongs in this list.
  useEffect(() => {
    axios.get(server.PBRING_GRID_ADMIN_MACHINE_TYPES)
      .then((r) => setMachines(r.data || []))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load machine list')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTurningMachine = PBRING_TURNING_MACHINES.includes(selectedMachine);

  const loadToolingImages = useCallback((machine) => {
    if (!machine) return;
    setToolingLoading(true);
    axios.get(server.PBRING_GRID_ADMIN_TOOLING_IMAGES, { params: { machine_type_name: machine } })
      .then((r) => setToolingImages(r.data || []))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load tooling images')))
      .finally(() => setToolingLoading(false));
  }, [message]);

  const loadFamilyOptions = useCallback((machine) => {
    if (!machine) return;
    axios.get(server.PBRING_GRID_ADMIN_TOOLING_FAMILIES, { params: { machine_type_name: machine } })
      .then((r) => setFamilyOptions(r.data || []))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load tooling history')));
  }, [message]);

  const loadGrindingImages = useCallback((machine) => {
    if (!machine) return;
    setGrindingLoading(true);
    axios.get(server.PBRING_GRID_ADMIN_GRINDING_IMAGES, { params: { machine_type_name: machine } })
      .then((r) => setGrindingImages(r.data || []))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load grinding area images')))
      .finally(() => setGrindingLoading(false));
  }, [message]);

  const selectMachine = (val) => {
    setSelectedMachine(val);
    setNewToolingNo(''); setNewGrindCn(''); setNewGrindProcess('');
    loadToolingImages(val);
    loadFamilyOptions(val);
    loadGrindingImages(val);
  };

  const uploadToolingImage = (file) => {
    if (!newToolingNo.trim()) { message.error('Pick or type a DWG family first'); return false; }
    setToolingUploading(true);
    const fd = new FormData();
    fd.append('machine_type_name', selectedMachine);
    fd.append('family', newToolingNo.trim());
    fd.append('image', file);
    axios.post(server.PBRING_GRID_ADMIN_TOOLING_IMAGE, fd)
      .then(() => { message.success(`Saved photo for family ${newToolingNo.trim()}`); setNewToolingNo(''); loadToolingImages(selectedMachine); })
      .catch((err) => message.error(apiErrorMessage(err, 'Upload failed')))
      .finally(() => setToolingUploading(false));
    return false; // prevent antd Upload's own auto-request
  };

  const deleteToolingImage = (family) => {
    axios.delete(server.PBRING_GRID_ADMIN_TOOLING_IMAGE, { params: { machine_type_name: selectedMachine, family } })
      .then(() => { message.success('Deleted'); loadToolingImages(selectedMachine); })
      .catch((err) => message.error(apiErrorMessage(err, 'Delete failed')));
  };

  const uploadGrindingImage = (file) => {
    if (!newGrindCn.trim() || !newGrindProcess.trim()) { message.error('Enter CN and Process Code first'); return false; }
    setGrindingUploading(true);
    const fd = new FormData();
    fd.append('machine_type_name', selectedMachine);
    fd.append('cn', newGrindCn.trim());
    fd.append('process_code', newGrindProcess.trim());
    fd.append('image', file);
    axios.post(server.PBRING_GRID_ADMIN_GRINDING_IMAGE, fd)
      .then(() => { message.success(`Saved photo for CN ${newGrindCn.trim()} @ ${newGrindProcess.trim()}`); setNewGrindCn(''); setNewGrindProcess(''); loadGrindingImages(selectedMachine); })
      .catch((err) => message.error(apiErrorMessage(err, 'Upload failed')))
      .finally(() => setGrindingUploading(false));
    return false;
  };

  const deleteGrindingImage = (cn, processCode) => {
    axios.delete(server.PBRING_GRID_ADMIN_GRINDING_IMAGE, { params: { machine_type_name: selectedMachine, cn, process_code: processCode } })
      .then(() => { message.success('Deleted'); loadGrindingImages(selectedMachine); })
      .catch((err) => message.error(apiErrorMessage(err, 'Delete failed')));
  };

  const toolingCols = [
    {
      title: 'Preview', key: 'preview', width: 90,
      render: (_, row) => (
        <img
          src={`${server.PBRING_GRID_TOOLING_IMAGE}?machine_type_name=${encodeURIComponent(selectedMachine)}&family=${encodeURIComponent(row.family)}&token=${localStorage.getItem('token')}`}
          alt={row.family}
          style={{ width: 70, height: 50, objectFit: 'contain', border: '1px solid #eee', borderRadius: 4 }}
        />
      ),
    },
    { title: 'DWG Family', dataIndex: 'family' },
    { title: 'File', dataIndex: 'file_name' },
    { title: 'Updated', dataIndex: 'updated_at', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '', key: 'actions', width: 80,
      render: (_, row) => (
        <Popconfirm title="Delete this photo?" onConfirm={() => deleteToolingImage(row.family)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const grindingCols = [
    {
      title: 'Preview', key: 'preview', width: 90,
      render: (_, row) => (
        <img
          src={`${server.PBRING_GRID_GRINDING_IMAGE}?machine_type_name=${encodeURIComponent(selectedMachine)}&cn=${encodeURIComponent(row.cn)}&process_code=${encodeURIComponent(row.process_code)}&token=${localStorage.getItem('token')}`}
          alt={row.cn}
          style={{ width: 70, height: 50, objectFit: 'contain', border: '1px solid #eee', borderRadius: 4 }}
        />
      ),
    },
    { title: 'CN', dataIndex: 'cn' },
    { title: 'Process Code', dataIndex: 'process_code' },
    { title: 'File', dataIndex: 'file_name' },
    { title: 'Updated', dataIndex: 'updated_at', render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-') },
    {
      title: '', key: 'actions', width: 80,
      render: (_, row) => (
        <Popconfirm title="Delete this photo?" onConfirm={() => deleteGrindingImage(row.cn, row.process_code)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">Machine</Text>
        <Select
          style={{ width: 200 }}
          placeholder="Select a machine"
          value={selectedMachine}
          onChange={selectMachine}
          options={machines.map((m) => ({ value: m.machine_type_name, label: m.machine_type_name }))}
          showSearch
        />
      </Space>
      {selectedMachine && (
        <>
          {!isTurningMachine && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Tooling Images (by DWG Family — one photo covers every tooling_no sharing it)</Text>
              <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
                <Select
                  showSearch
                  style={{ width: 320 }}
                  placeholder="Pick a DWG family from history"
                  value={familyOptions.some((o) => o.family === newToolingNo) ? newToolingNo : undefined}
                  onChange={(v) => setNewToolingNo(v)}
                  optionFilterProp="label"
                  options={familyOptions.map((o) => ({
                    value: o.family,
                    label: `${o.family} (used ${o.count}×${o.examples.length ? `, e.g. ${o.examples[0]}` : ''})`,
                  }))}
                  allowClear
                />
                <Text type="secondary">or</Text>
                <Input placeholder="type a family/name manually" style={{ width: 200 }} value={newToolingNo} onChange={(e) => setNewToolingNo(e.target.value)} />
                <Upload accept="image/*" showUploadList={false} beforeUpload={uploadToolingImage}>
                  <Button icon={<UploadOutlined />} loading={toolingUploading} disabled={!newToolingNo.trim()}>Upload Photo</Button>
                </Upload>
              </Space>
              <Table
                size="small"
                rowKey="id"
                dataSource={toolingImages}
                columns={toolingCols}
                loading={toolingLoading}
                pagination={{ pageSize: 10 }}
                style={{ marginBottom: 24 }}
              />
            </>
          )}

          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            {isTurningMachine ? 'Turning Cutting Layout Images (by CN + Process Code)' : 'Grinding Area Images (by CN + Process Code)'}
          </Text>
          <Space style={{ marginBottom: 8 }}>
            <Input placeholder="CN e.g. 294065" style={{ width: 160 }} value={newGrindCn} onChange={(e) => setNewGrindCn(e.target.value)} />
            <Input placeholder="Process Code e.g. 1021" style={{ width: 160 }} value={newGrindProcess} onChange={(e) => setNewGrindProcess(e.target.value)} />
            <Upload accept="image/*" showUploadList={false} beforeUpload={uploadGrindingImage}>
              <Button icon={<UploadOutlined />} loading={grindingUploading} disabled={!newGrindCn.trim() || !newGrindProcess.trim()}>Upload Photo</Button>
            </Upload>
          </Space>
          <Table
            size="small"
            rowKey="id"
            dataSource={grindingImages}
            columns={grindingCols}
            loading={grindingLoading}
            pagination={{ pageSize: 10 }}
          />
        </>
      )}
    </div>
  );
}

// PB Ring SDS tool-condition data (pbring_sds_condition — VC/F/AP/Insert/
// Holder/etc per tool_number). The same table also holds the grinding
// machines' T01-T20 tooling_no/maker rows, and the backend routes/service
// don't care which kind of machine they're given, but this tab's own
// 16-column VC/F/Insert layout is built around turning's shape (grinding
// rows only ever populate tooling_no+maker, leaving every other column
// blank) — so the machine picker below is scoped to the 2 turning machines
// only, by user decision (2026-10-10).
// Two ways to manage it, by explicit user decision (2026-10-10) — both:
// (1) direct CRUD on an existing CN's rows, and (2) the same "+New HW"
// history-suggestion principle (group by what this machine+process has
// used before, suggest what >=50% of its CNs used, review/tick/confirm)
// applied here instead of to pbring_tooling.
const CONDITION_FIELD_COLS = [
  { key: 'tool_number', title: 'Slot', width: 70 },
  { key: 'tooling_no', title: 'Tooling No', width: 140 },
  { key: 'tool_detail', title: 'Tool Detail', width: 160 },
  { key: 'insert_info', title: 'Insert', width: 160 },
  { key: 'maker', title: 'Insert Maker', width: 110 },
  { key: 'holder_info', title: 'Holder', width: 140 },
  { key: 'holder_maker', title: 'Holder Maker', width: 110 },
  { key: 'overhang', title: 'Overhang', width: 90 },
  { key: 'vc', title: 'VC', width: 70 },
  { key: 'f', title: 'F', width: 70 },
  { key: 'ap', title: 'AP', width: 70 },
  { key: 'nose_r', title: 'Nose R', width: 70 },
  { key: 'rotation', title: 'Rotation', width: 90 },
  { key: 'hand', title: 'Hand', width: 70 },
  { key: 'usaged', title: 'Usage', width: 90 },
  { key: 'h_width', title: 'H.Width', width: 90 },
];

function ConditionTab() {
  const { message } = App.useApp();
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [processCode, setProcessCode] = useState('');

  const [cn, setCn] = useState('');
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsSaving, setRowsSaving] = useState(false);

  const [histRows, setHistRows] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [targetCn, setTargetCn] = useState('');
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    axios.get(server.PBRING_GRID_ADMIN_MACHINE_TYPES)
      .then((r) => setMachines((r.data || []).filter((m) => PBRING_TURNING_MACHINES.includes(m.machine_type_name))))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load machine list')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRows = () => {
    if (!selectedMachine || !cn.trim() || !processCode.trim()) {
      message.warning('Select a machine, CN and Process Code first');
      return;
    }
    setRowsLoading(true);
    axios.get(server.PBRING_CONDITION, { params: { machine_type_name: selectedMachine, cn: cn.trim(), process_code: processCode.trim() } })
      .then((r) => setRows((r.data?.rows || []).map((row) => ({ ...row, _k: row.id }))))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load condition rows')))
      .finally(() => setRowsLoading(false));
  };

  const updateRow = (k, field, value) => setRows((prev) => prev.map((r) => (r._k === k ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((prev) => [...prev, { _k: `new-${Date.now()}`, tool_number: '' }]);
  const removeRow = (k) => setRows((prev) => prev.filter((r) => r._k !== k));

  const saveRow = async (row) => {
    if (!row.tool_number?.trim()) { message.warning('Slot (tool_number) is required, e.g. T1'); return; }
    setRowsSaving(true);
    try {
      const { data } = await axios.put(server.PBRING_CONDITION, {
        ...row, id: row.id ?? undefined,
        cn: cn.trim(), mc_key: selectedMachine, machine: selectedMachine, process_code: processCode.trim(),
      });
      message.success(`Saved ${row.tool_number}`);
      setRows((prev) => prev.map((r) => (r._k === row._k ? { ...data.row, _k: data.row.id } : r)));
    } catch (err) {
      message.error(apiErrorMessage(err, 'Save failed'));
    } finally {
      setRowsSaving(false);
    }
  };

  const deleteRow = async (row) => {
    if (row.id == null) { removeRow(row._k); return; } // never saved — just drop it
    try {
      await axios.delete(`${server.PBRING_CONDITION}/${row.id}`);
      message.success('Deleted');
      removeRow(row._k);
    } catch (err) {
      message.error(apiErrorMessage(err, 'Delete failed'));
    }
  };

  const loadHistory = () => {
    if (!selectedMachine || !processCode.trim()) { message.warning('Select a machine and Process Code first'); return; }
    setHistLoading(true);
    axios.get(server.PBRING_CONDITION_HISTORY, { params: { machine_type_name: selectedMachine, process_code: processCode.trim() } })
      .then((r) => setHistRows((r.data?.rows || []).map((row, i) => ({ ...row, _k: `h-${i}` }))))
      .catch((err) => message.error(apiErrorMessage(err, 'Failed to load history')))
      .finally(() => setHistLoading(false));
  };
  const updateHistRow = (k, field, value) => setHistRows((prev) => prev.map((r) => (r._k === k ? { ...r, [field]: value } : r)));

  const commitHistory = async (force = false) => {
    if (!selectedMachine || !processCode.trim() || !targetCn.trim()) {
      message.warning('Select a machine, Process Code and target CN first');
      return;
    }
    const picked = histRows.filter((r) => r.use);
    if (!picked.length) { message.warning('No slots ticked'); return; }
    setCommitting(true);
    try {
      const { data } = await axios.post(server.PBRING_CONDITION_FROM_HISTORY, {
        cn: targetCn.trim(), machine_type_name: selectedMachine, process_code: processCode.trim(), rows: picked, force,
      });
      if (data.skippedCount > 0 && !force) {
        message.warning(
          <span>
            Added {data.insertedCount} slot(s) — skipped {data.skippedCount} already-present
            {' '}<a onClick={() => commitHistory(true)}>Add anyway</a>
          </span>, 8
        );
      } else {
        message.success(`Added ${data.insertedCount} slot(s) to CN ${targetCn.trim()}`);
      }
    } catch (err) {
      message.error(apiErrorMessage(err, 'Add failed'));
    } finally {
      setCommitting(false);
    }
  };

  const buildColumns = (data, onChange, extra) => [
    ...CONDITION_FIELD_COLS.map((c) => ({
      title: c.title, key: c.key, width: c.width,
      render: (_, r) => (
        <Input
          size="small"
          value={r[c.key] ?? ''}
          disabled={c.key === 'tool_number' && r.id != null}
          onChange={(e) => onChange(r._k, c.key, e.target.value)}
        />
      ),
    })),
    ...extra,
  ];

  const rowsColumns = buildColumns(rows, updateRow, [
    {
      title: '', key: 'actions', width: 90, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="primary" loading={rowsSaving} onClick={() => saveRow(r)}>Save</Button>
          <Popconfirm title="Delete this slot?" onConfirm={() => deleteRow(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]);

  const histColumns = [
    { title: 'Use', key: 'use', width: 50, fixed: 'left', render: (_, r) => <Checkbox checked={r.use} onChange={(e) => updateHistRow(r._k, 'use', e.target.checked)} /> },
    ...buildColumns(histRows, updateHistRow, []),
    { title: 'Used in history', dataIndex: 'hist', width: 100 },
  ];

  return (
    <div>
      <Card size="small" title="Edit — an existing CN's slots" style={{ marginBottom: 16 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Text type="secondary">Machine</Text>
          <Select
            style={{ width: 200 }} placeholder="Select a machine" value={selectedMachine}
            onChange={setSelectedMachine} options={machines.map((m) => ({ value: m.machine_type_name, label: m.machine_type_name }))} showSearch
          />
          <Input placeholder="CN e.g. 294065" style={{ width: 140 }} value={cn} onChange={(e) => setCn(e.target.value)} />
          <Input placeholder="Process Code e.g. 0081" style={{ width: 140 }} value={processCode} onChange={(e) => setProcessCode(e.target.value)} />
          <Button icon={<ReloadOutlined />} loading={rowsLoading} onClick={loadRows}>Load</Button>
          <Button icon={<PlusOutlined />} onClick={addRow} disabled={!selectedMachine || !cn.trim() || !processCode.trim()}>Add Slot</Button>
        </Space>
        <Table size="small" rowKey="_k" dataSource={rows} columns={rowsColumns} loading={rowsLoading} pagination={false} scroll={{ x: 1700 }} />
      </Card>

      <Card size="small" title="+ New CN from History — suggest from what this machine + process has used before">
        <Space wrap style={{ marginBottom: 12 }}>
          <Text type="secondary">Machine</Text>
          <Select
            style={{ width: 200 }} placeholder="Select a machine" value={selectedMachine}
            onChange={setSelectedMachine} options={machines.map((m) => ({ value: m.machine_type_name, label: m.machine_type_name }))} showSearch
          />
          <Input placeholder="Process Code e.g. 0081" style={{ width: 140 }} value={processCode} onChange={(e) => setProcessCode(e.target.value)} />
          <Button type="primary" icon={<DownloadOutlined />} loading={histLoading} onClick={loadHistory}>Load from history</Button>
        </Space>
        <Table size="small" rowKey="_k" dataSource={histRows} columns={histColumns} loading={histLoading} pagination={false} scroll={{ x: 1800, y: 400 }}
          locale={{ emptyText: <Empty description='Select Machine + Process Code then click "Load from history"' /> }}
        />
        <Space style={{ marginTop: 12 }}>
          <Input placeholder="Target CN e.g. 294099" style={{ width: 160 }} value={targetCn} onChange={(e) => setTargetCn(e.target.value)} />
          <Button type="primary" loading={committing} onClick={() => commitHistory(false)}>Add to CN</Button>
        </Space>
      </Card>
    </div>
  );
}

export default function PbRingMonitorPage() {
  const C = useColors();
  const userRole = useAuthStore((s) => s.userRole);
  const userDepartment = useAuthStore((s) => s.userDepartment);
  const userPerms = useAuthStore((s) => s.userPerms);
  const isPbringAdmin = userRole === 'AD' || userDepartment === 'AD'
    || (userPerms || []).includes('pbring_admin') || (userPerms || []).includes('all_mtc');

  const tabItems = [
    { key: 'search', label: 'Search (HW / Process / Machine)', children: <SearchTab C={C} /> },
    { key: 'add-hw', label: '+ New HW', children: <AddHwTab /> },
    { key: 'summary', label: 'Summary', children: <SummaryTab /> },
  ];
  if (isPbringAdmin) {
    // "Grid Templates (PDF)" (machine<->template assignment + re-import,
    // the Phase 5 admin surface) was removed once Phase 6 gave every PB Ring
    // machine — grinding AND turning — live-layout coverage: nothing reads
    // pbring_grid_template/pbring_machine_type.grid_template_id at render
    // time anymore, so there was nothing left for that tab to configure.
    tabItems.push({ key: 'param-config', label: 'Parameter Config', children: <ParamConfigTab /> });
    tabItems.push({ key: 'condition', label: 'Tool Condition', children: <ConditionTab /> });
    tabItems.push({ key: 'images', label: 'Images', children: <ImagesTab /> });
  }

  const bodyContent = (
    <Tabs defaultActiveKey="search" items={tabItems} />
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
