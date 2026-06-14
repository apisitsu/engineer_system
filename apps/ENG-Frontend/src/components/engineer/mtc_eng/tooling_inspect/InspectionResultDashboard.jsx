import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Select, Spin, Typography, Row, Col, Tooltip, Table, Tag } from 'antd';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
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

// ── Dark theme palette ──────────────────────────────────────────────────────
const C = {
    bg:        '#041320',
    card:      '#072035',
    border:    '#0e3a5c',
    blue:      '#1890ff',
    cyan:      '#00d4ff',
    green:     '#52c41a',
    red:       '#ff4d4f',
    yellow:    '#ffc53d',
    orange:    '#fa8c16',
    purple:    '#722ed1',
    textPri:   '#e8f4ff',
    textSec:   '#6fa3c7',
    gridLine:  'rgba(14,58,92,0.8)',
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

const cardStyle = {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '14px 18px',
};

const sectionTitle = (label) => (
    <div style={{ color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
                  textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`,
                  paddingBottom: 6, marginBottom: 12 }}>
        {label}
    </div>
);

// ── KPI Card ────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, color, sub }) => (
    <div style={{ ...cardStyle, textAlign: 'center', borderTop: `3px solid ${color}` }}>
        <div style={{ color: C.textSec, fontSize: 11, textTransform: 'uppercase',
                      letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
        <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
            {value?.toLocaleString() ?? '-'}
        </div>
        {sub && <div style={{ color: C.textSec, fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
);

// ── Donut with center label ─────────────────────────────────────────────────
const DonutChart = ({ data, colors, centerLabel, centerSub, size = 140 }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    const chartData = {
        labels: data.map(d => d.name),
        datasets: [{
            data: total > 0 ? data.map(d => d.value) : [1],
            backgroundColor: total > 0 ? colors : ['#1a3a5c'],
            borderColor: C.card,
            borderWidth: 3,
            hoverOffset: 6,
        }]
    };
    const options = {
        cutout: '68%',
        plugins: {
            legend: { display: false },
            tooltip: { enabled: total > 0 }
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

    const fetchData = useCallback(async (f, m) => {
        setLoading(true);
        try {
            const params = { fye: f };
            if (m) params.month = m;
            const res = await axios.get(server.TOOLING_RESULT_DASHBOARD, { params });
            setData(res.data);
        } catch (e) {
            console.error('Result Dashboard Error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(fye, month || null); }, [fye, month, fetchData]);

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
        return {
            labels: FYE_MONTH_LABELS,
            datasets: [
                {
                    type: 'bar',
                    label: 'On Time',
                    data: FYE_MONTH_NUMS.map(num => byMonth[num]?.onTime ?? 0),
                    backgroundColor: 'rgba(82,196,26,0.7)',
                    borderColor: C.green,
                    borderWidth: 1,
                    stack: 'monthly',
                    yAxisID: 'yLeft',
                    order: 2,
                },
                {
                    type: 'bar',
                    label: 'Delay',
                    data: FYE_MONTH_NUMS.map(num => byMonth[num]?.delay ?? 0),
                    backgroundColor: 'rgba(255,77,79,0.7)',
                    borderColor: C.red,
                    borderWidth: 1,
                    stack: 'monthly',
                    yAxisID: 'yLeft',
                    order: 2,
                },
                {
                    type: 'line',
                    label: '% On Time',
                    data: ontimePctData,
                    borderColor: C.yellow,
                    backgroundColor: 'rgba(255,197,61,0.15)',
                    tension: 0.4,
                    fill: false,
                    pointRadius: 4,
                    borderWidth: 2,
                    yAxisID: 'yRight',
                    order: 1,
                    spanGaps: true,
                },
                {
                    type: 'line',
                    label: 'Target 90%',
                    data: FYE_MONTH_LABELS.map(() => 90),
                    borderColor: 'rgba(255,77,79,0.85)',
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
        plugins: {
            legend: { labels: { color: C.textSec, font: { size: 11 } } },
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
                max: 100,
                ticks: {
                    color: C.yellow,
                    font: { size: 10 },
                    callback: (v) => `${v}%`
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
        plugins: { legend: { display: false }, tooltip: {} },
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
                backgroundColor: 'rgba(0,212,255,0.1)',
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
            legend: { labels: { color: C.textSec, font: { size: 11 } } },
            tooltip: { mode: 'index', intersect: false }
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
    const delayChartData = {
        labels: delayArr.map(d => d.reason),
        datasets: [{
            data: delayArr.length ? delayArr.map(d => d.count) : [1],
            backgroundColor: delayArr.length ? delayCauseColors : ['#1a3a5c'],
            borderColor: C.card,
            borderWidth: 2,
        }]
    };
    const delayChartOpts = {
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: C.textSec, font: { size: 10 }, boxWidth: 12, padding: 8 }
            },
            tooltip: { enabled: delayArr.length > 0 }
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
                            background: 'linear-gradient(90deg, #041c32 0%, #072035 100%)',
                            border: `1px solid ${C.border}`, borderRadius: 8,
                            padding: '10px 20px', marginBottom: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <div style={{ color: C.cyan, fontWeight: 800, fontSize: 16,
                                              letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                    Tooling Inspection Result Dashboard
                                    <SystemVersionBadge system="tooling-result-dashboard" dark />
                                </div>
                                <div style={{ color: C.textSec, fontSize: 11 }}>{periodLabel}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <Text style={{ color: C.textSec, fontSize: 12 }}>FYE</Text>
                                <Select value={fye} onChange={v => { setFye(v); setMonth(0); }}
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
                            <Col flex="1"><KpiCard label="Total PO" value={kpi?.totalPO}  color={C.blue}   /></Col>
                            <Col flex="1"><KpiCard label="Total Tooling Qty" value={kpi?.totalQty} color={C.cyan}   /></Col>
                            <Col flex="1"><KpiCard label="On Time" value={kpi?.onTime}  color={C.green}  /></Col>
                            <Col flex="1"><KpiCard label="Delay"   value={kpi?.delay}   color={C.red}    /></Col>
                            <Col flex="1"><KpiCard label="Accept"  value={kpi?.accept}  color={C.yellow} /></Col>
                            <Col flex="1"><KpiCard label="Reject"  value={kpi?.reject}  color={C.orange} /></Col>
                        </Row>

                        {/* ── Charts Row 1 ────────────────────────────────────── */}
                        <Row gutter={[10, 10]} style={{ marginBottom: 10 }}>

                            {/* Judgement Ratio */}
                            <Col xs={24} md={3}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle('Judgement Ratio')}
                                    {(() => {
                                        const judged = (kpi?.accept || 0) + (kpi?.reject || 0);
                                        const acceptPct = judged > 0 ? ((kpi.accept / judged) * 100).toFixed(1) : 0;
                                        const rejectPct = judged > 0 ? ((kpi.reject / judged) * 100).toFixed(1) : 0;
                                        return (<>
                                            <DonutChart
                                                data={data?.judgementRatio || []}
                                                colors={[C.green, C.red]}
                                                centerLabel={judged > 0 ? `${acceptPct}%` : '-'}
                                                centerSub="Accept"
                                                size={100}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                                                {[{ label: 'Accept', pct: acceptPct, color: C.green },
                                                  { label: 'Reject', pct: rejectPct, color: C.red }]
                                                    .map(({ label, pct, color }) => (
                                                    <span key={label} style={{ color: C.textSec, fontSize: 11 }}>
                                                        <span style={{ display: 'inline-block', width: 10, height: 10,
                                                                       borderRadius: '50%', background: color,
                                                                       marginRight: 4 }} />
                                                        {label} <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </>);
                                    })()}
                                </div>
                            </Col>

                            {/* Status Ratio */}
                            <Col xs={24} md={3}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle('Status Ratio')}
                                    <DonutChart
                                        data={data?.statusRatio || []}
                                        colors={[C.blue, C.red]}
                                        centerLabel={kpi ? `${kpi.onTimePct}%` : '-'}
                                        centerSub="On Time"
                                        size={100}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                                        {[{ label: 'On time', color: C.blue }, { label: 'Delay', color: C.red }]
                                            .map(({ label, color }) => (
                                            <span key={label} style={{ color: C.textSec, fontSize: 11 }}>
                                                <span style={{ display: 'inline-block', width: 10, height: 10,
                                                               borderRadius: '50%', background: color,
                                                               marginRight: 4 }} />
                                                {label}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </Col>

                            {/* Monthly Trend */}
                            <Col xs={24} md={14}>
                                <div style={{ ...cardStyle, height: 310 }}>
                                    {sectionTitle(`Monthly Trend — FYE${fye}`)}
                                    <div style={{ height: 255 }}>
                                        <Bar data={buildMonthlyChart()} options={monthlyChartOpts} />
                                    </div>
                                </div>
                            </Col>

                            {/* Root Cause for Delay */}
                            <Col xs={24} md={4}>
                                <div style={{ ...cardStyle, height: 310, overflow: 'hidden' }}>
                                    {sectionTitle('Root Cause for Delay')}
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
                                                        return (
                                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                                                                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                                                               background: delayCauseColors[i % delayCauseColors.length] }} />
                                                                <Tooltip title={d.reason}>
                                                                    <span style={{ color: C.textSec, fontSize: 10, flex: 1,
                                                                                   overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                        {d.reason}
                                                                    </span>
                                                                </Tooltip>
                                                                <span style={{ color: delayCauseColors[i % delayCauseColors.length], fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{pct}%</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>;
                                        })()}
                                    }
                                </div>
                            </Col>
                        </Row>

                        {/* ── Charts Row 2 ── [W/C md=6][Daily md=14][Measuring md=4] ── */}
                        <Row gutter={[10, 10]}>

                            {/* WC / PIC Breakdown — md=6 (aligns under Judgement+Status) */}
                            <Col xs={24} md={6}>
                                <div style={{ ...cardStyle, height: 360 }}>
                                    {sectionTitle('Total PO Issue of Each W/C')}
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
                                    {sectionTitle('Daily Tooling Issued')}
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
                                    {sectionTitle('Measuring Tools')}
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
                            {sectionTitle('Inspection Records')}
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
                .dark-select .ant-select-item { background: #0d1f35; color: #e8f4ff; }
                .dark-select .ant-select-item-option-selected { background: #1890ff22; }
                .dark-select .ant-select-item-option-active { background: #0e3a5c; }
                .dark-inspect-table .ant-table { background: #072035; color: #e8f4ff; }
                .dark-inspect-table .ant-table-thead > tr > th { background: #041c32; color: #6fa3c7; border-bottom: 1px solid #0e3a5c; font-size: 11px; }
                .dark-inspect-table .ant-table-tbody > tr > td { background: #072035; color: #e8f4ff; border-bottom: 1px solid #0a2a42; font-size: 12px; }
                .dark-inspect-table .ant-table-tbody > tr:hover > td { background: #0e3a5c !important; }
                .dark-inspect-table .ant-pagination { color: #6fa3c7; }
                .dark-inspect-table .ant-pagination-item a { color: #6fa3c7; }
                .dark-inspect-table .ant-pagination-item-active a { color: #1890ff; }
                .dark-inspect-table .ant-table-column-sorter { color: #6fa3c7; }
            `}</style>
        </Layout>
    );
}
