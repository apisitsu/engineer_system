import React, { useState, useEffect, useCallback } from 'react';
import { Select, Button, message, Tag, Radio } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import { server } from '../../../../../constance/constance';
import { useAuthStore } from '../../../../../stores/authStore';
import { debounce } from 'lodash';

const STYLES = `
.pid-body { background:#525659; display:flex; flex-direction:column; min-height:100vh; font-family:'Segoe UI',Tahoma,sans-serif; font-size:11px; color:#000; }
.pid-topbar { position:sticky; top:0; z-index:1000; background:#2c3e50; display:flex; justify-content:space-between; align-items:center; padding:8px 15px; box-shadow:0 2px 10px rgba(0,0,0,.3); }
.pid-topbar-title { color:#fff; font-size:15px; font-weight:bold; }
.pid-pages { display:flex; flex-direction:column; gap:20px; padding:20px 0; align-items:center; }
.pid-a4 { width:210mm; height:297mm; background:white; padding:12mm 15mm; box-shadow:0 4px 10px rgba(0,0,0,.3); position:relative; overflow:hidden; display:flex; flex-direction:column; box-sizing:border-box; }
.pid-header { text-align:center; margin-bottom:15px; border-bottom:2px solid #000; padding-bottom:10px; }
.pid-header h1 { font-size:16pt; margin-bottom:5px; }
.pid-header h2 { font-size:14pt; font-weight:normal; }
.pid-info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; margin-bottom:15px; }
.pid-input-group { display:flex; align-items:center; }
.pid-input-group label { font-weight:bold; margin-right:10px; white-space:nowrap; }
.pid-input-group input { flex:1; border:none; border-bottom:1px dotted #000; outline:none; font-family:inherit; font-size:11pt; padding:2px 5px; background:transparent; }
.pid-category { margin-bottom:15px; background:#f9f9f9; padding:10px; border:1px solid #ddd; }
.pid-category h3 { font-size:11pt; margin-bottom:8px; }
.pid-checklist h3 { font-size:11pt; margin-bottom:5px; text-decoration:underline; }
.pid-instructions { font-size:9.5pt; font-style:italic; margin-bottom:10px; color:#555; }
.pid-phases-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 20px; }
.pid-phase-block { margin-bottom:10px; }
.pid-phase-title { font-weight:bold; background:#eee; padding:3px 5px; margin-bottom:5px; font-size:10.5pt; border-left:3px solid #333; }
.pid-phase-ref { display:block; font-weight:normal; font-size:.8em; color:#666; margin-top:4px; }
.pid-check-item { display:flex; align-items:flex-start; margin-bottom:4px; padding-left:5px; font-size:10pt; }
.pid-check-item input { margin-right:8px; margin-top:3px; }
.pid-check-item.disabled { opacity:.4; text-decoration:line-through; pointer-events:none; }
.pid-approval { margin-top:auto; border-top:2px solid #000; padding-top:10px; }
.pid-approval h3 { font-size:11pt; text-align:center; margin-bottom:5px; }
.pid-approval-text { font-size:9.5pt; text-align:justify; margin-bottom:15px; }
.pid-signatures { display:grid; grid-template-columns:1fr 1fr 1fr; gap:15px; text-align:center; }
.pid-sign-box { display:flex; flex-direction:column; align-items:center; }
.pid-sign-line { width:80%; border-bottom:1px solid #000; margin-bottom:5px; height:30px; }
.pid-sign-label { font-weight:bold; font-size:10pt; }
@media print {
  @page { size:A4 portrait; margin:5mm; }
  body { background:none!important; padding:0!important; }
  .pid-topbar { display:none!important; }
  .pid-pages { gap:0!important; zoom:1!important; padding:0!important; }
  .pid-a4 { width:210mm!important; height:297mm!important; box-shadow:none; margin:0; padding:10mm 15mm; page-break-after:always; }
}
`;

const PHASES = [
    { id: 'phase1', title: 'PHASE 1: Planning', ref: '(Ref: PD-DV-EN-111001)', items: ['Feasibility and Specification Review Record', 'Preliminary Project Plan / Timeline', 'Preliminary BOM'] },
    { id: 'phase2', title: 'PHASE 2: Product Design', ref: '(Ref: PD-DV-EN-12001)', items: ['Internal Engineering Drawing', 'DFMEA (Only if Customer requires)'] },
    { id: 'phase3', title: 'PHASE 3: Process Design', ref: '(Ref: PD-DV-EN-111002, 111003, 111004, 111005)', items: ['Process Flow Diagram (PFD)', 'Process FMEA (PFMEA)', 'Pre-Launch Control Plan', 'Tooling / Jig Design Drawing'] },
    { id: 'phase4', title: 'PHASE 4: Validation', ref: '(Ref: PD-DV-EN-111006, 111007)', items: ['First Article Inspection Report (FAIR)', 'MSA (GR&R) and Capability Study (Cpk/Ppk) Report', 'Packaging Standard Document', 'Production Readiness Review (PRR) Checklist', 'PPAP Approval Form (Signed by Customer)'] },
    { id: 'phase5', title: 'PHASE 5: Mass Production', ref: '', items: ['Mass Production Control Plan', 'Work Instructions / Standard Operating Procedures (SOP)', 'Lessons Learned Record (Update to PFMEA if any issues)'] },
];

const CATEGORY_RULES = {
    opt1: [1,2,3,4,5], opt2: [1,3,4,5], opt3: [3,4,5], opt4: [3,5], opt5: [5],
};

export default function PIDForm({ formId, onBack }) {
    const [header, setHeader] = useState({ pid_number:'', customer_pn:'', nmb_pn:'', form_number:'', prepare_by:'', check_by:'', date_initiated:'', target_date:'', customer_name:'', nhbb_pn:'' });
    const [category, setCategory] = useState('');
    const [phaseChecks, setPhaseChecks] = useState({});
    const [status, setStatus] = useState('In Progress');
    const [zoom, setZoom] = useState('1.25');
    const isApproved = status === 'Approved';

    useEffect(() => {
        const id = 'pid-form-styles';
        if (!document.getElementById(id)) { const s = document.createElement('style'); s.id = id; s.textContent = STYLES; document.head.appendChild(s); }
    }, []);

    useEffect(() => {
        if (!formId) return;
        (async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${server.TT_FORMS}/pid/${formId}`, { headers: { Authorization: `Bearer ${token}` } });
                if (res.data.result === 'true') {
                    const { header: h, rows: r } = res.data.data;
                    const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
                    setHeader({ pid_number:h.pid_number||'', customer_pn:h.customer_pn||'', nmb_pn:h.nmb_pn||'', form_number:h.form_number||'', prepare_by:h.prepare_by||'', check_by:h.check_by||'', date_initiated:formatDate(h.date_initiated), target_date:formatDate(h.target_date), customer_name:h.customer_name||'', nhbb_pn:h.nhbb_pn||'' });
                    setStatus(h.status || 'In Progress');
                    if (r?.category) setCategory(r.category);
                    if (r?.phase_checks) setPhaseChecks(r.phase_checks);
                }
            } catch (err) { console.error('PID load error:', err); }
        })();
    }, [formId]);

    const saveData = useCallback(debounce(async (h, cat, pc) => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${server.TT_FORMS}/pid/${formId}`, {
                header: { ...h, category: cat, phase_checks: pc },
                rows: { category: cat, phase_checks: pc },
            }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) { console.error('PID save error:', err); }
    }, 3000), [formId]);

    useEffect(() => { if (formId && !isApproved) saveData(header, category, phaseChecks); }, [header, category, phaseChecks]);
    useEffect(() => { return () => saveData.flush?.(); }, [saveData]);

    const getActivePhases = () => CATEGORY_RULES[category] || [];

    const handleApprove = async () => {
        if (!formId) return;
        try {
            const token = localStorage.getItem('token');
            await axios.put(`${server.TT_FORMS}/pid/${formId}`, { header: { ...header, category, phase_checks: phaseChecks }, rows: { category, phase_checks: phaseChecks } }, { headers: { Authorization: `Bearer ${token}` } });
            await axios.put(`${server.TT_FORMS}/pid/${formId}/status`, { status: 'Approved' }, { headers: { Authorization: `Bearer ${token}` } });
            setStatus('Approved'); message.success('PID approved');
        } catch (err) { message.error('Approval failed'); }
    };

    return (
        <div className="pid-body">
            <div className="pid-topbar">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                    {onBack && <Button icon={<ArrowLeftOutlined/>} type="text" style={{color:'#fff'}} onClick={onBack}/>}
                    <span className="pid-topbar-title">Project Initiation Document (PID)</span>
                    <Tag color={isApproved?'green':'blue'}>{status}</Tag>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{color:'#fff',fontSize:12,fontWeight:'bold'}}>Zoom:</span>
                    <Select value={zoom} onChange={setZoom} style={{width:80}} size="small" options={[{value:'0.75',label:'75%'},{value:'0.90',label:'90%'},{value:'1',label:'100%'},{value:'1.10',label:'110%'},{value:'1.25',label:'125%'},{value:'1.50',label:'150%'}]} />
                    {!isApproved && <Button icon={<CheckCircleOutlined/>} size="small" style={{background:'#faad14',color:'#fff',border:'none'}} onClick={handleApprove}>Approve</Button>}
                    <Button icon={<PrinterOutlined/>} size="small" style={{background:'#52c41a',color:'#fff',border:'none'}} onClick={()=>window.print()}>Export PDF</Button>
                </div>
            </div>
            <div className="pid-pages" style={{ zoom }}>
                <div className="pid-a4">
                    <div className="pid-header"><h1>Rod End Bearing Division</h1><h2>Project Initiation Document (PID)</h2></div>
                    <div className="pid-info-grid">
                        {[['PID Number:','pid_number'],['Date Initiated:','date_initiated','date'],['Customer:','customer_name'],['Target Date:','target_date','date'],['Prepare by:','prepare_by'],['Check by:','check_by'],['Customer P/N:','customer_pn'],['NHBB P/N:','nhbb_pn']].map(([lbl,key,type])=>(
                            <div className="pid-input-group" key={key}>
                                <label>{lbl}</label>
                                <input type={type||'text'} value={header[key]} disabled={isApproved} onChange={e=>setHeader(h=>({...h,[key]:e.target.value}))} />
                            </div>
                        ))}
                    </div>
                    <div className="pid-category">
                        <h3>Project Category Selection (Check one box to determine required phases):</h3>
                        <Radio.Group value={category} onChange={e=>{setCategory(e.target.value);setPhaseChecks({});}} disabled={isApproved}>
                            {Object.entries({opt1:'1. Full APQP (With Product Design) : Execute Phases 1, 2, 3, 4, 5',opt2:'2. Full APQP (Build-to-print) : Execute Phases 1, 3, 4, 5 (Skip Ph 2)',opt3:'3. New Model (Standard Case) : Execute Phases 3, 4, 5 (Skip Ph 1, 2)',opt4:'4. New Model (Missing Doc) : Execute Phases 3, 5 (Skip Ph 1, 2, 4)',opt5:'5. New Variant (Similarity) : Execute Phase 5 Only'}).map(([v,l])=>(
                                <Radio key={v} value={v} style={{display:'block',marginBottom:4,fontSize:'10.5pt'}}>{l}</Radio>
                            ))}
                        </Radio.Group>
                    </div>
                    <div className="pid-checklist" style={{flex:1,display:'flex',flexDirection:'column'}}>
                        <h3>PHASE EXECUTION CHECKLIST</h3>
                        <div className="pid-instructions">(Instructions: Check the box "N/A" if the phase is skipped. Otherwise, mark "Done" and attach the document behind this PID when completed).</div>
                        <div className="pid-phases-grid">
                            <div>
                                {PHASES.slice(0,3).map(phase => {
                                    const num = parseInt(phase.id.replace('phase',''));
                                    const active = getActivePhases().includes(num);
                                    return (
                                        <div className="pid-phase-block" key={phase.id}>
                                            <div className="pid-phase-title">{phase.title}{phase.ref && <span className="pid-phase-ref">{phase.ref}</span>}</div>
                                            {phase.items.map((item,i) => (
                                                <label className={`pid-check-item ${!active?'disabled':''}`} key={i}>
                                                    <input type="checkbox" disabled={!active||isApproved} checked={!!(phaseChecks[phase.id]||[])[i]} onChange={e=>{
                                                        const checks = {...phaseChecks};
                                                        if (!checks[phase.id]) checks[phase.id] = phase.items.map(()=>false);
                                                        checks[phase.id] = [...checks[phase.id]];
                                                        checks[phase.id][i] = e.target.checked;
                                                        setPhaseChecks(checks);
                                                    }}/> {item}
                                                </label>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                            <div>
                                {PHASES.slice(3).map(phase => {
                                    const num = parseInt(phase.id.replace('phase',''));
                                    const active = getActivePhases().includes(num);
                                    return (
                                        <div className="pid-phase-block" key={phase.id}>
                                            <div className="pid-phase-title">{phase.title}{phase.ref && <span className="pid-phase-ref">{phase.ref}</span>}</div>
                                            {phase.items.map((item,i) => (
                                                <label className={`pid-check-item ${!active?'disabled':''}`} key={i}>
                                                    <input type="checkbox" disabled={!active||isApproved} checked={!!(phaseChecks[phase.id]||[])[i]} onChange={e=>{
                                                        const checks = {...phaseChecks};
                                                        if (!checks[phase.id]) checks[phase.id] = phase.items.map(()=>false);
                                                        checks[phase.id] = [...checks[phase.id]];
                                                        checks[phase.id][i] = e.target.checked;
                                                        setPhaseChecks(checks);
                                                    }}/> {item}
                                                </label>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="pid-approval">
                        <h3>FINAL APPROVAL</h3>
                        <div className="pid-approval-text">By signing below, the cross-functional team and management confirm that all required deliverables checked above have been verified, attached, and the project is formally closed and handed over to mass production.</div>
                        <div className="pid-signatures">
                            {['Prepare','Check','Approve'].map(l=>(
                                <div className="pid-sign-box" key={l}><div className="pid-sign-line"></div><div className="pid-sign-label">{l}</div></div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
