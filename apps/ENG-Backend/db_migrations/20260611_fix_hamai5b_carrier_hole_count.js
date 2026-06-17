'use strict';
/**
 * Fix HAMAI 5B CARRIER 4564-03 hole-count formula (output_key B).
 *
 * Source: authoritative DWG (SME-confirmed 2026-06-11). The carrier holds work
 * pieces in B holes (each pocket dia A = ceil05(OD+0.5)) arranged on a FIXED pitch
 * circle of diameter 88. B must be EVEN and the edge-gap between adjacent holes ≥ 4,
 * with B maximised.
 *
 * Bug: the seeded formula used `PI*(88 - A)` as the hole-circle circumference —
 * confusing C (= 88 − A) with the pitch circle. The holes sit on Ø88, so the
 * circumference is PI*88 and the per-hole pitch is (A + 4) (pocket + 4mm min gap):
 *   B = 2 * floor( PI * 88 / (2 * (A + 4)) )         [even-floor]
 *
 * Verified vs the DWG worked example OD=11.245, W=5.95 → A=12:
 *   old: 2*floor(PI*(88-12)/(2*16)) = 2*floor(7.46) = 14   ✗
 *   new: 2*floor(PI*88   /(2*16))   = 2*floor(8.64) = 16   ✓  (→ D = 360/16 = 22.5)
 *
 * (expr-eval has no trig; the linear circumference/pitch model matches the example.
 *  A/C/D/E already match the DWG — only B changes.)
 *
 * Idempotent. Run: node db_migrations/20260611_fix_hamai5b_carrier_hole_count.js
 */

const { engPool } = require('../instance/eng_db');

const NEW_B = '2 * floor(3.14159265 * 88 / (2 * (A + 4)))';

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    const m = await client.query(`SELECT id FROM tooling_machine WHERE machine_name = 'HAMAI 5B'`);
    if (!m.rows[0]) throw new Error("machine 'HAMAI 5B' not found");
    const machineId = m.rows[0].id;

    const r = await client.query(
      `UPDATE tooling_formula
          SET formula_expr = $1
        WHERE machine_id = $2 AND tooling_name = 'CARRIER' AND output_key = 'B'`,
      [NEW_B, machineId]
    );
    if (r.rowCount === 0) throw new Error('CARRIER.B formula row not found — nothing updated');

    await client.query('COMMIT');
    console.log(`✅ HAMAI 5B (id=${machineId}) CARRIER.B updated → ${NEW_B} (${r.rowCount} row)`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ fix failed:', e.message);
    throw e;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { run };
