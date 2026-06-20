'use strict';
/**
 * Fix KS KL-20 (TRIM) collet formulas (machine_id=24) so the computed req matches the
 * authoritative workbook and is NULL-safe. Audited 2026-06-20 vs factory process plan
 * (lpb.eng_r_pi_tool proc 2561/2562; tools 4030-01 OD-chuck, 4030-02 ID-chuck).
 *
 * Source: templates/Select_tool_backup/20241204_TOOLING LIST_KL-20(TRIM).xlsx
 *   - 4030-01 (OD chuck, "N"/Not-flange) grip dim = DIMENSION "trim OD MAX".
 *   - 4030-02 (ID chuck, "F"/flange)      grip dim = DIMENSION "trim ID MIN" (+0.15).
 *
 * BUG: live formulas used bare `odBf` / `idBf+0.15`. buildSpecContext zeroes these when
 * od_bf/id_bf is NULL → grip dim ≈ 0 → search returned NONE (4030-01: 90% none; 4030-02: 61%).
 *
 * FIX:
 *  - 4030-02: NULL-safe before→after fallback `if(idBf>0, idBf, idAft) + 0.15`.
 *    Factory top-1 37.8%→77.6%; matched dim_a vs req 100% within ±0.5.
 *  - 4030-01: NULL-safe `if(odBf>0, odBf, odAft)` for non-spherical classes (top-1 85%).
 *    SPHERICAL (cnPrefix 41-49): the "trim OD" is a turning/blank diameter NOT present in
 *    our spec (od_bf NULL; od_aft = finished spherical OD; eng_sph_design has no trim OD) →
 *    return -999 (honest no-match) instead of a misleading wrong collet. **DATA GAP** —
 *    to enable spherical here, sync a trim/turning OD into tooling_spec_process.
 *
 * KNOWN RESIDUAL (not formula): 4030-02 `none`=124 are cnPrefix 61/63 parts with Type NULL.
 * The grip axis is flange Type (N→OD / F→ID); the cnPrefix fallback lists 61/63 as OD-chuck,
 * but the factory used the ID-chuck collet for the flange variants. Disambiguation needs the
 * flange Type populated in the spec (currently NULL for these) — a data gap, not a formula.
 *
 * Idempotent. Run: node db_migrations/20260620_fix_kl20_collet_nullsafe.js
 */
const { engPool } = require('../instance/eng_db');

const OD_LIST = '(cnPrefix==23 or cnPrefix==25 or cnPrefix==26 or cnPrefix==41 or cnPrefix==42 or cnPrefix==61 or cnPrefix==63)';
const ID_LIST = '(cnPrefix==62 or cnPrefix==64 or cnPrefix==69)';
const A01 = `if(Type == "N" or ((Type != "N" and Type != "F") and ${OD_LIST}), if(cnPrefix >= 41 and cnPrefix <= 49, -999, if(odBf > 0, odBf, odAft)), -999)`;
const A02 = `if(Type == "F" or ((Type != "N" and Type != "F") and ${ID_LIST}), if(idBf > 0, idBf, idAft) + 0.15, -999)`;

async function run() {
  const client = await engPool.connect();
  try {
    await client.query('BEGIN');
    for (const [tool, expr] of [['4030-01_COLLET', A01], ['4030-02_COLLET', A02]]) {
      const r = await client.query(
        `UPDATE tooling_formula SET formula_expr=$1 WHERE machine_id=24 AND tooling_name=$2 AND output_key='A'`,
        [expr, tool]);
      if (r.rowCount === 0) throw new Error(`${tool}.A not found`);
      console.log(`✓ [24] ${tool}.A updated`);
    }
    await client.query('COMMIT');
    console.log('✅ done. Flush caches: DELETE /api/tooling-select/monitor/cache?prefix=sds: + tselect persisted.');
  } catch (e) { await client.query('ROLLBACK'); console.error('❌ failed:', e.message); throw e; }
  finally { client.release(); }
}
if (require.main === module) run().then(() => process.exit(0)).catch(() => process.exit(1));
module.exports = { run };
