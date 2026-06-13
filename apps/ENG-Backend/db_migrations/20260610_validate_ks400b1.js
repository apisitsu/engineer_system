'use strict';
/**
 * Audit/regression check for KS-400B1/B2/B7 (machine_id 7) tooling selection
 * against the factory process plan (lpb.eng_r_pi_tool, process_code 1101).
 *
 * Builds the answer key live from the factory (control_no → correct 4664-02
 * LOADING CHUTE suffix) and compares T-Select output. Run after editing
 * machine-7 formulas/rules.
 *
 *   node db_migrations/20260610_validate_ks400b1.js
 *
 * Baseline before 20260610_fix_ks400b1_search_rules.js: 79% top-2. After: 96%.
 */
const { maqPool } = require('../instance/maq_db');
const { engPool } = require('../instance/eng_db');
const cnFormat = require('../api/engineer/mtc/utils/cnFormat');
const ss = require('../api/engineer/mtc/services/searchService');
const suffixOf = (no) => { const m = String(no || '').match(/(\d{4})\s*$/); return m ? m[1] : null; };

(async () => {
  const r = await maqPool.query(
    `SELECT process_plan_no, tool_dwg_no FROM lpb.eng_r_pi_tool
       WHERE process_code='1041' AND tool_dwg_no LIKE '4664-02-%' AND process_plan_no LIKE 'C%'`);
  const ak = {};
  for (const row of r.rows) {
    const m = String(row.tool_dwg_no).match(/^4664-02-(\d{4})/);
    if (!m) continue;
    ak[cnFormat.toSpecCn(row.process_plan_no) || row.process_plan_no] = m[1];
  }
  const keys = (await engPool.query('SELECT cn FROM tooling_spec_process WHERE cn = ANY($1)', [Object.keys(ak)])).rows.map(x => x.cn);

  ss._clearCaches();
  let top1 = 0, hit = 0, none = 0, total = 0;
  for (const cn of keys) {
    const res = await ss.search(cn);
    if (!res.success) continue;
    const lc = res.results.find(x => x.machine === 'KS-400B1/B2/B7' && x.tooling === 'LOADING CHUTE');
    const got = lc ? lc.matches.map(m => suffixOf(m.tooling_no)) : [];
    total++;
    if (!got.length) none++;
    else if (got[0] === ak[cn]) { top1++; hit++; }
    else if (got.includes(ak[cn])) hit++;
  }
  console.log(`KS-400B1/B2/B7 LOADING CHUTE vs factory (${total} CNs): ` +
    `top1=${top1} top2=${hit} (${Math.round(100 * hit / total)}%) none=${none}`);
  process.exit(0);
})();
