'use strict';
/**
 * 20260814g_ksb80_wheel.js — KS-B80 WHEEL (4021-05), the gap the RACE/SLEEVE/BALL audit
 * and the RE330 review both surfaced: it appears white (selected) on 7 TEMPLATE_B sheets
 * and existed in no inventory table.
 *
 * Its list is a RANGE table, not a dimension table — `20241223_TOOLING LIST_KS-B80.xlsx`
 * sheet 砥石・クイル: 巾min | 巾max | 内径min | 内径max → QUILL | QUILL BOLT | WHEEL.
 * A wheel is chosen for the band of work width AND bore it covers.
 *
 * Range containment is expressed with the engine's one-sided tolerances — `tol_plus 0`
 * against the floor column and `tol_minus 0` against the ceiling — the pattern KS-03A
 * LOADER and XD-8 JAW already use. Four output keys are needed rather than two because
 * `tooling_search_rule` is UNIQUE on (machine_id, tooling_name, output_key): W and ID
 * each need a floor key and a ceiling key.
 *
 * QUILL (4021-03) and QUILL BOLT (4021-04) share this table but are NOT loaded: they are
 * grey on all ten TEMPLATE_B rows — never selected — so the system correctly has neither.
 */
const fs=require('fs'), path=require('path');
const { engPool }=require('../../../../instance/eng_db');
const DRY=process.argv.includes('--dry');
const MACHINE='KS-B80', INV='tooling_ksb80', TOOL='WHEEL';
const FORM=[
  {key:'A',expr:'W', sort:0,desc:'4021-05 range table: work width, tested against the band floor'},
  {key:'B',expr:'W', sort:1,desc:'4021-05 range table: work width, tested against the band ceiling'},
  {key:'C',expr:'ID',sort:2,desc:'4021-05 range table: work bore, tested against the band floor'},
  {key:'D',expr:'ID',sort:3,desc:'4021-05 range table: work bore, tested against the band ceiling'},
];
const RULES=[
  {key:'A',col:'dim_a',plus:'0',minus:null,prio:0,label:'Width band min ≤ W'},
  {key:'B',col:'dim_b',plus:null,minus:'0',prio:1,label:'W ≤ width band max'},
  {key:'C',col:'dim_c',plus:'0',minus:null,prio:2,label:'Bore band min ≤ ID'},
  {key:'D',col:'dim_d',plus:null,minus:'0',prio:3,label:'ID ≤ bore band max'},
];
(async()=>{
  const c=await engPool.connect(); const log=[];
  try{
    await c.query('BEGIN');
    const mid=(await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`,[MACHINE])).rows[0].id;
    const have=(await c.query(`SELECT count(*)::int n FROM ${INV} WHERE tooling_name=$1`,[TOOL])).rows[0].n;
    log.push(`── ${TOOL} on ${MACHINE} ──`);
    if(have>0) log.push(`   inventory: already ${have} rows`);
    else{
      const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'data','ksb80_wheel_4021-05.json'),'utf8'));
      // tooling_ksb80 stops at dim_e — wheel length is kept, wheel dia dropped.
      const COLS=7;
      const ph=rows.map((_,i)=>`(${Array.from({length:COLS},(__,k)=>`$${i*COLS+k+1}`).join(',')})`).join(',');
      const vals=rows.flatMap(r=>[TOOL,r.tooling_no,r.dim_a,r.dim_b,r.dim_c,r.dim_d,r.dim_e]);
      await c.query(`INSERT INTO ${INV} (tooling_name,tooling_no,dim_a,dim_b,dim_c,dim_d,dim_e) VALUES ${ph}`,vals);
      log.push(`   inventory: inserted ${rows.length} rows (W ${rows[0].dim_a}–${rows[0].dim_b}, ID ${rows[0].dim_c}–${rows[0].dim_d} …)`);
    }
    for(const f of FORM){
      const r=await c.query(`INSERT INTO tooling_formula (machine_id,tooling_name,output_key,formula_expr,sort_order,description)
        SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
         WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
        RETURNING id`,[mid,TOOL,f.key,f.expr,f.sort,f.desc]);
      log.push(`   ${r.rowCount?'formula added ':'formula exists'} ${f.key} = ${f.expr}`);
    }
    for(const s of RULES){
      const r=await c.query(`INSERT INTO tooling_search_rule (machine_id,tooling_name,output_key,inventory_column,tol_plus,tol_minus,sort_priority,label,inventory_tooling_filter,is_match_dim)
        SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,true
         WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
        RETURNING id`,[mid,TOOL,s.key,s.col,s.plus,s.minus,s.prio,s.label,TOOL]);
      log.push(`   ${r.rowCount?'rule added    ':'rule exists   '} ${s.key} -> ${s.col} +${s.plus??'-'} -${s.minus??'-'}`);
    }
    if(DRY){await c.query('ROLLBACK');log.push('\n*** DRY RUN — ROLLED BACK. ***');}
    else{await c.query('COMMIT');log.push('\n*** COMMITTED. ***');}
    console.log(log.join('\n'));
  }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('FAILED — rolled back:',e.message);process.exitCode=1;}
  finally{c.release();await engPool.end();}
})();
