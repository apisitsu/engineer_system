import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Select, Spin, Typography, Row, Col, Table, Tag, Space, Button, App, Tooltip } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import ReportScopeModal from './ReportScopeModal';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ChartTitle, ChartTooltip, Legend);

const { Content } = Layout;
const { Text } = Typography;

const C = {
  bg:       '#041320',
  card:     '#072035',
  border:   '#0e3a5c',
  blue:     '#1890ff',
  cyan:     '#00d4ff',
  green:    '#52c41a',
  greenSoft:'#95de64',   // THAI Complete (T-Select #1 boost) — softer than the KZW green
  red:      '#ff4d4f',
  yellow:   '#ffc53d',
  orange:   '#fa8c16',
  purple:   '#722ed1',
  textPri:  '#e8f4ff',
  textSec:  '#6fa3c7',
  gridLine: 'rgba(14,58,92,0.8)',
};

const PART_TYPE_COLOR = {
  ball:      '#1890ff',
  race:      '#52c41a',
  body:      '#fa8c16',
  sleeve:    '#722ed1',
  spherical: '#ff4d4f',
  mecha:     '#eb2f96',
  other:     '#6fa3c7',
};

const LEVEL_CFG = {
  COMPLETE:     { color: C.green,  label: 'Complete',     icon: <CheckCircleOutlined />, antd: 'success', desc: 'Tool match + Excel Config ✅ → PDF ready' },
  PENDING: { color: C.yellow, label: 'Pending', icon: <ClockCircleOutlined />, antd: 'warning', desc: 'Tool does not match sds_machine_tool or machine has no Excel Parameter Config yet' },
};

const cardStyle = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px',
};

// Tooltip body for the orange gap tags: top 2 (machine / process) with the largest
// gap (lowest coverage) — i.e. configure these first to gain the most completes.
const gapTooltip = (gaps, heading) => {
  const list = (gaps || []).slice(0, 2);
  if (!list.length) return heading;
  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{heading}</div>
      {list.map((g, i) => (
        <div key={i} style={{ whiteSpace: 'nowrap' }}>
          {i + 1}. {g.machine} / {g.process} — <b>{g.count.toLocaleString()}</b>
        </div>
      ))}
    </div>
  );
};

const sectionTitle = (label) => (
  <div style={{
    color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
    textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
    paddingBottom: 6, marginBottom: 12,
  }}>
    {label}
  </div>
);

// ── Part Type Card ─────────────────────────────────────────────────────────────
const PartTypeCard = ({ pt }) => {
  const color = PART_TYPE_COLOR[pt.part_type] || C.cyan;
  const pct = pt.complete_pct || 0;                       // with T-Select #1
  const pctSaved = pt.complete_saved_pct ?? pct;          // baseline (saved only)
  const boost = Math.max(0, (pt.complete || 0) - (pt.complete_saved ?? pt.complete ?? 0));
  
  // Custom label mapping: 'body' or 'mecha' -> 'Mecha'
  const typeKey = pt.part_type.toLowerCase();
  const displayLabel = (typeKey === 'body' || typeKey === 'mecha') 
    ? 'Mecha' 
    : (pt.part_type.charAt(0).toUpperCase() + pt.part_type.slice(1));

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
      <Text style={{ color: C.textSec, fontSize: 10 }}>PDF Ready</Text>
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
            <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: '#237804', background: 'rgba(149,222,100,0.18)', borderColor: C.greenSoft }}>+{boost.toLocaleString()} THAI *</Tag>
          </Tooltip>
        )}
        <Tooltip title={gapTooltip(pt.gaps?.noToolMatch, 'Config tooling here → +complete')}>
          <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help' }}>{Math.max(0, (pt.total ?? 0) - (pt.tool_match ?? 0)).toLocaleString()} no tool match</Tag>
        </Tooltip>
        <Tooltip title={gapTooltip(pt.gaps?.noExcelConfig, 'Add Excel config here → +complete')}>
          <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help' }}>{Math.max(0, (pt.total ?? 0) - (pt.excel_config ?? 0)).toLocaleString()} no excel config</Tag>
        </Tooltip>
      </div>
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export default function SdsCoverageDashboard() {
  const { message } = App.useApp();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
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

  const byPartType = useMemo(() => {
    const raw = data?.byPartType || [];
    const order = ['ball', 'race', 'mecha', 'body', 'sleeve', 'spherical'];
    return [...raw].sort((a, b) => {
      const ia = order.indexOf(a.part_type.toLowerCase());
      const ib = order.indexOf(b.part_type.toLowerCase());
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [data]);


  const fmtMonth = m => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleString('en', { month: 'short' }) + ' ' + y.slice(2);
  };

  // ── Monthly New Parts chart ───────────────────────────────────────────────────
  const monthlyNewParts = useMemo(() => {
    const raw = Object.fromEntries(
      (data?.monthlyNewParts || [])
        .filter(r => r.month >= '2026-04' && r.month <= '2027-03')
        .map(r => [r.month, r])
    );
    const months = [];
    let d = new Date('2026-04-01');
    while (d <= new Date('2027-03-01')) {
      const key = d.toISOString().slice(0, 7);
      months.push(raw[key] || { month: key, ball: 0, race: 0, mecha: 0 });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [data]);
  const newPartsChartData = useMemo(() => ({
    labels: monthlyNewParts.map(r => fmtMonth(r.month)),
    datasets: [
      { label: 'Ball',  data: monthlyNewParts.map(r => r.ball  || 0), backgroundColor: 'rgba(24,144,255,0.75)', borderColor: PART_TYPE_COLOR.ball,  borderWidth: 1, stack: 'np' },
      { label: 'Race',  data: monthlyNewParts.map(r => r.race  || 0), backgroundColor: 'rgba(82,196,26,0.75)',  borderColor: PART_TYPE_COLOR.race,  borderWidth: 1, stack: 'np' },
      { label: 'Mecha', data: monthlyNewParts.map(r => r.mecha || 0), backgroundColor: 'rgba(235,47,150,0.65)', borderColor: PART_TYPE_COLOR.mecha, borderWidth: 1, stack: 'np' },
    ],
  }), [monthlyNewParts]);
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
    const raw = Object.fromEntries(
      (data?.monthlyStatus || [])
        .filter(r => r.month >= '2026-04' && r.month <= '2027-03')
        .map(r => [r.month, r])
    );
    const months = [];
    let d = new Date('2026-04-01');
    while (d <= new Date('2027-03-01')) {
      const key = d.toISOString().slice(0, 7);
      months.push(raw[key] || { month: key, complete: 0, pending: 0, complete_pct: 0 });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  }, [data]);

  const statusChartData = useMemo(() => ({
    labels: monthlyStatus.map(r => fmtMonth(r.month)),
    datasets: [
      {
        type: 'bar',
        label: 'KZW Complete',
        data: monthlyStatus.map(r => r.complete_saved ?? r.complete),
        backgroundColor: 'rgba(82,196,26,0.75)',
        borderColor: C.green,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'THAI Complete *',
        data: monthlyStatus.map(r => Math.max(0, (r.complete || 0) - (r.complete_saved ?? r.complete ?? 0))),
        backgroundColor: 'rgba(149,222,100,0.70)',
        borderColor: C.greenSoft,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'bar',
        label: 'Pending',
        data: monthlyStatus.map(r => r.pending),
        backgroundColor: 'rgba(255,197,61,0.65)',
        borderColor: C.yellow,
        borderWidth: 1,
        stack: 'status',
        yAxisID: 'y',
      },
      {
        type: 'line',
        label: 'Complete % (KZW+THAI)',
        data: monthlyStatus.map(r => r.complete_pct),
        borderColor: C.cyan,
        backgroundColor: 'rgba(0,212,255,0.15)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: C.cyan,
        tension: 0.3,
        yAxisID: 'y1',
      },
      {
        type: 'line',
        label: 'KZW Complete %',
        data: monthlyStatus.map(r => r.complete_saved_pct ?? r.complete_pct),
        borderColor: C.green,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.3,
        yAxisID: 'y1',
      },
      {
        type: 'line',
        label: 'Target 90%',
        data: monthlyStatus.map(() => 90),
        borderColor: 'rgba(255,77,79,0.85)',
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
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: C.textSec, font: { size: 11 } } },
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
        min: 0, max: 100,
        ticks: { color: C.cyan, font: { size: 10 }, callback: v => `${v}%` },
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Complete %', color: C.cyan, font: { size: 10 } },
      },
    },
  };

  // ── Needs attention table ─────────────────────────────────────────────────────
  const machineOptions = useMemo(() => {
    const names = [...new Set((data?.needsAttention || []).map(r => r.machine_type_name).filter(Boolean))].sort();
    return [{ value: '', label: 'All Machines' }, ...names.map(n => ({ value: n, label: n }))];
  }, [data]);

  const filteredAttention = useMemo(() => {
    const rows = data?.needsAttention || [];
    return rows.filter(r => {
      if (filterPt && r.part_type !== filterPt) return false;
      if (filterMc && r.machine_type_name !== filterMc) return false;
      if (filterReason && r.pending_reason !== filterReason) return false;
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
                          <Tag style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help', color: '#237804', background: 'rgba(149,222,100,0.18)', borderColor: C.greenSoft }}>+{Math.max(0, (data?.kpi?.complete ?? 0) - (data?.kpi?.completeSaved ?? data?.kpi?.complete ?? 0)).toLocaleString()} THAI *</Tag>
                        </Tooltip>
                      )}
                      <Tooltip title={gapTooltip(data?.kpi?.gaps?.noToolMatch, 'Config tooling here → +complete')}>
                        <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help' }}>{Math.max(0, (data?.kpi?.total ?? 0) - (data?.kpi?.toolMatch ?? 0)).toLocaleString()} no tool match</Tag>
                      </Tooltip>
                      <Tooltip title={gapTooltip(data?.kpi?.gaps?.noExcelConfig, 'Add Excel config here → +complete')}>
                        <Tag color="orange" style={{ fontSize: 10, margin: 0, padding: '0 4px', cursor: 'help' }}>{Math.max(0, (data?.kpi?.total ?? 0) - (data?.kpi?.excelConfig ?? 0)).toLocaleString()} no excel config</Tag>
                      </Tooltip>
                    </div>
                  </div>
                </Col>
                {byPartType.map(pt => (
                  <Col key={pt.part_type} span={4}>
                    <PartTypeCard pt={pt} />
                  </Col>
                ))}
              </Row>
            )}

            {/* ── Charts Row (New Parts + Cumulative Status) ─────────────────── */}
            <Row gutter={[14, 0]} style={{ marginBottom: 14 }}>
              <Col span={8}>
                <div style={{ ...cardStyle, height: '100%' }}>
                  {sectionTitle('New Parts per Month')}
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
                  {sectionTitle('Cumulative Coverage Status')}
                  <div style={{ height: 240 }}>
                    <Bar data={statusChartData} options={statusChartOpts} />
                  </div>
                </div>
              </Col>
            </Row>

            {/* ── Needs Attention Table ───────────────────────────────────────── */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {sectionTitle('CNs Requiring Action')}
                <Space>
                  <Select size="small" value={filterPt} onChange={setFilterPt} style={{ width: 130 }}
                    options={[
                      { value: '', label: 'All Part Types' },
                      ...byPartType.map(pt => ({
                        value: pt.part_type,
                        label: pt.part_type.charAt(0).toUpperCase() + pt.part_type.slice(1),
                      })),
                    ]} popupMatchSelectWidth={false} />
                  <Select size="small" value={filterMc} onChange={setFilterMc} style={{ width: 160 }}
                    options={machineOptions} popupMatchSelectWidth={false} showSearch
                    filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                  <Select size="small" value={filterReason} onChange={setFilterReason} style={{ width: 190 }}
                    options={[
                      { value: '', label: 'All Reasons' },
                      { value: 'NO_EXCEL', label: 'Tool ✓ — needs Excel config' },
                      { value: 'NO_TOOL', label: 'No tool match' },
                      { value: 'NO_TOOL_NO_EXCEL', label: 'No tool + no Excel config' },
                    ]} popupMatchSelectWidth={false} />
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
                rowClassName={() => 'sds-report-row'}
              />
            </div>

          </Spin>
        </Content>
      </Layout>

      <style>{`
        .sds-report-row td { background: ${C.bg} !important; color: ${C.textPri}; }
        .sds-report-row:hover td { background: ${C.card} !important; }
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
