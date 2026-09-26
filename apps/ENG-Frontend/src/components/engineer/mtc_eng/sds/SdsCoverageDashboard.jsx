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

// Fiscal year (Apr 1 – Mar 31). FYE N = Apr (N+1999) → Mar (N+2000). The backend now
// sends this as `data.fye`; this is the fallback so an older cached payload still
// windows the FY-scoped charts on the right period instead of a stale hardcoded one.
const computeFyeWindow = (ref = new Date()) => {
  const num = (ref.getMonth() + 1) >= 4 ? ref.getFullYear() - 1999 : ref.getFullYear() - 2000;
  const sy = num + 1999;
  const pad = (v) => String(v).padStart(2, '0');
  return {
    num,
    start: `${sy}-04`, end: `${sy + 1}-03`,
    prevStart: `${sy - 1}-04`, prevEnd: `${sy}-03`,
    label: `FYE${pad(num)}`, prevLabel: `FYE${pad(num - 1)}`,
  };
};

// The FY's calendar months as 'YYYY-MM', Apr → Mar (local-time safe — no toISOString,
// which shifts to the previous month in negative-offset zones).
const fyMonths = (fy) => {
  const out = [];
  const [sy, sm] = fy.start.split('-').map(Number);
  const [ey, em] = fy.end.split('-').map(Number);
  let d = new Date(sy, sm - 1, 1);
  const last = new Date(ey, em - 1, 1);
  while (d <= last) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
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

// Month-over-month change badge — `delta` is { complete, pending, pct, totalFrom, totalTo }
// comparing the current month's cumulative snapshot against the immediately preceding
// month's (see `monthDelta` in the main component). `totalFrom`/`totalTo` are the actual
// requirement counts (complete+pending) last month and now, shown as "3,670 → 3,685" so
// the old figure is visible next to the new one, not just the +/- delta. Renders nothing
// until both months exist.
const DeltaBadge = ({ delta, C }) => {
  if (!delta) return null;
  const arrow = delta.pct > 0 ? '▲' : delta.pct < 0 ? '▼' : '●';
  const color = delta.pct > 0 ? C.green : delta.pct < 0 ? C.red : C.textSec;
  const sign = (n) => (n > 0 ? '+' : '');
  return (
    <Tooltip title={`Total last month: ${delta.totalFrom.toLocaleString()} → ${delta.totalTo.toLocaleString()}. Complete ${sign(delta.complete)}${delta.complete.toLocaleString()}, Pending ${sign(delta.pending)}${delta.pending.toLocaleString()}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4, cursor: 'help', flexWrap: 'wrap' }}>
        <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 600 }}>
          {delta.totalFrom.toLocaleString()}→{delta.totalTo.toLocaleString()}
        </Text>
        <Text style={{ color, fontSize: 10, fontWeight: 700 }}>
          {arrow} {sign(delta.complete)}{delta.complete.toLocaleString()}
        </Text>
        <Text style={{ color, fontSize: 10, fontWeight: 700 }}>({sign(delta.pct)}{delta.pct}%)</Text>
        <Text style={{ color: C.textSec, fontSize: 9 }}>vs last month</Text>
      </div>
    </Tooltip>
  );
};

// A small centered up-arrow between two stacked PrevMonthPctRow rows (or the live row and
// the first of them) — a plain flow connector reading "this feeds into the row above",
// not a trend indicator, so it always points up regardless of whether the % rose or fell.
// Renders nothing until both sides exist (nothing to connect otherwise).
const TrendArrow = ({ from, to, C }) => {
  if (from == null || to == null) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0 3px' }}>
      <Text style={{ color: C.textSec, fontSize: 11, fontWeight: 700 }}>▲</Text>
    </div>
  );
};

// The previous (closed/frozen) month's own KZW/THAI/combined % row — a stable reference
// sitting right under the live current-month row, which keeps moving until its month
// closes. `snapshot` is { pctSaved, pct }; `label` is e.g. "Aug 26" (see `monthDelta`
// in the main component). Renders nothing until the previous month's data exists.
const PrevMonthPctRow = ({ label, snapshot, C }) => {
  if (!snapshot) return null;
  const { pctSaved, pct } = snapshot;
  const boost = Math.max(0, pct - pctSaved);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, opacity: 0.7 }}>
      <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 600 }}>{label}</Text>
      <Text style={{ fontSize: 10 }}>
        <span style={{ color: pctSaved >= 90 ? C.green : C.red, fontWeight: 700 }}>{pctSaved}%</span>
        <span style={{ color: C.textSec, fontSize: 9 }}> KZW</span>
        {boost > 0 && (<>
          <span style={{ color: C.greenSoft, fontWeight: 700 }}> +{boost.toFixed(1)}%</span>
          <span style={{ color: C.textSec, fontSize: 9 }}> THAI*</span>
        </>)}
        <span style={{ color: pct >= 90 ? C.green : C.red, fontWeight: 800 }}> → {pct}%</span>
      </Text>
    </div>
  );
};

// ── Part Type Card ─────────────────────────────────────────────────────────────
// `onClick` makes the card a toggle filter on the CN table below (part type); `active`
// outlines it in its own colour, `dimmed` fades it while a sibling card is selected.
const PartTypeCard = ({ pt, C, delta, onClick, active, dimmed }) => {
  const cardStyle = cardStyleOf(C);
  const color = partTypeColors(C)[pt.part_type] || C.cyan;
  const pct = pt.complete_pct || 0;                       // with T-Select #1
  const pctSaved = pt.complete_saved_pct ?? pct;          // baseline (saved only)
  const boost = Math.max(0, (pt.complete || 0) - (pt.complete_saved ?? pt.complete ?? 0));
  
  // Custom label mapping: 'body' or 'mecha' -> 'Mecha' (shared with the chart series)
  const displayLabel = partTypeLabel(pt.part_type);

  return (
    <div
      role="button" tabIndex={0} aria-pressed={!!active}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      style={{
        ...cardStyle, borderTop: `3px solid ${color}`, height: '100%', boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: active ? `0 0 0 2px ${color}` : 'none',
        opacity: dimmed ? 0.6 : 1, transition: 'box-shadow 0.15s, opacity 0.15s',
      }}>
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
          {pctSaved}% <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 400 }}>KZW</Text>
        </Text>
        {boost > 0 && (
          <Text style={{ color: C.greenSoft, fontSize: 11, fontWeight: 700 }}>+{(pct - pctSaved).toFixed(1)}% <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 400 }}>THAI *</Text></Text>
        )}
        {boost > 0 && (
          <Text style={{ color: pct >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 800 }}>→ {pct}%</Text>
        )}
      </div>
      {/* No previous-month history row on this card — TOTAL is the only card that
          shows one (see `monthDelta` in the main component for why: an older closed
          month may predate the `byPartType` field, so a per-type row is unreliable). */}
      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        <Tag color="success" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{(pt.complete_saved ?? pt.complete).toLocaleString()} KZW complete</Tag>
        {boost > 0 && (
          <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
            <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: C.greenSoft, background: hexToRgba(C.greenSoft, 0.18), borderColor: C.greenSoft }}>+{boost.toLocaleString()} THAI *</Tag>
          </Tooltip>
        )}
      </div>
      <DeltaBadge delta={delta} C={C} />
    </div>
  );
};

// Friendly labels for the pending_reason filter. Unknown codes fall back to the raw
// value so a newly introduced reason still shows up rather than disappearing.
const REASON_LABELS = {
  NO_EXCEL: 'Tool ✓ — needs Excel config',
  NO_TOOL: 'No tool match',
  NO_TOOL_NO_EXCEL: 'No tool + no Excel config',
  NO_STAMP: 'PDF ready — needs signature',
};

// A limit anomaly (`limit_excluded` — produced on a machine whose T-Select size LIMIT
// says it cannot run) rests on contradictory data, not a config gap. These rows STAY
// in `needsAttention` (so `pending` reconciles with total − complete − missing) and
// appear in the table below with the red "Limit Anomaly (…)" tag/row highlight, whose
// reason text now carries the actual size/limit numbers per CN — the old
// "Limit Anomaly — reconcile data" (machine · process) rollup card was dropped as
// redundant with that per-row detail (`kpi.limitExcludedByMachine` is still computed
// on the backend for other consumers; only this card was removed).

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
  // 'YYYY-MM' of the production cohort picked by clicking a bar in either chart. Both
  // charts bucket on a sheet's FIRST-PRODUCED month (UTC, same slice the backend uses).
  // Picking one re-scopes the cards to that cohort and swaps the CN table from "what still
  // needs action" to EVERY sheet of the cohort, Complete and Pending (`monthRows`).
  const [filterMonth, setFilterMonth] = useState('');
  const [monthRows, setMonthRows] = useState(null);      // null = not loaded / unavailable
  const [monthRowsLoading, setMonthRowsLoading] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const pollRef = useRef(null);
  const attentionRef = useRef(null);

  // Selecting never moves the page: the point of a click on a card or bar is to watch the
  // cards and charts change. The list is one click away from the "Showing" bar instead.
  const goToTable = () => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const pickPartType = (pt) => setFilterPt(cur => (cur === pt ? '' : pt));
  const pickMonth = (m) => setFilterMonth(cur => (cur === m ? '' : m));
  const clearSelection = () => { setFilterPt(''); setFilterMonth(''); };

  // The cohort's full sheet list lives behind its own endpoint (the main payload only
  // carries pending rows). A failed / unavailable load leaves `monthRows` null and the
  // table falls back to the pending rows of that month.
  useEffect(() => {
    if (!filterMonth) { setMonthRows(null); return undefined; }
    let cancelled = false;
    setMonthRowsLoading(true);
    axios.get(server.MTC_SDS_V2_REPORT_COVERAGE_ROWS, { params: { month: filterMonth } })
      .then(res => { if (!cancelled) setMonthRows(Array.isArray(res.data?.rows) ? res.data.rows : null); })
      .catch(() => { if (!cancelled) setMonthRows(null); })
      .finally(() => { if (!cancelled) setMonthRowsLoading(false); });
    return () => { cancelled = true; };
  }, [filterMonth]);

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

  // With a month picked, the summary cards re-scope from "everything" to that production
  // cohort — the same sheets the CN table now lists — so a bar click visibly moves the
  // numbers. Counts follow the backend cards' own definitions (total = every sheet of the
  // cohort, complete/pending by coverage level). Null until the cohort list has loaded, and
  // the cards keep their whole-scope values.
  const cohort = useMemo(() => {
    if (!filterMonth || !monthRows) return null;
    const stats = (rows) => {
      const total = rows.length;
      const complete = rows.filter(r => r.coverage_level === 'COMPLETE').length;
      const completeSaved = rows.filter(r => r.coverage_level_saved === 'COMPLETE').length;
      const pending = rows.filter(r => r.coverage_level === 'PENDING').length;
      const pct = (n) => (total > 0 ? parseFloat(((n / total) * 100).toFixed(1)) : 0);
      return { total, complete, completeSaved, pending, completePct: pct(complete),
               completeSavedPct: pct(completeSaved), cnCount: new Set(rows.map(r => r.cn)).size };
    };
    const all = stats(monthRows);
    return {
      kpi: { total: all.total, complete: all.complete, completeSaved: all.completeSaved, pending: all.pending,
             completePct: all.completePct, completeSavedPct: all.completeSavedPct, uniqueCnCount: all.cnCount },
      byPartType: byPartType.map(p => {
        const s = stats(monthRows.filter(r => r.part_type === p.part_type));
        return { part_type: p.part_type, total: s.total, cn_count: s.cnCount, complete: s.complete,
                 complete_saved: s.completeSaved, pending: s.pending,
                 complete_pct: s.completePct, complete_saved_pct: s.completeSavedPct };
      }),
    };
  }, [filterMonth, monthRows, byPartType]);
  const cardKpi = cohort ? cohort.kpi : data?.kpi;
  const cardPartTypes = cohort ? cohort.byPartType : byPartType;

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

  // The FY window for the FY-scoped charts: the backend's `data.fye`, or a client-side
  // fallback so an older cached payload still renders the current FY (not a stale one).
  const fyeWin = useMemo(() => data?.fye || computeFyeWindow(), [data]);

  // ── Monthly New Parts chart ───────────────────────────────────────────────────
  const monthlyNewParts = useMemo(() => {
    const all = data?.monthlyNewParts || [];
    const raw = Object.fromEntries(
      all.filter(r => r.month >= fyeWin.start && r.month <= fyeWin.end).map(r => [r.month, r])
    );
    // Missing part-type keys default to 0 at read time (r[t] || 0), so an empty
    // { month } row is enough here — no need to pre-seed every scope type.
    const months = fyMonths(fyeWin).map(key => raw[key] || { month: key });
    // Prepend a baseline bar = previous FY monthly average, over the months that had
    // new parts. Sits before Apr as a muted reference.
    const prev = all.filter(r => r.month >= fyeWin.prevStart && r.month <= fyeWin.prevEnd);
    if (prev.length) {
      const avg = k => Math.round(prev.reduce((s, r) => s + (r[k] || 0), 0) / prev.length);
      const avgRow = { label: `${fyeWin.prevLabel} avg`, isAvg: true };
      activePartTypes.forEach(t => { avgRow[t] = avg(t); });
      months.unshift(avgRow);
    }
    return months;
  }, [data, activePartTypes, fyeWin]);
  // One stacked dataset per configured part type — derived from activePartTypes so the
  // chart tracks the scope config instead of a fixed Ball/Race/Mecha triple.
  const newPartsChartData = useMemo(() => {
    // The current month is still accumulating new CNs, so its bar is provisional —
    // fade it the same as the prev-FY average bar (see statusChartData's `faint`).
    const curMonth = new Date().toISOString().slice(0, 7);
    const faint = (r) => r.isAvg || r.month === curMonth;
    return {
      labels: monthlyNewParts.map(r => r.isAvg ? r.label : fmtMonth(r.month)),
      datasets: activePartTypes.map(t => {
        const color = PART_TYPE_COLOR[t] || C.cyan;
        return {
          label: partTypeLabel(t),
          data: monthlyNewParts.map(r => r[t] || 0),
          // A picked month fades every other month; a picked part-type card fades every
          // other part type's segments — so both selections read off the chart.
          backgroundColor: monthlyNewParts.map(r => hexToRgba(color,
            (filterPt && t !== filterPt) || (filterMonth && r.month !== filterMonth)
              ? 0.2 : (faint(r) ? 0.35 : 0.75))),
          borderColor: color, borderWidth: 1, stack: 'np',
        };
      }),
    };
  }, [monthlyNewParts, activePartTypes, filterMonth, filterPt]);
  // Shared by both charts: the category under the pointer, resolved by COLUMN (mode
  // 'index', no intersect) so the whole month is clickable, not just the painted bar.
  const columnIndexAt = (evt, chart) => {
    const hit = chart.getElementsAtEventForMode(evt, 'index', { intersect: false }, true);
    return hit.length ? hit[0].index : -1;
  };
  const newPartsChartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    // The FYE-avg baseline is not a month, so it neither selects nor gets a pointer.
    onClick: (evt, _els, chart) => {
      const row = monthlyNewParts[columnIndexAt(evt, chart)];
      if (row && !row.isAvg && row.month) pickMonth(row.month);
    },
    onHover: (evt, _els, chart) => {
      const row = monthlyNewParts[columnIndexAt(evt, chart)];
      chart.canvas.style.cursor = row && !row.isAvg && row.month ? 'pointer' : 'default';
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: C.textSec, font: { size: 11 }, boxWidth: 12, padding: 12 } },
      tooltip: { mode: 'index', intersect: false },
      // One total label per bar — shown only on the topmost stacked segment (the last
      // dataset), summed across every part type at that month so it reads as the bar's
      // grand total rather than just that segment's own count.
      datalabels: {
        display: (ctx) => {
          const total = ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 && total > 0;
        },
        formatter: (v, ctx) => {
          const total = ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
          return total.toLocaleString();
        },
        color: C.textPri,
        anchor: 'end', align: 'top', offset: 4,
        font: { size: 10, weight: 700 },
      },
    },
    layout: { padding: { top: 20 } },
    scales: {
      x: { stacked: true, ticks: { color: C.textSec, font: { size: 10 }, maxRotation: 45 }, grid: { color: C.gridLine } },
      y: { stacked: true, ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine }, title: { display: true, text: 'New CNs', color: C.textSec, font: { size: 10 } } },
    },
  };

  // ── Monthly Coverage Status chart (bar: complete/pending + line: complete%) ──
  const monthlyStatus = useMemo(() => {
    const all = data?.monthlyStatus || [];
    const raw = Object.fromEntries(
      all.filter(r => r.month >= fyeWin.start && r.month <= fyeWin.end).map(r => [r.month, r])
    );
    const months = fyMonths(fyeWin).map(key => raw[key] || { month: key, complete: 0, pending: 0, complete_pct: 0 });
    // Prepend the previous FY's final cumulative bar (latest month ≤ prevEnd) so the
    // current-FY running total starts from a visible carry-over baseline. `all` is sorted
    // ascending by month, so the last matching row is the FY-end value.
    const prevRows = all.filter(r => r.month <= fyeWin.prevEnd);
    const prevLast = prevRows.length ? prevRows[prevRows.length - 1] : null;
    if (prevLast) months.unshift({ ...prevLast, isPrevLast: true, prevLabel: `${fyeWin.prevLabel} end` });
    return months;
  }, [data, fyeWin]);

  // Month-over-month change for the dashboard cards ("vs last month"). Reads the RAW
  // (unwindowed) monthlyStatus — not the FY-windowed `monthlyStatus` above — so the
  // comparison still works right at a fiscal-year rollover, where the FY window would
  // otherwise put the previous month behind the `isPrevLast` synthetic row. Each row's
  // `complete`/`pending`/`complete_pct` (and `byPartType[pt].*`) are CUMULATIVE, so the
  // difference between two adjacent months is exactly that month's net change.
  const monthDelta = useMemo(() => {
    const all = data?.monthlyStatus || [];
    const curMonth = new Date().toISOString().slice(0, 7);
    const idx = all.findIndex(r => r.month === curMonth);
    if (idx < 1) return null; // no current-month row yet, or nothing before it to diff against
    const cur = all[idx], prev = all[idx - 1];
    const diff = (c, p) => (c && p) ? {
      complete: (c.complete ?? 0) - (p.complete ?? 0),
      pending: (c.pending ?? 0) - (p.pending ?? 0),
      pct: parseFloat(((c.complete_pct ?? 0) - (p.complete_pct ?? 0)).toFixed(1)),
      // requirement count (complete+pending) each side, so the card can show the actual
      // old figure next to the new one ("3,670 → 3,685"), not just the +/- delta.
      totalFrom: (p.complete ?? 0) + (p.pending ?? 0),
      totalTo:   (c.complete ?? 0) + (c.pending ?? 0),
    } : null;
    const byPartType = {};
    for (const pt of Object.keys(cur.byPartType || {})) {
      byPartType[pt] = diff(cur.byPartType[pt], prev.byPartType?.[pt]);
    }
    // A closed month's own KZW/THAI/combined % breakdown (not a delta) — so the TOTAL
    // card ONLY can show a short history underneath the live row, e.g. current month
    // = Sep (still open, keeps moving) with "Aug 26" then "Jul 26" underneath for
    // stable reference points. `pctRow` builds one such row; `prev2` is one month
    // further back than `prev`, or null if there isn't one yet (early in the FY).
    // Not per part type: an older closed month may predate the `byPartType` field
    // entirely (see the July recovery note above `monthDelta`), so a per-type history
    // row would be missing as often as present — dropped in favor of TOTAL alone.
    const pctRow = (row) => row ? { pctSaved: row.complete_saved_pct ?? 0, pct: row.complete_pct ?? 0 } : null;
    const prev2 = idx >= 2 ? all[idx - 2] : null;
    return {
      total: diff(cur, prev), byPartType,
      prevLabel: fmtMonth(prev.month), prevTotalPct: pctRow(prev),
      prev2Label: prev2 ? fmtMonth(prev2.month) : null, prev2TotalPct: pctRow(prev2),
    };
  }, [data]);

  // Bars are stamp-GATED complete (KZW baseline + THAI T-Select #1) vs pending. Stable
  // against a later bulk sign because the BACKEND now buckets each completion by the
  // month it was fully stamped (max sign date), not the part's first-produced month —
  // so signing work in August lifts only the August bar, not every historical bar.
  const statusChartData = useMemo(() => {
    // The current month is still open — the backend keeps its bar moving until the
    // month closes and freezes (see freezeMonthlyStatus). Render it faded, like the
    // prev-FY carry-over bar, so it reads as provisional rather than settled.
    const curMonth = new Date().toISOString().slice(0, 7);
    const faint = (r) => r.isPrevLast || r.month === curMonth;
    // A picked month (click on either chart) fades every other bar to one flat alpha.
    const dimmed = (r) => !!filterMonth && (r.isPrevLast || r.month !== filterMonth);
    const fill = (r, faintA, normalA) => (dimmed(r) ? 0.2 : (faint(r) ? faintA : normalA));
    // A future placeholder month ({month:key, complete:0, pending:0, ...}, see the
    // `monthlyStatus` useMemo) has nothing to label — the % line already skips it via
    // `spanGaps`, and the count/delta labels below need the same guard.
    const hasBarData = (row) => ((row?.complete || 0) + (row?.pending || 0)) > 0;
    // The count/delta/% offsets below are tuned in PIXELS against a wide card (~157px
    // per month-category). On a narrower screen the whole canvas shrinks but a fixed
    // pixel offset does not, so at low width it eats a much bigger share of a much
    // smaller gap and the delta label (shifted sideways into the gap between bars)
    // starts overlapping the neighbour's own count/% stack. Scale every offset down
    // together with however many CSS pixels a month actually gets, never up — on a
    // wide chart this returns 1 and behaves exactly as before.
    // `xs.width / categoryCount` — NOT `getPixelForValue(1) - getPixelForValue(0)`.
    // A category scale's `getPixelForValue` looks its argument up in the LABEL array
    // (it expects a label, or falls back to treating the number as one), so passing
    // raw indices 0/1 doesn't return "the pixel at index 0/1" at all; on this chart it
    // collapsed to ~0, which silently zeroed every offset — the exact all-labels-
    // stacked-on-the-bar-top collision this was meant to fix. Total axis width divided
    // by how many categories share it is unambiguous and always correct.
    //
    // `n` MUST count the whole FY (13: FYE-end + Apr..Mar), not just the months with
    // real data — chart.js gives every category equal width whether or not it has a
    // bar, so the empty Oct–Mar placeholders still take their share of the x-axis.
    // The tuned baseline below (~85px) is exactly `1102.7 / 13`, measured from the
    // chart at the width the current fixed offsets (26/40/10) were approved against —
    // getting this count wrong (7, the visible bars only) overstated that baseline as
    // ~157px, which silently scaled every offset down even at that same "good" width.
    const TUNED_CATEGORY_PX = 85;
    const catPxOf = (ctx) => {
      const xs = ctx.chart.scales?.x;
      const n = monthlyStatus.length || 1;
      return xs?.width ? xs.width / n : TUNED_CATEGORY_PX;
    };
    const scaledOffset = (base) => (ctx) => base * Math.min(1, catPxOf(ctx) / TUNED_CATEGORY_PX);
    // Proportional scaling alone still runs out of room below a certain width — three
    // ~10px text lines squeezed toward a single point start touching however small
    // their offsets get. Below this floor, drop straight back to the ORIGINAL,
    // pre-this-feature look (just the % — always kept, never hidden) instead of
    // rendering shrunken, overlapping text.
    const MIN_EXTRA_LABEL_PX = 50;
    const showExtras = (ctx) => catPxOf(ctx) >= MIN_EXTRA_LABEL_PX;
    return {
    labels: monthlyStatus.map(r => r.isPrevLast ? r.prevLabel : fmtMonth(r.month)),
    datasets: [
      {
        type: 'bar',
        label: 'KZW Complete',
        data: monthlyStatus.map(r => r.complete_saved ?? r.complete),
        backgroundColor: monthlyStatus.map(r => hexToRgba(C.green, fill(r, 0.30, 0.75))),
        borderColor: monthlyStatus.map(r => hexToRgba(C.green, faint(r) ? 0.55 : 1)),
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'THAI Complete *',
        data: monthlyStatus.map(r => Math.max(0, (r.complete || 0) - (r.complete_saved ?? r.complete ?? 0))),
        backgroundColor: monthlyStatus.map(r => hexToRgba(C.greenSoft, fill(r, 0.30, 0.70))),
        borderColor: monthlyStatus.map(r => hexToRgba(C.greenSoft, faint(r) ? 0.55 : 1)),
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Pending',
        data: monthlyStatus.map(r => r.pending),
        backgroundColor: monthlyStatus.map(r => hexToRgba(C.yellow, fill(r, 0.28, 0.65))),
        borderColor: monthlyStatus.map(r => hexToRgba(C.yellow, faint(r) ? 0.55 : 1)),
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
        pointRadius: monthlyStatus.map(r => r.month === curMonth ? 4 : 3),
        pointBackgroundColor: monthlyStatus.map(r => r.month === curMonth ? hexToRgba(C.orange, 0.25) : C.orange),
        pointBorderColor: C.orange,
        tension: 0.3,
        yAxisID: 'y1',
        // Two labels stacked above each bar (count, %), plus delta vs the prior bar
        // pushed into the GAP to its left — reads as "the change crossing into this
        // bar" sitting between the two bars being compared, not stacked on either one.
        datalabels: {
          display: true,
          labels: {
            count: {
              display: (ctx) => hasBarData(monthlyStatus[ctx.dataIndex]) && showExtras(ctx),
              formatter: (v, ctx) => (monthlyStatus[ctx.dataIndex]?.complete ?? 0).toLocaleString(),
              color: C.textPri,
              anchor: 'end', align: 'top', offset: scaledOffset(26),
              font: { size: 10, weight: 700 },
            },
            delta: {
              display: (ctx) => hasBarData(monthlyStatus[ctx.dataIndex]) && !!monthlyStatus[ctx.dataIndex - 1] && showExtras(ctx),
              // Returning an array renders each entry as its own stacked line — arrow
              // above the number, rather than side by side.
              formatter: (v, ctx) => {
                const d = (monthlyStatus[ctx.dataIndex]?.complete ?? 0) - (monthlyStatus[ctx.dataIndex - 1]?.complete ?? 0);
                const arrow = d > 0 ? '▲' : d < 0 ? '▼' : '●';
                return [arrow, Math.abs(d).toLocaleString()];
              },
              color: (ctx) => {
                const d = (monthlyStatus[ctx.dataIndex]?.complete ?? 0) - (monthlyStatus[ctx.dataIndex - 1]?.complete ?? 0);
                return d > 0 ? C.green : d < 0 ? C.red : C.textSec;
              },
              // A keyword align only offsets along ONE axis, so 'left' alone sits it
              // at the point's own height (the trend line, well below the count row).
              // A numeric align is a clockwise angle from the anchor (0=right, 90=
              // bottom, 180=left, 270/-90=top) — -135 is up-and-left, landing the
              // label level with the count row while still in the gap between bars.
              anchor: 'end', align: -135, offset: scaledOffset(40),
              font: { size: 9, weight: 700 },
            },
            // Only label months that actually have parts — skip empty future months
            pct: {
              display: (ctx) => hasBarData(monthlyStatus[ctx.dataIndex]),
              formatter: (v) => `${v}%`,
              color: C.green,
              anchor: 'end', align: 'top', offset: scaledOffset(10),
              font: { size: 10, weight: 700 },
            },
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
    };
  }, [monthlyStatus, filterMonth]);

  const statusChartOpts = {
    // Only months that have bars are selectable — the empty future placeholders and the
    // previous-FY carry-over bar are not production cohorts of this year.
    onClick: (evt, _els, chart) => {
      const row = monthlyStatus[columnIndexAt(evt, chart)];
      if (row && !row.isPrevLast && ((row.complete || 0) + (row.pending || 0)) > 0) pickMonth(row.month);
    },
    onHover: (evt, _els, chart) => {
      const row = monthlyStatus[columnIndexAt(evt, chart)];
      chart.canvas.style.cursor = row && !row.isPrevLast && ((row.complete || 0) + (row.pending || 0)) > 0 ? 'pointer' : 'default';
    },
    responsive: true, animation: false,
    maintainAspectRatio: false,
    // Legend at the BOTTOM so the 'top'-aligned % datalabels on the near-100% Complete-%
    // line never collide with it; top padding + axis headroom keep the 100% label visible.
    // Padding is taller than the 100%-label days now that each bar stacks two labels
    // (count, %) above its point, plus the delta label sitting in the gap to the left —
    // see `statusChartData`'s `datalabels.labels`.
    layout: { padding: { top: 54 } },
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
  // What the table lists. Normally the sheets that still need action; with a month picked,
  // EVERY sheet first produced that month (Complete + Pending, from `monthRows`). If that
  // list is unavailable (cache built before the endpoint existed) it degrades to the
  // month's pending rows, and `monthListPartial` lets the table say so.
  const monthListPartial = !!filterMonth && !monthRowsLoading && monthRows === null;
  const listRows = useMemo(() => {
    if (!filterMonth) return data?.needsAttention || [];
    if (monthRows) return monthRows;
    return (data?.needsAttention || []).filter(r => String(r.first_prod_date || '').slice(0, 7) === filterMonth);
  }, [data, filterMonth, monthRows]);

  const machineOptions = useMemo(() => {
    const names = [...new Set(listRows.map(r => r.machine_type_name).filter(Boolean))].sort();
    return [{ value: '', label: 'All Machines' }, ...names.map(n => ({ value: n, label: n }))];
  }, [listRows]);

  const partTypeOptions = useMemo(() => {
    const types = [...new Set(listRows.map(r => r.part_type).filter(Boolean))].sort();
    return [{ value: '', label: 'All Part Types' },
      ...types.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))];
  }, [listRows]);

  // `LIMIT_ANOMALY` is a synthetic reason value — `limit_excluded` is a separate flag
  // from `pending_reason` (a row can be e.g. NO_STAMP *and* limit_excluded at once), so
  // it never appeared here on its own. Added so removing the old "reconcile data"
  // summary card still leaves a way to isolate these rows in the table below.
  // `COMPLETE` is likewise synthetic: Complete rows have no pending_reason, and they only
  // exist in the list when a month is picked.
  const reasonOptions = useMemo(() => {
    const reasons = [...new Set(listRows.map(r => r.pending_reason).filter(Boolean))].sort();
    const hasLimitAnomaly = listRows.some(r => r.limit_excluded);
    const hasComplete = listRows.some(r => r.coverage_level === 'COMPLETE');
    return [{ value: '', label: 'All Reasons' },
      ...(hasComplete ? [{ value: 'COMPLETE', label: 'Complete (PDF ready)' }] : []),
      ...reasons.map(r => ({ value: r, label: REASON_LABELS[r] || r })),
      ...(hasLimitAnomaly ? [{ value: 'LIMIT_ANOMALY', label: 'Limit Anomaly' }] : [])];
  }, [listRows]);

  const filteredAttention = useMemo(() => {
    return listRows.filter(r => {
      if (filterPt && r.part_type !== filterPt) return false;
      if (filterMc && r.machine_type_name !== filterMc) return false;
      if (filterReason === 'LIMIT_ANOMALY') { if (!r.limit_excluded) return false; }
      else if (filterReason === 'COMPLETE') { if (r.coverage_level !== 'COMPLETE') return false; }
      else if (filterReason && r.pending_reason !== filterReason) return false;
      return true;
    });
  }, [listRows, filterPt, filterMc, filterReason]);

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
            <Tooltip title={r.limit_reason
              ? `ผลิตบนเครื่องนี้จริง แต่เกิน Tooling Select LIMIT: ${r.limit_reason} — ตรวจสอบ machine limit หรือข้อมูลการผลิต`
              : 'ผลิตบนเครื่องนี้จริง แต่ Tooling Select LIMIT ระบุว่าชิ้นงานเกินพิกัดของเครื่อง (ขึ้นเครื่องไม่ได้) — ตรวจสอบ machine limit หรือข้อมูลการผลิต'}
            >
              <Tag color="error" icon={<WarningOutlined />} style={{ fontSize: 10, fontWeight: 700 }}>
                {r.limit_reason ? `Limit Anomaly (${r.limit_reason})` : 'Limit Anomaly'}
              </Tag>
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
                  <div
                    role="button" tabIndex={0}
                    title="Show every pending CN (clears the part-type and month filters)"
                    onClick={clearSelection}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clearSelection(); } }}
                    style={{
                      ...cardStyle, borderTop: `3px solid ${C.cyan}`, height: '100%', boxSizing: 'border-box',
                      cursor: 'pointer', opacity: filterPt ? 0.6 : 1, transition: 'opacity 0.15s',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                      <Text style={{ color: C.cyan, fontSize: 13, fontWeight: 800 }}>TOTAL</Text>
                      <Tooltip title="Total SDS requirements = CN × machine × process">
                        <Text style={{ color: C.textPri, fontSize: 22, fontWeight: 800, lineHeight: 1, cursor: 'help' }}>
                          {(cardKpi?.total ?? 0).toLocaleString()}
                        </Text>
                      </Tooltip>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <Text style={{ color: C.textSec, fontSize: 10 }}>SDS reqs</Text>
                      <Tooltip title="Unique CNs across the selected part types (deduplicated across machine × process)">
                        <Text style={{ color: C.textSec, fontSize: 10, cursor: 'help' }}>{(cardKpi?.uniqueCnCount ?? 0).toLocaleString()} Unique CNs</Text>
                      </Tooltip>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Text style={{ color: C.textSec, fontSize: 10 }}>PDF Ready</Text>
                      <Tooltip title="Complete / Pending sheets">
                        <Text style={{ fontSize: 10, cursor: 'help' }}>
                          <span style={{ color: C.green, fontWeight: 700 }}>{(cardKpi?.complete ?? 0).toLocaleString()}</span>
                          <span style={{ color: C.textSec }}> comp / </span>
                          <span style={{ color: C.yellow, fontWeight: 700 }}>{(cardKpi?.pending ?? 0).toLocaleString()}</span>
                          <span style={{ color: C.textSec }}> pend</span>
                        </Text>
                      </Tooltip>
                    </div>
                    {(() => {
                      const pct = cardKpi?.completePct ?? 0;
                      const pctSaved = cardKpi?.completeSavedPct ?? pct;
                      const boost = Math.max(0, (cardKpi?.complete ?? 0) - (cardKpi?.completeSaved ?? cardKpi?.complete ?? 0));
                      return (<>
                        <Tooltip title={`KZW ${pctSaved}% + THAI ${(pct - pctSaved).toFixed(1)}% = ${pct}%`}>
                          <div style={{ background: C.border, borderRadius: 3, height: 6, overflow: 'hidden', margin: '3px 0 2px', display: 'flex', cursor: 'help' }}>
                            <div style={{ width: `${Math.min(pctSaved, 100)}%`, height: '100%', background: C.green, transition: 'width 0.8s ease' }} />
                            <div style={{ width: `${Math.min(Math.max(pct - pctSaved, 0), 100)}%`, height: '100%', background: C.greenSoft, opacity: 0.85, transition: 'width 0.8s ease' }} />
                          </div>
                        </Tooltip>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                          <Text style={{ color: pctSaved >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 700 }}>{pctSaved}% <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 400 }}>KZW</Text></Text>
                          {boost > 0 && <Text style={{ color: C.greenSoft, fontSize: 11, fontWeight: 700 }}>+{(pct - pctSaved).toFixed(1)}% <Text style={{ color: C.textSec, fontSize: 9, fontWeight: 400 }}>THAI *</Text></Text>}
                          {boost > 0 && <Text style={{ color: pct >= 90 ? C.green : C.red, fontSize: 11, fontWeight: 800 }}>→ {pct}%</Text>}
                        </div>
                      </>);
                    })()}
                    {/* The month history rows and "vs last month" badges compare the LIVE
                        totals over time — meaningless for a single production cohort. */}
                    {!cohort && <>
                      <TrendArrow from={monthDelta?.prevTotalPct?.pct} to={cardKpi?.completePct ?? 0} C={C} />
                      <PrevMonthPctRow label={monthDelta?.prevLabel} snapshot={monthDelta?.prevTotalPct} C={C} />
                      <TrendArrow from={monthDelta?.prev2TotalPct?.pct} to={monthDelta?.prevTotalPct?.pct} C={C} />
                      <PrevMonthPctRow label={monthDelta?.prev2Label} snapshot={monthDelta?.prev2TotalPct} C={C} />
                    </>}
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      <Tag color="success" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{(cardKpi?.completeSaved ?? cardKpi?.complete ?? 0).toLocaleString()} KZW complete</Tag>
                      {Math.max(0, (cardKpi?.complete ?? 0) - (cardKpi?.completeSaved ?? cardKpi?.complete ?? 0)) > 0 && (
                        <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
                          <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: C.greenSoft, background: hexToRgba(C.greenSoft, 0.18), borderColor: C.greenSoft }}>+{Math.max(0, (cardKpi?.complete ?? 0) - (cardKpi?.completeSaved ?? cardKpi?.complete ?? 0)).toLocaleString()} THAI *</Tag>
                        </Tooltip>
                      )}
                    </div>
                    {!cohort && <DeltaBadge delta={monthDelta?.total} C={C} />}
                  </div>
                </Col>
                {cardPartTypes.map(pt => (
                  <Col key={pt.part_type} span={4}>
                    <PartTypeCard
                      pt={pt} C={C}
                      delta={cohort ? null : monthDelta?.byPartType?.[pt.part_type]}
                      onClick={() => pickPartType(pt.part_type)}
                      active={filterPt === pt.part_type}
                      dimmed={!!filterPt && filterPt !== pt.part_type}
                    />
                  </Col>
                ))}
              </Row>
            )}

            {/* ── Active selection (cards / bars) ─────────────────────────────── */}
            {(filterPt || filterMonth) && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                <Text style={{ color: C.textSec, fontSize: 11 }}>Showing</Text>
                {filterPt && (
                  <Tag closable color="geekblue" style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setFilterPt(''); }}>
                    Part type: {partTypeLabel(filterPt)}
                  </Tag>
                )}
                {filterMonth && (
                  <Tooltip title="Sheets whose first production was in this month. Cards show this cohort's live counts; a closed month's bar is a frozen snapshot, so its Pending count can be higher than what is left now.">
                    <Tag closable color="blue" style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setFilterMonth(''); }}>
                      First produced: {fmtMonth(filterMonth)}
                    </Tag>
                  </Tooltip>
                )}
                <a onClick={clearSelection} style={{ fontSize: 11 }}>Clear all</a>
                <Text style={{ color: C.textSec, fontSize: 11 }}>
                  — {filteredAttention.length.toLocaleString()} sheet(s) in the list
                </Text>
                <a onClick={goToTable} style={{ fontSize: 11, fontWeight: 700 }}>View list ↓</a>
              </div>
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

            {/* ── Limit-softening worklist ────────────────────────────────────── */}
            {/* (machine, process) pairs where a part over the T-Select design work-size
                limit is treated as usable because the factory floor has genuinely run it
                there. Each line is a tooling_machine_limit bound to measure against the
                plan and fix surgically — the standard is what needs revising, not the run. */}
            {(data?.kpi?.limitSoftenedByMachine?.length > 0) && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  {sectionTitle('Limit Softening — surgical-fix worklist', C)}
                  <Text style={{ color: C.textSec, fontSize: 11 }}>
                    {(data?.kpi?.limitSoftened ?? 0).toLocaleString()} sheet(s) across{' '}
                    {data.kpi.limitSoftenedByMachine.length} (machine · process)
                  </Text>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {data.kpi.limitSoftenedByMachine.map((g, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                      <Tag style={{ fontFamily: 'monospace', fontSize: 11, margin: 0, background: 'transparent', borderColor: C.border, color: C.textPri }}>{g.machine}</Tag>
                      <Tag style={{ fontFamily: 'monospace', fontSize: 11, margin: 0, background: 'transparent', borderColor: C.border, color: C.textSec }}>{g.process}</Tag>
                      <Text style={{ color: C.orange, fontSize: 11 }}>{g.reason || 'over work-size limit'}</Text>
                      <Text style={{ color: C.textSec, fontSize: 11, marginLeft: 'auto' }}>{g.cn_count} C/N</Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Needs Attention Table ───────────────────────────────────────── */}
            <div style={cardStyle} ref={attentionRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {sectionTitle(filterMonth ? `All sheets first produced ${fmtMonth(filterMonth)}` : 'CNs Requiring Action', C)}
                <Space>
                  {monthListPartial && (
                    <Tooltip title="The full list for this month is not in the cached report yet (it appears after the next rebuild). Showing only the sheets that still need action.">
                      <Tag color="warning" style={{ margin: 0 }}>Pending only</Tag>
                    </Tooltip>
                  )}
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
                loading={monthRowsLoading}
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
