'use strict';
/**
 * 20260814e_x100_sph_rest.js — the rest of X-100 (SPH sheets, family 4857).
 *
 * Same source and method as 20260814d (ARBOR): the design rules are Excel formulas in
 * the machine's own tooling list, fed from a C/N-driven DIMENSION sheet.
 *
 *   ARBOR PIN  A = ROUNDDOWN(ID(MIN) − 0.01, 2)      B = 20 + BALL BW
 *   CENTER     A = ROUNDDOWN(ID(MIN) − 0.01, 2)      C = ROUNDDOWN(OD − 0.4, 1)
 *              B = ROUNDUP(TB + 0.4, 1)  D = ROUNDUP((BW−SW)/2 + 0.5, 1)  E = ROUND(54.7 − RW, 1)
 *   WRIST END  C = ROUNDDOWN(OD − 0.2, 1)            E = ROUND(39 − RW, 1)
 *              D = ROUNDUP((BW − RW)/2 + 0.5, 1)
 *
 * Only the rules that the spec context can actually feed are given search rules:
 * `ID(MIN)` → `idAft_min` and `OD` → `OD`. **`BW`, `TB`, `SW` and `RW` are component
 * dimensions of the BALL and RACE inside the assembly and are not in the context** —
 * and `RW` is genuinely not `W`: they agree on only 6 of 230 base-table rows (the
 * sheet even carries a note that old designs wrongly stored SW in the RW column).
 * Those dims are still loaded onto the inventory rows, ready for the day the context
 * carries component dimensions.
 *
 * INVERSION JAW (5 drawings) and LOADER JAW (2) are left out: their selection turns on
 * `BW` alone, so with no BW there is nothing to search on — and a 2-item shelf offered
 * without a discriminator is a coin toss, not a selection.
 */
const fs=require('fs'), path=require('path');
const { engPool } = require('../../../../instance/eng_db');
const DRY=process.argv.includes('--dry');
const MACHINE='X-100', INV='tooling_x100';

const PLAN={
  'ARBOR PIN': {
    formulas:[{key:'A',expr:'floorN(idAft_min - 0.01, 2)',sort:0,desc:'ARBOR PIN sheet row 19: A = ROUNDDOWN(ID(MIN) − 0.01, 2)'}],
    rules:[{key:'A',col:'dim_a',plus:'0.2',minus:'0.2',prio:0,label:'Pin diameter (ID−0.01)'}],
  },
  'CENTER': {
    formulas:[{key:'A',expr:'floorN(idAft_min - 0.01, 2)',sort:0,desc:'CENTER sheet row 24: A = ROUNDDOWN(ID(MIN) − 0.01, 2)'},
              {key:'C',expr:'floorN(OD - 0.4, 1)',sort:1,desc:'CENTER sheet row 24: C MAX = ROUNDDOWN(SPH OD − 0.4, 1)'}],
    rules:[{key:'A',col:'dim_a',plus:'0.2',minus:'0.2',prio:0,label:'Centre bore (ID−0.01)'},
           {key:'C',col:'dim_c',plus:'0.5',minus:'0.5',prio:1,label:'Centre envelope (OD−0.4)'}],
  },
  'WRIST END': {
    formulas:[{key:'C',expr:'floorN(OD - 0.2, 1)',sort:0,desc:'WRIST END sheet row 27: C MAX = ROUNDDOWN(SPH OD − 0.2, 1)'}],
    rules:[{key:'C',col:'dim_b',plus:'0.5',minus:'0.5',prio:0,label:'Wrist-end envelope (OD−0.2)'}],
  },
};

(async()=>{
  const c=await engPool.connect(); const log=[];
  try{
    await c.query('BEGIN');
    const data=JSON.parse(fs.readFileSync(path.join(__dirname,'data','x100_rest_4857.json'),'utf8'));
    const mid=(await c.query(`SELECT id FROM tooling_machine WHERE machine_name=$1`,[MACHINE])).rows[0].id;

    for(const [tool,plan] of Object.entries(PLAN)){
      const rows=(data[tool]||[]).filter(r=>Object.keys(r).some(k=>k!=='tooling_no'&&r[k]!==null));
      const have=(await c.query(`SELECT count(*)::int n FROM ${INV} WHERE tooling_name=$1`,[tool])).rows[0].n;
      log.push(`\n── ${tool} ──`);
      if(have>0) log.push(`   inventory: already ${have} rows`);
      else{
        const COLS=6;
        const ph=rows.map((_,i)=>`(${Array.from({length:COLS},(__,k)=>`$${i*COLS+k+1}`).join(',')})`).join(',');
        const vals=rows.flatMap(r=>[tool,r.tooling_no,r.dim_a??null,r.dim_b??null,r.dim_c??null,r.dim_d??null]);
        await c.query(`INSERT INTO ${INV} (tooling_name,tooling_no,dim_a,dim_b,dim_c,dim_d) VALUES ${ph}`,vals);
        log.push(`   inventory: inserted ${rows.length} rows`);
      }
      for(const f of plan.formulas){
        const r=await c.query(
          `INSERT INTO tooling_formula (machine_id,tooling_name,output_key,formula_expr,sort_order,description)
           SELECT $1,$2::text,$3::text,$4::text,$5::int,$6::text
            WHERE NOT EXISTS (SELECT 1 FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`,[mid,tool,f.key,f.expr,f.sort,f.desc]);
        log.push(`   ${r.rowCount?'formula added ':'formula exists'} ${f.key} = ${f.expr}`);
      }
      for(const s of plan.rules){
        const r=await c.query(
          `INSERT INTO tooling_search_rule (machine_id,tooling_name,output_key,inventory_column,tol_plus,tol_minus,sort_priority,label,inventory_tooling_filter,is_match_dim)
           SELECT $1,$2::text,$3::text,$4::text,$5::numeric,$6::numeric,$7::int,$8::text,$9::text,true
            WHERE NOT EXISTS (SELECT 1 FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key=$3)
           RETURNING id`,[mid,tool,s.key,s.col,s.plus,s.minus,s.prio,s.label,tool]);
        log.push(`   ${r.rowCount?'rule added    ':'rule exists   '} ${s.key} -> ${s.col} ±${s.plus}`);
      }
    }
    if(DRY){await c.query('ROLLBACK');log.push('\n*** DRY RUN — ROLLED BACK. ***');}
    else{await c.query('COMMIT');log.push('\n*** COMMITTED. ***');}
    console.log(log.join('\n'));
  }catch(e){await c.query('ROLLBACK').catch(()=>{});console.error('FAILED — rolled back:',e.message);process.exitCode=1;}
  finally{c.release();await engPool.end();}
})();
