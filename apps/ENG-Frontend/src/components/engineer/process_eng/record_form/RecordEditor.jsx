import React, { useState, useMemo, useRef } from 'react';
import { Button, Input, Space, Tag, Modal, List, message, Alert, Tooltip } from 'antd';
import { SearchOutlined, SaveOutlined, PrinterOutlined, ArrowLeftOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import RecordSheet, { revLabel } from './RecordSheet';
import { PrintPortal, printNow } from './PrintPortal';
import { recordFormApi, errMsg } from './recordFormApi';
import { useAuthStore } from '../../../../stores/authStore';

const STATUS = { draft: ['default', 'Draft'], printed: ['blue', 'Printed'], recorded: ['green', 'Recorded'] };

const localToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

export const emptyRecord = templateId => ({
  id: null, template_id: templateId, lot_no: '', control_no: '', parts_no: '', drawing_rev: '',
  header: {}, steps: [], status: 'draft', record_rev: 0, established_date: localToday(), revised_date: null,
});

// user_group of the Process Engineer team; Admins may stamp too (the backend enforces this — this only decides what is shown)
const STAMP_GROUP = 'PROC';

export default function RecordEditor({ initial, templates, onBack, onSaved }) {
  // userSection holds the user's user_group (see sign_in.jsx); Admin = department or role 'AD' (as in menu_template.jsx)
  const canStamp = useAuthStore(s => s.userSection === STAMP_GROUP || s.userRole === 'AD' || s.userDepartment === 'AD');
  const [rec, setRec] = useState(initial);
  const saved0 = useRef(initial); // what is stored, to tell a date-only edit from a content edit
  const [dirty, setDirty] = useState(!initial.id);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState(null);

  const template = useMemo(
    () => templates.find(t => t.id === rec.template_id) || templates.find(t => t.is_default) || templates[0],
    [templates, rec.template_id]
  );
  const layout = template?.layout;
  const change = next => { setRec(next); setDirty(true); };

  const loadLot = async (lot_no, control_no) => {
    setBusy(true);
    try {
      const d = await recordFormApi.getLot(lot_no, control_no);
      change({
        ...rec, lot_no: d.lot_no, control_no: d.control_no, parts_no: d.parts_no, drawing_rev: d.drawing_rev || '',
        header: { ...rec.header, process_code: d.process_code || rec.header?.process_code || '' },
        steps: d.steps.map(s => ({ process_code: s.process_code, process_name: s.process_name, values: {} })),
      });
      setChoices(null);
      message.success(`Loaded ${d.lot_no} / ${d.control_no} (${d.steps.length} processes)`);
    } catch (e) { message.error(errMsg(e)); } finally { setBusy(false); }
  };

  const search = async () => {
    if (!q.trim()) return;
    if (rec.steps.length && !window.confirm('Replace the header data and processes already on this form?')) return;
    setBusy(true);
    try {
      const rows = await recordFormApi.searchLots(q);
      if (!rows.length) message.warning('Lot / C/N not found');
      else if (rows.length === 1) await loadLot(rows[0].lot_no, rows[0].control_no);
      else setChoices(rows);
    } catch (e) { message.error(errMsg(e)); } finally { setBusy(false); }
  };

  const save = async (extra = {}) => {
    setBusy(true);
    try {
      const strip = r => JSON.stringify({ ...r, established_date: null, record_rev: 0, revised_date: null, updated_at: null, status: null });
      const dateOnly = !!rec.id && strip(rec) === strip(saved0.current) && rec.established_date !== saved0.current.established_date;
      const body = { ...rec, ...(dateOnly ? { revise: false } : {}), ...extra };
      const saved = rec.id ? await recordFormApi.updateRecord(rec.id, body) : await recordFormApi.createRecord(body);
      setRec(saved); saved0.current = saved; setDirty(false); onSaved?.();
      message.success(`Saved${saved.record_rev ? ` (REV. ${revLabel(saved.record_rev)})` : ''}`);
      return saved;
    } catch (e) { message.error(errMsg(e)); } finally { setBusy(false); }
  };

  // A printed form that has come back must be stamped by a Process Engineer before it can be saved.
  const needsStamp = rec.id && rec.status === 'printed';
  const stamped = !!rec.header?.stamped_by;
  // Printed records must be stamped before Save; a recorded one that has no stamp (e.g. imported) can be stamped afterwards.
  const showStamp = rec.id && (rec.status === 'printed' || (rec.status === 'recorded' && !stamped));

  const stamp = async () => {
    setBusy(true);
    try {
      const r = await recordFormApi.stampRecord(rec.id);
      // take only the stamp fields: the edits on screen are not saved yet and must not be overwritten
      const pick = ['engineer_stamp', 'stamped_by', 'stamped_by_name', 'stamped_at'];
      setRec(cur => ({ ...cur, stamp_seal: r.stamp_seal, header: { ...cur.header, ...Object.fromEntries(pick.map(k => [k, r.header[k]])) } }));
      saved0.current = { ...saved0.current, header: { ...saved0.current.header, ...Object.fromEntries(pick.map(k => [k, r.header[k]])) } };
      message.success('Stamped');
    } catch (e) { message.error(errMsg(e)); } finally { setBusy(false); }
  };

  const print = async () => {
    const saved = (dirty || !rec.id) ? await save() : rec;
    if (!saved) return;
    try { setRec(await recordFormApi.markPrinted(saved.id)); onSaved?.(); } catch (e) { message.error(errMsg(e)); }
    setTimeout(() => printNow(layout.orientation), 150);
  };

  if (!layout) return <Alert type="error" message="Form template not found" />;

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => (!dirty || window.confirm('You have unsaved changes. Leave this page?')) && onBack()}>Back</Button>
        <Input.Search
          style={{ width: 300 }} placeholder="Enter Lot No. or C/N, then press Enter" enterButton={<SearchOutlined />}
          value={q} onChange={e => setQ(e.target.value)} onSearch={search} loading={busy} allowClear
        />
        {showStamp && (
          <Tooltip title={canStamp ? '' : 'Only the Process Engineer team (or an Admin) can stamp'}>
            <Button icon={<SafetyCertificateOutlined />} loading={busy} disabled={!canStamp || stamped} onClick={stamp}>
              {stamped ? 'Stamped' : 'Stamp'}
            </Button>
          </Tooltip>
        )}
        <Tooltip title={needsStamp && !stamped ? 'A Process Engineer must stamp this record before it can be saved' : ''}>
          <Button type="primary" icon={<SaveOutlined />} loading={busy}
            disabled={needsStamp ? !stamped : !dirty}
            onClick={() => save(needsStamp ? { recordBack: true } : {})}>Save</Button>
        </Tooltip>
        <Button icon={<PrinterOutlined />} onClick={print}>Print</Button>
        {rec.id && <Tag color={STATUS[rec.status][0]}>{STATUS[rec.status][1]} · REV.{revLabel(rec.record_rev)}</Tag>}
        {dirty && <Tag color="orange">Unsaved</Tag>}
      </Space>
      {needsStamp && (
        <Alert style={{ marginBottom: 12 }} type="warning" showIcon
          message={stamped
            ? 'Stamped. Fill in the recorded data, then Save — RECORD REV. stays N/C for this first save.'
            : 'Printed. When the form comes back, a Process Engineer (or an Admin) must stamp it before it can be saved.'} />
      )}
      {rec.id && rec.status === 'recorded' && (
        <Alert style={{ marginBottom: 12 }} type="info" showIcon
          message="This record has been recorded. Saving further changes raises RECORD REV. (A, B, …) and sets REVISED DATE automatically." />
      )}

      <div style={{ overflow: 'auto', paddingBottom: 12 }}>
        <RecordSheet layout={layout} record={rec} editable onChange={change} />
      </div>

      <Modal open={!!choices} title="Multiple matches — choose a Lot / C/N" footer={null} onCancel={() => setChoices(null)} destroyOnHidden>
        <List size="small" dataSource={choices || []} renderItem={r => (
          <List.Item style={{ cursor: 'pointer' }} onClick={() => loadLot(r.lot_no, r.control_no)}>
            <b>{r.lot_no}</b>&nbsp;/&nbsp;{r.control_no}&nbsp;&nbsp;{r.parts_no}
            <span style={{ marginLeft: 'auto', color: '#888' }}>{r.entry_date ? String(r.entry_date).slice(0, 10) : ''}</span>
          </List.Item>
        )} />
      </Modal>
      <PrintPortal layout={layout} record={rec} />
    </div>
  );
}
