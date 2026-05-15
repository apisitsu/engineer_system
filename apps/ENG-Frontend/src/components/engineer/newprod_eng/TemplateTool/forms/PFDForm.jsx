import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, Button, message, Tag } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ArrowLeftOutlined, PrinterOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { debounce } from 'lodash';

const ContentEditable = ({ html, disabled, onChange, className }) => {
    const ref = useRef(null);
    const lastHtml = useRef(html || '');

    // 1. เก็บค่าเริ่มต้นไว้แค่ครั้งแรกสุด เพื่อหลอกไม่ให้ React เขียนทับ DOM ใหม่ทุกครั้งที่พิมพ์
    const initialHtml = useRef(html || '').current;

    useEffect(() => {
        // 2. จะอัปเดตทับเนื้อหา ก็ต่อเมื่อมีการโหลดข้อมูลมาจากหลังบ้าน (API) 
        // และเนื้อหานั้นไม่ตรงกับที่กำลังพิมพ์อยู่เท่านั้น
        if (ref.current && ref.current.innerHTML !== (html || '')) {
            ref.current.innerHTML = html || '';
            lastHtml.current = html || '';
        }
    }, [html]);

    const handleInput = () => {
        const v = ref.current.innerHTML;
        if (v !== lastHtml.current) {
            lastHtml.current = v;
            onChange?.(v);
        }
    };

    return (
        <div
            ref={ref}
            contentEditable={!disabled}
            className={className}
            onInput={handleInput}
            suppressContentEditableWarning
            // 3. ใช้ initialHtml ใส่แทน html ตรงๆ
            dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
    );
};

const STYLES = `
.pfd-body { background:#525659; display:flex; flex-direction:column; min-height:100vh; font-family:'Segoe UI',Tahoma,sans-serif; font-size:11px; color:#000; }
.pfd-topbar { position:sticky; top:0; z-index:1000; background:#2c3e50; display:flex; justify-content:space-between; align-items:center; padding:8px 15px; box-shadow:0 2px 10px rgba(0,0,0,.3); gap:10px; flex-wrap:wrap; }
.pfd-topbar-title { color:#fff; font-size:15px; font-weight:bold; }
.pfd-toolbar { display:flex; align-items:center; background:#f0f2f5; padding:3px 6px; border-radius:5px; gap:2px; }
.pfd-toolbar button { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; color:#333; cursor:pointer; padding:3px 5px; font-size:13px; border-radius:4px; height:26px; min-width:26px; }
.pfd-toolbar button:hover { background:#d9e8ff; border-color:#91caff; color:#1677ff; }
.pfd-pages { display:flex; flex-direction:column; gap:20px; padding:20px 0; align-items:center; }
.pfd-a4-page { width:297mm; height:210mm; background:#fff; padding:8mm; box-shadow:0 4px 8px rgba(0,0,0,.2); box-sizing:border-box; position:relative; display:flex; flex-direction:column; overflow:hidden; }
.pfd-page-content { width:100%; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.pfd-page-number { position:absolute; bottom:4mm; right:8mm; font-size:11px; font-weight:bold; color:#555; }
.pfd-header-title { font-size:20px; font-weight:bold; margin-bottom:10px; text-align:center; }
.pfd-std-header { display:flex; margin-bottom:15px; border:2px solid #000; width:100%; box-sizing:border-box; }
.pfd-header-details { display:grid; grid-template-columns:1fr 1fr 1fr; flex:1; border-right:2px solid #000; }
.pfd-header-col { display:flex; flex-direction:column; border-right:1px solid #000; }
.pfd-header-col:last-child { border-right:none; }
.pfd-header-row { display:flex; align-items:center; border-bottom:1px solid #000; padding:2px 4px; flex:1; white-space:nowrap; }
.pfd-header-row:last-child { border-bottom:none; }
.pfd-header-row label { font-weight:bold; margin-right:5px; }
.pfd-header-row input { flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:11px; min-width:0; }
.pfd-approval-block { display:flex; width:200px; flex-shrink:0; }
.pfd-stamp-box { flex:1; display:flex; flex-direction:column; border-right:1px solid #000; }
.pfd-stamp-box:last-child { border-right:none; }
.pfd-stamp-title { text-align:center; font-weight:bold; border-bottom:1px solid #000; padding:2px; background:#f9f9f9; }
.pfd-stamp-area { flex:1; min-height:40px; padding:2px; text-align:center; outline:none; }
table.pfd-data-table { border-collapse:collapse!important; width:100%; border:1px solid #000; table-layout:fixed; }
table.pfd-data-table th,table.pfd-data-table td { border:1px solid #000!important; padding:2px 4px; text-align:center; vertical-align:middle; word-wrap:break-word; }
table.pfd-data-table th { background:#f9f9f9; font-weight:bold; }
.pfd-editable-cell { min-height:20px; width:100%; outline:none; cursor:text; text-align:center; padding:2px; word-break:break-word; }
.pfd-editable-cell:focus { background:#fff; box-shadow:inset 0 -2px 0 0 #1677ff; }
.pfd-btn-remove { background:#ff4d4f; padding:2px 6px; font-size:10px; border-radius:2px; border:none; color:white; cursor:pointer; }
@media print {
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  @page { size:A4 landscape; margin:5mm; }
  body { background:none!important; padding:0!important; }
  .pfd-topbar,.pfd-no-print { display:none!important; }
  .pfd-pages { gap:0!important; zoom:1!important; transform:none!important; padding:0!important; }
  .pfd-a4-page { width:297mm!important; height:210mm!important; box-shadow:none; margin:0; page-break-after:always; overflow:hidden; padding:5mm; }
  .pfd-a4-page:last-child { page-break-after:auto; }
  .pfd-page-content { overflow:hidden!important; }
  .pfd-editable-cell { box-shadow:none!important; }
}
`;

const COLUMNS = [
    { key: 'process_no', title: 'Process No.', width: '8%' },
    { key: 'process_name', title: 'Process Name', width: '14%' },
    { key: 'product_char', title: 'Product\nCharacteristic', width: '20%' },
    { key: 'process_char', title: 'Process\nCharacteristic', width: '20%' },
    { key: 'kc_check', title: 'KC', width: '6%', isCheckbox: true },
    { key: 'sp_check', title: 'SP', width: '6%', isCheckbox: true },
    { key: 'manufacturing_site', title: 'Manufacturing\nsite', width: '15%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach(c => { row[c.key] = c.isCheckbox ? false : ''; });
    return row;
};

export default function PFDForm({ formId, onBack }) {
    const [header, setHeader] = useState({ pid_number: '', customer_pn: '', nmb_pn: '', form_number: '', revision: '', prepare_by: '', check_by: '', date_initiated: '', target_date: '' });
    const [rows, setRows] = useState([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
    const [status, setStatus] = useState('In Progress');
    const [zoom, setZoom] = useState('1.25');
    const [deletedRowIds, setDeletedRowIds] = useState([]);
    const isApproved = status === 'Approved';

    useEffect(() => {
        const id = 'pfd-form-styles';
        if (!document.getElementById(id)) { const s = document.createElement('style'); s.id = id; s.textContent = STYLES; document.head.appendChild(s); }
    }, []);

    useEffect(() => {
        if (!formId) return;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${server.TT_FORMS}/pfd/${formId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.result === 'true') {
                    const { header: h, rows: r } = res.data.data;
                    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                    setHeader({ pid_number: h.pid_number || '', customer_pn: h.customer_pn || '', nmb_pn: h.nmb_pn || '', form_number: h.form_number || '', revision: h.revision || '', prepare_by: h.prepare_by || '', check_by: h.check_by || '', date_initiated: formatDate(h.date_initiated), target_date: formatDate(h.target_date) });
                    setStatus(h.status || 'In Progress');
                    if (r?.length) setRows(r.map(row => ({ ...row, _key: row.id || Date.now() + Math.random() })));
                }
            } catch (err) { console.error('PFD load error:', err); }
        })();
    }, [formId]);

    const saveData = useCallback(debounce(async (h, r, del) => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${server.TT_FORMS}/pfd/${formId}`, { header: h, rows: r, deletedRowIds: del }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.data?.rows) {
                const idMap = {};
                res.data.data.rows.forEach(dbRow => { if (dbRow._key && dbRow.id) idMap[dbRow._key] = dbRow.id; });
                setRows(prev => prev.map(pr => (pr._key && idMap[pr._key] && !pr.id) ? { ...pr, id: idMap[pr._key] } : pr));
            }
            setDeletedRowIds(prev => prev.filter(id => !del.includes(id)));
        } catch (err) { console.error('PFD save error:', err); }
    }, 3000), [formId]);

    useEffect(() => { if (formId && !isApproved) saveData(header, rows, deletedRowIds); }, [header, rows]);
    useEffect(() => { return () => saveData.flush?.(); }, [saveData]);

    const addRow = () => setRows(p => [...p, makeEmptyRow()]);
    const removeRow = (i) => { const r = rows[i]; if (r.id) setDeletedRowIds(p => [...p, r.id]); setRows(p => p.filter((_, j) => j !== i)); };
    const updateCell = (i, k, v) => setRows(p => { const c = [...p]; c[i] = { ...c[i], [k]: v }; return c; });
    const execCmd = (cmd) => document.execCommand(cmd, false, null);

    const handleApprove = async () => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${server.TT_FORMS}/pfd/${formId}`, { header, rows, deletedRowIds }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.put(`${server.TT_FORMS}/pfd/${formId}/status`, { status: 'Approved' }, { headers: { Authorization: `Bearer ${token}` } });
            setStatus('Approved'); message.success('PFD approved');
        } catch (err) { message.error('Approval failed'); }
    };

    // ─── Pagination: split rows into page-sized chunks ───
    const ROWS_PAGE_1 = 20; // page 1 has title + header + table head
    const ROWS_PAGE_N = 26; // subsequent pages only have table head
    const paginateRows = (allRows) => {
        if (allRows.length <= ROWS_PAGE_1) return [allRows];
        const pages = [allRows.slice(0, ROWS_PAGE_1)];
        let rest = allRows.slice(ROWS_PAGE_1);
        while (rest.length > 0) {
            pages.push(rest.slice(0, ROWS_PAGE_N));
            rest = rest.slice(ROWS_PAGE_N);
        }
        return pages;
    };
    const pages = paginateRows(rows);

    const renderTableHead = () => (
        <thead>
            <tr>
                <th rowSpan={2} style={{ width: '4%' }}>No.</th>
                {/* ดึงคอลัมน์ 4 อันแรกมาแสดง (Process No. ถึง Process Char) */}
                {COLUMNS.slice(0, 4).map(c => (
                    <th key={c.key} rowSpan={2} style={{ width: c.width }}>
                        {c.title.split('\n').map((t, i) => <React.Fragment key={i}>{i > 0 && <br />}{t}</React.Fragment>)}
                    </th>
                ))}

                {/* ใส่หัวตาราง KC / SP ต่อจาก 4 คอลัมน์แรก */}
                <th colSpan={2}>Other significant Characteristic</th>

                {/* ปิดท้ายด้วย Manufacturing site */}
                <th rowSpan={2} style={{ width: '15%' }}>Manufacturing<br />site</th>

                {!isApproved && <th rowSpan={2} className="pfd-no-print" style={{ width: '4%' }}>Del</th>}
            </tr>
            <tr>
                <th style={{ width: '6%' }}>KC</th>
                <th style={{ width: '6%' }}>SP</th>
            </tr>
        </thead>
    );

    // Calculate global row index from page index + local index
    const getGlobalIndex = (pageIdx, localIdx) => {
        if (pageIdx === 0) return localIdx;
        return ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;
    };

    return (
        <div className="pfd-body">
            <div className="pfd-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {onBack && <Button icon={<ArrowLeftOutlined />} type="text" style={{ color: '#fff' }} onClick={onBack} />}
                    <span className="pfd-topbar-title">Process Flow Diagram</span>
                    <Tag color={isApproved ? 'green' : 'blue'}>{status}</Tag>
                </div>
                <div className="pfd-toolbar">
                    <button onMouseDown={e => { e.preventDefault(); execCmd('bold') }} style={{ fontWeight: 'bold' }}>B</button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('italic') }} style={{ fontStyle: 'italic' }}>I</button>
                    <div style={{ width: 1, height: 18, background: '#ccc', margin: '0 3px' }} />
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyLeft') }}><AlignLeftOutlined /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyCenter') }}><AlignCenterOutlined /></button>
                    <button onMouseDown={e => { e.preventDefault(); execCmd('justifyRight') }}><AlignRightOutlined /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Zoom:</span>
                    <Select value={zoom} onChange={setZoom} style={{ width: 80 }} size="small" options={[{ value: '0.75', label: '75%' }, { value: '0.90', label: '90%' }, { value: '1', label: '100%' }, { value: '1.10', label: '110%' }, { value: '1.25', label: '125%' }, { value: '1.50', label: '150%' }]} />
                    {!isApproved && <Button icon={<PlusOutlined />} type="primary" size="small" onClick={addRow}>Add Row</Button>}
                    {!isApproved && <Button icon={<CheckCircleOutlined />} size="small" style={{ background: '#faad14', color: '#fff', border: 'none' }} onClick={handleApprove}>Approve</Button>}
                    <Button icon={<PrinterOutlined />} size="small" style={{ background: '#52c41a', color: '#fff', border: 'none' }} onClick={() => window.print()}>Export PDF</Button>
                </div>
            </div>
            <div className="pfd-pages" style={{ zoom }}>
                {pages.map((pageRows, pageIdx) => (
                    <div className="pfd-a4-page" key={pageIdx}>
                        <div className="pfd-page-number">Page {pageIdx + 1} of {pages.length}</div>
                        <div className="pfd-page-content">
                            {/* Title + Header only on page 1 */}
                            {pageIdx === 0 && (
                                <>
                                    <div className="pfd-header-title">Process Flow Diagram</div>
                                    <div className="pfd-std-header">
                                        <div className="pfd-header-details">
                                            <div className="pfd-header-col">
                                                <div className="pfd-header-row"><label>PID Number:</label><input value={header.pid_number} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, pid_number: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>Customer P/N:</label><input value={header.customer_pn} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, customer_pn: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>NMB P/N:</label><input value={header.nmb_pn} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, nmb_pn: e.target.value }))} /></div>
                                            </div>
                                            <div className="pfd-header-col">
                                                <div className="pfd-header-row"><label>PFD No.:</label><input value={header.form_number} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, form_number: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>Prepare by:</label><input value={header.prepare_by} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, prepare_by: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>Check by:</label><input value={header.check_by} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, check_by: e.target.value }))} /></div>
                                            </div>
                                            <div className="pfd-header-col">
                                                <div className="pfd-header-row"><label>REV.:</label><input value={header.revision} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, revision: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>Date Initiated:</label><input type="date" value={header.date_initiated} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, date_initiated: e.target.value }))} /></div>
                                                <div className="pfd-header-row"><label>Target Date:</label><input type="date" value={header.target_date} disabled={isApproved} onChange={e => setHeader(h => ({ ...h, target_date: e.target.value }))} /></div>
                                            </div>
                                        </div>
                                        <div className="pfd-approval-block">
                                            {['Prepare', 'Check by', 'Approve'].map(l => (
                                                <div className="pfd-stamp-box" key={l}><div className="pfd-stamp-title">{l}</div><div className="pfd-stamp-area" contentEditable={!isApproved} suppressContentEditableWarning /></div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                            {/* Data table (repeated on every page) */}
                            <table className="pfd-data-table">
                                {renderTableHead()}
                                <tbody>
                                    {pageRows.map((row, localIdx) => {
                                        const globalIdx = getGlobalIndex(pageIdx, localIdx);
                                        return (
                                            <tr key={row._key || globalIdx}>
                                                <td style={{ fontWeight: 'bold', color: '#333' }}>{globalIdx + 1}</td>
                                                {COLUMNS.map(col => (
                                                    <td key={col.key}>
                                                        {col.isCheckbox ? (
                                                            <input type="checkbox" checked={!!row[col.key]} disabled={isApproved} onChange={e => updateCell(globalIdx, col.key, e.target.checked)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                                                        ) : (
                                                            <ContentEditable html={row[col.key] || ''} disabled={isApproved} className="pfd-editable-cell" onChange={v => updateCell(globalIdx, col.key, v)} />
                                                        )}
                                                    </td>
                                                ))}
                                                {!isApproved && <td className="pfd-no-print"><button className="pfd-btn-remove" onClick={() => removeRow(globalIdx)}>X</button></td>}
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
