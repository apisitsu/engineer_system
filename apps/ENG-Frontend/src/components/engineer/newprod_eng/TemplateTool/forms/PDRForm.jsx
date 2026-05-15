import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, Button, message, Tag } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ArrowLeftOutlined, PrinterOutlined, AlignLeftOutlined, AlignCenterOutlined, AlignRightOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { debounce } from 'lodash';

const ContentEditable = ({ html, disabled, onChange, className }) => {
    const ref = useRef(null);
    const lastHtml = useRef(html);
    useEffect(() => { if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html || ''; }, [html]);
    const handleInput = () => { const v = ref.current.innerHTML; if (v !== lastHtml.current) { lastHtml.current = v; onChange?.(v); } };
    return <div ref={ref} contentEditable={!disabled} className={className} onInput={handleInput} suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html || '' }} />;
};

const STYLES = `
.pdr-body { background:#525659; display:flex; flex-direction:column; min-height:100vh; font-family:'Segoe UI',Tahoma,sans-serif; font-size:11px; color:#000; }
.pdr-topbar { position:sticky; top:0; z-index:1000; background:#2c3e50; display:flex; justify-content:space-between; align-items:center; padding:8px 15px; box-shadow:0 2px 10px rgba(0,0,0,.3); gap:10px; flex-wrap:wrap; }
.pdr-topbar-title { color:#fff; font-size:15px; font-weight:bold; }
.pdr-toolbar { display:flex; align-items:center; background:#f0f2f5; padding:3px 6px; border-radius:5px; gap:2px; }
.pdr-toolbar button { display:inline-flex; align-items:center; justify-content:center; background:transparent; border:1px solid transparent; color:#333; cursor:pointer; padding:3px 5px; font-size:13px; border-radius:4px; height:26px; min-width:26px; }
.pdr-toolbar button:hover { background:#d9e8ff; border-color:#91caff; color:#1677ff; }
.pdr-pages { display:flex; flex-direction:column; gap:20px; padding:20px 0; align-items:center; }
.pdr-a4-page { width:297mm; height:210mm; background:#fff; padding:8mm; box-shadow:0 4px 8px rgba(0,0,0,.2); box-sizing:border-box; position:relative; display:flex; flex-direction:column; overflow:hidden; }
.pdr-page-content { width:100%; flex:1; display:flex; flex-direction:column; overflow:hidden; }
.pdr-page-number { position:absolute; bottom:4mm; right:8mm; font-size:11px; font-weight:bold; color:#555; }
.pdr-header-title { font-size:18px; font-weight:bold; text-align:center; margin-bottom:10px; }
.pdr-std-header { display:flex; margin-bottom:15px; border:2px solid #000; width:100%; box-sizing:border-box; }
.pdr-header-details { display:grid; grid-template-columns:1fr 1fr 1fr; flex:1; border-right:2px solid #000; }
.pdr-header-col { display:flex; flex-direction:column; border-right:1px solid #000; }
.pdr-header-col:last-child { border-right:none; }
.pdr-header-row { display:flex; align-items:center; border-bottom:1px solid #000; padding:2px 4px; flex:1; white-space:nowrap; }
.pdr-header-row:last-child { border-bottom:none; }
.pdr-header-row label { font-weight:bold; margin-right:5px; }
.pdr-header-row input { flex:1; border:none; outline:none; background:transparent; font-family:inherit; font-size:11px; min-width:0; }
.pdr-approval-block { display:flex; width:200px; flex-shrink:0; }
.pdr-stamp-box { flex:1; display:flex; flex-direction:column; border-right:1px solid #000; }
.pdr-stamp-box:last-child { border-right:none; }
.pdr-stamp-title { text-align:center; font-weight:bold; border-bottom:1px solid #000; padding:2px; background:#f9f9f9; }
.pdr-stamp-area { flex:1; min-height:40px; padding:2px; text-align:center; outline:none; }
table.pdr-data-table { border-collapse:collapse!important; width:100%; border:1px solid #000; table-layout:fixed; }
table.pdr-data-table th, table.pdr-data-table td { border:1px solid #000!important; padding:2px 4px; text-align:center; vertical-align:middle; word-wrap:break-word; }
table.pdr-data-table th { background:#f0f0f0; font-weight:bold; }
.pdr-editable-cell { min-height:20px; width:100%; outline:none; cursor:text; text-align:center; padding:2px; word-break:break-word; }
.pdr-editable-cell:focus { background:#fff; box-shadow:inset 0 -2px 0 0 #1677ff; }
.pdr-select-applied { border:none; font-size:11px; text-align:center; cursor:pointer; outline:none; width:100%; background:transparent; }
.pdr-applied-yes { background:#e6ffed; color:#28a745; font-weight:bold; }
.pdr-applied-no { background:#fff1f0; color:#f5222d; font-weight:bold; }
.pdr-applied-na { background:#f0f0f0; color:#555; }
.pdr-btn-remove { background:#ff4d4f; padding:2px 6px; font-size:10px; border-radius:2px; border:none; color:white; cursor:pointer; }
@media print {
  * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  @page { size:A4 landscape; margin:5mm; }
  body { background:none!important; }
  .pdr-topbar,.pdr-no-print { display:none!important; }
  .pdr-pages { gap:0!important; zoom:1!important; padding:0!important; }
  .pdr-a4-page { width:297mm!important; height:210mm!important; box-shadow:none; margin:0; page-break-after:always; overflow:hidden; padding:5mm; }
  .pdr-a4-page:last-child { page-break-after:auto; }
  .pdr-page-content { overflow:hidden!important; }
  .pdr-editable-cell { box-shadow:none!important; }
}
`;

const COLUMNS = [
    { key:'priority', title:'Priority', width:'6%', isRadio:true },
    { key:'document_no', title:'Document No.', width:'12%' },
    { key:'revision', title:'Rev', width:'5%' },
    { key:'title', title:'Title', width:'20%' },
    { key:'applied', title:'Applied', width:'8%', isSelect:true },
    { key:'approval', title:'Approval', width:'12%' },
    { key:'register', title:'Register', width:'10%' },
    { key:'remark', title:'Remark', width:'15%' },
];

const makeEmptyRow = () => {
    const row = { _key: Date.now() + Math.random() };
    COLUMNS.forEach(c => { row[c.key] = ''; });
    return row;
};

export default function PDRForm({ formId, onBack }) {
    const [header, setHeader] = useState({ pid_number:'', customer_pn:'', nmb_pn:'', form_number:'', revision:'', prepare_by:'', check_by:'', date_initiated:'', target_date:'' });
    const [rows, setRows] = useState([makeEmptyRow(), makeEmptyRow(), makeEmptyRow()]);
    const [status, setStatus] = useState('In Progress');
    const [zoom, setZoom] = useState('1.25');
    const [deletedRowIds, setDeletedRowIds] = useState([]);
    const isApproved = status === 'Approved';

    useEffect(() => { const id='pdr-styles'; if(!document.getElementById(id)){const s=document.createElement('style');s.id=id;s.textContent=STYLES;document.head.appendChild(s);} }, []);

    useEffect(() => {
        if (!formId) return;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${server.TT_FORMS}/pdr/${formId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.result === 'true') {
                    const { header:h, rows:r } = res.data.data;
                    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                    setHeader({ pid_number:h.pid_number||'', customer_pn:h.customer_pn||'', nmb_pn:h.nmb_pn||'', form_number:h.form_number||'', revision:h.revision||'', prepare_by:h.prepare_by||'', check_by:h.check_by||'', date_initiated:formatDate(h.date_initiated), target_date:formatDate(h.target_date) });
                    setStatus(h.status || 'In Progress');
                    if (r?.length) setRows(r.map(row=>({...row,_key:row.id||Date.now()+Math.random()})));
                }
            } catch(err) { console.error('PDR load error:', err); }
        })();
    }, [formId]);

    const saveData = useCallback(debounce(async (h, r, del) => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            const res = await axios.put(`${server.TT_FORMS}/pdr/${formId}`, { header:h, rows:r, deletedRowIds:del }, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data?.data?.rows) {
                const idMap = {};
                res.data.data.rows.forEach(dbRow => { if (dbRow._key && dbRow.id) idMap[dbRow._key] = dbRow.id; });
                setRows(prev => prev.map(pr => (pr._key && idMap[pr._key] && !pr.id) ? { ...pr, id: idMap[pr._key] } : pr));
            }
            setDeletedRowIds(prev => prev.filter(id => !del.includes(id)));
        } catch(err) { console.error('PDR save error:', err); }
    }, 3000), [formId]);

    useEffect(() => { if (formId && !isApproved) saveData(header, rows, deletedRowIds); }, [header, rows]);
    useEffect(() => { return () => saveData.flush?.(); }, [saveData]);

    const addRow = () => setRows(p=>[...p,makeEmptyRow()]);
    const removeRow = (i) => { const r=rows[i]; if(r.id) setDeletedRowIds(p=>[...p,r.id]); setRows(p=>p.filter((_,j)=>j!==i)); };
    const updateCell = (i,k,v) => setRows(p => { const c=[...p]; c[i]={...c[i],[k]:v}; return c; });
    const execCmd = (cmd) => document.execCommand(cmd, false, null);

    const handleApprove = async () => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${server.TT_FORMS}/pdr/${formId}`, { header, rows, deletedRowIds }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.put(`${server.TT_FORMS}/pdr/${formId}/status`, { status:'Approved' }, { headers: { Authorization: `Bearer ${token}` } });
            setStatus('Approved'); message.success('PDR approved');
        } catch(err) { message.error('Approval failed'); }
    };

    const getAppliedClass = (v) => v==='Yes'?'pdr-applied-yes':v==='No'?'pdr-applied-no':v==='N/A'?'pdr-applied-na':'';

    // ─── Pagination ───
    const ROWS_PAGE_1 = 20;
    const ROWS_PAGE_N = 26;
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
                <th style={{width:'4%'}}>No.</th>
                {COLUMNS.map(c => <th key={c.key} style={{width:c.width}}>{c.title}</th>)}
                {!isApproved && <th className="pdr-no-print" style={{width:'4%'}}>Del</th>}
            </tr>
        </thead>
    );

    const renderRow = (row, globalIdx) => (
        <tr key={row._key||globalIdx}>
            <td style={{fontWeight:'bold'}}>{globalIdx+1}</td>
            {COLUMNS.map(col => (
                <td key={col.key} className={col.isSelect?getAppliedClass(row[col.key]):''}>
                    {col.isRadio ? (
                        <div style={{display:'flex',justifyContent:'center',gap:4}}>
                            {[1,2,3].map(v=>(
                                <label key={v} style={{cursor:'pointer',fontSize:10}}>
                                    <input type="radio" name={`pri-${globalIdx}`} value={v} checked={String(row.priority)===String(v)} disabled={isApproved} onChange={()=>updateCell(globalIdx,'priority',v)} style={{marginRight:2}} />{v}
                                </label>
                            ))}
                        </div>
                    ) : col.isSelect ? (
                        <select className="pdr-select-applied" value={row[col.key]||''} disabled={isApproved} onChange={e=>updateCell(globalIdx,col.key,e.target.value)}>
                            <option value="">-</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="N/A">N/A</option>
                        </select>
                    ) : (
                        <ContentEditable html={row[col.key]||''} disabled={isApproved} className="pdr-editable-cell" onChange={v=>updateCell(globalIdx,col.key,v)} />
                    )}
                </td>
            ))}
            {!isApproved && <td className="pdr-no-print"><button className="pdr-btn-remove" onClick={()=>removeRow(globalIdx)}>X</button></td>}
        </tr>
    );

    return (
        <div className="pdr-body">
            <div className="pdr-topbar">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {onBack && <Button icon={<ArrowLeftOutlined/>} type="text" style={{color:'#fff'}} onClick={onBack}/>}
                    <span className="pdr-topbar-title">Product Design Review - Applicable Specification</span>
                    <Tag color={isApproved?'green':'blue'}>{status}</Tag>
                </div>
                <div className="pdr-toolbar">
                    <button onMouseDown={e=>{e.preventDefault();execCmd('bold')}} style={{fontWeight:'bold'}}>B</button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('italic')}} style={{fontStyle:'italic'}}>I</button>
                    <div style={{width:1,height:18,background:'#ccc',margin:'0 3px'}} />
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyLeft')}}><AlignLeftOutlined/></button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyCenter')}}><AlignCenterOutlined/></button>
                    <button onMouseDown={e=>{e.preventDefault();execCmd('justifyRight')}}><AlignRightOutlined/></button>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>Zoom:</span>
                    <Select value={zoom} onChange={setZoom} style={{width:80}} size="small" options={[{value:'0.75',label:'75%'},{value:'0.90',label:'90%'},{value:'1',label:'100%'},{value:'1.10',label:'110%'},{value:'1.25',label:'125%'},{value:'1.50',label:'150%'}]} />
                    {!isApproved && <Button icon={<PlusOutlined/>} type="primary" size="small" onClick={addRow}>Add Row</Button>}
                    {!isApproved && <Button icon={<CheckCircleOutlined/>} size="small" style={{background:'#faad14',color:'#fff',border:'none'}} onClick={handleApprove}>Approve</Button>}
                    <Button icon={<PrinterOutlined/>} size="small" style={{background:'#52c41a',color:'#fff',border:'none'}} onClick={()=>window.print()}>Export PDF</Button>
                </div>
            </div>
            <div className="pdr-pages" style={{ zoom }}>
                {pages.map((pageRows, pageIdx) => (
                    <div className="pdr-a4-page" key={pageIdx}>
                        <div className="pdr-page-number">Page {pageIdx+1} of {pages.length}</div>
                        <div className="pdr-page-content">
                            {pageIdx === 0 && (
                                <>
                                    <div className="pdr-header-title">Product Design Review - Applicable Specification</div>
                                    <div className="pdr-std-header">
                                        <div className="pdr-header-details">
                                            <div className="pdr-header-col">
                                                <div className="pdr-header-row"><label>PID Number:</label><input value={header.pid_number} disabled={isApproved} onChange={e=>setHeader(h=>({...h,pid_number:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>Customer P/N:</label><input value={header.customer_pn} disabled={isApproved} onChange={e=>setHeader(h=>({...h,customer_pn:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>NMB P/N:</label><input value={header.nmb_pn} disabled={isApproved} onChange={e=>setHeader(h=>({...h,nmb_pn:e.target.value}))}/></div>
                                            </div>
                                            <div className="pdr-header-col">
                                                <div className="pdr-header-row"><label>PDR No.:</label><input value={header.form_number} disabled={isApproved} onChange={e=>setHeader(h=>({...h,form_number:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>Prepare by:</label><input value={header.prepare_by} disabled={isApproved} onChange={e=>setHeader(h=>({...h,prepare_by:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>Check by:</label><input value={header.check_by} disabled={isApproved} onChange={e=>setHeader(h=>({...h,check_by:e.target.value}))}/></div>
                                            </div>
                                            <div className="pdr-header-col">
                                                <div className="pdr-header-row"><label>REV.:</label><input value={header.revision} disabled={isApproved} onChange={e=>setHeader(h=>({...h,revision:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>Date Initiated:</label><input type="date" value={header.date_initiated} disabled={isApproved} onChange={e=>setHeader(h=>({...h,date_initiated:e.target.value}))}/></div>
                                                <div className="pdr-header-row"><label>Target Date:</label><input type="date" value={header.target_date} disabled={isApproved} onChange={e=>setHeader(h=>({...h,target_date:e.target.value}))}/></div>
                                            </div>
                                        </div>
                                        <div className="pdr-approval-block">
                                            {['Prepare','Check by','Approve'].map(l=>(<div className="pdr-stamp-box" key={l}><div className="pdr-stamp-title">{l}</div><div className="pdr-stamp-area" contentEditable={!isApproved} suppressContentEditableWarning/></div>))}
                                        </div>
                                    </div>
                                </>
                            )}
                            <table className="pdr-data-table">
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

