import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Layout, Table, Select, Input, Button, Space, Typography, Alert, Collapse, Tag, Empty, App,
} from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { server } from '../../../../constance/constance';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { useTheme } from '../../../../theme';

const { Content } = Layout;
const { Text } = Typography;

// Same dark-panel palette as the TEMPLATE_B / Selection-Condition conformance pages —
// this page lives in the same tab bar and should read as one system.
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

// dim_a/dim_b/... -> A/B/... — the drawing-dimension letters these columns are named
// after (see .claude/rules/mtc-tooling.md "parameter_name = DWG Dimension Label").
// Columns outside that convention (id, machine, tooling_no/name, timestamps) keep a
// fixed label or are hidden entirely.
// tooling_name/machine are dropped from the table itself — already selected via the
// dropdowns above it, so repeating them as a column is redundant.
const HIDDEN_COLS = new Set(['id', 'tooling_name', 'machine']);
const FIXED_LABEL = { tooling_no: 'Tooling No.', tooling_name: 'Tooling', machine: 'Machine' };
const dimLabel = (col) => {
  if (FIXED_LABEL[col]) return FIXED_LABEL[col];
  const m = /^dim_([a-z0-9]+)$/i.exec(col);
  return m ? m[1].toUpperCase() : col;
};

const nf = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== '' && /^-?\d+(\.\d+)?$/.test(String(v).trim())
    ? (Number.isInteger(n) ? String(n) : n.toFixed(2))
    : String(v);
};

export default function ToolingInventoryBrowserPage({ embedded = false }) {
  const C = useColors();
  const { message } = App.useApp();

  const [machines, setMachines] = useState([]);
  const [machineId, setMachineId] = useState(null);
  const [toolings, setToolings] = useState([]);
  const [toolingName, setToolingName] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [formulas, setFormulas] = useState([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  // ── machines (dropdown 1) — only ones with a shelf table wired up ──────────
  const loadMachines = useCallback(async () => {
    setLoadingMachines(true);
    try {
      const res = await axios.get(server.TSV2_MACHINES);
      const list = (res.data?.machines || []).filter((m) => m.inventory_table);
      setMachines(list);
    } catch (err) {
      message.error(err.response?.data?.error || 'โหลดรายชื่อเครื่องไม่สำเร็จ');
    } finally {
      setLoadingMachines(false);
    }
  }, [message]);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  const machine = useMemo(() => machines.find((m) => m.id === machineId) || null, [machines, machineId]);

  // ── on machine change: toolings (formula-backed = actually usable), columns, shelf rows ──
  useEffect(() => {
    if (!machineId || !machine) { setToolings([]); setColumns([]); setRows([]); setFormulas([]); return; }
    setToolingName(null);
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      try {
        const [tRes, cRes, iRes] = await Promise.all([
          axios.get(`${server.TSV2_TOOLINGS}/${machineId}/toolings`),
          axios.get(`${server.TSV2_COLUMNS}/${machine.inventory_table}`),
          axios.get(`${server.TSV2_INVENTORY}/${machine.inventory_table}`),
        ]);
        if (cancelled) return;
        setToolings(tRes.data?.toolings || []);
        setColumns((cRes.data?.columns || []).filter((c) => !HIDDEN_COLS.has(c)));
        setRows(iRes.data?.rows || []);
      } catch (err) {
        if (!cancelled) message.error(err.response?.data?.error || 'โหลดข้อมูล shelf ไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [machineId, machine, message]);

  // ── formulas for the selected tooling (the DB's copy of the Excel calc block) ──
  useEffect(() => {
    if (!machineId) { setFormulas([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${server.TSV2_FORMULAS}/${machineId}/formulas`, {
          params: toolingName ? { tooling_name: toolingName } : undefined,
        });
        if (!cancelled) setFormulas(res.data?.formulas || []);
      } catch { /* non-critical panel — stay silent, the table above still works */ }
    })();
    return () => { cancelled = true; };
  }, [machineId, toolingName]);

  const shownRows = useMemo(() => {
    if (!toolingName) return rows;
    return rows.filter((row) => row.tooling_name === toolingName);
  }, [rows, toolingName]);

  // Per-column search box, dropped from the header's filter funnel icon — replaces
  // the single global search box (moved here per request).
  const searchInputRef = useRef(null);
  const getColumnSearchProps = (col) => ({
    filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
      <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchInputRef}
          placeholder={`ค้นหา ${dimLabel(col)}`}
          value={selectedKeys[0]}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, display: 'block', width: 180 }}
        />
        <Space>
          <Button type="primary" size="small" icon={<SearchOutlined />} onClick={() => confirm()}>
            ค้นหา
          </Button>
          <Button size="small" onClick={() => { clearFilters?.(); confirm(); }}>
            ล้าง
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered) => <SearchOutlined style={{ color: filtered ? C.accent : undefined }} />,
    onFilter: (value, record) => String(record[col] ?? '').toLowerCase().includes(String(value).toLowerCase()),
    filterDropdownProps: {
      onOpenChange: (open) => { if (open) setTimeout(() => searchInputRef.current?.select(), 100); },
    },
  });

  const tableColumns = useMemo(() => {
    const order = ['tooling_no'];
    const rest = columns.filter((c) => !order.includes(c));
    const ordered = [...order.filter((c) => columns.includes(c)), ...rest];
    return ordered.map((col) => {
      const isDim = /^dim_/i.test(col);
      const base = {
        title: dimLabel(col),
        dataIndex: col,
        key: col,
        width: col === 'tooling_no' ? 170 : isDim ? 90 : 120,
        fixed: col === 'tooling_no' ? 'left' : undefined,
        render: isDim ? (v) => <span style={{ fontFamily: 'monospace' }}>{nf(v)}</span>
          : col === 'tooling_no' ? (v) => <span style={{ fontFamily: 'monospace', color: C.accent }}>{v}</span>
          : undefined,
      };
      if (isDim) {
        base.sorter = (a, b) => (parseFloat(a[col]) || 0) - (parseFloat(b[col]) || 0);
        Object.assign(base, getColumnSearchProps(col));
      }
      if (col === 'tooling_no') {
        // Natural sort — tooling_no is "4560-18-1001"-shaped, not a plain string,
        // so a plain localeCompare would put "-10" before "-2".
        base.sorter = (a, b) => String(a[col] || '').localeCompare(String(b[col] || ''), undefined, { numeric: true });
        Object.assign(base, getColumnSearchProps(col));
      }
      return base;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, C.accent]);

  const machineOptions = machines.map((m) => ({
    value: m.id,
    label: m.machine_group || m.machine_name,
  }));

  const bodyContent = (
    <>
      <Alert
        type="warning" showIcon closable style={{ marginBottom: 12 }}
        message="ตารางนี้คือข้อมูล shelf ที่ import เข้า DB แล้วเท่านั้น"
        description={
          <>
            ค่า dimension (A, B, C, …) เป็นสิ่งที่ระบบบันทึกไว้ ณ ตอนที่ทำ migration —
            หากสงสัยว่าไม่ตรงกับปัจจุบัน หรือกำลังจะใช้ตัวเลขนี้ตัดสินใจเรื่องสำคัญ
            <b style={{ color: C.textPri }}> ให้เปิดไฟล์ Excel ต้นทางบน G: ยืนยันก่อนเสมอ</b> —
            ดูที่มาของแต่ละเครื่อง/ไฟล์ได้ใน <code>.claude/rules/tooling-select.md</code>
            (index <code>20260202_Tooling_Excel_List.xlsm</code> → workbook รายเครื่องใต้{' '}
            <code>DesignStandards_Dimensions_InventoryData\</code>). Excel คือความจริง, DB คือสำเนา
          </>
        }
      />

      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          showSearch style={{ width: 260 }} placeholder="เลือกเครื่อง (Machine)"
          loading={loadingMachines} value={machineId} onChange={setMachineId}
          options={machineOptions}
          optionFilterProp="label"
        />
        <Select
          allowClear style={{ width: 260 }} placeholder="เลือก Tooling (ว่าง = ทั้งหมด)"
          disabled={!machineId} value={toolingName} onChange={setToolingName}
          options={toolings.map((t) => ({ value: t, label: t }))}
        />
        <ReloadOutlined
          onClick={() => machineId && setMachineId((id) => { loadMachines(); return id; })}
          style={{ cursor: 'pointer', color: C.textDim }}
          title="รีเฟรชรายชื่อเครื่อง"
        />
        <Text style={{ color: C.textDim, fontSize: 12, fontFamily: 'monospace' }}>
          {machineId ? `${shownRows.length} / ${rows.length} แถว` : `${machines.length} เครื่องพร้อม shelf`}
        </Text>
      </Space>

      {!machineId ? (
        <Empty description="เลือกเครื่องก่อนเพื่อดู tool list" style={{ marginTop: 60 }} />
      ) : (
        <>
          {formulas.length > 0 && (
            <Collapse
              style={{ marginBottom: 12 }}
              items={[{
                key: 'f',
                label: (
                  <span style={{ color: C.textPri }}>
                    สูตรที่ตั้งไว้ใน DB ({formulas.length}) — เทียบกับ calc block ใน Excel ก่อนเชื่อ
                  </span>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {formulas.map((f) => (
                      <div key={f.id} style={{ fontFamily: 'monospace', fontSize: 12.5, color: C.textSec }}>
                        <Tag color="blue">{f.tooling_name}</Tag>
                        <b style={{ color: C.textPri }}>{f.output_key}</b> = {f.formula_expr}
                        {f.condition_expr ? <span style={{ color: C.textDim }}> [if {f.condition_expr}]</span> : null}
                        {f.description ? (
                          <div style={{ color: C.textDim, fontSize: 11, marginLeft: 4 }}>{f.description}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ),
              }]}
            />
          )}

          <Table
            size="small"
            rowKey="id"
            dataSource={shownRows}
            columns={tableColumns}
            loading={loadingData}
            scroll={{ x: 900 }}
            locale={{ emptyText: <Empty description="ไม่มีข้อมูล" /> }}
            pagination={{ pageSize: 50, showSizeChanger: true, size: 'small' }}
          />
        </>
      )}
    </>
  );

  if (embedded) return bodyContent;

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="tooling-select" defaultOpenKeys="sub1" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          {bodyContent}
        </Content>
      </Layout>
    </Layout>
  );
}
