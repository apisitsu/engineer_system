import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Select, Spin, Row, Col, Typography, Table } from 'antd';
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
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ChartTitle, ChartTooltip, Legend);

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

    const fetchData = useCallback(async (f) => {
        setLoading(true);
        try {
            const res = await axios.get(server.MTC_TOOL_REQUEST_REPORT, { params: { fye: f } });
            setData(res.data);
        } catch (e) {
            console.error('General DWG Report error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(fye); }, [fye, fetchData]);

    // ── Chart 1: monthly On time / Delay + %On time, with a previous-FYE average
    // baseline bar (same device as InspectionResultDashboard's Monthly Trend).
    const monthlyChartData = useMemo(() => {
        const byMonth = {};
        (data?.monthlyTrend || []).forEach(r => {
            const m = parseInt(r.month?.split('-')[1], 10);
            if (m) byMonth[m] = r;
        });
        const prev = data?.prevFyeAvg;
        const avgLabel = prev ? `FYE${prev.fye} avg` : 'Prev avg';
        const labels = [avgLabel, ...FYE_MONTH_LABELS];
        const lead = (arr, val) => [val, ...arr];

        return {
            labels,
            datasets: [
                {
                    type: 'bar', label: 'On time',
                    data: lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.onTime ?? 0), prev?.onTime ?? null),
                    backgroundColor: lead(FYE_MONTH_NUMS.map(() => hexToRgba(C.green, 0.7)), hexToRgba(C.green, 0.3)),
                    borderColor: C.green, borderWidth: 1, stack: 'monthly',
                },
                {
                    type: 'bar', label: 'Delay',
                    data: lead(FYE_MONTH_NUMS.map(num => byMonth[num]?.delay ?? 0), prev?.delay ?? null),
                    backgroundColor: lead(FYE_MONTH_NUMS.map(() => hexToRgba(C.red, 0.7)), hexToRgba(C.red, 0.3)),
                    borderColor: C.red, borderWidth: 1, stack: 'monthly',
                },
            ],
        };
    }, [data, C]);

    const monthlyChartOpts = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: C.textPri, font: { size: 11 }, boxWidth: 12, padding: 12 } },
            tooltip: {
                mode: 'index', intersect: false,
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.raw;
                        if (val === null || val === undefined) return null;
                        return ` ${ctx.dataset.label}: ${val}`;
                    },
                },
            },
        },
        scales: {
            x: { ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
            y: { type: 'linear', stacked: true, ticks: { color: C.textSec, font: { size: 10 } }, grid: { color: C.gridLine } },
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
                backgroundColor: hexToRgba(C[STAGE_COLOR_KEYS[i % STAGE_COLOR_KEYS.length]], 0.85),
                borderRadius: 2,
            })),
        };
    }, [data, C]);

    const stageChartOpts = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
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
                                <Select value={fye} onChange={setFye} style={{ width: 100 }} popupClassName="dark-select" loading={fyeOptions.length === 0}>
                                    {fyeOptions.map(f => <Option key={f} value={f}>FYE{f}</Option>)}
                                </Select>
                            </div>
                        </div>

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
