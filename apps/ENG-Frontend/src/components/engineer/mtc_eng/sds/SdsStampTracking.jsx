import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Layout, Select, Spin, Typography, Row, Col, Table, Tag, Space, Button, App, Tooltip, Progress } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';

// Shared dark palette (matches SdsCoverageDashboard).
const C = {
  bg: '#041320', card: '#072035', border: '#0e3a5c',
  blue: '#1890ff', cyan: '#00d4ff', green: '#52c41a', greenSoft: '#95de64',
  red: '#ff4d4f', yellow: '#ffc53d', orange: '#fa8c16', purple: '#722ed1',
  textPri: '#e8f4ff', textSec: '#6fa3c7',
};

const PART_TYPE_COLOR = {
  ball: '#1890ff', race: '#52c41a', body: '#fa8c16',
  sleeve: '#722ed1', spherical: '#ff4d4f', mecha: '#eb2f96', other: '#6fa3c7',
};

const { Content } = Layout;
const { Text } = Typography;

const cardStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px' };

const sectionTitle = (label) => (
  <div style={{
    color: C.cyan, fontWeight: 700, fontSize: 12, letterSpacing: '0.1em',
    textTransform: 'uppercase', borderBottom: `1px solid ${C.border}`, paddingBottom: 6, marginBottom: 12,
  }}>{label}</div>
);

// ── KPI stat card ──────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color = C.cyan, hint }) => (
  <div style={{ ...cardStyle, borderTop: `3px solid ${color}`, height: '100%', boxSizing: 'border-box' }}>
    <Text style={{ color, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>{label}</Text>
    <Tooltip title={hint}>
      <div style={{ color: C.textPri, fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginTop: 4, cursor: hint ? 'help' : 'default' }}>
        {(value ?? 0).toLocaleString()}
      </div>
    </Tooltip>
    {sub != null && <div style={{ color: C.textSec, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
);

export default function SdsStampTracking() {
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [filterPt, setFilterPt] = useState('');
  const [filterMc, setFilterMc] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Same async-build contract as the coverage dashboard: a cold request returns
  // 202 {building:true}; poll until the cached report (incl. the stamp section)
  // is ready. The stamp data is computed inside the coverage build, so it shares
  // that cache — no separate endpoint.
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
                stopPolling(); setData(r.data); setBuilding(false); setLoading(false);
              }
            } catch { /* keep polling */ }
          }, 5000);
        }
        return;
      }
      setData(res.data); setBuilding(false); setLoading(false);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load stamp tracking data');
      setLoading(false);
    }
  }, [message, stopPolling]);

  useEffect(() => { fetchData(); return stopPolling; }, [fetchData, stopPolling]);

  const stamp = data?.stamp;
  const rows = stamp?.remainingRows || [];

  const machineOptions = useMemo(() => {
    const names = [...new Set(rows.map(r => r.machine_type_name).filter(Boolean))].sort();
    return [{ value: '', label: 'All Machines' }, ...names.map(n => ({ value: n, label: n }))];
  }, [rows]);
  const partTypeOptions = useMemo(() => {
    const types = [...new Set(rows.map(r => r.part_type).filter(Boolean))].sort();
    return [{ value: '', label: 'All Part Types' },
      ...types.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))];
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterPt && r.part_type !== filterPt) return false;
    if (filterMc && r.machine_type_name !== filterMc) return false;
    if (filterLevel && r.coverage_level !== filterLevel) return false;
    return true;
  }), [rows, filterPt, filterMc, filterLevel]);

  const tableRows = useMemo(() => filtered.map((r, i) => ({ ...r, key: i })), [filtered]);

  const exportCsv = useCallback(() => {
    const header = 'cn,machine_type_name,process_code,part_type,coverage_level,last_prod_date';
    const lines = filtered.map(r => [
      r.cn, r.machine_type_name || r.machine_code || '', r.process_code || '',
      r.part_type || '', r.coverage_level || '',
      r.last_prod_date ? new Date(r.last_prod_date).toISOString().slice(0, 10) : '',
    ].join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sds_stamp_remaining_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [filtered]);

  const columns = [
    {
      title: 'CN', dataIndex: 'cn', width: 130, sorter: (a, b) => a.cn.localeCompare(b.cn),
      defaultSortOrder: 'ascend',
      render: v => <Text style={{ color: C.cyan, fontFamily: 'monospace', fontWeight: 600 }}>{v}</Text>,
    },
    {
      title: 'Part Type', dataIndex: 'part_type', width: 90,
      render: v => <Tag style={{ color: PART_TYPE_COLOR[v] || C.textSec, borderColor: PART_TYPE_COLOR[v], background: 'transparent' }}>
        {v?.charAt(0).toUpperCase() + v?.slice(1)}</Tag>,
    },
    {
      title: 'Machine', dataIndex: 'machine_type_name', width: 130,
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
      title: 'PDF Ready', dataIndex: 'coverage_level', width: 120,
      filters: [{ text: 'Complete', value: 'COMPLETE' }, { text: 'Pending', value: 'PENDING' }],
      onFilter: (val, r) => r.coverage_level === val,
      render: v => v === 'COMPLETE'
        ? <Tag color="success" style={{ fontSize: 11 }}>PDF Ready</Tag>
        : <Tag color="warning" style={{ fontSize: 11 }}>Pending config</Tag>,
    },
    {
      title: 'Last Produced', dataIndex: 'last_prod_date', width: 120,
      sorter: (a, b) => (a.last_prod_date || '') > (b.last_prod_date || '') ? 1 : -1,
      render: v => v ? <Text style={{ color: C.textSec, fontSize: 12 }}>{new Date(v).toLocaleDateString('en-GB')}</Text> : '—',
    },
  ];

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-stamp-tracking" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          <Spin spinning={loading} tip={building ? 'Building report… first build can take a few minutes' : 'Loading...'}>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ color: C.cyan, fontSize: 18, fontWeight: 800, letterSpacing: '0.05em' }}>
                  SDS Stamp Tracking
                  <SystemVersionBadge system="sds-stamp-tracking" dark />
                </div>
                <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
                  ติดตามการเซ็น/ปั๊ม (Prepared · Checked · Approved) เทียบกับ Setup Data Sheet report
                  {data?.cachedAt && <span> · อัปเดต {new Date(data.cachedAt).toLocaleString('en-GB')}</span>}
                </div>
              </div>
              <Space>
                <Button icon={<DownloadOutlined />} onClick={exportCsv} size="small" disabled={!filtered.length}
                  title="Export the filtered remaining list to CSV"
                  style={{ background: C.card, borderColor: C.border, color: C.textPri }}>CSV</Button>
                <Button icon={<ReloadOutlined />} onClick={() => fetchData({ refresh: true })} loading={loading} size="small"
                  title="Rebuild report (recomputes coverage + stamp — may take a few minutes)"
                  style={{ background: C.card, borderColor: C.border, color: C.textPri }} />
              </Space>
            </div>

            {/* ── KPI Cards ───────────────────────────────────────────────────── */}
            {stamp && (
              <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
                <Col span={5}>
                  <StatCard label="SDS Sheets" value={stamp.total} color={C.cyan}
                    sub={`${(data?.kpi?.uniqueCnCount ?? 0).toLocaleString()} unique CNs`}
                    hint="Total SDS requirements tracked = CN × machine × process" />
                </Col>
                <Col span={5}>
                  <StatCard label="Stamped" value={stamp.stamped} color={C.green}
                    sub={`${stamp.stampedPct}% · fully signed ${(stamp.stampedFull ?? 0).toLocaleString()}`}
                    hint="Sheets that have an approval record in sds_approval (any role signed)" />
                </Col>
                <Col span={5}>
                  <StatCard label="Remaining" value={stamp.remaining} color={C.orange}
                    sub={`${(100 - (stamp.stampedPct ?? 0)).toFixed(1)}% ยังไม่ stamp`}
                    hint="Tracked sheets with no stamp yet" />
                </Col>
                <Col span={5}>
                  <StatCard label="Remaining (PDF-ready)" value={stamp.completeRemaining} color={C.red}
                    sub={`จาก ${(stamp.completeTotal ?? 0).toLocaleString()} แผ่นที่พร้อมพิมพ์`}
                    hint="COMPLETE sheets (tool + Excel config ready) that still need a stamp — the actionable set" />
                </Col>
                <Col span={4}>
                  <div style={{ ...cardStyle, borderTop: `3px solid ${C.green}`, height: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
                    <Text style={{ color: C.green, fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>Progress</Text>
                    <Progress type="dashboard" size={88} percent={stamp.stampedPct}
                      strokeColor={stamp.stampedPct >= 90 ? C.green : C.cyan} trailColor={C.border}
                      format={p => <span style={{ color: C.textPri, fontWeight: 700 }}>{p}%</span>} />
                  </div>
                </Col>
              </Row>
            )}

            {/* ── Remaining by part type ──────────────────────────────────────── */}
            {stamp?.byPartType?.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                {sectionTitle('Stamp progress by part type')}
                <Row gutter={[14, 10]}>
                  {stamp.byPartType.map(pt => {
                    const pct = pt.total > 0 ? Math.round((pt.stamped / pt.total) * 100) : 0;
                    const color = PART_TYPE_COLOR[pt.part_type] || C.cyan;
                    return (
                      <Col span={8} key={pt.part_type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ color, fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>{pt.part_type}</Text>
                          <Text style={{ color: C.textSec, fontSize: 12 }}>
                            <span style={{ color: C.green }}>{pt.stamped.toLocaleString()}</span> / {pt.total.toLocaleString()}
                            <span style={{ color: C.orange }}> · เหลือ {pt.remaining.toLocaleString()}</span>
                          </Text>
                        </div>
                        <Progress percent={pct} size="small" strokeColor={color} trailColor={C.border}
                          format={p => <span style={{ color: C.textSec, fontSize: 11 }}>{p}%</span>} />
                      </Col>
                    );
                  })}
                </Row>
              </div>
            )}

            {/* ── Remaining by machine (PDF-ready only) ───────────────────────── */}
            {stamp?.byMachine?.length > 0 && (
              <div style={{ ...cardStyle, marginBottom: 14 }}>
                {sectionTitle('Remaining to stamp — by machine (PDF-ready sheets)')}
                <Row gutter={[10, 8]}>
                  {stamp.byMachine.slice(0, 12).map(m => (
                    <Col span={6} key={m.machine}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6 }}>
                        <Text style={{ color: C.textPri, fontFamily: 'monospace', fontSize: 12 }}>{m.machine}</Text>
                        <Tooltip title={`${m.cn_count} distinct CN`}>
                          <Text style={{ color: C.orange, fontWeight: 700, fontSize: 13, cursor: 'help' }}>{m.sheets}</Text>
                        </Tooltip>
                      </div>
                    </Col>
                  ))}
                </Row>
                {stamp.byMachine.length > 12 && (
                  <Text style={{ color: C.textSec, fontSize: 11 }}>+{stamp.byMachine.length - 12} more machines</Text>
                )}
              </div>
            )}

            {/* ── Remaining worklist table ────────────────────────────────────── */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                {sectionTitle('Sheets still un-stamped')}
                <Space>
                  <Select size="small" value={filterPt} onChange={setFilterPt} style={{ width: 130 }}
                    options={partTypeOptions} popupMatchSelectWidth={false} />
                  <Select size="small" value={filterMc} onChange={setFilterMc} style={{ width: 160 }}
                    options={machineOptions} popupMatchSelectWidth={false} showSearch
                    filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())} />
                  <Select size="small" value={filterLevel} onChange={setFilterLevel} style={{ width: 150 }}
                    popupMatchSelectWidth={false}
                    options={[{ value: '', label: 'All' }, { value: 'COMPLETE', label: 'PDF Ready' }, { value: 'PENDING', label: 'Pending config' }]} />
                  <Text style={{ color: C.textSec, fontSize: 11 }}>{filtered.length.toLocaleString()} sheets</Text>
                </Space>
              </div>
              <Table
                dataSource={tableRows}
                columns={columns}
                size="small"
                pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] }}
                scroll={{ x: 'max-content' }}
                style={{ background: C.bg }}
                rowClassName={() => 'sds-stamp-row'}
              />
            </div>

          </Spin>
        </Content>
      </Layout>

      <style>{`
        .sds-stamp-row td { background: ${C.bg} !important; color: ${C.textPri}; }
        .sds-stamp-row:hover td { background: ${C.card} !important; }
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
