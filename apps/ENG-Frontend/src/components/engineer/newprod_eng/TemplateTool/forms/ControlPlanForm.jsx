import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Select, Button, Tooltip, message, Tag } from 'antd';
import { SaveOutlined, PrinterOutlined, PlusOutlined, CheckCircleOutlined, ArrowLeftOutlined, BoldOutlined, ItalicOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined, VerticalAlignTopOutlined, VerticalAlignMiddleOutlined, VerticalAlignBottomOutlined, UnorderedListOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { debounce } from 'lodash';

/* ─────────────── ContentEditable Wrapper ─────────────── */
const ContentEditable = ({ html, disabled, onChange, className, style }) => {
    const ref = useRef(null);
    const lastHtml = useRef(html);

    useEffect(() => {
        if (ref.current && ref.current.innerHTML !== html) {
            // Save caret
            const sel = window.getSelection();
            let caretOffset = 0;
            if (sel.rangeCount > 0 && ref.current.contains(sel.anchorNode)) {
                caretOffset = sel.anchorOffset;
            }
            ref.current.innerHTML = html || '';
            lastHtml.current = html;
        }
    }, [html]);

    const handleInput = () => {
        const val = ref.current.innerHTML;
        if (val !== lastHtml.current) {
            lastHtml.current = val;
            onChange?.(val);
        }
    };

    return (
        <div
            ref={ref}
            contentEditable={!disabled}
            className={className}
            style={style}
            onInput={handleInput}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: html || '' }}
        />
    );
};

/* ─────────────── CSS (injected once) ─────────────── */
const FORM_STYLES = `
/* Control Plan Form - A3 Landscape */
.cp-body { background:#525659; display:flex; padding:0; font-family:'Segoe UI',Tahoma,sans-serif; font-size:11px; color:#000; }
.cp-topbar { position:sticky; top:0; z-index:1000; background:#2c3e50; display:flex; justify-content:space-between; align-items:center; padding:8px 15px; box-shadow:0 2px 10px rgba(0,0,0,.3); gap:10px; flex-wrap:wrap; }
.cp-topbar-title { color:#fff; font-size:15px; font-weight:bold; white-space:nowrap; }
.cp-toolbar { display:flex; align-items:center; background:#f0f2f5; padding:3px 6px; border-radius:5px; gap:2px; }
.cp-toolbar button { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; color:#333; cursor:pointer; padding:3px 5px; font-size:13px; border-radius:4px; height:26px; min-width:26px; }
.cp-toolbar button:hover { background:#d9e8ff; border-color:#91caff; color:#1677ff; }
.cp-toolbar-divider { width:1px; height:18px; background:#ccc; margin:0 3px; }
.cp-pages { display:flex; flex-direction:column; gap:20px; transform-origin:top center; padding:20px 0; align-items:center; }
.cp-a3-page { width:420mm; height:297mm; background:#fff; padding:10mm; box-shadow:0 4px 8px rgba(0,0,0,.2); box-sizing:border-box; position:relative; display:flex; flex-direction:column; overflow:hidden; }
.cp-page-number { position:absolute; bottom:5mm; right:10mm; font-size:11px; font-weight:bold; color:#555; z-index:10; }
.cp-page-content { width:100%; flex:1; display:flex; flex-direction:column; overflow:hidden; position:relative; }
.cp-header-title { font-size:24px; font-weight:bold; text-align:center; margin-bottom:10px; }
.cp-std-header { display:flex; margin-bottom:15px; font-size:11px; border:2px solid #000; width:100%; box-sizing:border-box; }
.cp-header-details { display:grid; grid-template-columns:1fr 1fr 1fr; flex:1; border-right:2px solid #000; }
.cp-header-col { display:flex; flex-direction:column; border-right:1px solid #000; }
.cp-header-col:last-child { border-right:none; }
.cp-header-row { display:flex; align-items:center; border-bottom:1px solid #000; padding:2px 4px; flex:1; white-space:nowrap; }
.cp-header-row:last-child { border-bottom:none; }
.cp-header-row label { font-weight:bold; margin-right:5px; white-space:nowrap; }
.cp-header-row input { flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:11px; min-width:0; }
.cp-approval-block { display:flex; width:200px; flex-shrink:0; }
.cp-stamp-box { flex:1; display:flex; flex-direction:column; border-right:1px solid #000; }
.cp-stamp-box:last-child { border-right:none; }
.cp-stamp-title { text-align:center; font-weight:bold; border-bottom:1px solid #000; padding:2px; background:#f9f9f9; }
.cp-stamp-area { flex:1; min-height:40px; cursor:text; outline:none; padding:2px; text-align:center; }
table.cp-data-table { border-collapse:collapse!important; width:100%; border:2px solid #000; table-layout:fixed; }
table.cp-data-table tbody tr { height:25px; }
table.cp-data-table th, table.cp-data-table td { border:1px solid #000!important; padding:2px 4px; text-align:center; vertical-align:middle; word-wrap:break-word; box-sizing:border-box; }
table.cp-data-table th { background:#e5e7eb; font-weight:bold; font-size:11px; }
.cp-editable-cell { min-height:20px; width:100%; outline:none; cursor:text; text-align:center; padding:2px; box-sizing:border-box; word-break:break-word; }
.cp-editable-cell:focus { background:#fff; box-shadow:inset 0 0 0 2px #1677ff; }
.cp-editable-cell ul { padding-left:20px; margin:4px 0; text-align:left; }
.cp-editable-cell li { margin-bottom:2px; }
.cp-btn-remove { background:#ff4d4f; padding:2px 6px; font-size:10px; border-radius:2px; border:none; color:white; cursor:pointer; }

@media print {
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  @page { size:A3 landscape; margin:5mm; }
  body { background:none!important; padding:0!important; }
  .cp-topbar, .cp-no-print { display:none!important; }
  .cp-pages { gap:0!important; zoom:1!important; transform:none!important; margin:0!important; padding:0!important; }
  .cp-a3-page { width:420mm!important; height:297mm!important; box-shadow:none; margin:0; page-break-after:always; overflow:hidden; padding:5mm; }
  .cp-a3-page:last-child { page-break-after:auto; }
  .cp-page-content { overflow:hidden!important; }
  .cp-editable-cell { box-shadow:none!important; }
  table.cp-data-table th { position:static!important; }
}
`;

/* ─────────────── Column Definitions ─────────────── */
const COLUMNS = [
    { key: 'operation', title: 'Operation', width: '5%' },
    { key: 'process_function', title: 'Process Function / Description', width: '14%' },
    { key: 'machine_device', title: 'Machine, Device, Jig,\nTools For Mfg.', width: '14%' },
    { key: 'char_dwg_no', title: 'DWG.\nNo.', width: '4%', group: 'Characteristics' },
    { key: 'char_product', title: 'Product', width: '8%', group: 'Characteristics' },
    { key: 'char_process', title: 'Process', width: '8%', group: 'Characteristics' },
    { key: 'special_class', title: 'Special\nClassification', width: '5%' },
    { key: 'method_requirements', title: 'Requirements', width: '10%', group: 'Methods' },
    { key: 'method_evaluation', title: 'Evaluation /\nMeasurement', width: '9%', group: 'Methods' },
    { key: 'sample_size', title: 'Sample Size', width: '5%', group: 'Methods' },
    { key: 'sample_freq', title: 'Freq.', width: '4%', group: 'Methods' },
    { key: 'control_method', title: 'Control\nMethod', width: '8%', group: 'Methods' },
    { key: 'reaction_plan', title: 'Reaction\nPlan', width: '6%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach(c => { row[c.key] = ''; });
    return row;
};

/* ─────────────── MAIN COMPONENT ─────────────── */
export default function ControlPlanForm({ formId, onBack }) {
    const { empNo, userName } = useAuthStore();
    const [header, setHeader] = useState({
        pid_number: '', customer_pn: '', nmb_pn: '', form_number: '', revision: '',
        prepare_by: '', check_by: '', date_initiated: '', target_date: '',
    });
    const [rows, setRows] = useState([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
    const [status, setStatus] = useState('In Progress');
    const [zoom, setZoom] = useState('0.75');
    const [loading, setLoading] = useState(false);
    const [deletedRowIds, setDeletedRowIds] = useState([]);
    const isApproved = status === 'Approved';

    const containerRef = useRef(null);
    const pagesContainerRef = useRef(null);

    // ─── Load data ───
    useEffect(() => {
        if (!formId) return;
        const load = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${server.TT_FORMS}/control_plan/${formId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.result === 'true') {
                    const { header: h, rows: r } = res.data.data;
                    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                    setHeader({
                        pid_number: h.pid_number || '', customer_pn: h.customer_pn || '',
                        nmb_pn: h.nmb_pn || '', form_number: h.form_number || '',
                        revision: h.revision || '', prepare_by: h.prepare_by || '',
                        check_by: h.check_by || '', date_initiated: formatDate(h.date_initiated),
                        target_date: formatDate(h.target_date),
                    });
                    setStatus(h.status || 'In Progress');
                    if (r && r.length > 0) {
                        setRows(r.map(row => ({ ...row, _key: row.id || Date.now() + Math.random() })));
                    }
                }
            } catch (err) { console.error('Load error:', err); }
            finally { setLoading(false); }
        };
        load();
    }, [formId]);

    // ─── Auto-save (debounced) ───
    const saveData = useCallback(
        debounce(async (h, r, deleted) => {
            if (!formId) return;
            try {
                const token = localStorage.getItem('token');
                const res = await axios.put(`${server.TT_FORMS}/control_plan/${formId}`, {
                    header: h, rows: r, deletedRowIds: deleted,
                }, { headers: { Authorization: `Bearer ${token}` } });

                if (res.data?.data?.rows) {
                    const idMap = {};
                    res.data.data.rows.forEach(dbRow => { if (dbRow._key && dbRow.id) idMap[dbRow._key] = dbRow.id; });
                    setRows(prev => prev.map(pr => (pr._key && idMap[pr._key] && !pr.id) ? { ...pr, id: idMap[pr._key] } : pr));
                }

                setDeletedRowIds(prev => prev.filter(id => !deleted.includes(id)));
            } catch (err) { console.error('Auto-save error:', err); }
        }, 3000),
        [formId]
    );

    useEffect(() => {
        if (formId && !isApproved) saveData(header, rows, deletedRowIds);
    }, [header, rows]);

    useEffect(() => {
        return () => saveData.flush?.();
    }, [saveData]);

    // ─── Row ops ───
    const addRow = () => setRows(prev => [...prev, makeEmptyRow()]);
    const removeRow = (index) => {
        const row = rows[index];
        if (row.id) setDeletedRowIds(prev => [...prev, row.id]);
        setRows(prev => prev.filter((_, i) => i !== index));
    };
    const updateCell = (index, key, value) => {
        setRows(prev => {
            const copy = [...prev];
            copy[index] = { ...copy[index], [key]: value };
            return copy;
        });
    };

    // ─── Formatting ───
    const execCmd = (cmd) => { document.execCommand(cmd, false, null); };

    // ─── Approve ───
    const handleApprove = async () => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await saveData.flush?.();
            await axios.put(`${server.TT_FORMS}/control_plan/${formId}`, {
                header, rows, deletedRowIds,
            }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.put(`${server.TT_FORMS}/control_plan/${formId}/status`, {
                status: 'Approved',
            }, { headers: { Authorization: `Bearer ${token}` } });
            setStatus('Approved');
            message.success('Form approved and locked');
        } catch (err) { message.error('Approval failed'); }
    };

    // ─── Inject styles ───
    useEffect(() => {
        const id = 'cp-form-styles';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = FORM_STYLES;
            document.head.appendChild(style);
        }
    }, []);

    // ─── Render ───
    const renderHeader = () => (
        <div className="cp-std-header">
            <div className="cp-header-details">
                <div className="cp-header-col">
                    <div className="cp-header-row"><label>PID Number:</label><input value={header.pid_number} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, pid_number: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>Customer P/N:</label><input value={header.customer_pn} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, customer_pn: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>NMB P/N:</label><input value={header.nmb_pn} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, nmb_pn: e.target.value }))} /></div>
                </div>
                <div className="cp-header-col">
                    <div className="cp-header-row"><label>CP No.:</label><input value={header.form_number} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, form_number: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>Prepare by:</label><input value={header.prepare_by} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, prepare_by: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>Check by:</label><input value={header.check_by} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, check_by: e.target.value }))} /></div>
                </div>
                <div className="cp-header-col">
                    <div className="cp-header-row"><label>REV.:</label><input value={header.revision} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, revision: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>Date Initiated:</label><input type="date" value={header.date_initiated} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, date_initiated: e.target.value }))} /></div>
                    <div className="cp-header-row"><label>Target Date:</label><input type="date" value={header.target_date} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, target_date: e.target.value }))} /></div>
                </div>
            </div>
            <div className="cp-approval-block">
                {['Prepare', 'Check by', 'Approve'].map(label => (
                    <div className="cp-stamp-box" key={label}>
                        <div className="cp-stamp-title">{label}</div>
                        <div className="cp-stamp-area" contentEditable={!isApproved} suppressContentEditableWarning />
                    </div>
                ))}
            </div>
        </div>
    );

    const renderTableHead = () => (
        <thead>
            <tr>
                <th rowSpan={2} style={{ width: COLUMNS[0].width }}>{COLUMNS[0].title}</th>
                <th rowSpan={2} style={{ width: COLUMNS[1].width }}>{COLUMNS[1].title}</th>
                <th rowSpan={2} style={{ width: COLUMNS[2].width }}>Machine, Device, Jig,<br />Tools For Mfg.</th>
                <th colSpan={3}>Characteristics</th>
                <th rowSpan={2} style={{ width: COLUMNS[6].width }}>Special<br />Classification</th>
                <th colSpan={5}>Methods</th>
                <th rowSpan={2} style={{ width: COLUMNS[12].width }}>Reaction<br />Plan</th>
                {!isApproved && <th rowSpan={2} className="cp-no-print" style={{ width: '3%' }}>Del</th>}
            </tr>
            <tr>
                <th style={{ width: COLUMNS[3].width }}>DWG.<br />No.</th>
                <th style={{ width: COLUMNS[4].width }}>Product</th>
                <th style={{ width: COLUMNS[5].width }}>Process</th>
                <th style={{ width: COLUMNS[7].width }}>Requirements</th>
                <th style={{ width: COLUMNS[8].width }}>Evaluation /<br />Measurement</th>
                <th style={{ width: COLUMNS[9].width }}>Sample Size</th>
                <th style={{ width: COLUMNS[10].width }}>Freq.</th>
                <th style={{ width: COLUMNS[11].width }}>Control<br />Method</th>
            </tr>
        </thead>
    );

    // ─── Pagination: A3 landscape has more space ───
    const ROWS_PAGE_1 = 30;
    const ROWS_PAGE_N = 36;
    const paginateRows = (allRows) => {
        if (allRows.length <= ROWS_PAGE_1) return [allRows];
        const pages = [allRows.slice(0, ROWS_PAGE_1)];
        let rest = allRows.slice(ROWS_PAGE_1);
        while (rest.length > 0) { pages.push(rest.slice(0, ROWS_PAGE_N)); rest = rest.slice(ROWS_PAGE_N); }
        return pages;
    };
    const pages = paginateRows(rows);
    const getGlobalIndex = (pageIdx, localIdx) => pageIdx === 0 ? localIdx : ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;

    return (
        <div className="cp-body" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', margin: 0 }}>
            {/* Topbar */}
            <div className="cp-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && <Button icon={<ArrowLeftOutlined />} type="text" style={{ color: '#fff' }} onClick={onBack} />}
                    <span className="cp-topbar-title">Control Plan — Form Editor</span>
                    <Tag color={isApproved ? 'green' : 'blue'}>{status}</Tag>
                </div>

                <div className="cp-toolbar">
                    <button onMouseDown={e => { e.preventDefault(); execCmd('bold'); }} title="Bold" style={{ fontWeight: 'bold' }}>B</button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('italic'); }} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
                    <div className="cp-toolbar-divider" />
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft'); }} title="Align Left"><AlignLeftOutlined /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter'); }} title="Align Center"><AlignCenterOutlined /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyRight'); }} title="Align Right"><AlignRightOutlined /></button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Zoom:</span>
                    <Select value={zoom} onChange={setZoom} style={{ width: 80 }} size="small"
                        options={[
                            { value: '0.50', label: '50%' }, { value: '0.75', label: '75%' },
                            { value: '0.90', label: '90%' }, { value: '1', label: '100%' },
                            { value: '1.10', label: '110%' }, { value: '1.25', label: '125%' },
                        ]}
                    />
                    {!isApproved && <Button icon={<PlusOutlined />} type="primary" size="small" onClick={addRow}>Add Row</Button>}
                    {!isApproved && <Button icon={<CheckCircleOutlined />} size="small" style={{ background: '#faad14', color: '#fff', border: 'none' }} onClick={handleApprove}>Approve</Button>}
                    <Button icon={<PrinterOutlined />} size="small" style={{ background: '#52c41a', color: '#fff', border: 'none' }} onClick={() => window.print()}>Export PDF</Button>
                </div>
            </div>

            {/* Pages */}
            <div className="cp-pages" ref={pagesContainerRef} style={{ zoom }}>
                {pages.map((pageRows, pageIdx) => (
                    <div className="cp-a3-page" key={pageIdx}>
                        <div className="cp-page-number">Page {pageIdx + 1} of {pages.length}</div>
                        <div className="cp-page-content">
                            {pageIdx === 0 && (
                                <>
                                    <div className="cp-header-title">Control Plan</div>
                                    {renderHeader()}
                                </>
                            )}
                            <table className="cp-data-table">
                                {renderTableHead()}
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <tr key={row._key || globalIdx}>
                                                {COLUMNS.map(col => (
                                                    <td key={col.key}>
                                                        <ContentEditable
                                                            html={row[col.key] || ''}
                                                            disabled={isApproved}
                                                            className="cp-editable-cell"
                                                            onChange={val => updateCell(globalIdx, col.key, val)}
                                                        />
                                                    </td>
                                                ))}
                                                {!isApproved && (
                                                    <td className="cp-no-print">
                                                        <button className="cp-btn-remove" onClick={() => removeRow(globalIdx)}>X</button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
