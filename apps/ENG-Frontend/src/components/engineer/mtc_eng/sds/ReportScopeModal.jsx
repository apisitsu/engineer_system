import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Checkbox, Select, Input, Row, Col, Typography, Space, Button, Spin, Divider, App } from 'antd';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';

const { Text } = Typography;

// Part types selectable for the report scope (taxonomy is code-defined via cnPartType;
// this only picks which to include). body/sleeve are future-ready.
const PART_TYPE_OPTIONS = [
  { value: 'ball',      label: 'Ball (C3x)' },
  { value: 'race',      label: 'Race (C2x)' },
  { value: 'mecha',     label: 'Mecha (C95 / C99)' },
  { value: 'body',      label: 'Body (C1x / C5x)' },
  { value: 'sleeve',    label: 'Sleeve (C6x)' },
  { value: 'spherical', label: 'Spherical (A4x)' },
];

const boxStyle = { maxHeight: 220, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 8 };

/**
 * Admin editor for the production-based SDS Coverage report scope (sds_report_config).
 * Lives on the report page as a button → modal. Saving flushes the coverage cache
 * server-side; onSaved() should trigger a report rebuild. PUT is isAdmin-guarded.
 */
export default function ReportScopeModal({ open, onClose, onSaved }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scope, setScope] = useState(null);
  const [procOpts, setProcOpts] = useState([]);
  const [wcMaster, setWcMaster] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, pm, wc] = await Promise.all([
        axios.get(server.MTC_SDS_V2_REPORT_CONFIG),
        axios.get(server.MTC_SDS_V2_ADMIN_AUDIT_PROCESS_MASTER).catch(() => ({ data: [] })),
        axios.get(server.MTC_SDS_V2_REPORT_WC_OPTIONS).catch(() => ({ data: [] })),
      ]);
      setScope(cfg.data?.data || null);
      setProcOpts((pm.data || []).map(r => ({ value: r.process_code, label: `${r.process_code} — ${r.process_eng || ''}` })));
      setWcMaster(Array.isArray(wc.data) ? wc.data : []);
    } catch {
      message.error('Load report scope failed');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const set = (key, value) => setScope(s => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(server.MTC_SDS_V2_REPORT_CONFIG, scope);
      message.success('Report scope saved — rebuilding report');
      onSaved?.();
      onClose?.();
    } catch (e) {
      message.error(e.response?.data?.error || 'Save failed (admin only)');
    } finally {
      setSaving(false);
    }
  };

  // WC options = master from rodpc.m_workcenter + any configured WC not in it
  const wcOptions = scope
    ? [...wcMaster, ...((scope.work_centers || []).filter(w => !wcMaster.some(o => o.value === w)).map(w => ({ value: w, label: w })))]
    : [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Report Scope (SDS Coverage)"
      width={780}
      okText="Save & Rebuild"
      confirmLoading={saving}
      onOk={save}
      okButtonProps={{ disabled: !scope }}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        {scope && (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              Scope of the production-based coverage report. Defaults match the original built-in values.
              <b> Saving rebuilds the report</b> (the per-CN Tooling Select pass takes a few minutes). Admin only.
            </Text>

            <Row gutter={[24, 12]}>
              <Col xs={24} md={8}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Work Centers</Text>
                <div style={{ ...boxStyle, maxHeight: 180 }}>
                  <Checkbox.Group value={scope.work_centers || []}
                    onChange={v => set('work_centers', [...v].sort())}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {wcOptions.map(o => <Checkbox key={o.value} value={o.value}><Text style={{ fontSize: 13 }}>{o.label}</Text></Checkbox>)}
                  </Checkbox.Group>
                </div>
              </Col>
              <Col xs={24} md={16}>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Since date</Text>
                    <Input placeholder="2023-01-01" value={scope.since_date || ''} onChange={e => set('since_date', e.target.value)} />
                    <Text type="secondary" style={{ fontSize: 11 }}>YYYY-MM-DD (fixed cutoff)</Text>
                  </Col>
                  <Col xs={24} sm={16}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Excluded CNs</Text>
                    <Select mode="tags" style={{ width: '100%' }} tokenSeparators={[',', ' ']} placeholder="C39-00209 …"
                      value={scope.excluded_cns || []} onChange={v => set('excluded_cns', v)} />
                    <Text type="secondary" style={{ fontSize: 11 }}>No master list — type CN + Enter</Text>
                  </Col>
                </Row>
              </Col>
            </Row>

            <Divider style={{ margin: '14px 0' }} />

            <Row gutter={[24, 12]}>
              <Col xs={24} md={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Part Types</Text>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 10 }}>
                  <Checkbox.Group value={scope.part_types || []} onChange={v => set('part_types', v)}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {PART_TYPE_OPTIONS.map(o => <Checkbox key={o.value} value={o.value}><Text style={{ fontSize: 13 }}>{o.label}</Text></Checkbox>)}
                  </Checkbox.Group>
                </div>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 11 }}>
                  Which CN classes to include. body / sleeve ready for future use.
                </Text>
              </Col>
              <Col xs={24} md={12}>
                <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Process Codes (grinding)</Text>
                <Space style={{ marginBottom: 6 }}>
                  <Button size="small" onClick={() => set('process_codes', procOpts.map(o => o.value).sort())}>Select All</Button>
                  <Button size="small" onClick={() => set('process_codes', [])}>Clear</Button>
                </Space>
                <div style={boxStyle}>
                  <Checkbox.Group value={scope.process_codes || []}
                    onChange={v => set('process_codes', [...v].sort())}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {procOpts.map(o => <Checkbox key={o.value} value={o.value}><Text style={{ fontSize: 13 }}>{o.label}</Text></Checkbox>)}
                  </Checkbox.Group>
                </div>
                <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 11 }}>
                  {(scope.process_codes || []).length} selected — applies to all selected part types
                </Text>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </Modal>
  );
}
