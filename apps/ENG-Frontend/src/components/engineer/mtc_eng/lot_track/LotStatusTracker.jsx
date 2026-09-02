import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Layout, Typography, AutoComplete, Input, Button, Alert, Descriptions, Progress,
  Statistic, Row, Col, Card, Steps, Table, Tag, Space, Radio, Empty, Spin, App,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, CheckCircleFilled, SyncOutlined,
  ClockCircleOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
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

const STATUS_META = {
  done: { step: 'finish', tag: 'success', label: 'Done' },
  current: { step: 'process', tag: 'processing', label: 'In progress' },
  pending: { step: 'wait', tag: 'default', label: 'Waiting' },
};

// ── roadmap (vertical stepper) ───────────────────────────────────────────────
function Roadmap({ steps }) {
  const current = steps.findIndex((s) => s.status === 'current');
  const items = steps.map((s) => {
    const meta = STATUS_META[s.status] || STATUS_META.pending;
    const bits = [];
    if (s.machineLabel) bits.push(`🏭 ${s.machineLabel}${s.wc ? ` (WC ${s.wc})` : ''}`);
    if (s.compDate) bits.push(`✅ done ${s.compDate}`);
    if (s.runMinutes != null && s.runMinutes > 0) bits.push(`⏱️ run ${fmtMinutes(s.runMinutes)}`);
    if (s.dwellDays != null) bits.push(`📦 lead ${fmtDays(s.dwellDays)}`);
    if (s.goodQty != null) bits.push(`good ${s.goodQty}${s.badQty ? ` / ng ${s.badQty}` : ''}`);
    if (s.operator) bits.push(`👤 ${s.operator}`);
    return {
      status: meta.step,
      icon: s.status === 'current' ? <SyncOutlined spin /> : undefined,
      title: (
        <Space size={8} wrap>
          <Text strong>{s.order}. {s.nameEn}</Text>
          <Tag>{s.processCode}</Tag>
          {s.nameJp ? <Text type="secondary" style={{ fontSize: 12 }}>{s.nameJp}</Text> : null}
          <Tag color={meta.tag}>{meta.label}</Tag>
          {s.offPlan ? <Tag color="warning">off-plan</Tag> : null}
        </Space>
      ),
      description: bits.length ? (
        <Text type="secondary" style={{ fontSize: 12 }}>{bits.join('  ·  ')}</Text>
      ) : null,
    };
  });
  return <Steps direction="vertical" size="small" current={current === -1 ? items.length : current} items={items} />;
}

// ── detail table ─────────────────────────────────────────────────────────────
const columns = [
  { title: '#', dataIndex: 'order', width: 44, fixed: 'left' },
  { title: 'Process', dataIndex: 'nameEn', width: 180, render: (v, r) => (
    <span style={{ whiteSpace: 'nowrap' }}>
      <Text strong>{v}</Text> <Tag>{r.processCode}</Tag>
      {r.nameJp ? <><br /><Text type="secondary" style={{ fontSize: 12 }}>{r.nameJp}</Text></> : null}
    </span>
  ) },
  { title: 'Status', dataIndex: 'status', width: 110, render: (v) => {
    const m = STATUS_META[v] || STATUS_META.pending;
    return <Tag color={m.tag}>{m.label}</Tag>;
  } },
  { title: 'Machine / WC', dataIndex: 'machineLabel', width: 220, render: (v, r) => v
    ? <span>{v}{r.wc ? <Text type="secondary"> · WC {r.wc}</Text> : null}</span>
    : <Text type="secondary">—</Text> },
  { title: 'good / ng', dataIndex: 'goodQty', width: 100, align: 'right', render: (v, r) => v == null ? '—' : `${v}${r.badQty ? ` / ${r.badQty}` : ''}` },
  { title: 'Cycle', dataIndex: 'cycleSec', width: 74, align: 'right', render: (v) => (v ? `${v}s` : '—') },
  { title: 'Setup', dataIndex: 'setupSec', width: 96, align: 'right', render: (v) => (v ? fmtMinutes(Math.round(v / 60)) : '—') },
  { title: 'Run time', dataIndex: 'runMinutes', width: 116, align: 'right', render: (v) => (v == null ? '—' : fmtMinutes(v)) },
  { title: 'Completed', dataIndex: 'compDate', width: 108, render: (v) => v || '—' },
  { title: 'Lead time', dataIndex: 'dwellDays', width: 92, align: 'right', render: (v) => fmtDays(v) },
];

// ── page ─────────────────────────────────────────────────────────────────────
export default function LotStatusTracker() {
  const { message } = App.useApp();
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);        // full roadmap payload
  const [ambiguous, setAmbiguous] = useState(null); // { lotNo, candidates }
  const [pickedControl, setPickedControl] = useState(null);
  const debRef = useRef(null);

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
      } catch { /* silent — autocomplete is best-effort */ }
    }, 250);
  }, []);

  const fetchLot = useCallback(async (lotNo, controlNo) => {
    const lot = (lotNo || '').trim();
    if (!lot) return;
    setLoading(true);
    setData(null); setAmbiguous(null);
    try {
      const { data: d } = await axios.get(`${server.MTC_LOT_TRACK}/${encodeURIComponent(lot)}`, {
        params: controlNo ? { control_no: controlNo } : {},
      });
      if (d.ambiguous) {
        setAmbiguous({ lotNo: lot, candidates: d.candidates || [] });
        setPickedControl(null);
      } else {
        setData(d);
      }
    } catch (e) {
      if (e.response?.status === 404) message.warning(`Lot "${lot}" not found`);
      else message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const summary = data?.summary;
  const header = data?.header;

  const statCards = useMemo(() => {
    if (!summary) return null;
    return (
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Done" value={summary.doneSteps} suffix={`/ ${summary.totalSteps}`} prefix={<CheckCircleFilled style={{ color: '#52c41a' }} />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Remaining" value={summary.remainingSteps} suffix="steps" /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total run time" value={fmtMinutes(summary.totalRunMinutes)} valueStyle={{ fontSize: 18 }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Lead time (actual)" value={fmtDays(summary.elapsedDays)} valueStyle={{ fontSize: 18 }} /></Card></Col>
      </Row>
    );
  }, [summary]);

  return (
    <Layout style={{ height: '100%' }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="lot-track" defaultOpenKeys="report" />
      <Layout>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '16px 20px' }}>
          <div style={{ marginBottom: 14 }}>
            <Title level={4} style={{ margin: 0 }}>
              Lot Status Tracker
              <SystemVersionBadge system="lot-track" />
            </Title>
            <Text type="secondary">Enter a lot number to see which processes it has passed, where it is now, and how many steps remain.</Text>
          </div>

          <Space.Compact style={{ width: '100%', maxWidth: 560, marginBottom: 16 }}>
            <AutoComplete
              style={{ width: '100%' }}
              options={options}
              value={term}
              onChange={onSearchInput}
              onSelect={(v) => { setTerm(v); fetchLot(v); }}
              placeholder="Lot no. e.g. UD007T7"
            >
              <Input
                allowClear
                onPressEnter={() => fetchLot(term)}
                prefix={<SearchOutlined />}
              />
            </AutoComplete>
            <Button type="primary" loading={loading} onClick={() => fetchLot(term)}>Search</Button>
            {data ? (
              <Button icon={<ReloadOutlined />} onClick={() => fetchLot(header.lotNo, header.controlNo)} title="Refresh" />
            ) : null}
          </Space.Compact>

          {loading ? <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div> : null}

          {/* ambiguous lot_no → pick a control number */}
          {!loading && ambiguous ? (
            <Card size="small" title={`Lot "${ambiguous.lotNo}" matches several control numbers — pick one`} style={{ maxWidth: 720 }}>
              <Radio.Group
                value={pickedControl}
                onChange={(e) => { setPickedControl(e.target.value); fetchLot(ambiguous.lotNo, e.target.value); }}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                {ambiguous.candidates.map((c) => (
                  <Radio key={c.controlNo} value={c.controlNo}>
                    <Space wrap>
                      <Text strong>{c.controlNo}</Text>
                      <Text type="secondary">{c.partsNo}</Text>
                      {c.gnk ? <Tag>{c.gnk}</Tag> : null}
                      {c.entryDate ? <Text type="secondary">in {c.entryDate}</Text> : null}
                      {c.remark ? <Tag color="warning">{c.remark}</Tag> : null}
                    </Space>
                  </Radio>
                ))}
              </Radio.Group>
            </Card>
          ) : null}

          {/* result */}
          {!loading && data ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type={header.isCancelled ? 'error' : 'warning'}
                showIcon
                message={header.isCancelled ? 'This lot has been cancelled / closed' : `Data as of ${fmtDateTime(data.dataAsOf)} — not real-time`}
                description={data.syncNote}
              />

              <Descriptions
                bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}
                title={<Space wrap><Text strong style={{ fontSize: 16 }}>{header.lotNo}</Text><Tag color="blue">{header.controlNo}</Tag><Text>{header.partsNo}</Text></Space>}
              >
                <Descriptions.Item label="GNK">{header.gnk || '—'}</Descriptions.Item>
                <Descriptions.Item label="Plant">{header.plant || '—'}</Descriptions.Item>
                <Descriptions.Item label="Owner">{header.chargePerson || '—'}</Descriptions.Item>
                <Descriptions.Item label="Order qty / FP">{header.reqQty} / {header.fpQty}</Descriptions.Item>
                <Descriptions.Item label="Latest good qty">
                  {data.steps.filter((s) => s.status === 'done').slice(-1)[0]?.goodQty ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Entered">{header.entryDate || '—'}</Descriptions.Item>
                <Descriptions.Item label="Plan finish">{header.compPlanDate || '—'}</Descriptions.Item>
                {header.remark ? <Descriptions.Item label="Remark" span={3}>{header.remark}</Descriptions.Item> : null}
              </Descriptions>

              <Card size="small">
                <Row gutter={[16, 12]} align="middle">
                  <Col xs={24} md={8}>
                    <Progress type="dashboard" percent={summary.pctComplete} size={140} />
                  </Col>
                  <Col xs={24} md={16}>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Text style={{ fontSize: 15 }}>
                        {summary.hasCurrent ? (
                          <>Now at step <Text strong>{summary.currentOrder}/{summary.totalSteps}</Text> — <Text strong>{summary.currentStepName}</Text></>
                        ) : (
                          <>All steps complete ({summary.totalSteps} processes)</>
                        )}
                      </Text>
                      {summary.lastDoneStepName ? (
                        <Text type="secondary">
                          <EnvironmentOutlined /> Last passed: {summary.lastDoneStepName}
                          {summary.lastMachine ? ` @ ${summary.lastMachine}` : ''}
                        </Text>
                      ) : null}
                      {statCards}
                    </Space>
                  </Col>
                </Row>
              </Card>

              <Card size="small" title="Roadmap" styles={{ body: { maxHeight: 620, overflowY: 'auto' } }}>
                <Roadmap steps={data.steps} />
              </Card>

              <Card size="small" title="Process detail">
                <Table
                  size="small"
                  rowKey="order"
                  columns={columns}
                  dataSource={data.steps}
                  pagination={false}
                  scroll={{ x: 1120 }}
                  rowClassName={(r) => (r.status === 'current' ? 'lot-track-current-row' : '')}
                />
              </Card>
            </Space>
          ) : null}

          {!loading && !data && !ambiguous ? (
            <Empty description="No data yet — enter a lot number and search" style={{ marginTop: 64 }} />
          ) : null}
        </Content>
      </Layout>

      <style>{`.lot-track-current-row > td { background: rgba(24,144,255,0.08) !important; }`}</style>
    </Layout>
  );
}
