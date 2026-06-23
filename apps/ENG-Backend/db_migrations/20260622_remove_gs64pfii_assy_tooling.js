'use strict';
/**
 * Remove the ASSY ("BASE ASSY", 4547-01-00xx-99) tooling from the MSB surface
 * grinders' Tooling Select config so it no longer appears on the SDS PDF tool list.
 *
 * ASSY is the assembly DRAWING (組立図) of the WORK FIXED BASE / COLLET / COLLET
 * ARBOR / COLLAR set — not a separate physical fixture. The SDS tool slots should
 * list the 4 components only. ASSY reached the PDF via the T-Select fallback, so
 * removing the ASSY tooling from each machine's tooling_formula + tooling_search_rule
 * drops it from the PDF.
 *
 * SCOPE: GS-64PFII (machine_id 49) AND PSG-64 (machine_id 19). The two machines
 * share the tooling_psg64 INVENTORY table but have their own per-machine
 * formula/rule rows (the GS-64PFII seed copied them from PSG-64). Only the
 * formula/rule rows are deleted; the shared inventory rows (…-99) are left intact
 * (harmless — nothing references ASSY without a search rule).
 *
 * Idempotent. Run: node db_migrations/20260622_remove_gs64pfii_assy_tooling.js
 */

const { engPool } = require('../instance/eng_db');

const MACHINES = ['GS-64PFII', 'PSG-64'];
const TOOLING = 'ASSY';

async function run() {
  for (const machine of MACHINES) {
    const gid = (await engPool.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [machine]
    )).rows[0]?.id;
    if (!gid) { console.log(`⚠️  ${machine} not found in tooling_machine — skipped`); continue; }

    const rr = await engPool.query(
      `DELETE FROM tooling_search_rule WHERE machine_id = $1 AND tooling_name = $2`, [gid, TOOLING]);
    const fr = await engPool.query(
      `DELETE FROM tooling_formula WHERE machine_id = $1 AND tooling_name = $2`, [gid, TOOLING]);

    console.log(`✅ ${machine} (machine_id ${gid}): removed ${TOOLING} — `
      + `${fr.rowCount} formula row(s), ${rr.rowCount} search-rule row(s)`);
  }

  // The per-CN T-Select cache (survives restarts) would otherwise serve a stale
  // result that still contains ASSY. Clearing it forces a fresh search; each live
  // server's in-memory config cache (tsv2ConfigCache) self-refreshes within 60s.
  let cleared = 0;
  try { cleared = (await engPool.query(`DELETE FROM tselect_cn_cache`)).rowCount; } catch (_) {}
  console.log(`   cleared ${cleared} tselect_cn_cache row(s)`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
