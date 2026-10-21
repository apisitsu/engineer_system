import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout, Space, Button, Select, Input, Typography, Spin, Alert, App,
} from 'antd';
import { SaveOutlined, FilePdfOutlined, ArrowLeftOutlined, ReloadOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { MenuTemplate } from '../../../menu_sidebar/menu_template';
import { useTheme } from '../../../../theme';
import { server } from '../../../../constance/constance';
import { MTC_PATHS } from '../../../../constance/mtc_constance';
import { httpClient as axios } from '../../../../utils/HttpClient';

const { Content } = Layout;
const { Text, Title } = Typography;

// Mirrors the constants `MachineConfigTab` (SDS Admin → Excel Config) uses, so this
// grid is the same shape as the real sheet's condition block.
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const ROW_RANGE = Array.from({ length: 43 }, (_, i) => i + 16); // 16–58
const GW_COL_LETTERS = ['AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV'];
const GW_ROW_RANGE = [53, 54, 55, 56, 57, 58];
const HEADER_CELL_FIELDS = [
  { key: 'program_no', label: 'Program No' },
  { key: 'program_name', label: 'Program Name' },
  { key: 'ct', label: 'Cycle Time (CT)' },
  { key: 'category', label: 'Category' },
];

export default function SdsCnQuickEditorPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const c = theme?.colors || {};
  const C = {
    bg: c.background || '#f2f3ee',
    card: c.surface || '#ffffff',
    border: c.border || '#d7dace',
    textPri: c.textPrimary || '#1b2017',
    textSec: c.textSecondary || '#636b5a',
  };

  const initial = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return { cn: q.get('cn') || '', machine: q.get('machine') || '', process: q.get('process') || '' };
  }, []);

  const [cn, setCn] = useState(initial.cn);
  const [machine, setMachine] = useState(initial.machine || null);
  const [processCode, setProcessCode] = useState(initial.process || '');
  const [machineOptions, setMachineOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]); // sds_parameter rows for this CN override scope
  const [defaultRows, setDefaultRows] = useState([]); // sds_parameter rows with cn IS NULL (machine default)
  const [gridEdits, setGridEdits] = useState({}); // param_key -> draft value, for every cell the user has touched
  const [pdfKey, setPdfKey] = useState(0); // cache-buster, bumped to force the PDF preview to re-fetch
  const [showPdf, setShowPdf] = useState(true);

  useEffect(() => {
    axios.get(server.MTC_SDS_V2_ADMIN_MACHINE_TYPES)
      .then((r) => {
        const seen = new Set();
        setMachineOptions((r.data || [])
          .filter((m) => m.is_active && m.machine_type_name && !seen.has(m.machine_type_name) && seen.add(m.machine_type_name))
          .map((m) => ({ value: m.machine_type_name, label: m.machine_group || m.machine_type_name })));
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!cn.trim() || !machine) { setRows([]); setDefaultRows([]); return; }
    setLoading(true);
    setError(null);
    setGridEdits({});
    try {
      const [cnRes, defaultsRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, {
          params: { cn: cn.trim(), machine_type_name: machine, process_code: processCode || 'null' },
        }),
        axios.get(server.MTC_SDS_V2_ADMIN_PARAMETERS, { params: { cn: 'null', machine_type_name: machine } }),
      ]);
      setRows(cnRes.data || []);
      setDefaultRows(defaultsRes.data || []);
      setPdfKey((k) => k + 1);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [cn, machine, processCode]);

  useEffect(() => {
    if (initial.cn && initial.machine) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Condition/GW/header grid: override (rows) merged over machine default (defaultRows) ──
  const overrideByKey = useMemo(() => {
    const m = new Map();
    for (const r of rows) m.set(r.param_key, r);
    return m;
  }, [rows]);
  const defaultByKey = useMemo(() => {
    const m = new Map();
    for (const r of defaultRows) m.set(r.param_key, r);
    return m;
  }, [defaultRows]);

  const cellValue = (key) => {
    if (gridEdits[key] !== undefined) return gridEdits[key];
    return overrideByKey.get(key)?.param_value ?? defaultByKey.get(key)?.param_value ?? '';
  };
  const cellIsOverridden = (key) => {
    if (gridEdits[key] !== undefined) return gridEdits[key].trim() !== '';
    return overrideByKey.has(key);
  };
  const cellIsHeaderRow = (rowNum) => defaultByKey.get(`row_${rowNum}_is_header`)?.param_value === '1';
  const cellIsTypeValue = (key) => defaultByKey.get(`${key}_type`)?.param_value === 'value';
  const touchedCount = Object.keys(gridEdits).length;

  const scopeReady = !!(cn.trim() && machine);
  const setGridCell = (key, val) => setGridEdits((d) => ({ ...d, [key]: val }));

  // Saves only the cells the user actually touched: a non-empty value becomes a CN
  // override (upsert), an emptied cell that HAD an override deletes it (reverting to
  // the machine default) — same semantics as MachineConfigTab's CN-override save.
  const saveGrid = async () => {
    const keys = Object.keys(gridEdits);
    if (!keys.length) { message.info('ไม่มีช่องไหนถูกแก้ไข'); return; }
    setSaving(true);
    try {
      const upserts = [];
      const deleteIds = [];
      for (const key of keys) {
        const val = (gridEdits[key] || '').trim();
        const existingId = overrideByKey.get(key)?.id;
        if (val) upserts.push({ param_key: key, param_value: val });
        else if (existingId) deleteIds.push(existingId);
      }
      if (upserts.length) {
        await axios.put(server.MTC_SDS_V2_ADMIN_PARAMETERS_BULK, {
          cn: cn.trim(), machine_type_name: machine, process_code: processCode || null, params: upserts,
        });
      }
      await Promise.all(deleteIds.map((id) => axios.delete(`${server.MTC_SDS_V2_ADMIN_PARAMETERS}/${id}`)));
      message.success(`บันทึก ${keys.length} ช่องแล้ว`);
      await load(); // also bumps pdfKey, so the preview below reflects the save
    } catch (e) {
      message.error(e?.response?.data?.error || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const openSignPage = () => {
    const params = new URLSearchParams({ cn: cn.trim(), machine: machine || '', process: processCode || '' });
    navigate(`${MTC_PATHS.SDS_V2}?${params.toString()}`);
  };

  // Same mechanism SdsV2Page's "Open PDF" uses — `verifyToken` accepts a JWT via
  // `?token=` for file-download / `target="_blank"` style requests
  // (apps/ENG-Backend/middleware/auth.js), which is also what makes this work
  // inside a plain <iframe src="…">, with no custom header to attach.
  const pdfUrl = scopeReady && processCode
    ? `${server.API_URL}api/sds/v2-headless/pdf-chrome/grid?${new URLSearchParams({
        cn: cn.trim(), machine_type_name: machine, process_code: processCode,
        _t: String(pdfKey), token: localStorage.getItem('token') || '',
      }).toString()}`
    : null;

  // One cell of the condition/GW grid. `width` lets the GW grid (AN-AV, longer text
  // like "GRINDING WHEEL DETAIL") run wider than the main A-I grid.
  const gridCellInput = (key, width) => {
    const overridden = cellIsOverridden(key);
    return (
      <Input
        size="small"
        value={cellValue(key)}
        onChange={(e) => setGridCell(key, e.target.value)}
        style={{
          width,
          fontSize: 11,
          color: cellIsTypeValue(key) ? '#ff4d4f' : undefined,
          background: overridden ? '#e6f4ff' : undefined,
          borderColor: overridden ? '#1677ff' : undefined,
        }}
      />
    );
  };

  return (
    <Layout style={{ height: '100%', background: C.bg }}>
      <MenuTemplate type="MTC" defaultSelectedKeys="sds-v2" />
      <Layout style={{ background: C.bg }}>
        <Content className="kb-vscroll" style={{ height: 'calc(100vh - 64px)', overflowY: 'auto', padding: '12px 16px' }}>
          <Spin spinning={loading}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(MTC_PATHS.SDS_COMPLETENESS_TEST)} style={{ paddingLeft: 0 }}>
                  กลับไป Worklist
                </Button>
                <Title level={4} style={{ color: C.textPri, margin: 0 }}>
                  แก้ไข Condition ต่อ C/N <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>(Test Page)</Text>
                </Title>
                <Text style={{ color: C.textSec, fontSize: 12 }}>
                  พรีวิวด้านล่างคือ PDF จริงของชีทนี้ — แก้ในกริดแล้วกดบันทึก พรีวิวจะรีเฟรชให้เห็นผลทันที
                </Text>
              </div>
              <Button icon={<FilePdfOutlined />} onClick={openSignPage} disabled={!scopeReady}>
                ไปหน้าเซ็นตัวจริง
              </Button>
            </div>

            {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Input placeholder="C/N" value={cn} onChange={(e) => setCn(e.target.value)} style={{ width: 160 }} />
              <Select showSearch placeholder="เครื่อง" value={machine} onChange={setMachine} options={machineOptions}
                filterOption={(inp, opt) => opt.label.toLowerCase().includes(inp.toLowerCase())} style={{ width: 220 }} />
              <Input placeholder="Process Code" value={processCode} onChange={(e) => setProcessCode(e.target.value)} style={{ width: 130 }} />
              <Button type="primary" onClick={load} disabled={!scopeReady}>โหลด</Button>
            </div>

            {!scopeReady && <Alert type="info" showIcon message="เลือก C/N และเครื่องก่อน แล้วกดโหลด" style={{ marginBottom: 12 }} />}

            {scopeReady && (
              <>
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                  <div style={{ padding: '8px 12px', borderBottom: showPdf ? `1px solid ${C.border}` : 'none', fontWeight: 600, fontSize: 13, color: C.textPri, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>PDF จริงของชีทนี้</span>
                    <Space size={8}>
                      {showPdf && <Button size="small" icon={<ReloadOutlined />} onClick={() => setPdfKey((k) => k + 1)}>รีเฟรช</Button>}
                      <Button size="small" icon={showPdf ? <EyeInvisibleOutlined /> : <EyeOutlined />} onClick={() => setShowPdf((v) => !v)}>
                        {showPdf ? 'ซ่อน' : 'แสดง'}
                      </Button>
                    </Space>
                  </div>
                  {showPdf && (pdfUrl ? (
                    <iframe key={pdfKey} src={pdfUrl} title="SDS PDF" style={{ width: '100%', height: 560, border: 'none', display: 'block' }} />
                  ) : (
                    <div style={{ padding: 16, color: C.textSec, fontSize: 13 }}>ต้องมี Process Code ก่อนถึงจะเปิดดู PDF ได้</div>
                  ))}
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 13, color: C.textPri, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Condition ({machine})</span>
                    <Space size={8}>
                      <Text style={{ fontSize: 11, color: C.textSec }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, background: '#e6f4ff', border: '1px solid #1677ff', verticalAlign: 'middle', marginRight: 4 }} />
                        override เฉพาะ C/N นี้
                      </Text>
                      <Button size="small" type="primary" icon={<SaveOutlined />} loading={saving} disabled={!touchedCount} onClick={saveGrid}>
                        บันทึก{touchedCount ? ` (${touchedCount})` : ''}
                      </Button>
                    </Space>
                  </div>

                  <div style={{ padding: '10px 12px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
                    {HEADER_CELL_FIELDS.map((f) => (
                      <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Text style={{ fontSize: 11, color: C.textSec }}>{f.label}</Text>
                        {gridCellInput(f.key, 150)}
                      </div>
                    ))}
                  </div>

                  <div style={{ overflowX: 'auto', padding: 12 }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }} />
                          {COL_LETTERS.map((cLet) => (
                            <th key={cLet} style={{ fontSize: 11, color: C.textSec, fontWeight: 600, padding: '2px 3px' }}>{cLet}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ROW_RANGE.map((rowNum) => (
                          <tr key={rowNum} style={{ background: cellIsHeaderRow(rowNum) ? (C.border + '55') : undefined }}>
                            <td style={{ fontSize: 10, color: C.textSec, textAlign: 'right', paddingRight: 4 }}>{rowNum}</td>
                            {COL_LETTERS.map((cLet) => (
                              <td key={cLet} style={{ padding: 1 }}>{gridCellInput(`row_${rowNum}_${cLet}`, 92)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ padding: '0 12px 12px' }}>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: C.textPri }}>Grinding Wheel (GW)</Text>
                  </div>
                  <div style={{ overflowX: 'auto', padding: '0 12px 12px' }}>
                    <table style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ width: 40 }} />
                          {GW_COL_LETTERS.map((cLet) => (
                            <th key={cLet} style={{ fontSize: 11, color: C.textSec, fontWeight: 600, padding: '2px 3px' }}>{cLet}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {GW_ROW_RANGE.map((rowNum) => (
                          <tr key={rowNum}>
                            <td style={{ fontSize: 10, color: C.textSec, textAlign: 'right', paddingRight: 4 }}>{rowNum}</td>
                            {GW_COL_LETTERS.map((cLet) => (
                              <td key={cLet} style={{ padding: 1 }}>{gridCellInput(`gw_row_${rowNum}_${cLet}`, 130)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </Spin>
        </Content>
      </Layout>
    </Layout>
  );
}
