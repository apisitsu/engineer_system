import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, Button, message, Tag } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ArrowLeftOutlined, PrinterOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined, ThunderboltOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { debounce } from 'lodash';

const ContentEditable = ({ html, disabled, onChange, className, style }) => {
    const ref = useRef(null);
    const lastHtml = useRef(html);
    useEffect(() => { if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html || ''; }, [html]);
    const handleInput = () => { const v = ref.current.innerHTML; if (v !== lastHtml.current) { lastHtml.current = v; onChange?.(v); } };
    return <div ref={ref} contentEditable={!disabled} className={className} style={style} onInput={handleInput} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html || '' }} />;
};

/* AIAG-VDA Action Priority Matrix */
function calculateAP(s, o, d) {
    s = parseInt(s); o = parseInt(o); d = parseInt(d);
    if (isNaN(s)||isNaN(o)||isNaN(d)||s<1||s>10||o<1||o>10||d<1||d>10) return '';
    if (s===1) return 'L';
    if (s>=2&&s<=3) { if (o<=7) return 'L'; return d<=4?'L':'M'; }
    if (s>=4&&s<=6) { if (o<=3) return 'L'; if (o<=5) return d<=6?'L':'M'; if (o<=7) return d===1?'L':'M'; return d<=4?'M':'H'; }
    if (s>=7&&s<=8) { if (o===1) return 'L'; if (o<=3) return d<=4?'L':'M'; if (o<=5) return d<=6?'M':'H'; if (o<=7) return d===1?'M':'H'; return 'H'; }
    if (s>=9) { if (o===1) return 'L'; if (o<=3) { if (d<=4) return 'L'; return d<=6?'M':'H'; } if (o<=5) return d===1?'M':'H'; return 'H'; }
    return '';
}

const AP_STYLES = { H: { background:'#ff4d4f', color:'#fff' }, M: { background:'#faad14', color:'#000' }, L: { background:'#52c41a', color:'#fff' } };

const STYLES = `
.pfmea-body { background:#525659; display:flex; flex-direction:column; min-height:100vh; font-family:'Segoe UI',Tahoma,sans-serif; font-size:11px; color:#000; }
.pfmea-topbar { position:sticky; top:0; z-index:1000; background:#2c3e50; display:flex; justify-content:space-between; align-items:center; padding:8px 15px; box-shadow:0 2px 10px rgba(0,0,0,.3); gap:10px; flex-wrap:wrap; }
.pfmea-topbar-title { color:#fff; font-size:15px; font-weight:bold; }
.pfmea-toolbar { display:flex; align-items:center; background:#f0f2f5; padding:3px 6px; border-radius:5px; gap:2px; }
.pfmea-toolbar button { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; color:#333; cursor:pointer; padding:3px 5px; font-size:13px; border-radius:4px; height:26px; min-width:26px; }
.pfmea-toolbar button:hover { background:#d9e8ff; border-color:#91caff; color:#1677ff; }
.pfmea-pages { display:flex; flex-direction:column; gap:20px; padding:20px 0; align-items:center; }
.pfmea-a2-page { width:594mm; height:420mm; background:#fff; padding:10mm; box-shadow:0 4px 8px rgba(0,0,0,.2); box-sizing:border-box; position:relative; display:flex; flex-direction:column; overflow:hidden; }
.pfmea-page-content { width:100%; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.pfmea-page-number { position:absolute; bottom:6mm; right:10mm; font-size:11px; font-weight:bold; color:#555; }
.pfmea-header-title { font-size:24px; font-weight:bold; text-align:center; margin-bottom:10px; text-transform:uppercase; }
.pfmea-std-header { display:flex; margin-bottom:15px; border:2px solid #000; width:100%; box-sizing:border-box; }
.pfmea-header-details { display:grid; grid-template-columns:1fr 1fr 1fr; flex:1; border-right:2px solid #000; }
.pfmea-header-col { display:flex; flex-direction:column; border-right:1px solid #000; }
.pfmea-header-col:last-child { border-right:none; }
.pfmea-header-row { display:flex; align-items:center; border-bottom:1px solid #000; padding:2px 4px; flex:1; white-space:nowrap; }
.pfmea-header-row:last-child { border-bottom:none; }
.pfmea-header-row label { font-weight:bold; margin-right:5px; }
.pfmea-header-row input { flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:11px; min-width:0; }
.pfmea-approval-block { display:flex; width:200px; flex-shrink:0; }
.pfmea-stamp-box { flex:1; display:flex; flex-direction:column; border-right:1px solid #000; }
.pfmea-stamp-box:last-child { border-right:none; }
.pfmea-stamp-title { text-align:center; font-weight:bold; border-bottom:1px solid #000; padding:2px; background:#f9f9f9; }
.pfmea-stamp-area { flex:1; min-height:40px; padding:2px; text-align:center; outline:none; }
table.pfmea-data-table { border-collapse:collapse!important; width:100%; border:1px solid #000; table-layout:fixed; }
table.pfmea-data-table th,table.pfmea-data-table td { border:1px solid #000!important; padding:4px; text-align:center; vertical-align:top; word-wrap:break-word; }
table.pfmea-data-table th { background:#f0f0f0; font-weight:bold; vertical-align:middle; }
.pfmea-editable-cell { min-height:25px; width:100%; outline:none; cursor:text; text-align:left; padding:2px 4px; word-break:break-word; }
.pfmea-editable-cell:focus { background:#fff; box-shadow:inset 0 -2px 0 0 #1677ff; }
.pfmea-center { text-align:center!important; }
.pfmea-rpn-cell { font-weight:bold; font-size:14px; text-align:center; padding:4px; min-height:25px; display:flex; align-items:center; justify-content:center; border-radius:2px; }
.pfmea-btn-remove { background:#ff4d4f; padding:2px 6px; font-size:10px; border-radius:2px; border:none; color:white; cursor:pointer; }
@media print {
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  @page { size:420mm 594mm; margin:5mm; }
  body { background:none!important; }
  .pfmea-topbar,.pfmea-no-print { display:none!important; }
  .pfmea-pages { gap:0!important; zoom:1!important; padding:0!important; }
  .pfmea-a2-page { width:420mm!important; height:594mm!important; box-shadow:none; margin:0; page-break-after:always; overflow:hidden; padding:5mm; }
  .pfmea-a2-page:last-child { page-break-after:auto; }
  .pfmea-page-content { overflow:hidden!important; }
  .pfmea-editable-cell { box-shadow:none!important; }
}
`;

const COL_WIDTHS = ['2%','4%','7%','7%','7%','7%','2%','7%','2%','7%','7%','2%','3%','7%','7%','7%','2%','2%','2%','3%'];

const COLUMNS = [
    {key:'operation',w:COL_WIDTHS[0]},{key:'process_function',w:COL_WIDTHS[1]},{key:'requirements',w:COL_WIDTHS[2]},
    {key:'potential_failure_mode',w:COL_WIDTHS[3]},{key:'potential_effects',w:COL_WIDTHS[4]},
    {key:'severity_1',w:COL_WIDTHS[5],center:true},{key:'potential_causes',w:COL_WIDTHS[6]},
    {key:'occurrence_1',w:COL_WIDTHS[7],center:true},{key:'prevention_controls',w:COL_WIDTHS[8]},
    {key:'detection_controls',w:COL_WIDTHS[9]},{key:'detection_1',w:COL_WIDTHS[10],center:true},
    {key:'rpn_1',w:COL_WIDTHS[11],isRPN:true},{key:'recommended_action',w:COL_WIDTHS[12]},
    {key:'responsibility',w:COL_WIDTHS[13]},{key:'actions_taken',w:COL_WIDTHS[14]},
    {key:'severity_2',w:COL_WIDTHS[15],center:true},{key:'occurrence_2',w:COL_WIDTHS[16],center:true},
    {key:'detection_2',w:COL_WIDTHS[17],center:true},{key:'rpn_2',w:COL_WIDTHS[18],isRPN:true},
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach(c => { row[c.key] = ''; });
    return row;
};

export default function PFMEAForm({ formId, onBack }) {
    const [header, setHeader] = useState({ pid_number:'', customer_pn:'', nmb_pn:'', form_number:'', revision:'', prepare_by:'', check_by:'', date_initiated:'', target_date:'' });
    const [rows, setRows] = useState([makeEmptyRow(), makeEmptyRow()]);
    const [status, setStatus] = useState('In Progress');
    const [zoom, setZoom] = useState('0.50');
    const [deletedRowIds, setDeletedRowIds] = useState([]);
    const isApproved = status === 'Approved';

    useEffect(() => { const id='pfmea-styles'; if(!document.getElementById(id)){const s=document.createElement('style');s.id=id;s.textContent=STYLES;document.head.appendChild(s);} }, []);

    useEffect(() => {
        if (!formId) return;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${server.TT_FORMS}/pfmea/${formId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.result === 'true') {
                    const { header: h, rows: r } = res.data.data;
                    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                    setHeader({ pid_number:h.pid_number||'', customer_pn:h.customer_pn||'', nmb_pn:h.nmb_pn||'', form_number:h.form_number||'', revision:h.revision||'', prepare_by:h.prepare_by||'', check_by:h.check_by||'', date_initiated:formatDate(h.date_initiated), target_date:formatDate(h.target_date) });
                    setStatus(h.status || 'In Progress');
                    if (r?.length) setRows(r.map(row => ({ ...row, _key: row.id||Date.now()+Math.random() })));
                }
            } catch (err) { console.error('PFMEA load error:', err); }
        })();
    }, [formId]);

    const saveData = useCallback(debounce(async (h, r, del) => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${server.TT_FORMS}/pfmea/${formId}`, { header:h, rows:r, deletedRowIds:del }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.data?.rows) {
                const idMap = {};
                res.data.data.rows.forEach(dbRow => { if (dbRow._key && dbRow.id) idMap[dbRow._key] = dbRow.id; });
                setRows(prev => prev.map(pr => (pr._key && idMap[pr._key] && !pr.id) ? { ...pr, id: idMap[pr._key] } : pr));
            }
            setDeletedRowIds(prev => prev.filter(id => !del.includes(id)));
        } catch(err) { console.error('PFMEA save error:', err); }
    }, 3000), [formId]);

    useEffect(() => { if (formId && !isApproved) saveData(header, rows, deletedRowIds); }, [header, rows]);
    useEffect(() => { return () => saveData.flush?.(); }, [saveData]);

    const addRow = () => setRows(p => [...p, makeEmptyRow()]);
    const removeRow = (i) => { const r=rows[i]; if(r.id) setDeletedRowIds(p=>[...p,r.id]); setRows(p=>p.filter((_,j)=>j!==i)); };
    const updateCell = (i, k, v) => setRows(p => { const c=[...p]; c[i]={...c[i],[k]:v}; return c; });
    const execCmd = (cmd) => document.execCommand(cmd, false, null);

    const evaluateAllRPN = () => {
        setRows(prev => prev.map(row => {
            const rpn1 = calculateAP(row.severity_1, row.occurrence_1, row.detection_1);
            const rpn2 = calculateAP(row.severity_2, row.occurrence_2, row.detection_2);
            return { ...row, rpn_1: rpn1, rpn_2: rpn2 };
        }));
    };

    const handleApprove = async () => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${server.TT_FORMS}/pfmea/${formId}`, { header, rows, deletedRowIds }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.put(`${server.TT_FORMS}/pfmea/${formId}/status`, { status:'Approved' }, { headers: { Authorization: `Bearer ${token}` } });
            setStatus('Approved'); message.success('PFMEA approved');
        } catch(err) { message.error('Approval failed'); }
    };

    const renderRPN = (value) => {
        const st = AP_STYLES[value] || { background:'transparent', color:'inherit' };
        return <div className="pfmea-rpn-cell" style={st}>{value||''}</div>;
    };

    // ─── Pagination: A2 has lots of space ───
    const ROWS_PAGE_1 = 38;
    const ROWS_PAGE_N = 44;
    const paginateRows = (allRows) => {
        if (allRows.length <= ROWS_PAGE_1) return [allRows];
        const pages = [allRows.slice(0, ROWS_PAGE_1)];
        let rest = allRows.slice(ROWS_PAGE_1);
        while (rest.length > 0) { pages.push(rest.slice(0, ROWS_PAGE_N)); rest = rest.slice(ROWS_PAGE_N); }
        return pages;
    };
    const pages = paginateRows(rows);
    const getGlobalIndex = (pageIdx, localIdx) => pageIdx === 0 ? localIdx : ROWS_PAGE_1 + (pageIdx - 1) * ROWS_PAGE_N + localIdx;

    const renderTableHead = () => (
        <thead>
            <tr>
                <th rowSpan={2} style={{width:'2%'}}>No.</th>
                <th rowSpan={2} style={{width:'4%'}}>Operation</th>
                <th rowSpan={2} style={{width:'7%'}}>Process Function<br/>Description</th>
                <th rowSpan={2} style={{width:'7%'}}>Requirements</th>
                <th rowSpan={2} style={{width:'7%'}}>Potential<br/>Failure Mode</th>
                <th rowSpan={2} style={{width:'7%'}}>Potential<br/>Effects of Failure</th>
                <th rowSpan={2} style={{width:'2%'}}>S</th>
                <th rowSpan={2} style={{width:'7%'}}>Potential<br/>Cause(s) of Failure</th>
                <th rowSpan={2} style={{width:'2%'}}>O</th>
                <th rowSpan={2} style={{width:'7%'}}>Prevention<br/>Controls</th>
                <th rowSpan={2} style={{width:'7%'}}>Detection<br/>Controls</th>
                <th rowSpan={2} style={{width:'2%'}}>D</th>
                <th rowSpan={2} style={{width:'3%'}}>RPN</th>
                <th rowSpan={2} style={{width:'7%'}}>Recommended<br/>Action</th>
                <th rowSpan={2} style={{width:'7%'}}>Responsibility &<br/>Target Date</th>
                <th colSpan={5}>Action Results</th>
                {!isApproved && <th rowSpan={2} className="pfmea-no-print" style={{width:'2%'}}>Del</th>}
            </tr>
            <tr>
                <th style={{width:'7%'}}>Actions Taken & Date</th>
                <th style={{width:'2%'}}>S</th><th style={{width:'2%'}}>O</th><th style={{width:'2%'}}>D</th>
                <th style={{width:'3%'}}>RPN</th>
            </tr>
        </thead>
    );

    const renderRow = (row, globalIdx) => (
        <tr key={row._key||globalIdx}>
            <td style={{fontWeight:'bold',verticalAlign:'middle'}}>{globalIdx+1}</td>
            {COLUMNS.map(col => (
                <td key={col.key} style={col.isRPN?{WebkitPrintColorAdjust:'exact'}:undefined}>
                    {col.isRPN ? renderRPN(row[col.key]) : (
                        <ContentEditable html={String(row[col.key]||'')} disabled={isApproved} className={`pfmea-editable-cell ${col.center?'pfmea-center':''}`} onChange={v => {
                            updateCell(globalIdx, col.key, v);
                            if (['severity_1','occurrence_1','detection_1'].includes(col.key)) {
                                const updatedRow = {...row, [col.key]: v};
                                const plainVal = (k) => { const el = document.createElement('div'); el.innerHTML = updatedRow[k]||''; return el.textContent.trim(); };
                                const rpn = calculateAP(plainVal('severity_1'), plainVal('occurrence_1'), plainVal('detection_1'));
                                setTimeout(() => updateCell(globalIdx, 'rpn_1', rpn), 0);
                            }
                            if (['severity_2','occurrence_2','detection_2'].includes(col.key)) {
                                const updatedRow = {...row, [col.key]: v};
                                const plainVal = (k) => { const el = document.createElement('div'); el.innerHTML = updatedRow[k]||''; return el.textContent.trim(); };
                                const rpn = calculateAP(plainVal('severity_2'), plainVal('occurrence_2'), plainVal('detection_2'));
                                setTimeout(() => updateCell(globalIdx, 'rpn_2', rpn), 0);
                            }
                        }} />
                    )}
                </td>
            ))}
            {!isApproved && <td className="pfmea-no-print"><button className="pfmea-btn-remove" onClick={()=>removeRow(globalIdx)}>X</button></td>}
        </tr>
    );

    return (
        <div className="pfmea-body">
            <div className="pfmea-topbar">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {onBack && <Button icon={<ArrowLeftOutlined/>} type="text" style={{color:'#fff'}} onClick={onBack}/>}
                    <span className="pfmea-topbar-title">PFMEA Editor (A2 Size)</span>
                    <Tag color={isApproved?'green':'blue'}>{status}</Tag>
                </div>
                <div className="pfmea-toolbar">
                    <button onMouseDown={e=>{e.preventDefault();execCmd('bold')}} style={{fontWeight:'bold'}}>B</button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('italic')}} style={{fontStyle:'italic'}}>I</button>
                    <div style={{width:1,height:18,background:'#ccc',margin:'0 3px'}} />
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyLeft')}}><AlignLeftOutlined/></button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyCenter')}}><AlignCenterOutlined/></button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyRight')}}><AlignRightOutlined/></button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>Zoom:</span>
                    <Select value={zoom} onChange={setZoom} style={{width:80}} size="small" options={[{value:'0.30',label:'30%'},{value:'0.40',label:'40%'},{value:'0.50',label:'50%'},{value:'0.75',label:'75%'},{value:'0.90',label:'90%'},{value:'1',label:'100%'}]} />
                    <Button icon={<ThunderboltOutlined/>} size="small" style={{background:'#fa8c16',color:'#fff',border:'none'}} onClick={evaluateAllRPN}>Evaluate RPN</Button>
                    {!isApproved && <Button icon={<PlusOutlined/>} type="primary" size="small" onClick={addRow}>Add Row</Button>}
                    {!isApproved && <Button icon={<CheckCircleOutlined/>} size="small" style={{background:'#faad14',color:'#fff',border:'none'}} onClick={handleApprove}>Approve</Button>}
                    <Button icon={<PrinterOutlined/>} size="small" style={{background:'#52c41a',color:'#fff',border:'none'}} onClick={()=>window.print()}>Export PDF</Button>
                </div>
            </div>
            <div className="pfmea-pages" style={{ zoom }}>
                {pages.map((pageRows, pageIdx) => (
                    <div className="pfmea-a2-page" key={pageIdx}>
                        <div className="pfmea-page-number">Page {pageIdx+1} of {pages.length}</div>
                        <div className="pfmea-page-content">
                            {pageIdx === 0 && (
                                <>
                                    <div className="pfmea-header-title">Process Failure Mode and Effects Analysis (PFMEA)</div>
                                    <div className="pfmea-std-header">
                                        <div className="pfmea-header-details">
                                            <div className="pfmea-header-col">
                                                <div className="pfmea-header-row"><label>PID Number:</label><input value={header.pid_number} disabled={isApproved} onChange={e=>setHeader(h=>({...h,pid_number:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>Customer P/N:</label><input value={header.customer_pn} disabled={isApproved} onChange={e=>setHeader(h=>({...h,customer_pn:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>NMB P/N:</label><input value={header.nmb_pn} disabled={isApproved} onChange={e=>setHeader(h=>({...h,nmb_pn:e.target.value}))}/></div>
                                            </div>
                                            <div className="pfmea-header-col">
                                                <div className="pfmea-header-row"><label>PFMEA No.:</label><input value={header.form_number} disabled={isApproved} onChange={e=>setHeader(h=>({...h,form_number:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>Prepare by:</label><input value={header.prepare_by} disabled={isApproved} onChange={e=>setHeader(h=>({...h,prepare_by:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>Check by:</label><input value={header.check_by} disabled={isApproved} onChange={e=>setHeader(h=>({...h,check_by:e.target.value}))}/></div>
                                            </div>
                                            <div className="pfmea-header-col">
                                                <div className="pfmea-header-row"><label>REV.:</label><input value={header.revision} disabled={isApproved} onChange={e=>setHeader(h=>({...h,revision:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>Date Initiated:</label><input type="date" value={header.date_initiated} disabled={isApproved} onChange={e=>setHeader(h=>({...h,date_initiated:e.target.value}))}/></div>
                                                <div className="pfmea-header-row"><label>Target Date:</label><input type="date" value={header.target_date} disabled={isApproved} onChange={e=>setHeader(h=>({...h,target_date:e.target.value}))}/></div>
                                            </div>
                                        </div>
                                        <div className="pfmea-approval-block">
                                            {['Prepare','Check by','Approve'].map(l=>(<div className="pfmea-stamp-box" key={l}><div className="pfmea-stamp-title">{l}</div><div className="pfmea-stamp-area" contentEditable={!isApproved} suppressContentEditableWarning/></div>))}
                                        </div>
                                    </div>
                                </>
                            )}
                            <table className="pfmea-data-table">
                                {renderTableHead()}
                                <tbody>
                                    {pageRows.map((row, localIdx) => renderRow(row, getGlobalIndex(pageIdx, localIdx)))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

