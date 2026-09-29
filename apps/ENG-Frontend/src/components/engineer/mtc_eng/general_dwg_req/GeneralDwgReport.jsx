import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Select, Spin, Row, Col, Typography, Table, Tag, Tooltip } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import moment from 'moment';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title as ChartTitle,
    Tooltip as ChartTooltip,
    Legend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ChartTitle, ChartTooltip, Legend, ChartDataLabels);

const { Content } = Layout;
const { Text } = Typography;
const { Option } = Select;

// Same measured palette as InspectionResultDashboard.jsx (Tooling Inspection's own
// Report page) — kept as its own local copy since neither dashboard exports a
// shared theming module yet. Hue IDENTITY carries across both: green = On Time,
// red = Delay, everywhere in MTC reporting.
const SERIES_DARK = {
    blue: '#1890ff', cyan: '#00d4ff', green: '#52c41a', red: '#ff4d4f',
    yellow: '#ffc53d', orange: '#fa8c16', purple: '#9254de',
};
const SERIES_LIGHT = {
    blue: '#0958d9', cyan: '#08979c', green: '#389e0d', red: '#cf1322',
    yellow: '#ad6800', orange: '#d4380d', purple: '#531dab',
};

const hexToRgba = (hex, a) => {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return `rgba(111,163,199,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

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
            gridLine: hexToRgba(c.border || '#0e3a5c', dark ? 0.8 : 0.55),
            isDark: dark,
        };
    }, [theme]);
};

const cardStyleOf = (C) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' });

const sectionTitle = (label, C) => (
    <div style={{
        color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
        textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
        paddingBottom: 6, marginBottom: 12,
    }}>
        {label}
    </div>
);

// KPI card — same behaviour as InspectionResultDashboard's: `onClick` makes it a toggle
// filter, `active` outlines it in its own colour, `dimmed` fades it while a sibling in the
// same group is selected.
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
                opacity: dimmed ? 0.55 : 1, transition: 'box-shadow 0.15s, opacity 0.15s',
            }}>
            <div style={{ color: C.textSec, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{value ?? '-'}</div>
            {sub && <div style={{ color: C.textSec, fontSize: 11, marginTop: 2 }}>{sub}</div>}
        </div>
    );
};

// FYE month order: Apr(4)…Dec(12), Jan(1)…Mar(3) — same convention as
// InspectionResultDashboard / legacyMtcController's fyeToRange.
const FYE_MONTH_LABELS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const FYE_MONTH_NUMS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

const calcCurrentFye = () => {
    const m = moment().month() + 1;
    const y = moment().year();
    return m >= 4 ? y - 1999 : y - 2000;
};

const STAGE_LABELS = {
    eng_check: 'Check', draft_man: 'Draft', dwg_check: 'DWG Check',
    eng_review: 'Review', eng_approve: 'Approve', eng_inform: 'Inform',
};
// Fixed order/colors — never reassigned per-request, so "Check" is always blue etc.
const STAGE_COLOR_KEYS = ['blue', 'orange', 'purple', 'green', 'cyan', 'yellow'];

export default function GeneralDwgReport() {
    const C = useColors();
    const cardStyle = cardStyleOf(C);
    const [fye, setFye] = useState(calcCurrentFye());
    const [fyeOptions, setFyeOptions] = useState([]);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get(server.MTC_TOOL_REQUEST_REPORT_FYE)
            .then(res => {
                const list = res.data || [];
                setFyeOptions(list);
                if (list.length > 0 && !list.includes(calcCurrentFye())) setFye(list[0]);
            })
            .catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Drill-down selection, same model as InspectionResultDashboard. Every one is a toggle
    // (the same click again clears it). The month comes from a click on a month column in
    // either chart and re-scopes the cards + lists; status / type / department come from
    // the cards and breakdown bars and narrow the panels that are not their own selector
    // (the server decides which — see getToolRequestReport).
    const [month, setMonth] = useState(0);            // calendar month 1-12, 0 = whole FYE
    const [statusSel, setStatusSel] = useState('');   // 'On time' | 'Delay'
    const [typeSel, setTypeSel] = useState('');
    const [deptSel, setDeptSel] = useState('');
    const toggleStatus = (s) => setStatusSel(cur => (cur === s ? '' : s));
    const toggleType = (t) => setTypeSel(cur => (cur === t ? '' : t));
    const toggleDept = (d) => setDeptSel(cur => (cur === d ? '' : d));
    const clearSelection = () => { setMonth(0); setStatusSel(''); setTypeSel(''); setDeptSel(''); };

    const fetchData = useCallback(async (f, m, st, ty, dp) => {
        setLoading(true);
        try {
            const params = { fye: f };
            if (m) params.month = m;
            if (st) params.status = st;
            if (ty) params.type = ty;
            if (dp) params.dept = dp;
            const res = await axios.get(server.MTC_TOOL_REQUEST_REPORT, { params });
            setData(res.data);
        } catch (e) {
            console.error('General DWG Report error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(fye, month, statusSel, typeSel, deptSel); }, [fye, month, statusSel, typeSel, deptSel, fetchData]);

    // A type / department picked in one month may not exist in the next; drop it instead of
    // leaving the records list silently empty. The lists are unfiltered by their own
    // selection, so their names are the truth about what can still be picked.
    useEffect(() => {
        if (typeSel && data && !(data.byType || []).some(t => t.name === typeSel)) setTypeSel('');
        if (deptSel && data && !(data.byDept || []).some(d => d.name === deptSel)) setDeptSel('');
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    // Category under the pointer, resolved by COLUMN (or ROW for horizontal bars) so the
    // whole month / category is clickable, not just the painted bar.
    const indexAt = (evt, chart, axis = 'x') => {
        const hit = chart.getElementsAtEventForMode(evt, 'index', { intersect: false, axis }, true);
        return hit.length ? hit[0].index : -1;
    };

    // ── Chart 1: monthly On time / Delay + %On time, with a previous-FYE average
    // baseline bar (same device as InspectionResultDashboard's Monthly Trend).
    const monthlyChartData = useMemo(() => {
        const byMonth = {};
        (data?.monthlyTrend || []).forEach(r => {
            const m = parseInt(r.month?.split('-')[1], 10);
            if (m) byMonth[m] = r;
        });
        const ontimePct = FYE_MONTH_NUMS.map(num => {
            const row = byMonth[num];
            if (!row) return null;
            const total = (row.onTime || 0) + (row.delay || 0);
            return total > 0 ? parseFloat(((row.onTime / total) * 100).toFixed(1)) : null;
        });
        const prev = data?.prevFyeAvg;
        const avgLabel = prev ? `FYE${prev.fye} avg` : 'Prev avg';
        const labels = [avgLabel, ...FYE_MONTH_LABELS];
        const lead = (arr, val) => [val, ...arr];
        // With a month picked, every other month's bars fade so the chosen one reads.
        const monthAlpha = (num) => (month && num !== month ? 0.25 : 0.7);

        const onTimeArr = lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.onTime ?? 0), prev?.onTime ?? null);
        const delayArr = lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.delay ?? 0), prev?.delay ?? null);
        const totalArr = onTimeArr.map((v, i) => (v === null && delayArr[i] === null) ? null : (v || 0) + (delayArr[i] || 0));

        return {
            labels,
            datasets: [
                {
                    type: 'bar', label: 'On time',
                    data: onTimeArr,
                    backgroundColor: lead(FYE_MONTH_NUMS.map(num => hexToRgba(C.green, monthAlpha(num))), hexToRgba(C.green, 0.3)),
                    borderColor: C.green, borderWidth: 1, yAxisID: 'yLeft', order: 2,
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: '#fff', anchor: 'start', align: 'top', offset: 4,
                        font: { size: 10, weight: 700 },
                    },
                },
                {
                    type: 'bar', label: 'Delay',
                    data: delayArr,
                    backgroundColor: lead(FYE_MONTH_NUMS.map(num => hexToRgba(C.red, monthAlpha(num))), hexToRgba(C.red, 0.3)),
                    borderColor: C.red, borderWidth: 1, yAxisID: 'yLeft', order: 2,
                    datalabels: {
                        display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: '#fff', anchor: 'start', align: 'top', offset: 4,
                        font: { size: 10, weight: 700 },
                    },
                },
                {
                    // Invisible marker — carries no bar/line of its own, only the "Total"
                    // datalabel floating above the pair of bars for that month.
                    type: 'line', label: 'Total',
                    data: totalArr,
                    borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0,
                    borderWidth: 0, fill: false, yAxisID: 'yLeft', order: 3, spanGaps: true,
                    datalabels: {
                        display: true, color: C.textPri, anchor: 'end', align: 'top', offset: 2,
                        font: { size: 10, weight: 700 },
                        formatter: (v) => (v === null ? '' : v),
                    },
                },
                {
                    type: 'line', label: '% On time',
                    data: lead(ontimePct, prev?.onTimePct ?? null),
                    borderColor: C.yellow, backgroundColor: hexToRgba(C.yellow, 0.15),
                    tension: 0.4, fill: false, pointRadius: 4, borderWidth: 2,
                    yAxisID: 'yRight', order: 1, spanGaps: true,
                    datalabels: {
                        display: true, color: C.yellow, anchor: 'end', align: 'top', offset: 4,
                        font: { size: 10, weight: 700 },
                        formatter: (v) => (v === null ? '' : `${v}%`),
                    },
                },
                {
                    type: 'line', label: 'Target 95%',
                    data: labels.map(() => 95),
                    borderColor: hexToRgba(C.red, 0.85), borderWidth: 1.5, borderDash: [6, 4],
                    pointRadius: 0, fill: false, yAxisID: 'yRight', order: 0,
                    datalabels: { display: false },
                },
            ],
        };
    }, [data, C, month]);

    const monthlyChartOpts = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        // Click a month's column to scope the page to it; again to go back to the FYE.
        // Index 0 is the previous-FYE average baseline — not a month, so it does nothing.
        onClick: (evt, _els, chart) => {
            const i = indexAt(evt, chart);
            if (i > 0) setMonth(cur => (cur === FYE_MONTH_NUMS[i - 1] ? 0 : FYE_MONTH_NUMS[i - 1]));
        },
        onHover: (evt, _els, chart) => {
            chart.canvas.style.cursor = indexAt(evt, chart) > 0 ? 'pointer' : 'default';
        },
        plugins: {
            // Base "off" so any dataset that doesn't set its own `datalabels` stays
            // silent (the On time/Delay bars); Total and % On time opt back in per-dataset.
            datalabels: { display: false },
            legend: {
                position: 'bottom',
                labels: {
                    color: C.textPri, font: { size: 11 }, boxWidth: 12, padding: 12,
                    filter: (item) => item.text !== 'Total', // marker-only series, not a real legend entry
                },
            },
            tooltip: {
                mode: 'index', intersect: false,
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.raw;
                        if (val === null || val === undefined) return null;
                        return ctx.dataset.label.includes('%') ? ` ${ctx.dataset.label}: ${val}%` : ` ${ctx.dataset.label}: ${val}`;
                    },
                },
            },
        },
        scales: {
            x: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            yLeft: { type: 'linear', position: 'left', ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            yRight: {
                type: 'linear', position: 'right', min: 0, max: 115,
                ticks: { color: C.yellow, font: { size: 10 }, stepSize: 20, callback: (v) => (v > 100 ? '' : `${v}%`) },
                grid: { drawOnChartArea: false },
            },
        },
    }), [C]);

    // ── Chart 2: average calendar days spent in each of the 6 stages, per month
    // the request finished. Grouped (not stacked) — the six bars are independent
    // durations, not parts of one total.
    const stageChartData = useMemo(() => {
        const byMonth = {};
        (data?.stageAvg || []).forEach(r => {
            const m = parseInt(r.month?.split('-')[1], 10);
            if (m) byMonth[m] = r;
        });
        const stages = data?.stageOrder || Object.keys(STAGE_LABELS);
        return {
            labels: FYE_MONTH_LABELS,
            datasets: stages.map((stage, i) => ({
                label: STAGE_LABELS[stage] || stage,
                data: FYE_MONTH_NUMS.map(num => byMonth[num]?.[stage] ?? null),
                backgroundColor: FYE_MONTH_NUMS.map(num => hexToRgba(
                    C[STAGE_COLOR_KEYS[i % STAGE_COLOR_KEYS.length]], month && num !== month ? 0.22 : 0.85)),
                borderRadius: 2,
            })),
        };
    }, [data, C, month]);

    const stageChartOpts = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        // Same month selection as the trend chart above (this chart's x-axis is the month).
        onClick: (evt, _els, chart) => {
            const i = indexAt(evt, chart);
            if (i >= 0) setMonth(cur => (cur === FYE_MONTH_NUMS[i] ? 0 : FYE_MONTH_NUMS[i]));
        },
        onHover: (evt, _els, chart) => {
            chart.canvas.style.cursor = indexAt(evt, chart) >= 0 ? 'pointer' : 'default';
        },
        plugins: {
            datalabels: { display: false },
            legend: { position: 'bottom', labels: { color: C.textPri, font: { size: 11 }, boxWidth: 12, padding: 12 } },
            tooltip: { mode: 'index', intersect: false, callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw ?? '-'} day(s)` } },
        },
        scales: {
            x: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            y: {
                ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine },
                title: { display: true, text: 'Avg. days', color: C.textSec, font: { size: 10 } },
            },
        },
    }), [C]);

    // ── Breakdown bars (Type of Request / Department) — horizontal, stacked On time +
    // Delay, one row per category. Clicking a row toggles that category as a filter;
    // the picked row keeps its colour and the rest fade, exactly like a Root Cause slice.
    const breakdownData = (list, picked) => ({
        labels: list.map(d => d.name),
        datasets: [
            { label: 'On time', data: list.map(d => d.onTime), stack: 's',
              backgroundColor: list.map(d => hexToRgba(C.green, picked && d.name !== picked ? 0.2 : 0.75)), borderRadius: 2 },
            { label: 'Delay', data: list.map(d => d.delay), stack: 's',
              backgroundColor: list.map(d => hexToRgba(C.red, picked && d.name !== picked ? 0.2 : 0.75)), borderRadius: 2 },
        ],
    });
    const breakdownOpts = (list, onPick) => ({
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (evt, _els, chart) => {
            const i = indexAt(evt, chart, 'y');
            if (i >= 0 && list[i]) onPick(list[i].name);
        },
        onHover: (evt, _els, chart) => {
            chart.canvas.style.cursor = indexAt(evt, chart, 'y') >= 0 ? 'pointer' : 'default';
        },
        plugins: {
            datalabels: { display: false },
            legend: { position: 'bottom', labels: { color: C.textPri, font: { size: 11 }, boxWidth: 12, padding: 12 } },
            tooltip: { mode: 'index', intersect: false, axis: 'y' },
        },
        scales: {
            x: { stacked: true, ticks: { color: C.textSec, font: { size: 10 }, precision: 0 }, grid: { color: C.gridLine } },
            y: { stacked: true, ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
        },
    });
    const byType = data?.byType || [];
    const byDept = data?.byDept || [];
    const kpi = data?.kpi;

    // Plain-number table alongside the chart — same monthly figures for anyone who
    // needs to read the values directly rather than the plot.
    const tableRows = (data?.monthlyTrend || []).map(r => {
        const total = r.onTime + r.delay;
        return {
            key: r.month,
            month: moment(r.month + '-01').format('MMM YYYY'),
            total, onTime: r.onTime, delay: r.delay,
            pct: total > 0 ? `${((r.onTime / total) * 100).toFixed(1)}%` : '-',
        };
    });

    const fyeStartYear = fye + 1999;
    const fyeEndYear = fye + 2000;
    const monthLabel = month ? FYE_MONTH_LABELS[FYE_MONTH_NUMS.indexOf(month)] : '';

    return (
        <Layout style={{ height: '100%', background: C.bg }}>
            <MenuTemplate type="MTC" defaultSelectedKeys="general-dwg-report" />
            <Layout style={{ background: C.bg }}>
                <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
                    <Spin spinning={loading} tip="Loading...">

                        {/* Header */}
                        <div style={{
                            background: `linear-gradient(90deg, ${C.bg} 0%, ${C.card} 100%)`,
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: '10px 20px', marginBottom: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <div style={{ color: C.cyan, fontWeight: 800, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    Report Of General Drawing Job Request
                                    <SystemVersionBadge system="general-dwg-report" dark={C.isDark} />
                                </div>
                                <div style={{ color: C.textSec, fontSize: 11 }}>FYE{fye} (Apr {fyeStartYear} – Mar {fyeEndYear})</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <Text style={{ color: C.textSec, fontSize: 12 }}>FYE</Text>
                                <Select value={fye} onChange={v => { setFye(v); clearSelection(); }} style={{ width: 100 }} popupClassName="dark-select" loading={fyeOptions.length === 0}>
                                    {fyeOptions.map(f => <Option key={f} value={f}>FYE{f}</Option>)}
                                </Select>
                            </div>
                        </div>

                        {/* KPI cards — the month selection (chart click) re-scopes them; On Time / Delay
                            toggle the status filter for the panels below. */}
                        <Row gutter={[10, 10]} style={{ marginBottom: 12 }}>
                            <Col flex="1"><KpiCard C={C} label="Completed" value={kpi?.total} color={C.blue}
                                sub={month ? `${monthLabel} only` : 'whole FYE'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="On Time" value={kpi?.onTime} color={C.green}
                                onClick={() => toggleStatus('On time')} active={statusSel === 'On time'} dimmed={!!statusSel && statusSel !== 'On time'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="Delay" value={kpi?.delay} color={C.red}
                                onClick={() => toggleStatus('Delay')} active={statusSel === 'Delay'} dimmed={!!statusSel && statusSel !== 'Delay'} /></Col>
                            <Col flex="1"><KpiCard C={C} label="% On Time" value={kpi ? `${kpi.onTimePct}%` : '-'}
                                color={kpi && kpi.onTimePct >= 95 ? C.green : C.yellow} sub="target 95%" /></Col>
                            <Col flex="1"><KpiCard C={C} label="Avg Lead Days" value={kpi?.avgLeadDays} color={C.cyan}
                                sub="request → informed" /></Col>
                            <Col flex="1"><KpiCard C={C} label="In Progress" value={kpi?.open} color={C.orange}
                                sub="open now (all time)" /></Col>
                        </Row>

                        {(month || statusSel || typeSel || deptSel) && (
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                <Text style={{ color: C.textSec, fontSize: 11 }}>Showing</Text>
                                {month ? <Tag closable color="blue" style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setMonth(0); }}>Month: {monthLabel}</Tag> : null}
                                {statusSel ? <Tag closable color={statusSel === 'Delay' ? 'red' : 'green'} style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setStatusSel(''); }}>Status: {statusSel}</Tag> : null}
                                {typeSel ? <Tag closable color="geekblue" style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setTypeSel(''); }}>Type: {typeSel}</Tag> : null}
                                {deptSel ? <Tag closable color="purple" style={{ margin: 0 }} onClose={(e) => { e.preventDefault(); setDeptSel(''); }}>Dept: {deptSel}</Tag> : null}
                                <a onClick={clearSelection} style={{ fontSize: 11 }}>Clear all</a>
                                <Text style={{ color: C.textSec, fontSize: 11 }}>
                                    — month re-scopes the cards and lists; status / type / dept narrow the stage chart, breakdowns and records ({(data?.recordCount ?? 0).toLocaleString()} rows). The monthly trend always shows the whole FYE.
                                </Text>
                            </div>
                        )}

                        <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
                            <Col xs={24}>
                                <div style={{ ...cardStyle, height: 340 }}>
                                    {sectionTitle(`Monthly Requests — On time vs Delay — FYE${fye}`, C)}
                                    <div style={{ height: 285 }}>
                                        <Bar data={monthlyChartData} options={monthlyChartOpts} />
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
                            <Col xs={24}>
                                <div style={{ ...cardStyle, height: 340 }}>
                                    {sectionTitle(`Average Days per Stage — FYE${fye}`, C)}
                                    <div style={{ height: 285 }}>
                                        <Bar data={stageChartData} options={stageChartOpts} />
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>
                            <Col xs={24} md={12}>
                                <div style={{ ...cardStyle, height: Math.max(220, 90 + Math.max(byType.length, byDept.length) * 34) }}>
                                    {sectionTitle('By Type of Request — click to filter', C)}
                                    {byType.length > 0
                                        ? <div style={{ height: Math.max(130, byType.length * 34 + 40) }}><Bar data={breakdownData(byType, typeSel)} options={breakdownOpts(byType, toggleType)} /></div>
                                        : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 50 }}>No data</div>}
                                </div>
                            </Col>
                            <Col xs={24} md={12}>
                                <div style={{ ...cardStyle, height: Math.max(220, 90 + Math.max(byType.length, byDept.length) * 34) }}>
                                    {sectionTitle('By Department — click to filter', C)}
                                    {byDept.length > 0
                                        ? <div style={{ height: Math.max(130, byDept.length * 34 + 40) }}><Bar data={breakdownData(byDept, deptSel)} options={breakdownOpts(byDept, toggleDept)} /></div>
                                        : <div style={{ color: C.textSec, textAlign: 'center', paddingTop: 50 }}>No data</div>}
                                </div>
                            </Col>
                        </Row>

                        <div style={{ ...cardStyle, marginBottom: 10 }}>
                            {sectionTitle(`Completed Requests${month ? ` — ${monthLabel}` : ''}`, C)}
                            <Table
                                className="dark-report-table"
                                dataSource={data?.records || []}
                                rowKey="id"
                                size="small"
                                scroll={{ x: 'max-content' }}
                                pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], showTotal: (t) => `Total ${t} records` }}
                                locale={{ emptyText: 'No completed requests match the selection' }}
                                columns={[
                                    { title: 'Req No.', dataIndex: 'req_no', key: 'req_no', width: 100,
                                      sorter: (a, b) => (a.req_no || '').localeCompare(b.req_no || '') },
                                    { title: 'Requested', dataIndex: 'req_date', key: 'req_date', width: 105,
                                      render: (v) => (v ? moment(v).format('DD-MM-YYYY') : '-'),
                                      sorter: (a, b) => new Date(a.req_date) - new Date(b.req_date) },
                                    { title: 'Title', dataIndex: 'title', key: 'title', width: 200, render: (v) => v || '-' },
                                    { title: 'Type', dataIndex: 'type_of_request', key: 'type_of_request', width: 130, render: (v) => v || '-' },
                                    { title: 'Dept', dataIndex: 'department', key: 'department', width: 80, render: (v) => v || '-' },
                                    { title: 'Requester', dataIndex: 'requester', key: 'requester', width: 150, render: (v) => v || '-' },
                                    { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 80, render: (v) => v || '-' },
                                    { title: 'Informed', dataIndex: 'completed_at', key: 'completed_at', width: 105,
                                      render: (v) => (v ? moment(v).format('DD-MM-YYYY') : '-'),
                                      sorter: (a, b) => new Date(a.completed_at) - new Date(b.completed_at) },
                                    { title: 'Lead days', dataIndex: 'lead_days', key: 'lead_days', width: 85, align: 'center',
                                      sorter: (a, b) => (a.lead_days || 0) - (b.lead_days || 0) },
                                    { title: 'Late (wd)', dataIndex: 'diff_days', key: 'diff_days', width: 85, align: 'center',
                                      render: (v) => (v ?? '-'),
                                      sorter: (a, b) => (a.diff_days || 0) - (b.diff_days || 0) },
                                    { title: 'Status', dataIndex: 'completion_status', key: 'completion_status', width: 90, align: 'center',
                                      render: (v) => (v ? <Tag color={v === 'On time' ? 'success' : 'error'}>{v}</Tag> : '-') },
                                ]}
                            />
                        </div>

                        <div style={cardStyle}>
                            {sectionTitle('Monthly Summary', C)}
                            <Table
                                className="dark-report-table"
                                dataSource={tableRows}
                                size="small"
                                pagination={false}
                                locale={{ emptyText: 'No completed requests in this FYE yet' }}
                                columns={[
                                    { title: 'Month', dataIndex: 'month', key: 'month' },
                                    { title: 'Total', dataIndex: 'total', key: 'total', align: 'center' },
                                    { title: 'On time', dataIndex: 'onTime', key: 'onTime', align: 'center' },
                                    { title: 'Delay', dataIndex: 'delay', key: 'delay', align: 'center' },
                                    { title: '% On time', dataIndex: 'pct', key: 'pct', align: 'center' },
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
                .dark-report-table .ant-table { background: ${C.card}; color: ${C.textPri}; }
                .dark-report-table .ant-table-thead > tr > th { background: ${C.bg}; color: ${C.textSec}; border-bottom: 1px solid ${C.border}; font-size: 11px; }
                .dark-report-table .ant-table-tbody > tr > td { background: ${C.card}; color: ${C.textPri}; border-bottom: 1px solid ${hexToRgba(C.border, 0.6)}; font-size: 12px; }
                .dark-report-table .ant-table-tbody > tr:hover > td { background: ${C.border} !important; }
            `}</style>
        </Layout>
    );
}
