import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layout, Table, Tag, Input, Button, Space, Typography, Tooltip, Segmented, App, Empty,
} from 'antd';
import {
  ReloadOutlined, CheckCircleOutlined, WarningOutlined, StopOutlined,
  MinusCircleOutlined, PushpinOutlined,
} from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { SystemVersionBadge } from '../SystemVersionBadge';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';

const { Content } = Layout;
const { Text, Title } = Typography;

// Semantic state colours — deliberately not the theme accent, so "selectable / pinned /
// missing" reads as status rather than branding. Same palette as the TEMPLATE_B page.
const useColors = () => {
  const { theme } = useTheme();
  const c = theme?.colors || {};
  return {
    bg: c.background || '#0f1419',
    panel: c.surface || '#161b22',
    border: c.border || '#22303c',
    textPri: c.textPrimary || '#f0f6fc',
    textSec: c.textSecondary || '#c9d1d9',
    textDim: c.textTertiary || '#9aa5b1',
    accent: c.primary || '#39d9f0',
  };
};

const STATE = {
  rule:       { label: 'เลือกได้ (มีสูตร+rule)', color: '#3f9e5f', icon: <CheckCircleOutlined /> },
  lookup:     { label: 'pin ราย C/N',           color: '#3a7ca5', icon: <PushpinOutlined /> },
  limit_only: { label: 'ขาดสูตร — เลือกไม่ได้',  color: '#c08a1e', icon: <WarningOutlined /> },
  none:       { label: 'ยังไม่ทำ / ไม่ได้ onboard', color: '#c14f4f', icon: <StopOutlined /> },
  na:         { label: 'ไม่ต้องมี (แคตตาล็อก)',  color: '#7d8794', icon: <MinusCircleOutlined /> },
};
const ORDER = ['rule', 'lookup', 'limit_only', 'none', 'na'];
const nf = (n) => Number(n || 0).toLocaleString('en-US');

// same RAG thresholds as scripts/eval_tooling_accuracy.js pmRag()
const ragColor = (t) => (t == null ? '#7d8794' : t >= 85 ? '#3f9e5f' : t >= 60 ? '#c08a1e' : '#c14f4f');

export default function SelectionConditionConformancePage() {
  const C = useColors();
  const { message } = App.useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = useCallback(async (refresh) => {
    setLoading(true);
    try {
      const res = await axios.get(server.MTC_SDS_V2_REPORT_SELECTION_COND, {
        params: refresh ? { refresh: 1 } : undefined,
      });
      setData(res.data);
      if (refresh) message.success('อ่านค่าล่าสุดจากฐานข้อมูลแล้ว');
    } catch (err) {
      message.error(err.response?.data?.error || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(false); }, [load]);

  const rows = data?.rows || [];
  const kpi = data?.kpi || {};

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'gap' && r.state !== 'none' && r.state !== 'limit_only') return false;
      if (filter === 'ok' && r.state !== 'rule' && r.state !== 'lookup') return false;
      if (filter === 'na' && r.state !== 'na') return false;
      if (!term) return true;
      const hay = [r.family, r.machine, r.machineLabel, r.process, r.detail, r.workbook,
        r.reason, r.note, ...(r.formulaToolings || [])].join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [rows, filter, q]);

  const columns = [
    {
      title: 'ตระกูล / เครื่อง', dataIndex: 'family', width: 210, fixed: 'left',
      render: (v, r) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.textPri }}>{v}</span>
          {r.subs?.length ? <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.textDim, marginLeft: 4 }}>
            {r.subs.join('/')}</span> : null}
          <div style={{ marginTop: 2, color: C.textSec, fontSize: 12 }}>
            {r.machine || '—'}
            {r.machineLabel && r.machine && r.machineLabel !== r.machine
              ? <span style={{ color: C.textDim }}> (workbook: {r.machineLabel})</span> : null}
          </div>
          <Tag style={{ marginTop: 4, background: `${STATE[r.state].color}22`,
                        borderColor: `${STATE[r.state].color}66`, color: STATE[r.state].color }}>
            {STATE[r.state].icon} {STATE[r.state].label}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Process / รายละเอียด', dataIndex: 'process', width: 170,
      render: (v, r) => (
        <div>
          <div style={{ color: C.textPri, fontSize: 12.5 }}>{v || '—'}</div>
          <Text style={{ fontSize: 11, color: C.textDim }}>{r.detail || ''}</Text>
        </div>
      ),
    },
    {
      title: 'อัตราเลือกถูก', key: 'acc', width: 140,
      sorter: (a, b) => (a.accuracy?.top1 ?? -1) - (b.accuracy?.top1 ?? -1),
      render: (_, r) => {
        const a = r.accuracy;
        if (!a || !a.n) return <Text style={{ color: C.textDim, fontSize: 12 }}>—</Text>;
        return (
          <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
            <span style={{ color: ragColor(a.top1), fontWeight: 700 }}>{a.top1}%</span>
            <span style={{ color: C.textDim }}> top-1</span>
            <div style={{ color: C.textSec }}>{a.top2}% top-2</div>
            <div style={{ color: C.textDim, fontSize: 11 }}>n={nf(a.n)}{a.none ? ` · miss ${a.none}` : ''}</div>
          </div>
        );
      },
    },
    {
      title: 'Config ที่มี', key: 'cfg', width: 220,
      render: (_, r) => (
        <div style={{ fontFamily: 'monospace', fontSize: 11.5, color: C.textSec, lineHeight: 1.7 }}>
          {r.state === 'na' || r.state === 'none' ? <span style={{ color: C.textDim }}>—</span> : (
            <>
              <div>formula: <b style={{ color: C.textPri }}>{(r.formulaToolings || []).length}</b>
                {(r.formulaToolings || []).length
                  ? <span style={{ color: C.textDim }}> ({r.formulaToolings.join(', ')})</span> : null}</div>
              <div>search rule: <b style={{ color: C.textPri }}>{(r.ruleToolings || []).length}</b></div>
              <div>shelf: {nf(r.shelfRows)} · limit: {r.limits || 0}</div>
              {r.pinRows ? <div>cn/partno-map: <b style={{ color: C.textPri }}>{nf(r.pinRows)}</b></div> : null}
            </>
          )}
        </div>
      ),
    },
    {
      title: 'เหตุผล / หมายเหตุ', dataIndex: 'reason',
      render: (v, r) => (
        <div>
          {v ? <Text style={{ fontSize: 12, color: C.textSec }}>{v}</Text>
             : <Text style={{ color: C.textDim }}>—</Text>}
          {r.note ? (
            <div style={{ marginTop: 4, fontSize: 11.5, color: STATE.limit_only.color }}>
              <WarningOutlined /> {r.note}
            </div>
          ) : null}
          {r.workbook ? (
            <div style={{ marginTop: 4, fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
              {r.workbook}
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  const box = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 6 };

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-selection-cond" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll"
                 style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                        gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <Title level={4} style={{ color: C.textPri, margin: 0 }}>
                เงื่อนไขการเลือก Tooling ตรงตาม 20260202_Tooling_Excel_List แค่ไหน
              </Title>
              <Text style={{ color: C.textSec, fontSize: 13 }}>
                คู่กับหน้า TEMPLATE_B — หน้านั้นถามว่า “จิ๊กถูก config ให้ SDS ไหม”
                หน้านี้ถามว่า “จิ๊กถูกเลือกได้จริงไหม” — มี formula + search_rule, มี pin ราย C/N,
                หรือมีเหตุผลว่าทำไมยังไม่มี
              </Text>
            </div>
            <Space>
              <SystemVersionBadge system="sds-selection-cond" dark />
              <Tooltip title="อ่านค่าล่าสุดจากฐานข้อมูลทันที (ข้ามแคช 10 นาที)">
                <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(true)}>
                  อ่านค่าล่าสุด
                </Button>
              </Tooltip>
            </Space>
          </div>

          {/* headline */}
          <div style={{ ...box, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1,
                              fontVariantNumeric: 'tabular-nums', color: C.textPri }}>
                  {kpi.pctSelectable ?? '—'}%
                </div>
                <Text style={{ color: C.textDim, fontSize: 12 }}>
                  ของ {kpi.scoped ?? 0} ตระกูลที่ workbook ตั้ง<br />「治具選定」ไว้ เลือกได้จริง
                </Text>
              </div>
              {data?.accuracy && data.accuracy.top1 != null ? (
                <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 24 }}>
                  <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1,
                                fontVariantNumeric: 'tabular-nums', color: ragColor(data.accuracy.top2) }}>
                    {data.accuracy.top2}%
                  </div>
                  <Text style={{ color: C.textDim, fontSize: 12 }}>
                    อัตราเลือกถูก top-2 (top-1 {data.accuracy.top1}%) ถ่วงน้ำหนัก<br />
                    {data.accuracy.familiesScored} ตระกูล · {nf(data.accuracy.scoredCns)} CN ·
                    eval {data.accuracy.savedAt ? new Date(data.accuracy.savedAt).toLocaleDateString('th-TH') : ''}
                    {data.accuracy.sampleN ? ` (sample ${nf(data.accuracy.sampleN)})` : ''}
                  </Text>
                </div>
              ) : (
                <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 24, maxWidth: 240 }}>
                  <Text style={{ color: C.textDim, fontSize: 12 }}>
                    ยังไม่มีผล eval — รัน<br />
                    <code style={{ fontSize: 11 }}>node scripts/eval_tooling_accuracy.js --limit 0 --by-tooling --persist-db</code>
                  </Text>
                </div>
              )}
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: 'flex', height: 26, borderRadius: 4, overflow: 'hidden',
                              border: `1px solid ${C.border}` }}>
                  {ORDER.map((k) => (kpi[k === 'limit_only' ? 'limitOnly' : k] ? (
                    <Tooltip key={k} title={`${STATE[k].label} — ${kpi[k === 'limit_only' ? 'limitOnly' : k]}`}>
                      <div style={{ flex: kpi[k === 'limit_only' ? 'limitOnly' : k], background: STATE[k].color }} />
                    </Tooltip>
                  ) : null))}
                </div>
                <Space size={16} wrap style={{ marginTop: 8 }}>
                  {ORDER.map((k) => {
                    const val = kpi[k === 'limit_only' ? 'limitOnly' : k];
                    return (
                      <span key={k} style={{ color: C.textSec, fontSize: 12 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                                       background: STATE[k].color, marginRight: 6 }} />
                        {STATE[k].label} <b style={{ color: C.textPri, fontFamily: 'monospace' }}>{val ?? 0}</b>
                      </span>
                    );
                  })}
                </Space>
              </div>
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <Text style={{ color: C.textSec, fontSize: 12.5 }}>
                <b style={{ color: C.textPri }}>“เลือกไม่ได้” ไม่ได้แปลว่า “ผิด”</b> — จิ๊กแคตตาล็อก
                (มีดกลึงร่อง, คัตเตอร์เซาะร่อง) ไม่มี calc block ให้ encode และเครื่องที่ยังไม่ได้
                onboard เข้า Tooling Select ก็เป็นเรื่อง scope ไม่ใช่ config ผิด ทุกแถวที่ยังขาดต้องมี
                เหตุผลกำกับ — <code>unexplained</code> ต้องเป็น 0
                {kpi.unexplained ? <b style={{ color: STATE.none.color }}> · ⚠ ตอนนี้ {kpi.unexplained}</b> : null}
              </Text>
            </div>
          </div>

          {/* matrix */}
          <div style={{ ...box, padding: 16 }}>
            <Space wrap style={{ marginBottom: 10 }}>
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { label: 'ทั้งหมด', value: 'all' },
                  { label: 'เลือกได้', value: 'ok' },
                  { label: 'ที่ขาด', value: 'gap' },
                  { label: 'ไม่ต้องมี', value: 'na' },
                ]}
              />
              <Input.Search
                allowClear placeholder="ค้นตระกูล / เครื่อง / process / workbook"
                style={{ width: 320 }} value={q} onChange={(e) => setQ(e.target.value)}
              />
              <Text style={{ color: C.textDim, fontSize: 12, fontFamily: 'monospace' }}>
                {shown.length} / {rows.length} แถว
              </Text>
            </Space>
            <Table
              size="small" rowKey={(r) => `${r.family}|${r.machine}|${r.process}`} dataSource={shown}
              columns={columns} loading={loading} scroll={{ x: 1000 }}
              locale={{ emptyText: <Empty description="ไม่มีข้อมูล" /> }}
              pagination={{ pageSize: 30, showSizeChanger: true, size: 'small' }}
            />
          </div>

          <div style={{ marginTop: 10, textAlign: 'right' }}>
            <Text style={{ color: C.textDim, fontSize: 11.5, fontFamily: 'monospace' }}>
              {data?.generatedAt ? `สร้างเมื่อ ${new Date(data.generatedAt).toLocaleString('th-TH')}` : ''}
              {data?.cached ? ' · จากแคช' : ''}
            </Text>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
