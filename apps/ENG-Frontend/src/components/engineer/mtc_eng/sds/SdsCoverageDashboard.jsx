import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Layout, Select, Spin, Typography, Row, Col, Table, Tag, Space, Button, App, Tooltip } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SettingOutlined, WarningOutlined, FileSearchOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
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

// Fiscal year (Apr 1 – Mar 31). FYE N = Apr (N+1999) → Mar (N+2000) — same convention
// as InspectionResultDashboard / GeneralDwgReport's FYE selector.
const fyeWindowForNum = (num) => {
  const sy = num + 1999;
  const pad = (v) => String(v).padStart(2, '0');
  return {
    num,
    start: `${sy}-04`, end: `${sy + 1}-03`,
    prevStart: `${sy - 1}-04`, prevEnd: `${sy}-03`,
    label: `FYE${pad(num)}`, prevLabel: `FYE${pad(num - 1)}`,
  };
};

// The backend sends the CURRENT fye as `data.fye`; this derives the same window
// client-side as the default FYE selection and as a fallback for an older cached
// payload with no `data.fye` at all.
const computeFyeWindow = (ref = new Date()) => {
  const num = (ref.getMonth() + 1) >= 4 ? ref.getFullYear() - 1999 : ref.getFullYear() - 2000;
  return fyeWindowForNum(num);
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

// ── Part Type Card ─────────────────────────────────────────────────────────────
// Minimal stat card — title + total only, same visual language (coloured top border,
// active ring, dimmed sibling) as MiniStatCard below. `onClick` makes the card a
// toggle filter on the CN table (part type); `active` outlines it in its own colour,
// `dimmed` turns it fully grey (border, label, number) instead of fading its colour,
// so a sibling card being selected reads as "not this one" rather than "same, paler".
// No longer shows its own count — picking a card moves that number into the TOTAL
// tile instead (via `scopedStats.total`), so a number never sits in two places at once.
const PartTypeCard = ({ pt, C, onClick, active, dimmed }) => {
  const cardStyle = cardStyleOf(C);
  const color = dimmed ? C.textSec : (partTypeColors(C)[pt.part_type] || C.cyan);
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
        transition: 'box-shadow 0.15s, border-color 0.15s, color 0.15s',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
      }}>
      <Text style={{ color, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>{displayLabel}</Text>
    </div>
  );
};

// A dimmed card shows grey instead of its own colour (border + label), same rule as
// PartTypeCard — "not the selected one" reads as neutral, not as a paler version of
// its own colour. Shared by MiniStatCard and by the outer boxes it sits `bare` inside.
const dimColor = (color, dimmed, C) => (dimmed ? C.textSec : color);

// ── Mini Stat Card ───────────────────────────────────────────────────────────────
// Same title+number shape as the (now minimal) PartTypeCard, for a non-part-type stat
// (Complete / Pending) sitting alongside the wide TOTAL card.
// `bare` drops the card's own background/border/padding — used when it's placed as a
// block INSIDE a shared outer card (see the Total/Complete/%Complete columns) instead
// of standing as its own floating box.
const MiniStatCard = ({ label, value, suffix, color, C, onClick, active, dimmed, bare }) => {
  const effColor = dimColor(color, dimmed, C);
  return (
    <div
      role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? !!active : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        ...(bare ? {} : { ...cardStyleOf(C), borderTop: `3px solid ${effColor}` }),
        height: '100%', boxSizing: 'border-box',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
        boxShadow: active ? `0 0 0 2px ${effColor}` : 'none',
        transition: 'box-shadow 0.15s, border-color 0.15s, color 0.15s',
      }}>
      <Text style={{ color: effColor, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ color: dimmed ? C.textSec : C.textPri, fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{(value ?? 0).toLocaleString()}{suffix}</Text>
    </div>
  );
};

// Label stacked ABOVE the number (instead of MiniStatCard's side-by-side) — for a card
// at roughly half MiniStatCard's width, where label+number side by side wraps badly.
// `bare` — see MiniStatCard above.
const SubStatCard = ({ label, value, suffix, color, C, bare }) => (
  <div style={{
    ...(bare ? {} : { ...cardStyleOf(C), borderTop: `3px solid ${color}`, padding: '8px 12px' }),
    height: '100%', boxSizing: 'border-box',
  }}>
    <div style={{ color, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
    <div style={{ color: C.textPri, fontSize: 20, fontWeight: 500, lineHeight: 1.3 }}>{(value ?? 0).toLocaleString()}{suffix}</div>
  </div>
);

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
  const [fye, setFye] = useState(() => computeFyeWindow().num);
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
  const [monthRowsBuilding, setMonthRowsBuilding] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [showLimitSoftening, setShowLimitSoftening] = useState(false);
  const pollRef = useRef(null);
  const attentionRef = useRef(null);

  // Selecting never moves the page: the point of a click on a card or bar is to watch the
  // cards and charts change. The list is one click away from the "Showing" bar instead.
  const goToTable = () => attentionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const pickPartType = (pt) => setFilterPt(cur => (cur === pt ? '' : pt));
  const pickMonth = (m) => setFilterMonth(cur => (cur === m ? '' : m));
  const pickReason = (r) => setFilterReason(cur => (cur === r ? '' : r));
  const clearSelection = () => { setFilterPt(''); setFilterMonth(''); setFilterReason(''); };

  // The cohort's full sheet list lives behind its own endpoint (the main payload only
  // carries pending rows). A failed / unavailable load leaves `monthRows` null and the
  // table falls back to the pending rows of that month.
  // When the server answers `building` (its cache predates the cohort list and a rebuild
  // was just started) keep asking every 15 s while the month stays selected, so the list
  // and the re-scoped cards arrive by themselves instead of needing a second click.
  useEffect(() => {
    setMonthRows(null);
    setMonthRowsBuilding(false);
    if (!filterMonth) return undefined;
    let cancelled = false;
    let timer = null;
    const load = (first) => {
      if (first) setMonthRowsLoading(true);
      axios.get(server.MTC_SDS_V2_REPORT_COVERAGE_ROWS, { params: { month: filterMonth } })
        .then(res => {
          if (cancelled) return;
          if (Array.isArray(res.data?.rows)) { setMonthRows(res.data.rows); setMonthRowsBuilding(false); }
          else if (res.data?.building) { setMonthRowsBuilding(true); timer = setTimeout(() => load(false), 15000); }
        })
        .catch(() => { /* leave the pending-only fallback in place */ })
        .finally(() => { if (!cancelled && first) setMonthRowsLoading(false); });
    };
    load(true);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
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
  // The Complete/Pending/%Complete mini cards re-scope to the selected part-type card
  // (Ball, Race, ...) the same way the TOTAL card's own numbers already re-scope to a
  // selected month (`cardKpi`/`cohort`) — a part-type pick should move these three the
  // same way a month pick moves TOTAL. `byPartType` entries are snake_case from the
  // backend; normalized to the camelCase `cardKpi` already uses so callers don't care
  // which source they came from.
  const scopedStats = filterPt
    ? (() => {
        const pt = cardPartTypes.find(p => p.part_type === filterPt);
        if (!pt) return { complete: 0, pending: 0, completePct: 0, completeSaved: 0, completeSavedPct: 0 };
        return {
          total: pt.total ?? 0,
          complete: pt.complete ?? 0, pending: pt.pending ?? 0,
          completePct: pt.complete_pct ?? 0,
          completeSaved: pt.complete_saved ?? pt.complete ?? 0,
          completeSavedPct: pt.complete_saved_pct ?? pt.complete_pct ?? 0,
        };
      })()
    : {
        total: cardKpi?.total ?? 0,
        complete: cardKpi?.complete ?? 0, pending: cardKpi?.pending ?? 0,
        completePct: cardKpi?.completePct ?? 0,
        completeSaved: cardKpi?.completeSaved ?? cardKpi?.complete ?? 0,
        completeSavedPct: cardKpi?.completeSavedPct ?? cardKpi?.completePct ?? 0,
      };

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

  // FYE dropdown — the underlying payload already carries full history (since the
  // report scope's since_date, not just the current FY), so switching FYE needs no
  // extra fetch: just re-window the same `data.monthlyStatus`/`monthlyNewParts`
  // client-side. Options are derived from the months actually present in the data
  // (matches the FYE selects on Tooling Inspection and General DWG Request, which
  // fetch their option list from the backend — here it's free from data already in hand).
  const fyeOptions = useMemo(() => {
    const months = (data?.monthlyStatus || []).map(r => r.month).filter(Boolean);
    const toFyeNum = (m) => { const [y, mo] = m.split('-').map(Number); return mo >= 4 ? y - 1999 : y - 2000; };
    const nums = new Set(months.map(toFyeNum));
    nums.add(fye); // keep the current selection visible even before data loads
    return [...nums].sort((a, b) => b - a);
  }, [data, fye]);
  const fyeWin = useMemo(() => fyeWindowForNum(fye), [fye]);

  // Month dropdown — the same "First produced" filter a bar click already sets
  // (`filterMonth`), offered as an explicit picker too (matches the FYE/Month
  // selects on the Tooling Inspection and General DWG Request reports).
  const monthFilterOptions = useMemo(() => ([
    { label: 'All Months', value: '' },
    ...fyMonths(fyeWin).map(key => ({ label: fmtMonth(key), value: key })),
  ]), [fyeWin]);

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
        // A picked part-type card used to fade the OTHER segments to 0.2 opacity and
        // keep them stacked — reads as a cluttered pale bar instead of "showing just
        // this type". Zeroing their data out instead makes the stack collapse down to
        // a single solid bar for the selected type, nothing else drawn.
        const hidden = !!filterPt && t !== filterPt;
        return {
          label: partTypeLabel(t),
          data: monthlyNewParts.map(r => hidden ? 0 : (r[t] || 0)),
          // A picked month still fades every other month within the (now single) bar.
          backgroundColor: monthlyNewParts.map(r => hexToRgba(color,
            (filterMonth && r.month !== filterMonth) ? 0.2 : (faint(r) ? 0.35 : 0.75))),
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
      // dataset). Normally summed across every part type so it reads as the bar's grand
      // total; with a part-type card selected it switches to that type's own count,
      // otherwise the label would keep showing the whole-FY number while the bar itself
      // fades down to one segment — the same mismatch the cards and the status chart
      // were fixed for.
      datalabels: {
        display: (ctx) => {
          const row = monthlyNewParts[ctx.dataIndex];
          const total = filterPt ? (row?.[filterPt] || 0)
            : ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 && total > 0;
        },
        formatter: (v, ctx) => {
          const row = monthlyNewParts[ctx.dataIndex];
          const total = filterPt ? (row?.[filterPt] || 0)
            : ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
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
      y: { stacked: true, ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine }, title: { display: true, text: 'New SDS Reqs', color: C.textSec, font: { size: 10 } } },
    },
  };

  // ── Monthly Coverage Status chart (bar: complete/pending + line: complete%) ──
  // When a part-type card is selected, the chart should re-scope to it the same way the
  // cards and "New Parts per Month" chart already do — each row's own `byPartType[pt]`
  // (same shape as the row itself: complete/complete_saved/pending/complete_pct) stands
  // in for the row's top-level TOTAL fields. A row frozen before `byPartType` shipped (or
  // one simply missing the selected type) has nothing to show for that month — zero,
  // not the unfiltered total, since showing the whole-FY number while a Ball filter is on
  // would silently misreport as "this is Ball's number".
  const scopeToPartType = (row, pt) => {
    if (!pt) return row;
    const t = row.byPartType?.[pt];
    if (!t) return { ...row, complete: 0, complete_saved: 0, pending: 0, complete_pct: 0, complete_saved_pct: 0 };
    return { ...row, ...t };
  };

  const monthlyStatus = useMemo(() => {
    const all = data?.monthlyStatus || [];
    const curMonth = new Date().toISOString().slice(0, 7);
    const raw = Object.fromEntries(
      all.filter(r => r.month >= fyeWin.start && r.month <= fyeWin.end).map(r => [r.month, r])
    );
    // Prepend the previous FY's final cumulative bar (latest month ≤ prevEnd) so the
    // current-FY running total starts from a visible carry-over baseline. `all` is sorted
    // ascending by month, so the last matching row is the FY-end value.
    const prevRows = all.filter(r => r.month <= fyeWin.prevEnd);
    const prevLast = prevRows.length ? prevRows[prevRows.length - 1] : null;

    // This is a CUMULATIVE curve, so a month with no row yet is not necessarily "0" —
    // the backend only emits a month once a CN is first produced in it, and the current
    // month can go several days with none. Carry the last known snapshot forward onto
    // it instead of zeroing the bar out; a genuinely future month (after curMonth) still
    // has no snapshot to carry and correctly stays at 0/hidden via hasBarData.
    let carry = prevLast;
    const months = fyMonths(fyeWin).map((key) => {
      if (raw[key]) { carry = raw[key]; return scopeToPartType(raw[key], filterPt); }
      if (key <= curMonth && carry) return scopeToPartType({ ...carry, month: key }, filterPt);
      return scopeToPartType({ month: key, complete: 0, pending: 0, complete_pct: 0 }, filterPt);
    });
    if (prevLast) months.unshift({ ...scopeToPartType(prevLast, filterPt), isPrevLast: true, prevLabel: `${fyeWin.prevLabel} end` });
    return months;
  }, [data, fyeWin, filterPt]);

  // Month-over-month change for the dashboard cards ("vs last month"). Reads the RAW
  // (unwindowed) monthlyStatus — not the FY-windowed `monthlyStatus` above — so the
  // comparison still works right at a fiscal-year rollover, where the FY window would
  // otherwise put the previous month behind the `isPrevLast` synthetic row. Each row's
  // `complete`/`pending`/`complete_pct` (and `byPartType[pt].*`) are CUMULATIVE, so the
  // difference between two adjacent months is exactly that month's net change.
  // Bars are stamp-GATED complete (Innovator baseline + THAI T-Select #1) vs pending. Stable
  // against a later bulk sign because the BACKEND now buckets each completion by the
  // month it was fully stamped (max sign date), not the part's first-produced month —
  // so signing work in August lifts only the August bar, not every historical bar.
  // See the `max` comment on the left 'y' scale in `statusChartOpts`: keeps the tallest
  // bar at or below the screen height the target line sits at on the right axis
  // (90/115 of the chart). Declared BEFORE `statusChartData` because `yMax` is in that
  // chart's dependency array.
  const yMax = useMemo(() => {
    const barMax = Math.max(1, ...monthlyStatus.map(r => (r.complete || 0) + (r.pending || 0)));
    // Round UP to a "nice" gridline, but the rounding step itself scales with the data —
    // a fixed step overshoots badly on small counts (same fix applied to the Tooling
    // Inspection and General DWG Request reports' equivalent charts).
    const step = barMax < 10 ? 1 : barMax < 50 ? 5 : barMax < 200 ? 10 : barMax < 1000 ? 50 : 500;
    return Math.ceil((barMax * 115 / 90) / step) * step;
  }, [monthlyStatus]);

  // The summary table below the status chart lines its month columns up with the
  // chart's own bars by reading the live x-axis geometry off the Chart.js instance
  // rather than guessing at CSS widths — a category scale gives every column equal
  // width between `scales.x.left` and `scales.x.right`, so that's exactly the gutter
  // the table's first (row-label) column and value columns need to reproduce.
  //
  // Measured via a Chart.js `afterLayout` plugin, not a ResizeObserver on the canvas.
  // The observer approach raced Chart.js's own first render: `animation:false` makes
  // that render effectively synchronous, but the observer's callback is batched to
  // the next frame regardless, so on a slow first paint it could fire before
  // `chart.scales` existed and the table would silently stay on its 1fr fallback —
  // equal-width columns, but not aligned to the chart underneath. `afterLayout` is
  // Chart.js's own "the layout for this pass is final" hook, so it runs exactly when
  // `scales.x.left/right` are authoritative — on first render AND on every resize.
  //
  // react-chartjs-2 only reads the `plugins` prop when it FIRST constructs the chart
  // (`new Chart(canvas, { ..., plugins })` inside its own `renderChart`); none of its
  // update effects re-apply a changed `plugins` prop to an existing instance. So this
  // plugin object must never close over `monthlyStatus` (or anything else reactive) —
  // on first mount `data` hasn't arrived yet and `monthlyStatus` is a shorter
  // placeholder array (no prepended FYE-end row), and a closure over it would bake
  // that wrong, permanently-stale category count into every later measurement,
  // understating `colW` and overflowing the table past the chart's real width. Read
  // the category count from the CHART's own live data instead — `chart.data.labels`
  // is kept in sync on every render via react-chartjs-2's `setLabels` effect, so it's
  // always current regardless of when this plugin closure was created.
  const statusChartRef = useRef(null);
  const [statusColLayout, setStatusColLayout] = useState(null); // { left, colW, right }
  const statusColsPlugin = useMemo(() => ({
    id: 'statusCols',
    afterLayout: (chart) => {
      const xs = chart.scales?.x;
      const n = chart.data?.labels?.length || 0;
      if (!xs || !n) return;
      const left = xs.left, colW = (xs.right - xs.left) / n, right = chart.width - xs.right;
      setStatusColLayout((prev) => (
        prev && prev.left === left && prev.colW === colW && prev.right === right
      ) ? prev : { left, colW, right });
    },
  }), []);

  const statusChartData = useMemo(() => {
    // The current month is still open — the backend keeps its bar moving until the
    // month closes and freezes (see freezeMonthlyStatus). Render it faded, like the
    // prev-FY carry-over bar, so it reads as provisional rather than settled.
    const curMonth = new Date().toISOString().slice(0, 7);
    const faint = (r) => r.isPrevLast || r.month === curMonth;
    // A picked month (click on either chart) fades every other bar to one flat alpha.
    const dimmed = (r) => !!filterMonth && (r.isPrevLast || r.month !== filterMonth);
    const fill = (r, faintA, normalA) => (dimmed(r) ? 0.2 : (faint(r) ? faintA : normalA));
    return {
    labels: monthlyStatus.map(r => r.isPrevLast ? r.prevLabel : fmtMonth(r.month)),
    datasets: [
      {
        type: 'bar',
        label: 'Innovator Complete',
        data: monthlyStatus.map(r => r.complete_saved ?? r.complete),
        backgroundColor: monthlyStatus.map(r => hexToRgba(C.green, fill(r, 0.30, 0.75))),
        borderColor: monthlyStatus.map(r => hexToRgba(C.green, faint(r) ? 0.55 : 1)),
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
        order: 3,
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
        order: 3,
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
        order: 3,
      },
      {
        type: 'line',
        label: 'Complete % (Innovator+THAI)',
        // Cut the line at the last month that actually has data (null → no point),
        // so it stops at the latest month instead of diving to 0% across empty
        // future months — same behaviour as the Inspection "Monthly Trend — FYE" line.
        data: monthlyStatus.map(r => ((r.complete || 0) + (r.pending || 0)) > 0 ? r.complete_pct : null),
        spanGaps: true,
        borderColor: C.blue,
        backgroundColor: hexToRgba(C.blue, 0.15),
        borderWidth: 2,
        pointRadius: monthlyStatus.map(r => r.month === curMonth ? 4 : 3),
        pointBackgroundColor: monthlyStatus.map(r => r.month === curMonth ? hexToRgba(C.blue, 0.25) : C.blue),
        pointBorderColor: C.blue,
        tension: 0.3,
        yAxisID: 'y1',
        order: 1, // above the bars, below Target (lower `order` draws on top)
        datalabels: {
          display: (ctx) => {
            const r = monthlyStatus[ctx.dataIndex];
            return ((r?.complete || 0) + (r?.pending || 0)) > 0;
          },
          formatter: (v) => `${v}%`,
          // Matches the %Complete KPI tile's own convention elsewhere on this page:
          // at/above the 90% target reads green, below it reads red.
          color: (ctx) => {
            const r = monthlyStatus[ctx.dataIndex];
            return (r?.complete_pct ?? 0) >= 90 ? C.green : C.red;
          },
          anchor: 'end', align: 'top', offset: 4,
          font: { size: 10, weight: 700 },
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
        order: 0, // lowest in this chart — always drawn last, on top of the bars and every other line
      },
    ],
    };
  }, [monthlyStatus, filterMonth]);

  // The row-label stack that used to float at the top of the chart (count, delta vs.
  // last month, Complete %) now renders as a table under it instead — one row per
  // metric, one column per month, aligned to the chart's own bars via `statusColLayout`.
  const statusMonthlyRows = useMemo(() => {
    const hasBarData = (row) => ((row?.complete || 0) + (row?.pending || 0)) > 0;
    const deltaOf = (i) => {
      const r = monthlyStatus[i], prev = monthlyStatus[i - 1];
      if (!hasBarData(r) || !prev || !hasBarData(prev)) return null;
      return (r.complete ?? 0) - (prev.complete ?? 0);
    };
    return [
      {
        key: 'total', label: 'Total', bold: true,
        format: (r) => hasBarData(r) ? ((r.complete || 0) + (r.pending || 0)).toLocaleString() : '—',
      },
      {
        key: 'complete', label: 'Complete',
        format: (r) => hasBarData(r) ? (r.complete ?? 0).toLocaleString() : '—',
      },
      {
        key: 'delta', label: 'Change',
        format: (r, i) => {
          const d = deltaOf(i);
          if (d === null) return '—';
          const sign = d > 0 ? '+' : d < 0 ? '-' : '';
          return `${sign}${Math.abs(d).toLocaleString()}`;
        },
        color: (r, i) => {
          const d = deltaOf(i);
          if (d === null || d === 0) return C.textSec;
          return d > 0 ? C.green : C.red;
        },
      },
      {
        key: 'remain', label: 'Remain', color: () => C.yellow,
        format: (r) => hasBarData(r) ? (r.pending ?? 0).toLocaleString() : '—',
      },
      {
        key: 'pct', label: '%', color: () => C.green,
        format: (r) => hasBarData(r) ? `${r.complete_pct}%` : '—',
      },
    ];
  }, [monthlyStatus, C]);

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
    // The count/delta stack that used to live at the top of the plot (pinned to `yMax`
    // so it read as a flat row) now lives in the table below the chart instead. The
    // chart itself keeps only the % line's own datalabel, which sits just above its
    // point — a small top margin is enough headroom for that.
    layout: { padding: { top: 20 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom', labels: {
          color: C.textSec, font: { size: 11 }, boxWidth: 12, padding: 12,
        },
      },
      datalabels: { display: false },  // datalabels plugin is registered globally — keep it off here
      tooltip: {
        callbacks: {
          label: ctx => {
            if (ctx.dataset.label === 'Target 90%') return null;
            if (ctx.dataset.label.includes('%')) return `${ctx.dataset.label}: ${ctx.parsed.y}%`;
            return `${ctx.dataset.label}: ${ctx.parsed.y}`;
          },
          // Spells out the denominator behind Complete % — the three stacked bars already
          // sum to it, but making someone add them up by eye is not "easy to understand".
          footer: items => {
            const r = monthlyStatus[items[0]?.dataIndex];
            if (!r) return '';
            const total = (r.complete || 0) + (r.pending || 0);
            return `Total (workable): ${total.toLocaleString()}`;
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
        min: 0,
        // Without an explicit max, Chart.js auto-scales this axis to the tallest bar alone
        // (e.g. a 4,000 gridline against a ~3,700 bar), which lands that bar at ~92% of the
        // chart height — ABOVE the 90% target line, which sits at 90/115 ≈ 78% up the RIGHT
        // axis (that axis's own headroom is below). The two axes don't share a scale, so
        // "90%" on one and "92% of this axis's own max" on the other are different screen
        // heights. `yMax` (computed below from the same data, by the same 115/90 ratio)
        // keeps the tallest bar at or below wherever the target line actually sits.
        max: yMax,
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

  // ── Innovator Complete per Month (gross signings, never negative) ──────────────
  // Reads `data.monthlyInnovatorSigned` — a direct per-calendar-month COUNT of
  // sheets whose baseline (saved-tool) criterion was met AND fully signed, bucketed
  // by the month they were actually SIGNED, computed on the backend from
  // `stamped_full_at`. This replaced an earlier version that diffed `monthlyStatus`'s
  // cumulative cohort totals (this month's total minus last month's) — informative
  // for showing reversions, but it produced bars that went negative when more sheets
  // reverted to pending than newly completed, which read as "how is a COUNT negative?"
  // A direct count can't be negative: a sheet either was signed that month or it
  // wasn't, so a bar is always ≥ 0. Windowed to the FYE like the other monthly
  // charts; a month with no signings defaults to 0 rather than being omitted.
  // Carries every part type's own count per month (not just the whole-FY `count`),
  // same shape as `monthlyNewParts` above — so the chart below can stack by part
  // type and colour each segment the same way "New SDS Reqs per Month" does,
  // instead of collapsing to one flat green bar.
  const innovatorMonthly = useMemo(() => {
    const raw = Object.fromEntries((data?.monthlyInnovatorSigned || []).map(r => [r.month, r]));
    return fyMonths(fyeWin).map(key => {
      const row = raw[key];
      const out = { month: key, count: row?.count || 0 };
      activePartTypes.forEach(t => { out[t] = row?.byPartType?.[t] || 0; });
      return out;
    });
  }, [data, fyeWin, activePartTypes]);

  // One stacked dataset per part type, coloured and faded exactly like
  // `newPartsChartData` — a selected part-type card zeroes out the other segments
  // (collapsing the stack to one solid bar) instead of just dimming them.
  const innovatorMonthlyChartData = useMemo(() => {
    const curMonth = new Date().toISOString().slice(0, 7);
    return {
      labels: innovatorMonthly.map(r => fmtMonth(r.month)),
      datasets: activePartTypes.map(t => {
        const color = PART_TYPE_COLOR[t] || C.cyan;
        const hidden = !!filterPt && t !== filterPt;
        return {
          label: partTypeLabel(t),
          data: innovatorMonthly.map(r => hidden ? 0 : (r[t] || 0)),
          backgroundColor: innovatorMonthly.map(r => hexToRgba(color,
            (filterMonth && r.month !== filterMonth) ? 0.25 : (r.month === curMonth ? 0.4 : 0.75))),
          borderColor: color, borderWidth: 1, stack: 'innovator',
        };
      }),
    };
  }, [innovatorMonthly, activePartTypes, filterMonth, filterPt]);

  const innovatorMonthlyChartOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    onClick: (evt, _els, chart) => {
      const row = innovatorMonthly[columnIndexAt(evt, chart)];
      if (row?.month) pickMonth(row.month);
    },
    onHover: (evt, _els, chart) => {
      const row = innovatorMonthly[columnIndexAt(evt, chart)];
      chart.canvas.style.cursor = row?.month ? 'pointer' : 'default';
    },
    plugins: {
      legend: { position: 'bottom', labels: { color: C.textSec, font: { size: 11 }, boxWidth: 12, padding: 12 } },
      tooltip: { mode: 'index', intersect: false },
      // One total label per bar, shown on the topmost stacked segment only — same
      // pattern as `newPartsChartOpts` below.
      datalabels: {
        display: (ctx) => {
          const row = innovatorMonthly[ctx.dataIndex];
          const total = filterPt ? (row?.[filterPt] || 0)
            : ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
          return ctx.datasetIndex === ctx.chart.data.datasets.length - 1 && total > 0;
        },
        formatter: (v, ctx) => {
          const row = innovatorMonthly[ctx.dataIndex];
          const total = filterPt ? (row?.[filterPt] || 0)
            : ctx.chart.data.datasets.reduce((s, ds) => s + (ds.data[ctx.dataIndex] || 0), 0);
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
      y: {
        stacked: true,
        ticks: { color: C.textSec, font: { size: 10 } },
        grid: { color: C.gridLine },
        title: { display: true, text: 'CNs completed (Innovator)', color: C.textSec, font: { size: 10 } },
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
    // COMPLETE/PENDING are always listed (even when the current list is one or the
    // other already, e.g. the default "CNs Requiring Action" is pending-only) so the
    // dropdown always has a label to show — the Complete/Pending/%Complete cards set
    // this same filterReason value on click, and with no matching option the Select
    // falls back to printing the raw "COMPLETE"/"PENDING" string instead of a label.
    return [{ value: '', label: 'All Reasons' },
      { value: 'COMPLETE', label: 'Complete (PDF ready)' },
      { value: 'PENDING', label: 'Pending (all reasons)' },
      ...reasons.map(r => ({ value: r, label: REASON_LABELS[r] || r })),
      ...(hasLimitAnomaly ? [{ value: 'LIMIT_ANOMALY', label: 'Limit Anomaly' }] : [])];
  }, [listRows]);

  const filteredAttention = useMemo(() => {
    return listRows.filter(r => {
      if (filterPt && r.part_type !== filterPt) return false;
      if (filterMc && r.machine_type_name !== filterMc) return false;
      if (filterReason === 'LIMIT_ANOMALY') { if (!r.limit_excluded) return false; }
      else if (filterReason === 'COMPLETE') { if (r.coverage_level !== 'COMPLETE') return false; }
      else if (filterReason === 'PENDING') { if (r.coverage_level === 'COMPLETE') return false; }
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
                <Text style={{ color: C.textSec, fontSize: 12 }}>FYE</Text>
                <Select size="small" value={fye} onChange={v => { setFye(v); clearSelection(); }} style={{ width: 90 }}
                  options={fyeOptions.map(n => ({ label: `FYE${n}`, value: n }))} popupMatchSelectWidth={false} />
                <Text style={{ color: C.textSec, fontSize: 12 }}>Month</Text>
                <Select size="small" value={filterMonth} onChange={setFilterMonth} style={{ width: 130 }}
                  options={monthFilterOptions} popupMatchSelectWidth={false} />
                <Link to={MTC_PATHS.SDS_COMPLETENESS_TEST}>
                  <Button icon={<FileSearchOutlined />} size="small"
                    title="Worklist of pending sheets, with a one-click launch into the real SDS page (test page)"
                    style={{ background: C.card, borderColor: C.border, color: C.textPri }}>Worklist</Button>
                </Link>
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
                {/* Four columns across one row, all fixed 350px: New SDS Reqs per Month,
                    Innovator Complete per Month right after it (both monthly charts
                    together, moved up from the Charts Row below so that row isn't
                    half-empty), then the Total/Complete/%Complete stack and the
                    Ball/Race/Mecha/Sleeve stack. The KPI stack and part-type cards were
                    widened to span=16/8 (of 24) when they had the row to themselves;
                    narrowed back to 6/4 now that two charts share it. */}
                <Col span={7}>
                  <div style={{ ...cardStyle, height: 350, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                    {sectionTitle(
                      <Tooltip title="Counts new (CN × machine × process) combinations, not CNs — one CN first produced on two machines counts as 2, possibly in different months. A combo's month is when it was FIRST produced (since the report's since-date), not a monthly recount.">
                        <span style={{ cursor: 'help' }}>New SDS Reqs per Month</span>
                      </Tooltip>,
                      C
                    )}
                    <div style={{ flex: 1, minHeight: 0 }}>
                      {monthlyNewParts.length > 0
                        ? <Bar data={newPartsChartData} options={newPartsChartOpts} />
                        : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 100 }}>No data</div>
                      }
                    </div>
                  </div>
                </Col>
                <Col span={7}>
                  <div style={{ ...cardStyle, height: 350, display: 'flex', flexDirection: 'column' }}>
                    {sectionTitle(
                      <Tooltip title="How many sheets were fully SIGNED as Innovator-complete (baseline stamp) in that calendar month — a direct count, so it's never negative. If a signature is later revoked, that sheet drops out of its original month's count on the next rebuild (the bar can shrink over time), but no month's count is ever computed as a difference from another, so it never goes below zero.">
                        <span style={{ cursor: 'help' }}>Innovator Complete per Month</span>
                      </Tooltip>,
                      C
                    )}
                    <div style={{ flex: 1, minHeight: 0 }}>
                      {innovatorMonthly.length > 0
                        ? <Bar data={innovatorMonthlyChartData} options={innovatorMonthlyChartOpts} />
                        : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 100 }}>No data</div>
                      }
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ height: 350, display: 'flex', flexDirection: 'column', gap: 10, boxSizing: 'border-box' }}>
                    {/* TOTAL — same compact stat-tile shape as Complete/Pending/%Complete;
                        the Innovator/THAI detail it used to carry is already shown in the
                        Complete and %Complete breakdown cards below it. */}
                    <div style={{ ...cardStyle, borderTop: `3px solid ${dimColor(C.cyan, !!(filterPt || filterReason || filterMonth), C)}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, transition: 'border-color 0.15s' }}>
                      <MiniStatCard label="Total" value={scopedStats.total} color={C.cyan} C={C} bare
                        onClick={clearSelection}
                        dimmed={!!(filterPt || filterReason || filterMonth)} />
                      <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
                      <div style={{ flex: 1 }}>
                        <MiniStatCard label="Pending" value={scopedStats.pending} color={C.yellow} C={C} bare
                          onClick={() => pickReason('PENDING')} active={filterReason === 'PENDING'}
                          dimmed={!!filterReason && filterReason !== 'PENDING'} />
                      </div>
                    </div>
                    <div style={{ ...cardStyle, borderTop: `3px solid ${dimColor(C.green, !!filterReason && filterReason !== 'COMPLETE', C)}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, transition: 'border-color 0.15s' }}>
                      <MiniStatCard label="Complete" value={scopedStats.complete} color={C.green} C={C} bare
                        onClick={() => pickReason('COMPLETE')} active={filterReason === 'COMPLETE'}
                        dimmed={!!filterReason && filterReason !== 'COMPLETE'} />
                      <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
                      {/* `align="stretch"` so Innovator/THAI match Pending's full stretched
                          height instead of sitting at their own shorter natural size. */}
                      <Row gutter={[8, 8]} align="stretch" style={{ flex: 1 }}>
                        <Col span={12}>
                          <SubStatCard label="Innovator complete" value={scopedStats.completeSaved} color={C.green} C={C} bare />
                        </Col>
                        <Col span={12} style={{ borderLeft: `1px solid ${C.border}` }}>
                          {scopedStats.complete - scopedStats.completeSaved > 0 && (
                            <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
                              <div style={{ height: '100%' }}>
                                <SubStatCard label="THAI complete *" value={scopedStats.complete - scopedStats.completeSaved}
                                  color={C.greenSoft} C={C} bare />
                              </div>
                            </Tooltip>
                          )}
                        </Col>
                      </Row>
                    </div>
                    <div style={{ ...cardStyle, borderTop: `3px solid ${dimColor(scopedStats.completePct >= 90 ? C.green : C.red, !!filterReason && filterReason !== 'COMPLETE', C)}`, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, transition: 'border-color 0.15s' }}>
                      <MiniStatCard label="% Complete" value={scopedStats.completePct} suffix="%"
                        color={scopedStats.completePct >= 90 ? C.green : C.red} C={C} bare
                        onClick={() => pickReason('COMPLETE')} active={filterReason === 'COMPLETE'}
                        dimmed={!!filterReason && filterReason !== 'COMPLETE'} />
                      <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
                      <Row gutter={[8, 8]} align="stretch" style={{ flex: 1 }}>
                        <Col span={12}>
                          <SubStatCard label="Innovator %" value={scopedStats.completeSavedPct} suffix="%"
                            color={scopedStats.completeSavedPct >= 90 ? C.green : C.red} C={C} bare />
                        </Col>
                        <Col span={12} style={{ borderLeft: `1px solid ${C.border}` }}>
                          {scopedStats.completePct - scopedStats.completeSavedPct > 0 && (
                            <Tooltip title="THAI Complete — extra completes unlocked by the Tooling Select #1 ( * ) fallback">
                              <div style={{ height: '100%' }}>
                                <SubStatCard label="THAI % *" value={(scopedStats.completePct - scopedStats.completeSavedPct).toFixed(1)} suffix="%"
                                  color={C.greenSoft} C={C} bare />
                              </div>
                            </Tooltip>
                          )}
                        </Col>
                      </Row>
                    </div>
                  </div>
                </Col>
                <Col span={4}>
                  <div style={{ height: 350, display: 'flex', flexDirection: 'column', gap: 10, boxSizing: 'border-box' }}>
                    {cardPartTypes.map(pt => (
                      <div key={pt.part_type} style={{ flex: 1 }}>
                        <PartTypeCard
                          pt={pt} C={C}
                          onClick={() => pickPartType(pt.part_type)}
                          active={filterPt === pt.part_type}
                          dimmed={!!filterPt && filterPt !== pt.part_type}
                        />
                      </div>
                    ))}
                  </div>
                </Col>
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

            {/* ── Cumulative Coverage Status ──────────────────────────────────── */}
            {/* Innovator Complete per Month moved up into the Part Type Cards row above
                (far right), so this card now has the row to itself. */}
            <Row gutter={[14, 0]} style={{ marginBottom: 14 }}>
              <Col span={24}>
                <div style={{ ...cardStyle, height: 350, display: 'flex', flexDirection: 'column' }}>
                  {sectionTitle('Cumulative Coverage Status', C)}
                  <div style={{ flex: 1, minHeight: 0 }}>
                    <Bar ref={statusChartRef} data={statusChartData} options={statusChartOpts} plugins={[statusColsPlugin]} />
                  </div>
                </div>
                <div style={{ ...cardStyle, marginTop: 8, padding: '8px 16px', overflowX: 'auto' }}>
                  {(() => {
                    const cols = statusColLayout
                      ? `${statusColLayout.left}px repeat(${monthlyStatus.length}, ${statusColLayout.colW}px) ${statusColLayout.right}px`
                      : `60px repeat(${monthlyStatus.length}, 1fr)`;
                    const cellStyle = { border: `1px solid ${C.border}`, padding: '3px 4px', boxSizing: 'border-box' };
                    return (
                      <>
                        {/* Header row — month labels, same text as the chart's own x-axis. */}
                        <div style={{ display: 'grid', gridTemplateColumns: cols }}>
                          <div style={cellStyle} />
                          {monthlyStatus.map((r, i) => (
                            <div key={i} style={{ ...cellStyle, textAlign: 'center', fontSize: 10, fontWeight: 700, color: C.textSec }}>
                              {r.isPrevLast ? r.prevLabel : fmtMonth(r.month)}
                            </div>
                          ))}
                          <div style={cellStyle} />
                        </div>
                        {statusMonthlyRows.map(row => (
                          <div key={row.key} style={{ display: 'grid', gridTemplateColumns: cols }}>
                            <div style={{ ...cellStyle, fontSize: 10, fontWeight: 700, color: C.textSec }}>{row.label}</div>
                            {monthlyStatus.map((r, i) => (
                              <div
                                key={i}
                                style={{
                                  ...cellStyle, textAlign: 'center', fontSize: 11,
                                  color: row.color ? row.color(r, i) : C.textPri,
                                  fontWeight: row.bold ? 800 : 600,
                                }}
                              >
                                {row.format(r, i)}
                              </div>
                            ))}
                            <div style={cellStyle} />
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </Col>
            </Row>

            {/* ── Limit-softening worklist ────────────────────────────────────── */}
            {/* (machine, process) pairs where a part over the T-Select design work-size
                limit is treated as usable because the factory floor has genuinely run it
                there. Each line is a tooling_machine_limit bound to measure against the
                plan and fix surgically — the standard is what needs revising, not the run. */}
            {(data?.kpi?.limitSoftenedByMachine?.length > 0) && (
              showLimitSoftening ? (
                <div style={{ ...cardStyle, marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    {sectionTitle('Limit Softening — surgical-fix worklist', C)}
                    <Text style={{ color: C.textSec, fontSize: 11 }}>
                      {(data?.kpi?.limitSoftened ?? 0).toLocaleString()} sheet(s) across{' '}
                      {data.kpi.limitSoftenedByMachine.length} (machine · process)
                    </Text>
                    <Button size="small" style={{ marginLeft: 'auto', background: C.card, borderColor: C.border, color: C.textPri }}
                      onClick={() => setShowLimitSoftening(false)}>Hide</Button>
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
              ) : (
                <div style={{ marginBottom: 14 }}>
                  <Button icon={<WarningOutlined />} onClick={() => setShowLimitSoftening(true)} size="small"
                    style={{ background: C.card, borderColor: C.border, color: C.textPri }}>
                    Limit Softening — {(data?.kpi?.limitSoftened ?? 0).toLocaleString()} sheet(s) across {data.kpi.limitSoftenedByMachine.length} (machine · process)
                  </Button>
                </div>
              )
            )}

            {/* ── Needs Attention Table ───────────────────────────────────────── */}
            <div style={cardStyle} ref={attentionRef}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {sectionTitle(filterMonth ? `All sheets first produced ${fmtMonth(filterMonth)}` : 'CNs Requiring Action', C)}
                <Space>
                  {monthListPartial && (
                    <Tooltip title={monthRowsBuilding
                      ? 'The server is rebuilding the report to add this month\'s full list (a few minutes). Showing only the sheets that still need action until then; this updates by itself.'
                      : 'The full list for this month is not available from the server. Showing only the sheets that still need action.'}>
                      <Tag color="warning" style={{ margin: 0 }}>{monthRowsBuilding ? 'Pending only — building full list…' : 'Pending only'}</Tag>
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
