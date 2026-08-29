import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Select, Spin, Typography, Row, Col, Table, Tag, Space, Button, App, Tooltip } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SettingOutlined, WarningOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import ReportScopeModal from './ReportScopeModal';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip, Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

// Register datalabels here so per-dataset labels (Complete % line) render even when
// this page loads first. Every chart on this page opts out via `datalabels:{display:false}`
// except the datasets that explicitly enable it.
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ChartTitle, ChartTooltip, Legend, ChartDataLabels);

const { Content } = Layout;
const { Text } = Typography;

// ── Palette ────────────────────────────────────────────────────────────────────
// Chrome (bg / card / border / text) follows the app theme. The DATA colours cannot:
// the theme supplies 8 light surfaces and 1 dark one (rpg), and this page's series
// hues were picked against the old #041320 ground. Measured contrast vs #FFFFFF for
// the dark set: cyan 1.77, greenSoft 1.63, yellow 1.58, green 2.27, orange 2.38 —
// five of eight below the 3:1 floor, i.e. invisible on a light theme. So each set is
// stated for the surface it is read on and picked by the theme's own lightness.
//
// Hue IDENTITY is preserved across the pair (green stays green, red stays red) —
// these are status encodings the operator reads as meaning, not decoration.
const SERIES_DARK = {
  blue: '#1890ff', cyan: '#00d4ff', green: '#52c41a', greenSoft: '#95de64',
  red: '#ff4d4f', yellow: '#ffc53d', orange: '#fa8c16',
  purple: '#9254de',   // #722ed1 was 2.51 on the rpg ground — the one dark-set failure
  magenta: '#eb2f96',
};
const SERIES_LIGHT = {
  blue: '#0958d9', cyan: '#08979c', green: '#389e0d', greenSoft: '#5b8c00',
  red: '#cf1322', yellow: '#ad6800', orange: '#d4380d',
  purple: '#531dab', magenta: '#c41d7f',
};

// The theme's own background decides which set is read — not a hardcoded theme name,
// so a theme added later is classified correctly without touching this file.
const isDarkHex = (hex) => {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return true;
  const n = parseInt(h, 16);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return (0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)) < 0.4;
};

const useColors = () => {
  const { theme } = useTheme();
  return useMemo(() => {
    const c = theme?.colors || {};
    const dark = isDarkHex(c.background || '#041320');
    return {
      ...(dark ? SERIES_DARK : SERIES_LIGHT),
      bg: c.background || '#041320',
      card: c.surface || '#072035',
      border: c.border || '#0e3a5c',
      textPri: c.textPrimary || '#e8f4ff',
      textSec: c.textSecondary || '#6fa3c7',
      // Grid lines must recede against whichever ground they sit on; borrowing the
      // theme's border at low alpha keeps them recessive in both.
      gridLine: hexToRgba(c.border || '#0e3a5c', dark ? 0.8 : 0.55),
      isDark: dark,
    };
  }, [theme]);
};

const partTypeColors = (C) => ({
  ball: C.blue,
  race: C.green,
  body: C.orange,
  sleeve: C.purple,
  spherical: C.red,
  mecha: C.magenta,
  other: C.textSec,
});

// Canonical display order for part-type series/cards. Types in scope but not listed
// here fall to the end (still shown). Keep in sync with the backend cnPartType taxonomy.
const PART_TYPE_ORDER = ['ball', 'race', 'mecha', 'body', 'sleeve', 'spherical'];

// 'body' and 'mecha' both surface as "Mecha" on the dashboard (mecha = C95/C99 mechanical
// parts); every other type is Title-cased. Single source for card + chart labels.
const partTypeLabel = (t) => {
  const k = String(t || '').toLowerCase();
  return (k === 'body' || k === 'mecha') ? 'Mecha' : (t.charAt(0).toUpperCase() + t.slice(1));
};

// Chart.js fills want rgba; PART_TYPE_COLOR is hex. Convert so dynamic series can share
// one color source (avoids hardcoding a parallel rgba list per part type).
const hexToRgba = (hex, a) => {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(111,163,199,${a})`; // C.cyan-ish fallback
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const levelCfg = (C) => ({
  COMPLETE: { color: C.green, label: 'Complete', icon: <CheckCircleOutlined />, antd: 'success', desc: 'Tool match + Excel Config ✅ → PDF ready' },
  PENDING: { color: C.yellow, label: 'Pending', icon: <ClockCircleOutlined />, antd: 'warning', desc: 'Tool does not match sds_machine_tool or machine has no Excel Parameter Config yet' },
});

const cardStyleOf = (C) => ({
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px',
});

const sectionTitle = (label, C) => (
  <div style={{
    color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
    textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
    paddingBottom: 6, marginBottom: 12,
  }}>
    {label}
  </div>
);

// ── Part Type Card ─────────────────────────────────────────────────────────────
const PartTypeCard = ({ pt, C }) => {
  const cardStyle = cardStyleOf(C);
  const color = partTypeColors(C)[pt.part_type] || C.cyan;
  const pct = pt.complete_pct || 0;                       // with T-Select #1
  const pctSaved = pt.complete_saved_pct ?? pct;          // baseline (saved only)
  const boost = Math.max(0, (pt.complete || 0) - (pt.complete_saved ?? pt.complete ?? 0));
  
  // Custom label mapping: 'body' or 'mecha' -> 'Mecha' (shared with the chart series)
  const displayLabel = partTypeLabel(pt.part_type);

  return (
    <div style={{ ...cardStyle, borderTop: `3px solid ${color}`, height: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
        <Text style={{ color, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>
          {displayLabel}
        </Text>
        <Tooltip title="SDS requirements = CN × machine × process (one CN may need several setup sheets)">
          <Text style={{ color: C.textPri, fontSize: 22, fontWeight: 800, lineHeight: 1, cursor: 'help' }}>
            {(pt.total ?? 0).toLocaleString()}
          </Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <Text style={{ color: C.textSec, fontSize: 10 }}>SDS reqs</Text>
        <Tooltip title="Unique CNs (deduplicated across machine × process)">
          <Text style={{ color: C.textSec, fontSize: 10, cursor: 'help' }}>{(pt.cn_count ?? 0).toLocaleString()} Unique CNs</Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ color: C.textSec, fontSize: 10 }}>PDF Ready</Text>
        <Tooltip title="Complete / Pending sheets">
          <Text style={{ fontSize: 10, cursor: 'help' }}>
            <span style={{ color: C.green, fontWeight: 700 }}>{(pt.complete ?? 0).toLocaleString()}</span>
            <span style={{ color: C.textSec }}> comp / </span>
            <span style={{ color: C.yellow, fontWeight: 700 }}>{(pt.pending ?? 0).toLocaleString()}</span>
            <span style={{ color: C.textSec }}> pend</span>
          </Text>
        </Tooltip>
      </div>
      {/* Two-tone bar: solid = KZW baseline, soft green = THAI Complete (T-Select #1 boost, * ) */}
      <Tooltip title={`KZW ${pctSaved}% + THAI ${(pct - pctSaved).toFixed(1)}% = ${pct}%`}>
        <div style={{ background: C.border, borderRadius: 3, height: 6, overflow: 'hidden', margin: '3px 0 2px', display: 'flex', cursor: 'help' }}>
          <div style={{ width: `${Math.min(pctSaved, 100)}%`, height: '100%', background: C.green, transition: 'width 0.8s ease' }} />
          <div style={{ width: `${Math.min(Math.max(pct - pctSaved, 0), 100)}%`, height: '100%', background: C.greenSoft, opacity: 0.85, transition: 'width 0.8s ease' }} />
        </div>
      </Tooltip>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={{ color: pctSaved >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>
          {pctSaved}%
        </Text>
        {boost > 0 && (
          <Text style={{ color: pct >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>→ {pct}% <Text style={{ color: C.greenSoft, fontSize: 9 }}>(+THAI *)</Text></Text>
        )}
      </div>
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Tag color="success" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{(pt.complete_saved ?? pt.complete).toLocaleString()} KZW complete</Tag>
        {boost > 0 && (
          <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
            <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: C.greenSoft, background: hexToRgba(C.greenSoft, 0.18), borderColor: C.greenSoft }}>+{boost.toLocaleString()} THAI *</Tag>
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// Friendly labels for the pending_reason filter. Unknown codes fall back to the raw
// value so a newly introduced reason still shows up rather than disappearing.
const REASON_LABELS = {
  NO_EXCEL: 'Tool ✓ — needs Excel config',
  NO_TOOL: 'No tool match',
  NO_TOOL_NO_EXCEL: 'No tool + no Excel config',
};

// Extra reason-filter entry that is NOT a pending_reason. A limit anomaly is a
// separate flag (`limit_excluded` — produced on a machine its T-Select size LIMIT
// says it cannot run) that rides along on a row which still classifies under one of
// the reasons above, so it can never be a REASON_LABELS key. The sentinel keeps it
// selectable in the same dropdown; filteredAttention special-cases it.
const LIMIT_ANOMALY = '__LIMIT_ANOMALY__';

// ── Main component ─────────────────────────────────────────────────────────────
export default function SdsCoverageDashboard() {
  // Shadows nothing — the module-level `C` is gone. Every `C.*` below now reads the
  // active theme, and the series half of it flips with the theme's own lightness.
  const C = useColors();
  const cardStyle = cardStyleOf(C);
  const LEVEL_CFG = levelCfg(C);
  const PART_TYPE_COLOR = partTypeColors(C);
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [filterPt, setFilterPt] = useState('');
  const [filterMc, setFilterMc] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // The server builds the report asynchronously (the per-CN Tooling Select pass
  // takes minutes) and caches it. A cold request returns 202 {building:true};
  // we then poll until the cache is ready. Subsequent loads are instant.
  const fetchData = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_REPORT_COVERAGE,
        opts.refresh ? { params: { refresh: 1 } } : undefined);
      if (res.status === 202 || res.data?.building) {
        setBuilding(true);
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const r = await axios.get(server.MTC_SDS_V2_REPORT_COVERAGE);
              if (r.status !== 202 && !r.data?.building) {
                stopPolling();
                setData(r.data);
                setBuilding(false);
                setLoading(false);
              }
            } catch { /* keep polling — transient errors are fine */ }
          }, 5000);
        }
        return; // keep the spinner up while the report builds
      }
      setData(res.data);
      setBuilding(false);
      setLoading(false);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load coverage data');
      setLoading(false);
    }
  }, [message, stopPolling]);

  useEffect(() => {
    fetchData();
    return stopPolling; // clear the poll timer on unmount
  }, [fetchData, stopPolling]);

  const sortByPartTypeOrder = (arr, keyOf) => [...arr].sort((a, b) => {
    const ia = PART_TYPE_ORDER.indexOf(String(keyOf(a)).toLowerCase());
    const ib = PART_TYPE_ORDER.indexOf(String(keyOf(b)).toLowerCase());
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const byPartType = useMemo(
    () => sortByPartTypeOrder(data?.byPartType || [], r => r.part_type),
    [data]
  );

  // The part-type set that drives the New Parts chart series. Prefer the scope config
  // (data.partTypes, from sds_report_config) so add/remove a type there flows through;
  // fall back to whatever keys the monthly data actually contains for older payloads.
  const activePartTypes = useMemo(() => {
    const fromCfg = data?.partTypes;
    const set = Array.isArray(fromCfg) && fromCfg.length
      ? fromCfg
      : [...new Set((data?.monthlyNewParts || [])
          .flatMap(r => Object.keys(r).filter(k => k !== 'month')))];
    return sortByPartTypeOrder(set, x => x);
  }, [data]);


  const fmtMonth = m => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleString('en', { month: 'short' }) + ' ' + y.slice(2);
  };

  // ── Monthly New Parts chart ───────────────────────────────────────────────────
  const monthlyNewParts = useMemo(() => {
    const all = data?.monthlyNewParts || [];
    const raw = Object.fromEntries(
      all.filter(r => r.month >= '2026-04' && r.month <= '2027-03').map(r => [r.month, r])
    );
    const months = [];
    let d = new Date('2026-04-01');
    while (d <= new Date('2027-03-01')) {
      const key = d.toISOString().slice(0, 7);
      // Missing part-type keys default to 0 at read time (r[t] || 0), so an empty
      // { month } row is enough here — no need to pre-seed every scope type.
      months.push(raw[key] || { month: key });
      d.setMonth(d.getMonth() + 1);
    }
    // Prepend a baseline bar = previous FYE monthly average (Apr 2025 – Mar 2026),
    // averaged over the months that had new parts. Sits before Apr as a muted reference.
    const prev = all.filter(r => r.month >= '2025-04' && r.month <= '2026-03');
    if (prev.length) {
      const avg = k => Math.round(prev.reduce((s, r) => s + (r[k] || 0), 0) / prev.length);
      const avgRow = { label: 'FYE26 avg', isAvg: true };
      activePartTypes.forEach(t => { avgRow[t] = avg(t); });
      months.unshift(avgRow);
    }
    return months;
  }, [data, activePartTypes]);
  // One stacked dataset per configured part type — derived from activePartTypes so the
  // chart tracks the scope config instead of a fixed Ball/Race/Mecha triple.
  const newPartsChartData = useMemo(() => ({
    labels: monthlyNewParts.map(r => r.isAvg ? r.label : fmtMonth(r.month)),
    datasets: activePartTypes.map(t => {
      const color = PART_TYPE_COLOR[t] || C.cyan;
      return {
        label: partTypeLabel(t),
        data: monthlyNewParts.map(r => r[t] || 0),
        backgroundColor: monthlyNewParts.map(r => hexToRgba(color, r.isAvg ? 0.35 : 0.75)),
        borderColor: color, borderWidth: 1, stack: 'np',
      };
    }),
  }), [monthlyNewParts, activePartTypes]);
  const newPartsChartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: {
      legend: { labels: { color: C.textSec, font: { size: 11 } } },
      tooltip: { mode: 'index', intersect: false },
      datalabels: { display: false },  // datalabels plugin is registered globally — keep it off here
    },
    scales: {
      x: { stacked: true, ticks: { color: C.textSec, font: { size: 10 }, maxRotation: 45 }, grid: { color: C.gridLine } },
      y: { stacked: true, ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine }, title: { display: true, text: 'New CNs', color: C.textSec, font: { size: 10 } } },
    },
  };

  // ── Monthly Coverage Status chart (bar: complete/pending + line: complete%) ──
  const monthlyStatus = useMemo(() => {
    const all = data?.monthlyStatus || [];
    const raw = Object.fromEntries(
      all.filter(r => r.month >= '2026-04' && r.month <= '2027-03').map(r => [r.month, r])
    );
    const months = [];
    let d = new Date('2026-04-01');
    while (d <= new Date('2027-03-01')) {
      const key = d.toISOString().slice(0, 7);
      months.push(raw[key] || { month: key, complete: 0, pending: 0, complete_pct: 0 });
      d.setMonth(d.getMonth() + 1);
    }
    // Prepend the previous FYE's final cumulative bar (latest month ≤ Mar 2026) so the
    // current-FY running total starts from a visible carry-over baseline. `all` is sorted
    // ascending by month, so the last matching row is the FYE-end value.
    const prevRows = all.filter(r => r.month <= '2026-03');
    const prevLast = prevRows.length ? prevRows[prevRows.length - 1] : null;
    if (prevLast) months.unshift({ ...prevLast, isPrevLast: true });
    return months;
  }, [data]);

  const statusChartData = useMemo(() => ({
    labels: monthlyStatus.map(r => r.isPrevLast ? 'FYE26 end' : fmtMonth(r.month)),
    datasets: [
      {
        type: 'bar',
        label: 'KZW Complete',
        data: monthlyStatus.map(r => r.complete_saved ?? r.complete),
        backgroundColor: monthlyStatus.map(r => r.isPrevLast ? hexToRgba(C.green, 0.30) : hexToRgba(C.green, 0.75)),
        borderColor: C.green,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'THAI Complete *',
        data: monthlyStatus.map(r => Math.max(0, (r.complete || 0) - (r.complete_saved ?? r.complete ?? 0))),
        backgroundColor: monthlyStatus.map(r => r.isPrevLast ? hexToRgba(C.greenSoft, 0.30) : hexToRgba(C.greenSoft, 0.70)),
        borderColor: C.greenSoft,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Pending',
        data: monthlyStatus.map(r => r.pending),
        backgroundColor: monthlyStatus.map(r => r.isPrevLast ? hexToRgba(C.yellow, 0.28) : hexToRgba(C.yellow, 0.65)),
        borderColor: C.yellow,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Complete % (KZW+THAI)',
        // Cut the line at the last month that actually has data (null → no point),
        // so it stops at the latest month instead of diving to 0% across empty
        // future months — same behaviour as the Inspection "Monthly Trend — FYE" line.
        data: monthlyStatus.map(r => ((r.complete || 0) + (r.pending || 0)) > 0 ? r.complete_pct : null),
        spanGaps: true,
        borderColor: C.orange,
        backgroundColor: hexToRgba(C.orange, 0.15),
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: C.orange,
        tension: 0.3,
        yAxisID: 'y1',
        datalabels: {
          display: true,
          color: C.green,
          anchor: 'end',
          align: 'top',
          offset: 4,
          font: { size: 10, weight: 700 },
          // Only label months that actually have parts — skip empty future months
          formatter: (v, ctx) => {
            const row = monthlyStatus[ctx.dataIndex];
            const hasData = ((row?.complete || 0) + (row?.pending || 0)) > 0;
            return hasData ? `${v}%` : '';
          },
        },
      },
      {
        type: 'line',
        label: 'Target 90%',
        data: monthlyStatus.map(() => 90),
        borderColor: hexToRgba(C.red, 0.85),
        borderWidth: 1.5,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0,
        yAxisID: 'y1',
      },
    ],
  }), [monthlyStatus]);

  const statusChartOpts = {
    responsive: true, animation: false,
    maintainAspectRatio: false,
    // Legend at the BOTTOM so the 'top'-aligned % datalabels on the near-100% Complete-%
    // line never collide with it; top padding + axis headroom keep the 100% label visible.
    layout: { padding: { top: 24 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { color: C.textSec, font: { size: 11 }, boxWidth: 12, padding: 12 } },
      datalabels: { display: false },  // datalabels plugin is registered globally — keep it off here
      tooltip: {
        callbacks: {
          label: ctx => {
            if (ctx.dataset.label === 'Target 90%') return null;
            if (ctx.dataset.label.includes('%')) return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
            return `${ctx.dataset.label}: ${ctx.parsed.y}`;
          },
        },
        filter: item => item.dataset.label !== 'Target 90%',
      },
    },
    scales: {
      x: { stacked: true, ticks: { color: C.textSec, font: { size: 10 }, maxRotation: 45 }, grid: { color: C.gridLine } },
      y: {
        stacked: true,
        position: 'left',
        ticks: { color: C.textSec, font: { size: 10 } },
        grid: { color: C.gridLine },
        title: { display: true, text: 'CNs', color: C.textSec, font: { size: 10 } },
      },
      y1: {
        position: 'right',
        // Headroom above 100 so a 100% point sits below the top edge and its 'top'-aligned
        // datalabel stays inside the canvas; ticks over 100 hidden.
        min: 0, max: 115,
        ticks: { color: C.cyan, font: { size: 10 }, stepSize: 20, callback: v => (v > 100 ? '' : `${v}%`) },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Complete %', color: C.cyan, font: { size: 10 } },
      },
    },
  };

  // ── Needs attention table ─────────────────────────────────────────────────────
  // All three filter dropdowns are derived from the rows actually in the table
  // (data.needsAttention), so each only lists values that exist there — selecting any
  // option always yields rows.
  const machineOptions = useMemo(() => {
    const names = [...new Set((data?.needsAttention || []).map(r => r.machine_type_name).filter(Boolean))].sort();
    return [{ value: '', label: 'All Machines' }, ...names.map(n => ({ value: n, label: n }))];
  }, [data]);

  const partTypeOptions = useMemo(() => {
    const types = [...new Set((data?.needsAttention || []).map(r => r.part_type).filter(Boolean))].sort();
    return [{ value: '', label: 'All Part Types' },
      ...types.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))];
  }, [data]);

  const reasonOptions = useMemo(() => {
    const rows = data?.needsAttention || [];
    const reasons = [...new Set(rows.map(r => r.pending_reason).filter(Boolean))].sort();
    const anomalyCount = rows.filter(r => r.limit_excluded).length;
    return [{ value: '', label: 'All Reasons' },
      // Listed only when such rows exist, so picking it always yields rows (same
      // rule as the other two dropdowns).
      ...(anomalyCount ? [{ value: LIMIT_ANOMALY, label: `⚠ Limit Anomaly (${anomalyCount})` }] : []),
      ...reasons.map(r => ({ value: r, label: REASON_LABELS[r] || r }))];
  }, [data]);

  const filteredAttention = useMemo(() => {
    const rows = data?.needsAttention || [];
    return rows.filter(r => {
      if (filterPt && r.part_type !== filterPt) return false;
      if (filterMc && r.machine_type_name !== filterMc) return false;
      // The anomaly entry filters on the limit_excluded flag, not pending_reason.
      if (filterReason === LIMIT_ANOMALY) { if (!r.limit_excluded) return false; }
      else if (filterReason && r.pending_reason !== filterReason) return false;
      return true;
    });
  }, [data, filterPt, filterMc, filterReason]);

  // Keyed dataSource — memoized so the (potentially large) array isn't rebuilt with a
  // spread on every render (poll tick / chart hover). Only changes when the filter does.
  const attentionRows = useMemo(
    () => filteredAttention.map((r, i) => ({ ...r, key: i })),
    [filteredAttention]
  );

  const attentionColumns = [
    {
      title: 'CN', dataIndex: 'cn', width: 130, sorter: (a, b) => a.cn.localeCompare(b.cn),
      defaultSortOrder: 'ascend',
      render: v => <Text style={{ color: C.cyan, fontFamily: 'monospace', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Part Type', dataIndex: 'part_type', width: 90,
      render: v => <Tag style={{ color: PART_TYPE_COLOR[v] || C.textSec, borderColor: PART_TYPE_COLOR[v], background: 'transparent' }}>
        {v?.charAt(0).toUpperCase() + v?.slice(1)}
      </Tag>,
    },
    {
      title: 'Machine', dataIndex: 'machine_type_name', width: 120,
      sorter: (a, b) => (a.machine_type_name || '').localeCompare(b.machine_type_name || ''),
      render: (v, r) => v
        ? <Text style={{ color: C.textPri, fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>
        : <Text style={{ color: C.textSec, fontSize: 11 }}>{r.machine_code || '—'}</Text>,
    },
    {
      title: 'Process', dataIndex: 'process_code', width: 90,
      sorter: (a, b) => (a.process_code || '').localeCompare(b.process_code || ''),
      render: v => v
        ? <Tag style={{ fontFamily: 'monospace', fontSize: 11, background: 'transparent', borderColor: C.border, color: C.textSec }}>{v}</Tag>
        : '—',
    },
    {
      title: 'Status', dataIndex: 'coverage_level', width: 160,
      render: v => {
        const cfg = LEVEL_CFG[v];
        if (!cfg) return <Tag>{v}</Tag>;
        return (
          <Tooltip title={cfg.desc}>
            <Tag icon={cfg.icon} color={cfg.antd} style={{ fontSize: 11 }}>{cfg.label}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Missing', width: 200,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.tooling_source === 'tselect' ? (
            <Tooltip title="Matched via Tooling Select — not a saved tool">
              <Tag color="success" style={{ fontSize: 10 }}>Tooling Match *</Tag>
            </Tooltip>
          ) : (
            <Tag color={r.has_tooling_match ? 'success' : 'error'} style={{ fontSize: 10 }}>Tooling Match</Tag>
          )}
          <Tag color={r.has_machine_template ? 'success' : 'error'} style={{ fontSize: 10 }}>Excel Config</Tag>
          {r.limit_excluded && (
            <Tooltip title="ผลิตบนเครื่องนี้จริง แต่ Tooling Select LIMIT ระบุว่าชิ้นงานเกินพิกัดของเครื่อง (ขึ้นเครื่องไม่ได้) — ตรวจสอบ machine limit หรือข้อมูลการผลิต">
              <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 10, fontWeight: 700 }}>Limit Anomaly</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Last Produced', dataIndex: 'last_prod_date', width: 120,
      sorter: (a, b) => (a.last_prod_date || '') > (b.last_prod_date || '') ? 1 : -1,
      render: v => v ? <Text style={{ color: C.textSec, fontSize: 12 }}>{new Date(v).toLocaleDateString('en-GB')}</Text> : '—',
    },
  ];

  // Total SDS requirements = evaluated.length (authoritative). Use kpi.total so the
  // headline/summary match the per-part-type cards (Σ pt.total) and the "no tool/excel"
  // tags (which also divide by kpi.total) — the old complete+pending+missing recompute
  // could diverge when pending was deduped.
  const totalCns = data?.kpi?.total ?? 0;

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-coverage-report" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          <Spin spinning={loading} tip={building ? 'Building report… first build can take a few minutes' : 'Loading...'}>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ color: C.cyan, fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>
                  Setup Data Sheet Dashboard
                  <SystemVersionBadge system="sds-coverage-report" dark={C.isDark} />
                </div>
                {totalCns > 0 && (
                  <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
                    <span style={{ color: C.textPri, fontWeight: 700 }}>{(data?.kpi?.uniqueCnCount ?? 0).toLocaleString()} unique CNs</span>
                    <span style={{ color: C.textSec }}> · {totalCns.toLocaleString()} SDS reqs</span>
                  </div>
                )}
              </div>
              <Space>
                <Button icon={<SettingOutlined />} onClick={() => setScopeOpen(true)} size="small"
                  title="Edit report scope (part types, process codes, work centers) — admin"
                  style={{ background: C.card, borderColor: C.border, color: C.textPri }}>Scope</Button>
                <Button icon={<ReloadOutlined />} onClick={() => fetchData({ refresh: true })} loading={loading} size="small"
                  title="Rebuild report (recomputes Tooling Select — may take a few minutes)"
                  style={{ background: C.card, borderColor: C.border, color: C.textPri }} />
              </Space>
            </div>

            <ReportScopeModal
              open={scopeOpen}
              onClose={() => setScopeOpen(false)}
              onSaved={() => fetchData({ refresh: true })}
            />

            {/* ── Coverage Legend ─────────────────────────────────────────────── */}
            <div style={{ ...cardStyle, padding: '8px 16px', marginBottom: 12 }}>
              <Row gutter={16} align="middle">
                <Col flex="none"><Text style={{ color: C.textSec, fontSize: 11 }}>LEVELS:</Text></Col>
                <Col flex="none">
                  <Tag icon={<CheckCircleOutlined />} color="success" style={{ fontSize: 11 }}>Complete</Tag>
                  <Text style={{ color: C.textSec, fontSize: 10 }}>Tool match + Excel Config ✅ → PDF ready</Text>
                </Col>
                <Col flex="none">
                  <Tag icon={<ClockCircleOutlined />} color="warning" style={{ fontSize: 11 }}>Pending</Tag>
                  <Text style={{ color: C.textSec, fontSize: 10 }}>Requires Machine Tool or Excel Parameter config</Text>
                </Col>
              </Row>
            </div>

            {/* ── Part Type Cards ─────────────────────────────────────────────── */}
            {byPartType.length > 0 && (
              <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
                {/* Total CNs summary card */}
                <Col span={4}>
                  <div style={{ ...cardStyle, borderTop: `3px solid ${C.cyan}`, height: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                      <Text style={{ color: C.cyan, fontSize: 13, fontWeight: 800 }}>TOTAL</Text>
                      <Tooltip title="Total SDS requirements = CN × machine × process">
                        <Text style={{ color: C.textPri, fontSize: 22, fontWeight: 800, lineHeight: 1, cursor: 'help' }}>
                          {totalCns.toLocaleString()}
                        </Text>
                      </Tooltip>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <Text style={{ color: C.textSec, fontSize: 10 }}>SDS reqs</Text>
                      <Tooltip title="Unique CNs across the selected part types (deduplicated across machine × process)">
                        <Text style={{ color: C.textSec, fontSize: 10, cursor: 'help' }}>{(data?.kpi?.uniqueCnCount ?? 0).toLocaleString()} Unique CNs</Text>
                      </Tooltip>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text style={{ color: C.textSec, fontSize: 10 }}>PDF Ready</Text>
                      <Tooltip title="Complete / Pending sheets">
                        <Text style={{ fontSize: 10, cursor: 'help' }}>
                          <span style={{ color: C.green, fontWeight: 700 }}>{(data?.kpi?.complete ?? 0).toLocaleString()}</span>
                          <span style={{ color: C.textSec }}> comp / </span>
                          <span style={{ color: C.yellow, fontWeight: 700 }}>{(data?.kpi?.pending ?? 0).toLocaleString()}</span>
                          <span style={{ color: C.textSec }}> pend</span>
                        </Text>
                      </Tooltip>
                    </div>
                    {(() => {
                      const pct = data?.kpi?.completePct ?? 0;
                      const pctSaved = data?.kpi?.completeSavedPct ?? pct;
                      const boost = Math.max(0, (data?.kpi?.complete ?? 0) - (data?.kpi?.completeSaved ?? data?.kpi?.complete ?? 0));
                      return (<>
                        <Tooltip title={`KZW ${pctSaved}% + THAI ${(pct - pctSaved).toFixed(1)}% = ${pct}%`}>
                          <div style={{ background: C.border, borderRadius: 3, height: 6, overflow: 'hidden', margin: '3px 0 2px', display: 'flex', cursor: 'help' }}>
                            <div style={{ width: `${Math.min(pctSaved, 100)}%`, height: '100%', background: C.green, transition: 'width 0.8s ease' }} />
                            <div style={{ width: `${Math.min(Math.max(pct - pctSaved, 0), 100)}%`, height: '100%', background: C.greenSoft, opacity: 0.85, transition: 'width 0.8s ease' }} />
                          </div>
                        </Tooltip>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                          <Text style={{ color: pctSaved >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>{pctSaved}%</Text>
                          {boost > 0 && <Text style={{ color: pct >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>→ {pct}% <Text style={{ color: C.greenSoft, fontSize: 9 }}>(+THAI *)</Text></Text>}
                        </div>
                      </>);
                    })()}
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Tag color="success" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{(data?.kpi?.completeSaved ?? data?.kpi?.complete ?? 0).toLocaleString()} KZW complete</Tag>
                      {Math.max(0, (data?.kpi?.complete ?? 0) - (data?.kpi?.completeSaved ?? data?.kpi?.complete ?? 0)) > 0 && (
                        <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
                          <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: C.greenSoft, background: hexToRgba(C.greenSoft, 0.18), borderColor: C.greenSoft }}>+{Math.max(0, (data?.kpi?.complete ?? 0) - (data?.kpi?.completeSaved ?? data?.kpi?.complete ?? 0)).toLocaleString()} THAI *</Tag>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Col>
                {byPartType.map(pt => (
                  <Col key={pt.part_type} span={4}>
                    <PartTypeCard pt={pt} C={C} />
                  </Col>
                ))}
              </Row>
            )}

            {/* ── Charts Row (New Parts + Cumulative Status) ─────────────────── */}
            <Row gutter={[14, 0]} style={{ marginBottom: 14 }}>
              <Col span={8}>
                <div style={{ ...cardStyle, height: '100%' }}>
                  {sectionTitle('New Parts per Month', C)}
                  <div style={{ height: 240 }}>
                    {monthlyNewParts.length > 0
                      ? <Bar data={newPartsChartData} options={newPartsChartOpts} />
                      : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 100 }}>No data</div>
                    }
                  </div>
                </div>
              </Col>
              <Col span={16}>
                <div style={{ ...cardStyle, height: '100%' }}>
                  {sectionTitle('Cumulative Coverage Status', C)}
                  <div style={{ height: 240 }}>
                    <Bar data={statusChartData} options={statusChartOpts} />
                  </div>
                </div>
              </Col>
            </Row>

            {/* ── Needs Attention Table ───────────────────────────────────────── */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {sectionTitle('CNs Requiring Action', C)}
                <Space>
                  <Select size="small" value={filterPt} onChange={setFilterPt} style={{ width: 130 }}
                    options={partTypeOptions} popupMatchSelectWidth={false} />
                  <Select size="small" value={filterMc} onChange={setFilterMc} style={{ width: 160 }}
                    options={machineOptions} popupMatchSelectWidth={false} showSearch
                    filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                  <Select size="small" value={filterReason} onChange={setFilterReason} style={{ width: 190 }}
                    options={reasonOptions} popupMatchSelectWidth={false} />
                  <Text style={{ color: C.textSec, fontSize: 11 }}>{filteredAttention.length} CNs</Text>
                </Space>
              </div>
              <Table
                dataSource={attentionRows}
                columns={attentionColumns}
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
                scroll={{ x: 'max-content' }}
                style={{ background: C.bg }}
                rowClassName={(r) => r.limit_excluded ? 'sds-report-row sds-limit-excluded' : 'sds-report-row'}
              />
            </div>

          </Spin>
        </Content>
      </Layout>

      <style>{`
        .sds-report-row td { background: ${C.bg} !important; color: ${C.textPri}; }
        .sds-report-row:hover td { background: ${C.card} !important; }
        .sds-limit-excluded td { background: ${hexToRgba(C.red, 0.12)} !important; box-shadow: inset 3px 0 0 ${C.red}; }
        .sds-limit-excluded:hover td { background: ${hexToRgba(C.red, 0.20)} !important; }
        .ant-table-thead > tr > th { background: ${C.card} !important; color: ${C.textSec} !important; border-bottom: 1px solid ${C.border} !important; font-size: 11px; }
        .ant-table { background: ${C.bg} !important; }
        .ant-table-tbody > tr > td { border-bottom: 1px solid ${C.border} !important; }
        .ant-pagination .ant-pagination-item a, .ant-pagination .ant-pagination-prev button, .ant-pagination .ant-pagination-next button { color: ${C.textSec} !important; }
        .ant-pagination .ant-pagination-item-active { border-color: ${C.cyan} !important; }
        .ant-pagination .ant-pagination-item-active a { color: ${C.cyan} !important; }
        .ant-select-selector { background: ${C.card} !important; border-color: ${C.border} !important; color: ${C.textPri} !important; }
        .ant-select-arrow { color: ${C.textSec} !important; }
        .ant-select-dropdown { background: ${C.card} !important; }
        .ant-select-item { color: ${C.textPri} !important; }
        .ant-select-item-option-selected { background: ${C.border} !important; }
      `}</style>
    </Layout>
  );
}
