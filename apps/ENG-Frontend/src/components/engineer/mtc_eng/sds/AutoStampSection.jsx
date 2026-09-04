import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Row, Col, Typography, Space, Button, Switch, Select, InputNumber,
  Tag, Tooltip, Alert, Popconfirm, Modal, Table, App,
} from 'antd';
import { ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { httpClient as axios } from '../../../../utils/HttpClient';
import { server } from '../../../../constance/constance';
import { useAuthStore } from '../../../../stores/authStore';

const { Text } = Typography;

const AS_ROLES = [
  { key: 'prepared', label: 'Prepared' },
  { key: 'checked', label: 'Checked' },
  { key: 'approved', label: 'Approved' },
];

const draftFromCfg = (c = {}) => ({
  enabled: !!c.enabled,
  max_per_run: c.max_per_run || 200,
  ...Object.fromEntries(AS_ROLES.flatMap(({ key }) => [
    [`${key}_em_id`, c.explicit?.[key]?.em_id || ''],
    [`${key}_name`, c.explicit?.[key]?.name || ''],
  ])),
});

/**
 * Auto Stamp settings — a section of the Report Scope modal.
 *
 * Global on/off toggle + the responsible signer per role. When ON, every coverage
 * build auto-signs the NO_STAMP sheets (PDF-ready, signature the only gap) with
 * these people (tagged source='auto') and moves their board cards.
 *
 * A role's signer falls back to the SINGLE em_id permitted in
 * sds_approval_role_config (`from: 'role_config'`); the picker is an OVERRIDE —
 * leave it blank to keep using the role config. `cfg.signers` is the effective
 * (resolved) signer, `cfg.explicit` the override only.
 *
 * Saves through its OWN endpoint (MTC_SDS_V2_AUTO_STAMP_CONFIG), independent of the
 * scope modal's "Save & Rebuild". Admin-only — renders nothing for everyone else.
 */
export default function AutoStampSection() {
  const { message } = App.useApp();
  const { userDepartment, userRole, userPerms } = useAuthStore();
  const isAdmin = userDepartment === 'AD' || userRole === 'AD'
    || (Array.isArray(userPerms) && userPerms.includes('sds_admin'));

  const [cfg, setCfg] = useState(null);
  const [draft, setDraft] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState(null);

  const applyCfg = useCallback((c) => { setCfg(c); setDraft(draftFromCfg(c)); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        axios.get(server.MTC_SDS_V2_AUTO_STAMP_CONFIG),
        axios.get(server.GET_ALL_USERS).catch(() => ({ data: {} })),
      ]);
      applyCfg(cRes.data.config || {});
      const rows = Array.isArray(uRes.data?.data) ? uRes.data.data
        : (Array.isArray(uRes.data) ? uRes.data : []);
      setUsers(rows
        .map((u) => ({
          em_id: String(u.u_code ?? u.user_empid ?? u.empno ?? '').trim(),
          name: String(u.u_name ?? u.name ?? '').trim(),
          nick: String(u.u_nickname ?? u.u_nick ?? '').trim(),
        }))
        .filter((u) => u.em_id));
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to load Auto Stamp config');
    } finally {
      setLoading(false);
    }
  }, [applyCfg, message]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const userOpts = useMemo(() => users.map((u) => ({
    value: u.em_id,
    label: `${u.name || u.em_id}${u.nick ? ` (${u.nick})` : ''} · ${u.em_id}`,
  })), [users]);

  if (!isAdmin) return null;

  const roleCovered = (key) => !!draft[`${key}_em_id`] || !!cfg?.signers?.[key];
  const signersComplete = AS_ROLES.every(({ key }) => roleCovered(key));
  const openRoles = AS_ROLES.filter(({ key }) => !roleCovered(key));
  const dirty = !!cfg && JSON.stringify(draftFromCfg(cfg)) !== JSON.stringify(draft);
  const on = !!cfg?.enabled;

  const setSigner = (key, emId) => {
    const u = users.find((x) => x.em_id === emId);
    setDraft((d) => ({ ...d, [`${key}_em_id`]: emId || '', [`${key}_name`]: u?.name || '' }));
  };

  const save = async (patch) => {
    setSaving(true);
    try {
      const res = await axios.put(server.MTC_SDS_V2_AUTO_STAMP_CONFIG, patch || draft);
      applyCfg(res.data.config || {});
      message.success('Auto Stamp settings saved');
    } catch (err) {
      message.error(err.response?.data?.error || 'Save failed (admin only)');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (next) => {
    if (next && !signersComplete) {
      message.warning(`No signer resolved for: ${openRoles.map((r) => r.label).join(', ')}`);
      return;
    }
    setDraft((d) => ({ ...d, enabled: next }));
    await save({ ...draft, enabled: next });
  };

  const run = async (dryRun) => {
    setRunning(true);
    try {
      const res = await axios.post(server.MTC_SDS_V2_AUTO_STAMP, null, { params: dryRun ? { dryRun: 1 } : {} });
      if (dryRun) {
        setPreview(res.data);
      } else {
        const d = res.data;
        message.success(`Auto Stamp: ${d.rolesWritten || 0} signature(s) on ${d.sheetsChanged || 0} sheet(s)` +
          (d.errors?.length ? `, ${d.errors.length} error(s)` : ''));
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Auto Stamp run failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <Space size={8}>
          <ThunderboltOutlined style={{ color: on ? '#52c41a' : '#8c8c8c' }} />
          <Text strong style={{ fontSize: 12 }}>Auto Stamp</Text>
        </Space>
        <Tooltip title={on
          ? 'ON — every coverage build auto-signs the signature-only (NO_STAMP) sheets with the signers below'
          : 'OFF — sheets are signed by hand only'}>
          <Switch checked={draft.enabled ?? false} loading={loading || saving}
            onChange={toggleEnabled} checkedChildren="ON" unCheckedChildren="OFF" />
        </Tooltip>
        <Space size={6} style={{ marginLeft: 'auto' }}>
          <Button size="small" icon={<ThunderboltOutlined />} loading={running} onClick={() => run(true)}>Dry-run</Button>
          <Popconfirm title="Run Auto Stamp now against the current report?"
            description="Writes real signatures for every NO_STAMP sheet with signers configured."
            okText="Run" onConfirm={() => run(false)} disabled={!on}>
            <Button size="small" type="primary" loading={running} disabled={!on}>Run now</Button>
          </Popconfirm>
        </Space>
      </div>

      <Text type="secondary" style={{ display: 'block', fontSize: 11, marginBottom: 8 }}>
        Signs <b>NO_STAMP</b> sheets (PDF-ready, signature the only gap). Limit anomalies excluded.
        A blank picker uses the single em_id permitted in the SDS approval role config.
      </Text>

      <Row gutter={[16, 10]}>
        {AS_ROLES.map(({ key, label }) => {
          const eff = cfg?.signers?.[key] || null;
          const fromRole = !draft[`${key}_em_id`] && eff?.from === 'role_config';
          const cand = cfg?.role_config_candidates?.[key] || [];
          const unresolved = !draft[`${key}_em_id`] && !eff;
          return (
            <Col key={key} xs={24} sm={8}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, minHeight: 20 }}>
                <Text strong style={{ fontSize: 12 }}>{label}</Text>
                {fromRole && (
                  <Tooltip title={`From sds_approval_role_config (the single em_id permitted to sign ${label}). Pick someone to override.`}>
                    <Tag color="blue" style={{ fontSize: 10, margin: 0, cursor: 'help' }}>Role config: {eff.name || eff.em_id}</Tag>
                  </Tooltip>
                )}
                {unresolved && (
                  <Tag color="error" style={{ fontSize: 10, margin: 0 }}>
                    {cand.length > 1 ? `${cand.length} permitted — pick one` : 'no signer'}
                  </Tag>
                )}
              </div>
              <Select size="small" showSearch allowClear style={{ width: '100%' }}
                placeholder={fromRole ? `Using ${eff.name || eff.em_id} (override optional)` : 'Select employee'}
                value={draft[`${key}_em_id`] || undefined} options={userOpts}
                onChange={(v) => setSigner(key, v)}
                filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                popupMatchSelectWidth={false} />
            </Col>
          );
        })}
      </Row>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Max sheets / run</Text>
        <InputNumber size="small" min={1} max={2000} value={draft.max_per_run}
          onChange={(v) => setDraft((d) => ({ ...d, max_per_run: v || 200 }))} style={{ width: 90 }} />
        <Button size="small" type="primary" ghost loading={saving} disabled={!dirty} onClick={() => save()}>Save Auto Stamp</Button>
        {!signersComplete && (
          <Text type="warning" style={{ fontSize: 11 }}>
            <WarningOutlined /> No signer for {openRoles.map((r) => r.label).join(', ')} — pick one, or leave a single em_id row in the SDS approval role config
          </Text>
        )}
        {cfg?.updated_by && (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>last changed by {cfg.updated_by}</Text>
        )}
      </div>

      <Modal open={!!preview} onCancel={() => setPreview(null)} footer={null}
        title="Auto Stamp — dry run" destroyOnHidden width={640}>
        {preview && (
          <>
            {!preview.enabled && (
              <Alert type="info" showIcon style={{ marginBottom: 10 }}
                message="Auto Stamp is OFF — this is what a run would do once enabled." />
            )}
            {preview.reason === 'too_many_candidates' && (
              <Alert type="warning" showIcon style={{ marginBottom: 10 }}
                message={`${preview.candidates} candidate sheets exceed the max/run cap — a real run would abort.`} />
            )}
            <Space size="large" style={{ marginBottom: 10 }} wrap>
              <Text><b>{preview.candidates ?? 0}</b> candidates</Text>
              <Text type="success"><b>{preview.sheetsChanged ?? 0}</b> sheets → <b>{preview.rolesWritten ?? 0}</b> signatures</Text>
              <Text type="secondary">{preview.skipped?.length ?? 0} skipped</Text>
              {preview.errors?.length ? <Text type="danger">{preview.errors.length} errors</Text> : null}
            </Space>
            <Table size="small" pagination={{ pageSize: 8 }}
              rowKey={(r) => `${r.cn}|${r.machine_type_name}|${r.process_code}`}
              dataSource={preview.stamped || []}
              columns={[
                { title: 'CN', dataIndex: 'cn', width: 120 },
                { title: 'Machine', dataIndex: 'machine_type_name', width: 130 },
                { title: 'Process', dataIndex: 'process_code', width: 90 },
                { title: 'Would sign', dataIndex: 'roles', render: (r) => (r || []).map((x) => <Tag key={x} color="green">{x}</Tag>) },
              ]} />
          </>
        )}
      </Modal>
    </div>
  );
}
