import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Table, Tag, Space, Button, Select, Input, Typography, Spin, Alert } from 'antd';
import { ReloadOutlined, FileSearchOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { httpClient as axios } from '../../../../utils/HttpClient';

const { Content } = Layout;
const { Text } = Typography;

// Real data, not a mock: this reads the same `GET /api/sds/v2/report/coverage`
// endpoint SdsCoverageDashboard.jsx charts, and its `needsAttention` array already
// merges in PB Ring rows for CNs on the PB Ring monitor list (see
// `mergeInPbRingCoverage` in sdsV2ReportController.js) — so a PB Ring sheet shows
// up here ONLY when that CN is on the monitor list, not PB Ring's full backlog.
// This page adds no detection logic of its own; it is a worklist view + a launcher
// into the real sheet (SdsV2Page), which already has the add/edit/delete + sign UI.
const REASON_META = {
  NO_TOOL:          { label: 'ไม่มี Tooling จับคู่', color: 'red' },
  NO_EXCEL:         { label: 'ไม่มี Machine Config', color: 'orange' },
  NO_TOOL_NO_EXCEL: { label: 'ขาดทั้ง Tooling และ Config', color: 'red' },
  NO_STAMP:         { label: 'รอเซ็น (Config ครบแล้ว)', color: 'gold' },
};

export default function SdsCompletenessTestPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const c = theme?.colors || {};
  const C = {
    bg: c.background || '#f2f3ee',
    card: c.surface || '#ffffff',
    border: c.border || '#d7dace',
    textPri: c.textPrimary || '#1b2017',
    textSec: c.textSecondary || '#636b5a',
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [partType, setPartType] = useState('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  // Mirrors SdsCoverageDashboard.jsx's fetchData: a cold report build returns
  // 202 {building:true}; poll every 5s until the cached payload is ready.
  const fetchData = useCallback(async (opts = {}) => {
    setLoading(true);
    setError(null);
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
        return;
      }
      setData(res.data);
      setBuilding(false);
      setLoading(false);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'โหลดรายงานไม่สำเร็จ');
      setLoading(false);
    }
  }, [stopPolling]);

  useEffect(() => {
    fetchData();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = data?.needsAttention || [];

  const partTypeOptions = useMemo(() => {
    const set = new Set(rows.map(r => r.part_type).filter(Boolean));
    return [...set].sort().map(v => ({ label: v, value: v }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return rows.filter(r => {
      if (partType && r.part_type !== partType) return false;
      if (reason && r.pending_reason !== reason) return false;
      if (q && !String(r.cn || '').toUpperCase().includes(q)) return false;
      return true;
    });
  }, [rows, partType, reason, search]);

  const openSheet = (r) => {
    const machine = r.machine_type_name || r.machine_code || '';
    const params = new URLSearchParams({ cn: r.cn, machine, process: r.process_code || '' });
    navigate(`${MTC_PATHS.SDS_CN_EDITOR}?${params.toString()}`);
  };

  const columns = [
    { title: 'C/N', dataIndex: 'cn', width: 120, fixed: 'left',
      sorter: (a, b) => String(a.cn).localeCompare(String(b.cn)),
      render: (v) => <Text strong style={{ fontFamily: 'monospace' }}>{v}</Text> },
    { title: 'Part Type', dataIndex: 'part_type', width: 100 },
    { title: 'เครื่อง', width: 160,
      render: (_, r) => r.machine_type_name || r.machine_code || <Text type="danger">ไม่ระบุ</Text> },
    { title: 'Process', dataIndex: 'process_code', width: 90,
      sorter: (a, b) => String(a.process_code || '').localeCompare(String(b.process_code || '')) },
    { title: 'สถานะที่ขาด', dataIndex: 'pending_reason', width: 190,
      filters: Object.entries(REASON_META).map(([value, m]) => ({ text: m.label, value })),
      onFilter: (value, r) => r.pending_reason === value,
      render: (v) => {
        const m = REASON_META[v] || { label: v || '-', color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      } },
    { title: 'ที่มา Tooling', dataIndex: 'tooling_source', width: 110,
      render: (v) => v === 'saved' ? <Tag>Saved</Tag> : v === 'not_required' ? <Tag color="blue">No Jig</Tag> : v ? <Tag color="purple">{v}</Tag> : '-' },
    { title: '', width: 70, fixed: 'right',
      render: (_, r) => (
        <Button size="small" icon={<FileSearchOutlined />} onClick={(e) => { e.stopPropagation(); openSheet(r); }}>
          เปิด
        </Button>
      ) },
  ];

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-v2" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          <Spin spinning={loading} tip={building ? 'กำลังสร้างรายงาน (ครั้งแรกอาจใช้เวลาหลายนาที)…' : 'กำลังโหลด...'}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ color: C.textPri, fontSize: 18, fontWeight: 800 }}>
                  SDS Completeness Worklist <Tag color="gold" style={{ marginLeft: 6 }}>Test Page</Tag>
                </div>
                <div style={{ color: C.textSec, fontSize: 12, marginTop: 2 }}>
                  ข้อมูลจริงจาก Coverage Report (General Part) — PB Ring จะปรากฏที่นี่เฉพาะ C/N ที่อยู่ใน Monitor List เท่านั้น ·
                  คลิก "เปิด" เพื่อไปหน้าแก้ไข Tooling/Parameter ของชีทนั้น (เพิ่ม/แก้ไข/ลบได้จริง มีปุ่มไปหน้าเซ็น/พิมพ์ PDF อยู่ในหน้านั้น)
                </div>
              </div>
              <Button icon={<ReloadOutlined />} onClick={() => fetchData({ refresh: true })} loading={loading}>
                รีเฟรช
              </Button>
            </div>

            {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Select allowClear placeholder="Part Type" value={partType || undefined} onChange={(v) => setPartType(v || '')}
                options={partTypeOptions} style={{ width: 140 }} size="small" />
              <Select allowClear placeholder="สถานะที่ขาด" value={reason || undefined} onChange={(v) => setReason(v || '')}
                options={Object.entries(REASON_META).map(([value, m]) => ({ label: m.label, value }))}
                style={{ width: 220 }} size="small" />
              <Input.Search allowClear placeholder="ค้นหา C/N" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: 180 }} size="small" />
              <Text style={{ color: C.textSec, fontSize: 12 }}>{filtered.length.toLocaleString()} / {rows.length.toLocaleString()} รายการ</Text>
            </div>

            <Table
              rowKey={(r) => `${r.cn}|${r.machine_type_name || r.machine_code}|${r.process_code}`}
              columns={columns}
              dataSource={filtered}
              size="small"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 50, showSizeChanger: true }}
              onRow={(r) => ({ onClick: () => openSheet(r), style: { cursor: 'pointer' } })}
            />
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
