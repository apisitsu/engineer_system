'use strict';
/**
 * Add the THAI-plant COLLET variant (4547-01-0039-01) for the MSB surface grinders
 * (PSG-64 + GS-64PFII), selected by parts_no.
 *
 * Per MSB_SURFACE-GRINDING_TOOLING(...).xlsx row "2MSB48-605~607-T(THAI)": those races
 * use COLLET 4547-01-0039-01 instead of the KZW 4547-01-0030-05, while sharing the 0030
 * BASE / COLLET ARBOR / COLLAR. The factory plan (lpb.eng_r_pi_tool) confirms our (THAI/
 * Lopburi) CNs C29-00836/00837/00847 carry 0039-01, not 0030-05. The 0039 collet has the
 * SAME bore (≈58.87) as the 0030 band, so the bore-ID formula can't distinguish them —
 * we gate on parts_no instead.
 *
 * Mechanism — a dim_b "variant" discriminator on the shared tooling_psg64 inventory:
 *   • dim_b = 0 on every existing row (the default / KZW-and-all-others lane)
 *   • dim_b = 1 on the new 4547-01-0039-01 COLLET row (THAI lane)
 *   • COLLET formula gains output_key B = isThaiMsb48Collet (1 for 2MSB48-605~607-T)
 *   • COLLET search rule on dim_b with tol 0/0 (exact gate), is_match_dim=false
 * So a THAI part (B=1) matches ONLY dim_b=1 → 0039-01; everything else (B=0) matches
 * dim_b=0 → the normal bore-ID band collet. (isThaiMsb48Collet added in buildSpecContext.)
 *
 * Idempotent. Run: node db_migrations/20260622_add_msb_thai_0039_collet.js
 */

const { engPool } = require('../instance/eng_db');

const INV = 'tooling_psg64';
const MACHINES = ['PSG-64', 'GS-64PFII'];
const COLLET = 'COLLET';
const NO_0039 = '4547-01-0039-01';

async function run() {
  // 1. dim_b discriminator column on the shared inventory (default 0 = non-THAI lane)
  await engPool.query(`ALTER TABLE ${INV} ADD COLUMN IF NOT EXISTS dim_b numeric DEFAULT 0`);
  await engPool.query(`UPDATE ${INV} SET dim_b = 0 WHERE dim_b IS NULL`);

  // 2. The THAI COLLET inventory row (dim_b = 1). bore ≈ 58.87 (0030 band) for sanity;
  //    selection is by the dim_b gate, not dim_a, so the exact dim_a is not load-bearing.
  await engPool.query(`DELETE FROM ${INV} WHERE tooling_no = $1`, [NO_0039]);
  await engPool.query(
    `INSERT INTO ${INV} (tooling_name, tooling_no, dim_a, dim_b) VALUES ($1, $2, 58.87, 1)`,
    [COLLET, NO_0039]
  );

  // 3. Per machine: COLLET formula output_key B + a dim_b exact-match gate rule.
  for (const machine of MACHINES) {
    const mid = (await engPool.query(
      `SELECT id FROM tooling_machine WHERE machine_name = $1`, [machine]
    )).rows[0]?.id;
    if (!mid) { console.log(`⚠️  ${machine} not found — skipped`); continue; }

    await engPool.query(
      `DELETE FROM tooling_formula WHERE machine_id=$1 AND tooling_name=$2 AND output_key='B'`,
      [mid, COLLET]
    );
    await engPool.query(
      `INSERT INTO tooling_formula (machine_id, tooling_name, output_key, formula_expr, sort_order)
       VALUES ($1, $2, 'B', 'isThaiMsb48Collet', 1)`,
      [mid, COLLET]
    );

    await engPool.query(
      `DELETE FROM tooling_search_rule WHERE machine_id=$1 AND tooling_name=$2 AND output_key='B'`,
      [mid, COLLET]
    );
    await engPool.query(
      `INSERT INTO tooling_search_rule
         (machine_id, tooling_name, output_key, inventory_column, tol_plus, tol_minus,
          sort_priority, label, is_match_dim, inventory_tooling_filter)
       VALUES ($1, $2, 'B', 'dim_b', 0, 0, 1, 'THAI 0039 collet gate', false, $3)`,
      [mid, COLLET, COLLET]
    );
    console.log(`✅ ${machine} (machine_id ${mid}): COLLET B=isThaiMsb48Collet + dim_b gate added`);
  }

  let cleared = 0;
  try { cleared = (await engPool.query(`DELETE FROM tselect_cn_cache`)).rowCount; } catch (_) {}
  console.log(`   THAI COLLET ${NO_0039} seeded; cleared ${cleared} tselect_cn_cache row(s)`);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}
module.exports = { run };
