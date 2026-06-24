'use strict';
/**
 * Backfill `tooling_spec_process.pn` for KS-H70 parts whose spec row exists but has a NULL/empty
 * part number.
 *
 * The Tooling Select part-number OVERRIDE (searchService `_applyPartnoOverrides`, used by the
 * KS-H70 grinding/loader tooling) keys off `spec.pn`. ~63 of the 228 KS-H70 factory CNs (process
 * 1241) have a spec row with pn = NULL, so the override silently can't fire for them (e.g. the
 * deterministic loaders 4907-05/06 scored only ~70% live — the misses were almost all NULL pn,
 * not wrong picks). Filling pn from the factory master (`lpb.eng_item.parts_no`, matched by the
 * control_no→CN format) lets the override apply, lifting coverage for EVERY override tooling.
 *
 * Fill-only and idempotent: updates rows where pn IS NULL or '' (never overwrites an existing pn).
 * Source = lpb.eng_item.parts_no via control_no (the same join the override seed uses). When a CN
 * maps to several control_no revisions, the most-recent (by eng_item.update_date) parts_no wins.
 *
 * Run: node db_migrations/20260623_backfill_ksh70_spec_pn.js
 */

const { engPool } = require('../instance/eng_db');
const { maqPool } = require('../instance/maq_db');

const planToCn = (p) => { p = String(p).trim(); const m = p.match(/^[A-Z](\d{2})-(.+)$/); if (!m) return null; return m[1] + m[2].replace(/^0/, ''); };

async function run() {
  // CN → parts_no from the factory master (control_no carries the plan number; map to 6-digit CN).
  // Order by update_date so the LAST write per CN is the newest revision's parts_no.
  const { rows } = await maqPool.query(
    `SELECT control_no, parts_no, update_date
       FROM lpb.eng_item
      WHERE parts_no IS NOT NULL AND control_no ~ '^[A-Z][0-9]{2}-'
      ORDER BY update_date ASC NULLS FIRST`);
  const cnToPn = {};
  for (const r of rows) { const cn = planToCn(r.control_no); if (cn) cnToPn[cn] = String(r.parts_no).trim(); }

  // KS-H70 factory CNs (process 1241) that have a spec row with NULL/empty pn.
  const fac = await maqPool.query(
    `SELECT DISTINCT process_plan_no FROM lpb.eng_r_pi_tool WHERE process_code = '1241'`);
  const ksh70Cns = [...new Set(fac.rows.map(r => planToCn(r.process_plan_no)).filter(Boolean))];

  const spec = await engPool.query(
    `SELECT cn FROM tooling_spec_process WHERE cn = ANY($1) AND (pn IS NULL OR pn = '')`,
    [ksh70Cns]);
  const targets = spec.rows.map(r => String(r.cn).trim());

  const updates = targets.map(cn => [cn, cnToPn[cn]]).filter(([, pn]) => pn);
  console.log(`KS-H70 factory CNs ${ksh70Cns.length}; spec rows with NULL pn ${targets.length}; ` +
    `resolvable from factory ${updates.length}`);

  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    let n = 0;
    for (const [cn, pn] of updates) {
      const res = await client.query(
        `UPDATE tooling_spec_process SET pn = $2 WHERE cn = $1 AND (pn IS NULL OR pn = '')`,
        [cn, pn]);
      n += res.rowCount;
    }
    await client.query('COMMIT');
    console.log(`✅ backfilled pn for ${n} KS-H70 spec rows`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ backfill failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
