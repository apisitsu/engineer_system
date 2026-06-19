'use strict';
/**
 * Add GS-64PFII to Tooling Select by MIRRORING PSG-64 (machine_id 19).
 *
 * GS-64PFII (SDS machine id 298, code 762) and PSG-64 are both MSB surface grinders
 * that use the SAME 4547-01 jig family (WORK FIXED BASE / COLLET / COLLET ARBOR /
 * COLLAR / ASSY). Source: `MSB_SURFACE-GRINDING_TOOLING…xlsx` — which is a part-MODEL
 * → Tool-No lookup (NO dimensional formula; same shape as the ROTARY DRESSER list).
 * PSG-64 already approximates that lookup with an ID-band formula (`A = ID`, rank by
 * dim_a, ID>=38) against `tooling_psg64`, and validated it for the 2MSB-T series.
 *
 * So GS-64PFII reuses `tooling_psg64` (identical jigs, e.g. 4547-01-0029-xx are present)
 * and copies PSG-64's limit + formula + search-rule set verbatim. This lets the SDS↔
 * T-Select fallback fill GS-64PFII's PDF tool slots by ID-band (machine_name 'GS-64PFII'
 * matches the SDS machine, so `tselectFallback` accepts it). Linked via
 * tooling_machine.sds_machine_type_id = 298.
 *
 * NOTE: like rotary dress, the true source is a model lookup, so the ID-band is an
 * APPROXIMATION (inherited from PSG-64) — accurate where ID separates the models.
 *
 * Idempotent: re-creates GS-64PFII's machine row + limit/formula/rule from PSG-64.
 * Run: node db_migrations/20260619_seed_gs64pfii_tooling_select.js
 */

const { engPool } = require('../instance/eng_db');

const SRC_ID = 19;                 // PSG-64
const SDS_TYPE_ID = 298;           // GS-64PFII sds_machine_type_code.id

async function run() {
  // 1. Upsert the GS-64PFII T-Select machine (reuse PSG-64's inventory table).
  let gid = (await engPool.query(
    `SELECT id FROM tooling_machine WHERE machine_name = 'GS-64PFII'`
  )).rows[0]?.id;
  if (!gid) {
    gid = (await engPool.query(
      `INSERT INTO tooling_machine (machine_name, label, inventory_table, enabled, machine_group, sds_machine_type_id)
       VALUES ('GS-64PFII', 'GS-64PFII', 'tooling_psg64', true, NULL, $1) RETURNING id`,
      [SDS_TYPE_ID]
    )).rows[0].id;
  } else {
    await engPool.query(
      `UPDATE tooling_machine SET inventory_table = 'tooling_psg64', enabled = true,
              sds_machine_type_id = $2, updated_at = now() WHERE id = $1`,
      [gid, SDS_TYPE_ID]
    );
  }

  // 2. Copy limit / formula / search-rule from PSG-64 verbatim (column-agnostic so it
  //    survives schema changes), replacing machine_id and dropping id/timestamps.
  const counts = {};
  for (const tbl of ['tooling_machine_limit', 'tooling_formula', 'tooling_search_rule']) {
    const cols = (await engPool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [tbl]
    )).rows.map(r => r.column_name).filter(c => !['id', 'machine_id', 'created_at', 'updated_at'].includes(c));
    await engPool.query(`DELETE FROM ${tbl} WHERE machine_id = $1`, [gid]);
    const r = await engPool.query(
      `INSERT INTO ${tbl} (machine_id, ${cols.join(', ')})
       SELECT $1, ${cols.join(', ')} FROM ${tbl} WHERE machine_id = $2`,
      [gid, SRC_ID]
    );
    counts[tbl] = r.rowCount;
  }

  console.log(`✅ GS-64PFII T-Select (machine_id ${gid}, inventory tooling_psg64): `
    + `limits ${counts.tooling_machine_limit}, formulas ${counts.tooling_formula}, rules ${counts.tooling_search_rule} (copied from PSG-64)`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
