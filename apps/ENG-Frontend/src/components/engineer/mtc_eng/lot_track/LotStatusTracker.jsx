import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Layout, Typography, AutoComplete, Input, Button, Alert, Progress, Card,
  Table, Tag, Space, Radio, Empty, Spin, App, Popover, List, Modal, Segmented,
  Tooltip, Popconfirm,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, SyncOutlined, PlusOutlined, CloseOutlined,
  StarFilled, StarOutlined, DeleteOutlined, DownOutlined, ProfileOutlined, CheckCircleFilled,
} from '@ant-design/icons';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';

const { Content } = Layout;
const { Text, Title } = Typography;

// ── formatting helpers ───────────────────────────────────────────────────────
const fmtMinutes = (m) => {
  if (m == null || Number.isNaN(m)) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
};
const fmtDays = (d) => (d == null ? '—' : d === 0 ? 'same day' : `${d} d`);
const fmtDateTime = (s) => (s ? String(s).replace('T', ' ') : '—');
const hoursBetween = (a, b) => {
  if (!a || !b) return null;
  const d = (new Date(b) - new Date(a)) / 3600000;
  return Number.isFinite(d) ? d : null;
};
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
};
const DUE_SOON_DAYS = 3;

const dueInfo = (planDate, compDate) => {
  if (!planDate) return null;
  if (compDate) {
    const slip = daysUntil(compDate) - daysUntil(planDate);
    const late = compDate > planDate;
    return { color: late ? 'warning' : 'success', text: `Finished${slip ? ` ${Math.abs(slip)} days ${late ? 'late' : 'early'}` : ' on plan'}` };
  }
  const dl = daysUntil(planDate);
  if (dl == null) return null;
  if (dl < 0) return { color: 'error', text: `${-dl} Days overdue` };
  if (dl === 0) return { color: 'warning', text: 'Due today' };
  return { color: dl <= DUE_SOON_DAYS ? 'warning' : 'green', text: `${dl} Days left` };
};

const STATUS_META = {
  done: { step: 'finish', tag: 'success', label: 'Done' },
  current: { step: 'process', tag: 'processing', label: 'In progress' },
  pending: { step: 'wait', tag: 'default', label: 'Waiting' },
};

// normalized [{lotNo, controlNo|null}] → stable JSON for change detection
const lotsKey = (arr) => JSON.stringify((arr || []).map((l) => [String(l.lotNo || '').toUpperCase(), l.controlNo || '']));

// columns per row before wrapping to a new one
const ROW_SIZE = 5;
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// ── roadmap — custom vertical timeline. The WIP-wait chip sits ON the connector
// just above a step's node and belongs to THAT step: how long it waited for the
// previous step to finish and hand the lot over. Settled (prev.dwellDays) once
// the previous step is done; a running "so far" count while it is still WIP.
function Dot({ status }) {
  if (status === 'done') return <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15 }} />;
  if (status === 'current') return <SyncOutlined spin style={{ color: '#1677ff', fontSize: 14 }} />;
  return <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #d9d9d9', display: 'inline-block', marginTop: 3 }} />;
}

// per-status framing for a step box on the centre-spine roadmap
const STEP_BOX = {
  done: { border: '1px solid #b7eb8f', background: '#f6ffed' },
  current: { border: '1px solid #69b1ff', background: '#e6f4ff', boxShadow: '0 0 0 3px rgba(22,119,255,0.12)' },
  pending: { border: '1px dashed #d9d9d9', background: '#fff' },
};

function Roadmap({ steps, issuedDate }) {
  const RAIL = '#d9d9d9';
  return (
    // centre spine: an absolutely-placed line down the middle, step boxes and
    // wait chips stack on top of it (zIndex 1) so the line only shows in the gaps
    <div style={{ position: 'relative', paddingTop: 12, paddingBottom: 4 }}>
      <span style={{ position: 'absolute', top: 4, bottom: 4, left: 'calc(50% - 1px)', width: 2, background: RAIL, zIndex: 0 }} />

      {/* the lot being issued on paper — the roadmap's starting milestone */}
      <div style={{ position: 'relative', zIndex: 1, borderRadius: 12, padding: '10px 12px 9px', ...STEP_BOX.done }}>
        <span style={{
          position: 'absolute', top: -9, left: 'calc(50% - 9px)', width: 18, height: 18, borderRadius: '50%',
          background: '#fff', border: STEP_BOX.done.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15 }} />
        </span>
        <Text strong style={{ fontSize: 13 }}>Issued Lot</Text>
        <div><Text type="secondary" style={{ fontSize: 11.5 }}>issued {issuedDate || '—'}</Text></div>
      </div>
      <div style={{ height: 12 }} />
      {steps.map((s, i) => {
        const meta = STATUS_META[s.status] || STATUS_META.pending;
        const box = STEP_BOX[s.status] || STEP_BOX.pending;
        const bits = [];
        if (s.status === 'current') {
          // no production row yet — show what is known while it's WIP
          if (s.incomingWc) bits.push(`WC ${s.incomingWc}`);
          if (s.startDate) bits.push(`received ${s.startDate}`);
          if (s.incomingQty != null) bits.push(`qty in ${s.incomingQty}`);
        } else {
          if (s.wc) bits.push(`WC ${s.wc}`);
          // No per-step start timestamp exists in pc_production, so show only the
          // recorded completion date — the inter-step gap is carried by the
          // "Wait in process" chip on the connector, not by a fake start→done span.
          if (s.compDate) bits.push(`done ${s.compDate}`);
          if (s.runMinutes != null && s.runMinutes > 0) bits.push(`run ${fmtMinutes(s.runMinutes)}`);
          if (s.goodQty != null) bits.push(`good ${s.goodQty}${s.badQty ? ` (ng ${s.badQty})` : ''}`);
          if (s.operator) bits.push(s.operator);
        }
        // Wait chip sits on the spine in the gap just below THIS step's box and
        // reports THIS step's own wait — the span from the previous milestone to
        // this step completing (s.dwellDays = comp[i] − comp[i-1], or issue date
        // for the first step) once done, or a running "so far" count while WIP.
        let waitChip = null;
        if (s.status === 'done' && s.dwellDays != null && s.dwellDays > 0) {
          waitChip = { days: s.dwellDays, ongoing: false };
        } else if (s.status === 'current' && s.startDate) {
          const soFar = -(daysUntil(s.startDate) || 0);
          if (soFar > 0) waitChip = { days: soFar, ongoing: true };
        }

        return (
          <React.Fragment key={s.order}>
            <div
              className={s.status === 'current' ? 'lot-roadmap-current' : undefined}
              style={{
                position: 'relative', zIndex: 1, borderRadius: 12, padding: '10px 12px 9px',
                ...box,
              }}
            >
              {/* status dot straddling the top edge, sitting on the spine */}
              <span style={{
                position: 'absolute', top: -9, left: 'calc(50% - 9px)', width: 18, height: 18, borderRadius: '50%',
                background: '#fff', border: box.border, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Dot status={s.status} />
              </span>
              <Space size={[6, 2]} wrap>
                <Text strong style={{ fontSize: 13 }}>{s.order}. {s.nameEn}</Text>
                <Tag style={{ marginInlineEnd: 0 }}>{s.processCode}</Tag>
                <Tag color={meta.tag} style={{ marginInlineEnd: 0 }}>{meta.label}</Tag>
                {s.offPlan ? <Tag color="warning" style={{ marginInlineEnd: 0 }}>off-plan</Tag> : null}
              </Space>
              {bits.length ? (
                <div><Text type="secondary" style={{ fontSize: 11.5 }}>{bits.join('  ·  ')}</Text></div>
              ) : null}
            </div>
            {waitChip ? (
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center', padding: '7px 0' }}>
                <Tag
                  color={waitChip.days >= 7 ? 'warning' : 'default'}
                  style={{ margin: 0, fontSize: 11, borderRadius: 10, boxShadow: '0 0 0 3px #fff' }}
                >
                  ⏳ {waitChip.ongoing ? `Waiting ${fmtDays(waitChip.days)} so far` : `Wait in process ${fmtDays(waitChip.days)}`}
                </Tag>
              </div>
            ) : <div style={{ height: 12 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── process detail — the full per-step table (scrolls inside the card) ───────
const detailColumns = [
  { title: '#', dataIndex: 'order', width: 40, fixed: 'left' },
  { title: 'Process', dataIndex: 'nameEn', width: 170, render: (v, r) => (
    <span style={{ whiteSpace: 'nowrap' }}><Text strong>{v}</Text> <Tag>{r.processCode}</Tag></span>
  ) },
  { title: 'Status', dataIndex: 'status', width: 108, render: (v) => {
    const m = STATUS_META[v] || STATUS_META.pending;
    return <Tag color={m.tag}>{m.label}</Tag>;
  } },
  { title: 'Machine / WC', dataIndex: 'machineLabel', width: 210, render: (v, r) => v
    ? <span>{v}{r.wc ? <Text type="secondary"> · WC {r.wc}</Text> : null}</span>
    : <Text type="secondary">—</Text> },
  { title: 'good / ng', dataIndex: 'goodQty', width: 96, align: 'right', render: (v, r) => v == null ? '—' : `${v}${r.badQty ? ` / ${r.badQty} ng` : ''}` },
  { title: 'Cycle', dataIndex: 'cycleSec', width: 70, align: 'right', render: (v) => (v ? `${v}s` : '—') },
  { title: 'Setup', dataIndex: 'setupSec', width: 90, align: 'right', render: (v) => (v ? fmtMinutes(Math.round(v / 60)) : '—') },
  { title: 'Run time', dataIndex: 'runMinutes', width: 104, align: 'right', render: (v) => (v == null ? '—' : fmtMinutes(v)) },
  // No 'Started' column: pc_production records only the completion date per step.
  { title: 'Done', dataIndex: 'compDate', width: 104, render: (v) => v || '—' },
  { title: 'WIP wait', dataIndex: 'dwellDays', width: 88, align: 'right', render: (v) => fmtDays(v) },
];

function ProcessDetail({ steps }) {
  return (
    <Table
      size="small"
      rowKey="order"
      columns={detailColumns}
      dataSource={steps}
      pagination={false}
      scroll={{ x: 1076 }}
      rowClassName={(r) => (r.status === 'current' ? 'lot-track-current-row' : '')}
    />
  );
}

// ── compact status strip for a column ────────────────────────────────────────
function StatusStrip({ data }) {
  const { header, summary } = data;
  const tags = [];
  if (header.isCancelled) tags.push(<Tag key="c" color="error">Cancelled / closed</Tag>);
  const di = dueInfo(header.compPlanDate, header.compDate);
  if (di && di.color !== 'green' && di.color !== 'success') tags.push(<Tag key="d" color={di.color}>{di.text}</Tag>);
  const idleH = hoursBetween(data.lotUpdatedAt, data.syncAsOf);
  if (!header.isCancelled && summary.hasCurrent && idleH != null && idleH > 26) {
    tags.push(<Tag key="i" color="gold">idle {Math.round(idleH / 24)} d @ {summary.currentStepName}</Tag>);
  }
  return (
    <div style={{ marginBottom: 6, lineHeight: 1.9 }}>
      {tags}
      <Text type="secondary" style={{ fontSize: 11 }}>
        synced {fmtDateTime(data.syncAsOf)} · lot moved {fmtDateTime(data.lotUpdatedAt)}
      </Text>
    </div>
  );
}

// ── one tracked lot ─────────────────────────────────────────────────────────
// Every column is a fixed-height card so a row of them lines up; the lower pane
// (roadmap OR the trimmed process-detail table) is the only part that scrolls.
const CARD_H_MULTI = 660;
const CARD_H_SINGLE = 760;

function LotColumn({ entry, state, single, onOpenDetail, onRemove, onReload, onResolveControl }) {
  const st = state || { status: 'loading' };

  // Auto-scroll the roadmap so the CURRENT step sits at the top of the pane.
  const paneRef = useRef(null);
  useLayoutEffect(() => {
    if (st.status !== 'ok') return;
    const pane = paneRef.current;
    if (!pane) return;
    const cur = pane.querySelector('.lot-roadmap-current');
    if (cur) {
      pane.scrollTop += cur.getBoundingClientRect().top - pane.getBoundingClientRect().top - 6;
    }
  }, [st.status, st.data]);

  // Fixed to 1/5 of the row width so every column is identical whether its row
  // holds 5 (full) or fewer (left-aligned, trailing gap). 64px = 4 × 16px gaps.
  const flexStyle = single
    ? { flex: '0 0 min(780px, 100%)', maxWidth: '100%' }
    : { flex: '0 0 calc((100% - 64px) / 5)', minWidth: 0, maxWidth: 440 };
  const H = single ? CARD_H_SINGLE : CARD_H_MULTI;
  const wrap = (children) => (
    <Card
      size="small"
      style={{ ...flexStyle, height: H }}
      styles={{ body: { padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {children}
    </Card>
  );

  const headerBar = (label, sub, canToggle) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, flex: '0 0 auto' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Button
          type="text" size="small"
          onClick={canToggle ? onOpenDetail : undefined}
          title={canToggle ? 'Open process detail' : undefined}
          style={{ padding: 0, height: 'auto', fontWeight: 700, fontSize: 15, cursor: canToggle ? 'pointer' : 'default' }}
          icon={canToggle ? <ProfileOutlined /> : null}
        >
          {label}
        </Button>
        {sub ? <div style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div> : null}
      </div>
      <Space size={2}>
        <Tooltip title="Reload"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={onReload} /></Tooltip>
        <Tooltip title="Remove"><Button type="text" size="small" icon={<CloseOutlined />} onClick={onRemove} /></Tooltip>
      </Space>
    </div>
  );

  if (st.status === 'loading') {
    return wrap(<>{headerBar(entry.lotNo)}<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin /></div></>);
  }
  if (st.status === 'error') {
    return wrap(<>{headerBar(entry.lotNo)}<Alert type="error" showIcon message={st.error || 'Failed to load'} /></>);
  }
  if (st.status === 'ambiguous') {
    return wrap(
      <>
        {headerBar(entry.lotNo, `matches ${st.candidates.length} control numbers`)}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Radio.Group
            onChange={(e) => onResolveControl(e.target.value)}
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {st.candidates.map((c) => (
              <Radio key={c.controlNo} value={c.controlNo}>
                <Space size={4} wrap>
                  <Text strong>{c.controlNo}</Text>
                  <Text type="secondary">{c.partsNo}</Text>
                  {c.gnk ? <Tag>{c.gnk}</Tag> : null}
                  {c.remark ? <Tag color="warning">{c.remark}</Tag> : null}
                </Space>
              </Radio>
            ))}
          </Radio.Group>
        </div>
      </>,
    );
  }

  const { data } = st;
  const { header, summary } = data;
  const di = dueInfo(header.compPlanDate, header.compDate);
  const dl = !header.isCancelled && !header.compDate ? daysUntil(header.compPlanDate) : null;

  return wrap(
    <>
      {headerBar(
        <Space size={6} wrap>
          <span>{header.lotNo}</span>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{header.controlNo}</Tag>
        </Space>,
        header.partsNo,
        true,
      )}

      <div style={{ flex: '0 0 auto' }}>
        <StatusStrip data={data} />

        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <Progress type="dashboard" percent={summary.pctComplete} size={single ? 150 : 112} />
          {di ? (
            <div>
              <Tag color={di.color} style={{ fontSize: 12, padding: '1px 10px', margin: 0 }}>{di.text}</Tag>
              <div><Text type="secondary" style={{ fontSize: 11 }}>Plan finish {header.compPlanDate || '—'}</Text></div>
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 13, marginBottom: 2 }}>
          {summary.hasCurrent
            ? <>Now at <Text strong>{summary.currentOrder}/{summary.totalSteps}</Text> — <Text strong>{summary.currentStepName}</Text></>
            : <>All {summary.totalSteps} steps complete</>}
        </div>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>
          Done {summary.doneSteps}/{summary.totalSteps} · Remaining {summary.remainingSteps} process ·
          {' '}run {fmtMinutes(summary.totalRunMinutes)}
        </div>
        <div style={{ fontSize: 11.5, color: '#8c8c8c', marginBottom: 8 }}>
          Issued {header.entryDate || '—'}
        </div>

        {dl != null && dl <= DUE_SOON_DAYS ? (
          <Alert
            banner
            type={dl < 0 ? 'error' : 'warning'}
            message={dl < 0
              ? `Behind plan by ${-dl} day(s) — ${summary.remainingSteps} step(s) left`
              : `Due in ${dl} day(s) — ${summary.remainingSteps} step(s) left`}
            style={{ marginBottom: 8, padding: '4px 8px', fontSize: 12 }}
          />
        ) : null}
      </div>

      <div ref={paneRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 }}>
        <Roadmap steps={data.steps} issuedDate={header.entryDate} />
      </div>
    </>,
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function LotStatusTracker() {
  const { message } = App.useApp();
  const keyRef = useRef(1);
  const nextKey = () => `k${keyRef.current++}`;

  const [entries, setEntries] = useState([]);          // [{ key, lotNo, controlNo }]
  const [stateByKey, setStateByKey] = useState({});    // key → { status, data, candidates, error }
  const [detailModal, setDetailModal] = useState(null); // { header fields…, steps } shown in a modal

  const [term, setTerm] = useState('');
  const [options, setOptions] = useState([]);
  const debRef = useRef(null);

  const [saved, setSaved] = useState([]);
  const [activeSaved, setActiveSaved] = useState(null); // { id, name }
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveMode, setSaveMode] = useState('new');     // 'new' | 'update'
  const [busy, setBusy] = useState(false);

  const patchState = (key, patch) =>
    setStateByKey((m) => ({ ...m, [key]: { ...(m[key] || {}), ...patch } }));

  const fetchEntry = useCallback(async (key, lotNo, controlNo) => {
    patchState(key, { status: 'loading' });
    try {
      const { data: d } = await axios.get(`${server.MTC_LOT_TRACK}/${encodeURIComponent(lotNo)}`, {
        params: controlNo ? { control_no: controlNo } : {},
      });
      if (d.ambiguous) patchState(key, { status: 'ambiguous', candidates: d.candidates || [], data: null });
      else patchState(key, { status: 'ok', data: d, candidates: null, error: null });
    } catch (e) {
      const msg = e.response?.status === 404 ? `Lot "${lotNo}" not found` : (e.response?.data?.error || e.message);
      patchState(key, { status: 'error', error: msg, data: null });
    }
  }, []);

  const addLot = useCallback((lotNo, controlNo) => {
    const lot = String(lotNo || '').trim();
    if (!lot) return;
    let dup = false;
    setEntries((cur) => {
      if (cur.some((e) => e.lotNo.toUpperCase() === lot.toUpperCase() && (e.controlNo || '') === (controlNo || ''))) {
        dup = true;
        return cur;
      }
      const key = nextKey();
      queueMicrotask(() => fetchEntry(key, lot, controlNo));
      return [...cur, { key, lotNo: lot, controlNo: controlNo || undefined }];
    });
    if (dup) message.info(`"${lot}" is already tracked`);
    setTerm('');
    setOptions([]);
  }, [fetchEntry, message]);

  const removeLot = (key) => {
    setEntries((cur) => cur.filter((e) => e.key !== key));
    setStateByKey((m) => { const n = { ...m }; delete n[key]; return n; });
  };

  const openDetail = (key) => {
    const s = stateByKey[key];
    if (s?.status === 'ok') setDetailModal({ ...s.data.header, steps: s.data.steps });
  };

  const resolveControl = (key, controlNo) => {
    setEntries((cur) => cur.map((e) => (e.key === key ? { ...e, controlNo } : e)));
    fetchEntry(key, entries.find((e) => e.key === key)?.lotNo, controlNo);
  };

  const reloadAll = () => entries.forEach((e) => fetchEntry(e.key, e.lotNo, e.controlNo));

  const onSearchInput = useCallback((v) => {
    setTerm(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (!v || v.trim().length < 2) { setOptions([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const { data: d } = await axios.get(server.MTC_LOT_TRACK_SEARCH, { params: { q: v.trim() } });
        setOptions((d.results || []).map((r) => ({
          value: r.lotNo,
          label: (
            <Space size={6} wrap>
              <Text strong>{r.lotNo}</Text>
              <Text type="secondary">{r.controlNo}</Text>
              <Text type="secondary">{r.partsNo}</Text>
              {r.remark ? <Tag color="warning">{r.remark}</Tag> : null}
            </Space>
          ),
        })));
      } catch { /* best-effort */ }
    }, 250);
  }, []);

  // ── saved tracks ──────────────────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    try {
      const { data } = await axios.get(server.MTC_LOT_TRACK_SAVED);
      setSaved(data.tracks || []);
    } catch (e) { message.error(e.response?.data?.error || e.message); }
  }, [message]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const currentLots = entries.map((e) => ({ lotNo: e.lotNo, controlNo: e.controlNo || null }));
  const activeTrack = activeSaved ? saved.find((t) => t.id === activeSaved.id) : null;
  const dirty = activeTrack ? lotsKey(activeTrack.lots) !== lotsKey(currentLots) : false;

  const applySaved = (track) => {
    const next = (track.lots || []).map((l) => ({ key: nextKey(), lotNo: l.lotNo, controlNo: l.controlNo || undefined }));
    setEntries(next);
    setStateByKey({});
    setActiveSaved({ id: track.id, name: track.name });
    setSavedOpen(false);
    next.forEach((e) => fetchEntry(e.key, e.lotNo, e.controlNo));
  };

  const openSaveModal = () => {
    if (!entries.length) { message.info('Add a lot first'); return; }
    setSaveMode(activeTrack ? 'update' : 'new');
    setSaveName(activeTrack ? activeTrack.name : '');
    setSaveModal(true);
  };

  const doSave = async () => {
    setBusy(true);
    try {
      if (saveMode === 'update' && activeTrack) {
        const { data } = await axios.put(`${server.MTC_LOT_TRACK_SAVED}/${activeTrack.id}`, {
          name: saveName.trim() || activeTrack.name, lots: currentLots,
        });
        setActiveSaved({ id: data.track.id, name: data.track.name });
        message.success('Track updated');
      } else {
        if (!saveName.trim()) { message.warning('Name required'); setBusy(false); return; }
        const { data } = await axios.post(server.MTC_LOT_TRACK_SAVED, { name: saveName.trim(), lots: currentLots });
        setActiveSaved({ id: data.track.id, name: data.track.name });
        message.success('Track saved');
      }
      setSaveModal(false);
      loadSaved();
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally { setBusy(false); }
  };

  const deleteSaved = async (id) => {
    try {
      await axios.delete(`${server.MTC_LOT_TRACK_SAVED}/${id}`);
      if (activeSaved?.id === id) setActiveSaved(null);
      loadSaved();
      message.success('Deleted');
    } catch (e) { message.error(e.response?.data?.error || e.message); }
  };

  const single = entries.length <= 1;

  const savedPanel = (
    <div style={{ width: 320 }}>
      {saved.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No saved tracks yet" />
      ) : (
        <List
          size="small"
          dataSource={saved}
          renderItem={(t) => (
            <List.Item
              style={{ padding: '6px 0' }}
              actions={[
                <Button key="load" type="link" size="small" onClick={() => applySaved(t)}>Load</Button>,
                <Popconfirm key="del" title="Delete this track?" onConfirm={() => deleteSaved(t.id)} okText="Delete" okButtonProps={{ danger: true }}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <Space size={6}>
                <Text strong>{t.name}</Text>
                <Tag>{t.count === 1 ? 'single' : `${t.count} lots`}</Tag>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  // Standalone workspace — opened in its own tab from the Tools gallery, so it
  // renders full-window with no app header or sidebar.
  return (
    <Layout style={{ height: '100vh' }}>
      <Layout>
        <Content className="kb-vscroll" style={{ height: '100vh', overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ marginBottom: 12 }}>
            <Title level={4} style={{ margin: 0 }}>
              Lot Status Tracker
              <SystemVersionBadge system="lot-track" />
            </Title>
            <Text type="secondary">Track one or many lots side by side — where each is now, what is left, and how it stands against plan.</Text>
          </div>

          <Space wrap style={{ marginBottom: 14 }}>
            <Space.Compact style={{ width: 380 }}>
              <AutoComplete
                style={{ width: '100%' }}
                options={options}
                value={term}
                onChange={onSearchInput}
                onSelect={(v) => addLot(v)}
                placeholder="Lot no. e.g. UD007T7"
              >
                <Input allowClear onPressEnter={() => addLot(term)} prefix={<SearchOutlined />} />
              </AutoComplete>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => addLot(term)}>Add</Button>
            </Space.Compact>

            <Button icon={<ReloadOutlined />} onClick={reloadAll} disabled={!entries.length}>Reload all</Button>

            <Popover
              open={savedOpen}
              onOpenChange={setSavedOpen}
              trigger="click"
              placement="bottomLeft"
              content={savedPanel}
              title="Saved tracks"
            >
              <Button icon={<StarOutlined />}>Saved{saved.length ? ` (${saved.length})` : ''} <DownOutlined /></Button>
            </Popover>

            <Button type="dashed" icon={<StarFilled style={{ color: '#faad14' }} />} onClick={openSaveModal} disabled={!entries.length}>
              {activeTrack ? (dirty ? 'Save changes' : 'Save as…') : 'Save track'}
            </Button>

            {activeTrack ? (
              <Tag color="gold" style={{ marginInlineStart: 4 }}>
                ★ {activeTrack.name}{dirty ? ' • modified' : ''}
              </Tag>
            ) : null}
          </Space>

          {entries.length === 0 ? (
            <Empty description="No lots tracked — add a lot number above, or load a saved track" style={{ marginTop: 64 }} />
          ) : (
            <>
              {chunk(entries, ROW_SIZE).map((row, ri) => (
                <div key={ri} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                  {row.map((e) => (
                    <LotColumn
                      key={e.key}
                      entry={e}
                      state={stateByKey[e.key]}
                      single={single}
                      onOpenDetail={() => openDetail(e.key)}
                      onRemove={() => removeLot(e.key)}
                      onReload={() => fetchEntry(e.key, e.lotNo, e.controlNo)}
                      onResolveControl={(cn) => resolveControl(e.key, cn)}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
        </Content>
      </Layout>

      <Modal
        title={saveMode === 'update' ? 'Update saved track' : 'Save track'}
        open={saveModal}
        onOk={doSave}
        confirmLoading={busy}
        onCancel={() => setSaveModal(false)}
        okText="Save"
      >
        {activeTrack ? (
          <Segmented
            block
            style={{ marginBottom: 12 }}
            value={saveMode}
            onChange={setSaveMode}
            options={[
              { label: `Update "${activeTrack.name}"`, value: 'update' },
              { label: 'Save as new', value: 'new' },
            ]}
          />
        ) : null}
        <Input
          placeholder="Track name"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onPressEnter={doSave}
          maxLength={120}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
          {entries.length === 1 ? '1 lot (single)' : `${entries.length} lots (group)`}: {entries.map((e) => e.lotNo).join(', ')}
        </div>
      </Modal>

      <Modal
        title={detailModal ? (
          <Space wrap>
            <Text strong>{detailModal.lotNo}</Text>
            <Tag color="blue">{detailModal.controlNo}</Tag>
            <Text type="secondary">{detailModal.partsNo}</Text>
            <Text type="secondary" style={{ fontWeight: 400 }}>Process detail</Text>
          </Space>
        ) : 'Process detail'}
        open={!!detailModal}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width="min(1240px, 96vw)"
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      >
        {detailModal ? <ProcessDetail steps={detailModal.steps} /> : null}
      </Modal>

      <style>{`.lot-track-current-row > td { background: rgba(24,144,255,0.08) !important; }`}</style>
    </Layout>
  );
}
