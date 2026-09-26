import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Select, Spin, Typography, Row, Col, Tooltip, Table, Tag } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import axios from 'axios';
import moment from 'moment';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title as ChartTitle,
    Tooltip as ChartTooltip,
    Legend,
    Filler
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    ArcElement, CategoryScale, LinearScale, BarElement,
    PointElement, LineElement, ChartTitle, ChartTooltip, Legend, Filler
);

const { Content } = Layout;
const { Text } = Typography;
const { Option } = Select;

// ── Palette ─────────────────────────────────────────────────────────────────
// Chrome (bg / card / border / text) follows the app theme. The DATA colours cannot
// be one set: the theme ships 8 light surfaces and 1 dark one (rpg), and these hues
// were picked against the old #041320 ground. Measured contrast vs #FFFFFF for the
// dark set — cyan 1.77, yellow 1.58, green 2.27, orange 2.38 — is below the 3:1 floor,
// so on a light theme they would be all but invisible. Each set is stated for the
// surface it is read on, and the theme's own lightness picks between them.
//
// Hue IDENTITY is preserved across the pair: green still means On Time, red Delay,
// yellow Accept, orange Reject. These are status encodings, not decoration.
const SERIES_DARK = {
    blue: '#1890ff', cyan: '#00d4ff', green: '#52c41a',
    red: '#ff4d4f', yellow: '#ffc53d', orange: '#fa8c16',
    purple: '#9254de',   // #722ed1 measures 2.51 on the rpg ground — the one dark-set failure
};
const SERIES_LIGHT = {
    blue: '#0958d9', cyan: '#08979c', green: '#389e0d',
    red: '#cf1322', yellow: '#ad6800', orange: '#d4380d',
    purple: '#531dab',
};

const hexToRgba = (hex, a) => {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(111,163,199,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Classify by the theme's own background rather than by theme name, so a theme added
// later lands in the right set without an edit here.
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
            // Grid lines stay recessive on either ground by borrowing the theme's border.
            gridLine: hexToRgba(c.border || '#0e3a5c', dark ? 0.8 : 0.55),
            // Empty-donut ring: a flat neutral that reads as "no data" on either surface.
            empty: dark ? '#1a3a5c' : (c.surfaceHover || '#e6e6e6'),
            isDark: dark,
        };
    }, [theme]);
};

// FYE month order: Apr(4)…Dec(12), Jan(1)…Mar(3)
const FYE_MONTH_LABELS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
const FYE_MONTH_NUMS   = [4,5,6,7,8,9,10,11,12,1,2,3];
const MONTH_LABELS_ALL = ['All','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const calcCurrentFye = () => {
    const m = moment().month() + 1;
    const y = moment().year();
    return m >= 4 ? y - 1999 : y - 2000;
};

const cardStyleOf = (C) => ({
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '14px 18px',
});

const sectionTitle = (label, C) => (
    <div style={{ color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
                  textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
                  paddingBottom: 6, marginBottom: 12 }}>
        {label}
    </div>
);

// ── KPI Card ────────────────────────────────────────────────────────────────
// `onClick` makes the card a toggle filter (On Time / Delay / Accept / Reject); `active`
// outlines it in its own colour and `dimmed` fades it when a sibling group is selected.
const KpiCard = ({ label, value, color, sub, C, onClick, active, dimmed }) => {
    const clickable = typeof onClick === 'function';
    return (
        <div
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? !!active : undefined}
            onClick={onClick}
            onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
            style={{
                ...cardStyleOf(C), textAlign: 'center', borderTop: `3px solid ${color}`,
                cursor: clickable ? 'pointer' : 'default',
                boxShadow: active ? `0 0 0 2px ${color}` : 'none',
                opacity: dimmed ? 0.55 : 1,
                transition: 'box-shadow 0.15s, opacity 0.15s',
            }}>
            <div style={{ color: C.textSec, fontSize: 11, textTransform: 'uppercase',
                          letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                {value?.toLocaleString() ?? '-'}
            </div>
            {sub && <div style={{ color: C.textSec, fontSize: 11, marginTop: 2 }}>{sub}</div>}
        </div>
    );
};

// ── Donut with center label ─────────────────────────────────────────────────
const DonutChart = ({ data, colors, centerLabel, centerSub, size = 140, C }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    const chartData = {
        labels: data.map(d => d.name),
        datasets: [{
            data: total > 0 ? data.map(d => d.value) : [1],
            backgroundColor: total > 0 ? colors : [C.empty],
            borderColor: C.card,
            borderWidth: 3,
            hoverOffset: 6,
        }]
    };
    const options = {
        cutout: '68%',
        plugins: {
            legend: { display: false },
            tooltip: { enabled: total > 0 },
            datalabels: { display: false }
        },
        animation: { duration: 600 }
    };

    return (
        <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
            <Doughnut data={chartData} options={options} />
            <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none'
            }}>
                <div style={{ color: C.textPri, fontSize: size < 120 ? 14 : 20, fontWeight: 800 }}>{centerLabel}</div>
                {centerSub && <div style={{ color: C.textSec, fontSize: 10 }}>{centerSub}</div>}
            </div>
        </div>
    );
};


// ── Main Component ───────────────────────────────────────────────────────────
export default function InspectionResultDashboard() {
    // Every `C.*` below now reads the active theme; the series half flips with its lightness.
    const C = useColors();
    const cardStyle = cardStyleOf(C);
    const [fye,        setFye]        = useState(calcCurrentFye());
    const [month,      setMonth]      = useState(0);
    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(false);
    const [fyeOptions, setFyeOptions] = useState([]);

    // Fetch available FYEs that have data
    useEffect(() => {
        axios.get(server.TOOLING_AVAILABLE_FYE)
            .then(res => {
                const list = res.data || [];
                setFyeOptions(list);
                if (list.length > 0 && !list.includes(calcCurrentFye())) setFye(list[0]);
            })
            .catch(() => {});
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const monthOptions = [
        { label: 'All Months', value: 0 },
        ...FYE_MONTH_NUMS.map((num, i) => ({ label: FYE_MONTH_LABELS[i], value: num }))
    ];

    // Drill-down selection from the KPI cards and the Root Cause chart. Month lives in
    // `month` above (bar click and the dropdown share it). Each of these is a toggle: the
    // same click again clears it. They narrow the detail panels only — see the backend.
    const [statusSel,    setStatusSel]    = useState('');   // 'On time' | 'Delay'
    const [judgementSel, setJudgementSel] = useState('');   // 'Accept' | 'Reject'
    const [reasonSel,    setReasonSel]    = useState('');   // a delay root cause

    const toggleStatus = (s) => {
        setStatusSel(cur => (cur === s ? '' : s));
        // A root cause only exists on Delay rows; leaving Delay makes it meaningless.
        if (s !== 'Delay') setReasonSel('');
    };
    const toggleJudgement = (j) => setJudgementSel(cur => (cur === j ? '' : j));
    const toggleReason = (r) => {
        if (reasonSel === r) { setReasonSel(''); return; }
        setReasonSel(r);
        setStatusSel('Delay');   // the pie counts Delay rows only — keep the table consistent with it
    };
    const clearSelection = () => { setStatusSel(''); setJudgementSel(''); setReasonSel(''); };

    const fetchData = useCallback(async (f, m, st, jd, rs) => {
        setLoading(true);
        try {
            const params = { fye: f };
            if (m)  params.month = m;
            if (st) params.status = st;
            if (jd) params.judgement = jd;
            if (rs) params.reason = rs;
            const res = await axios.get(server.TOOLING_RESULT_DASHBOARD, { params });
            setData(res.data);
        } catch (e) {
            console.error('Result Dashboard Error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(fye, month || null, statusSel, judgementSel, reasonSel);
    }, [fye, month, statusSel, judgementSel, reasonSel, fetchData]);

    // The root-cause list follows the month, so a cause selected in one month may not
    // exist in the next — drop it rather than leave the records table silently empty.
    useEffect(() => {
        if (reasonSel && data && !(data.delayCauses || []).some(d => d.reason === reasonSel)) setReasonSel('');
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Build monthly trend chart ──────────────────────────────────────────
    const buildMonthlyChart = () => {
        const byMonth = {};
        (data?.monthlyTrend || []).forEach(r => {
            const m = parseInt(r.month?.split('-')[1], 10);
            if (m) byMonth[m] = r;
        });
        const ontimePctData = FYE_MONTH_NUMS.map(num => {
            const row = byMonth[num];
            if (!row) return null;
            const total = (row.onTime || 0) + (row.delay || 0);
            return total > 0 ? parseFloat(((row.onTime / total) * 100).toFixed(1)) : null;
        });

        // Prepend a baseline bar = the previous FYE's monthly average (a muted-colour
        // reference at index 0, before Apr). null when there is no prior-year data.
        const prev = data?.prevFyeAvg;
        const avgLabel = prev ? `FYE${prev.fye} avg` : 'Prev avg';
        const labels = [avgLabel, ...FYE_MONTH_LABELS];
        const lead = (arr, val) => [val, ...arr];
        // With a month selected, every other month's bar fades so the chosen one reads.
        const monthAlpha = (num) => (month && num !== month ? 0.25 : 0.7);

        return {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'On Time',
                    data: lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.onTime ?? 0), prev?.onTime ?? null),
                    // muted green for the avg baseline bar, normal green for the FYE months
                    backgroundColor: lead(FYE_MONTH_NUMS.map(num => hexToRgba(C.green, monthAlpha(num))), hexToRgba(C.green, 0.3)),
                    borderColor: C.green,
                    borderWidth: 1,
                    stack: 'monthly',
                    yAxisID: 'yLeft',
                    order: 2,
                },
                {
                    type: 'bar',
                    label: 'Delay',
                    data: lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.delay ?? 0), prev?.delay ?? null),
                    backgroundColor: lead(FYE_MONTH_NUMS.map(num => hexToRgba(C.red, monthAlpha(num))), hexToRgba(C.red, 0.3)),
                    borderColor: C.red,
                    borderWidth: 1,
                    stack: 'monthly',
                    yAxisID: 'yLeft',
                    order: 2,
                },
                {
                    type: 'line',
                    label: '% On Time',
                    data: lead(ontimePctData, prev?.onTimePct ?? null),
                    borderColor: C.yellow,
                    backgroundColor: hexToRgba(C.yellow, 0.15),
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 2,
                    yAxisID: 'yRight',
                    order: 1,
                    spanGaps: true,
                    datalabels: {
                        display: true,
                        color: C.green,
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: { size: 10, weight: 700 },
                        formatter: (v) => (v === null ? '' : `${v}%`),
                    },
                },
                {
                    type: 'line',
                    label: 'Target 90%',
                    data: labels.map(() => 90),
                    borderColor: hexToRgba(C.red, 0.85),
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'yRight',
                    order: 0,
                }
            ]
        };
    };

    const monthlyChartOpts = {
        responsive: true,
        maintainAspectRatio: false,
        // Legend at the BOTTOM so the 'top'-aligned % On Time datalabels on the near-100%
        // line never collide with it; top padding + axis headroom keep the 100% label visible.
        layout: { padding: { top: 24 } },
        // Click anywhere in a month's column (not just on the bar) to filter the page to
        // that month; click it again to go back to the full FYE. Index 0 is the previous-
        // FYE average baseline, which is not a month, so it does nothing.
        onClick: (evt, _els, chart) => {
            const hit = chart.getElementsAtEventForMode(evt, 'index', { intersect: false }, true);
            if (!hit.length || hit[0].index === 0) return;
            const num = FYE_MONTH_NUMS[hit[0].index - 1];
            setMonth(cur => (cur === num ? 0 : num));
        },
        onHover: (evt, _els, chart) => {
            const hit = chart.getElementsAtEventForMode(evt, 'index', { intersect: false }, true);
            chart.canvas.style.cursor = hit.length && hit[0].index !== 0 ? 'pointer' : 'default';
        },
        plugins: {
            legend: { position: 'bottom', labels: { color: C.textPri, font: { size: 11 }, boxWidth: 12, padding: 12 } },
            datalabels: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.raw;
                        if (val === null) return null;
                        return ctx.dataset.label === '% On Time'
                            ? ` ${ctx.dataset.label}: ${val}%`
                            : ` ${ctx.dataset.label}: ${val}`;
                    }
                }
            }
        },
        scales: {
            x: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            yLeft: {
                type: 'linear',
                position: 'left',
                stacked: true,
                ticks: { color: C.textSec, font: { size: 10 } },
                grid: { color: C.gridLine }
            },
            yRight: {
                type: 'linear',
                position: 'right',
                min: 0,
                // Headroom above 100 so a 100% point sits below the top edge and its
                // 'top'-aligned datalabel stays inside the canvas; ticks over 100 hidden.
                max: 115,
                ticks: {
                    color: C.yellow,
                    font: { size: 10 },
                    stepSize: 20,
                    callback: (v) => (v > 100 ? '' : `${v}%`)
                },
                grid: { drawOnChartArea: false }
            }
        }
    };

    // ── WC Bar chart ─────────────────────────────────────────────────────────
    const wcData = data?.wcBreakdown || [];
    const wcChartData = {
        labels: wcData.map(d => d.wc || '-'),
        datasets: [{
            label: 'Items',
            data: wcData.map(d => d.count),
            backgroundColor: wcData.map((_, i) =>
                `hsl(${200 + i * 18}, 70%, 55%)`
            ),
            borderRadius: 3,
        }]
    };
    const wcChartOpts = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {}, datalabels: { display: false } },
        scales: {
            x: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            y: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } }
        }
    };

    // ── Daily received line chart ────────────────────────────────────────────
    const dailyArr = data?.dailyData || [];
    const dailyChartData = {
        labels: dailyArr.map(d => d.day),
        datasets: [
            {
                label: 'Received (pcs)',
                data: dailyArr.map(d => d.received),
                borderColor: C.cyan,
                backgroundColor: hexToRgba(C.cyan, 0.1),
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                borderWidth: 1.5,
            }
        ]
    };
    const dailyChartOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false },
            datalabels: { display: false }
        },
        scales: {
            x: {
                ticks: { color: C.textSec, font: { size: 9 }, maxRotation: 60 },
                grid: { color: C.gridLine }
            },
            y: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } }
        }
    };

    // ── Delay cause pie ──────────────────────────────────────────────────────
    const delayArr = data?.delayCauses || [];
    const delayCauseColors = [C.red, C.orange, C.yellow, C.purple, C.cyan];
    // Selected cause keeps its colour, the rest fade (colours cycle past the 5th cause).
    const delayCauseColor = (i) => delayCauseColors[i % delayCauseColors.length];
    const delayChartData = {
        labels: delayArr.map(d => d.reason),
        datasets: [{
            data: delayArr.length ? delayArr.map(d => d.count) : [1],
            backgroundColor: delayArr.length
                ? delayArr.map((d, i) => (reasonSel && d.reason !== reasonSel ? hexToRgba(delayCauseColor(i), 0.25) : delayCauseColor(i)))
                : [C.empty],
            borderColor: C.card,
            borderWidth: 2,
        }]
    };
    const delayChartOpts = {
        onClick: (evt, _els, chart) => {
            const hit = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (hit.length && delayArr[hit[0].index]) toggleReason(delayArr[hit[0].index].reason);
        },
        onHover: (evt, _els, chart) => {
            const hit = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            chart.canvas.style.cursor = hit.length && delayArr.length ? 'pointer' : 'default';
        },
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: C.textSec, font: { size: 10 }, boxWidth: 12, padding: 8 }
            },
            tooltip: { enabled: delayArr.length > 0 },
            datalabels: { display: false }
        },
        animation: { duration: 600 }
    };

    const kpi = data?.kpi;
    const fyeStartYear = fye + 1999;
    const fyeEndYear   = fye + 2000;
    const periodLabel  = month
        ? `FYE${fye} — ${MONTH_LABELS_ALL[month]} ${month >= 4 ? fyeStartYear : fyeEndYear}`
        : `FYE${fye} (Apr ${fyeStartYear} – Mar ${fyeEndYear})`;

    return (
        <Layout style={{ height: '100%', background: C.bg }}>
            <MenuTemplate type="MTC" defaultSelectedKeys="tooling-result-dashboard" />
            <Layout style={{ background: C.bg }}>
                <Content className="kb-vscroll"
                    style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
                    <Spin spinning={loading} tip="Loading...">

                        {/* ── Header ─────────────────────────────────────────── */}
                        <div style={{
                            background: `linear-gradient(90deg, ${C.bg} 0%, ${C.card} 100%)`,
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: '10px 20px', marginBottom: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ color: C.cyan, fontWeight: 800, fontSize: 16,
                                              letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    Tooling Inspection Result Dashboard
                                    <SystemVersionBadge system="tooling-result-dashboard" dark={C.isDark} />
                                </div>
                                <div style={{ color: C.textSec, fontSize: 11 }}>{periodLabel}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <Text style={{ color: C.textSec, fontSize: 12 }}>FYE</Text>
                                <Select value={fye} onChange={v => { setFye(v); setMonth(0); clearSelection(); }}
                                    style={{ width: 100 }}
                                    popupClassName="dark-select"
                                    loading={fyeOptions.length === 0}>
                                    {fyeOptions.map(f => <Option key={f} value={f}>FYE{f}</Option>)}
                                </Select>
                                <Text style={{ color: C.textSec, fontSize: 12 }}>Month</Text>
                                <Select value={month} onChange={v => setMonth(v)}
                                    style={{ width: 130 }}
                                    popupClassName="dark-select">
                                    {monthOptions.map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
                                </Select>
                            </div>
                        </div>

                        {/* ── KPI Row ─────────────────────────────────────────── */}
                        <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
                            <Col flex="1"><KpiCard C={C} label="Total PO" value={kpi?.totalPO}  color={C.blue}   /></Col>
                            <Col flex="1"><KpiCard C={C} label="Total Tooling Qty" value={kpi?.totalQty} color={C.cyan}   /></Col>
                            <Col flex="1"><KpiCard C={C} label="On Time" value={kpi?.onTime}  color={C.green}
                                onClick={() => toggleStatus('On time')} active={statusSel === 'On time'} dimmed={!!statusSel && statusSel !== 'On time'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="Delay"   value={kpi?.delay}   color={C.red}
                                onClick={() => toggleStatus('Delay')}   active={statusSel === 'Delay'}   dimmed={!!statusSel && statusSel !== 'Delay'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="Accept"  value={kpi?.accept}  color={C.yellow}
                                onClick={() => toggleJudgement('Accept')} active={judgementSel === 'Accept'} dimmed={!!judgementSel && judgementSel !== 'Accept'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="Reject"  value={kpi?.reject}  color={C.orange}
                                onClick={() => toggleJudgement('Reject')} active={judgementSel === 'Reject'} dimmed={!!judgementSel && judgementSel !== 'Reject'} /></Col>
                        </Row>

                        {/* ── Active selection ────────────────────────────────── */}
                        {(month || statusSel || judgementSel || reasonSel) && (
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                <Text style={{ color: C.textSec, fontSize: 11 }}>Showing</Text>
                                {month ? <Tag closable color="blue" onClose={(e) => { e.preventDefault(); setMonth(0); }}>Month: {MONTH_LABELS_ALL[month]}</Tag> : null}
                                {statusSel ? <Tag closable color={statusSel === 'Delay' ? 'red' : 'green'} onClose={(e) => { e.preventDefault(); toggleStatus(statusSel); }}>Status: {statusSel}</Tag> : null}
                                {reasonSel ? <Tag closable color="volcano" onClose={(e) => { e.preventDefault(); setReasonSel(''); }}>Cause: {reasonSel}</Tag> : null}
                                {judgementSel ? <Tag closable color={judgementSel === 'Accept' ? 'gold' : 'orange'} onClose={(e) => { e.preventDefault(); toggleJudgement(judgementSel); }}>Judgement: {judgementSel}</Tag> : null}
                                <a onClick={() => { setMonth(0); clearSelection(); }} style={{ fontSize: 11 }}>Clear all</a>
                                <Text style={{ color: C.textSec, fontSize: 11 }}>
                                    — status / judgement / cause narrow W/C, Daily, Measuring Tools and Records ({(data?.filteredItems ?? 0).toLocaleString()} rows); cards, ratios, trend and root cause keep the full period
                                </Text>
                            </div>
                        )}

                        {/* ── Charts Row 1 ────────────────────────────────────── */}
                        <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>

                            {/* Judgement Ratio */}
                            <Col xs={24} md={3}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle('Judgement Ratio', C)}
                                    {(() => {
                                        const judged = (kpi?.accept || 0) + (kpi?.reject || 0);
                                        const acceptPct = judged > 0 ? ((kpi.accept / judged) * 100).toFixed(1) : 0;
                                        return (<>
                                            <DonutChart C={C}
                                                data={data?.judgementRatio || []}
                                                colors={[C.green, C.red]}
                                                centerLabel={judged > 0 ? `${acceptPct}%` : '-'}
                                                centerSub="Accept"
                                                size={100}
                                            />
                                        </>);
                                    })()}
                                </div>
                            </Col>

                            {/* Status Ratio */}
                            <Col xs={24} md={3}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle('Status Ratio', C)}
                                    <DonutChart C={C}
                                        data={data?.statusRatio || []}
                                        colors={[C.blue, C.red]}
                                        centerLabel={kpi ? `${kpi.onTimePct}%` : '-'}
                                        centerSub="On Time"
                                        size={100}
                                    />
                                </div>
                            </Col>

                            {/* Monthly Trend */}
                            <Col xs={24} md={14}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle(`Monthly Trend — FYE${fye}`, C)}
                                    <div style={{ height: 255 }}>
                                        <Bar data={buildMonthlyChart()} options={monthlyChartOpts} />
                                    </div>
                                </div>
                            </Col>

                            {/* Root Cause for Delay */}
                            <Col xs={24} md={4}>
                                <div style={{ ...cardStyle, height: 310, overflow: 'hidden' }}>
                                    {sectionTitle('Root Cause for Delay', C)}
                                    {delayArr.length === 0
                                        ? <div style={{ color: C.textSec, fontSize: 12, textAlign: 'center', paddingTop: 40 }}>No delay</div>
                                        : (() => {
                                            const totalDelay = delayArr.reduce((s, d) => s + d.count, 0);
                                            return <>
                                                <div style={{ height: 155 }}>
                                                    <Doughnut data={delayChartData} options={{ ...delayChartOpts, plugins: { ...delayChartOpts.plugins, legend: { display: false } } }} />
                                                </div>
                                                <div style={{ marginTop: 6 }}>
                                                    {delayArr.map((d, i) => {
                                                        const pct = totalDelay > 0 ? ((d.count / totalDelay) * 100).toFixed(1) : 0;
                                                        const picked = reasonSel === d.reason;
                                                        return (
                                                            <div key={i}
                                                                role="button" tabIndex={0} aria-pressed={picked}
                                                                onClick={() => toggleReason(d.reason)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleReason(d.reason); } }}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: 5,
                                                                    cursor: 'pointer', borderRadius: 4, padding: '1px 3px', margin: '0 -3px 4px',
                                                                    background: picked ? hexToRgba(delayCauseColor(i), 0.18) : 'transparent',
                                                                    outline: picked ? `1px solid ${delayCauseColor(i)}` : 'none',
                                                                    opacity: reasonSel && !picked ? 0.5 : 1,
                                                                }}>
                                                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                                                               background: delayCauseColor(i) }} />
                                                                <Tooltip title={`${d.reason} — ${d.count}`}>
                                                                    <span style={{ color: picked ? C.textPri : C.textSec, fontSize: 10, flex: 1, fontWeight: picked ? 700 : 400,
                                                                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {d.reason}
                                                                    </span>
                                                                </Tooltip>
                                                                <span style={{ color: delayCauseColor(i), fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{pct}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>;
                                        })()}
                                </div>
                            </Col>
                        </Row>

                        {/* ── Charts Row 2 ── [W/C md=6][Daily md=14][Measuring md=4] ── */}
                        <Row gutter={[10, 10]}>

                            {/* WC / PIC Breakdown — md=6 (aligns under Judgement+Status) */}
                            <Col xs={24} md={6}>
                                <div style={{ ...cardStyle, height: 360 }}>
                                    {sectionTitle('Total PO Issue of Each W/C', C)}
                                    <div style={{ height: 305, overflowY: 'auto' }}>
                                        {wcData.length > 0
                                            ? <Bar data={wcChartData} options={wcChartOpts} />
                                            : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 80 }}>No data</div>
                                        }
                                    </div>
                                </div>
                            </Col>

                            {/* Daily Issued — md=14 (aligns under Monthly Trend) */}
                            <Col xs={24} md={14}>
                                <div style={{ ...cardStyle, height: 360 }}>
                                    {sectionTitle('Daily Tooling Issued', C)}
                                    <div style={{ height: 305 }}>
                                        {dailyArr.length > 0
                                            ? <Line data={dailyChartData} options={dailyChartOpts} />
                                            : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 80 }}>No data</div>
                                        }
                                    </div>
                                </div>
                            </Col>

                            {/* Measuring Tools — md=4 (aligns under Root Cause) */}
                            <Col xs={24} md={4}>
                                <div style={{ ...cardStyle, height: 360, overflowY: 'auto' }}>
                                    {sectionTitle('Measuring Tools', C)}
                                    {(data?.measuringTools || []).length === 0
                                        ? <div style={{ color: C.textSec, fontSize: 12, textAlign: 'center', paddingTop: 40 }}>No data</div>
                                        : (data?.measuringTools || []).map((t, i) => (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between',
                                                          marginBottom: 3 }}>
                                                <span style={{ color: C.textPri, fontSize: 12 }}>{t.tool}</span>
                                                <span style={{ color: C.cyan, fontSize: 12, fontWeight: 700 }}>
                                                    {t.count} <span style={{ color: C.textSec, fontWeight: 400 }}>({t.pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ background: C.border, borderRadius: 3, height: 6 }}>
                                                <div style={{
                                                    width: `${Math.min(t.pct, 100)}%`,
                                                    height: '100%',
                                                    background: `hsl(${200 + i * 30}, 70%, 55%)`,
                                                    borderRadius: 3,
                                                    transition: 'width 0.8s ease'
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Col>
                        </Row>


                        {/* ── Detail Table ─────────────────────────────────────── */}
                        <div style={{ ...cardStyle, marginTop: 10 }}>
                            {sectionTitle('Inspection Records', C)}
                            <Table
                                className="dark-inspect-table"
                                dataSource={data?.detailRows || []}
                                rowKey="id"
                                size="small"
                                scroll={{ x: 'max-content' }}
                                pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20','50','100'], showTotal: (t) => `Total ${t} records` }}
                                style={{ color: C.textPri }}
                                columns={[
                                    { title: 'Receive Date', dataIndex: 'receive_date', key: 'receive_date', width: 110,
                                      render: (v) => v ? moment(v, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-',
                                      sorter: (a, b) => (a.receive_date||'').localeCompare(b.receive_date||'') },
                                    { title: 'PO No.', dataIndex: 'po_no', key: 'po_no', width: 120,
                                      sorter: (a, b) => (a.po_no||'').localeCompare(b.po_no||'') },
                                    { title: 'Item Name', dataIndex: 'item_name', key: 'item_name', width: 160,
                                      sorter: (a, b) => (a.item_name||'').localeCompare(b.item_name||'') },
                                    { title: 'DWG No.', dataIndex: 'dwg_no', key: 'dwg_no', width: 110,
                                      sorter: (a, b) => (a.dwg_no||'').localeCompare(b.dwg_no||'') },
                                    { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 60, align: 'center',
                                      sorter: (a, b) => (Number(a.qty)||0) - (Number(b.qty)||0) },
                                    { title: 'Issue Date', dataIndex: 'issue_date', key: 'issue_date', width: 105,
                                      render: (v) => v ? moment(v, 'YYYY-MM-DD').format('DD-MM-YYYY') : '-',
                                      sorter: (a, b) => (a.issue_date||'').localeCompare(b.issue_date||'') },
                                    { title: 'Diff', dataIndex: 'diff', key: 'diff', width: 60, align: 'center',
                                      sorter: (a, b) => (Number(a.diff)||0) - (Number(b.diff)||0) },
                                    { title: 'W/C', dataIndex: 'w_c', key: 'w_c', width: 80,
                                      sorter: (a, b) => (a.w_c||'').localeCompare(b.w_c||'') },
                                    { title: 'Status', dataIndex: 'status', key: 'status', width: 90, align: 'center',
                                      sorter: (a, b) => (a.status||'').localeCompare(b.status||''),
                                      render: (v) => v ? <Tag color={v === 'On time' ? 'success' : v === 'Delay' ? 'error' : 'warning'}>{v}</Tag> : '-' },
                                    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 130,
                                      sorter: (a, b) => (a.reason||'').localeCompare(b.reason||''),
                                      render: (v) => v || '-' },
                                    { title: 'Judgement', dataIndex: 'judgement', key: 'judgement', width: 100, align: 'center',
                                      sorter: (a, b) => (a.judgement||'').localeCompare(b.judgement||''),
                                      render: (v) => v ? <Tag color={v === 'Accept' ? 'success' : 'error'}>{v}</Tag> : '-' },
                                    { title: 'Measuring Tools', dataIndex: 'measuring_tools', key: 'measuring_tools', width: 140,
                                      sorter: (a, b) => (a.measuring_tools||'').localeCompare(b.measuring_tools||''),
                                      render: (v) => v || '-' },
                                ]}
                            />
                        </div>

                    </Spin>
                </Content>
            </Layout>

            <style>{`
                .dark-select .ant-select-item { background: ${C.card}; color: ${C.textPri}; }
                .dark-select .ant-select-item-option-selected { background: ${hexToRgba(C.blue, 0.13)}; }
                .dark-select .ant-select-item-option-active { background: ${C.border}; }
                .dark-inspect-table .ant-table { background: ${C.card}; color: ${C.textPri}; }
                .dark-inspect-table .ant-table-thead > tr > th { background: ${C.bg}; color: ${C.textSec}; border-bottom: 1px solid ${C.border}; font-size: 11px; }
                .dark-inspect-table .ant-table-tbody > tr > td { background: ${C.card}; color: ${C.textPri}; border-bottom: 1px solid ${hexToRgba(C.border, 0.6)}; font-size: 12px; }
                .dark-inspect-table .ant-table-tbody > tr:hover > td { background: ${C.border} !important; }
                .dark-inspect-table .ant-pagination { color: ${C.textSec}; }
                .dark-inspect-table .ant-pagination-item a { color: ${C.textSec}; }
                .dark-inspect-table .ant-pagination-item-active a { color: ${C.blue}; }
                .dark-inspect-table .ant-table-column-sorter { color: ${C.textSec}; }
            `}</style>
        </Layout>
    );
}
