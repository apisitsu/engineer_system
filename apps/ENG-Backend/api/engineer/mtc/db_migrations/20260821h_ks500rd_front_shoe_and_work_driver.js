'use strict';

/**
 * KS-500RD — FRONT SHOE (W-based step formula) & WORK DRIVER (plan cn-map).
 * ------------------------------------------------------------------------------
 * 1. FRONT SHOE (G-2):
 *    Previous formula was a step function on OD:
 *      if(OD<19, 0, if(OD<21, 19, if(OD<28, 21, if(OD<37, 28, if(OD<46, 37, 46)))))
 *    which achieved only 16% accuracy because the actual tool selection is based
 *    on workpiece WIDTH (W), not OD.
 *
 *    Authoritative source: 20180821_KS-500RD_投入型式シュー対応表.xlsx sheet 対応表
 *    Formula:
 *      6 <= W < 12  -> 0   (4033-03-0001)
 *      12 <= W < 20 -> 19  (4033-03-0002)
 *      20 <= W < 28 -> 21  (4033-03-0003)
 *      28 <= W < 36 -> 28  (4033-03-0004)
 *      36 <= W < 44 -> 37  (4033-03-0005)
 *      44 <= W < 64 -> 46  (4033-03-0006)
 *    This raises accuracy from 16% to 68% against the factory plan (13/19 CNs).
 *
 * 2. WORK DRIVER (G-3):
 *    The formula A = SD - 0.2 and B = A - 7 is mathematically correct per design,
 *    but shelf matching on existing inventory yields 26%. We pin the 20 planned C/Ns
 *    via cn-map (seedCnMapFromPlan) while keeping the formula for unmapped parts.
 *
 * Idempotent; `--revert` restores previous state.
 */

const { engPool } = require('../../../../instance/eng_db');
const { maqPool } = require('../../../../instance/maq_db');
const { seedCnMapFromPlan, ensureCnMapSchema } = require('./lib/seedCnMapFromPlan');

const MACHINE_NAME = 'KS-500RD';
const MACHINE_ID = 14;
const INVENTORY = 'tooling_ks500rd';
const SOURCE = 'TEMPLATE_B BALL(3) proc 1041 · lpb.eng_r_pi_tool · 20260821h_';

const OLD_SHOE_FORMULA = 'if(OD<19, 0, if(OD<21, 19, if(OD<28, 21, if(OD<37, 28, if(OD<46, 37, 46)))))';
const NEW_SHOE_FORMULA = 'if(W<6, -999, if(W<12, 0, if(W<20, 19, if(W<28, 21, if(W<36, 28, if(W<44, 37, if(W<64, 46, -999)))))))';
const NEW_SHOE_DESC = '20180821_KS-500RD_投入型式シュー対応表.xlsx: step based on W (work width) 6<=W<12->0, 12<=W<20->19, 20<=W<28->21, 28<=W<36->28, 36<=W<44->37, 44<=W<64->46';

const revert = process.argv.includes('--revert');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  if (revert) {
    console.log(`\n── Reverting ${MACHINE_NAME} FRONT SHOE & WORK DRIVER ──`);
    await engPool.query(
      `UPDATE tooling_formula
          SET formula_expr = $1, description = NULL, updated_at = NOW()
        WHERE machine_id = $2 AND tooling_name = 'FRONT SHOE' AND output_key = 'A'`,
      [OLD_SHOE_FORMULA, MACHINE_ID]
    );
    console.log('  Restored FRONT SHOE old formula');

    const delMap = await engPool.query(
      `DELETE FROM tooling_partno_map
        WHERE machine_name = $1 AND tooling_name = 'WORK DRIVER' AND cn IS NOT NULL`,
      [MACHINE_NAME]
    );
    console.log(`  Removed ${delMap.rowCount} WORK DRIVER cn map rows`);
    return;
  }

  await ensureCnMapSchema(engPool);

  console.log(`\n── 1. FRONT SHOE (W-based step formula) ──`);
  if (dryRun) {
    console.log(`  [dry-run] would update formula to: ${NEW_SHOE_FORMULA}`);
  } else {
    const upd = await engPool.query(
      `UPDATE tooling_formula
          SET formula_expr = $1, description = $2, updated_at = NOW()
        WHERE machine_id = $3 AND tooling_name = 'FRONT SHOE' AND output_key = 'A'`,
      [NEW_SHOE_FORMULA, NEW_SHOE_DESC, MACHINE_ID]
    );
    console.log(`  updated FRONT SHOE formula (${upd.rowCount} row)`);
  }

  console.log(`\n── 2. WORK DRIVER (seed cn-map from plan) ──`);
  if (dryRun) {
    console.log(`  [dry-run] would seed WORK DRIVER from lpb.eng_r_pi_tool family 4033-01`);
  } else {
    const stats = await seedCnMapFromPlan({
      engPool,
      maqPool,
      machine: MACHINE_NAME,
      tooling: 'WORK DRIVER',
      inventory: INVENTORY,
      family: '4033-01',
      source: SOURCE
    });
    console.log(`  map: removed ${stats.removed}, inserted ${stats.inserted}` +
                ` · specced ${stats.specced}/${stats.mapped}` +
                ` · off-shelf ${stats.offShelf} · ambiguous ${stats.ambiguous.length}`);
    if (stats.ambiguous.length) {
      console.log(`  ambiguous C/Ns (skipped): ${stats.ambiguous.join(' ')}`);
    }
  }

  console.log(`\nundo with:  node api/engineer/mtc/db_migrations/20260821h_ks500rd_front_shoe_and_work_driver.js --revert`);
}

main()
  .then(() => Promise.all([engPool.end(), maqPool.end()]))
  .catch(async (e) => {
    console.error(e);
    await Promise.all([engPool.end(), maqPool.end()]).catch(() => {});
    process.exit(1);
  });
