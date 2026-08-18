'use strict';
/**
 * 20260814f_xd8_sph.js — XD-8 (組切削 / TURN SPH, process 2071, family 4858).
 *
 * The second machine TEMPLATE_B's SPH sheets need. Rules come from the machine's own
 * tooling list, whose DIMENSION sheet is C/N-driven (「C/Nのみ入力のこと」) with columns
 * C/N · P/N · WORK TYPE · RW · OD · ±TOL · BW · ID · BD · SD1 · CorR · SD2 · TB.
 *
 *   COLLET      A 推奨値 = ワーク外径MAX 〜 +0.1 · A 許容値 = ワーク外径MIN 〜 MAX+0.3
 *   LOADER JAW / INVERSION JAW — a min/max RANGE table on the workpiece size
 *
 * COLLET's rule is the workpiece OD at its maximum, which the spec context carries as
 * `odAft_max`. The tolerance is the sheet's own allowable band, not a guess: −0.05 to
 * +0.3 around OD MAX brackets 許容値 while keeping 推奨値 nearest, so the ranking picks
 * the recommended collet first and the allowable ones behind it.
 *
 * The two JAWs are a range lookup — `min ≤ OD ≤ max` — expressed with the engine's
 * one-sided tolerances (`tol_plus 0` on the min column, `tol_minus 0` on the max), the
 * same pattern KS-03A LOADER already uses. No engine change needed.
 *
 * STOPPER L, STOPPER R and WRIST END ASSY load their inventory but get **no rules**:
 * every one of their formulas turns on RW / BW / BD / TB — dimensions of the RACE and
 * BALL inside the assembly, which `buildSpecContext` does not carry. They are ready the
 * day it does.
 */
const fs=require('fs'), path=require('path');
const { engPool } = require('../instance/eng_db');
const DRY=process.argv.includes('--dry');
const MACHINE='XD-8', INV='tooling_xd8';

const PLAN={
  'COLLET':{formulas:[{key:'A',expr:'odAft_max',sort:0,desc:'XD-8 COLLET sheet row 19/20: A = workpiece OD at MAX (推奨値 OD_MAX〜+0.1, 許容値 OD_MIN〜MAX+0.3)'}],
            rules:[{key:'A',col:'dim_a',plus:'0.3',minus:'0.05',prio:0,label:'Collet bore (work OD MAX)'}]},
  // A range lookup needs TWO output keys, not one used twice: tooling_search_rule is
  // UNIQUE on (machine_id, tooling_name, output_key). Both compute the same OD; one is
  // compared against the range's floor, the other against its ceiling.
  'LOADER JAW':{formulas:[{key:'A',expr:'OD',sort:0,desc:'XD-8 JAW table: range floor — min ≤ OD'},
                          {key:'B',expr:'OD',sort:1,desc:'XD-8 JAW table: range ceiling — OD ≤ max'}],
            rules:[{key:'A',col:'dim_a',plus:'0',minus:null,prio:0,label:'Range min ≤ OD'},
                   {key:'B',col:'dim_b',plus:null,minus:'0',prio:1,label:'OD ≤ range max'}]},
  'INVERSION JAW':{formulas:[{key:'A',expr:'OD',sort:0,desc:'XD-8 JAW table: range floor — min ≤ OD'},
                             {key:'B',expr:'OD',sort:1,desc:'XD-8 JAW table: range ceiling — OD ≤ max'}],
            rules:[{key:'A',col:'dim_a',plus:'0',minus:null,prio:0,label:'Range min ≤ OD'},
                   {key:'B',col:'dim_b',plus:null,minus:'0',prio:1,label:'OD ≤ range max'}]},
  'STOPPER L':{formulas:[],rules:[]},
  'STOPPER R':{formulas:[],rules:[]},
  'WRIST END ASSY':{formulas:[],rules:[]},
};

(async()=>{
  const c=await engPool.connect(); const log=[];
  try{
    await c.query('BEGIN');
    await c.query(`CREATE TABLE IF NOT EXISTS ${INV} (
      id SERIAL PRIMARY KEY, tooling_name TEXT NOT NULL, tooling_no TEXT NOT NULL, machine TEXT,
      dim_a NUMERIC, dim_b NUMERIC, dim_c NUMERIC, dim_d NUMERIC, dim_e NUMERIC, dim_f NUMERIC)`);
    let m=(await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`,[MACHINE])).rows[0];
    if(!m){ m=(await c.query(`INSERT INTO tooling_machine (machine_name,label,inventory_table,enabled)
        VALUES ($1,$1,$2,true) RETURNING id`,[MACHINE,INV])).rows[0];
      log.push(`── machine ──\n   created ${MACHINE} (id ${m.id}) → ${INV}`); }
    else log.push(`── machine ──\n   ${MACHINE} exists (id ${m.id})`);
    const mid=m.id;
    const data=JSON.parse(fs.readFileSync(path.join(__dirname,'data','xd8_4858.json'),'utf8'));

    for(const [tool,plan] of Object.entries(PLAN)){
      const rows=(data[tool]||[]);
      const have=(await c.query(`SELECT count(*)::int n FROM ${INV} WHERE tooling_name=$1`,[tool])).rows[0].n;
      log.push(`\n── ${tool} ──`);
      if(have>0) log.push(`   inventory: already ${have} rows`);
      else if(!rows.length) log.push('   inventory: no rows extracted');
      else{
        const COLS=6;
        const ph=rows.map((_,i)=>`(${Array.from({length:COLS},(__,k)=>`$${i*COLS+k+1}`).join(',')})`).join(',');
        const vals=rows.flatMap(r=>[tool,r.tooling_no,r.dim_a??null,r.dim_b??null,r.dim_c??null,r.dim_d??null]);
        await c.query(`INSERT INTO ${INV} (tooling_name,tooling_no,dim_a,dim_b,dim_c,dim_d) VALUES ${ph}`,vals);
        log.push(`   inventory: inserted ${rows.length} rows`);
      }
      for(const f of plan.formulas){
        const r=await c.query(`INSERT INTO tooling_formula (machine_id,tooling_name,output_key,formula_expr,sort_order,description)
          SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
           WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
          RETURNING id`,[mid,tool,f.key,f.expr,f.sort,f.desc]);
        log.push(`   ${r.rowCount?'formula added ':'formula exists'} ${f.key} = ${f.expr}`);
      }
      for(const s of plan.rules){
        const r=await c.query(`INSERT INTO tooling_search_rule (machine_id,tooling_name,output_key,inventory_column,tol_plus,tol_minus,sort_priority,label,inventory_tooling_filter,is_match_dim)
          SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,true
           WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3 AND inventory_column=$4)
          RETURNING id`,[mid,tool,s.key,s.col,s.plus,s.minus,s.prio,s.label,tool]);
        log.push(`   ${r.rowCount?'rule added    ':'rule exists   '} ${s.key} -> ${s.col} +${s.plus??'-'} -${s.minus??'-'}`);
      }
      if(!plan.formulas.length) log.push('   no rules — its formulas need RACE/BALL component dims the context lacks');
    }
    if(DRY){await c.query('ROLLBACK');log.push('\n*** DRY RUN — ROLLED BACK. ***');}
    else{await c.query('COMMIT');log.push('\n*** COMMITTED. ***');}
    console.log(log.join('\n'));
  }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('FAILED — rolled back:',e.message);process.exitCode=1;}
  finally{c.release();await engPool.end();}
})();
